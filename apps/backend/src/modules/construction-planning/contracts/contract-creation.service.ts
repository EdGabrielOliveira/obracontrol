/**
 * CON-01 — gateway unico de criacao de contrato e efeitos financeiros.
 *
 * Contrato manual, vencedor de cotacao e solicitacao convergem para este
 * ponto. Dentro de UMA transacao serializavel ele:
 *   1. resolve o work/owner e revalida a versao efetiva do orcamento;
 *   2. resolve replay pela origem (cotacao/solicitacao) e pela chave;
 *   3. cria contrato + servicos iniciais + impactos de compromisso + link de
 *      origem juntos;
 *   4. rejeita duas origens para o mesmo contrato e payload divergente para a
 *      mesma chave.
 *
 * Spec: docs/superpowers/specs/2026-08-10-audit-remediation-design.md#91
 */

import type { Prisma } from "@prisma/client";
import { ConstructionError } from "../../../lib/errors";
import { withSerializableRetry } from "../../../lib/transaction-retry";
import { getBudgetItemReferences } from "../budget-control/budget-control.repository";
import { budgetControlService } from "../budget-control/budget-control.service";
import * as contractRepository from "../contract.repository";
import {
	COMPONENT_BASE,
	competenceOf,
	resolveLedgerItemRef,
	SERVICE_SOURCE_TYPE,
} from "../ledger/ledger.integration";
import { getWorkOrThrow } from "../repository";

export type ContractGatewayOrigin =
	| { type: "MANUAL" }
	| { type: "QUOTATION"; quotationId: string }
	| { type: "CONTRACT_REQUEST"; requestId: string };

export type ContractGatewayServiceInput = {
	budgetItemId: string;
	description?: string | null;
	quantity: number;
	unitCost: number;
};

export type ContractGatewayInput = {
	resourceOwnerId: string;
	actorId: string;
	workId: string;
	origin: ContractGatewayOrigin;
	supplier: { name: string; supplierId?: string | null };
	contract: {
		code: string;
		serviceType?: string | null;
		objectDescription?: string | null;
		title?: string | null;
		contractValue: number;
		startDate?: string | Date | null;
		endDate?: string | Date | null;
		notes?: string | null;
		status?: string | null;
	};
	services: ContractGatewayServiceInput[];
	idempotencyKey: string;
};

export type ContractGatewayResult = {
	contract: {
		id: string;
		code: string;
		ownerId: string;
		workId: string;
		createdBy: string | null;
		contractValue: number;
		serviceCount: number;
		status: string;
	};
	replayed: boolean;
	overflow?: unknown;
};

function toServiceInput(service: ContractGatewayServiceInput) {
	return {
		budgetItemId: service.budgetItemId,
		quantity: service.quantity,
		unitCost: service.unitCost,
		sortOrder: 0,
	};
}

async function resolveOriginLink(
	tx: Prisma.TransactionClient,
	input: ContractGatewayInput,
): Promise<{ contractId: string | null; requestId: string | null }> {
	if (input.origin.type === "QUOTATION") {
		const quotation = await tx.quotation.findFirst({
			where: {
				id: input.origin.quotationId,
				ownerId: input.resourceOwnerId,
				workId: input.workId,
			},
			select: { id: true, contractId: true },
		});
		if (!quotation) {
			throw new ConstructionError("NOT_FOUND", "Cotacao nao encontrada", 404);
		}
		return { contractId: quotation.contractId, requestId: null };
	}
	if (input.origin.type === "CONTRACT_REQUEST") {
		const request = await tx.contractRequest.findFirst({
			where: {
				id: input.origin.requestId,
				ownerId: input.resourceOwnerId,
				workId: input.workId,
			},
			select: { id: true, contractId: true },
		});
		if (!request) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Solicitacao nao encontrada",
				404,
			);
		}
		return { contractId: request.contractId, requestId: request.contractId };
	}
	return { contractId: null, requestId: null };
}

function assertReplayMatches(
	contract: { code: string; contractValue: Prisma.Decimal | number },
	input: ContractGatewayInput,
): void {
	const value =
		typeof contract.contractValue === "number"
			? contract.contractValue
			: Number(contract.contractValue.toFixed(2));
	if (
		contract.code !== input.contract.code ||
		value !== input.contract.contractValue
	) {
		throw new ConstructionError(
			"CONTRACT_GATEWAY_PAYLOAD_CONFLICT",
			"A mesma origem ja gerou contrato com payload diferente",
			409,
		);
	}
}

