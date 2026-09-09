export function downloadBlob(blob: Blob, filename: string) {
	if (!(blob instanceof Blob) || blob.size === 0) {
		throw new Error("O arquivo recebido está vazio ou inválido.");
	}

	const legacyNavigator = navigator as Navigator & {
		msSaveOrOpenBlob?: (file: Blob, defaultName?: string) => void;
	};
	if (legacyNavigator.msSaveOrOpenBlob) {
		legacyNavigator.msSaveOrOpenBlob(blob, filename);
		return;
	}

	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.style.display = "none";
	document.body.appendChild(a);
	// Dispatching a real click event is more reliable than HTMLElement.click()
	// in embedded browsers, where the work export is commonly initiated.
	a.dispatchEvent(
		new MouseEvent("click", { bubbles: true, cancelable: true, view: window }),
	);
	document.body.removeChild(a);
	window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
