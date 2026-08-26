import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import {
	ArrowUpRight,
	BarChart3,
	FileText,
	MoreHorizontal,
	Plus,
	Trash2,
} from "lucide-react";
import { DataTable } from "@/components/atoms/data-table";
import { DropDownMenu } from "@/components/molecules/DropdownMenu/DropDownMenu";
import type { Organization } from "@/types/organizations";

interface OrgTableProps {
	organizations: Organization[];
	searchValue?: string;
	onSearchChange?: (value: string) => void;
	onDelete?: (organization: Organization) => void;
	showCompany?: boolean;
}

const helper = createColumnHelper<Organization>();

export function OrgTable({
	organizations,
	searchValue,
	onSearchChange,
	onDelete,
	showCompany = false,
}: OrgTableProps) {
	const columns = [
		helper.accessor("name", {
			header: "Nome",
			cell: (info) => (
				<Link
					to="/app/organizacoes/$orgId"
					params={{ orgId: info.row.original.id }}
					className="link-navigation"
					data-no-row-click
				>
					{info.getValue()}
				</Link>
			),
			meta: { mobileLabel: "Nome" },
		}),
		...(showCompany
			? [
					helper.accessor((row) => row.company?.name ?? "-", {
						id: "company",
						header: "Empresa",
						meta: { mobileLabel: "Empresa" },
					}),
				]
			: []),
		helper.accessor((row) => row._count?.costCenters ?? 0, {
			id: "ccCount",
			header: "Centros de Custo",
			cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
			meta: { mobileLabel: "CCs" },
		}),
		helper.display({
			id: "actions",
			header: () => <span className="sr-only">Ações</span>,
			cell: (info) => {
				const organization = info.row.original;
				const { id: orgId, name } = organization;
				return (
					<DropDownMenu
						ariaLabel={`Ações para ${name}`}
						targetMenu={<MoreHorizontal className="h-4 w-4" />}
						menuItems={[
							{
								label: "Abrir organização",
								icon: <ArrowUpRight className="h-4 w-4" />,
								to: "/app/organizacoes/$orgId",
								params: { orgId },
							},
							{
								label: "Relatórios",
								icon: <FileText className="h-4 w-4" />,
								to: "/app/organizacoes/$orgId/relatorios",
								params: { orgId },
							},
							{
								label: "MultiCentros",
								icon: <BarChart3 className="h-4 w-4" />,
								to: "/app/organizacoes/$orgId/multicentros",
								params: { orgId },
							},
							{
								label: "Cadastrar centro",
								icon: <Plus className="h-4 w-4" />,
								to: "/app/organizacoes/$orgId",
								params: { orgId },
								search: { createCostCenter: true },
							},
							onDelete
								? {
										label: "Excluir organização",
										icon: <Trash2 className="h-4 w-4" />,
										onClick: () => onDelete(organization),
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
			data={organizations}
			searchValue={searchValue}
			onSearchChange={onSearchChange}
			searchPlaceholder="Buscar órgãos..."
		/>
	);
}
