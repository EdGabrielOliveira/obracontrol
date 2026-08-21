import { describe, expect, it } from "bun:test";
import { unzipSync, zipSync } from "fflate";
import { ConstructionError } from "../../../../src/lib/errors";
import {
	normalizeContractText,
	renderDocxTemplate,
	validateDocxTemplate,
} from "../../../../src/modules/organizations/docx-template";

function fixture(text: string): Uint8Array {
	return zipSync({
		"[Content_Types].xml": new TextEncoder().encode("<Types/>"),
		"word/document.xml": new TextEncoder().encode(
			`<w:document><w:body><w:p>${text}</w:p></w:body></w:document>`,
		),
	});
}

const values = {
	"empresa.nome": "Construtora Árvore",
	"obra.nome": "Obra São João",
	"contrato.codigo": "CTR-001",
	"contrato.valor": "R$ 10.000,00",
	"fornecedor.nome": "Fornecedor Ltda.",
};

describe("DOCX template engine", () => {
	it("substitui placeholder dividido em runs e preserva pacote", () => {
		const output = renderDocxTemplate(
			fixture("<w:r><w:t>{{empresa.</w:t></w:r><w:r><w:t>nome}}</w:t></w:r>"),
			values,
		);
		validateDocxTemplate(output);
		expect(output[0]).toBe(0x50);
	});

	it("preserva texto fora do placeholder e substitui mais de um valor", () => {
		const output = renderDocxTemplate(
			fixture(
				"<w:r><w:t>Antes </w:t></w:r><w:r><w:t>{{obra.nome}}</w:t></w:r><w:r><w:t> Depois {{contrato.codigo}}</w:t></w:r>",
			),
			values,
		);
		validateDocxTemplate(output);
	});

	it("renderiza atividades como tabela e preserva acentos", () => {
		const output = renderDocxTemplate(
			fixture("<w:r><w:t>{{contrato.atividades}}</w:t></w:r>"),
			values,
			{
				tables: {
					"contrato.atividades": [
						{ activity: "Execução de fundação", quantity: "12,50" },
					],
				},
			},
		);
		const files = unzipSync(output);
		const document = new TextDecoder().decode(files["word/document.xml"]);
		expect(document).toContain("<w:tbl>");
		expect(document).toContain("Execução de fundação");
		expect(document).toContain("12,50");
	});

	it("normaliza texto legado sem alterar Unicode válido", () => {
		const valid = "Execu\u00e7\u00e3o de funda\u00e7\u00f5es";
		const mojibake =
			"Execu\u00c3\u00a7\u00c3\u00a3o de funda\u00c3\u00a7\u00c3\u00b5es";
		expect(normalizeContractText(mojibake)).toBe(valid);
		expect(normalizeContractText(valid)).toBe(valid);
	});

	it("rejeita placeholder desconhecido e pacote corrompido", () => {
		expect(() => validateDocxTemplate(fixture("{{nao.catalogado}}"))).toThrow(
			ConstructionError,
		);
		expect(() => validateDocxTemplate(new Uint8Array([1, 2, 3]))).toThrow(
			ConstructionError,
		);
	});
});
