import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpRight, Trash2 } from "lucide-react";
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
	startDate: null;
	endDate: null;
	status: "PENDENTE";
	notes: null;
	createdAt: string;
	isPending: true;
	requestId: string;
};

export type ContractTableRow =
	| (Contract & { isPending?: false })
	| PendingContractRow;

interface ContractTableProps {
	contracts: ContractTableRow[];
	workId: string;
	onDelete?: (contractId: string) => void;
	onRowClick?: (contract: ContractTableRow) => void;
	onPendingClick?: (requestId: string) => void;
}

const helper = createColumnHelper<ContractTableRow>();

export function ContractTable({
	contracts,
	workId,
	onDelete,
	onRowClick,
	onPendingClick,
}: ContractTableProps) {
	const columns = [
		helper.accessor("supplierName", {
			header: "Fornecedor / contrato",
			cell: (info) => {
				const row = info.row.original;
				return row.isPending ? (
					<button
						type="button"
						className="link-navigation"
						onClick={(event) => {
							event.stopPropagation();
							onPendingClick?.(row.requestId);
						}}
					>
						<span>{info.getValue()}</span>
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
						{info.getValue()}
					</Link>
				);
			},
			meta: { mobileLabel: "Fornecedor / contrato" },
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
			cell: (info) => (
				<StatusBadge status={info.getValue()} map={CONTRACT_STATUS_MAP} />
			),
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
				return (
					<div className="flex items-center gap-1" data-no-row-click>
						{row.isPending ? (
							<Button
								variant="outline"
								size="sm"
								onClick={() => onPendingClick?.(row.requestId)}
							>
								Abrir comparação
							</Button>
						) : (
							<Link
								to="/app/obras/$workId/contratos/$contractId"
								params={{ workId, contractId: row.id }}
							>
								<Button variant="outline" size="sm" className="gap-1">
									Abrir <ArrowUpRight className="h-3 w-3" />
								</Button>
							</Link>
						)}
						{onDelete && !row.isPending ? (
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
			onRowClick={onRowClick}
		/>
	);
}
