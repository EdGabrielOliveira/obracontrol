import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { CONTRACT_STATUS_MAP, StatusBadge } from "@/atoms/status-badge";
import { DataTable } from "@/components/atoms/data-table";
import { Button } from "@/components/ui/button";
import type { Contract } from "@/types/contracts";
import { formatCurrency, formatDate } from "@/utils/format";

export type PendingContractRow = {
	id: string;
	workId: string;
	supplierName: string;
	supplierId: null;
	contractValue: number;
	serviceType: string;
	title: string;
	startDate: string | null;
	endDate: string | null;
	status: "PENDENTE" | "RECUSADO";
	notes: null;
	createdAt: string;
	isPending: true;
	requestId: string;
	approvalRequestId?: string | null;
	approvalKind?: "comparison" | "approval";
	approvalStatus?: string | null;
	approvalReason?: string | null;
};

export type ContractTableRow =
	| (Contract & { isPending?: false })
	| PendingContractRow;

interface ContractTableProps {
	contracts: ContractTableRow[];
	workId: string;
	onDelete?: (contractId: string) => void;
	onEdit?: (contract: Contract) => void;
	canChangeStatus?: boolean;
	onOpenStatus?: (contract: Contract) => void;
	isUpdatingStatus?: boolean;
	onRowClick?: (contract: ContractTableRow) => void;
	onPendingClick?: (
		requestId: string,
		kind: "comparison" | "approval",
	) => void;
	searchValue?: string;
	onSearchChange?: (value: string) => void;
}

const helper = createColumnHelper<ContractTableRow>();

export function ContractTable({
	contracts,
	workId,
	onDelete,
	onEdit,
	canChangeStatus = false,
	onOpenStatus,
	isUpdatingStatus,
	onRowClick,
	onPendingClick,
	searchValue,
	onSearchChange,
}: ContractTableProps) {
	const columns = [
		helper.accessor("title", {
			header: "Título",
			cell: (info) => {
				const row = info.row.original;
				return row.isPending ? (
					<button
						type="button"
						className="link-navigation"
						onClick={(event) => {
							event.stopPropagation();
							onPendingClick?.(
								row.requestId,
								row.approvalKind ??
									(row.approvalRequestId ? "approval" : "comparison"),
							);
						}}
					>
						<span>{info.getValue() || row.supplierName}</span>
						<span className="ml-2 text-xs font-normal text-muted-foreground">
							({row.serviceType})
						</span>
					</button>
				) : (
					<Link
						to="/app/obras/$workId/contratos/$contractId"
						params={{ workId, contractId: row.id }}
						className="link-navigation"
						data-no-row-click
					>
						{info.getValue() || row.supplierName}
					</Link>
				);
			},
			meta: { mobileLabel: "Título" },
		}),
		helper.accessor("contractValue", {
			header: "Valor",
			cell: (info) =>
				info.row.original.isPending ? (
					<span className="text-muted-foreground">—</span>
				) : (
					<span className="tabular-nums">
						{formatCurrency(info.getValue())}
					</span>
				),
			meta: { mobileLabel: "Valor" },
		}),
		helper.accessor("status", {
			header: "Status",
			cell: (info) => {
				const row = info.row.original;
				return (
					<div className="flex flex-col gap-1">
						<StatusBadge status={info.getValue()} map={CONTRACT_STATUS_MAP} />
						{row.isPending && row.approvalReason ? (
							<span className="max-w-xs text-xs text-muted-foreground">
								{row.approvalReason}
							</span>
						) : null}
					</div>
				);
			},
			meta: { mobileLabel: "Status" },
		}),
		helper.accessor("startDate", {
			header: "Data Início",
			cell: (info) =>
				info.row.original.isPending ? "—" : formatDate(info.getValue()),
			meta: { mobileLabel: "Início" },
		}),
		helper.accessor("endDate", {
			header: "Data Fim",
			cell: (info) =>
				info.row.original.isPending ? "—" : formatDate(info.getValue()),
			meta: { mobileLabel: "Fim" },
		}),
		helper.display({
			id: "actions",
			header: () => <span className="sr-only">Ações</span>,
			cell: (info) => {
				const row = info.row.original;
				if (row.isPending) return null;
				return (
					<div
						className="flex w-full items-center justify-end gap-1"
						data-no-row-click
					>
						{canChangeStatus ? (
							<Button
								variant="ghost"
								size="icon"
								title="Alterar status do contrato"
								aria-label="Alterar status do contrato"
								disabled={isUpdatingStatus}
								onClick={(event) => {
									event.stopPropagation();
									onOpenStatus?.(row);
								}}
							>
								<RefreshCw className="h-4 w-4" />
							</Button>
						) : null}
						{onEdit ? (
							<Button
								variant="ghost"
								size="icon"
								title="Editar contrato"
								aria-label="Editar contrato"
								onClick={(event) => {
									event.stopPropagation();
									onEdit(row);
								}}
							>
								<Pencil className="h-4 w-4" />
							</Button>
						) : null}
						{onDelete ? (
							<Button
								variant="ghost"
								size="icon"
								onClick={(event) => {
									event.stopPropagation();
									onDelete(row.id);
								}}
							>
								<Trash2 className="h-4 w-4 text-destructive" />
							</Button>
						) : null}
					</div>
				);
			},
			meta: { hideOnMobile: true },
		}),
	];

	return (
		<DataTable
			columns={columns}
			data={contracts}
			searchPlaceholder="Buscar contratos..."
			searchValue={searchValue}
			onSearchChange={onSearchChange}
			onRowClick={onRowClick}
		/>
	);
}
