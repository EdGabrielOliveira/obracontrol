import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { type DragEvent, useId, useRef, useState } from "react";

interface FileDropzoneProps {
	accept?: string;
	onFileSelect: (file: File) => void;
	onFileReject?: (message: string) => void;
	disabled?: boolean;
}

export function FileDropzone({
	accept = ".xlsx",
	onFileSelect,
	onFileReject,
	disabled = false,
}: FileDropzoneProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const inputId = useId();
	const [isDragging, setIsDragging] = useState(false);

	const acceptedExtensions = accept
		.split(",")
		.map((value) => value.trim().toLowerCase())
		.filter((value) => value.startsWith("."));

	const selectFile = (file: File | undefined) => {
		if (!file || disabled) return;
		const fileExtension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
		if (
			acceptedExtensions.length > 0 &&
			!acceptedExtensions.includes(fileExtension)
		) {
			onFileReject?.(
				`Formato não suportado. Envie um arquivo ${acceptedExtensions.join(" ou ")}.`,
			);
			return;
		}
		if (file.size > 25 * 1024 * 1024) {
			onFileReject?.("O arquivo excede o limite de 25 MB.");
			return;
		}
		onFileSelect(file);
	};

	const handleDrag = (event: DragEvent<HTMLElement>) => {
		event.preventDefault();
		if (
			event.type === "dragleave" &&
			event.relatedTarget &&
			event.currentTarget.contains(event.relatedTarget as Node)
		) {
			return;
		}
		if (!disabled) setIsDragging(event.type !== "dragleave");
	};

	const handleDrop = (event: DragEvent<HTMLElement>) => {
		event.preventDefault();
		setIsDragging(false);
		selectFile(event.dataTransfer.files?.[0]);
	};

	return (
		<label
			htmlFor={inputId}
			aria-disabled={disabled}
			onDragEnter={handleDrag}
			onDragOver={handleDrag}
			onDragLeave={handleDrag}
			onDrop={handleDrop}
			className={[
				"group flex min-h-72 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center outline-none transition-colors focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15",
				isDragging
					? "border-primary bg-primary/10"
					: "border-border bg-muted/20 hover:border-primary/40 hover:bg-primary/5",
				disabled && "pointer-events-none opacity-60",
			]
				.filter(Boolean)
				.join(" ")}
		>
			<div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
				{isDragging ? (
					<UploadCloud className="size-7" aria-hidden="true" />
				) : (
					<FileSpreadsheet className="size-7" aria-hidden="true" />
				)}
			</div>
			<p className="mt-4 text-sm font-semibold text-foreground">
				{isDragging ? "Solte o arquivo aqui" : "Arraste sua planilha para cá"}
			</p>
			<p className="mt-1 text-sm text-muted-foreground">
				ou escolha um arquivo do seu computador
			</p>
			<span className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
				Selecionar arquivo
			</span>
			<p className="mt-4 text-xs text-muted-foreground">
				{acceptedExtensions.join(" · ").toUpperCase()} · até 25 MB
			</p>
			<input
				id={inputId}
				ref={inputRef}
				type="file"
				accept={accept}
				className="sr-only"
				onClick={(event) => {
					event.stopPropagation();
					(event.currentTarget as HTMLInputElement).value = "";
				}}
				onChange={(event) => selectFile(event.target.files?.[0])}
			/>
		</label>
	);
}
