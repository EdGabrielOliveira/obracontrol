import { createHash } from "node:crypto";
import { ConstructionError } from "../../../lib/errors";
import { objectStorage } from "../../../lib/object-storage";
import { prisma } from "../../../lib/prisma";
import { auditService } from "../../audit/audit.service";
import {
	renderDocxTemplate,
	sha256Docx,
	validateDocxTemplate,
} from "../../organizations/docx-template";
import { findSupplierByDocumentOrName } from "../suppliers/supplier.repository";
import {
	assertInstrumentReady,
	assessInstrumentReadiness,
	type InstrumentReadiness,
} from "./instrument-readiness";
import { moneyToPortuguese } from "./money-words";
import { convertDocxToPdf } from "./pdf-converter";
import { INSTRUMENT_PLACEHOLDER_CATALOG_VERSION } from "./placeholder-catalog";

const MAX_ARTIFACT_BYTES = 15 * 1024 * 1024;

type ArtifactRow = {
	id: string;
	contractId: string;
	version: number;
	filename: string;
	mimeType: string;
	bytes: Uint8Array | null;
	storageKey: string | null;
	sha256: string;
	templateSha256: string;
	catalogVersion: string;
	generatedBy: string;
	generatedAt: Date;
};

type ArtifactMetadataRow = Omit<ArtifactRow, "bytes">;

function artifactView(row: ArtifactMetadataRow) {
	return {
		id: row.id,
		contractId: row.contractId,
		version: row.version,
		filename: row.filename,
		mimeType: row.mimeType,
		sha256: row.sha256,
		templateSha256: row.templateSha256,
		catalogVersion: row.catalogVersion,
		generatedBy: row.generatedBy,
		generatedAt: row.generatedAt.toISOString(),
	};
}

function joinAddress(values: Array<string | null | undefined>): string | null {
	const address = values.filter(Boolean).join(", ");
	return address || null;
}

async function loadInstrumentSource(
	ownerId: string,
	workId: string,
	contractId: string,
) {
	const source = await prisma.contract.findFirst({
		where: { id: contractId, ownerId, workId },
		include: {
			services: {
				orderBy: { sortOrder: "asc" },
				select: { description: true, quantity: true },
			},
			work: {
				select: {
					name: true,
					address: true,
					structuredAddress: true,
					costCenter: {
						select: { organization: { select: { company: true } } },
					},
				},
			},
			supplier: {
				select: {
					name: true,
					contact: true,
					document: true,
					responsibleName: true,
					responsibleDocument: true,
					addressZipCode: true,
					addressStreet: true,
					addressNumber: true,
					addressComplement: true,
					addressDistrict: true,
					addressCity: true,
					addressState: true,
				},
			},
			contractRequest: {
				select: { acceptedProposalId: true },
			},
		},
	});
	if (!source || source.supplier) return source;
	const proposalId = source.contractRequest?.acceptedProposalId;
	if (!proposalId) return source;
	const proposal = await prisma.contractRequestProposal.findFirst({
		where: { id: proposalId, ownerId, workId },
		select: { normalizedCnpj: true, supplierName: true },
	});
	const supplier = proposal
		? await findSupplierByDocumentOrName(
				ownerId,
				proposal.normalizedCnpj,
				proposal.supplierName,
			)
		: null;
	return supplier ? { ...source, supplierId: supplier.id, supplier } : source;
}

type InstrumentSource = NonNullable<
	Awaited<ReturnType<typeof loadInstrumentSource>>
>;

function getCompany(source: InstrumentSource) {
	return source.work.costCenter?.organization?.company ?? null;
}

function getSupplierAddress(source: InstrumentSource): string | null {
	const supplier = source.supplier;
	if (!supplier) return null;
	return joinAddress([
		supplier.addressStreet,
		supplier.addressNumber,
		supplier.addressComplement,
		supplier.addressDistrict,
		supplier.addressCity,
		supplier.addressState,
		supplier.addressZipCode,
	]);
}

function hasCompleteSupplierAddress(source: InstrumentSource): boolean {
	const supplier = source.supplier;
	return Boolean(
		supplier?.addressStreet?.trim() &&
			supplier.addressNumber?.trim() &&
			supplier.addressDistrict?.trim() &&
			supplier.addressCity?.trim() &&
			supplier.addressState?.trim() &&
			supplier.addressZipCode?.trim(),
	);
}

function getWorkAddress(source: InstrumentSource): string | null {
	const address = source.work.structuredAddress;
	return (
		(address
			? joinAddress([
					address.street,
					address.number,
					address.complement,
					address.district,
					address.city,
					address.state,
					address.zipCode,
				])
			: null) ?? source.work.address
	);
}

