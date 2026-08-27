export function downloadBlob(blob: Blob, filename: string) {
	if (!(blob instanceof Blob) || blob.size === 0) {
		throw new Error("O arquivo recebido está vazio ou inválido.");
	}

	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
