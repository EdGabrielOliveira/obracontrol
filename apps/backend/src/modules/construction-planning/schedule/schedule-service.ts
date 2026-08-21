import { ConstructionError } from "../../../lib/errors";
import { prisma } from "../../../lib/prisma";
import {
	constructionGovernanceGuard,
	type GovernanceMutationGuard,
} from "../governance-guard";
import { deriveWorkIdentity } from "../identity";
import { ancestorIndexesOf } from "../imports/index-helpers";
import type { NormalizedScheduleRevision } from "../imports/normalized-types";
import type * as constructionRepository from "../repository";
import { buildScheduleFromDbItems } from "./schedule-builder";

type ConstructionScheduleRepository = Pick<
	typeof constructionRepository,
	"getWorkWithItems"
>;

type ScheduleWork = Awaited<
	ReturnType<ConstructionScheduleRepository["getWorkWithItems"]>
>;

type ScheduleWorkItem = NonNullable<ScheduleWork>["items"][number];
type BaselineScheduleRow =
	NonNullable<ScheduleWork>["baselineSchedules"][number];
type ScheduleRevisionRow =
	NonNullable<ScheduleWork>["scheduleRevisions"][number];

export type BaselineScheduleInput = {
	index: string;
	plannedStart: string;
	plannedEnd: string;
	plannedWeight: number;
};

export type ScheduleRevisionInput = {
	index: string;
	version?: string | null;
	replannedStart: string;
	replannedEnd: string;
	revisionDate?: string | null;
	reason?: string | null;
};

export type ManualScheduleItemInput = {
	budgetItemId: string;
	plannedStart: string;
	plannedEnd: string;
};

export type ManualScheduleItemResult = {
	id: string;
	budgetItemId: string;
	index: string;
	plannedStart: string;
	plannedEnd: string;
	created: boolean;
};

const SCHEDULE_BASELINE_LABEL = "Baseline";

function toDayUtc(value: Date): number {
	return Date.UTC(
		value.getUTCFullYear(),
		value.getUTCMonth(),
		value.getUTCDate(),
	);
}

function parseScheduleDate(value: string, field: string): Date {
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		throw new ConstructionError("INVALID_INPUT", `Data ${field} invalida`, 422);
	}
	return parsed;
}

export function isScheduleItemDelayed(
	item: {
		plannedEnd: Date | null | undefined;
		completionPercentage?: number | { toNumber(): number } | null;
	},
	referenceDate: Date,
): boolean {
	if (!item.plannedEnd) return false;
	if (Number(item.completionPercentage ?? 0) >= 100) return false;
	return toDayUtc(item.plannedEnd) < toDayUtc(referenceDate);
}

function closestBudgetItemFor(
	itemsByIndex: Map<string, ScheduleWorkItem>,
	index: string,
): ScheduleWorkItem | null {
	const exact = itemsByIndex.get(index);
	if (exact) return exact;
	for (const candidate of ancestorIndexesOf(index)) {
		const item = itemsByIndex.get(candidate);
		if (item) return item;
	}
	return null;
}

function earliestBaselineDate(
	baselines: BaselineScheduleRow[],
	item: ScheduleWorkItem | null,
): Date | null {
	const linked = item
		? baselines.find(
				(baseline) =>
					baseline.budgetItemId === item.id || baseline.index === item.index,
			)
		: null;
	const candidates = linked ? [linked] : baselines;
	const dates = candidates
		.flatMap((baseline) => [baseline.plannedStart, baseline.plannedEnd])
		.filter((date): date is Date => date != null);
	if (dates.length === 0) return null;
	return new Date(Math.min(...dates.map((date) => date.getTime())));
}

