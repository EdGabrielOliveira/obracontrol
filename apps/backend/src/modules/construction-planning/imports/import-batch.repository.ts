import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import type { ImportRowStatus } from "./import-batch.types";

export type NewImportBatch = {
	ownerId: string;
	workId: string | null;
	model: string;
	title?: string | null;
	version: string;
	fileName: string;
	fileSha256: string;
	storageKey: string;
	expiresAt: Date;
	contractRequestId?: string | null;
	reprocessOfId?: string | null;
	reason?: string | null;
};

export type NewImportRow = {
	sheet: string;
	rowNumber: number;
	values: Prisma.InputJsonValue;
	status: ImportRowStatus;
	issues: Prisma.InputJsonValue | null;
	seq: number;
};

export async function createImportBatch(
	input: NewImportBatch,
): Promise<{ id: string }> {
	return prisma.importBatch.create({
		data: {
			ownerId: input.ownerId,
			workId: input.workId,
			model: input.model,
			title: input.title ?? null,
			version: input.version,
			fileName: input.fileName,
			fileSha256: input.fileSha256,
			storageKey: input.storageKey,
			status: "PARSING",
			contractRequestId: input.contractRequestId ?? null,
			reprocessOfId: input.reprocessOfId ?? null,
			errorSummary: input.reason ? { reason: input.reason } : Prisma.DbNull,
			expiresAt: input.expiresAt,
		},
		select: { id: true },
	});
}

export async function findImportBatch(
	ownerId: string,
	workId: string,
	batchId: string,
) {
	return prisma.importBatch.findFirst({
		where: { id: batchId, ownerId, workId },
	});
}

export async function updateImportBatch(
	batchId: string,
	data: Prisma.ImportBatchUpdateInput,
) {
	return prisma.importBatch.update({
		where: { id: batchId },
		data,
	});
}

export async function createImportRows(
	batchId: string,
	rows: NewImportRow[],
): Promise<void> {
	if (rows.length === 0) return;
	await prisma.importRow.createMany({
		data: rows.map((row) => ({
			batchId,
			sheet: row.sheet,
			rowNumber: row.rowNumber,
			values: row.values,
			status: row.status,
			issues: row.issues ?? Prisma.DbNull,
			seq: row.seq,
		})),
	});
}

export async function countImportRows(
	batchId: string,
	status?: string,
): Promise<number> {
	return prisma.importRow.count({
		where: { batchId, ...(status ? { status } : {}) },
	});
}

export async function listImportRowsPage(
	batchId: string,
	page: number,
	pageSize: number,
) {
	return prisma.importRow.findMany({
		where: { batchId },
		orderBy: [{ sheet: "asc" }, { rowNumber: "asc" }],
		skip: (page - 1) * pageSize,
		take: pageSize,
	});
}

export async function listImportRowsByIds(batchId: string, rowIds: string[]) {
	return prisma.importRow.findMany({
		where: { id: { in: rowIds }, batchId },
		orderBy: [{ sheet: "asc" }, { rowNumber: "asc" }],
	});
}

export async function listSelectableImportRowIds(
	ownerId: string,
	workId: string,
	batchId: string,
): Promise<string[] | null> {
	const batch = await prisma.importBatch.findFirst({
		where: {
			id: batchId,
			ownerId,
			workId,
			status: "READY",
			expiresAt: { gt: new Date() },
		},
		select: {
			rows: {
				where: { status: { in: ["VALID", "WARNING"] } },
				orderBy: { seq: "asc" },
				select: { id: true },
			},
		},
	});
	return batch?.rows.map((row) => row.id) ?? null;
}

export async function listImportBatches(
	ownerId: string,
	filters: { workId?: string | null; page?: number; pageSize?: number } = {},
) {
	const page = filters.page ?? 1;
	const pageSize = filters.pageSize ?? 20;
	const where: Prisma.ImportBatchWhereInput = { ownerId };
	if (filters.workId) where.workId = filters.workId;
	const [data, total] = await Promise.all([
		prisma.importBatch.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip: (page - 1) * pageSize,
			take: pageSize,
		}),
		prisma.importBatch.count({ where }),
	]);
	return { data, total, page, pageSize };
}