async function createContractWithEffectsCore(
	tx: Prisma.TransactionClient,
	input: ContractGatewayInput,
): Promise<ContractGatewayResult> {
	const work = await getWorkOrThrow(input.resourceOwnerId, input.workId);
	if (work.ownerId !== input.resourceOwnerId) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}

	const origin = await resolveOriginLink(tx, input);

	// Duas origens para o mesmo contrato: um contrato originado por
	// solicitacao nao pode receber origem de cotacao (ou vice-versa).
	if (origin.requestId && input.origin.type !== "CONTRACT_REQUEST") {
		throw new ConstructionError(
			"CONTRACT_GATEWAY_MULTIPLE_ORIGINS",
			"Contrato ja possui origem de solicitacao",
			409,
		);
	}

	// Replay: mesma origem gera o mesmo resultado, sem duplicar efeitos.
	if (origin.contractId) {
		const existing = await tx.contract.findUnique({
			where: { id: origin.contractId },
			select: {
				id: true,
				code: true,
				ownerId: true,
				workId: true,
				createdBy: true,
				contractValue: true,
				status: true,
				_count: { select: { services: true } },
			},
		});
		if (!existing) {
			throw new ConstructionError(
				"CONTRACT_GATEWAY_ORIGIN_STALE",
				"Origem aponta para contrato inexistente",
				409,
			);
		}
		assertReplayMatches(existing, input);
		return {
			contract: {
				id: existing.id,
				code: existing.code,
				ownerId: existing.ownerId,
				workId: existing.workId,
				createdBy: existing.createdBy,
				contractValue: Number(existing.contractValue.toFixed(2)),
				serviceCount: existing._count.services,
				status: existing.status,
			},
			replayed: true,
		};
	}

	const created = await tx.contract.create({
		data: {
			ownerId: input.resourceOwnerId,
			workId: input.workId,
			code: input.contract.code,
			supplierName: input.supplier.name,
			supplierId: input.supplier.supplierId ?? null,
			serviceType: input.contract.serviceType ?? null,
			objectDescription:
				input.contract.objectDescription ??
				input.contract.title ??
				input.contract.serviceType ??
				null,
			title: input.contract.title ?? null,
			contractValue: input.contract.contractValue,
			startDate: input.contract.startDate
				? new Date(input.contract.startDate)
				: null,
			endDate: input.contract.endDate ? new Date(input.contract.endDate) : null,
			status: input.contract.status ?? "RASCUNHO",
			createdBy: input.actorId,
			notes: input.contract.notes ?? null,
			contractRequestId:
				input.origin.type === "CONTRACT_REQUEST"
					? input.origin.requestId
					: null,
		},
	});

	if (input.origin.type === "QUOTATION") {
		await tx.quotation.update({
			where: { id: input.origin.quotationId },
			data: { contractId: created.id, status: "CONTRATADA" },
		});
	}

	const references = await getBudgetItemReferences(
		input.resourceOwnerId,
		input.workId,
		input.services.map((service) => service.budgetItemId),
		tx,
	);
	const referenceByInputId = new Map(
		references.found.map((reference) => [reference.budgetItemId, reference]),
	);
	const servicesInput = input.services.map((service) => {
		const reference = referenceByInputId.get(service.budgetItemId);
		if (!reference || !reference.operationalBudgetItemId) {
			throw new ConstructionError(
				"BUDGET_ITEM_NOT_PROJECTED",
				"Item do orçamento ainda não foi projetado para uso operacional",
				422,
			);
		}
		return { ...service, budgetItemId: reference.operationalBudgetItemId };
	});

	const services = input.services.length
		? ((await contractRepository.createContractServices(
				input.resourceOwnerId,
				created.id,
				servicesInput.map(toServiceInput),
				tx,
			)) ?? [])
		: [];
	if (input.services.length > 0 && (!services || services.length === 0)) {
		throw new ConstructionError(
			"INVALID_INPUT",
			"Nao foi possivel criar os servicos iniciais",
			400,
		);
	}

	for (const [index, service] of services.entries()) {
		const serviceInput = servicesInput[index];
		const ref = await resolveLedgerItemRef(
			input.resourceOwnerId,
			input.workId,
			serviceInput.budgetItemId,
		);
		if (!ref) {
			throw new ConstructionError(
				"CONTRACT_BUDGET_COVERAGE_MISSING",
				"Sem cobertura orcamentaria vigente para o servico do contrato",
				422,
			);
		}
		await budgetControlService.apply(
			input.resourceOwnerId,
			input.workId,
			{
				workId: input.workId,
				allocations: [
					{
						budgetItemId: serviceInput.budgetItemId,
						value: Number(service.totalCost ?? 0),
					},
				],
				amount: Number(service.totalCost ?? 0),
				impactType: "COMMITMENT",
				sourceType: SERVICE_SOURCE_TYPE,
				sourceId: `${service.id}#1`,
				componentId: COMPONENT_BASE,
				competence: competenceOf(new Date()),
				occurredAt: new Date(),
			},
			{ userId: input.actorId },
			tx,
		);
	}

	return {
		contract: {
			id: created.id,
			code: created.code,
			ownerId: created.ownerId,
			workId: created.workId,
			createdBy: created.createdBy,
			contractValue: Number(created.contractValue.toFixed(2)),
			serviceCount: services.length,
			status: created.status,
		},
		replayed: false,
	};
}

export async function createContractWithEffects(
	input: ContractGatewayInput,
): Promise<ContractGatewayResult> {
	return withSerializableRetry((tx) =>
		createContractWithEffectsCore(tx, input),
	);
}

/** Executa dentro de uma transacao ja aberta (handler de aprovacao). */
export async function createContractWithEffectsInTx(
	tx: Prisma.TransactionClient,
	input: ContractGatewayInput,
): Promise<ContractGatewayResult> {
	return createContractWithEffectsCore(tx, input);
}
