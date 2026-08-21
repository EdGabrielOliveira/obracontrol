import { createColumnHelper } from "@tanstack/react-table";
import { RotateCcw, ScrollText } from "lucide-react";
import { AUDIT_ACTION_OPTIONS } from "@/api/audit";
import { EmptyState } from "@/atoms/empty-state";
import { DataTable } from "@/components/atoms/data-table";
import { PaginationBar } from "@/components/molecules/pagination-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { auditActionLabel, auditEntityLabel } from "@/lib/audit-labels";
import type { AuditLogEntry } from "@/types/audit";
import { formatDate } from "@/utils/format";

export type AuditFilters = {
	entityType?: string;
	entityTypes?: string;
	action?: string;
	actions?: string;
	userId?: string;
	fromDate?: string;
	toDate?: string;
	userSearch?: string;
};

const MODULE_OPTIONS = [
	{ value: "", label: "Todos os módulos", entities: [] },
	{
		value: "CONTRACTS",
		label: "Contratos",
		entities: [
			"CONTRACT",
			"CONTRACT_AMENDMENT",
			"CONTRACT_MEASUREMENT",
			"CONTRACT_PAYMENT",
		],
	},
	{
		value: "MEASUREMENTS",
		label: "Medições",
		entities: [
			"CONSTRUCTION_MEASUREMENT",
			"WORK_MEASUREMENT",
			"CONTRACT_MEASUREMENT",
		],
	},
	{ value: "COSTS", label: "Custos", entities: ["ACTUAL_COST"] },
	{
		value: "BUDGET",
		label: "Orçamento",
		entities: ["BUDGET_ITEM", "SCHEDULE_REVISION"],
	},
	{
		value: "ACTIONS",
		label: "Ações",
		entities: [
			"APPROVAL_REQUEST",
			"GOVERNANCE_RECORD",
			"EXPORT",
			"CONSTRUCTION_IMPORT",
		],
	},
] as const;

const STATUS_OPTIONS = [
	{ value: "", label: "Todos os status", actions: [] },
	{ value: "APPROVE", label: "Aprovado", actions: ["APPROVE"] },
	{ value: "SUBMIT", label: "Pendente", actions: ["SUBMIT"] },
	{ value: "REJECT", label: "Rejeitado", actions: ["REJECT"] },
] as const;

const INTERNAL_OPTIONS = [
	{ value: "", label: "Todos os itens internos" },
	{ value: "CONTRACT", label: "Contrato" },
	{ value: "CONTRACT_AMENDMENT", label: "Aditivo de contrato" },
	{ value: "CONTRACT_MEASUREMENT", label: "Medições do contrato" },
	{ value: "CONTRACT_PAYMENT", label: "Pagamentos do contrato" },
	{ value: "ACTUAL_COST", label: "Custo" },
	{ value: "BUDGET_ITEM", label: "Item do orçamento" },
	{ value: "WORK_MEASUREMENT", label: "Medição da obra" },
] as const;

type AuditLogTableProps = {
	rows: AuditLogEntry[];
	total: number;
	page: number;
	limit: number;
	filters: AuditFilters;
	onFiltersChange: (filters: AuditFilters) => void;
	onPageChange: (page: number) => void;
	onOpenDetail: (row: AuditLogEntry) => void;
	onOpenNavigationTarget: (
		target: NonNullable<AuditLogEntry["navigationTarget"]>,
	) => void;
	showUserFilter?: boolean;
};

