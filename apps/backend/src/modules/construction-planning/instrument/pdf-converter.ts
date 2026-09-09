import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ConstructionError } from "../../../lib/errors";

const DEFAULT_QUEUE_LIMIT = 2;
let conversionQueue = Promise.resolve();
let pendingConversions = 0;

function conversionQueueLimit(): number {
	const parsed = Number.parseInt(
		process.env.PDF_CONVERSION_QUEUE_LIMIT ?? "",
		10,
	);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_QUEUE_LIMIT;
}

function enqueueConversion<T>(operation: () => Promise<T>): Promise<T> {
	if (pendingConversions >= conversionQueueLimit()) {
		return Promise.reject(
			new ConstructionError(
				"PDF_CONVERSION_BUSY",
				"Conversor de PDF temporariamente ocupado",
				503,
			),
		);
	}
	pendingConversions += 1;
	const result = conversionQueue.then(operation, operation);
	conversionQueue = result.then(
		() => undefined,
		() => undefined,
	);
	return result.finally(() => {
		pendingConversions -= 1;
	});
}

async function convertDocxToPdfInternal(
	bytes: Uint8Array,
): Promise<Uint8Array> {
	const dir = join(tmpdir(), `obracontrol-pdf-${randomUUID()}`);
	const input = join(dir, "instrumento.docx");
	const output = join(dir, "instrumento.pdf");
	try {
		await mkdir(dir, { recursive: true });
		await writeFile(input, bytes);
		const python =
			process.env.PYTHON_BIN ??
			(process.platform === "win32" ? "python" : "python3");
		const script =
			process.env.PDF_CONVERTER_SCRIPT ??
			resolve(import.meta.dir, "../../../../scripts/convert-docx-to-pdf.py");
		const proc = Bun.spawn([python, script, input, output], {
			stdout: "pipe",
			stderr: "pipe",
		});
		const exitCode = await proc.exited;
		if (exitCode !== 0)
			throw new Error(`PDF converter exited with ${exitCode}`);
		const pdf = await Bun.file(output).arrayBuffer();
		if (pdf.byteLength === 0) throw new Error("PDF vazio");
		return new Uint8Array(pdf);
	} catch {
		throw new ConstructionError(
			"PDF_CONVERSION_UNAVAILABLE",
			"Não foi possível converter o contrato para PDF",
			503,
		);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

// LibreOffice is memory-heavy and starts a complete office runtime per call.
// Serializing conversions prevents concurrent requests from multiplying that
// cost while preserving the existing API contract.
export function convertDocxToPdf(bytes: Uint8Array): Promise<Uint8Array> {
	return enqueueConversion(() => convertDocxToPdfInternal(bytes));
}
