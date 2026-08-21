import { KpiCard } from "@/atoms/kpi-card";
import { KpiGrid } from "@/components/atoms/kpi-grid";
import type { CostCenterReportResponse } from "@/types/reports";
import { formatCurrency } from "@/utils/format";

type CostCenterReportKpisProps = {
	summary: CostCenterReportResponse["summary"];
};

export function CostCenterReportKpis({ summary }: CostCenterReportKpisProps) {
	const balanceTone =
		summary.balance < 0
			? "danger"
			: summary.balance > 0
				? "success"
				: "default";

	return (
		<KpiGrid>
			<KpiCard
				title="Orçamento Total"
				value={formatCurrency(summary.totalBudgeted)}
				tone="default"
			/>
			<KpiCard
				title="Total Gasto"
				value={formatCurrency(summary.totalSpent)}
				tone="success"
			/>
			<KpiCard
				title="Saldo"
				value={formatCurrency(summary.balance)}
				tone={balanceTone}
			/>
			<KpiCard
				title="Obras"
				value={String(summary.totalWorks)}
				tone="default"
			/>
		</KpiGrid>
	);
}
