import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConstructionError } from "../../../lib/errors";

export async function convertDocxToPdf(bytes: Uint8Array): Promise<Uint8Array> {
	const dir = join(tmpdir(), `obracontrol-pdf-${randomUUID()}`);
	const input = join(dir, "instrumento.docx");
	const output = join(dir, "instrumento.pdf");
	const profile = join(dir, "profile");
	try {
		await mkdir(dir, { recursive: true });
		await writeFile(input, bytes);
		const executable = process.env.LIBREOFFICE_BIN ?? "soffice";
		const userInstallation = `file://${profile.replace(/\\/g, "/")}`;
		const proc = Bun.spawn(
			[
				executable,
				`-env:UserInstallation=${userInstallation}`,
				"--headless",
				"--convert-to",
				"pdf",
				"--outdir",
				dir,
				input,
			],
			{
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const exitCode = await proc.exited;
		if (exitCode !== 0) throw new Error(`LibreOffice exited with ${exitCode}`);
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
