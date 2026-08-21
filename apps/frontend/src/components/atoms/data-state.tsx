import type { ReactNode } from "react";
import { EmptyState } from "@/components/atoms/empty-state";
import { ErrorFeedback } from "@/components/atoms/error-feedback";
import { LoadingSpinner } from "@/components/atoms/loading-spinner";

interface DataStateProps {
	loading?: boolean;
	error?: boolean;
	empty?: boolean;
	loadingTitle?: string;
	errorMessage?: string;
	onRetry?: () => void;
	emptyTitle?: string;
	emptyDescription?: string;
	emptyIcon?: ReactNode;
	emptyActions?: Array<{ label: string; onClick: () => void }>;
	children: ReactNode;
}

/**
 * Composição padrão para blocos de dados: loading, erro, vazio e conteúdo.
 * A rota/organism continua responsável por decidir os flags e as ações.
 */
export function DataState({
	loading = false,
	error = false,
	empty = false,
	loadingTitle,
	errorMessage,
	onRetry,
	emptyTitle = "Nenhum dado encontrado",
	emptyDescription,
	emptyIcon,
	emptyActions,
	children,
}: DataStateProps) {
	if (loading) return <LoadingSpinner title={loadingTitle} />;
	if (error) return <ErrorFeedback message={errorMessage} onRetry={onRetry} />;
	if (empty) {
		return (
			<EmptyState
				title={emptyTitle}
				description={emptyDescription}
				icon={emptyIcon}
				actions={emptyActions}
			/>
		);
	}
	return <>{children}</>;
}
