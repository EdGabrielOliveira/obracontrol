import type { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { ConstructionError } from "../../../lib/errors";
import { prisma } from "../../../lib/prisma";
import { normalizeText } from "../../../lib/text-utils";
import type { ImportValidationError } from "../types";

export type NormalizedSupplierImportRow = {
	rowNumber: number;
	name: string;
	document: string;
	contact: string | null;
	pixKey: string | null;
	pixKeyType: string | null;
	bankCode: string | null;
	bankName: string | null;
	bankBranch: string | null;
	bankAccount: string | null;
	bankAccountType: string | null;
	addressZipCode: string | null;
	addressStreet: string | null;
	addressNumber: string | null;
	addressComplement: string | null;
	addressDistrict: string | null;
	addressCity: string | null;
	addressState: string | null;
	notes: string | null;
};

export type SupplierImportParseResult = {
	rows: NormalizedSupplierImportRow[];
	errors: ImportValidationError[];
};

function optionalText(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	const text = String(value).trim();
	return text.length > 0 ? text : null;
}

function cnpj(value: unknown): string | null {
	const digits = optionalText(value)?.replace(/\D/g, "") ?? "";
	return digits.length === 14 ? digits : null;
}

function rowValue(row: Record<string, unknown>, aliases: string[]) {
	const values = new Map(
		Object.entries(row).map(([key, value]) => [normalizeText(key), value]),
	);
	for (const alias of aliases) {
		const value = values.get(normalizeText(alias));
		if (value !== undefined) return value;
	}
	return null;
}

function error(
	row: number,
	field: string,
	code: string,
	message: string,
): ImportValidationError {
	return { row, field, sheet: "Fornecedores", code, message };
}

export function parseSupplierWorkbook(
	bytes: Uint8Array,
): SupplierImportParseResult {
	if (bytes.length === 0) {
		throw new ConstructionError("INVALID_WORKBOOK", "Workbook vazio", 400);
	}

	const workbook = XLSX.read(bytes, { type: "buffer" });
	const sheetName = workbook.SheetNames.find(
		(name) => normalizeText(name) === normalizeText("Fornecedores"),
	);
	if (!sheetName) {
		throw new ConstructionError(
			"INVALID_WORKBOOK",
			"Aba Fornecedores nao encontrada",
			400,
		);
	}

	const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
		workbook.Sheets[sheetName],
		{ defval: null, raw: true },
	);
	const parsed: NormalizedSupplierImportRow[] = [];
	const errors: ImportValidationError[] = [];
	const seenCnpjs = new Set<string>();

	for (const [index, row] of rows.entries()) {
		const rowNumber = index + 2;
		const name = optionalText(rowValue(row, ["Nome da empresa", "Nome"]));
		const document = cnpj(rowValue(row, ["CNPJ"]));
		let invalid = false;

		if (!name) {
			errors.push(
				error(
					rowNumber,
					"Nome da empresa",
					"MISSING_REQUIRED_FIELD",
					"Nome da empresa e obrigatorio",
				),
			);
			invalid = true;
		}
		if (!document) {
			errors.push(
				error(rowNumber, "CNPJ", "INVALID_CNPJ", "CNPJ deve conter 14 digitos"),
			);
			invalid = true;
		}
		if (!document || seenCnpjs.has(document)) {
			if (document && seenCnpjs.has(document)) {
				errors.push(
					error(
						rowNumber,
						"CNPJ",
						"DUPLICATE_CNPJ",
						"CNPJ duplicado no arquivo",
					),
				);
			}
			invalid = true;
		}
		if (invalid || !name || !document) continue;

		const pixKeyType = optionalText(rowValue(row, ["Tipo PIX"]));
		if (
			pixKeyType &&
			!["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"].includes(
				pixKeyType.toUpperCase(),
			)
		) {
			errors.push(
				error(rowNumber, "Tipo PIX", "INVALID_PIX_TYPE", "Tipo PIX invalido"),
			);
			continue;
		}

		const bankAccountType = optionalText(rowValue(row, ["Tipo de conta"]));
		if (
			bankAccountType &&
			!["CHECKING", "SAVINGS"].includes(bankAccountType.toUpperCase())
		) {
			errors.push(
				error(
					rowNumber,
					"Tipo de conta",
					"INVALID_BANK_ACCOUNT_TYPE",
					"Tipo de conta invalido",
				),
			);
			continue;
		}

		seenCnpjs.add(document);
		parsed.push({
			rowNumber,
			name,
			document,
			contact: optionalText(rowValue(row, ["Contato"])),
			pixKey: optionalText(rowValue(row, ["Chave PIX"])),
			pixKeyType: pixKeyType?.toUpperCase() ?? null,
			bankCode: optionalText(rowValue(row, ["Codigo do banco"])),
			bankName: optionalText(rowValue(row, ["Banco"])),
			bankBranch: optionalText(rowValue(row, ["Agencia"])),
			bankAccount: optionalText(rowValue(row, ["Conta"])),
			bankAccountType: bankAccountType?.toUpperCase() ?? null,
			addressZipCode: optionalText(rowValue(row, ["CEP"])),
			addressStreet: optionalText(rowValue(row, ["Logradouro"])),
			addressNumber: optionalText(rowValue(row, ["Numero"])),
			addressComplement: optionalText(rowValue(row, ["Complemento"])),
			addressDistrict: optionalText(rowValue(row, ["Bairro"])),
			addressCity: optionalText(rowValue(row, ["Cidade"])),
			addressState: optionalText(rowValue(row, ["UF"]))?.toUpperCase() ?? null,
			notes: optionalText(rowValue(row, ["Observacoes"])),
		});
	}

	return { rows: parsed, errors };
}

