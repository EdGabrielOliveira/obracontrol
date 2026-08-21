import type { GovernanceRecord, Prisma } from "@prisma/client";
import { ConstructionError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import {
	type GovernanceRole,
	type GovernanceStatus,
	validateGovernanceTransition,
} from "../../lib/status-machine";
import { auditService } from "../audit/audit.service";

export type GovernanceRecordView = {
	id: string | null;
	ownerId: string;
	entityType: string;
	entityId: string;
	status: GovernanceStatus;
	version: number;
	reason: string | null;
	changedBy: string | null;
	changedAt: string | null;
};

export type GovernanceRepository = {
	find: (
		ownerId: string,
		entityType: string,
		entityId: string,
		tx?: Prisma.TransactionClient,
	) => Promise<GovernanceRecord | null>;
	create: (
		input: {
			ownerId: string;
			entityType: string;
			entityId: string;
			status: GovernanceStatus;
			version: number;
			reason: string | null;
			changedBy: string;
			changedAt: Date;
		},
		tx?: Prisma.TransactionClient,
	) => Promise<GovernanceRecord>;
	update: (
		id: string,
		input: {
			status: GovernanceStatus;
			version: number;
			reason: string | null;
			changedBy: string;
			changedAt: Date;
		},
		tx?: Prisma.TransactionClient,
	) => Promise<GovernanceRecord>;
};

export type GovernanceAudit = {
	log: (
		input: Parameters<typeof auditService.log>[0],
		tx?: Prisma.TransactionClient,
	) => Promise<unknown>;
};

type TransactionRunner = <T>(
	fn: (tx: Prisma.TransactionClient) => Promise<T>,
) => Promise<T>;

const prismaRepository: GovernanceRepository = {
	find: (ownerId, entityType, entityId, tx) => {
		const db = tx ?? prisma;
		return db.governanceRecord.findUnique({
			where: { ownerId_entityType_entityId: { ownerId, entityType, entityId } },
		});
	},
	create: (input, tx) => {
		const db = tx ?? prisma;
		return db.governanceRecord.create({ data: input });
	},
	update: (id, input, tx) => {
		const db = tx ?? prisma;
		return db.governanceRecord.update({ where: { id }, data: input });
	},
};

function toView(
	record: GovernanceRecord | null,
	identity: Pick<GovernanceRecordView, "ownerId" | "entityType" | "entityId">,
): GovernanceRecordView {
	if (!record) {
		return {
			...identity,
			id: null,
			status: "RASCUNHO",
			version: 0,
			reason: null,
			changedBy: null,
			changedAt: null,
		};
	}

	return {
		id: record.id,
		ownerId: record.ownerId,
		entityType: record.entityType,
		entityId: record.entityId,
		status: record.status as GovernanceStatus,
		version: record.version,
		reason: record.reason,
		changedBy: record.changedBy,
		changedAt: record.changedAt.toISOString(),
	};
}

export function normalizeGovernanceRole(
	role: string | null | undefined,
): GovernanceRole {
	if (
		role === "ADMIN" ||
		role === "GERENTE" ||
		role === "GESTOR" ||
		role === "SUPERVISOR"
	) {
		return role;
	}
	throw new ConstructionError(
		"FORBIDDEN",
		"Voce nao tem permissao para executar esta acao",
		403,
	);
}

export type MeasurementActorRole = GovernanceRole;

export function normalizeMeasurementRole(
	role: string | null | undefined,
): MeasurementActorRole {
	if ((role ?? "").trim().toUpperCase() === "OPERADOR") return "SUPERVISOR";
	return normalizeGovernanceRole(role);
}

export class GovernanceService {
	constructor(
		private readonly repository: GovernanceRepository = prismaRepository,
		private readonly audit: GovernanceAudit = auditService,
		private readonly runInTransaction: TransactionRunner = (fn) =>
			prisma.$transaction(fn),
	) {}

	async get(
		ownerId: string,
		entityType: string,
		entityId: string,
	): Promise<GovernanceRecordView> {
		const record = await this.repository.find(ownerId, entityType, entityId);
		return toView(record, { ownerId, entityType, entityId });
	}

	async assertWritable(
		ownerId: string,
		entityType: string,
		entityId: string,
	): Promise<void> {
		const record = await this.repository.find(ownerId, entityType, entityId);
		if (record?.status !== "ACEITO" && record?.status !== "TRAVADO") return;

		throw new ConstructionError(
			"GOVERNANCE_MUTATION_BLOCKED",
			"A entidade aceita ou travada deve ser reaberta antes de ser alterada",
			423,
		);
	}

	async isWritableBlocked(
		ownerId: string,
		entityType: string,
		entityId: string,
	): Promise<boolean> {
		const record = await this.repository.find(ownerId, entityType, entityId);
		return record?.status === "ACEITO" || record?.status === "TRAVADO";
	}

	async transition(input: {
		ownerId: string;
		userId: string;
		entityType: string;
		entityId: string;
		toStatus: GovernanceStatus;
		role: GovernanceRole;
		reason?: string | null;
		override?: boolean;
	}): Promise<GovernanceRecordView> {
		if (!input.entityType.trim() || !input.entityId.trim()) {
			throw new ConstructionError(
				"INVALID_GOVERNANCE_TARGET",
				"Entidade e identificador sao obrigatorios",
				422,
			);
		}

		return this.runInTransaction(async (tx) => {
			const current = await this.repository.find(
				input.ownerId,
				input.entityType,
				input.entityId,
				tx,
			);
			const currentStatus = (current?.status ?? "RASCUNHO") as GovernanceStatus;
			validateGovernanceTransition(currentStatus, input.toStatus, {
				role: input.role,
				reason: input.reason,
				override: input.override,
			});

			if (currentStatus === input.toStatus) {
				return toView(current, {
					ownerId: input.ownerId,
					entityType: input.entityType,
					entityId: input.entityId,
				});
			}

			const nextVersion = (current?.version ?? 0) + 1;
			const reason = input.reason?.trim() || null;
			const changedAt = new Date();
			let next: GovernanceRecord;
			try {
				next = current
					? await this.repository.update(
							current.id,
							{
								status: input.toStatus,
								version: nextVersion,
								reason,
								changedBy: input.userId,
								changedAt,
							},
							tx,
						)
					: await this.repository.create(
							{
								ownerId: input.ownerId,
								entityType: input.entityType,
								entityId: input.entityId,
								status: input.toStatus,
								version: nextVersion,
								reason,
								changedBy: input.userId,
								changedAt,
							},
							tx,
						);
			} catch (error) {
				if ((error as { code?: string }).code === "P2002") {
					throw new ConstructionError(
						"GOVERNANCE_CONFLICT",
						"Transicao ja processada por outro pedido",
						409,
					);
				}
				throw error;
			}

			await this.audit.log(
				{
					userId: input.userId,
					ownerId: input.ownerId,
					action: "UPDATE",
					entityType: "GOVERNANCE_RECORD",
					entityId: next.id,
					entityDescription: `${input.entityType}:${input.entityId}`,
					previousState: {
						status: currentStatus,
						version: current?.version ?? 0,
					},
					newState: {
						status: input.toStatus,
						version: next.version,
						reason,
						override: input.override ?? false,
					},
				},
				tx,
			);

			return toView(next, {
				ownerId: input.ownerId,
				entityType: input.entityType,
				entityId: input.entityId,
			});
		});
	}
}

export const governanceService = new GovernanceService();
