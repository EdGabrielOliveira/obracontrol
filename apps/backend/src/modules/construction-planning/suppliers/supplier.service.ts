import { writeAudit } from "../../../lib/audit-writer";
import { ConstructionError } from "../../../lib/errors";
import { prisma } from "../../../lib/prisma";
import * as supplierRepository from "./supplier.repository";

function normalizeDocument(raw?: string | null): string | null {
	if (raw === null || raw === undefined) return null;
	const digits = raw.replace(/\D/g, "");
	if (digits.length === 0) return null;
	if (digits.length !== 11 && digits.length !== 14) {
		throw new ConstructionError(
			"INVALID_CNPJ",
			"CPF ou CNPJ deve conter 11 ou 14 digitos",
			400,
		);
	}
	return digits;
}

function normalizeCpf(raw?: string | null): string | null | undefined {
	if (raw === undefined) return undefined;
	if (raw === null || raw.trim() === "") return null;
	const digits = raw.replace(/\D/g, "");
	if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) {
		throw new ConstructionError(
			"INVALID_CPF",
			"CPF do responsavel invalido",
			400,
		);
	}
	const calc = (length: number) => {
		let sum = 0;
		for (let i = 0; i < length; i += 1)
			sum += Number(digits[i]) * (length + 1 - i);
		const value = (sum * 10) % 11;
		return value === 10 ? 0 : value;
	};
	if (calc(9) !== Number(digits[9]) || calc(10) !== Number(digits[10])) {
		throw new ConstructionError(
			"INVALID_CPF",
			"CPF do responsavel invalido",
			400,
		);
	}
	return digits;
}

function normalizeOptionalText(raw?: string | null): string | null | undefined {
	if (raw === undefined) return undefined;
	if (raw === null) return null;
	const value = raw.trim();
	return value.length > 0 ? value : null;
}

function normalizeState(raw?: string | null): string | null | undefined {
	const value = normalizeOptionalText(raw);
	return value === undefined || value === null ? value : value.toUpperCase();
}

export class SupplierService {
	async list(input: {
		ownerId: string;
		q?: string;
		page?: number;
		pageSize?: number;
		workspaceId?: string | null;
	}) {
		return supplierRepository.listSuppliers(input.ownerId, {
			q: input.q,
			page: input.page ?? 1,
			pageSize: input.pageSize ?? 10,
			workspaceId: input.workspaceId,
		});
	}