export async function importSupplierWorkbook(
	ownerId: string,
	workId: string,
	bytes: Uint8Array,
) {
	const parsed = parseSupplierWorkbook(bytes);
	if (parsed.errors.length > 0) {
		throw new ConstructionError(
			"VALIDATION_FAILED",
			"Planilha de fornecedores invalida",
			422,
			parsed.errors,
		);
	}

	const work = await prisma.constructionWork.findFirst({
		where: { id: workId, ownerId },
		select: { id: true },
	});
	if (!work) {
		throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
	}

	return prisma.$transaction(async (tx) => {
		const suppliers = [] as Array<{ id: string; document: string | null }>;
		for (const row of parsed.rows) {
			const data = supplierData(row);
			const existing = await tx.constructionSupplier.findFirst({
				where: { ownerId, document: row.document },
			});
			const supplier = existing
				? await tx.constructionSupplier.update({
						where: { id: existing.id, ownerId },
						data,
					})
				: await tx.constructionSupplier.create({
						data: { ownerId, ...data },
					});

			await tx.constructionWorkSupplier.upsert({
				where: {
					workId_supplierId: { workId, supplierId: supplier.id },
				},
				update: {},
				create: { ownerId, workId, supplierId: supplier.id },
			});
			suppliers.push({ id: supplier.id, document: supplier.document });
		}

		return { importedCount: suppliers.length, suppliers };
	});
}

type SupplierData = Omit<
	Prisma.ConstructionSupplierUncheckedCreateInput,
	"id" | "ownerId" | "createdAt" | "updatedAt"
>;

function supplierData(row: NormalizedSupplierImportRow): SupplierData {
	return {
		name: row.name,
		document: row.document,
		contact: row.contact,
		pixKey: row.pixKey,
		pixKeyType: row.pixKeyType,
		bankCode: row.bankCode,
		bankName: row.bankName,
		bankBranch: row.bankBranch,
		bankAccount: row.bankAccount,
		bankAccountType: row.bankAccountType,
		addressZipCode: row.addressZipCode,
		addressStreet: row.addressStreet,
		addressNumber: row.addressNumber,
		addressComplement: row.addressComplement,
		addressDistrict: row.addressDistrict,
		addressCity: row.addressCity,
		addressState: row.addressState,
		notes: row.notes,
	};
}
