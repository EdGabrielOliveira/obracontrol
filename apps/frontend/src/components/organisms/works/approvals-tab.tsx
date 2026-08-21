import { Link } from "@tanstack/react-router";
import { CheckCircle2, Eye, XCircle } from "lucide-react";
import { Fragment, useState } from "react";
import { EmptyState } from "@/atoms/empty-state";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { ApprovalRequestView } from "@/types/governance";
import { formatDate } from "@/utils/format";

export const APPROVAL_ACTION_LABELS: Record<string, string> = {
	BUDGET_VERSION_ACTIVATE: "Ativar versão do orçamento",
	SCHEDULE_VERSION_ACTIVATE: "Ativar versão do cronograma",
	WORK_MEASUREMENT_APPROVE: "Aprovar medição da obra",
	CONTRACT_MEASUREMENT_APPROVE: "Aprovar medição do contrato",
	PAYMENT_CONFIRM: "Confirmar pagamento",
	COST_APPROVE: "Aprovar custo",
	IMPORT_CONFIRM: "Confirmar importação",
	BUDGET_IMPACT_APPROVE: "Aprovar estouro orçamentário",
	WORK_CREATE: "Criar obra",
	WORK_UPDATE: "Editar obra",
	WORK_DELETE: "Excluir obra",
	CONTRACT_CREATE: "Criar contrato",
	CONTRACT_UPDATE: "Editar contrato",
	SUPPLIER_CREATE: "Cadastrar fornecedor",
};

const STATUS_LABELS: Record<string, string> = {
	PENDING: "Pendente",
	APPROVED: "Aprovada",
	REJECTED: "Rejeitada",
	CONFLICTED: "Conflitada",
	CANCELLED: "Cancelada",
	EXECUTED: "Executada",
};

const APPROVER_LABELS: Record<string, string> = {
	GESTOR: "Gestor do centro",
	GERENTE: "Gerente da organização",
};

type ApprovalsTabProps = {
	rows: ApprovalRequestView[];
	loading: boolean;
	error: Error | null;
	onRetry: () => void;
	onDecide: (
		requestId: string,
		decision: "APPROVE" | "REJECT",
		reason?: string,
	) => void;
	decidingId: string | null;
	requiresDecisionReason?: boolean;
	currentUserId?: string;
};

