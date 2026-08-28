import { ConstructionError } from "../../../lib/errors";
import { validateStatusTransition } from "../../../lib/status-machine";
import * as workRepository from "../repository";
import type { ConstructionWorksFilter } from "../schema";
import {
	normalizeWorkOperationalStatus,
	WORK_OPERATIONAL_TRANSITIONS,
} from "./work-operational-status";

type WorkResult = Record<string, unknown>;
type WorkRepository = Omit<
	Pick<
		typeof workRepository,
		"createWorkManual" | "listWorks" | "updateWork" | "deleteWork"
	>,
	never
> & {
	findWorkByOwnerAndCode: (
		ownerId: string,
		code: string,
	) => Promise<WorkResult | null>;
	getWorkById: (
		ownerId: string,
		workId: string,
		workspaceId?: string | null,
	) => Promise<WorkResult | null>;
};

export type StructuredAddressInput = {
	zipCode: string;
	street?: string;
	district?: string;
	number?: string;
	city: string;
	state: string;
	complement?: string | null;
	latitude?: number | null;
	longitude?: number | null;
};

export type CreateManualWorkInput = {
	code?: string;
	name: string;
	costCenterId: string;
	address?: string;
	structuredAddress?: StructuredAddressInput | null;
	clientName?: string;
	baseDate?: string;
	plannedStart?: string;
	plannedEnd?: string;
	areaM2?: number;
	responsibleName?: string;
	operationalStatus?: string;
	statusReason?: string;
	creationIdempotencyKey?: string;
};

export type UpdateManualWorkInput = {
	code?: string;
	name?: string;
	costCenterId?: string;
	address?: string;
	structuredAddress?: StructuredAddressInput | null;
	clientName?: string;
	areaM2?: number;
	responsibleName?: string;
	plannedStart?: string;
	plannedEnd?: string;
	operationalStatus?: string;
	statusReason?: string;
};

export class ConstructionWorkService {
	constructor(private readonly repository: WorkRepository = workRepository) {}

