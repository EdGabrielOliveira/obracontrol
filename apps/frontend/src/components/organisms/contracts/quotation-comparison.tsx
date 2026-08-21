import { ClipboardList, ListTree, Users } from "lucide-react";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
	QuotationComparison,
	QuotationComparisonProposal,
} from "@/types/quotations";
import { formatCurrency, formatDate } from "@/utils/format";

interface QuotationComparisonViewProps {
	comparison: QuotationComparison;
	canApprove: boolean;
	isChoosing: boolean;
	onNegotiate: (proposal: QuotationComparisonProposal) => void;
	onRequote?: () => void;
	onChoose: (proposalId: string) => void;
	onRegisterSupplier: (proposal: QuotationComparisonProposal) => void;
}

function money(value: number | null): string {
	return value == null ? "Indisponível" : formatCurrency(value);
}

function field(label: string, value: string): React.ReactNode {
	if (value === "Indisponível" || value === "-") return null;
	return (
		<p className="text-sm">
			<span className="text-muted-foreground">{label}: </span>
			{value}
		</p>
	);
}

export function QuotationComparisonView({
	comparison,
	canApprove,
	isChoosing,
	onNegotiate,
	onRequote,
	onChoose,
	onRegisterSupplier,
}: QuotationComparisonViewProps) {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeaderWithIcon
					icon={ClipboardList}
					title={comparison.title}
					description={comparison.observation || "Sem descrição"}
				/>
				<CardContent className="grid gap-4 sm:grid-cols-2">
					<div className="rounded-lg border p-4">
						<p className="text-sm text-muted-foreground">Total orçado</p>
						<p className="mt-1 text-xl font-semibold tabular-nums">
							{money(comparison.budgetTotal)}
						</p>
					</div>
					<div className="rounded-lg border p-4">
						<p className="text-sm text-muted-foreground">Itens selecionados</p>
						<p className="mt-1 text-xl font-semibold">
							{comparison.items.length}
						</p>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={ListTree}
					title="Itens do orçamento"
					description="Itens considerados no comparativo."
				/>
				<CardContent>
					<div className="divide-y rounded-lg border">
						{comparison.items.map((item) => (
							<div
								key={item.id ?? item.budgetItemId}
								className="flex flex-wrap items-center justify-between gap-3 p-3"
							>
								<div>
									<p className="font-medium">
										{item.budgetItem?.index ?? item.budgetItemId} -{" "}
										{item.budgetItem?.description ?? "Item"}
									</p>
									<p className="text-xs text-muted-foreground">
										Quantidade: {item.quantity} {item.budgetItem?.unit ?? ""}
									</p>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={Users}
					title="Comparativo de fornecedores"
					description="Propostas, status e decisões da cotação."
					actions={
						canApprove && comparison.status !== "CONTRATADA" ? (
							<Button variant="outline" size="sm" onClick={() => onRequote?.()}>
								Recotar
							</Button>
						) : null
					}
				/>
				<CardContent className="space-y-3">
					{comparison.proposals.map((proposal) => (
						<div
							key={proposal.id}
							className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
						>
							<div className="min-w-0 flex-1 space-y-1">
								<p className="font-semibold">{proposal.supplierName}</p>
								<p className="text-sm">
									<span className="text-muted-foreground">CNPJ: </span>
									{proposal.supplierDocument ?? "Não informado"}{" "}
									<span
										className={
											proposal.supplierRegistered
												? "text-success"
												: "text-warning"
										}
									>
										{proposal.supplierRegistered
											? "Cadastrado"
											: "Cadastro necessário"}
									</span>
								</p>
								{field("Endereço", proposal.supplierAddress ?? "Indisponível")}
								{field("Telefone", proposal.supplierPhone ?? "Indisponível")}
								{field("E-mail", proposal.supplierEmail ?? "Indisponível")}
								{field(
									"Responsável",
									proposal.supplierResponsible ?? "Indisponível",
								)}
								{field(
									"Serviço ofertado",
									proposal.serviceDescription ?? "Indisponível",
								)}
								<p className="text-sm tabular-nums">
									<span className="text-muted-foreground">
										Valor total do serviço:{" "}
									</span>
									{money(proposal.value)}
								</p>
								{field(
									"Data de início",
									proposal.serviceStartDate
										? formatDate(proposal.serviceStartDate)
										: "Indisponível",
								)}
								{field(
									"Prazo de execução",
									proposal.executionTermDays == null
										? "Indisponível"
										: `${proposal.executionTermDays} dias`,
								)}
								{field(
									"Condição de pagamento",
									proposal.paymentTerms ?? "Indisponível",
								)}
								{field("Observações", proposal.notes ?? "Indisponível")}
								<p className="text-xs text-muted-foreground tabular-nums">
									Diferença para o orçamento:{" "}
									{money(proposal.differenceFromBudget)}
								</p>
							</div>
							{proposal.isWinner && comparison.status === "CONTRATADA" ? (
								<span className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">
									Contrato gerado
								</span>
							) : proposal.isWinner && comparison.status === "ESCOLHIDA" ? (
								<div className="flex flex-wrap items-center gap-2">
									<span className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">
										Fornecedor escolhido
									</span>
									{proposal.supplierRegistered ? (
										<Button
											size="sm"
											loading={isChoosing}
											onClick={() => onChoose(proposal.id)}
										>
											Gerar contrato
										</Button>
									) : (
										<>
											<span className="text-xs text-warning">
												Cadastre o fornecedor para gerar o contrato.
											</span>
											<Button
												variant="outline"
												size="sm"
												onClick={() => onRegisterSupplier(proposal)}
											>
												Cadastrar fornecedor
											</Button>
										</>
									)}
								</div>
							) : canApprove ? (
								<div className="flex gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => onNegotiate(proposal)}
									>
										Negociar
									</Button>
									<Button
										size="sm"
										loading={isChoosing}
										onClick={() => onChoose(proposal.id)}
									>
										Escolher fornecedor
									</Button>
									{!proposal.supplierRegistered && (
										<Button
											variant="outline"
											size="sm"
											onClick={() => onRegisterSupplier(proposal)}
										>
											Cadastrar fornecedor
										</Button>
									)}
								</div>
							) : null}
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	);
}
