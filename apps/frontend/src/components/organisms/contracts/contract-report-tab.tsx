import { BarChart3 } from "lucide-react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type {
	ContractAggregateResponse,
	ContractAggregateService,
} from "@/api/contract-measurements";
import { KpiCard } from "@/atoms/kpi-card";
import { KpiGrid } from "@/atoms/kpi-grid";
import {
	PAYMENT_STATUS_MAP,
	StatusBadge,
} from "@/components/atoms/status-badge";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import {
	CHART_COLORS_ARRAY,
	CHART_THEME,
	DEFAULT_MARGIN,
} from "@/components/organisms/charts/chart-config";
import { ChartTooltip } from "@/components/organisms/charts/chart-tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	formatCurrency,
	formatDate,
	formatRatioAsPercentage,
	labelFor,
	SERVICE_TYPE_LABEL,
} from "@/utils/format";

type ContractReportTabProps = {
	aggregate: ContractAggregateResponse;
};

function serviceValue(service: ContractAggregateService): number {
	return service.contractValue ?? service.totalCost ?? 0;
}

function renderServiceRow(service: ContractAggregateService) {
	const contractValue = serviceValue(service);
	return (
		<TableRow key={service.id}>
			<TableCell className="font-mono text-xs text-muted-foreground">
				{labelFor(service.type, SERVICE_TYPE_LABEL)}
			</TableCell>
			<TableCell>{service.description}</TableCell>
			<TableCell className="text-right font-medium">
				{formatCurrency(contractValue)}
			</TableCell>
		</TableRow>
	);
}

export function ContractReportTab({ aggregate }: ContractReportTabProps) {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeaderWithIcon
					icon={BarChart3}
					title="Relatório do Contrato"
					description="Métricas financeiras consolidadas."
				/>
				<CardContent>
					<KpiGrid>
						<KpiCard
							title="Valor do Contrato"
							value={formatCurrency(aggregate.totals.totalContracted)}
							tone="default"
						/>
						<KpiCard
							title="Total dos Serviços"
							value={formatCurrency(aggregate.totals.totalServicesValue)}
							tone="default"
						/>
						<KpiCard
							title="Total Medido"
							value={formatCurrency(aggregate.totals.totalMeasured)}
							tone="success"
						/>
						<KpiCard
							title="Total Pago"
							value={formatCurrency(aggregate.totals.totalPaid)}
							tone="default"
						/>
						<KpiCard
							title="Retenções"
							value={formatCurrency(aggregate.totals.retentionTotal)}
							tone="warning"
						/>
						<KpiCard
							title="Descontos"
							value={formatCurrency(aggregate.totals.discountTotal)}
							tone="warning"
						/>
						<KpiCard
							title="Saldo"
							value={formatCurrency(aggregate.totals.balance)}
							tone={
								aggregate.totals.balance > 0
									? "success"
									: aggregate.totals.balance < 0
										? "danger"
										: "warning"
							}
						/>
						<KpiCard
							title="% Medido"
							value={formatRatioAsPercentage(
								aggregate.totals.measuredPercentage,
							)}
							tone="default"
						/>
					</KpiGrid>
					{aggregate.totals.totalContracted !==
						aggregate.totals.totalServicesValue && (
						<Alert className="mt-4">
							<AlertTitle>
								Divergência entre valor do contrato e serviços
							</AlertTitle>
							<AlertDescription>
								O valor do contrato (
								{formatCurrency(aggregate.totals.totalContracted)}) difere da
								soma dos serviços cadastrados (
								{formatCurrency(aggregate.totals.totalServicesValue)}) em{" "}
								{formatCurrency(
									Math.abs(
										aggregate.totals.totalContracted -
											aggregate.totals.totalServicesValue,
									),
								)}
								. Revise o valor contratado ou os serviços cadastrados.
							</AlertDescription>
						</Alert>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={BarChart3}
					title="Orçado vs Medido por Serviço"
					description="Comparativo entre valor contratado e medido por serviço."
				/>
				<CardContent>
					<ResponsiveContainer width="100%" height={300}>
						<BarChart
							data={aggregate.services
								.filter((service) => serviceValue(service) > 0)
								.slice(0, 15)
								.map((service) => {
									const contractValue = serviceValue(service);
									return {
										name: service.description.slice(0, 30),
										contratado: contractValue,
										medido: service.measuredAccumulated ?? 0,
									};
								})}
							margin={DEFAULT_MARGIN}
						>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke={CHART_THEME.gridColor}
								vertical={false}
							/>
							<XAxis
								dataKey="name"
								tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
								axisLine={false}
								tickLine={false}
								angle={-20}
								textAnchor="end"
								height={60}
							/>
							<YAxis
								tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
								axisLine={false}
								tickLine={false}
							/>
							<Tooltip
								content={
									<ChartTooltip
										formatter={(value: number) => [formatCurrency(value), ""]}
									/>
								}
							/>
							<Legend />
							<Bar
								dataKey="contratado"
								fill={CHART_COLORS_ARRAY[0]}
								radius={[4, 4, 0, 0]}
								maxBarSize={32}
								name="Contratado"
							/>
							<Bar
								dataKey="medido"
								fill={CHART_COLORS_ARRAY[1]}
								radius={[4, 4, 0, 0]}
								maxBarSize={32}
								name="Medido"
							/>
						</BarChart>
					</ResponsiveContainer>
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={BarChart3}
					title="Serviços do Contrato"
					description="Lista de serviços contratados."
				/>
				<CardContent>
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Tipo</TableHead>
									<TableHead>Descrição</TableHead>
									<TableHead className="text-right">Valor</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{aggregate.services.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={3}
											className="py-8 text-center text-muted-foreground"
										>
											Nenhum serviço cadastrado.
										</TableCell>
									</TableRow>
								) : (
									aggregate.services.map((service) => renderServiceRow(service))
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			{aggregate.payments.length > 0 && (
				<Card>
					<CardHeaderWithIcon
						icon={BarChart3}
						title="Histórico de Pagamentos"
						description="Pagamentos registrados para este contrato."
					/>
					<CardContent>
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Data</TableHead>
										<TableHead>Descrição</TableHead>
										<TableHead className="text-right">Valor</TableHead>
										<TableHead className="text-right">Valor Pago</TableHead>
										<TableHead>Status</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{aggregate.payments.map((payment) => (
										<TableRow key={payment.id}>
											<TableCell>{formatDate(payment.date)}</TableCell>
											<TableCell>{payment.description || "—"}</TableCell>
											<TableCell className="text-right">
												{formatCurrency(payment.value)}
											</TableCell>
											<TableCell className="text-right">
												{formatCurrency(payment.paidValue)}
											</TableCell>
											<TableCell>
												<StatusBadge
													status={payment.status}
													map={PAYMENT_STATUS_MAP}
												/>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
