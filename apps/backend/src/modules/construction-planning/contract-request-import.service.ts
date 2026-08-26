import Decimal from "decimal.js";
import { ConstructionError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { resolveResourceScope } from "../../lib/resource-scope";
import { parseNumber } from "../../lib/text-utils";
import { constructionImportBatchService } from "./imports/import-batch.service";

function digits(value: string): string {
	return value.replace(/\D/g, "");
}

const CNPJ_WEIGHT_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHT_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function cnpjCheckDigit(base: string, weights: number[]): number {
	let sum = 0;
	for (let index = 0; index < weights.length; index += 1) {
		sum += Number(base[index]) * weights[index];
	}
	const rest = sum % 11;
	return rest < 2 ? 0 : 11 - rest;
}

export function isValidCnpj(value: string): boolean {
	const cnpj = digits(value);
	if (cnpj.length !== 14 || new Set(cnpj).size === 1) return false;
	return (
		cnpjCheckDigit(cnpj.slice(0, 12), CNPJ_WEIGHT_1) === Number(cnpj[12]) &&
		cnpjCheckDigit(cnpj.slice(0, 13), CNPJ_WEIGHT_2) === Number(cnpj[13])
	);
}

type QuotationMapFile = {
	name: string;
	stream: () => ReadableStream<Uint8Array>;
};

type QuotationMapRowValues = {
	supplierDocument?: unknown;
	supplierName?: unknown;
	value?: unknown;
	notes?: unknown;
	quotationCode?: unknown;
	suggestedWinner?: unknown;
};

function textValue(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export async function createQuotationMapPreview(
	actorId: string,
	workId: string,
	requestId: string,
	file: QuotationMapFile,
) {
	const scope = await resolveResourceScope(actorId, { workId });
	if (!scope.canWrite) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}
	const resourceOwnerId = scope.resourceOwnerId || actorId;
	const request = await prisma.contractRequest.findFirst({
		where: { id: requestId, ownerId: resourceOwnerId, workId },
		select: { id: true, status: true },
	});
	if (!request) {
		throw new ConstructionError(
			"NOT_FOUND",
			"Solicitação de contratação não encontrada",
			404,
		);
	}
	if (request.status !== "EM_ESPERA") {
		throw new ConstructionError(
			"CONTRACT_REQUEST_CLOSED",
			"Solicitação já aceita; o mapa não pode ser substituído",
			409,
		);
	}

	const page = await constructionImportBatchService.createBatch(
		resourceOwnerId,
		workId,
		{
			fileName: file.name,
			model: "quotation-map",
			file: file.stream(),
			contractRequestId: requestId,
		},
		actorId,
	);
	return page;
}

export async function getQuotationMapPreview(
	actorId: string,
	workId: string,
	requestId: string,
	batchId: string,
	page = 1,
	pageSize = 50,
) {
	const scope = await resolveResourceScope(actorId, { workId });
	if (!scope.canRead) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}
	const resourceOwnerId = scope.resourceOwnerId || actorId;
	const batch = await prisma.importBatch.findFirst({
		where: {
			id: batchId,
			ownerId: resourceOwnerId,
			workId,
			contractRequestId: requestId,
			model: "quotation-map",
		},
		select: { id: true },
	});
	if (!batch) {
		throw new ConstructionError(
			"NOT_FOUND",
			"Lote do mapa de cotação não encontrado",
			404,
		);
	}
	return constructionImportBatchService.getPreviewPage(
		resourceOwnerId,
		workId,
		batchId,
		page,
		pageSize,
	);
}

