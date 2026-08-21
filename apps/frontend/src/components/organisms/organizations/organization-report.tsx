import { Building2 } from "lucide-react";
import { KpiCard } from "@/atoms/kpi-card";
import { DataSection } from "@/components/atoms/data-section";
import { KpiGrid } from "@/components/atoms/kpi-grid";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { OrganizationReportResponse } from "@/types/reports";
import { formatCurrency } from "@/utils/format";

interface OrganizationReportProps {
	data: OrganizationReportResponse;
}

export function OrganizationReport({ data }: OrganizationReportProps) {
	const { organization, summary, costCenters } = data;
	const hasCostCenters = Array.isArray(costCenters) && costCenters.length > 0;

	return (
		<div className="space-y-6">
			<p className="text-lg font-semibold text-foreground">
				{organization.name}
			</p>

			<KpiGrid>
				<KpiCard
					title="Centros de custo"
					value={String(summary.totalCostCenters)}
					tone="default"
				/>
				<KpiCard
					title="Obras"
					value={String(summary.totalWorks)}
					tone="default"
				/>
				<KpiCard
					title="Orçado"
					value={formatCurrency(summary.totalBudgeted)}
					tone="default"
				/>
				<KpiCard
					title="Gasto"
					value={formatCurrency(summary.totalSpent)}
					tone="success"
				/>
				<KpiCard
					title="Saldo"
					value={formatCurrency(summary.balance)}
					tone={summary.balance < 0 ? "danger" : "default"}
				/>
			</KpiGrid>

			{hasCostCenters && (
				<DataSection
					icon={Building2}
					title="Centros de Custo"
					description={`${costCenters.length} centro(s) de custo`}
				>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Nome</TableHead>
								<TableHead className="text-right">Obras</TableHead>
								<TableHead className="text-right">Orçado</TableHead>
								<TableHead className="text-right">Gasto</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{costCenters.map((cc) => (
								<TableRow key={cc.id ?? cc.name}>
									<TableCell>{cc.name}</TableCell>
									<TableCell className="text-right">{cc.works}</TableCell>
									<TableCell className="text-right">
										{formatCurrency(cc.budgeted)}
									</TableCell>
									<TableCell className="text-right">
										{formatCurrency(cc.spent)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</DataSection>
			)}
		</div>
	);
}
