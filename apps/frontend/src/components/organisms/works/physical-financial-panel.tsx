import { BarChart3 } from "lucide-react";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { PhysicalFinancialChart } from "@/components/organisms/charts/physical-financial-chart";
import { PhysicalFinancialTable } from "@/components/organisms/charts/physical-financial-table";
import { Card, CardContent } from "@/components/ui/card";
import type { SchedulePhysicalFinancialResponse } from "@/types/schedule";

interface PhysicalFinancialPanelProps {
	data: SchedulePhysicalFinancialResponse | null | undefined;
	period: "monthly" | "biweekly" | "weekly";
	onPeriodChange: (period: "monthly" | "biweekly" | "weekly") => void;
}

export function PhysicalFinancialPanel({
	data,
	period,
	onPeriodChange,
}: PhysicalFinancialPanelProps) {
	return (
		<Card>
			<CardHeaderWithIcon
				icon={BarChart3}
				title="Físico-Financeiro"
				description="Evolução física e financeira da obra."
			/>
			<CardContent>
				<div className="mb-4 flex items-center gap-2">
					<span className="text-sm text-muted-foreground">Período:</span>
					<select
						value={period}
						onChange={(e) =>
							onPeriodChange(
								e.target.value as "monthly" | "biweekly" | "weekly",
							)
						}
						className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm"
					>
						<option value="monthly">Mensal</option>
						<option value="biweekly">Quinzenal</option>
						<option value="weekly">Semanal</option>
					</select>
				</div>
				<PhysicalFinancialChart data={data} period={period} />
				<PhysicalFinancialTable data={data} period={period} />
			</CardContent>
		</Card>
	);
}
