import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpRight, MoreHorizontal, Settings, Trash2 } from "lucide-react";
import { StatusBadge } from "@/atoms/status-badge";
import { DataTable } from "@/components/atoms/data-table";
import { DropDownMenu } from "@/components/molecules/DropdownMenu/DropDownMenu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import {
	classifyIndex,
	HEALTH_TONE,
	type HealthTone,
} from "@/utils/evm-health";
import { formatCurrency, formatRatioAsPercentage } from "@/utils/format";
import type { WorkListingRow } from "@/utils/hierarchy-listing";

interface WorkTableProps {
	works: WorkListingRow[];
	showParentColumns?: boolean;
	pageSize?: number;
	searchValue?: string;
	onSearchChange?: (value: string) => void;
	onDelete?: (work: WorkListingRow) => void;
}

const helper = createColumnHelper<WorkListingRow>();

function getWorkHealth(work: WorkListingRow): {
	label: string;
	tone: HealthTone;
} {
	const tones = [
		classifyIndex(work.schedulePerformanceIndex),
		classifyIndex(work.costPerformanceIndex),
	];

	if (tones.includes("critical")) return { label: "Crítica", tone: "critical" };
	if (tones.includes("attention")) {
		return { label: "Atenção", tone: "attention" };
	}
	if (tones.includes("unknown")) return { label: "Sem dados", tone: "unknown" };
	return { label: "Saudável", tone: "good" };
}

export function buildWorkDetailTarget(work: Pick<WorkListingRow, "id">) {
	return {
		to: "/app/obras/$workId" as const,
		params: { workId: work.id },
	};
}

export function WorkTable({
	works,
	showParentColumns = false,
	pageSize = 10,
	searchValue,
	onSearchChange,
	onDelete,
}: WorkTableProps) {
	const { role } = useAuth();
	const canViewManagement = role !== "SUPERVISOR";
	const columns = [
		helper.accessor("name", {
			header: "Obra",
			cell: (info) => {
				const { id: workId } = info.row.original;
				if (workId) {
					return (
						<Link
							to="/app/obras/$workId"
							params={{ workId }}
							className="link-navigation"
							data-no-row-click
						>
							{info.getValue()}
						</Link>
					);
				}
				return <span className="font-medium">{info.getValue()}</span>;
			},
			meta: { mobileLabel: "Obra" },
		}),
		...(showParentColumns
			? [
					helper.accessor("costCenterName", {
						header: "CC Pai",
						cell: (info) => (
							<span className="font-medium text-foreground">
								{info.getValue() || "—"}
							</span>
						),
						meta: { mobileLabel: "CC Pai" },
					}),
				]
			: []),
		helper.display({
			id: "health",
			header: "Saúde",
			cell: (info) => {
				const health = getWorkHealth(info.row.original);
				return (
					<Badge variant="tag" tone={HEALTH_TONE[health.tone].badge}>
						{health.label}
					</Badge>
				);
			},
			meta: { mobileLabel: "Saúde" },
		}),
		helper.accessor("activeBudget", {
			header: "Orçamento",
			cell: (info) => (
				<span className="tabular-nums">{formatCurrency(info.getValue())}</span>
			),
			meta: { mobileLabel: "Orçamento" },
		}),
		helper.accessor("measuredPercentage", {
			header: "% Medido",
			cell: (info) => (
				<span className="tabular-nums">
					{formatRatioAsPercentage(info.getValue())}
				</span>
			),
			meta: { mobileLabel: "% Medido" },
		}),
		helper.accessor("scheduleRisk", {
			header: "Prazo",
			cell: (info) => {
				const risk = info.getValue();
				const riskConfig: Record<
					string,
					{
						label: string;
						variant: "default" | "secondary" | "destructive" | "outline";
					}
				> = {
					AHEAD: { label: "Adiantada", variant: "default" },
					BEHIND: { label: "Atrasada", variant: "destructive" },
					ON_TRACK: { label: "No prazo", variant: "secondary" },
				};
				const config = riskConfig[risk] ?? {
					label: "—",
					variant: "outline" as const,
				};
				return <Badge variant={config.variant}>{config.label}</Badge>;
			},
			meta: { mobileLabel: "Prazo" },
		}),
		helper.accessor("computedStatus", {
			header: "Status",
			cell: (info) => <StatusBadge status={info.getValue()} />,
			meta: { mobileLabel: "Status" },
		}),
		helper.display({
			id: "actions",
			header: () => <span className="sr-only">Ações</span>,
			cell: (info) => {
				const work = info.row.original;
				const { id: workId, name } = work;
				return (
					<DropDownMenu
						ariaLabel={`Ações para ${name}`}
						targetMenu={<MoreHorizontal className="h-4 w-4" />}
						menuItems={[
							{
								label: "Abrir obra",
								icon: <ArrowUpRight className="h-4 w-4" />,
								to: "/app/obras/$workId",
								params: { workId },
							},
							...(canViewManagement
								? [
										{
											label: "Configurações",
											icon: <Settings className="h-4 w-4" />,
											to: "/app/obras/$workId/configuracoes" as const,
											params: { workId },
										},
									]
								: []),
							...(onDelete
								? [
										{
											label: "Excluir obra",
											icon: <Trash2 className="h-4 w-4" />,
											onClick: () => onDelete(work),
											variant: "destructive" as const,
										},
									]
								: []),
						]}
					/>
				);
			},
			meta: { hideOnMobile: true },
		}),
	];

	return (
		<DataTable
			columns={columns}
			data={works}
			searchPlaceholder="Buscar obras..."
			searchValue={searchValue}
			onSearchChange={onSearchChange}
			pageSize={pageSize}
		/>
	);
}
