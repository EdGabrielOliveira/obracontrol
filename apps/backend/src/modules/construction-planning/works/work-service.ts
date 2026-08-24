import { ConstructionError } from "../../../lib/errors";
import * as workRepository from "../repository";
import type { ConstructionWorksFilter } from "../schema";

type WorkRepository = Pick<
	typeof workRepository,
	| "findWorkByOwnerAndCode"
	| "createWorkManual"
	| "listWorks"
	| "getWorkById"
	| "updateWork"
	| "deleteWork"
>;

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
			creationIdempotencyKey: input.creationIdempotencyKey ?? null,
		});
	}

	list(ownerId: string, filter: ConstructionWorksFilter) {
		return this.repository.listWorks(ownerId, filter);
	}

	async get(ownerId: string, workId: string) {
		const work = await this.repository.getWorkById(ownerId, workId);
		if (!work || work.ownerId !== ownerId) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}
		return work;
	}

	async update(ownerId: string, workId: string, input: UpdateManualWorkInput) {
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
			input.plannedEnd === undefined
		) {
			throw new ConstructionError(
				"NO_FIELDS",
				"Nenhum campo para atualizar",
				400,
			);
		}

		const result = await this.repository.updateWork(ownerId, workId, input);
		if (!result) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}
		return result;
	}

	/**
	 * DEC-005 (USR-003): exclusao de obra e comando relevante. GESTOR/SUPERVISOR
	 * geram solicitacao PENDING; GERENTE/ADMIN executam o efeito direto
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
