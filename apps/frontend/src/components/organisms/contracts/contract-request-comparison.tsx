import { createColumnHelper } from "@tanstack/react-table";
import { BarChart3, CheckCircle2, FileText, ListChecks } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/atoms/data-table";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ContractRequestComparison } from "@/types/contract-requests";
import { formatCurrency } from "@/utils/format";

type Props = {
	comparison: ContractRequestComparison;
	isAccepting: boolean;
	onAccept: (proposalId: string) => void;
	onRegisterSupplier?: (proposal: ComparisonProposal) => void;
	onNegotiate?: (proposalId: string, value: number, reason: string) => void;
	isNegotiating?: boolean;
};

type SelectedBudgetItem = ContractRequestComparison["selectedItems"][number];
type ComparisonProposal = ContractRequestComparison["proposals"][number];
type ClassificationMetric =
	ContractRequestComparison["statistics"]["classification"]["profit"];

const budgetItemColumnHelper = createColumnHelper<SelectedBudgetItem>();
const budgetItemColumns = [
	budgetItemColumnHelper.accessor("index", {
		header: "Item",
		cell: (info) => info.getValue() ?? info.row.original.budgetItemId,
	}),
	budgetItemColumnHelper.accessor("description", {
		header: "Descrição",
		cell: (info) => info.getValue() ?? "Item sem descrição",
	}),
	budgetItemColumnHelper.accessor("unit", {
		header: "Unidade",
		cell: (info) => info.getValue() ?? "—",
	}),
	budgetItemColumnHelper.accessor("quantity", {
		header: "Quantidade",
		cell: (info) => info.getValue().toLocaleString("pt-BR"),
	}),
	budgetItemColumnHelper.accessor("budgetTotal", {
		header: "Total orçado",
		cell: (info) => formatCurrency(info.getValue()),
	}),
];

function exactMarginLabel(proposal: ComparisonProposal) {
	const percent = Math.abs(proposal.profitMarginPercent).toLocaleString(
		"pt-BR",
		{
			maximumFractionDigits: 2,
		},
	);
	if (proposal.costStatus === "EXPENSE") {
		return `Despesa: ${formatCurrency(Math.abs(proposal.profitMarginAmount))} acima (${percent}%)`;
	}
	if (proposal.costStatus === "PROFIT") {
		return `Lucro: ${formatCurrency(proposal.profitMarginAmount)} (${percent}%)`;
	}
	return `Neutro: ${formatCurrency(proposal.profitMarginAmount)} de economia (${percent}%)`;
}

function semaphoreLabel(status: "GREEN" | "YELLOW" | "RED" | "UNAVAILABLE") {
	return status === "GREEN"
		? "Semáforo verde"
		: status === "YELLOW"
			? "Semáforo amarelo"
			: status === "RED"
				? "Semáforo vermelho"
				: "Semáforo indisponível";
}

function classificationSupplierLabel(
	metric: ClassificationMetric,
	label: string,
	emptyLabel: string,
) {
	if (!metric.supplier) return emptyLabel;
	return `${label}: ${metric.supplier.name} · ${formatCurrency(metric.supplier.proposalValue)} (${metric.supplier.costRatioPercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% do orçamento)`;
}

