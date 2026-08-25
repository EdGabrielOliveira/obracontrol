import { env } from "../../env";
import { type CnpjLookupResult, cnpjClient } from "../../lib/cnpj-client";
import { ConstructionError } from "../../lib/errors";
import { objectStorage } from "../../lib/object-storage";
import { prisma } from "../../lib/prisma";
import { getWorkspaceIdForUser } from "../../lib/workspace";
import { sha256Docx, validateDocxTemplate } from "./docx-template";
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

type DbStructuredAddress = {
	zipCode: string;
	street: string;
	district: string;
	number: string;
	city: string;
	state: string;
	complement: string | null;
	latitude: unknown;
	longitude: unknown;
};

function addressCreateInput(input: StructuredAddressInput) {
	return {
		zipCode: input.zipCode.replace(/\D/g, ""),
		street: input.street?.trim() ?? "",
		district: input.district?.trim() ?? "",
		number: input.number?.trim() ?? "",
		city: input.city.trim(),
		state: input.state.trim().toUpperCase(),
		complement: input.complement?.trim() || null,
		latitude: input.latitude ?? null,
		longitude: input.longitude ?? null,
	};
}

function mapStructuredAddress(
	address: DbStructuredAddress | null | undefined,
): StructuredAddressInput | null {
	if (!address) return null;
	return {
		zipCode: address.zipCode,
		street: address.street,
		district: address.district,
		number: address.number,
		city: address.city,
		state: address.state,
		complement: address.complement,
		latitude: address.latitude === null ? null : Number(address.latitude),
		longitude: address.longitude === null ? null : Number(address.longitude),
	};
}

export type CompanyInput = {
	name: string;
	document?: string | null;
	tradeName?: string | null;
	addressCity?: string | null;
	addressState?: string | null;
	structuredAddress?: StructuredAddressInput | null;
	contactEmail?: string | null;
	contactPhone?: string | null;
	managerName?: string | null;
};

export type CompanyView = {
	id: string;
	name: string;
	document: string | null;
	tradeName: string | null;
	addressCity: string | null;
	addressState: string | null;
	structuredAddress: StructuredAddressInput | null;
	contactEmail: string | null;
	contactPhone: string | null;
	managerName: string | null;
	contractTemplate: string | null;
	contractTemplateSha256: string | null;
	contractTemplateVersion: number;
	organizationCount: number;
	createdAt: string;
};

/**
 * Company ownership records who created the company; it is not an access
 * boundary for platform administrators. Keep this explicit at the service
 * boundary so managers and other non-admin roles remain scoped as before.
 */
export type CompanyAccess = {
	canAccessAllCompanies?: boolean;
	workspaceId?: string;
};

function companyWhere(ownerId: string, access?: CompanyAccess) {
	return access?.canAccessAllCompanies
		? access.workspaceId
			? { workspaceId: access.workspaceId }
			: {}
		: { ownerId };
}

function toView(row: {
	id: string;
	name: string;
	document: string | null;
	tradeName: string | null;
	addressCity: string | null;
	addressState: string | null;
	contactEmail: string | null;
	contactPhone: string | null;
	managerName: string | null;
	structuredAddress?: DbStructuredAddress | null;
	contractTemplate: string | null;
	contractTemplateSha256?: string | null;
	contractTemplateVersion?: number;
	createdAt: Date;
	_count?: { organizations: number };
}): CompanyView {
	return {
		id: row.id,
		name: row.name,
		document: row.document,
		tradeName: row.tradeName,
		addressCity: row.addressCity,
		addressState: row.addressState,
		contactEmail: row.contactEmail,
		contactPhone: row.contactPhone,
		managerName: row.managerName,
		structuredAddress: mapStructuredAddress(row.structuredAddress),
		contractTemplate: row.contractTemplate,
		contractTemplateSha256: row.contractTemplateSha256 ?? null,
		contractTemplateVersion: row.contractTemplateVersion ?? 1,
		organizationCount: row._count?.organizations ?? 0,
		createdAt: row.createdAt.toISOString(),
	};
}

