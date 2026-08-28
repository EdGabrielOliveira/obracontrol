import { ClipboardList, Info, ListTree, UserPlus, Users } from "lucide-react";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
	QuotationComparison,
	QuotationComparisonProposal,
} from "@/types/quotations";
import { formatCnpj, formatCurrency, formatDate } from "@/utils/format";

interface QuotationComparisonViewProps {
	comparison: QuotationComparison;
	canApprove: boolean;
	isChoosing: boolean;
	onNegotiate: (proposal: QuotationComparisonProposal) => void;
	onRequote?: () => void;
	onChoose: (proposalId: string) => void;
	onRegisterSupplier: (proposal: QuotationComparisonProposal) => void;
	onCreateProposal?: () => void;
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

function quotationStatusLabel(status: string) {
	return status === "NEGOCIACAO"
		? "Em negociação"
		: status === "ESCOLHIDA"
			? "Fornecedor escolhido"
			: status === "CONTRATADA"
				? "Contrato gerado"
				: "Em cotação";
}

export function QuotationComparisonView({
	comparison,
	canApprove,
	isChoosing,
	onNegotiate,
	onRequote,
	onChoose,
	onRegisterSupplier,
	onCreateProposal,
}: QuotationComparisonViewProps) {
	const isRequote =
		comparison.status === "EM_COTACAO" &&
		comparison.proposals.some((proposal) => (proposal.round ?? 0) > 1);

	return (
		<div className="space-y-6">
			{isRequote ? (
				<Alert className="status-info border-info/40">
					<Info />
					<AlertTitle>Nova rodada de cotação aberta</AlertTitle>
					<AlertDescription>
						As propostas anteriores foram preservadas. Aguarde ou registre as
						novas respostas antes de escolher um fornecedor.
					</AlertDescription>
				</Alert>
			) : null}
			<Card className="overflow-hidden">
				<CardHeaderWithIcon
					icon={ClipboardList}
					title={comparison.title}
					description={comparison.observation || "Sem descrição informada"}
					actions={
						<span className="status-info rounded-full px-2.5 py-1 text-xs font-semibold">
							{quotationStatusLabel(comparison.status)}
						</span>
					}
				/>
				<CardContent className="grid gap-3 border-t bg-muted/20 pt-4 sm:grid-cols-2 lg:grid-cols-4">
					<div className="rounded-lg border bg-card p-4">
						<p className="text-sm text-muted-foreground">Total orçado</p>
						<p className="mt-1 text-xl font-semibold tabular-nums">
							{money(comparison.budgetTotal)}
						</p>
					</div>
					<div className="rounded-lg border bg-card p-4">
						<p className="text-sm text-muted-foreground">Propostas recebidas</p>
						<p className="mt-1 text-xl font-semibold">
							{comparison.proposals.length}
						</p>
					</div>
					<div className="rounded-lg border bg-card p-4">
						<p className="text-sm text-muted-foreground">Itens selecionados</p>
						<p className="mt-1 text-xl font-semibold">
							{comparison.items.length}
						</p>
					</div>
					<div className="rounded-lg border bg-card p-4">
						<p className="text-sm text-muted-foreground">Menor proposta</p>
						<p className="mt-1 text-xl font-semibold tabular-nums">
							{comparison.proposals.length === 0
								? "—"
								: money(
										Math.min(
											...comparison.proposals.map((proposal) => proposal.value),
										),
									)}
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
					{comparison.items.length === 0 ? (
						<p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
							Nenhum item do orçamento selecionado.
						</p>
					) : (
						<div className="divide-y rounded-lg border bg-muted/10">
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
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={Users}
					title="Comparativo de fornecedores"
					description="Propostas, status e decisões da cotação."
					actions={
						canApprove && comparison.status !== "CONTRATADA" ? (
							<div className="flex flex-wrap gap-2">
								{onCreateProposal ? (
									<Button
										variant="default"
										size="sm"
										onClick={onCreateProposal}
									>
										<UserPlus className="mr-2 h-4 w-4" />
										Adicionar participante
									</Button>
								) : null}
								<Button
									variant="outline"
									size="sm"
									onClick={() => onRequote?.()}
								>
									Recotar
								</Button>
							</div>
						) : null
					}
				/>
				<CardContent className="space-y-3">
					{comparison.proposals.length === 0 ? (
						<div className="rounded-lg border border-dashed p-6 text-center">
							<p className="font-medium">Nenhuma proposta recebida</p>
							<p className="mt-1 text-sm text-muted-foreground">
								Cadastre fornecedores ou envie uma nova rodada para continuar.
							</p>
						</div>
					) : (
						comparison.proposals.map((proposal) => (
							<div
								key={proposal.id}
								className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-muted/10 p-4"
							>
								<div className="min-w-0 flex-1 space-y-1">
									<p className="font-semibold">{proposal.supplierName}</p>
									<p className="text-sm">
										<span className="text-muted-foreground">CNPJ: </span>
										{formatCnpj(proposal.supplierDocument) || "Não informado"}{" "}
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
									{field(
										"Endereço",
										proposal.supplierAddress ?? "Indisponível",
									)}
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
									<div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
										<span className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">
											Fornecedor escolhido
										</span>
										{proposal.supplierRegistered ? (
											<Button
												variant="positive"
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
									<div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
										<Button
											variant="default"
											size="sm"
											onClick={() => onNegotiate(proposal)}
										>
											Negociar
										</Button>
										<Button
											variant="positive"
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
						))
					)}
				</CardContent>
			</Card>
		</div>
	);
}
