import type { Prisma } from "@prisma/client";
import { buildPaginatedResponse } from "../../../lib/pagination";
import { pickDefined } from "../../../lib/pick-defined";
import { prisma } from "../../../lib/prisma";
import { getWorkspaceIdForUser } from "../../../lib/workspace";
import {
	normalizeSupplierDocument,
	normalizeSupplierName,
} from "./supplier-document";

function supplierScope(ownerId: string, workspaceId?: string | null) {
	return workspaceId ? { workspaceId } : { ownerId };
}

export async function listSuppliers(
	ownerId: string,
	filters?: {
		q?: string;
		page?: number;
		pageSize?: number;
		workspaceId?: string | null;
	},
) {
	const where: Prisma.ConstructionSupplierWhereInput = supplierScope(
		ownerId,
		filters?.workspaceId,
	);
	if (filters?.q) {
		where.OR = [
			{ name: { contains: filters.q } },
			{ document: { contains: filters.q } },
		];
	}

	const page = filters?.page ?? 1;
	const pageSize = filters?.pageSize ?? 10;

	const [data, total] = await Promise.all([
		prisma.constructionSupplier.findMany({
			where,
			orderBy: { name: "asc" },
			skip: (page - 1) * pageSize,
			take: pageSize,
		}),
		prisma.constructionSupplier.count({ where }),
	]);

	return buildPaginatedResponse(data, total, page, pageSize);
}

export async function getSupplierById(
	ownerId: string,
	id: string,
	workspaceId?: string | null,
) {
	return prisma.constructionSupplier.findFirst({
		where: { id, ...supplierScope(ownerId, workspaceId) },
	});
}

export async function getSupplierDetail(
	ownerId: string,
	id: string,
	workspaceId?: string | null,
) {
	const supplier = await getSupplierById(ownerId, id, workspaceId);
	if (!supplier) return null;
	const [contracts, actualCosts, workLinks] = await Promise.all([
		prisma.contract.findMany({
			where: { ...supplierScope(ownerId, workspaceId), supplierId: id },
			select: {
				id: true,
				code: true,
				title: true,
				contractValue: true,
				status: true,
				work: { select: { id: true, name: true } },
			},
			orderBy: { createdAt: "desc" },
		}),
		prisma.constructionActualCost.findMany({
			where: { ...supplierScope(ownerId, workspaceId), supplierId: id },
			select: {
				id: true,
				costDate: true,
				description: true,
				amount: true,
				category: true,
				paymentStatus: true,
				work: { select: { id: true, name: true } },
			},
			orderBy: { costDate: "desc" },
		}),
		prisma.constructionWorkSupplier.findMany({
			where: { ...supplierScope(ownerId, workspaceId), supplierId: id },
			select: {
				id: true,
				status: true,
				work: { select: { id: true, name: true } },
			},
			orderBy: { createdAt: "desc" },
		}),
	]);
	return { supplier, contracts, actualCosts, workLinks };
}

export async function findSupplierByDocument(
	ownerId: string,
	document: string,
	workspaceId?: string | null,
) {
	const normalized = normalizeSupplierDocument(document);
	if (!normalized) return null;
	const exact = await prisma.constructionSupplier.findFirst({
		where: { ...supplierScope(ownerId, workspaceId), document: normalized },
	});
	if (exact) return exact;
	const candidates = await prisma.constructionSupplier.findMany({
		where: supplierScope(ownerId, workspaceId),
	});
	return (
		candidates.find(
			(supplier) => normalizeSupplierDocument(supplier.document) === normalized,
		) ?? null
	);
}

export async function findSupplierByDocumentOrName(
	ownerId: string,
	document: string | null | undefined,
	name: string | null | undefined,
	workspaceId?: string | null,
) {
	const byDocument = document
		? await findSupplierByDocument(ownerId, document, workspaceId)
		: null;
	if (byDocument) return byDocument;
	const normalizedName = normalizeSupplierName(name);
	if (!normalizedName) return null;
	const candidates = await prisma.constructionSupplier.findMany({
		where: supplierScope(ownerId, workspaceId),
	});
	const matches = candidates.filter(
		(supplier) => normalizeSupplierName(supplier.name) === normalizedName,
	);
	return matches.length === 1 ? matches[0] : null;
}

export async function getWorkById(ownerId: string, workId: string) {
	return prisma.constructionWork.findFirst({
		where: { id: workId, ownerId },
		select: { id: true, ownerId: true },
	});
}

export async function findWorkSupplier(
	ownerId: string,
	workId: string,
	supplierId: string,
) {
	return prisma.constructionWorkSupplier.findFirst({
		where: { ownerId, workId, supplierId },
	});
}