export function ApprovalsTab({
	rows,
	loading,
	error,
	onRetry,
	onDecide,
	decidingId,
	requiresDecisionReason = false,
	currentUserId,
}: ApprovalsTabProps) {
	const [decision, setDecision] = useState<{
		requestId: string;
		decision: "APPROVE" | "REJECT";
	} | null>(null);
	const [reason, setReason] = useState("");
	const [detailsRow, setDetailsRow] = useState<ApprovalRequestView | null>(
		null,
	);

	if (loading) return <LoadingSpinner title="Carregando aprovações..." />;
	if (error)
		return (
			<ErrorFeedback message="Erro ao carregar aprovações." onRetry={onRetry} />
		);

	if (rows.length === 0) {
		return (
			<EmptyState
				icon={<CheckCircle2 className="h-10 w-10" />}
				title="Nenhuma aprovação pendente"
				description="Solicitações de aprovação da obra aparecerão aqui."
			/>
		);
	}

	const isReject = decision?.decision === "REJECT";
	const selectedRequest = rows.find((row) => row.id === decision?.requestId);
	const requiresReasonForDecision =
		(isReject || requiresDecisionReason) &&
		(requiresDecisionReason || selectedRequest?.actor.id !== currentUserId);
	const confirmDisabled =
		!decision ||
		((isReject || requiresReasonForDecision) && !reason.trim()) ||
		decidingId !== null;

	const handleConfirm = () => {
		if (!decision) return;
		onDecide(decision.requestId, decision.decision, reason.trim() || undefined);
		setDecision(null);
		setReason("");
	};

	return (
		<div className="space-y-4">
			<div className="overflow-hidden rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Ação</TableHead>
							<TableHead>Recurso</TableHead>
							<TableHead>Solicitante</TableHead>
							<TableHead>Data</TableHead>
							<TableHead className="text-right">Decisão</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<Fragment key={row.id}>
								<TableRow key={row.id}>
									<TableCell className="font-medium">
										{APPROVAL_ACTION_LABELS[row.effectAction] ??
											row.effectAction}
									</TableCell>
									<TableCell>
										{row.target.path ? (
											<Link
												to={row.target.path as never}
												className="link-navigation font-medium"
											>
												{row.target.label}
											</Link>
										) : (
											<span>{row.target.label}</span>
										)}
									</TableCell>
									<TableCell className="max-w-xs truncate">
										{row.actor.name || row.actor.id}
										<div className="text-xs text-muted-foreground">
											{row.actor.role} ·{" "}
											{APPROVER_LABELS[row.requiredApproverRole]}
										</div>
									</TableCell>
									<TableCell className="whitespace-nowrap">
										{formatDate(row.createdAt)}
									</TableCell>
									<TableCell className="text-right">
										{row.target.path ? (
											<Button asChild variant="ghost" size="sm">
												<Link to={row.target.path as never}>
													<Eye className="mr-1 h-4 w-4" />
													Visualizar
												</Link>
											</Button>
										) : (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => setDetailsRow(row)}
											>
												<Eye className="mr-1 h-4 w-4" />
												Visualizar
											</Button>
										)}
										<Button
											variant="ghost"
											size="sm"
											className="hidden"
											onClick={() => undefined}
										>
											Comentários
										</Button>
										{row.status === "PENDING" ? (
											<div className="flex items-center justify-end gap-1">
												<Button
													variant="outline"
													size="sm"
													disabled={decidingId === row.id}
													onClick={() => {
														setDecision({
															requestId: row.id,
															decision: "APPROVE",
														});
														setReason("");
													}}
												>
													<CheckCircle2 className="mr-1 h-4 w-4" />
													Aprovar
												</Button>
												<Button
													variant="outline"
													size="sm"
													disabled={decidingId === row.id}
													onClick={() => {
														setDecision({
															requestId: row.id,
															decision: "REJECT",
														});
														setReason("");
													}}
												>
													<XCircle className="mr-1 h-4 w-4" />
													Rejeitar
												</Button>
											</div>
										) : (
											<div className="flex flex-col items-end gap-1">
												<Badge variant="secondary">
													{STATUS_LABELS[row.status] ?? row.status}
												</Badge>
												{row.decisionReason && (
													<span className="text-xs text-muted-foreground">
														{row.decisionReason}
													</span>
												)}
											</div>
										)}
									</TableCell>
								</TableRow>
								{false && (
									<TableRow key={`${row.id}-comments`}>
										<TableCell colSpan={5}>{null}</TableCell>
									</TableRow>
								)}
							</Fragment>
						))}
					</TableBody>
				</Table>
			</div>

			<Dialog open={decision !== null} onOpenChange={() => setDecision(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{isReject ? "Rejeitar solicitação?" : "Aprovar solicitação?"}
						</DialogTitle>
					</DialogHeader>
					{(isReject || requiresReasonForDecision) && (
						<Textarea
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder={
								isReject
									? "Motivo da rejeição (obrigatório)"
									: "Motivo da aprovação (obrigatório para ADMIN)"
							}
							rows={3}
						/>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							disabled={decidingId !== null}
							onClick={() => setDecision(null)}
						>
							Cancelar
						</Button>
						<Button
							variant={isReject ? "destructive" : "default"}
							disabled={confirmDisabled}
							loading={decidingId !== null}
							onClick={handleConfirm}
						>
							{isReject ? "Rejeitar" : "Aprovar"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={detailsRow !== null}
				onOpenChange={(open) => !open && setDetailsRow(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Detalhes da aprovação</DialogTitle>
					</DialogHeader>
					{detailsRow && (
						<div className="space-y-4 text-sm">
							<div>
								<p className="text-muted-foreground">Ação</p>
								<p className="font-medium">
									{APPROVAL_ACTION_LABELS[detailsRow.effectAction] ??
										detailsRow.effectAction}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Solicitante</p>
								<p className="font-medium">
									{detailsRow.actor.name || detailsRow.actor.id}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">
									Justificativa da criação
								</p>
								<p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3">
									{detailsRow.description || "Não informada."}
								</p>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
