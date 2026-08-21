import { FileSpreadsheet } from "lucide-react";
import { EmptyStateCard } from "@/components/atoms/empty-state-card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { BudgetViewResponse } from "@/types/budget";
import { formatCurrency } from "@/utils/format";
import {
	formatPeriodLabel,
	type SchedulePeriod,
} from "@/utils/schedule-period";

interface PhysicalFinancialTableProps {
	data:
		| Pick<BudgetViewResponse["physicalFinancial"], "totals">
		| null
		| undefined;
	period: SchedulePeriod;
}

export function PhysicalFinancialTable({
	data,
	period,
}: PhysicalFinancialTableProps) {
	if (!data?.totals || data.totals.months.length === 0) {
		return (
			<EmptyStateCard
				icon={FileSpreadsheet}
				title="Nenhum cronograma físico-financeiro"
				description="Configure o cronograma base para visualizar os dados físico-financeiros."
			/>
		);
	}

	return (
		<div className="overflow-x-auto">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Período</TableHead>
						<TableHead className="text-right">Planejado</TableHead>
						<TableHead className="text-right">Medido</TableHead>
						<TableHead className="text-right">Realizado</TableHead>
						<TableHead className="text-right">Planejado Acum.</TableHead>
						<TableHead className="text-right">Medido Acum.</TableHead>
						<TableHead className="text-right">Realizado Acum.</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{data.totals.months.map((month: string, i: number) => (
						<TableRow key={month}>
							<TableCell className="capitalize">
								{formatPeriodLabel(month, period)}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{data.totals.plannedByMonth[i] != null
									? formatCurrency(data.totals.plannedByMonth[i])
									: "-"}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{data.totals.measuredByMonth[i] != null
									? formatCurrency(data.totals.measuredByMonth[i])
									: "-"}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{data.totals.actualByMonth?.[i] != null
									? formatCurrency(data.totals.actualByMonth[i])
									: "-"}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{data.totals.plannedAccumulated[i] != null
									? formatCurrency(data.totals.plannedAccumulated[i])
									: "-"}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{data.totals.measuredAccumulated[i] != null
									? formatCurrency(data.totals.measuredAccumulated[i])
									: "-"}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{data.totals.actualAccumulated?.[i] != null
									? formatCurrency(data.totals.actualAccumulated[i])
									: "-"}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