function isTemplateValid(bytes: Uint8Array | null | undefined): boolean {
	if (!bytes) return false;
	try {
		validateDocxTemplate(new Uint8Array(bytes));
		return true;
	} catch {
		return false;
	}
}

function formatQuantity(value: unknown): string {
	const quantity = Number(value);
	if (!Number.isFinite(quantity)) return "-";
	return quantity.toLocaleString("pt-BR", {
		maximumFractionDigits: 3,
	});
}

function assessSourceReadiness(
	source: InstrumentSource,
	templateBytes: Uint8Array | null,
): InstrumentReadiness {
	const company = getCompany(source);
	const supplier = source.supplier;
	const hasDocxTemplate =
		company?.contractTemplateType === "DOCX" && Boolean(templateBytes);
	return assessInstrumentReadiness({
		hasDocxTemplate,
		templateIsValid: isTemplateValid(templateBytes),
		hasSupplier: Boolean(source.supplierId && supplier),
		objectDescription: source.objectDescription,
		supplier: supplier
			? {
					name: supplier.name,
					document: supplier.document,
					responsibleName: supplier.responsibleName,
					responsibleDocument: supplier.responsibleDocument,
					hasCompleteAddress: hasCompleteSupplierAddress(source),
					contact: supplier.contact,
				}
			: null,
		workAddress: getWorkAddress(source),
	});
}

async function loadCompanyTemplate(
	company: ReturnType<typeof getCompany>,
): Promise<Uint8Array | null> {
	if (!company) return null;
	if (company.contractTemplateStorageKey) {
		return objectStorage.get(company.contractTemplateStorageKey);
	}
	return company.contractTemplateBlob
		? new Uint8Array(company.contractTemplateBlob)
		: null;
}

export async function getContractInstrumentReadiness(
	ownerId: string,
	workId: string,
	contractId: string,
): Promise<InstrumentReadiness> {
	const source = await loadInstrumentSource(ownerId, workId, contractId);
	if (!source)
		throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
	return assessSourceReadiness(
		source,
		await loadCompanyTemplate(getCompany(source)),
	);
}

