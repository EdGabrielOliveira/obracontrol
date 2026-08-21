import { createHash } from "node:crypto";
import { unzipSync, zipSync } from "fflate";
import { ConstructionError } from "../../lib/errors";
import {
	instrumentPlaceholderCatalog,
	resolveInstrumentPlaceholders,
} from "../construction-planning/instrument/placeholder-catalog";

const WORD_XML =
	/^word\/(?:document|header\d+|footer\d+|footnotes|endnotes)\.xml$/;
const TEXT_NODE = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
const PARAGRAPH = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
const REQUIRED_INSTRUMENT_VALUES = new Set([
	"contrato.valor_extenso",
	"contrato.objeto",
	"contrato.multa",
	"contrato.multa_extenso",
	"contrato.atividades",
	"empresa.foro",
	"fornecedor.endereco",
	"fornecedor.responsavel_nome",
	"fornecedor.responsavel_cpf",
	"fornecedor.contato",
	"obra.endereco",
	"data.emissao",
]);

function decodeXml(value: string): string {
	return value
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

export type DocxTableRow = {
	activity: string;
	quantity: string;
};

export function normalizeContractText(value: string): string {
	const pairs: Array<[string, string]> = [
		[String.fromCharCode(0xc3, 0xa2), String.fromCharCode(0xe2)],
		[String.fromCharCode(0xc3, 0xa3), String.fromCharCode(0xe3)],
		[String.fromCharCode(0xc3, 0xa1), String.fromCharCode(0xe1)],
		[String.fromCharCode(0xc3, 0xa9), String.fromCharCode(0xe9)],
		[String.fromCharCode(0xc3, 0xaa), String.fromCharCode(0xea)],
		[String.fromCharCode(0xc3, 0xad), String.fromCharCode(0xed)],
		[String.fromCharCode(0xc3, 0xb3), String.fromCharCode(0xf3)],
		[String.fromCharCode(0xc3, 0xb4), String.fromCharCode(0xf4)],
		[String.fromCharCode(0xc3, 0xb5), String.fromCharCode(0xf5)],
		[String.fromCharCode(0xc3, 0xba), String.fromCharCode(0xfa)],
		[String.fromCharCode(0xc3, 0xa7), String.fromCharCode(0xe7)],
		[String.fromCharCode(0xc2, 0xb0), String.fromCharCode(0xb0)],
	];
	return pairs
		.reduce((text, [from, to]) => text.replaceAll(from, to), value)
		.normalize("NFC");
}

function tableCell(value: string, width: number, bold = false): string {
	return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${bold ? "<w:b/>" : ""}<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">${escapeXml(normalizeContractText(value))}</w:t></w:r></w:p></w:tc>`;
}

function activityTable(rows: readonly DocxTableRow[]): string {
	const body = rows.length
		? rows
				.map(
					(row) =>
						`<w:tr>${tableCell(row.activity, 6900)}${tableCell(row.quantity, 2100)}</w:tr>`,
				)
				.join("")
		: `<w:tr>${tableCell("Nenhuma atividade vinculada", 6900)}${tableCell("-", 2100)}</w:tr>`;
	return `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:left w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:right w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="6900"/><w:gridCol w:w="2100"/></w:tblGrid><w:tr><w:trPr><w:tblHeader/></w:trPr>${tableCell("Atividade", 6900, true)}${tableCell("Quantidade", 2100, true)}</w:tr>${body}</w:tbl>`;
}

function readDocumentXml(bytes: Uint8Array): Record<string, Uint8Array> {
	if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
		throw new ConstructionError("INVALID_DOCX", "Arquivo DOCX invalido", 422);
	}
	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(bytes);
	} catch {
		throw new ConstructionError("INVALID_DOCX", "Pacote DOCX corrompido", 422);
	}
	if (!files["word/document.xml"]) {
		throw new ConstructionError(
			"INVALID_DOCX",
			"DOCX sem word/document.xml",
			422,
		);
	}
	return files;
}

export function validateDocxTemplate(bytes: Uint8Array): void {
	const files = readDocumentXml(bytes);
	const allowed = new Set(
		instrumentPlaceholderCatalog.map((item) => item.name),
	);
	for (const [part, bytes] of Object.entries(files)) {
		if (!WORD_XML.test(part)) continue;
		const xml = new TextDecoder().decode(bytes);
		for (const match of xml.matchAll(PLACEHOLDER)) {
			if (!allowed.has(match[1])) {
				throw new ConstructionError(
					"INSTRUMENT_PLACEHOLDER_UNKNOWN",
					`Placeholder desconhecido: ${match[1]}`,
					422,
				);
			}
		}
	}
}

