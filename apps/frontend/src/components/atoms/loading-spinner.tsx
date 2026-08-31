import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
	title?: string;
}

export function LoadingSpinner({
	title = "Carregando...",
}: LoadingSpinnerProps) {
	return (
		<div
			className="flex min-h-60 flex-col items-center justify-center rounded-xl border border-border/70 bg-card/70 px-6 py-16 shadow-sm"
			role="status"
			aria-live="polite"
		>
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
			<p className="mt-3 text-sm font-medium text-foreground">{title}</p>
			<p className="mt-1 text-xs text-muted-foreground">
				A tela abriu. Estamos carregando os dados mais recentes.
			</p>
		</div>
	);
}
