import type { Prisma } from "@prisma/client";
import { ConstructionError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { budgetControlService } from "../construction-planning/budget-control/budget-control.service";
import { projectApprovedBudgetVersion } from "../construction-planning/budget-version-projection.service";
import {
	assertSelectedRowIds,
	selectWorkbookRows,
} from "../construction-planning/imports/selected-workbook";
import { deleteWorkCascade } from "../construction-planning/works/works.repository";
import type {
	ApprovalDecision,
	ApprovalEffectHandler,
	ApprovalRequest,
} from "./approval.types";
import { hashApprovalPayload } from "./approval.types";

function getWorkId(payload: unknown): string | null {
	const value = payload as { workId?: unknown } | null;
	return typeof value?.workId === "string" ? value.workId : null;
}

function assertSameWork(scope: { workId: string | null }, payload: unknown) {
	const workId = getWorkId(payload);
	if (!scope.workId || !workId || scope.workId !== workId) {
		throw new Error(
			"payload.workId deve coincidir com o escopo da solicitacao",
		);
	}
}

const BUDGET_VERSION_ACTIVATE: ApprovalEffectHandler = {
	action: "BUDGET_VERSION_ACTIVATE",
	apply: async ({ tx, request }) => {
		const payload = request.payloadJson as {
			budgetVersionId: string;
			workId: string;
		};
		const version = await tx.budgetVersion.findFirst({
			where: { id: payload.budgetVersionId, workId: payload.workId },
		});
		if (!version) throw new Error("versao de orcamento nao encontrada");

		{
			const sourceIsCurrent = version.sourceVersionId
				? (await tx.budgetVersion.count({
						where: {
							id: version.sourceVersionId,
							workId: payload.workId,
							isActive: true,
						},
					})) === 1
				: true;
			if (!sourceIsCurrent) {
				throw new ConstructionError(
					"BUDGET_VERSION_SOURCE_CHANGED",
					"A versão de origem não está mais vigente",
					409,
				);
			}
			await projectApprovedBudgetVersion(tx, {
				ownerId: request.ownerId,
				workId: payload.workId,
				budgetVersionId: version.id,
			});
		}
		await tx.budgetVersion.updateMany({
			where: { workId: payload.workId, isActive: true },
			data: { isActive: false, status: "SUBSTITUIDO" },
		});
		await tx.budgetVersion.update({
			where: { id: version.id },
			data: { status: "VIGENTE", isActive: true },
		});
	},
	reject: async ({ tx, request }) => {
		const payload = request.payloadJson as {
			budgetVersionId: string;
			workId: string;
		};
		const version = await tx.budgetVersion.findFirst({
			where: { id: payload.budgetVersionId, workId: payload.workId },
		});
		if (!version) throw new Error("versao de orcamento nao encontrada");
		await tx.budgetVersion.update({
			where: { id: version.id },
			data: { status: "RECUSADO" },
		});
	},
};

const SCHEDULE_VERSION_ACTIVATE: ApprovalEffectHandler = {
	action: "SCHEDULE_VERSION_ACTIVATE",
	apply: async ({ tx, request }) => {
		const payload = request.payloadJson as {
			scheduleVersionId: string;
			workId: string;
		};
		const version = await tx.scheduleVersion.findFirst({
			where: { id: payload.scheduleVersionId, workId: payload.workId },
		});
		if (!version) throw new Error("versao de cronograma nao encontrada");
		await tx.scheduleVersion.updateMany({
			where: { workId: payload.workId, isActive: true },
			data: { isActive: false },
		});
		await tx.scheduleVersion.update({
			where: { id: version.id },
			data: { status: "VIGENTE", isActive: true },
		});
	},
};

const WORK_MEASUREMENT_APPROVE: ApprovalEffectHandler = {
	action: "WORK_MEASUREMENT_APPROVE",
	apply: async () => {},
};

const CONTRACT_MEASUREMENT_APPROVE: ApprovalEffectHandler = {
	action: "CONTRACT_MEASUREMENT_APPROVE",
	apply: async () => {},
};

const PAYMENT_CONFIRM: ApprovalEffectHandler = {
	action: "PAYMENT_CONFIRM",
	apply: async ({ request }) => {
		void request;
	},
};

const COST_APPROVE: ApprovalEffectHandler = {
	action: "COST_APPROVE",
	apply: async ({ request }) => {
		void request;
	},
};

const BUDGET_IMPACT_APPROVE: ApprovalEffectHandler = {
	action: "BUDGET_IMPACT_APPROVE",
	apply: async ({ tx, request }) => {
		const payload = request.payloadJson as {
			workId: string;
			impactIds: string[];
		};
		assertSameWork({ workId: request.resourceId }, payload);
		for (const impactId of payload.impactIds) {
			await budgetControlService.approve(
				request.ownerId,
				impactId,
				{ userId: request.actorId },
				tx,
			);
		}
	},
	reject: async ({ tx, request }) => {
		const payload = request.payloadJson as {
			workId: string;
			impactIds: string[];
		};
		assertSameWork({ workId: request.resourceId }, payload);
		for (const impactId of payload.impactIds) {
			await budgetControlService.reject(
				request.ownerId,
				impactId,
				{ userId: request.actorId },
				tx,
			);
		}
	},
	canReverse: async ({ request }) => {
		const payload = request.payloadJson as {
			workId: string;
			impactIds: string[];
		};
		if (request.status !== "EXECUTED") {
			return {
				reversible: false,
				reason: "Solicitacao nao foi executada",
			};
		}
		const impacts = await prisma.constructionBudgetImpact.findMany({
			where: { id: { in: payload.impactIds }, ownerId: request.ownerId },
			select: { id: true, status: true, reversedAt: true },
		});
		if (impacts.length !== payload.impactIds.length) {
			return {
				reversible: false,
				reason: "Impacto orcamentario nao encontrado",
			};
		}
		if (impacts.some((impact) => impact.status !== "APPROVED")) {
			return {
				reversible: false,
				reason: "Apenas impactos aprovados podem ser revertidos",
			};
		}
		if (impacts.some((impact) => impact.reversedAt !== null)) {
			return {
				reversible: false,
				reason: "Impacto ja revertido",
			};
		}
		const dependent = await prisma.constructionBudgetImpact.findFirst({
			where: { parentImpactId: { in: payload.impactIds } },
			select: { id: true },
		});
		if (dependent) {
			return {
				reversible: false,
				reason: "Existem impactos dependentes que impedem a reversao",
			};
		}
		return { reversible: true };
	},
	compensate: async ({ tx, request, reason }) => {
		const payload = request.payloadJson as {
			workId: string;
			impactIds: string[];
		};
		assertSameWork({ workId: request.resourceId }, payload);
		for (const impactId of payload.impactIds) {
			await budgetControlService.reverse(
				request.ownerId,
				impactId,
				{ userId: request.actorId, reason },
				tx,
			);
		}
	},
};

const IMPORT_CONFIRM: ApprovalEffectHandler = {
	action: "IMPORT_CONFIRM",
	apply: async ({ tx, request }) => {
		const payload = request.payloadJson as {
			actorId: string;
			workId: string;
			batchId: string;
			selectedRowIds: string[];
			expectedBatchVersion: number;
			model: string;
			idempotencyKey: string;
		};
		if (
			request.resourceType !== "IMPORT_BATCH" ||
			request.resourceId !== payload.batchId ||
			request.actorId !== payload.actorId ||
			request.idempotencyKey !== payload.idempotencyKey ||
			request.expectedVersion !== payload.expectedBatchVersion ||
			request.payloadHash !== hashApprovalPayload(request.payloadJson)
		) {
			throw new ConstructionError(
				"IMPORT_APPROVAL_IDENTITY_MISMATCH",
				"Solicitacao de importacao invalida ou alterada",
				409,
			);
		}
		assertSelectedRowIds(payload.selectedRowIds);
		const batch = await tx.importBatch.findUnique({
			where: { id: payload.batchId },
		});
		if (!batch) {
			throw new Error("lote de importacao nao encontrado");
		}
		if (batch.ownerId !== request.ownerId || batch.workId !== payload.workId) {
			throw new ConstructionError(
				"FORBIDDEN",
				"Lote de importacao pertence a outro owner",
				403,
			);
		}
		if (batch.status !== "READY" || batch.expiresAt <= new Date()) {
			throw new ConstructionError(
				"IMPORT_BATCH_NOT_READY",
				"Lote nao esta pronto para confirmacao",
				422,
			);
		}
		if (
			batch.batchVersion !== request.expectedVersion ||
			batch.batchVersion !== payload.expectedBatchVersion ||
			batch.model !== payload.model
		) {
			throw new ConstructionError(
				"IMPORT_BATCH_CONFLICT",
				"Versao ou modelo do lote divergente",
				409,
			);
		}
		const selectedRowIds = payload.selectedRowIds;
		const uniqueSelectedRowIds = new Set(selectedRowIds);
		const selectedRows = await tx.importRow.findMany({
			where: {
				batchId: payload.batchId,
				id: { in: selectedRowIds },
				batch: { ownerId: request.ownerId, workId: payload.workId },
			},
			select: { id: true, sheet: true, rowNumber: true, status: true },
		});
		if (
			selectedRows.length !== uniqueSelectedRowIds.size ||
			selectedRowIds.length !== uniqueSelectedRowIds.size ||
			selectedRows.some(
				(row) => row.status !== "VALID" && row.status !== "WARNING",
			)
		) {
			throw new Error("linhas selecionadas invalidas para confirmacao");
		}
		const parsed = selectWorkbookRows(
			batch.parsedWorkbook as never,
			selectedRows,
		);
		const claimed = await tx.importBatch.updateMany({
			where: {
				id: payload.batchId,
				ownerId: request.ownerId,
				workId: payload.workId,
				status: "READY",
				batchVersion: payload.expectedBatchVersion,
			},
			data: { status: "CONFIRMED" },
		});
		if (claimed.count !== 1) {
			throw new ConstructionError(
				"IMPORT_BATCH_CONFLICT",
				"Lote de importacao ja foi confirmado",
				409,
			);
		}

		const { constructionImportService } = await import(
			"../construction-planning/imports/import-service"
		);
		const applied = await constructionImportService.applyStagedWorkbook(
			payload.actorId,
			payload.workId,
			parsed,
			{
				kind: payload.model as never,
				reprocessOfId: batch.reprocessOfId,
				errorSummary: batch.errorSummary,
				db: tx,
			},
		);

		await tx.importBatch.update({
			where: { id: payload.batchId },
			data: {
				confirmedAt: new Date(),
				confirmedImportId: applied.importId,
			},
		});
	},
};

const CONTRACT_CREATE: ApprovalEffectHandler = {
	action: "CONTRACT_CREATE",
	apply: async ({ tx, request }) => {
		const payload = request.payloadJson as {
			workId: string;
			contract: {
				code: string;
				supplierName: string;
				supplierId?: string | null;
				contractValue: number;
				serviceType?: string | null;
				title?: string | null;
				startDate?: string | null;
				endDate?: string | null;
				status?: string | null;
				notes?: string | null;
			};
			services?: Array<{
				budgetItemId: string;
				quantity?: number | null;
				unitCost?: number | null;
			}>;
			origin?: { type: "MANUAL" } | { type: "QUOTATION"; quotationId: string };
			createdBy?: string | null;
		};
		if (!payload.workId || !payload.contract) {
			throw new Error("payload de criacao de contrato incompleto");
		}

		const { createContractWithEffectsInTx } = await import(
			"../construction-planning/contracts/contract-creation.service"
		);
		const result = await createContractWithEffectsInTx(tx, {
			resourceOwnerId: request.ownerId,
			actorId: payload.createdBy ?? request.actorId,
			workId: payload.workId,
			origin: payload.origin ?? { type: "MANUAL" },
			supplier: {
				name: payload.contract.supplierName,
				supplierId: payload.contract.supplierId ?? null,
			},
			contract: {
				code: payload.contract.code,
				serviceType: payload.contract.serviceType ?? null,
				title: payload.contract.title ?? null,
				contractValue: payload.contract.contractValue,
				startDate: payload.contract.startDate ?? null,
				endDate: payload.contract.endDate ?? null,
				notes: payload.contract.notes ?? null,
				status: payload.contract.status ?? null,
			},
			services: (payload.services ?? []).map((service) => ({
				budgetItemId: service.budgetItemId,
				quantity: service.quantity ?? 0,
				unitCost: service.unitCost ?? 0,
			})),
			idempotencyKey: request.idempotencyKey,
		});

		return result.contract;
	},
};

const CONTRACT_REQUEST_FINALIZE: ApprovalEffectHandler = {
	action: "CONTRACT_REQUEST_FINALIZE",
	apply: async ({ tx, request }) => {
		const payload = request.payloadJson as {
			workId: string;
			requestId: string;
			proposalId: string;
		};
		const contractRequest = await tx.contractRequest.findFirst({
			where: {
				id: payload.requestId,
				ownerId: request.ownerId,
				workId: payload.workId,
			},
			include: { items: { orderBy: { sortOrder: "asc" } } },
		});
		if (
			!contractRequest ||
			contractRequest.status !== "AGUARDANDO_APROVACAO_FINAL" ||
			contractRequest.acceptedProposalId !== payload.proposalId
		) {
			throw new ConstructionError(
				"CONTRACT_REQUEST_CONFLICT",
				"Solicitação mudou antes da aprovação final",
				409,
			);
		}
		const proposal = await tx.contractRequestProposal.findFirst({
			where: {
				id: payload.proposalId,
				batchId: contractRequest.confirmedBatchId ?? "",
				ownerId: request.ownerId,
				workId: payload.workId,
			},
		});
		if (!proposal) {
			throw new ConstructionError(
				"PROPOSAL_NOT_ELIGIBLE",
				"Proposta não pertence ao mapa confirmado",
				422,
			);
		}
		const supplier = await tx.constructionSupplier.findFirst({
			where: { ownerId: request.ownerId, document: proposal.normalizedCnpj },
			select: { id: true },
		});
		const { getBudgetItemReferences } = await import(
			"../construction-planning/budget-control/budget-control.repository"
		);
		const references = await getBudgetItemReferences(
			request.ownerId,
			payload.workId,
			contractRequest.items.map((item) => item.budgetItemId),
			tx,
		);
		const versionItems = await tx.budgetVersionItem.findMany({
			where: { id: { in: references.found.map((item) => item.versionItemId) } },
			select: { id: true, unitCost: true },
		});
		const unitCostByVersion = new Map(
			versionItems.map((item) => [item.id, Number(item.unitCost ?? 0)]),
		);
		const referenceByItem = new Map(
			references.found.map((item) => [item.budgetItemId, item]),
		);
		const services = contractRequest.items.map((item) => {
			const reference = referenceByItem.get(item.budgetItemId);
			if (!reference) {
				throw new ConstructionError(
					"BUDGET_VERSION_ITEM_INELIGIBLE",
					"Item sem cobertura orçamentária vigente",
					422,
				);
			}
			return {
				budgetItemId: item.budgetItemId,
				quantity: Number(item.quantity),
				unitCost: unitCostByVersion.get(reference.versionItemId) ?? 0,
			};
		});
		const { createContractWithEffectsInTx } = await import(
			"../construction-planning/contracts/contract-creation.service"
		);
		const result = await createContractWithEffectsInTx(tx, {
			resourceOwnerId: request.ownerId,
			actorId: request.actorId,
			workId: payload.workId,
			origin: { type: "CONTRACT_REQUEST", requestId: contractRequest.id },
			supplier: {
				name: proposal.supplierName,
				supplierId: supplier?.id ?? null,
			},
			contract: {
				code: `CR-${contractRequest.id.slice(0, 8)}`,
				serviceType: contractRequest.serviceType,
				title: contractRequest.title,
				contractValue: Number(proposal.proposalValue),
				startDate: contractRequest.startDate,
				endDate: contractRequest.endDate,
				notes: contractRequest.description,
				status: "RASCUNHO",
			},
			services,
			idempotencyKey: request.idempotencyKey,
		});
		await tx.contractRequest.update({
			where: { id: contractRequest.id },
			data: {
				status: "CONTRATADA",
				contractId: result.contract.id,
				acceptedAt: new Date(),
				acceptedBy: request.actorId,
			},
		});
		return result.contract;
	},
	reject: async ({ tx, request }) => {
		const payload = request.payloadJson as {
			requestId: string;
			workId: string;
		};
		await tx.contractRequest.updateMany({
			where: {
				id: payload.requestId,
				ownerId: request.ownerId,
				workId: payload.workId,
				status: "AGUARDANDO_APROVACAO_FINAL",
			},
			data: { status: "EM_NEGOCIACAO" },
		});
	},
};

const WORK_DELETE: ApprovalEffectHandler = {
	action: "WORK_DELETE",
	apply: async ({ tx, request }) => {
		const payload = request.payloadJson as {
			workId: string;
			reason?: string | null;
		};
		if (!payload.workId) throw new Error("payload de exclusao incompleto");
		const work = await tx.constructionWork.findFirst({
			where: { id: payload.workId, ownerId: request.ownerId },
		});
		if (!work) throw new Error("obra nao encontrada");
		await deleteWorkCascade(tx, request.ownerId, work.id);
		return { id: work.id, deleted: true };
	},
};

export const approvalEffectHandlers: ApprovalEffectHandler[] = [
	BUDGET_VERSION_ACTIVATE,
	SCHEDULE_VERSION_ACTIVATE,
	WORK_MEASUREMENT_APPROVE,
	CONTRACT_MEASUREMENT_APPROVE,
	PAYMENT_CONFIRM,
	COST_APPROVE,
	IMPORT_CONFIRM,
	BUDGET_IMPACT_APPROVE,
	CONTRACT_CREATE,
	CONTRACT_REQUEST_FINALIZE,
	WORK_DELETE,
];

export type { ApprovalDecision, ApprovalRequest };
export type TxClient = Prisma.TransactionClient;