	async create(ownerId: string, input: CreateManualWorkInput) {
		if (input.creationIdempotencyKey) {
			const findByKey = (
				this.repository as typeof this.repository & {
					findWorkByOwnerAndCreationIdempotencyKey?: (
						owner: string,
						key: string,
					) => Promise<unknown | null>;
				}
			).findWorkByOwnerAndCreationIdempotencyKey;
			const existing = findByKey
				? await findByKey(ownerId, input.creationIdempotencyKey)
				: null;
			if (existing) return existing;
		}
		const code =
			input.code?.trim() ||
			`OBRA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
		const name = input.name?.trim();
		const costCenterId = input.costCenterId?.trim();

		if (!name) {
			throw new ConstructionError("MISSING_FIELDS", "Nome e obrigatorio", 400);
		}

		if (!costCenterId) {
			throw new ConstructionError(
				"MISSING_FIELDS",
				"Centro de custo e obrigatorio",
				400,
			);
		}
		if (input.plannedStart && input.plannedEnd) {
			const start = new Date(input.plannedStart);
			const end = new Date(input.plannedEnd);
			if (
				Number.isNaN(start.getTime()) ||
				Number.isNaN(end.getTime()) ||
				end < start
			) {
				throw new ConstructionError(
					"INVALID_DATE_RANGE",
					"A data final deve ser igual ou posterior à data inicial",
					422,
				);
			}
		}

		const existing = await this.repository.findWorkByOwnerAndCode(
			ownerId,
			code,
		);
		if (existing) {
			throw new ConstructionError(
				"WORK_EXISTS",
				"Ja existe uma obra com esse codigo",
				409,
			);
		}

		return this.repository.createWorkManual(ownerId, {
			code,
			name,
			costCenterId,
			address: input.address?.trim() || null,
			structuredAddress: input.structuredAddress ?? null,
			clientName: input.clientName?.trim() || null,
			baseDate: input.baseDate ? new Date(input.baseDate) : null,
			plannedStart: input.plannedStart ? new Date(input.plannedStart) : null,
			plannedEnd: input.plannedEnd ? new Date(input.plannedEnd) : null,
			areaM2: input.areaM2 ?? null,
			responsibleName: input.responsibleName?.trim() || null,
			// Toda obra nova nasce como rascunho; a promoção para "não iniciada"
			// é uma transição operacional explícita posterior.
			operationalStatus: "DRAFT",
			statusReason: null,
			creationIdempotencyKey: input.creationIdempotencyKey ?? null,
		});
	}

	list(ownerId: string, filter: ConstructionWorksFilter) {
		return this.repository.listWorks(ownerId, filter);
	}

	async get(ownerId: string, workId: string, ctx?: { workspaceId?: string | null }) {
		const work = ctx?.workspaceId
			? await this.repository.getWorkById(ownerId, workId, ctx.workspaceId)
			: await this.repository.getWorkById(ownerId, workId);
		if (!work) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}
		return work;
	}

	async update(
		ownerId: string,
		workId: string,
		input: UpdateManualWorkInput,
		ctx?: { userId: string; role?: string | null; workspaceId?: string | null },
	) {
		if (input.name !== undefined && !input.name.trim()) {
			throw new ConstructionError("MISSING_FIELDS", "Nome é obrigatório", 422);
		}
		if (input.plannedStart && input.plannedEnd) {
			const start = new Date(input.plannedStart);
			const end = new Date(input.plannedEnd);
			if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
				throw new ConstructionError(
					"INVALID_DATE_RANGE",
					"A data final deve ser igual ou posterior à data inicial",
					422,
				);
			}
		}
		if (
			!input.code &&
			!input.name &&
			input.costCenterId === undefined &&
			input.address === undefined &&
			input.structuredAddress === undefined &&
			input.clientName === undefined &&
			input.areaM2 === undefined &&
			input.responsibleName === undefined &&
			input.plannedStart === undefined &&
			input.plannedEnd === undefined &&
			input.operationalStatus === undefined
		) {
			throw new ConstructionError(
				"NO_FIELDS",
				"Nenhum campo para atualizar",
				400,
			);
		}
		let expectedOperationalStatus: string | undefined;
		if (input.operationalStatus !== undefined) {
			if (ctx?.role === "SUPERVISOR") {
				throw new ConstructionError(
					"FORBIDDEN",
					"Supervisor nao pode alterar o status operacional da obra",
					403,
				);
			}
			const current = ctx?.workspaceId
				? await this.repository.getWorkById(ownerId, workId, ctx.workspaceId)
				: await this.repository.getWorkById(ownerId, workId);
			if (!current) {
				throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
			}
			const persistedStatus =
				(
					current as { operationalStatus?: string | null }
				).operationalStatus?.trim() || "NOT_STARTED";
			const currentStatus = normalizeWorkOperationalStatus(persistedStatus);
			expectedOperationalStatus = persistedStatus;
			validateStatusTransition(
				"Obra",
				WORK_OPERATIONAL_TRANSITIONS,
				currentStatus,
				input.operationalStatus,
			);
			if (
				(input.operationalStatus === "SUSPENDED" ||
					input.operationalStatus === "IGNORED") &&
				!input.statusReason?.trim()
			) {
				throw new ConstructionError(
					"STATUS_REASON_REQUIRED",
					"Informe o motivo para suspender ou arquivar a obra",
					422,
				);
			}
		}

		const result = await this.repository.updateWork(ownerId, workId, {
			...input,
			statusChangedBy: ctx?.userId,
			workspaceId: ctx?.workspaceId,
			expectedOperationalStatus,
		});
		if (!result) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}
		return result;
	}

	/**
	 * DEC-005 (USR-003): exclusao de obra e comando relevante. SUPERVISOR
	 * gera solicitacao PENDING; GESTOR, GERENTE e ADMIN executam o efeito direto
	 * (handler WORK_DELETE) na mesma transacao.
	 */
	async delete(ownerId: string, workId: string, ctx?: { userId: string }) {
		if (!ctx?.userId) {
			const result = await this.repository.deleteWork(ownerId, workId);
			if (!result) {
				throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
			}
			return result;
		}

		const commandId = `work-delete-${workId}-${crypto.randomUUID()}`;
		const { submitApproval } = await import(
			"../../governance/approval.service"
		);
		const result = await submitApproval({
			actorId: ctx.userId,
			resourceType: "WORK",
			resourceId: workId,
			commandId,
			effectAction: "WORK_DELETE",
			payload: { workId },
			expectedVersion: 1,
			idempotencyKey: commandId,
		});

		if (result.status === "PENDING") {
			return {
				status: "PENDING" as const,
				approvalRequest: {
					id: result.approvalRequestId,
					requiredApproverRole: result.requiredApproverRole ?? "GERENTE",
					organizationId: result.scope?.organizationId ?? "",
					costCenterId: result.scope?.costCenterId ?? null,
					createdAt: new Date().toISOString(),
				},
			};
		}

		return { status: "EXECUTED" as const, data: result.data };
	}
}

export const constructionWorkService = new ConstructionWorkService();
