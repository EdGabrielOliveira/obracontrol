import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useState } from "react";
import { getImportBatches } from "@/api/import";
import { importBatchKeys } from "@/api/query-keys";
import { EmptyState } from "@/atoms/empty-state";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { ImportBatchDetailModal } from "@/components/organisms/imports/import-batch-detail-modal";
import { ImportBatchesPanel } from "@/components/organisms/imports/import-batches-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AuditLogEntry } from "@/types/audit";
import type { ImportBatchRecord } from "@/types/import";
import { type AuditFilters, AuditLogTable } from "./audit-log-table";

type HistoryTabProps = {
	canViewHistory: boolean;
	workId: string;
	rows: AuditLogEntry[];
	total: number;
	page: number;
	limit: number;
	loading: boolean;
	error: Error | null;
	onRetry: () => void;
	filters: AuditFilters;
	onFiltersChange: (filters: AuditFilters) => void;
	onPageChange: (page: number) => void;
	onOpenDetail: (row: AuditLogEntry) => void;
	onOpenNavigationTarget: (
		target: NonNullable<AuditLogEntry["navigationTarget"]>,
	) => void;
};

export function HistoryTab({
	canViewHistory,
	workId,
	rows,
	total,
	page,
	limit,
	loading,
	error,
	onRetry,
	filters,
	onFiltersChange,
	onPageChange,
	onOpenDetail,
	onOpenNavigationTarget,
}: HistoryTabProps) {
	const [detailBatch, setDetailBatch] = useState<ImportBatchRecord | null>(
		null,
	);
	const [importPage, setImportPage] = useState(1);
	const importPageSize = 20;
	const importQuery = useQuery({
		queryKey: importBatchKeys.list(workId, importPage, importPageSize),
		queryFn: () => getImportBatches(workId, importPage, importPageSize),
		enabled: canViewHistory,
	});

	if (!canViewHistory) {
		return (
			<EmptyState
				icon={<History className="h-10 w-10" />}
				title="Histórico restrito"
				description="Somente administradores visualizam o histórico da obra."
			/>
		);
	}

	return (
		<>
			<Tabs defaultValue="auditoria" className="space-y-4">
				<TabsList>
					<TabsTrigger value="auditoria">Auditoria</TabsTrigger>
					<TabsTrigger value="importacoes">Importações</TabsTrigger>
				</TabsList>
				<TabsContent value="auditoria">
					{loading ? (
						<LoadingSpinner title="Carregando histórico..." />
					) : error ? (
						<ErrorFeedback
							message="Erro ao carregar o histórico da obra."
							onRetry={onRetry}
						/>
					) : (
						<AuditLogTable
							rows={rows}
							total={total}
							page={page}
							limit={limit}
							filters={filters}
							onFiltersChange={onFiltersChange}
							onPageChange={onPageChange}
							onOpenDetail={onOpenDetail}
							onOpenNavigationTarget={onOpenNavigationTarget}
						/>
					)}
				</TabsContent>
				<TabsContent value="importacoes">
					{importQuery.isLoading ? (
						<LoadingSpinner title="Carregando importações..." />
					) : importQuery.error ? (
						<ErrorFeedback
							message="Erro ao carregar importações."
							onRetry={() => importQuery.refetch()}
						/>
					) : (
						<ImportBatchesPanel
							batches={importQuery.data?.data ?? []}
							total={importQuery.data?.total ?? 0}
							page={importQuery.data?.page ?? importPage}
							pageSize={importPageSize}
							onPageChange={setImportPage}
							onOpenDetail={setDetailBatch}
						/>
					)}
				</TabsContent>
			</Tabs>
			<ImportBatchDetailModal
				open={detailBatch !== null}
				onOpenChange={(open) => {
					if (!open) setDetailBatch(null);
				}}
				workId={workId}
				batch={detailBatch}
			/>
		</>
	);
}
