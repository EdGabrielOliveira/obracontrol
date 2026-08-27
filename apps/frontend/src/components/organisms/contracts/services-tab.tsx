import { createColumnHelper } from "@tanstack/react-table";
import { BarChart3, Link2, ListChecks, TrendingDown } from "lucide-react";
import { DataTable } from "@/atoms/data-table";
import { ErrorFeedback } from "@/components/atoms/error-feedback";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Card, CardContent } from "@/components/ui/card";
import type { VersionChangeInfo } from "@/lib/budget-version-diff";
import type {
	ContractQuotationSnapshot,
	ContractService,
} from "@/types/contracts";
import {
	calculateBillingPercentage,
	calculateContractPlannedTotal,
} from "@/utils/contract-financials";
import { formatCurrency, labelFor, SERVICE_TYPE_LABEL } from "@/utils/format";

interface ServicesTabProps {
	workId: string;
	contractId: string;
	services?: ContractService[];
	isLoading?: boolean;
	budgetVersionChanges?: ReadonlyMap<string, VersionChangeInfo>;
	contractValue?: number;
	quotation?: ContractQuotationSnapshot | null;
}

export function ServicesTab({
	services: externalServices,
	isLoading: externalLoading,
	budgetVersionChanges,
	contractValue = 0,
	quotation,
}: ServicesTabProps) {
	const services = externalServices ?? [];
	const budgetTotal = calculateContractPlannedTotal(services);
	const negotiatedValue = Number(
		contractValue || quotation?.negotiatedValue || 0,
	);
	const billingPercentage = calculateBillingPercentage(
		negotiatedValue,
		budgetTotal,
	);
	const originalQuotationValue = quotation?.originalProposalValue ?? null;
	const budgetReductionAmount = budgetTotal - negotiatedValue;
	const budgetReductionPercent =
		budgetTotal > 0 ? (budgetReductionAmount / budgetTotal) * 100 : null;
	const quotationReductionPercent =
		quotation?.negotiationReductionPercent ?? null;
	const quotationReductionAmount =
		quotation?.negotiationReductionAmount ??
		(originalQuotationValue != null
			? Math.max(0, originalQuotationValue - negotiatedValue)
			: null);
	const chartRows = [
		{ label: "Orçamento planejado", value: budgetTotal, color: "bg-muted" },
		...(originalQuotationValue != null
			? [
					{
						label: "Cotação original",
						value: originalQuotationValue,
						color: "bg-status-warning",
					},
				]
			: []),
		{
			label: "Contrato negociado",
			value: negotiatedValue,
			color: "bg-status-success",
		},
	];
	const chartMax = Math.max(...chartRows.map((row) => row.value), 1);
	const servicesHelper = createColumnHelper<ContractService>();
	const servicesColumns = [
		servicesHelper.accessor("type", {
			header: "Tipo",
			cell: (info) => (
				<span className="text-xs">
					{info.getValue()
						? labelFor(info.getValue(), SERVICE_TYPE_LABEL)
						: "-"}
				</span>
			),
			meta: { mobileLabel: "Tipo" },
		}),
		servicesHelper.accessor("description", {
			header: "Descrição",
			meta: { mobileLabel: "Descrição" },
		}),
		servicesHelper.accessor("budgetItemId", {
			header: "Vínculo",
			cell: (info) => {
				const service = info.row.original;
				const change = service.budgetItem
					? budgetVersionChanges?.get(service.budgetItem.index)
					: undefined;
				return service.budgetItemId ? (
					<div className="flex items-center gap-1">
						<Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
						<span className="max-w-[180px] truncate text-xs">
							{service.budgetItem?.displayIndex ?? service.budgetItem?.index}{" "}
							{service.budgetItem?.description}
						</span>
						{change ? (
							<span className="text-xs text-muted-foreground">
								({change.kind === "NEW" ? "Novo" : "Alterado"})
							</span>
						) : null}
					</div>
				) : (
					<span className="text-xs text-destructive">
						Sem vinculo orcamentario
					</span>
				);
			},
			meta: { mobileLabel: "Vínculo" },
		}),
		servicesHelper.accessor("unit", {
			header: "Unid. orçamento",
			cell: (info) =>
				info.row.original.budgetItem?.unit ?? info.getValue() ?? "-",
			meta: { mobileLabel: "Unid. orçamento" },
		}),
		servicesHelper.accessor("quantity", {
			header: "Qtd. orçamento",
			cell: (info) =>
				info.row.original.budgetItem?.quantity ?? info.getValue() ?? "-",
			meta: { className: "text-right", mobileLabel: "Qtd. orçamento" },
		}),
		servicesHelper.accessor("unitCost", {
			header: "Custo unit. orçamento",
			cell: (info) => {
				const value = info.row.original.budgetItem?.unitCost ?? info.getValue();
				return value != null ? formatCurrency(Number(value)) : "-";
			},
			meta: { className: "text-right", mobileLabel: "Custo unit. orçamento" },
		}),
		servicesHelper.accessor("totalCost", {
			header: "Total orçamento",
			cell: (info) => {
				const value =
					info.row.original.budgetItem?.totalCost ?? info.getValue();
				return value != null ? formatCurrency(Number(value)) : "-";
			},
			meta: {
				className: "text-right font-medium",
				mobileLabel: "Total orçamento",
			},
		}),
		servicesHelper.display({
			id: "contractQuantity",
			header: "Qtd. contrato",
			cell: (info) => info.row.original.quantity ?? "-",
			meta: { className: "text-right", mobileLabel: "Qtd. contrato" },
		}),
	];

	if (externalLoading)
		return (
			<div className="py-8 text-center text-muted-foreground">
				Carregando serviços...
			</div>
		);
	if (!externalServices) return <ErrorFeedback />;

	return (
		<Card>
			<CardHeaderWithIcon
				icon={ListChecks}
				title="Serviços do contrato"
				description="Atividades do orçamento com os custos planejados e o resultado da negociação."
			/>
			<CardContent>
				<div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
					<div className="rounded-lg border bg-muted p-4">
						<p className="text-xs font-medium text-muted-foreground">
							Orçamento planejado
						</p>
						<p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
							{formatCurrency(budgetTotal)}
						</p>
					</div>
					<div className="rounded-lg border bg-muted p-4">
						<p className="text-xs font-medium text-muted-foreground">
							Faturamento previsto
						</p>
						<p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
							{billingPercentage == null
								? "-"
								: `${billingPercentage.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`}
						</p>
						<p className="text-xs text-muted-foreground">
							Contrato negociado ÷ orçamento planejado
						</p>
					</div>
					{originalQuotationValue != null ? (
						<div className="status-warning rounded-lg p-4">
							<p className="text-xs font-medium">Cotação original</p>
							<p className="mt-1 text-xl font-semibold tabular-nums">
								{formatCurrency(originalQuotationValue)}
							</p>
						</div>
					) : null}
					<div className="status-success rounded-lg p-4">
						<p className="text-xs font-medium">Contrato negociado</p>
						<p className="mt-1 text-xl font-semibold tabular-nums">
							{formatCurrency(negotiatedValue)}
						</p>
					</div>
					<div
						className={`rounded-lg p-4 ${budgetReductionAmount >= 0 ? "status-success" : "status-danger"}`}
					>
						<p className="flex items-center gap-1 text-xs font-medium">
							<TrendingDown className="h-3.5 w-3.5" />
							Redução contra orçamento
						</p>
						<p className="mt-1 text-xl font-semibold tabular-nums">
							{formatCurrency(Math.abs(budgetReductionAmount))}
						</p>
						<p className="text-xs">
							{budgetReductionPercent == null
								? "Sem base orçamentária"
								: `${Math.abs(budgetReductionPercent).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% ${budgetReductionAmount >= 0 ? "de economia" : "acima"}`}
						</p>
					</div>
				</div>

				<div className="mb-6 rounded-lg border p-4">
					<div className="mb-3 flex items-center gap-2">
						<BarChart3 className="h-4 w-4 text-primary" />
						<div>
							<h3 className="text-sm font-semibold">
								Planejado x cotado x contratado
							</h3>
							<p className="text-xs text-muted-foreground">
								Valores consolidados dos itens do orçamento e da negociação.
							</p>
						</div>
					</div>
					<div className="space-y-3">
						{chartRows.map((row) => (
							<div key={row.label} className="space-y-1">
								<div className="flex justify-between gap-3 text-xs">
									<span>{row.label}</span>
									<span className="font-medium tabular-nums">
										{formatCurrency(row.value)}
									</span>
								</div>
								<div className="h-3 overflow-hidden rounded-full bg-muted">
									<div
										className={`h-full rounded-full ${row.color}`}
										style={{
											width: `${Math.max(3, (row.value / chartMax) * 100)}%`,
										}}
									/>
								</div>
							</div>
						))}
					</div>
					<div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
						<p>
							Redução da cotação:{" "}
							{quotationReductionPercent == null
								? "sem histórico"
								: `${formatCurrency(quotationReductionAmount ?? 0)} (${quotationReductionPercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)`}
						</p>
						<p>
							{budgetReductionPercent == null
								? "Sem base para comparar o contrato"
								: `Contrato ${budgetReductionPercent >= 0 ? "abaixo" : "acima"} do orçamento em ${Math.abs(budgetReductionPercent).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`}
						</p>
					</div>
				</div>

				<DataTable
					columns={servicesColumns}
					data={[...services].sort((a, b) => a.sortOrder - b.sortOrder)}
					searchPlaceholder="Buscar serviços..."
					pageSize={50}
					emptyMessage="Nenhum serviço selecionado no orçamento."
				/>
			</CardContent>
		</Card>
	);
}