function latestRevisionDate(revisions: ScheduleRevisionRow[]): Date | null {
	const dates = revisions
		.map((revision) => revision.revisionDate)
		.filter((date): date is Date => date != null);
	if (dates.length === 0) return null;
	return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function nextRevisionVersion(revisions: ScheduleRevisionRow[]): string {
	const numbers = revisions
		.map((revision) => revision.version)
		.filter((version): version is string => version != null)
		.map((version) => Number.parseInt(version.replace(/^R/i, ""), 10))
		.filter((number) => Number.isFinite(number) && number > 0);
	return `R${(numbers.length ? Math.max(...numbers) : 0) + 1}`;
}

function assertRevisionDateInSequence(
	revisionDate: Date,
	baseline: Date | null,
	latest: Date | null,
) {
	if (
		(baseline && revisionDate < baseline) ||
		(latest && revisionDate < latest)
	) {
		throw new ConstructionError(
			"REVISION_DATE_OUT_OF_SEQUENCE",
			"Data da revisao anterior a baseline ou a revisao vigente",
			422,
		);
	}
}

export class ConstructionScheduleService {
	constructor(
		private readonly repository: ConstructionScheduleRepository,
		private readonly governance: GovernanceMutationGuard = constructionGovernanceGuard,
	) {}

	async getWorkSchedule(ownerId: string, workId: string) {
		const work = await this.repository.getWorkWithItems(ownerId, workId);

		if (!work || work.ownerId !== ownerId) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}

		const identity = deriveWorkIdentity({
			code: work.code,
			name: work.name,
			baseDate: work.baseDate,
		});

		return buildScheduleFromDbItems(
			{
				id: work.id,
				code: identity.code,
				name: identity.name,
				clientName: work.clientName,
				plannedStart: work.plannedStart,
				plannedEnd: work.plannedEnd,
				baseDate: identity.baseDate,
				createdAt: work.createdAt,
				lastImportAt: work.imports[0]?.createdAt ?? null,
			},
			{
				items: work.items,
				baselineSchedules: work.baselineSchedules,
				scheduleRevisions: work.scheduleRevisions,
				measurements: work.measurements,
				actualCosts: work.actualCosts,
			},
		);
	}

	async createSchedule(
		ownerId: string,
		workId: string,
		items: BaselineScheduleInput[],
	) {
		await this.governance.assertWritable(ownerId, "SCHEDULE", workId);

		const work = await this.repository.getWorkWithItems(ownerId, workId);

		if (!work || work.ownerId !== ownerId) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}

		const fullWork = await prisma.constructionWork.findFirst({
			where: { id: workId, ownerId },
			select: { activeImportId: true },
		});
		const activeImportId =
			fullWork?.activeImportId ?? work.items[0]?.importId ?? null;
		if (!activeImportId) {
			throw new ConstructionError(
				"UNPROCESSABLE",
				"A obra precisa de uma importacao ativa para criar o cronograma base manualmente",
				422,
			);
		}

		const budgetItemByIndex = new Map(
			work.items.map((item) => [item.index, item]),
		);

		const payloads = items.map((input) => {
			const budgetItem = budgetItemByIndex.get(input.index);
			if (!budgetItem) {
				throw new ConstructionError(
					"INVALID_INPUT",
					`Item de orcamento com indice ${input.index} nao encontrado`,
					422,
				);
			}
			return {
				ownerId,
				workId,
				importId: activeImportId,
				budgetItemId: budgetItem.id,
				index: input.index,
				plannedStart: new Date(input.plannedStart),
				plannedEnd: new Date(input.plannedEnd),
				plannedWeight: input.plannedWeight,
			};
		});

		await prisma.$transaction(async (tx) => {
			await tx.constructionBaselineSchedule.deleteMany({
				where: { ownerId, workId, importId: activeImportId },
			});
			await tx.constructionBaselineSchedule.createMany({ data: payloads });
		});

		return this.getWorkSchedule(ownerId, workId);
	}

	async upsertManualScheduleItem(
		ownerId: string,
		workId: string,
		input: ManualScheduleItemInput,
	): Promise<ManualScheduleItemResult> {
		await this.governance.assertWritable(ownerId, "SCHEDULE", workId);

		const work = await this.repository.getWorkWithItems(ownerId, workId);
		if (!work || work.ownerId !== ownerId) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}

		const fullWork = await prisma.constructionWork.findFirst({
			where: { id: workId, ownerId },
			select: { activeImportId: true },
		});
		const activeImportId =
			fullWork?.activeImportId ?? work.items[0]?.importId ?? null;
		if (!activeImportId) {
			throw new ConstructionError(
				"UNPROCESSABLE",
				"A obra precisa de uma importacao ativa para cadastrar o cronograma",
				422,
			);
		}

		const budgetItem = work.items.find(
			(item) => item.id === input.budgetItemId,
		);
		if (!budgetItem) {
			throw new ConstructionError(
				"INVALID_INPUT",
				"O item selecionado nao pertence ao orcamento ativo da obra",
				422,
			);
		}

		const plannedStart = parseScheduleDate(input.plannedStart, "de inicio");
		const plannedEnd = parseScheduleDate(input.plannedEnd, "de fim");
		if (plannedEnd < plannedStart) {
			throw new ConstructionError(
				"INVALID_INPUT",
				"A data de fim deve ser maior ou igual a data de inicio",
				422,
			);
		}

		return prisma.$transaction(async (tx) => {
			const existing = await tx.constructionBaselineSchedule.findFirst({
				where: {
					ownerId,
					workId,
					importId: activeImportId,
					budgetItemId: budgetItem.id,
				},
				orderBy: { createdAt: "desc" },
			});

			const baseline = existing
				? await tx.constructionBaselineSchedule.update({
						where: { id: existing.id },
						data: { index: budgetItem.index, plannedStart, plannedEnd },
					})
				: await tx.constructionBaselineSchedule.create({
						data: {
							ownerId,
							workId,
							importId: activeImportId,
							budgetItemId: budgetItem.id,
							rowNumber: null,
							index: budgetItem.index,
							plannedStart,
							plannedEnd,
							plannedWeight: null,
						},
					});

			const baselineVersion = await tx.scheduleVersion.findFirst({
				where: { workId, label: SCHEDULE_BASELINE_LABEL },
				select: { id: true },
			});
			if (baselineVersion) {
				const versionItem = await tx.scheduleVersionItem.findFirst({
					where: {
						versionId: baselineVersion.id,
						OR: [{ budgetItemId: budgetItem.id }, { index: budgetItem.index }],
					},
				});
				if (versionItem) {
					await tx.scheduleVersionItem.update({
						where: { id: versionItem.id },
						data: {
							budgetItemId: budgetItem.id,
							index: budgetItem.index,
							baselineStart: plannedStart,
							baselineEnd: plannedEnd,
						},
					});
				} else {
					await tx.scheduleVersionItem.create({
						data: {
							versionId: baselineVersion.id,
							budgetItemId: budgetItem.id,
							index: budgetItem.index,
							baselineStart: plannedStart,
							baselineEnd: plannedEnd,
							baselineWeight: null,
						},
					});
				}
			}

			return {
				id: baseline.id,
				budgetItemId: budgetItem.id,
				index: budgetItem.index,
				plannedStart:
					baseline.plannedStart?.toISOString() ?? plannedStart.toISOString(),
				plannedEnd:
					baseline.plannedEnd?.toISOString() ?? plannedEnd.toISOString(),
				created: !existing,
			};
		});
	}

	async createScheduleRevisions(
		ownerId: string,
		workId: string,
		revisions: NormalizedScheduleRevision[],
		userId: string,
	): Promise<number> {
		const work = await this.repository.getWorkWithItems(ownerId, workId);

		if (!work || work.ownerId !== ownerId) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}

		const fullWork = await prisma.constructionWork.findFirst({
			where: { id: workId, ownerId },
			select: { activeImportId: true },
		});
		const activeImportId = fullWork?.activeImportId ?? null;
		if (!activeImportId) {
			throw new ConstructionError(
				"UNPROCESSABLE",
				"A obra precisa de uma importacao ativa para criar o cronograma base manualmente",
				422,
			);
		}

		const budgetItemByIndex = new Map(
			work.items.map((item) => [item.index, item]),
		);
		const latest = latestRevisionDate(work.scheduleRevisions ?? []);

		const payloads = revisions.flatMap((revision) => {
			const budgetItem = budgetItemByIndex.get(revision.index);
			if (!budgetItem) return [];

			if (revision.revisionDate) {
				const baseline = earliestBaselineDate(
					work.baselineSchedules ?? [],
					budgetItem,
				);
				assertRevisionDateInSequence(revision.revisionDate, baseline, latest);
			}

			return {
				ownerId,
				workId,
				importId: activeImportId,
				budgetItemId: budgetItem.id,
				rowNumber: revision.rowNumber,
				index: revision.index,
				version: revision.version ?? null,
				replannedStart: revision.replannedStart,
				replannedEnd: revision.replannedEnd,
				revisionDate: revision.revisionDate,
				reason: revision.reason ?? null,
				createdBy: userId,
			};
		});

		await prisma.$transaction(async (tx) => {
			await tx.constructionScheduleRevision.deleteMany({
				where: { ownerId, workId, importId: activeImportId },
			});
			if (payloads.length > 0) {
				await tx.constructionScheduleRevision.createMany({
					data: payloads,
				});
			}
		});

		return payloads.length;
	}

	async addScheduleRevision(
		ownerId: string,
		workId: string,
		input: ScheduleRevisionInput,
		userId: string,
	) {
		await this.governance.assertWritable(ownerId, "SCHEDULE", workId);

		const work = await this.repository.getWorkWithItems(ownerId, workId);

		if (!work || work.ownerId !== ownerId) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}

		const fullWork = await prisma.constructionWork.findFirst({
			where: { id: workId, ownerId },
			select: { activeImportId: true },
		});
		const activeImportId = fullWork?.activeImportId ?? null;
		if (!activeImportId) {
			throw new ConstructionError(
				"UNPROCESSABLE",
				"A obra precisa de uma importacao ativa para registrar o replanejamento",
				422,
			);
		}

		const budgetItem = work.items.find((item) => item.index === input.index);
		if (!budgetItem) {
			throw new ConstructionError(
				"INVALID_INPUT",
				`Item de orcamento com indice ${input.index} nao encontrado`,
				422,
			);
		}

		const revisionDate = input.revisionDate
			? new Date(input.revisionDate)
			: new Date();
		const scheduledEnd =
			work.baselineSchedules?.find(
				(baseline) =>
					baseline.budgetItemId === budgetItem.id ||
					baseline.index === budgetItem.index,
			)?.plannedEnd ?? budgetItem.plannedEnd;
		if (
			scheduledEnd &&
			!isScheduleItemDelayed(
				{
					plannedEnd: scheduledEnd,
					completionPercentage: budgetItem.completionPercentage,
				},
				new Date(),
			)
		) {
			throw new ConstructionError(
				"SCHEDULE_ITEM_NOT_DELAYED",
				"Somente itens atrasados e nao concluidos podem ser replanejados",
				422,
			);
		}
		const baseline = earliestBaselineDate(
			work.baselineSchedules ?? [],
			budgetItem,
		);
		const latest = latestRevisionDate(work.scheduleRevisions ?? []);
		assertRevisionDateInSequence(revisionDate, baseline, latest);

		return prisma.constructionScheduleRevision.create({
			data: {
				ownerId,
				workId,
				importId: activeImportId,
				budgetItemId: budgetItem.id,
				rowNumber: null,
				index: input.index,
				version: nextRevisionVersion(work.scheduleRevisions ?? []),
				replannedStart: new Date(input.replannedStart),
				replannedEnd: new Date(input.replannedEnd),
				revisionDate,
				reason: input.reason ?? null,
				createdBy: userId,
			},
		});
	}

	async importSchedule(
		ownerId: string,
		workId: string,
		items: BaselineScheduleInput[],
		revisions: NormalizedScheduleRevision[],
		userId: string,
	) {
		await this.governance.assertWritable(ownerId, "SCHEDULE", workId);

		const work = await this.repository.getWorkWithItems(ownerId, workId);

		if (!work || work.ownerId !== ownerId) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}

		const fullWork = await prisma.constructionWork.findFirst({
			where: { id: workId, ownerId },
			select: { activeImportId: true },
		});
		const activeImportId = fullWork?.activeImportId ?? null;
		if (!activeImportId) {
			throw new ConstructionError(
				"UNPROCESSABLE",
				"A obra precisa de uma importacao ativa para importar o cronograma",
				422,
			);
		}

		const budgetItemByIndex = new Map(
			work.items.map((item) => [item.index, item]),
		);

		const baselinePayloads = items.flatMap((input) => {
			const budgetItem = closestBudgetItemFor(budgetItemByIndex, input.index);
			if (!budgetItem) {
				throw new ConstructionError(
					"INVALID_INPUT",
					`Item de orcamento com indice ${input.index} nao encontrado`,
					422,
				);
			}
			return [
				{
					ownerId,
					workId,
					importId: activeImportId,
					budgetItemId: budgetItem.id,
					index: input.index,
					plannedStart: new Date(input.plannedStart),
					plannedEnd: new Date(input.plannedEnd),
					plannedWeight: input.plannedWeight,
				},
			];
		});

		const revisionPayloads = revisions.flatMap((revision) => {
			const budgetItem = closestBudgetItemFor(
				budgetItemByIndex,
				revision.index,
			);
			if (!budgetItem) return [];
			const baseline = baselinePayloads.find(
				(candidate) => candidate.index === revision.index,
			);
			if (
				baseline?.plannedEnd &&
				!isScheduleItemDelayed(
					{
						plannedEnd: baseline.plannedEnd,
						completionPercentage: budgetItem.completionPercentage,
					},
					new Date(),
				)
			) {
				throw new ConstructionError(
					"SCHEDULE_ITEM_NOT_DELAYED",
					"Somente itens atrasados e nao concluidos podem ser replanejados",
					422,
				);
			}

			return {
				ownerId,
				workId,
				importId: activeImportId,
				budgetItemId: budgetItem.id,
				rowNumber: revision.rowNumber,
				index: revision.index,
				version: revision.version ?? null,
				replannedStart: revision.replannedStart,
				replannedEnd: revision.replannedEnd,
				revisionDate: revision.revisionDate,
				reason: revision.reason ?? null,
				createdBy: userId,
			};
		});

		await prisma.$transaction(async (tx) => {
			if (items.length > 0) {
				await tx.constructionBaselineSchedule.deleteMany({
					where: { ownerId, workId, importId: activeImportId },
				});
				await tx.constructionBaselineSchedule.createMany({
					data: baselinePayloads,
				});
			}
			if (revisionPayloads.length > 0) {
				await tx.constructionScheduleRevision.deleteMany({
					where: { ownerId, workId, importId: activeImportId },
				});
				await tx.constructionScheduleRevision.createMany({
					data: revisionPayloads,
				});
			}
		});

		return {
			work: { id: workId },
			replanningImported: revisionPayloads.length,
		};
	}
}
