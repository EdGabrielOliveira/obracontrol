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
				tooltip="Soma dos valores dos itens da versão de orçamento efetiva."
			/>
			<KpiCard
				title="Custo direto"
				value={formatCurrency(totalDirectCost)}
				tone="default"
				tooltip="Valor orçado antes da aplicação do BDI."
			/>
			<KpiCard
				title={`BDI (${summary.bdiPercentage}%)`}
				value={formatCurrency(summary.bdiValue)}
				tone="default"
				tooltip="Valor do BDI calculado pela taxa configurada sobre a base de custo elegível."
			/>
			<KpiCard
				title="Preço final"
				value={formatCurrency(totalFinalPrice)}
				tone="success"
				tooltip="Custo direto acrescido do valor de BDI."
			/>
			<KpiCard
				title="Total medido"
				value={formatCurrency(summary.totalMeasured)}
				tone="default"
				tooltip="Valor financeiro acumulado das medições registradas para os itens do orçamento."
			/>
			<KpiCard
				title="Saldo a medir"
				value={formatCurrency(summary.balanceToMeasure)}
				tone="warning"
				tooltip="Valor ainda não medido: total orçado menos o total medido."
			/>
		</KpiGrid>
	);
}
