import {
	AUDIT_ACTION_STATUS_MAP,
	CONTRACT_STATUS_MAP,
	MEASUREMENT_STATUS_MAP,
	PAYMENT_STATUS_MAP,
	WORK_STATUS_MAP,
	StatusBadge,
} from "@/components/atoms/status-badge";
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
	auditDescription,
	auditEntityLabel,
	auditFieldLabel,
	auditUserName,
	diffAuditState,
	formatAuditValue,
	isTechnicalAuditField,
} from "@/lib/audit-labels";
import type { AuditLogEntry } from "@/types/audit";
import { formatDateTime } from "@/utils/format";

type AuditEntryDetailProps = {
	entry: AuditLogEntry | null;
	onOpenChange: (open: boolean) => void;
	onOpenNavigationTarget: (
		target: NonNullable<AuditLogEntry["navigationTarget"]>,
	) => void;
};

function statusMapForEntity(entityType: string) {
	if (entityType === "WORK") return WORK_STATUS_MAP;
	if (entityType === "CONTRACT") return CONTRACT_STATUS_MAP;
	if (
		entityType === "WORK_MEASUREMENT" ||
		entityType === "CONTRACT_MEASUREMENT"
	)
		return MEASUREMENT_STATUS_MAP;
	if (entityType === "CONTRACT_PAYMENT") return PAYMENT_STATUS_MAP;
	return MEASUREMENT_STATUS_MAP;
}

function visibleStateEntries(state: Record<string, unknown> | null) {
	return Object.entries(state ?? {}).filter(
		([field]) => !isTechnicalAuditField(field),
	);
}

function StateTable({
	rows,
	beforeLabel = "Antes",
	afterLabel = "Depois",
}: {
	rows: Array<{ field: string; before: unknown; after: unknown }>;
	beforeLabel?: string;
	afterLabel?: string;
}) {
	if (rows.length === 0) return null;
	return (
		<div className="overflow-x-auto rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Campo</TableHead>
						<TableHead>{beforeLabel}</TableHead>
						<TableHead>{afterLabel}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((change) => (
						<TableRow key={change.field}>
							<TableCell className="font-medium">
								{auditFieldLabel(change.field)}
							</TableCell>
							<TableCell className="text-sm text-muted-foreground">
								{formatAuditValue(change.before, change.field)}
							</TableCell>
							<TableCell className="text-sm">
								{formatAuditValue(change.after, change.field)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

export function AuditEntryDetail({
	entry,
	onOpenChange,
	onOpenNavigationTarget,
}: AuditEntryDetailProps) {
	const changes = entry
		? diffAuditState(entry.previousState, entry.newState).filter(
				(change) => !isTechnicalAuditField(change.field),
			)
		: [];
	const createdFields = entry
		? visibleStateEntries(entry.newState).map(([field, value]) => ({
				field,
				before: null,
				after: value,
			}))
		: [];
	const deletedFields = entry
		? visibleStateEntries(entry.previousState).map(([field, value]) => ({
				field,
				before: value,
				after: null,
			}))
		: [];

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
								<p className="text-muted-foreground">Data e hora</p>
								<p className="font-medium">{formatDateTime(entry.createdAt)}</p>
							</div>
							<div>
								<p className="text-muted-foreground">Ação</p>
								<StatusBadge status={entry.action} map={AUDIT_ACTION_STATUS_MAP} />
							</div>
							<div>
								<p className="text-muted-foreground">Entidade</p>
								<p className="font-medium">{auditEntityLabel(entry.entityType)}</p>
							</div>
							<div>
								<p className="text-muted-foreground">Usuário</p>
								<p className="font-medium">{auditUserName(entry)}</p>
							</div>
							<div className="sm:col-span-2">
								<p className="text-muted-foreground">Descrição</p>
								<p className="font-medium">
									{auditDescription(entry.entityDescription, entry.action)}
								</p>
							</div>
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

						{entry.action === "STATUS_CHANGED" && (
							<div className="rounded-lg border border-border bg-muted/30 p-3">
								<p className="mb-2 text-sm font-medium">Transição de status</p>
								<div className="flex flex-wrap items-center gap-2 text-sm">
									<StatusBadge
										status={String(
											entry.metadata?.fromStatus ??
												entry.previousState?.status ??
												entry.previousState?.operationalStatus ??
												"",
										)}
										map={statusMapForEntity(entry.entityType)}
									/>
									<span aria-hidden="true">→</span>
									<StatusBadge
										status={String(
											entry.metadata?.toStatus ??
												entry.newState?.status ??
												entry.newState?.operationalStatus ??
												"",
										)}
										map={statusMapForEntity(entry.entityType)}
									/>
								</div>
							</div>
						)}

						{changes.length > 0 ? (
							<div className="space-y-2">
								<p className="text-sm font-medium">Alterações realizadas</p>
								<StateTable rows={changes} />
							</div>
						) : entry.action === "CREATE" && createdFields.length > 0 ? (
							<div className="space-y-2">
								<p className="text-sm font-medium">Dados registrados</p>
								<StateTable
									rows={createdFields}
									beforeLabel="Anterior"
									afterLabel="Registrado"
								/>
							</div>
						) : entry.action === "DELETE" && deletedFields.length > 0 ? (
							<div className="space-y-2">
								<p className="text-sm font-medium">Dados antes da exclusão</p>
								<StateTable rows={deletedFields} />
							</div>
						) : (
							<p className="rounded-lg border p-3 text-sm text-muted-foreground">
								Não há alterações de campos para exibir neste registro.
							</p>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
