import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
	title?: string;
}

export function LoadingSpinner({
	title = "Carregando...",
}: LoadingSpinnerProps) {
	return (
		<div className="flex flex-col items-center justify-center py-20">
			<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			<p className="mt-3 text-sm text-muted-foreground">{title}</p>
		</div>
	);
}
