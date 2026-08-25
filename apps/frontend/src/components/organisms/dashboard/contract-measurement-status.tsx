import { AlertCircle, CheckCircle, Clock, FileText } from "lucide-react";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Card, CardContent } from "@/components/ui/card";
import type { ContractSummaryResponse } from "@/types/contracts";
import { formatCurrency } from "@/utils/format";

interface ContractMeasurementStatusProps {
	summary: ContractSummaryResponse | undefined;
}

export function ContractMeasurementStatus({
	summary,
}: ContractMeasurementStatusProps) {
	if (!summary || summary.totalContracts === 0) return null;

	const measuredPct =
		summary.totalContractValue > 0
			? (summary.totalMeasuredValue / summary.totalContractValue) * 100
			: 0;
	const paidPct =
		summary.totalContractValue > 0
			? (summary.totalPaidValue / summary.totalContractValue) * 100
			: 0;

	return (
		<div className="rounded-xl border bg-card">
			<CardHeaderWithIcon
				icon={FileText}
				title="Status de Contratos e Medições"
				description={`${summary.operationalContracts} contrato(s) compondo os cálculos da obra · ${summary.pendingContracts} a iniciar`}
			/>
			<div className="px-6 pb-4">
				<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
					<Card>
						<CardContent className="flex items-center gap-3 p-4">
							<FileText className="h-8 w-8 text-muted-foreground" />
							<div>
								<p className="text-2xl font-bold">
									{summary.operationalContracts}
								</p>
								<p className="text-xs text-muted-foreground">Nos cálculos</p>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="flex items-center gap-3 p-4">
							<CheckCircle className="h-8 w-8 text-success" />
							<div>
								<p className="text-2xl font-bold">{summary.pendingContracts}</p>
								<p className="text-xs text-muted-foreground">A iniciar</p>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="flex items-center gap-3 p-4">
							<Clock className="h-8 w-8 text-warning" />
							<div>
								<p className="text-2xl font-bold">{summary.draftContracts}</p>
								<p className="text-xs text-muted-foreground">Rascunhos</p>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="flex items-center gap-3 p-4">
							<AlertCircle className="h-8 w-8 text-info" />
							<div>
								<p className="text-sm font-bold">
									{formatCurrency(summary.totalContractValue)}
								</p>
								<p className="text-xs text-muted-foreground">
									Valor operacional
								</p>
							</div>
						</CardContent>
					</Card>
				</div>
				<div className="mt-4 grid grid-cols-2 gap-4">
					<div className="rounded-lg bg-muted/40 p-3">
						<p className="text-xs text-muted-foreground">Valor Medido</p>
						<p className="text-lg font-bold">
							{formatCurrency(summary.totalMeasuredValue)}
						</p>
						<div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-[var(--color-chart-2)]"
								style={{ width: `${measuredPct}%` }}
							/>
						</div>
					</div>
					<div className="rounded-lg bg-muted/40 p-3">
						<p className="text-xs text-muted-foreground">Valor Pago</p>
						<p className="text-lg font-bold">
							{formatCurrency(summary.totalPaidValue)}
						</p>
						<div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-[var(--color-chart-1)]"
								style={{ width: `${paidPct}%` }}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