export async function generateContractInstrumentArtifact(
	ownerId: string,
	workId: string,
	contractId: string,
	ctx: { userId: string },
) {
	const contract = await loadInstrumentSource(ownerId, workId, contractId);
	if (!contract)
		throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
	const templateBytes = await loadCompanyTemplate(getCompany(contract));
	assertInstrumentReady(assessSourceReadiness(contract, templateBytes));
	const company = getCompany(contract);
	const supplier = contract.supplier;
	const supplierAddress = getSupplierAddress(contract);
	const workAddress = getWorkAddress(contract);
	if (
		!company ||
		!templateBytes ||
		!supplier ||
		!supplierAddress ||
		!workAddress
	) {
		throw new Error("Instrument readiness invariant was not satisfied");
	}
	const template = templateBytes;
	const formatMoney = (value: number) =>
		value.toLocaleString("pt-BR", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});
	const contractValue = Number(contract.contractValue);
	const penaltyValue = contractValue * 0.2;
	const activities = contract.services.map((service) => ({
		activity: service.description,
		quantity: formatQuantity(service.quantity),
	}));
	const companyForum =
		company.addressCity && company.addressState
			? `${company.addressCity}/${company.addressState}`
			: null;
	const bytes = renderDocxTemplate(
		template,
		{
			"empresa.nome": company.name,
			"obra.nome": contract.work.name,
			"contrato.codigo": contract.code,
			"contrato.valor": formatMoney(contractValue),
			"contrato.valor_extenso": moneyToPortuguese(contractValue),
			"contrato.objeto": contract.objectDescription,
			"contrato.atividades": "tabela",
			"contrato.multa": formatMoney(penaltyValue),
			"contrato.multa_extenso": moneyToPortuguese(penaltyValue),
			"contrato.inicio": contract.startDate?.toISOString() ?? null,
			"contrato.fim": contract.endDate?.toISOString() ?? null,
			"fornecedor.nome": supplier.name,
			"fornecedor.documento": supplier.document ?? null,
			"fornecedor.endereco": supplierAddress,
			"fornecedor.responsavel_nome": supplier.responsibleName,
			"fornecedor.responsavel_cpf": supplier.responsibleDocument,
			"fornecedor.contato": supplier.contact ?? "",
			"obra.endereco": workAddress,
			"data.emissao": new Intl.DateTimeFormat("pt-BR", {
				dateStyle: "long",
				timeZone: "America/Sao_Paulo",
			}).format(new Date()),
			"empresa.foro": companyForum,
		},
		{ tables: { "contrato.atividades": activities } },
	);
	const pdfBytes = await convertDocxToPdf(bytes);
	const persistedPdf = new Uint8Array(new ArrayBuffer(pdfBytes.byteLength));
	persistedPdf.set(pdfBytes);
	if (pdfBytes.byteLength > MAX_ARTIFACT_BYTES) {
		throw new ConstructionError(
			"FILE_TOO_LARGE",
			"Instrumento excede 15 MiB",
			413,
		);
	}
	const sha256 = createHash("sha256").update(pdfBytes).digest("hex");
	const templateSha256 = company.contractTemplateSha256 ?? sha256Docx(template);
	const storageKey = `contracts/${ownerId}/${contractId}/instrument-${sha256}.pdf`;
	await objectStorage.put(storageKey, persistedPdf, "application/pdf");
	let row: Awaited<ReturnType<typeof prisma.contractInstrumentArtifact.upsert>>;
	try {
		row = await prisma.$transaction(async (tx) => {
			const artifact = await tx.contractInstrumentArtifact.upsert({
				where: { contractId },
				update: {
					version: 1,
					filename: `instrumento-${contract.code}.pdf`,
					mimeType: "application/pdf",
					bytes: null,
					storageKey,
					sha256,
					templateSha256,
					catalogVersion: INSTRUMENT_PLACEHOLDER_CATALOG_VERSION,
					generatedBy: ctx.userId,
					generatedAt: new Date(),
				},
				create: {
					ownerId,
					contractId,
					version: 1,
					filename: `instrumento-${contract.code}.pdf`,
					mimeType: "application/pdf",
					bytes: null,
					storageKey,
					sha256,
					templateSha256,
					catalogVersion: INSTRUMENT_PLACEHOLDER_CATALOG_VERSION,
					generatedBy: ctx.userId,
				},
			});
			await tx.contract.update({
				where: { id: contractId },
				data: {
					instrumentGeneratedAt: artifact.generatedAt,
					instrumentGeneratedBy: ctx.userId,
					instrumentTemplateVersion: `${company.contractTemplate}@${company.contractTemplateVersion}`,
				},
			});
			await tx.auditLog.create({
				data: {
					userId: ctx.userId,
					ownerId,
					action: "INSTRUMENT_GENERATED",
					entityType: "CONTRACT",
					entityId: contractId,
					entityDescription: `Instrumento ${contract.code} atualizado`,
					metadata: {
						artifactId: artifact.id,
						version: artifact.version,
						sha256,
					},
				},
			});
			return artifact;
		});
	} catch (error) {
		await objectStorage.delete(storageKey).catch(() => undefined);
		throw error;
	}
	return artifactView(row);
}

export async function listContractInstrumentArtifacts(
	ownerId: string,
	workId: string,
	contractId: string,
) {
	const contract = await prisma.contract.findFirst({
		where: { id: contractId, ownerId, workId },
		select: { id: true },
	});
	if (!contract)
		throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
	const rows = await prisma.contractInstrumentArtifact.findMany({
		where: { ownerId, contractId },
		orderBy: { version: "desc" },
		select: {
			id: true,
			contractId: true,
			version: true,
			filename: true,
			mimeType: true,
			sha256: true,
			templateSha256: true,
			catalogVersion: true,
			generatedBy: true,
			generatedAt: true,
			storageKey: true,
		},
	});
	return rows.map(artifactView);
}

export async function downloadContractInstrumentArtifact(
	ownerId: string,
	workId: string,
	contractId: string,
	artifactId: string,
	ctx: { userId: string },
) {
	const contract = await prisma.contract.findFirst({
		where: { id: contractId, ownerId, workId },
		select: { id: true },
	});
	if (!contract)
		throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
	const row = await prisma.contractInstrumentArtifact.findFirst({
		where: { id: artifactId, ownerId, contractId },
	});
	if (!row)
		throw new ConstructionError("NOT_FOUND", "Instrumento nao encontrado", 404);
	await auditService.log({
		userId: ctx.userId,
		ownerId,
		action: "INSTRUMENT_DOWNLOADED",
		entityType: "CONTRACT",
		entityId: contractId,
		entityDescription: `Download do instrumento ${row.filename}`,
		metadata: {
			artifactId: row.id,
			version: row.version,
			filename: row.filename,
		},
	});
	return {
		bytes: row.storageKey
			? ((await objectStorage.get(row.storageKey)) ??
				(row.bytes ? new Uint8Array(row.bytes) : null))
			: row.bytes
				? new Uint8Array(row.bytes)
				: null,
		filename: row.filename,
		contentType: row.mimeType,
		metadata: artifactView(row),
	};
}
