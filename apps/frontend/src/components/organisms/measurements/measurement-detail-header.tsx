import type { ReactNode } from "react";
import { KpiCard } from "@/atoms/kpi-card";
import { KpiGrid } from "@/components/atoms/kpi-grid";
import { PageHeader } from "@/components/atoms/page-header";
import { formatCurrency, formatDate } from "@/utils/format";

type MeasurementDetailHeaderProps = {
	number: number;
	title: string;
	date: string;
	totalMeasuredValue: number;

	currentMeasuredValue?: number;
	discountValue: number | null;
	retentionValue: number | null;
	actions?: ReactNode;
};

export function MeasurementDetailHeader({
	number,
	title,
	date,
	totalMeasuredValue,
	currentMeasuredValue,
	discountValue,
	retentionValue,
	actions,
}: MeasurementDetailHeaderProps) {
	return (
		<>
			<PageHeader
				eyebrow={`Medição #${number}`}
				title={title}
				description={formatDate(date)}
				actions={actions}
			/>
			<KpiGrid>
				<KpiCard
					title="Total Medido"
					value={formatCurrency(currentMeasuredValue ?? totalMeasuredValue)}
					tone="success"
				/>
				<KpiCard
					title="Desconto"
					value={formatCurrency(discountValue ?? 0)}
					tone="warning"
				/>
				<KpiCard
					title="Retenção"
					value={formatCurrency(retentionValue ?? 0)}
					tone="warning"
				/>
			</KpiGrid>
		</>
	);
}