export function AuditLogTable({
	rows,
	total,
	page,
	limit,
	filters,
	onFiltersChange,
	onPageChange,
	onOpenDetail,
	onOpenNavigationTarget,
	showUserFilter = true,
}: AuditLogTableProps) {
	const columnHelper = createColumnHelper<AuditLogEntry>();
	const columns = [
		columnHelper.accessor("createdAt", {
			header: "Data",
			cell: (info) => (
				<span className="whitespace-nowrap">{formatDate(info.getValue())}</span>
			),
		}),
		columnHelper.accessor("action", {
			header: "Ação",
			cell: (info) => (
				<Badge variant="outline">{auditActionLabel(info.getValue())}</Badge>
			),
		}),
		columnHelper.accessor("entityType", {
			header: "Entidade",
			cell: (info) => (
				<span className="text-xs font-medium">
					{auditEntityLabel(info.getValue())}
				</span>
			),
		}),
		columnHelper.accessor("entityDescription", {
			header: "Descrição",
			cell: (info) => info.getValue() ?? "—",
		}),
		columnHelper.display({
			id: "user",
			header: "Usuário",
			cell: (info) =>
				info.row.original.user?.name ||
				info.row.original.user?.email ||
				info.row.original.userId,
		}),
		columnHelper.display({
			id: "actions",
			header: "Detalhe",
			cell: (info) => {
				const row = info.row.original;
				const target = row.navigationTarget;
				return (
					<div className="flex justify-end gap-1">
						<Button
							variant="outline"
							size="sm"
							onClick={() => onOpenDetail(row)}
						>
							Detalhe
						</Button>
						{target && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onOpenNavigationTarget(target)}
							>
								{target.label}
							</Button>
						)}
					</div>
				);
			},
		}),
	];
	const selectedModule =
		MODULE_OPTIONS.find(
			(option) => option.entities.join(",") === (filters.entityTypes ?? ""),
		)?.value ?? "";
	const selectedStatus =
		STATUS_OPTIONS.find(
			(option) => option.actions.join(",") === (filters.actions ?? ""),
		)?.value ?? "";
	const hasActiveFilters = Boolean(
		filters.entityType ||
			filters.entityTypes ||
			filters.action ||
			filters.actions ||
			filters.fromDate ||
			filters.toDate ||
			(showUserFilter && filters.userSearch),
	);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end gap-3">
				<Select
					value={selectedModule}
					onValueChange={(value) => {
						const option = MODULE_OPTIONS.find((item) => item.value === value);
						onFiltersChange({
							...filters,
							entityTypes: option?.entities.join(",") || undefined,
							entityType: undefined,
						});
					}}
				>
					<SelectTrigger className="w-full sm:w-48">
						<SelectValue placeholder="Módulo" />
					</SelectTrigger>
					<SelectContent>
						{MODULE_OPTIONS.map((option) => (
							<SelectItem key={option.value || "all"} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={selectedStatus}
					onValueChange={(value) => {
						const option = STATUS_OPTIONS.find((item) => item.value === value);
						onFiltersChange({
							...filters,
							actions: option?.actions.join(",") || undefined,
							action: undefined,
						});
					}}
				>
					<SelectTrigger className="w-full sm:w-44">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						{STATUS_OPTIONS.map((option) => (
							<SelectItem key={option.value || "all"} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={filters.action ?? ""}
					onValueChange={(value) =>
						onFiltersChange({
							...filters,
							action: value || undefined,
							actions: undefined,
						})
					}
				>
					<SelectTrigger className="w-full sm:w-48">
						<SelectValue placeholder="Ação" />
					</SelectTrigger>
					<SelectContent>
						{AUDIT_ACTION_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={filters.entityType ?? ""}
					onValueChange={(value) =>
						onFiltersChange({
							...filters,
							entityType: value || undefined,
						})
					}
				>
					<SelectTrigger className="w-full sm:w-56">
						<SelectValue placeholder="Interno" />
					</SelectTrigger>
					<SelectContent>
						{INTERNAL_OPTIONS.map((option) => (
							<SelectItem key={option.value || "all"} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Input
					type="date"
					value={filters.fromDate ?? ""}
					aria-label="Data inicial"
					className="w-full sm:w-40"
					onChange={(event) =>
						onFiltersChange({
							...filters,
							fromDate: event.target.value || undefined,
						})
					}
				/>
				<Input
					type="date"
					value={filters.toDate ?? ""}
					aria-label="Data final"
					className="w-full sm:w-40"
					onChange={(event) =>
						onFiltersChange({
							...filters,
							toDate: event.target.value || undefined,
						})
					}
				/>
				{showUserFilter && (
					<Input
						value={filters.userSearch ?? ""}
						placeholder="Usuário (e-mail ou nome)"
						className="w-full sm:w-64"
						onChange={(event) =>
							onFiltersChange({
								...filters,
								userSearch: event.target.value || undefined,
							})
						}
					/>
				)}
				<Button
					variant="outline"
					size="sm"
					disabled={!hasActiveFilters}
					onClick={() =>
						onFiltersChange({
							userSearch: showUserFilter ? undefined : filters.userSearch,
						})
					}
				>
					<RotateCcw className="mr-2 h-4 w-4" />
					Limpar filtros
				</Button>
			</div>

			{rows.length === 0 ? (
				<EmptyState
					icon={<ScrollText className="h-10 w-10" />}
					title="Nenhum registro de histórico"
					description="Nenhum registro corresponde aos filtros selecionados."
				/>
			) : (
				<DataTable
					columns={columns}
					data={rows}
					pageSize={Math.max(rows.length, 1)}
					searchPlaceholder="Buscar no histórico..."
					resultCountLabel={(count) => `${count} registro(s) nesta página`}
				/>
			)}

			<PaginationBar
				meta={{
					page,
					limit,
					total,
					totalPages: Math.max(1, Math.ceil(total / limit)),
					hasNextPage: page * limit < total,
					hasPreviousPage: page > 1,
				}}
				onPageChange={onPageChange}
			/>
		</div>
	);
}