export function sha256Docx(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

export function renderDocxTemplate(
	bytes: Uint8Array,
	values: Readonly<Record<string, string | number | null | undefined>>,
	options: { tables?: Readonly<Record<string, readonly DocxTableRow[]>> } = {},
): Uint8Array {
	const files = readDocumentXml(bytes);
	const resolved = resolveInstrumentPlaceholders(values);
	const requiredByName = new Map(
		instrumentPlaceholderCatalog.map((item) => [item.name, item.required]),
	);
	for (const [part, partBytes] of Object.entries(files)) {
		if (!WORD_XML.test(part)) continue;
		let xml = new TextDecoder().decode(partBytes);
		xml = xml.replace(PARAGRAPH, (paragraph) => {
			const plain = decodeXml(
				[...paragraph.matchAll(TEXT_NODE)]
					.map((match) => match[2] ?? "")
					.join(""),
			);
			const tableMatch = plain.match(/^\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}$/);
			const rows = tableMatch ? options.tables?.[tableMatch[1]] : undefined;
			return rows ? activityTable(rows) : paragraph;
		});
		const nodes: Array<{ start: number; end: number; text: string }> = [];
		for (const match of xml.matchAll(TEXT_NODE)) {
			const full = match[0];
			const text = match[2] ?? "";
			const end = (match.index ?? 0) + full.length;
			const contentStart = (match.index ?? 0) + full.indexOf(">") + 1;
			nodes.push({ start: contentStart, end: end - "</w:t>".length, text });
		}
		if (nodes.length === 0) continue;
		const plainNodes = nodes.map((node) => decodeXml(node.text));
		const plain = plainNodes.join("");
		const matches = [...plain.matchAll(PLACEHOLDER)];
		if (matches.some((match) => !requiredByName.has(match[1]))) {
			throw new ConstructionError(
				"INSTRUMENT_PLACEHOLDER_UNKNOWN",
				"O DOCX contem placeholder desconhecido",
				422,
			);
		}
		const renderedNodes = [...plainNodes];
		const boundaries: number[] = [];
		let cursor = 0;
		for (const text of plainNodes) {
			boundaries.push(cursor);
			cursor += text.length;
		}
		const lastBoundary = (target: number, inclusive: boolean) => {
			for (let index = boundaries.length - 1; index >= 0; index -= 1) {
				if (
					inclusive ? boundaries[index] <= target : boundaries[index] < target
				)
					return index;
			}
			return -1;
		};
		for (
			let matchIndex = matches.length - 1;
			matchIndex >= 0;
			matchIndex -= 1
		) {
			const match = matches[matchIndex];
			const start = match.index ?? 0;
			const end = start + match[0].length;
			let startNode = lastBoundary(start, true);
			let endNode = lastBoundary(end, false);
			if (startNode < 0) startNode = 0;
			if (endNode < 0) endNode = startNode;
			const startOffset = start - boundaries[startNode];
			const endOffset = end - boundaries[endNode];
			const value = resolved[match[1]];
			if (
				(requiredByName.get(match[1]) ||
					REQUIRED_INSTRUMENT_VALUES.has(match[1])) &&
				value == null
			) {
				throw new ConstructionError(
					"INSTRUMENT_PLACEHOLDER_REQUIRED",
					`Valor obrigatorio ausente: ${match[1]}`,
					422,
				);
			}
			const replacement = normalizeContractText(String(value ?? ""));
			if (startNode === endNode) {
				const text = renderedNodes[startNode];
				renderedNodes[startNode] =
					text.slice(0, startOffset) + replacement + text.slice(endOffset);
				continue;
			}
			renderedNodes[startNode] =
				renderedNodes[startNode].slice(0, startOffset) + replacement;
			for (let index = startNode + 1; index < endNode; index += 1) {
				renderedNodes[index] = "";
			}
			renderedNodes[endNode] = renderedNodes[endNode].slice(endOffset);
		}
		for (let index = nodes.length - 1; index >= 0; index -= 1) {
			const node = nodes[index];
			xml = `${xml.slice(0, node.start)}${escapeXml(renderedNodes[index])}${xml.slice(node.end)}`;
		}
		files[part] = new TextEncoder().encode(xml);
	}
	const output = zipSync(files, { level: 6 });
	validateDocxTemplate(output);
	return output;
}
