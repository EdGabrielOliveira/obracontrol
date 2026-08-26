import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import {
	ArrowUpRight,
	BarChart3,
	FileText,
	MoreHorizontal,
	Trash2,
} from "lucide-react";
import { DataTable } from "@/components/atoms/data-table";
import { DropDownMenu } from "@/components/molecules/DropdownMenu/DropDownMenu";
import type { CostCenterListingRow } from "@/utils/hierarchy-listing";

interface CostCenterTableProps {
	costCenters: CostCenterListingRow[];
	showParentColumn?: boolean;
	searchValue?: string;
	onSearchChange?: (value: string) => void;
	onDelete?: (costCenter: CostCenterListingRow) => void;
	canManageStructure?: boolean;
}

const helper = createColumnHelper<CostCenterListingRow>();

export function CostCenterTable({
	costCenters,
	showParentColumn = false,
	searchValue,
	onSearchChange,
	onDelete,
	canManageStructure = true,
}: CostCenterTableProps) {
	const columns = [
		helper.accessor("name", {
			header: "Nome",
			cell: (info) => {
				const { id: ccId } = info.row.original;
				if (ccId) {
					return (
						<Link
							to="/app/centros-de-custo/$ccId"
							params={{ ccId }}
							className="link-navigation"
							data-no-row-click
						>
							{info.getValue()}
						</Link>
					);
				}
				return <span className="font-medium">{info.getValue()}</span>;
			},
			meta: { mobileLabel: "Nome" },
		}),
		...(showParentColumn
			? [
					helper.accessor("organizationName", {
						header: "Orgão Pai",
						cell: (info) => (
							<span className="font-medium text-foreground">
								{info.getValue() || "—"}
							</span>
						),
						meta: { mobileLabel: "Orgão Pai" },
					}),
				]
			: []),
		helper.display({
			id: "actions",
			header: () => <span className="sr-only">Ações</span>,
			cell: (info) => {
				const costCenter = info.row.original;
				const { id: ccId, name } = costCenter;
				return (
					<DropDownMenu
						ariaLabel={`Ações para ${name}`}
						targetMenu={<MoreHorizontal className="h-4 w-4" />}
						menuItems={[
							{
								label: "Abrir centro",
								icon: <ArrowUpRight className="h-4 w-4" />,
								to: "/app/centros-de-custo/$ccId",
								params: { ccId },
							},
							{
								label: "Relatórios",
								icon: <FileText className="h-4 w-4" />,
								to: "/app/centros-de-custo/$ccId/relatorios",
								params: { ccId },
							},
							{
								label: "MultiObras",
								icon: <BarChart3 className="h-4 w-4" />,
								to: "/app/centros-de-custo/$ccId/multiobras",
								params: { ccId },
							},
							canManageStructure && onDelete
								? {
										label: "Excluir centro de custo",
										icon: <Trash2 className="h-4 w-4" />,
										onClick: () => onDelete(costCenter),
										variant: "destructive" as const,
									}
								: null,
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
			data={costCenters}
			searchValue={searchValue}
			onSearchChange={onSearchChange}
			searchPlaceholder="Buscar centros de custo..."
		/>
	);
}
