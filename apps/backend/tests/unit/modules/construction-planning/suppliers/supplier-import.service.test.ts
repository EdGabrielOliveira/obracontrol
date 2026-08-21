import { describe, expect, it } from "bun:test";
import * as XLSX from "xlsx";
import { parseSupplierWorkbook } from "../../../../../src/modules/construction-planning/suppliers/supplier-import.service";

function workbookBytes(rows: Array<Record<string, unknown>>) {
	const workbook = XLSX.utils.book_new();
	const sheet = XLSX.utils.json_to_sheet(rows);
	XLSX.utils.book_append_sheet(workbook, sheet, "Fornecedores");
	return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

describe("parseSupplierWorkbook", () => {
	it("normaliza CNPJ e le dados cadastrais da aba Fornecedores", () => {
		const result = parseSupplierWorkbook(
			workbookBytes([
				{
					"Nome da empresa": "Fornecedor A",
					CNPJ: "12.345.678/0001-90",
					"Chave PIX": "financeiro@fornecedor.com",
					"Tipo PIX": "EMAIL",
					Banco: "Banco do Brasil",
					"Codigo do banco": "001",
					Agencia: "1234",
					Conta: "56789-0",
					"Tipo de conta": "CHECKING",
					CEP: "01310-100",
					Logradouro: "Avenida Paulista",
					Numero: "1000",
					Cidade: "Sao Paulo",
					UF: "sp",
				},
			]),
		);

		expect(result.errors).toEqual([]);
		expect(result.rows).toEqual([
			expect.objectContaining({
				rowNumber: 2,
				name: "Fornecedor A",
				document: "12345678000190",
				pixKeyType: "EMAIL",
				addressState: "SP",
			}),
		]);
	});

	it("retorna erros com linha e campo para dados invalidos", () => {
		const result = parseSupplierWorkbook(
			workbookBytes([{ "Nome da empresa": "", CNPJ: "123" }]),
		);

		expect(result.rows).toEqual([]);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ row: 2, field: "Nome da empresa" }),
				expect.objectContaining({ row: 2, field: "CNPJ" }),
			]),
		);
	});

	it("rejeita CNPJs duplicados no mesmo arquivo", () => {
		const result = parseSupplierWorkbook(
			workbookBytes([
				{ "Nome da empresa": "Fornecedor A", CNPJ: "12.345.678/0001-90" },
				{ "Nome da empresa": "Fornecedor B", CNPJ: "12.345.678/0001-90" },
			]),
		);

		expect(result.rows).toHaveLength(1);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					row: 3,
					field: "CNPJ",
					code: "DUPLICATE_CNPJ",
				}),
			]),
		);
	});
});
