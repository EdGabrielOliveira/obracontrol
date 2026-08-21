import { createColumnHelper } from "@tanstack/react-table";
import { FolderOpen } from "lucide-react";
import { DataTable } from "@/components/atoms/data-table";
import { EmptyStateCard } from "@/components/atoms/empty-state-card";
import { PaginationBar } from "@/components/molecules/pagination-bar";
import { Button } from "@/components/ui/button";
import type { ImportBatchRecord } from "@/types/import";

type ImportBatchesPanelProps = {
	batches: ImportBatchRecord[];
	total: number;
	page: number;
	pageSize: number;
	onPageChange: (page: number) => void;
	onOpenDetail: (batch: ImportBatchRecord) => void;
};

const STATUS_LABELS: Record<string, string> = {
	PARSING: "Analisando",
	READY: "Aguardando confirmação",
	PENDING_CONFIRM: "Aguardando aprovação",
	CONFIRMED: "Confirmada",
	EXPIRED: "Expirada",
	FAILED: "Falhou",
};

const batchColumnHelper = createColumnHelper<ImportBatchRecord>();

export function ImportBatchesPanel({
	batches,
	total,
	page,
	pageSize,
	onPageChange,
	onOpenDetail,
}: ImportBatchesPanelProps) {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">
					{total} importação(ões) registrada(s) nesta obra
				</p>
			</div>

			{batches.length === 0 ? (
				<EmptyStateCard
					icon={FolderOpen}
					title="Nenhuma importação"
					description="Importe uma planilha para aplicar dados nesta obra com preview e confirmação."
				/>
			) : (
				<DataTable
					columns={[
						batchColumnHelper.accessor("fileName", {
							header: "Arquivo",
							meta: { mobileLabel: "Arquivo" },
						}),
						batchColumnHelper.accessor("status", {
							header: "Status",
							cell: ({ getValue }) => STATUS_LABELS[getValue()] ?? getValue(),
							meta: { mobileLabel: "Status" },
						}),
						batchColumnHelper.accessor("rowCount", {
							header: "Linhas",
							meta: { mobileLabel: "Linhas" },
						}),
						batchColumnHelper.accessor("validCount", {
							header: "Válidas",
							meta: { mobileLabel: "Válidas" },
						}),
						batchColumnHelper.accessor("invalidCount", {
							header: "Inválidas",
							meta: { mobileLabel: "Inválidas" },
						}),
						batchColumnHelper.accessor("createdAt", {
							header: "Data",
							cell: ({ getValue }) =>
								new Date(getValue()).toLocaleString("pt-BR"),
							meta: { mobileLabel: "Data" },
						}),
						batchColumnHelper.display({
							id: "actions",
							header: () => <span className="sr-only">Ações</span>,
							cell: ({ row }) => (
								<Button
									variant="outline"
									size="sm"
									onClick={() => onOpenDetail(row.original)}
								>
									Detalhe
								</Button>
							),
							meta: { hideOnMobile: true },
						}),
					]}
					data={batches}
					searchPlaceholder="Buscar importações..."
					emptyMessage="Nenhuma importação encontrada."
				/>
			)}

			<PaginationBar
				meta={{
					page,
					limit: pageSize,
					total,
					totalPages: Math.max(1, Math.ceil(total / pageSize)),
					hasNextPage: page * pageSize < total,
					hasPreviousPage: page > 1,
				}}
				onPageChange={onPageChange}
			/>
		</div>
	);
}
