const XLSX_CONTENT_TYPE =
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function safeDownloadFilename(filename: string, fallback = "download.bin") {
	const normalized = filename
		.normalize("NFKC")
		.replace(/[\\/]/g, "-")
		.replaceAll("\r", "-")
		.replaceAll("\n", "-")
		.replaceAll("\0", "-")
		.replace(/\s+/g, " ")
		.trim();
	return normalized.length > 0 ? normalized : fallback;
}

function asciiFallback(filename: string, fallback: string) {
	const ascii = filename
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^\x20-\x7E]/g, "")
		.replace(/[^A-Za-z0-9._ -]/g, "-")
		.replace(/\s+/g, " ")
		.trim();
	return ascii || fallback;
}

export function contentDisposition(
	filename: string,
	fallback = "download.bin",
): string {
	const safeName = safeDownloadFilename(filename, fallback);
	const fallbackName = asciiFallback(safeName, fallback);
	return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

export function binaryResponse(
	bytes: Uint8Array | ArrayBuffer | Blob,
	contentType: string,
	filename: string,
	status = 200,
): Response {
	return new Response(bytes as BodyInit, {
		status,
		headers: {
			"content-type": contentType,
			"content-disposition": contentDisposition(filename),
		},
	});
}

export function xlsxResponse(
	bytes: Uint8Array | ArrayBuffer | Blob,
	filename: string,
): Response {
	return binaryResponse(bytes, XLSX_CONTENT_TYPE, filename);
}

export function pdfResponse(
	bytes: Uint8Array | ArrayBuffer | Blob,
	filename: string,
): Response {
	return binaryResponse(bytes, "application/pdf", filename);
}