export const companyService = {
	lookupCnpj: async (raw: string): Promise<CnpjLookupResult> =>
		cnpjClient.lookup(raw),

	async createWithTemplate(
		ownerId: string,
		input: CompanyInput,
		file: File,
	): Promise<CompanyView> {
		if (!input.name.trim()) {
			throw new ConstructionError("INVALID_INPUT", "Nome obrigatorio", 400);
		}
		if (file.name.split(".").pop()?.toLowerCase() !== "docx") {
			throw new ConstructionError(
				"INVALID_FILE_TYPE",
				"A criacao exige um arquivo DOCX",
				400,
			);
		}
		if (file.size > 10 * 1024 * 1024) {
			throw new ConstructionError(
				"FILE_TOO_LARGE",
				"Arquivo deve ter no maximo 10MB",
				413,
			);
		}
		const bytes = new Uint8Array(await file.arrayBuffer());
		validateDocxTemplate(bytes);
		const storageKey = `companies/${ownerId}/${crypto.randomUUID()}/template.docx`;
		await objectStorage.put(storageKey, bytes, file.type);
		const document = input.document?.trim() || null;
		let tradeName = input.tradeName?.trim() || null;
		let addressState = input.addressState?.trim() || null;
		if (document) {
			try {
				const result = await companyService.lookupCnpj(document);
				tradeName ??= result.nomeFantasia;
				addressState ??= result.uf;
			} catch (error) {
				if (
					error instanceof ConstructionError &&
					error.code !== "CNPJ_UNAVAILABLE"
				)
					throw error;
			}
		}
		try {
			const workspaceId = await getWorkspaceIdForUser(ownerId);
			const row = await prisma.$transaction(async (tx) =>
				tx.company.create({
					data: {
						ownerId,
						...(workspaceId
							? { workspace: { connect: { id: workspaceId } } }
							: {}),
						name: input.name.trim(),
						document,
						tradeName,
						addressCity: input.addressCity?.trim() || null,
						addressState,
						...(input.structuredAddress
							? {
									structuredAddress: {
										create: addressCreateInput(input.structuredAddress),
									},
								}
							: {}),
						contactEmail: input.contactEmail?.trim() || null,
						contactPhone: input.contactPhone?.trim() || null,
						managerName: input.managerName?.trim() || null,
						contractTemplate: file.name,
						contractTemplateType: "DOCX",
						contractTemplateBlob: null,
						contractTemplateStorageKey: storageKey,
						contractTemplateSha256: sha256Docx(bytes),
						contractTemplateVersion: 1,
					},
					include: {
						_count: { select: { organizations: true } },
						structuredAddress: true,
					},
				}),
			);
			return toView(row);
		} catch (error) {
			await objectStorage.delete(storageKey).catch(() => undefined);
			throw error;
		}
	},

	async create(ownerId: string, input: CompanyInput): Promise<CompanyView> {
		if (!input.name.trim()) {
			throw new ConstructionError("INVALID_INPUT", "Nome obrigatorio", 400);
		}

		const document = input.document?.trim() || null;
		let tradeName = input.tradeName?.trim() || null;
		let addressCity = input.addressCity?.trim() || null;
		let addressState = input.addressState?.trim() || null;

		if (document) {
			try {
				const result = await companyService.lookupCnpj(document);
				tradeName = tradeName ?? result.nomeFantasia;
				addressCity = addressCity ?? null;
				addressState = addressState ?? result.uf;
			} catch (error) {
				if (error instanceof ConstructionError) {
					const code = error.code;
					const isFormatOrNotFound =
						code === "INVALID_CNPJ" || code === "CNPJ_NOT_FOUND";
					if (isFormatOrNotFound) throw error;
				} else {
					throw error;
				}
			}
		}

		const workspaceId = await getWorkspaceIdForUser(ownerId);
		const created = await prisma.company.create({
			data: {
				ownerId,
				...(workspaceId ? { workspace: { connect: { id: workspaceId } } } : {}),
				name: input.name.trim(),
				document,
				tradeName,
				addressCity,
				addressState,
				...(input.structuredAddress
					? {
							structuredAddress: {
								create: addressCreateInput(input.structuredAddress),
							},
						}
					: {}),
				contactEmail: input.contactEmail?.trim() || null,
				contactPhone: input.contactPhone?.trim() || null,
				managerName: input.managerName?.trim() || null,
			},
			include: {
				_count: { select: { organizations: true } },
				structuredAddress: true,
			},
		});
		return toView(created);
	},

	async list(ownerId: string, access?: CompanyAccess): Promise<CompanyView[]> {
		const rows = await prisma.company.findMany({
			where: companyWhere(ownerId, access),
			orderBy: { name: "asc" },
			include: {
				_count: { select: { organizations: true } },
				structuredAddress: true,
			},
		});
		return rows.map(toView);
	},

	async get(
		ownerId: string,
		companyId: string,
		access?: CompanyAccess,
	): Promise<CompanyView> {
		const row = await prisma.company.findFirst({
			where: { id: companyId, ...companyWhere(ownerId, access) },
			include: {
				_count: { select: { organizations: true } },
				structuredAddress: true,
			},
		});
		if (!row) {
			throw new ConstructionError("NOT_FOUND", "Empresa nao encontrada", 404);
		}
		return toView(row);
	},

	async update(
		ownerId: string,
		companyId: string,
		input: Partial<CompanyInput>,
		access?: CompanyAccess,
	): Promise<CompanyView> {
		const existing = await prisma.company.findFirst({
			where: { id: companyId, ...companyWhere(ownerId, access) },
		});
		if (!existing) {
			throw new ConstructionError("NOT_FOUND", "Empresa nao encontrada", 404);
		}
		const updated = await prisma.company.update({
			where: { id: companyId },
			data: {
				...(input.name !== undefined ? { name: input.name.trim() } : {}),
				...(input.document !== undefined
					? { document: input.document?.trim() || null }
					: {}),
				...(input.tradeName !== undefined
					? { tradeName: input.tradeName?.trim() || null }
					: {}),
				...(input.addressCity !== undefined
					? { addressCity: input.addressCity?.trim() || null }
					: {}),
				...(input.addressState !== undefined
					? { addressState: input.addressState?.trim() || null }
					: {}),
				...(input.contactEmail !== undefined
					? { contactEmail: input.contactEmail?.trim() || null }
					: {}),
				...(input.contactPhone !== undefined
					? { contactPhone: input.contactPhone?.trim() || null }
					: {}),
				...(input.managerName !== undefined
					? { managerName: input.managerName?.trim() || null }
					: {}),
				...(input.structuredAddress !== undefined
					? input.structuredAddress
						? {
								structuredAddress: {
									upsert: {
										create: addressCreateInput(input.structuredAddress),
										update: addressCreateInput(input.structuredAddress),
									},
								},
							}
						: { structuredAddress: { disconnect: true } }
					: {}),
			},
			include: {
				_count: { select: { organizations: true } },
				structuredAddress: true,
			},
		});
		return toView(updated);
	},

	async delete(
		ownerId: string,
		companyId: string,
		access?: CompanyAccess,
	): Promise<void> {
		const existing = await prisma.company.findFirst({
			where: { id: companyId, ...companyWhere(ownerId, access) },
		});
		if (!existing) {
			throw new ConstructionError("NOT_FOUND", "Empresa nao encontrada", 404);
		}
		await prisma.company.delete({ where: { id: companyId } });
	},

	async linkOrganization(
		ownerId: string,
		companyId: string,
		organizationId: string,
		access?: CompanyAccess,
	): Promise<void> {
		const company = await prisma.company.findFirst({
			where: { id: companyId, ...companyWhere(ownerId, access) },
		});
		if (!company) {
			throw new ConstructionError("NOT_FOUND", "Empresa nao encontrada", 404);
		}
		const result = await prisma.organization.updateMany({
			where: { id: organizationId, ...companyWhere(ownerId, access) },
			data: { companyId },
		});
		if (result.count === 0) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Organizacao nao encontrada",
				404,
			);
		}
	},

	async uploadContractTemplate(
		ownerId: string,
		companyId: string,
		file: File,
		access?: CompanyAccess,
	): Promise<CompanyView> {
		const company = await prisma.company.findFirst({
			where: { id: companyId, ...companyWhere(ownerId, access) },
		});
		if (!company) {
			throw new ConstructionError("NOT_FOUND", "Empresa nao encontrada", 404);
		}
		const ext = file.name.split(".").pop()?.toLowerCase();
		if (env.AUDIT_RELEASE_B && ext === "pdf") {
			throw new ConstructionError(
				"LEGACY_TEMPLATE_REMOVED",
				"Templates PDF foram removidos no Release B; envie DOCX",
				400,
			);
		}
		if (ext !== "pdf" && ext !== "docx") {
			throw new ConstructionError(
				"INVALID_FILE_TYPE",
				"Apenas arquivos PDF ou DOCX sao aceitos",
				400,
			);
		}
		if (file.size > 10 * 1024 * 1024) {
			throw new ConstructionError(
				"FILE_TOO_LARGE",
				"Arquivo deve ter no maximo 10MB",
				413,
			);
		}
		const bytes = new Uint8Array(await file.arrayBuffer());
		if (ext === "docx") validateDocxTemplate(bytes);
		const previousVersion = company.contractTemplateVersion ?? 0;
		const storageKey = `companies/${company.ownerId}/${companyId}/template-v${previousVersion + 1}.${ext}`;
		await objectStorage.put(storageKey, bytes, file.type);
		try {
			const updated = await prisma.company.update({
				where: { id: companyId },
				data: {
					contractTemplate: file.name,
					contractTemplateType: ext === "pdf" ? "PDF" : "DOCX",
					contractTemplateBlob: null,
					contractTemplateStorageKey: storageKey,
					contractTemplateSha256: ext === "docx" ? sha256Docx(bytes) : null,
					contractTemplateVersion: previousVersion + 1,
				},
				include: { _count: { select: { organizations: true } } },
			});
			if (company.contractTemplateStorageKey) {
				await objectStorage
					.delete(company.contractTemplateStorageKey)
					.catch(() => undefined);
			}
			return toView(updated);
		} catch (error) {
			await objectStorage.delete(storageKey).catch(() => undefined);
			throw error;
		}
	},

	async downloadContractTemplate(
		ownerId: string,
		companyId: string,
		access?: CompanyAccess,
	): Promise<{ bytes: Uint8Array; filename: string; contentType: string }> {
		const company = await prisma.company.findFirst({
			where: { id: companyId, ...companyWhere(ownerId, access) },
			select: {
				contractTemplate: true,
				contractTemplateType: true,
				contractTemplateBlob: true,
				contractTemplateStorageKey: true,
			},
		});
		if (!company) {
			throw new ConstructionError("NOT_FOUND", "Empresa nao encontrada", 404);
		}
		if (!company.contractTemplate) {
			throw new ConstructionError(
				"TEMPLATE_NOT_FOUND",
				"Empresa sem modelo contratual",
				404,
			);
		}
		const contentType =
			company.contractTemplateType === "DOCX"
				? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
				: "application/pdf";
		const bytes = company.contractTemplateStorageKey
			? await objectStorage.get(company.contractTemplateStorageKey)
			: company.contractTemplateBlob
				? new Uint8Array(company.contractTemplateBlob)
				: null;
		if (!bytes) {
			throw new ConstructionError(
				"TEMPLATE_NOT_FOUND",
				"Arquivo do modelo contratual nao encontrado",
				404,
			);
		}
		return {
			bytes,
			filename: company.contractTemplate,
			contentType,
		};
	},
};
