import { KpiCard } from "@/components/atoms/kpi-card";
import { KpiGrid } from "@/components/atoms/kpi-grid";
import type { BudgetSummary } from "@/types/budget";
import { formatCurrency } from "@/utils/format";

interface BudgetKpiCardsProps {
	summary: BudgetSummary;
	effectiveTotal?: number;
	workId?: string;
}

export function BudgetKpiCards({
	summary,
	effectiveTotal,
}: BudgetKpiCardsProps) {
	const totalDirectCost =
		summary.totalDirectCost ?? effectiveTotal ?? summary.totalBudgeted;
	const totalFinalPrice = summary.totalFinalPrice ?? totalDirectCost;

	return (
		<KpiGrid>
			<KpiCard
				title="Total orcado"
				value={formatCurrency(effectiveTotal ?? summary.totalBudgeted)}
				tone="default"
			/>
			<KpiCard
				title="Custo direto"
				value={formatCurrency(totalDirectCost)}
				tone="default"
			/>
			<KpiCard
				title={`BDI (${summary.bdiPercentage}%)`}
				value={formatCurrency(summary.bdiValue)}
				tone="default"
			/>
			<KpiCard
				title="Preço final"
				value={formatCurrency(totalFinalPrice)}
				tone="success"
			/>
			<KpiCard
				title="Total medido"
				value={formatCurrency(summary.totalMeasured)}
				tone="default"
			/>
			<KpiCard
				title="Saldo a medir"
				value={formatCurrency(summary.balanceToMeasure)}
				tone="warning"
			/>
		</KpiGrid>
	);
}
