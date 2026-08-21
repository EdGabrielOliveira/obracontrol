import { FileSpreadsheet } from "lucide-react";
import type { ChangeEvent } from "react";

interface FileDropzoneProps {
	accept?: string;
	onFileSelect: (file: File) => void;
}

export function FileDropzone({
	accept = ".xlsx",
	onFileSelect,
}: FileDropzoneProps) {
	const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) onFileSelect(file);
	};

	return (
		<div className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/40 hover:bg-primary/5">
			<FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground" />
			<p className="mt-2 text-sm text-muted-foreground">
				Selecione um arquivo .xlsx
			</p>
			<label className="mt-4 block w-full max-w-full cursor-pointer rounded-lg border border-border bg-muted px-4 py-2 text-center text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
				Selecionar arquivo
				<input
					type="file"
					accept={accept}
					onChange={handleChange}
					className="sr-only"
				/>
			</label>
		</div>
	);
}