	async get(ownerId: string, id: string, workspaceId?: string | null) {
		const supplier = workspaceId
			? await supplierRepository.getSupplierById(ownerId, id, workspaceId)
			: await supplierRepository.getSupplierById(ownerId, id);
		if (!supplier) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Fornecedor nao encontrado",
				404,
			);
		}
		return supplier;
	}

	async getDetail(ownerId: string, id: string, workspaceId?: string | null) {
		const detail = workspaceId
			? await supplierRepository.getSupplierDetail(ownerId, id, workspaceId)
			: await supplierRepository.getSupplierDetail(ownerId, id);
		if (!detail) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Fornecedor nao encontrado",
				404,
			);
		}
		return detail;
	}

	async create(
		input: {
			ownerId: string;
			name: string;
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
		ctx: { userId: string; workspaceId?: string | null },
	) {
		const name = input.name.trim();
		if (!name) {
			throw new ConstructionError(
				"INVALID_INPUT",
				"Nome do fornecedor e obrigatorio",
				400,
			);
		}

		const document = normalizeDocument(input.document);
		const responsibleName = normalizeOptionalText(input.responsibleName);
		const responsibleDocument = normalizeCpf(input.responsibleDocument);
		if (document) {
			const existing = await supplierRepository.findSupplierByDocument(
				input.ownerId,
				document,
				ctx.workspaceId,
			);
			if (existing) {
				throw new ConstructionError(
					"DUPLICATE_SUPPLIER_DOCUMENT",
					"Ja existe um fornecedor com este documento",
					422,
				);
			}
		}

		const profile = {
			name,
			document,
			contact: input.contact ?? null,
			responsibleName,
			responsibleDocument,
			notes: input.notes ?? null,
		} as Parameters<typeof supplierRepository.createSupplier>[1];
		for (const key of [
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
		] as const) {
			const value = normalizeOptionalText(input[key]);
			if (value !== undefined) profile[key] = value;
		}
		const state = normalizeState(input.addressState);
		if (state !== undefined) profile.addressState = state;

		const created = await supplierRepository.createSupplier(
			input.ownerId,
			profile,
		);
		if (created) {
			await writeAudit(prisma, {
				userId: ctx.userId,
				ownerId: input.ownerId,
				action: "CREATE",
				entityType: "SUPPLIER",
				entityId: (created as { id: string }).id,
				entityDescription: `Fornecedor ${(created as { name?: string }).name ?? profile.name}`,
				newState: {
					name: profile.name,
					document: profile.document ?? null,
					contact: profile.contact ?? null,
				},
			});
		}
		return created;
	}

	async update(
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
		ctx: { userId: string; workspaceId?: string | null },
	) {
		const existing = ctx.workspaceId
			? await supplierRepository.getSupplierById(ownerId, id, ctx.workspaceId)
			: await supplierRepository.getSupplierById(ownerId, id);
		if (!existing) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Fornecedor nao encontrado",
				404,
			);
		}

		const updateData: Record<string, string | null> = {};

		if (input.name !== undefined) {
			const name = input.name.trim();
			if (!name) {
				throw new ConstructionError(
					"INVALID_INPUT",
					"Nome do fornecedor e obrigatorio",
					400,
				);
			}
			updateData.name = name;
		}

		if (input.document !== undefined) {
			const document = normalizeDocument(input.document);
			if (document) {
				const duplicate = await supplierRepository.findSupplierByDocument(
					ownerId,
					document,
					ctx.workspaceId,
				);
				if (duplicate && duplicate.id !== id) {
					throw new ConstructionError(
						"DUPLICATE_SUPPLIER_DOCUMENT",
						"Ja existe um fornecedor com este documento",
						422,
					);
				}
			}
			updateData.document = document;
		}
		if (input.responsibleName !== undefined)
			updateData.responsibleName =
				normalizeOptionalText(input.responsibleName) ?? null;
		if (input.responsibleDocument !== undefined)
			updateData.responsibleDocument =
				normalizeCpf(input.responsibleDocument) ?? null;

		if (input.contact !== undefined) updateData.contact = input.contact;
		for (const key of [
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
		] as const) {
			if (input[key] !== undefined)
				updateData[key] = normalizeOptionalText(input[key]) ?? null;
		}
		if (input.addressState !== undefined) {
			updateData.addressState = normalizeState(input.addressState) ?? null;
		}
		if (input.notes !== undefined) updateData.notes = input.notes;

		const updated = ctx.workspaceId
			? await supplierRepository.updateSupplier(
					ownerId,
					id,
					updateData,
					ctx.workspaceId,
				)
			: await supplierRepository.updateSupplier(ownerId, id, updateData);
		if (updated) {
			await writeAudit(prisma, {
				userId: ctx.userId,
				ownerId,
				action: "UPDATE",
				entityType: "SUPPLIER",
				entityId: id,
				entityDescription: `Fornecedor ${(updated as { name?: string }).name ?? (existing as { name?: string }).name ?? ""}`,
				previousState: {
					name: (existing as { name?: string }).name,
					document: (existing as { document?: string | null }).document ?? null,
				},
				newState: {
					name: (updated as { name?: string }).name,
					document: (updated as { document?: string | null }).document ?? null,
				},
			});
		}
		return updated;
	}

	async linkToWork(ownerId: string, workId: string, supplierId: string) {
		const [work, supplier] = await Promise.all([
			supplierRepository.getWorkById(ownerId, workId),
			supplierRepository.getSupplierById(ownerId, supplierId),
		]);
		if (!work || !supplier) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Obra ou fornecedor nao encontrado",
				404,
			);
		}
		if (supplier.status === "BLOCKED") {
			throw new ConstructionError(
				"SUPPLIER_BLOCKED",
				"Fornecedor bloqueado nao pode ser vinculado",
				422,
			);
		}
		if (
			await supplierRepository.findWorkSupplier(ownerId, workId, supplierId)
		) {
			throw new ConstructionError(
				"SUPPLIER_ALREADY_LINKED",
				"Fornecedor ja vinculado a esta obra",
				409,
			);
		}
		return supplierRepository.createWorkSupplier(ownerId, workId, supplierId);
	}

	listForWork(ownerId: string, workId: string) {
		return supplierRepository.listWorkSuppliers(ownerId, workId);
	}

	async unlinkFromWork(ownerId: string, workId: string, supplierId: string) {
		return supplierRepository.deleteWorkSupplier(ownerId, workId, supplierId);
	}

	async assertLinkedToWork(
		ownerId: string,
		workId: string,
		supplierId: string,
	) {
		const link = await supplierRepository.findWorkSupplier(
			ownerId,
			workId,
			supplierId,
		);
		if (!link) {
			throw new ConstructionError(
				"SUPPLIER_OUTSIDE_WORK",
				"Fornecedor nao esta vinculado a esta obra",
				422,
			);
		}
		return link;
	}

	async remove(
		ownerId: string,
		id: string,
		ctx: { userId: string; workspaceId?: string | null },
	) {
		const existing = ctx.workspaceId
			? await supplierRepository.getSupplierById(ownerId, id, ctx.workspaceId)
			: await supplierRepository.getSupplierById(ownerId, id);
		if (!existing) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Fornecedor nao encontrado",
				404,
			);
		}

		const dependencies = await supplierRepository.countSupplierDependencies(
			ownerId,
			id,
		);
		if (dependencies > 0) {
			throw new ConstructionError(
				"HAS_DEPENDENCIES",
				"Fornecedor vinculado a contratos ou custos",
				409,
			);
		}

		if (ctx.workspaceId) {
			await supplierRepository.deleteSupplier(ownerId, id, ctx.workspaceId);
		} else {
			await supplierRepository.deleteSupplier(ownerId, id);
		}
		await writeAudit(prisma, {
			userId: ctx.userId,
			ownerId,
			action: "DELETE",
			entityType: "SUPPLIER",
			entityId: id,
			entityDescription: `Fornecedor ${(existing as { name?: string }).name ?? ""}`,
			previousState: {
				name: (existing as { name?: string }).name,
				document: (existing as { document?: string | null }).document ?? null,
			},
		});
		return existing;
	}
}

export const supplierService = new SupplierService();
