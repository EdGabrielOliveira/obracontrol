import { ConstructionError } from "../../../lib/errors";
import { prisma } from "../../../lib/prisma";
import { resolveResourceScope } from "../../../lib/resource-scope";

export type ScheduleVersionView = {
	id: string;
	versionNumber: number;
	label: string;
	status: "RASCUNHO" | "VIGENTE";
	isActive: boolean;
	revisionDate: string | null;
	reason: string | null;
	createdBy: string | null;
	createdAt: string;
	items: Array<{
		index: string;
		baselineStart: string | null;
		baselineEnd: string | null;
		baselineWeight: number | null;
		replannedStart: string | null;
		replannedEnd: string | null;
		deltaDays: number | null;
	}>;
};

export const SCHEDULE_BASELINE_LABEL = "Baseline";

function toIso(value: Date | null): string | null {
	return value ? value.toISOString() : null;
}

function deltaDaysBetween(start: Date | null, end: Date | null): number | null {
	if (!start || !end) return null;
	return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

async function assertWorkScope(actorId: string, workId: string) {
	const scope = await resolveResourceScope(actorId, { workId });
	if (!scope.canRead) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}
	return scope;
}

async function ensureBaseline(
	ownerId: string,
	workId: string,
): Promise<string> {
	const existing = await prisma.scheduleVersion.findFirst({
		where: { workId, label: SCHEDULE_BASELINE_LABEL },
		select: { id: true },
	});
	if (existing) return existing.id;

	return prisma.$transaction(async (tx) => {
		const again = await tx.scheduleVersion.findFirst({
			where: { workId, label: SCHEDULE_BASELINE_LABEL },
			select: { id: true },
		});
		if (again) return again.id;

		const version = await tx.scheduleVersion.create({
			data: {
				ownerId,
				workId,
				versionNumber: 1,
				label: SCHEDULE_BASELINE_LABEL,
				status: "VIGENTE",
				isActive: true,
			},
		});

		const baselines = await tx.constructionBaselineSchedule.findMany({
			where: { workId },
			orderBy: { index: "asc" },
			select: {
				budgetItemId: true,
				index: true,
				plannedStart: true,
				plannedEnd: true,
				plannedWeight: true,
			},
		});

		if (baselines.length > 0) {
			await tx.scheduleVersionItem.createMany({
				data: baselines.map((row) => ({
					versionId: version.id,
					budgetItemId: row.budgetItemId,
					index: row.index,
					baselineStart: row.plannedStart,
					baselineEnd: row.plannedEnd,
					baselineWeight: row.plannedWeight,
				})),
			});
		}

		return version.id;
	});
}

async function getVersionView(
	_ownerId: string,
	workId: string,
	versionId: string,
): Promise<ScheduleVersionView | null> {
	const version = await prisma.scheduleVersion.findFirst({
		where: { id: versionId, workId },
		include: { items: { orderBy: { index: "asc" } } },
	});
	if (!version) return null;

	return {
		id: version.id,
		versionNumber: version.versionNumber,
		label: version.label,
		status: version.status as "RASCUNHO" | "VIGENTE",
		isActive: version.isActive,
		revisionDate: toIso(version.revisionDate),
		reason: version.reason,
		createdBy: version.createdBy,
		createdAt: version.createdAt.toISOString(),
		items: version.items.map((item) => ({
			index: item.index,
			baselineStart: toIso(item.baselineStart),
			baselineEnd: toIso(item.baselineEnd),
			baselineWeight: item.baselineWeight ? Number(item.baselineWeight) : null,
			replannedStart: toIso(item.replannedStart),
			replannedEnd: toIso(item.replannedEnd),
			deltaDays: item.deltaDays,
		})),
	};
}

export const scheduleVersionService = {
	async getScheduleVersions(actorId: string, workId: string) {
		await assertWorkScope(actorId, workId);
		await ensureBaseline(
			(
				await prisma.constructionWork.findFirst({
					where: { id: workId },
					select: { ownerId: true },
				})
			)?.ownerId ?? "",
			workId,
		);

		const versions = await prisma.scheduleVersion.findMany({
			where: { workId },
			orderBy: { versionNumber: "asc" },
			select: { id: true },
		});

		const views: ScheduleVersionView[] = [];
		for (const version of versions) {
			const view = await getVersionView(
				(
					await prisma.constructionWork.findFirst({
						where: { id: workId },
						select: { ownerId: true },
					})
				)?.ownerId ?? "",
				workId,
				version.id,
			);
			if (view) views.push(view);
		}
		return views;
	},

	async getScheduleVersion(
		actorId: string,
		workId: string,
		versionId: string,
	): Promise<ScheduleVersionView | null> {
		const scope = await assertWorkScope(actorId, workId);
		return getVersionView(scope.resourceOwnerId, workId, versionId);
	},

	async createScheduleRevisionVersion(
		actorId: string,
		workId: string,
		input: {
			index: string;
			replannedStart: string;
			replannedEnd: string;
			revisionDate?: string | null;
			reason?: string | null;
		},
	): Promise<ScheduleVersionView> {
		const scope = await assertWorkScope(actorId, workId);
		const ownerId = scope.resourceOwnerId;

		const baselineId = await ensureBaseline(ownerId, workId);
		const baseline = await prisma.scheduleVersionItem.findFirst({
			where: { versionId: baselineId, index: input.index },
		});
		if (!baseline) {
			throw new ConstructionError(
				"INVALID_INPUT",
				`Item de cronograma com indice ${input.index} nao encontrado na baseline`,
				422,
			);
		}

		const revisionDate = input.revisionDate
			? new Date(input.revisionDate)
			: new Date();
		if (baseline.baselineStart && revisionDate < baseline.baselineStart) {
			throw new ConstructionError(
				"REVISION_DATE_OUT_OF_SEQUENCE",
				"Data da revisao anterior a baseline",
				422,
			);
		}

		const latest = await prisma.scheduleVersionItem.findMany({
			where: { versionId: baselineId, replannedStart: { not: null } },
			select: { replannedStart: true },
			orderBy: { replannedStart: "desc" },
			take: 1,
		});
		if (latest[0]?.replannedStart && revisionDate < latest[0].replannedStart) {
			throw new ConstructionError(
				"REVISION_DATE_OUT_OF_SEQUENCE",
				"Data da revisao anterior a revisao vigente",
				422,
			);
		}

		const replannedStart = new Date(input.replannedStart);
		const replannedEnd = new Date(input.replannedEnd);
		const deltaDays = deltaDaysBetween(replannedStart, replannedEnd);

		// Replanejamento sem mudanca de escopo/valor cria somente versao de
		// cronograma (nao mexe no orcamento).
		await prisma.scheduleVersionItem.update({
			where: { id: baseline.id },
			data: {
				replannedStart,
				replannedEnd,
				deltaDays,
			},
		});
		await prisma.scheduleVersion.update({
			where: { id: baselineId },
			data: {
				revisionDate,
				reason: input.reason ?? null,
				createdBy: actorId,
				status: "VIGENTE",
			},
		});

		const view = await getVersionView(ownerId, workId, baselineId);
		if (!view) {
			throw new ConstructionError("NOT_FOUND", "Versao nao encontrada", 404);
		}
		return view;
	},
};