export async function createWorkSupplier(
	ownerId: string,
	workId: string,
	supplierId: string,
) {
	return prisma.constructionWorkSupplier.create({
		data: { ownerId, workId, supplierId },
	});
}

export async function listWorkSuppliers(ownerId: string, workId: string) {
	return prisma.constructionWorkSupplier.findMany({
		where: { ownerId, workId },
		include: { supplier: true },
		orderBy: { supplier: { name: "asc" } },
	});
}

export async function deleteWorkSupplier(
	ownerId: string,
	workId: string,
	supplierId: string,
) {
	const link = await findWorkSupplier(ownerId, workId, supplierId);
	if (!link) return null;
	return prisma.constructionWorkSupplier.delete({ where: { id: link.id } });
}

export async function createSupplier(
	ownerId: string,
	input: {
		name: string;
		document: string | null;
		responsibleName?: string | null;
		responsibleDocument?: string | null;
		contact?: string | null;
		pixKey?: string | null;
		pixKeyType?: string | null;
		bankCode?: string | null;
		bankName?: string | null;
		bankBranch?: string | null;
		bankAccount?: string | null;
		bankAccountType?: string | null;
		addressZipCode?: string | null;
		addressStreet?: string | null;
		addressNumber?: string | null;
		addressComplement?: string | null;
		addressDistrict?: string | null;
		addressCity?: string | null;
		addressState?: string | null;
		notes?: string | null;
	},
) {
	return prisma.constructionSupplier.create({
		data: {
			ownerId,
			workspaceId: await getWorkspaceIdForUser(ownerId),
			name: input.name,
			document: input.document,
			responsibleName: input.responsibleName ?? null,
			responsibleDocument: input.responsibleDocument ?? null,
			contact: input.contact ?? null,
			pixKey: input.pixKey ?? null,
			pixKeyType: input.pixKeyType ?? null,
			bankCode: input.bankCode ?? null,
			bankName: input.bankName ?? null,
			bankBranch: input.bankBranch ?? null,
			bankAccount: input.bankAccount ?? null,
			bankAccountType: input.bankAccountType ?? null,
			addressZipCode: input.addressZipCode ?? null,
			addressStreet: input.addressStreet ?? null,
			addressNumber: input.addressNumber ?? null,
			addressComplement: input.addressComplement ?? null,
			addressDistrict: input.addressDistrict ?? null,
			addressCity: input.addressCity ?? null,
			addressState: input.addressState ?? null,
			notes: input.notes ?? null,
		},
	});
}

export async function updateSupplier(
	ownerId: string,
	id: string,
	input: {
		name?: string;
		document?: string | null;
		responsibleName?: string | null;
		responsibleDocument?: string | null;
		contact?: string | null;
		pixKey?: string | null;
		pixKeyType?: string | null;
		bankCode?: string | null;
		bankName?: string | null;
		bankBranch?: string | null;
		bankAccount?: string | null;
		bankAccountType?: string | null;
		addressZipCode?: string | null;
		addressStreet?: string | null;
		addressNumber?: string | null;
		addressComplement?: string | null;
		addressDistrict?: string | null;
		addressCity?: string | null;
		addressState?: string | null;
		notes?: string | null;
	},
	workspaceId?: string | null,
) {
	const existing = await prisma.constructionSupplier.findFirst({
		where: { id, ...supplierScope(ownerId, workspaceId) },
	});
	if (!existing) return null;

	const updateData = pickDefined(input, [
		"name",
		"document",
		"responsibleName",
		"responsibleDocument",
		"contact",
		"pixKey",
		"pixKeyType",
		"bankCode",
		"bankName",
		"bankBranch",
		"bankAccount",
		"bankAccountType",
		"addressZipCode",
		"addressStreet",
		"addressNumber",
		"addressComplement",
		"addressDistrict",
		"addressCity",
		"addressState",
		"notes",
	] as (keyof typeof input)[]);

	return prisma.constructionSupplier.update({
		where: { id },
		data: updateData as Prisma.ConstructionSupplierUpdateInput,
	});
}

export async function deleteSupplier(
	ownerId: string,
	id: string,
	workspaceId?: string | null,
) {
	const item = await prisma.constructionSupplier.findFirst({
		where: { id, ...supplierScope(ownerId, workspaceId) },
	});
	if (!item) return null;
	await prisma.constructionSupplier.delete({ where: { id } });
	return item;
}

export async function countSupplierDependencies(ownerId: string, id: string) {
	const [contracts, actualCosts, workLinks] = await Promise.all([
		prisma.contract.count({ where: { ownerId, supplierId: id } }),
		prisma.constructionActualCost.count({
			where: { ownerId, supplierId: id },
		}),
		prisma.constructionWorkSupplier.count({
			where: { ownerId, supplierId: id },
		}),
	]);
	return contracts + actualCosts + workLinks;
}
