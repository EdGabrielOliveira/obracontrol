import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { ImportBatchesPanel } from "@/components/organisms/imports/import-batches-panel";
import type { ImportBatchRecord } from "@/types/import";

type QuickActionsTabProps = {
	batches: ImportBatchRecord[];
	total: number;
	page: number;
	pageSize: number;
	loading: boolean;
	error: Error | null;
	onRetry: () => void;
	onPageChange: (page: number) => void;
	onOpenDetail: (batch: ImportBatchRecord) => void;
};

export function QuickActionsTab({
	batches,
	total,
	page,
	pageSize,
	loading,
	error,
	onRetry,
	onPageChange,
	onOpenDetail,
}: QuickActionsTabProps) {
	if (loading) return <LoadingSpinner title="Carregando importações..." />;
	if (error)
		return (
			<ErrorFeedback
				message="Erro ao carregar importações."
				onRetry={onRetry}
			/>
		);

	return (
		<div className="space-y-6">
			<ImportBatchesPanel
				batches={batches}
				total={total}
				page={page}
				pageSize={pageSize}
				onPageChange={onPageChange}
				onOpenDetail={onOpenDetail}
			/>
		</div>
	);
}