export function ContractRequestComparisonView({
	comparison,
	isAccepting,
	onAccept,
	onRegisterSupplier,
	onNegotiate,
	isNegotiating = false,
}: Props) {
	const canAccept = comparison.permissions.canAccept;
	const [negotiation, setNegotiation] = useState<{
		id: string;
		name: string;
		value: number;
	} | null>(null);
	const [newValue, setNewValue] = useState("");
	const [negotiationReason, setNegotiationReason] = useState("");
	const [acceptance, setAcceptance] = useState<{
		id: string;
		name: string;
		value: number;
	} | null>(null);
	const statistics = comparison.statistics;
	const statusStyles = {
		PROFIT: "status-success",
		NEUTRAL: "status-warning",
		EXPENSE: "status-danger",
	} as const;
	const maxProposalValue = Math.max(
		comparison.budget.total,
		...comparison.proposals.map((proposal) => proposal.proposalValue),
		1,
	);
	const ranking = [...comparison.proposals].sort(
		(a, b) =>
			a.proposalValue - b.proposalValue ||
			b.profitMarginPercent - a.profitMarginPercent,
	);
	const barStyles = {
		PROFIT: "bg-status-success",
		NEUTRAL: "bg-status-warning",
		EXPENSE: "bg-status-danger",
	} as const;

	return (
		<div className="space-y-6">
			<Card>
				<CardHeaderWithIcon
					icon={FileText}
					title={comparison.request.title}
					description={comparison.request.description || "Sem descrição"}
				/>
				<CardContent className="grid gap-4 sm:grid-cols-2">
					<div className="rounded-lg border p-4">
						<p className="text-sm text-muted-foreground">Total orçado</p>
						<p className="mt-1 text-xl font-semibold tabular-nums">
							{formatCurrency(comparison.budget.total)}
						</p>
					</div>
					<div className="rounded-lg border p-4">
						<p className="text-sm text-muted-foreground">Itens selecionados</p>
						<p className="mt-1 text-xl font-semibold">
							{comparison.selectedItems.length}
						</p>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={ListChecks}
					title="Itens do orçamento"
					description="Atividades selecionadas para formar o contrato."
				/>
				<CardContent>
					<DataTable
						columns={budgetItemColumns}
						data={comparison.selectedItems}
						searchPlaceholder="Buscar itens do orçamento..."
						emptyMessage="Nenhum item do orçamento selecionado."
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={BarChart3}
					title="Análise e escolha do fornecedor"
					description="Métricas, ranking, negociação e aceite reunidos em uma única visão."
				/>
				<CardContent className="space-y-8">
					<section className="space-y-3">
						<div>
							<h3 className="text-sm font-semibold">Resultado financeiro</h3>
							<p className="text-xs text-muted-foreground">
								Destaques de melhor economia, faixa neutra e maior despesa.
							</p>
						</div>
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<div className="status-success rounded-lg p-4">
								<p className="text-sm font-medium">Lucro / economia</p>
								<p className="mt-1 text-2xl font-semibold tabular-nums">
									{formatCurrency(
										comparison.statistics.classification.profit.amount,
									)}
								</p>
								<p className="text-xs">
									{classificationSupplierLabel(
										comparison.statistics.classification.profit,
										"Melhor lucro",
										"Nenhum fornecedor com lucro",
									)}
								</p>
							</div>
							<div className="status-warning rounded-lg p-4">
								<p className="text-sm font-medium">Neutro</p>
								<p className="mt-1 text-2xl font-semibold tabular-nums">
									{formatCurrency(
										comparison.statistics.classification.neutral.amount,
									)}
								</p>
								<p className="text-xs">
									{classificationSupplierLabel(
										comparison.statistics.classification.neutral,
										"Melhor neutro",
										"Nenhum fornecedor entre 90% e 100%",
									)}
								</p>
							</div>
							<div className="status-danger rounded-lg p-4">
								<p className="text-sm font-medium">Despesa adicional</p>
								<p className="mt-1 text-2xl font-semibold tabular-nums">
									{formatCurrency(
										comparison.statistics.classification.expense.amount,
									)}
								</p>
								<p className="text-xs">
									{classificationSupplierLabel(
										comparison.statistics.classification.expense,
										"Pior valor",
										"Nenhum fornecedor acima do orçamento",
									)}
								</p>
							</div>
							<div className="status-info rounded-lg p-4">
								<p className="text-sm font-medium">Redução em negociação</p>
								<p className="mt-1 text-2xl font-semibold tabular-nums">
									{formatCurrency(
										comparison.statistics.negotiatedReductionTotal,
									)}
								</p>
								<p className="text-xs">
									{comparison.statistics.negotiatedReductionPercent === null ||
									comparison.statistics.negotiatedReductionTotal === 0
										? "Sem redução negociada"
										: `${comparison.statistics.negotiatedReductionPercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% sobre a proposta original de ${comparison.statistics.negotiatedReductionSupplierName ?? "melhor fornecedor"}`}
								</p>
							</div>
						</div>
					</section>

					<section className="space-y-3 border-t pt-6">
						<div>
							<h3 className="text-sm font-semibold">Métricas da cotação</h3>
							<p className="text-xs text-muted-foreground">
								Comparação estatística entre orçamento, fornecedores e margens.
							</p>
						</div>
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<div className="rounded-lg border p-4">
								<p className="text-sm text-muted-foreground">Menor proposta</p>
								<p className="mt-1 text-lg font-semibold tabular-nums">
									{statistics.supplierLowest === null
										? "—"
										: formatCurrency(statistics.supplierLowest)}
								</p>
								<p className="text-xs text-muted-foreground">
									{statistics.lowestRatioPercent === null
										? "Sem base orçamentária"
										: `${statistics.lowestRatioPercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% do orçamento`}
								</p>
								<p className="text-xs font-medium text-success">
									Melhor valor: {statistics.bestSupplier?.name ?? "—"}
								</p>
							</div>
							<div className="rounded-lg border p-4">
								<p className="text-sm text-muted-foreground">
									Média dos fornecedores
								</p>
								<p className="mt-1 text-lg font-semibold tabular-nums">
									{statistics.supplierAverage === null
										? "—"
										: formatCurrency(statistics.supplierAverage)}
								</p>
								<p className="text-xs text-muted-foreground">
									{statistics.averageRatioPercent === null
										? "Sem base orçamentária"
										: `${statistics.averageRatioPercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% do orçamento`}
								</p>
								<p className="text-xs font-medium text-success">
									Margem média:{" "}
									{statistics.averageProfitMarginPercent === null
										? "sem base"
										: `${statistics.averageProfitMarginPercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`}
								</p>
							</div>
							<div className="rounded-lg border p-4">
								<p className="text-sm text-muted-foreground">Maior proposta</p>
								<p className="mt-1 text-lg font-semibold tabular-nums">
									{statistics.supplierHighest === null
										? "—"
										: formatCurrency(statistics.supplierHighest)}
								</p>
								<p className="text-xs text-muted-foreground">
									{statistics.supplierCount} fornecedor(es) comparado(s)
								</p>
								<p className="text-xs font-medium text-destructive">
									Pior valor: {statistics.worstSupplier?.name ?? "—"}
								</p>
							</div>
							<div className="rounded-lg border p-4">
								<p className="text-sm text-muted-foreground">
									Referência do orçamento
								</p>
								<p className="mt-1 text-lg font-semibold tabular-nums">
									{formatCurrency(statistics.budgetTotal)}
								</p>
								<p className="text-xs text-muted-foreground">
									Base para a margem de custo
								</p>
							</div>
						</div>
					</section>

					<section className="space-y-3 border-t pt-6">
						<div>
							<h3 className="text-sm font-semibold">Ranking e aceite</h3>
							<p className="text-xs text-muted-foreground">
								Fornecedores ordenados pelo valor final, com negociação e aceite
								na mesma visão.
							</p>
						</div>
						<div className="flex flex-wrap gap-2 text-xs">
							<span className="status-success rounded-full px-2 py-1">
								Verde: lucro (até 90%)
							</span>
							<span className="status-warning rounded-full px-2 py-1">
								Amarelo: neutro (90%–100%)
							</span>
							<span className="status-danger rounded-full px-2 py-1">
								Vermelho: despesa (acima de 100%)
							</span>
						</div>
						{ranking.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								Nenhuma proposta para visualizar.
							</p>
						) : (
							<div className="divide-y rounded-lg border">
								{ranking.map((proposal, index) => (
									<div
										key={`ranking-${proposal.id}`}
										className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
									>
										<div className="flex min-w-0 items-start gap-3">
											<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
												{index + 1}º
											</div>
											<div className="min-w-0">
												<p className="font-medium">{proposal.supplier.name}</p>
												<p className="text-xs text-muted-foreground">
													{proposal.supplier.cnpj}
												</p>
												{proposal.supplier.registered ? (
													<p className="text-xs text-success">
														<CheckCircle2 className="mr-1 inline h-3 w-3" />
														Cadastrado e vinculado
													</p>
												) : (
													<p className="text-xs text-warning">
														Fornecedor ainda não cadastrado; isso não impede a
														contratação.
													</p>
												)}
												<div
													className={`mt-1 inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusStyles[proposal.costStatus]}`}
												>
													{exactMarginLabel(proposal)}
												</div>
												<p className="mt-1 text-xs text-muted-foreground">
													{semaphoreLabel(
														proposal.semaphore?.status ?? "UNAVAILABLE",
													)}
													{proposal.semaphore?.variancePercent != null
														? ` · ${proposal.semaphore.variancePercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% vs. orçamento`
														: ""}
												</p>
												<div className="mt-3 space-y-1">
													<div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
														<span className="font-medium">
															Valor final e redução negociada
														</span>
														<span className="tabular-nums">
															{formatCurrency(proposal.proposalValue)} ·{" "}
															{exactMarginLabel(proposal)}
														</span>
													</div>
													<div className="h-3 overflow-hidden rounded-full bg-muted">
														<div
															className={`h-full rounded-full transition-all ${barStyles[proposal.costStatus]}`}
															style={{
																width: `${Math.max(3, Math.min(100, (proposal.proposalValue / maxProposalValue) * 100))}%`,
															}}
														/>
													</div>
													<p className="text-xs text-muted-foreground">
														Original:{" "}
														{formatCurrency(proposal.originalProposalValue)} ·
														Redução negociada:{" "}
														{formatCurrency(
															proposal.negotiationReductionAmount,
														)}{" "}
														(
														{proposal.negotiationReductionPercent.toLocaleString(
															"pt-BR",
															{ maximumFractionDigits: 2 },
														)}
														%)
													</p>
												</div>
											</div>
										</div>
										<div className="text-right">
											<p className="font-semibold tabular-nums">
												{formatCurrency(proposal.proposalValue)}
											</p>
											<p className="text-xs text-muted-foreground">
												{proposal.costRatioPercent.toLocaleString("pt-BR", {
													maximumFractionDigits: 2,
												})}
												% do orçamento · margem de custo
											</p>
											<p className="text-xs text-muted-foreground">
												{proposal.difference.amount >= 0 ? "+" : ""}
												{formatCurrency(proposal.difference.amount)} (
												{proposal.difference.percent.toLocaleString("pt-BR", {
													maximumFractionDigits: 2,
												})}
												%)
											</p>
											{canAccept ? (
												<div className="mt-2 flex flex-wrap justify-end gap-2">
													<Button
														variant="outline"
														size="sm"
														onClick={() => {
															setNegotiation({
																id: proposal.id,
																name: proposal.supplier.name,
																value: proposal.proposalValue,
															});
															setNewValue("");
															setNegotiationReason("");
														}}
													>
														Negociar
													</Button>
													<Button
														size="sm"
														disabled={isAccepting}
														onClick={() =>
															setAcceptance({
																id: proposal.id,
																name: proposal.supplier.name,
																value: proposal.proposalValue,
															})
														}
													>
														Selecionar proposta
													</Button>
													{!proposal.supplier.registered &&
													onRegisterSupplier ? (
														<Button
															variant="outline"
															size="sm"
															onClick={() => onRegisterSupplier(proposal)}
														>
															Cadastrar fornecedor
														</Button>
													) : null}
												</div>
											) : null}
										</div>
									</div>
								))}
							</div>
						)}
					</section>
				</CardContent>
			</Card>

			<Dialog
				open={negotiation !== null}
				onOpenChange={(open) => !open && setNegotiation(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Negociar proposta</DialogTitle>
					</DialogHeader>
					{negotiation ? (
						<div className="space-y-4">
							<p className="text-sm text-muted-foreground">
								Informe um valor menor para {negotiation.name}.
							</p>
							<p className="status-success rounded-md p-2 text-xs">
								Meta de lucro: negociar até{" "}
								{formatCurrency(comparison.budget.total * 0.9)}
								(90% do orçamento).
							</p>
							<Input
								type="number"
								min="0.01"
								step="0.01"
								value={newValue}
								onChange={(event) => setNewValue(event.target.value)}
								placeholder={String(negotiation.value)}
							/>
							<Input
								value={negotiationReason}
								onChange={(event) => setNegotiationReason(event.target.value)}
								placeholder="Motivo obrigatório da negociação"
							/>
							<div className="flex justify-end gap-2">
								<Button variant="outline" onClick={() => setNegotiation(null)}>
									Cancelar
								</Button>
								<Button
									loading={isNegotiating}
									disabled={
										!onNegotiate ||
										!negotiationReason.trim() ||
										Number(newValue) <= 0 ||
										Number(newValue) >= negotiation.value
									}
									onClick={() => {
										onNegotiate?.(
											negotiation.id,
											Number(newValue),
											negotiationReason.trim(),
										);
										setNegotiation(null);
									}}
								>
									Salvar negociação
								</Button>
							</div>
						</div>
					) : null}
				</DialogContent>
			</Dialog>
			<Dialog
				open={acceptance !== null}
				onOpenChange={(open) => !open && setAcceptance(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Confirmar escolha do fornecedor</DialogTitle>
					</DialogHeader>
					{acceptance ? (
						<div className="space-y-4">
							<p className="text-sm text-muted-foreground">
								Você está escolhendo <strong>{acceptance.name}</strong> para
								iniciar o contrato.
							</p>
							<div className="rounded-md border bg-muted/40 p-3 text-sm">
								Valor final: <strong>{formatCurrency(acceptance.value)}</strong>
							</div>
							<p className="text-xs text-warning">
								Essa ação criará o contrato RASCUNHO. Confirme somente se o
								fornecedor estiver correto.
							</p>
							<div className="flex justify-end gap-2">
								<Button variant="outline" onClick={() => setAcceptance(null)}>
									Cancelar
								</Button>
								<Button
									loading={isAccepting}
									onClick={() => {
										onAccept(acceptance.id);
										setAcceptance(null);
									}}
								>
									Confirmar seleção
								</Button>
							</div>
						</div>
					) : null}
				</DialogContent>
			</Dialog>
		</div>
	);
}
