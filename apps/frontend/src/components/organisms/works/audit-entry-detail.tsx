import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
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
import {
	auditActionLabel,
	auditEntityLabel,
	diffAuditState,
} from "@/lib/audit-labels";
import type { AuditLogEntry } from "@/types/audit";
import { formatDate } from "@/utils/format";

type AuditEntryDetailProps = {
	entry: AuditLogEntry | null;
	onOpenChange: (open: boolean) => void;
	onOpenNavigationTarget: (
		target: NonNullable<AuditLogEntry["navigationTarget"]>,
	) => void;
};

function JsonBlock({ label, value }: { label: string; value: unknown }) {
	return (
		<div>
			<p className="mb-1 text-sm font-medium text-muted-foreground">{label}</p>
			<pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs">
				{JSON.stringify(value, null, 2)}
			</pre>
		</div>
	);
}

function stringify(value: unknown): string {
	if (value == null) return "—";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

export function AuditEntryDetail({
	entry,
	onOpenChange,
	onOpenNavigationTarget,
}: AuditEntryDetailProps) {
	return (
		<Dialog open={entry !== null} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Detalhe do histórico</DialogTitle>
				</DialogHeader>
				{entry && (
					<div className="space-y-4">
						<div className="grid gap-3 text-sm sm:grid-cols-2">
							<div>
								<p className="text-muted-foreground">Data</p>
								<p className="font-medium">{formatDate(entry.createdAt)}</p>
							</div>
							<div>
								<p className="text-muted-foreground">Ação</p>
								<p className="flex items-center gap-2 font-medium">
									{auditActionLabel(entry.action)}
									<Badge variant="outline">
										{auditActionLabel(entry.action)}
									</Badge>
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Entidade</p>
								<p className="flex items-center gap-2 font-medium">
									{auditEntityLabel(entry.entityType)}
									<Badge variant="outline">
										{auditEntityLabel(entry.entityType)}
									</Badge>
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Usuário</p>
								<p className="font-medium">
									{entry.user?.name || entry.user?.email || entry.userId}
								</p>
							</div>
							{entry.entityDescription && (
								<div className="sm:col-span-2">
									<p className="text-muted-foreground">Descrição</p>
									<p className="font-medium">{entry.entityDescription}</p>
								</div>
							)}
						</div>
						{entry.navigationTarget && (
							<Button
								variant="outline"
								onClick={() => {
									onOpenChange(false);
									onOpenNavigationTarget(
										entry.navigationTarget as NonNullable<
											AuditLogEntry["navigationTarget"]
										>,
									);
								}}
							>
								{entry.navigationTarget.label}
							</Button>
						)}

						<div className="rounded-lg border p-3 text-sm">
							{entry.action === "CREATE" ||
							(entry.previousState == null && entry.newState != null) ? (
								<p className="font-medium">
									Registro criado — não havia estado anterior.
								</p>
							) : entry.action === "DELETE" ? (
								<p className="font-medium">
									Registro excluído — não há estado novo disponível.
								</p>
							) : (
								<p className="text-muted-foreground">
									Diferenças entre o estado anterior e o novo estado.
								</p>
							)}
						</div>

						{entry.action !== "CREATE" && entry.previousState != null && (
							<div className="overflow-x-auto rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Campo</TableHead>
											<TableHead>Antes</TableHead>
											<TableHead>Depois</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{diffAuditState(entry.previousState, entry.newState).map(
											(change) => (
												<TableRow key={change.field}>
													<TableCell className="font-mono text-xs">
														{change.field}
													</TableCell>
													<TableCell className="text-xs text-muted-foreground">
														{stringify(change.before)}
													</TableCell>
													<TableCell className="text-xs">
														{stringify(change.after)}
													</TableCell>
												</TableRow>
											),
										)}
									</TableBody>
								</Table>
							</div>
						)}

						<div className="space-y-3 border-t pt-3">
							<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								Dados técnicos
							</p>
							{entry.previousState == null ? (
								<p className="text-sm text-muted-foreground">
									Estado anterior: não disponível
									{entry.action === "CREATE"
										? " (registro criado sem estado anterior)."
										: "."}
								</p>
							) : (
								<JsonBlock
									label="Estado anterior"
									value={entry.previousState}
								/>
							)}
							{entry.newState == null ? (
								<p className="text-sm text-muted-foreground">
									Novo estado: não disponível
									{entry.action === "DELETE" ? " (registro excluído)." : "."}
								</p>
							) : (
								<JsonBlock label="Novo estado" value={entry.newState} />
							)}
							{entry.metadata != null && (
								<JsonBlock label="Metadados" value={entry.metadata} />
							)}
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