export async function confirmQuotationMapBatch(
	actorId: string,
	workId: string,
	requestId: string,
	batchId: string,
	idempotencyKey?: string,
	selectedRowIds?: string[],
) {
	const scope = await resolveResourceScope(actorId, { workId });
	if (!scope.canWrite) {
		throw new ConstructionError("FORBIDDEN", "Acesso negado", 403);
	}
	const resourceOwnerId = scope.resourceOwnerId || actorId;
	const request = await prisma.contractRequest.findFirst({
		where: { id: requestId, ownerId: resourceOwnerId, workId },
		select: { id: true, status: true, confirmedBatchId: true },
	});
	if (!request) {
		throw new ConstructionError(
			"NOT_FOUND",
			"Solicitação de contratação não encontrada",
			404,
		);
	}
	if (request.status !== "EM_ESPERA") {
		throw new ConstructionError(
			"CONTRACT_REQUEST_CLOSED",
			"Solicitação já aceita",
			409,
		);
	}

	const batch = await prisma.importBatch.findFirst({
		where: {
			id: batchId,
			ownerId: resourceOwnerId,
			workId,
			contractRequestId: requestId,
			model: "quotation-map",
		},
		select: { id: true, status: true, expiresAt: true },
	});
	if (!batch) {
		throw new ConstructionError(
			"NOT_FOUND",
			"Lote do mapa de cotação não encontrado",
			404,
		);
	}
	if (batch.status === "CONFIRMED") {
		return { batchId, confirmed: true, proposalCount: 0 };
	}
	if (batch.status !== "READY" || batch.expiresAt <= new Date()) {
		throw new ConstructionError(
			"IMPORT_BATCH_NOT_READY",
			"Lote do mapa de cotação não está pronto para confirmação",
			422,
		);
	}

	const rows = await prisma.importRow.findMany({
		where: {
			batchId,
			status: { in: ["VALID", "WARNING"] },
			...(selectedRowIds !== undefined ? { id: { in: selectedRowIds } } : {}),
		},
		orderBy: { rowNumber: "asc" },
		select: { rowNumber: true, values: true },
	});
	if (rows.length === 0) {
		throw new ConstructionError(
			"NO_VALID_PROPOSALS",
			"Nenhuma proposta válida encontrada no mapa de cotação",
			422,
		);
	}

	const proposals: Array<{
		ownerId: string;
		workId: string;
		batchId: string;
		normalizedCnpj: string;
		supplierName: string;
		originalProposalValue: Decimal;
		proposalValue: Decimal;
		notes: string | null;
		suggestedWinner: boolean;
		rowNumber: number;
	}> = [];
	const cnpjSeen = new Set<string>();
	for (const row of rows) {
		const values = row.values as QuotationMapRowValues;
		const normalizedCnpj = digits(textValue(values.supplierDocument) ?? "");
		if (!isValidCnpj(normalizedCnpj)) {
			throw new ConstructionError(
				"INVALID_CNPJ",
				`CNPJ inválido na linha ${row.rowNumber}`,
				422,
			);
		}
		if (cnpjSeen.has(normalizedCnpj)) {
			throw new ConstructionError(
				"DUPLICATE_PROPOSAL",
				`CNPJ duplicado na linha ${row.rowNumber}`,
				409,
			);
		}
		cnpjSeen.add(normalizedCnpj);
		const supplierName = textValue(values.supplierName);
		if (!supplierName) {
			throw new ConstructionError(
				"INVALID_SUPPLIER_NAME",
				`Razão social obrigatória na linha ${row.rowNumber}`,
				422,
			);
		}
		const value = parseNumber(values.value);
		if (value == null || value <= 0) {
			throw new ConstructionError(
				"INVALID_PROPOSAL_VALUE",
				`Valor da proposta inválido na linha ${row.rowNumber}`,
				422,
			);
		}
		const winnerFlag = textValue(values.suggestedWinner);
		proposals.push({
			ownerId: resourceOwnerId,
			workId,
			batchId,
			normalizedCnpj,
			supplierName,
			originalProposalValue: new Decimal(value),
			proposalValue: new Decimal(value),
			notes: textValue(values.notes),
			suggestedWinner: ["SIM", "S", "YES", "1"].includes(
				(winnerFlag ?? "").toUpperCase(),
			),
			rowNumber: row.rowNumber,
		});
	}

	await prisma.$transaction(async (tx) => {
		await tx.contractRequestProposal.createMany({ data: proposals });
		await tx.importBatch.update({
			where: { id: batchId },
			data: {
				status: "CONFIRMED",
				confirmedAt: new Date(),
				...(idempotencyKey ? { errorSummary: { idempotencyKey } } : {}),
			},
		});
		await tx.contractRequest.update({
			where: { id: requestId },
			data: { confirmedBatchId: batchId },
		});
	});

	return { batchId, confirmed: true, proposalCount: proposals.length };
}
