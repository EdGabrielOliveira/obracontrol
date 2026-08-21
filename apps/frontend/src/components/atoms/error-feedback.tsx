import { AlertTriangle, RotateCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "./access-denied";

interface ErrorFeedbackProps {
	message?: string;
	onRetry?: () => void;
	status?: number;
}

export function ErrorFeedback({
	message = "Erro ao carregar dados. Tente novamente.",
	onRetry,
	status,
}: ErrorFeedbackProps) {
	if (status === 403) {
		return <AccessDenied />;
	}
	return (
		<Alert variant="destructive">
			<AlertTriangle />
			<AlertDescription className="flex items-center justify-between">
				<span>{message}</span>
				{onRetry && (
					<Button
						variant="outline"
						size="sm"
						className="gap-2"
						onClick={onRetry}
					>
						<RotateCw className="h-3.5 w-3.5" />
						Tentar novamente
					</Button>
				)}
			</AlertDescription>
		</Alert>
	);
}
