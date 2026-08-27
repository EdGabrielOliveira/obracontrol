import {
	Archive,
	BadgeCheck,
	ChevronDown,
	ChevronRight,
	FileClock,
	Plus,
	Send,
} from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { StatusBadge } from "@/atoms/status-badge";
import { BUDGET_VERSION_STATUS_MAP } from "@/components/atoms/status-badge";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { BudgetVersionDetail, BudgetVersionSummary } from "@/types/budget";
import {
	formatCurrency,
	formatQuantity,
	naturalSortIndex,
} from "@/utils/format";

type Props = {
	versions: BudgetVersionSummary[];
	details: ReadonlyMap<string, BudgetVersionDetail | null>;
	loadingVersionIds: ReadonlySet<string>;
	openVersionId: string | null;
	canWrite: boolean;
	canApprove: boolean;
	submitPending: boolean;
	archivePending: boolean;
	onCreateAditivo: () => void;
	onOpenChange?: (versionId: string | null) => void;
	onSubmitVersion: (versionId: string, reason: string) => void;
	onArchiveVersion: (versionId: string, reason: string) => void;
};

function versionKind(version: BudgetVersionSummary) {
	return version.kind === "ADITIVO" || version.sourceVersionId
		? "Aditivo"
		: "Original";
}

export function getVersionedItemIndex(itemIndex: string) {
	return itemIndex;
}

export function sortBudgetVersionItems<T extends { index: string }>(
	items: T[],
) {
	return [...items].sort((left, right) =>
		naturalSortIndex(left.index, right.index),
	);
}

export function getBudgetValueTone(
	current: number | null,
	previous: number | null,
) {
	if (previous === null) return current === null ? "same" : "new";
	if (current === null || current === previous) return "same";
	return current > previous ? "increase" : "decrease";
}

type VersionItemNode = BudgetVersionDetail["items"][number] & {
	children: VersionItemNode[];
};

type VersionItemAggregate = {
	quantity: number | null;
	totalCost: number;
};

function buildVersionItemTree(items: BudgetVersionDetail["items"]) {
	const nodes = sortBudgetVersionItems(items).map(
		(item) => ({ ...item, children: [] }) as VersionItemNode,
	);
	const byIndex = new Map(nodes.map((node) => [node.index, node]));
	const roots: VersionItemNode[] = [];

	for (const node of nodes) {
		const parent = node.parentIndex ? byIndex.get(node.parentIndex) : undefined;
		if (parent) parent.children.push(node);
		else roots.push(node);
	}

	return roots;
}

function getVersionItemAggregate(item: VersionItemNode): VersionItemAggregate {
	if (item.children.length === 0) {
		return {
			quantity: item.quantity,
			totalCost: item.totalCost ?? 0,
		};
	}

	const aggregate = item.children.reduce<VersionItemAggregate>(
		(sum, child) => {
			const childAggregate = getVersionItemAggregate(child);
			return {
				quantity:
					sum.quantity === null || childAggregate.quantity === null
						? null
						: sum.quantity + childAggregate.quantity,
				totalCost: sum.totalCost + childAggregate.totalCost,
			};
		},
		{ quantity: 0, totalCost: 0 },
	);

	return aggregate;
}

function getVersionItemAggregates(
	items: VersionItemNode[],
): Map<string, VersionItemAggregate> {
	return new Map(
		items.flatMap((item) => {
			const descendants: Array<[string, VersionItemAggregate]> = Array.from(
				getVersionItemAggregates(item.children),
			);
			const current: [string, VersionItemAggregate] = [
				item.index,
				getVersionItemAggregate(item),
			];
			return [current, ...descendants];
		}),
	);
}

function VersionSummary({
	version,
	detail,
}: {
	version: BudgetVersionSummary;
	detail: BudgetVersionDetail | null;
}) {
	return (
		<div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
			<span>
				Total:{" "}
				{formatCurrency(version.totalCost ?? detail?.totals.totalCost ?? 0)}
			</span>
			<span>
				Acréscimo:{" "}
				{version.acrescimoBruto == null
					? "-"
					: formatCurrency(version.acrescimoBruto)}
			</span>
			<span>
				Supressão:{" "}
				{version.supressao == null ? "-" : formatCurrency(version.supressao)}
			</span>
			<span>
				Impacto:{" "}
				{version.impactoLiquido == null
					? "-"
					: formatCurrency(version.impactoLiquido)}
			</span>
		</div>
	);
}

function ComparisonValue({
	current,
	previous,
	enabled,
	format = (value) => value.toLocaleString("pt-BR"),
}: {
	current: number | null;
	previous: number | null;
	enabled: boolean;
	format?: (value: number) => string;
}) {
	const tone = enabled ? getBudgetValueTone(current, previous) : "same";
	const toneClass =
		tone === "increase"
			? "text-destructive"
			: tone === "decrease"
				? "text-success"
				: tone === "new"
					? "text-primary"
					: "";

	return (
		<div
			className={toneClass}
			title={previous === null ? undefined : `Anterior: ${format(previous)}`}
		>
			<div>{current === null ? "-" : format(current)}</div>
			{enabled && previous !== null ? (
				<div className="text-xs font-normal text-muted-foreground">
					Ant.: {format(previous)}
				</div>
			) : null}
		</div>
	);
}

function VersionItems({
	version,
	detail,
	sourceDetail,
}: {
	version: BudgetVersionSummary;
	detail: BudgetVersionDetail;
	sourceDetail: BudgetVersionDetail | null;
}) {
	const roots = buildVersionItemTree(detail.items);
	const aggregatesByIndex = getVersionItemAggregates(roots);
	const sourceRoots = buildVersionItemTree(sourceDetail?.items ?? []);
	const sourceAggregatesByIndex = getVersionItemAggregates(sourceRoots);
	const _versionIndex = version.index ?? String(version.version);
	const sourceByIndex = new Map(
		(sourceDetail?.items ?? []).map((item) => [item.index, item]),
	);
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
	const toggleExpand = useCallback((id: string) => {
		setExpandedIds((previous) => {
			const next = new Set(previous);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	const renderRows = (items: VersionItemNode[], depth: number): ReactNode[] =>
		items.flatMap((item) => {
			const hasChildren = item.children.length > 0;
			const isExpanded = expandedIds.has(item.id);
			const previous = sourceByIndex.get(item.index);
			const aggregate = aggregatesByIndex.get(item.index);
			const previousAggregate = sourceAggregatesByIndex.get(item.index);
			const verifyUnit = item.unit === "vb";

			const rows: ReactNode[] = [
				<TableRow key={item.id} className={depth === 0 ? "bg-muted/50" : ""}>
					<TableCell className="w-10">
						<span
							style={{ paddingLeft: `${depth * 1.5}rem` }}
							className="flex items-center"
						>
							{hasChildren ? (
								<button
									type="button"
									onClick={() => toggleExpand(item.id)}
									className="rounded p-0.5 transition-colors"
									aria-label={`${isExpanded ? "Recolher" : "Expandir"} ${item.description}`}
								>
									{isExpanded ? (
										<ChevronDown className="h-3.5 w-3.5 text-primary" />
									) : (
										<ChevronRight className="h-3.5 w-3.5 text-primary" />
									)}
								</button>
							) : (
								<span className="w-5" />
							)}
						</span>
					</TableCell>
					<TableCell className="font-mono text-xs">
						{getVersionedItemIndex(item.index)}
					</TableCell>
					<TableCell className={depth === 0 ? "font-semibold py-4" : ""}>
						{item.description}
					</TableCell>
					<TableCell>{verifyUnit ? "-" : (item.unit ?? "-")}</TableCell>
					<TableCell className="text-right">
						<ComparisonValue
							current={hasChildren ? null : item.unitCost}
							previous={hasChildren ? null : (previous?.unitCost ?? null)}
							enabled={sourceDetail !== null}
							format={(value) => formatCurrency(value)}
						/>
					</TableCell>
					<TableCell className="text-right">
						<ComparisonValue
							current={aggregate?.quantity ?? item.quantity}
							previous={
								previousAggregate?.quantity ?? previous?.quantity ?? null
							}
							enabled={sourceDetail !== null}
							format={formatQuantity}
						/>
					</TableCell>
					<TableCell className="text-right font-medium">
						{formatCurrency(aggregate?.totalCost ?? item.totalCost ?? 0)}
					</TableCell>
				</TableRow>,
			];

			if (hasChildren && isExpanded) {
				rows.push(...renderRows(item.children, depth + 1));
			}
			return rows;
		});

	return (
		<div className="overflow-x-auto">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-10" />
						<TableHead>Índice</TableHead>
						<TableHead>Descrição</TableHead>
						<TableHead>Unidade</TableHead>
						<TableHead className="text-right">Preço unitário</TableHead>
						<TableHead className="text-right">Quantidade</TableHead>
						<TableHead className="text-right">Valor total</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{roots.length === 0 ? (
						<TableRow>
							<TableCell
								colSpan={7}
								className="py-8 text-center text-muted-foreground"
							>
								Nenhum item.
							</TableCell>
						</TableRow>
					) : (
						renderRows(roots, 0)
					)}
				</TableBody>
			</Table>
		</div>
	);
}

export function BudgetVersionAccordion({
	versions,
	details,
	loadingVersionIds,
	openVersionId,
	canWrite,
	canApprove,
	submitPending,
	archivePending,
	onCreateAditivo,
	onOpenChange,
	onSubmitVersion,
	onArchiveVersion,
}: Props) {
	const [submittingId, setSubmittingId] = useState<string | null>(null);
	const [reason, setReason] = useState("");

	return (
		<Card>
			<CardHeaderWithIcon
				icon={FileClock}
				title="Orçamentos e aditivos"
				description="Versões aprovadas e alterações do orçamento."
				actions={
					canWrite ? (
						<Button size="sm" onClick={onCreateAditivo}>
							<Plus className="mr-2 h-4 w-4" />
							Novo aditivo
						</Button>
					) : null
				}
			/>
			<CardContent>
				{versions.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Nenhuma versão de orçamento registrada.
					</p>
				) : (
					<Accordion
						type="single"
						collapsible
						value={openVersionId ?? ""}
						onValueChange={(value) => onOpenChange?.(value || null)}
						className="space-y-3"
					>
						{versions.map((version) => {
							const detail = details.get(version.id);
							const isLoading = loadingVersionIds.has(version.id);
							return (
								<AccordionItem
									key={version.id}
									value={version.id}
									className="rounded-xl border border-border px-4"
								>
									<AccordionTrigger className="hover:no-underline">
										<div className="min-w-0 space-y-2 text-left">
											<div className="flex flex-wrap items-center gap-2">
												<span className="font-medium">
													{version.index} - Orçamento inicial
												</span>
												<Badge variant="outline">{versionKind(version)}</Badge>
												<StatusBadge
													status={version.status}
													map={BUDGET_VERSION_STATUS_MAP}
												/>
												{version.isActive ? (
													<BadgeCheck
														className="h-4 w-4 text-primary"
														aria-label="Versão atual"
													/>
												) : null}
											</div>
											<VersionSummary
												version={version}
												detail={detail ?? null}
											/>
										</div>
									</AccordionTrigger>
									<AccordionContent className="space-y-3">
										{isLoading ? (
											<p className="text-sm text-muted-foreground">
												Carregando snapshot...
											</p>
										) : detail ? (
											<VersionItems
												version={version}
												detail={detail}
												sourceDetail={
													version.sourceVersionId
														? (details.get(version.sourceVersionId) ?? null)
														: null
												}
											/>
										) : (
											<p className="text-sm text-muted-foreground">
												Snapshot indisponível para consulta.
											</p>
										)}
										{canWrite && version.status === "DRAFT" ? (
											<div className="flex flex-wrap items-center gap-2">
												{submittingId === version.id ? (
													<>
														<Input
															value={reason}
															onChange={(event) =>
																setReason(event.target.value)
															}
															placeholder="Motivo (opcional)"
															className="w-56"
														/>
														<Button
															size="sm"
															loading={submitPending}
															onClick={() => {
																onSubmitVersion(version.id, reason.trim());
																setSubmittingId(null);
																setReason("");
															}}
														>
															Confirmar submissão
														</Button>
													</>
												) : (
													<Button
														size="sm"
														variant="outline"
														onClick={() => setSubmittingId(version.id)}
													>
														<Send className="mr-2 h-4 w-4" />
														Submeter para aprovação
													</Button>
												)}
											</div>
										) : null}
										{canApprove &&
										["DRAFT", "REJECTED", "SUPERSEDED"].includes(
											version.status,
										) ? (
											<div className="flex flex-wrap items-center gap-2">
												{submittingId === `archive:${version.id}` ? (
													<>
														<Input
															value={reason}
															onChange={(event) =>
																setReason(event.target.value)
															}
															placeholder="Motivo do arquivamento"
															className="w-56"
														/>
														<Button
															size="sm"
															variant="outline"
															loading={archivePending}
															disabled={!reason.trim()}
															onClick={() => {
																onArchiveVersion(version.id, reason.trim());
																setSubmittingId(null);
																setReason("");
															}}
														>
															Confirmar arquivamento
														</Button>
													</>
												) : (
													<Button
														size="sm"
														variant="ghost"
														onClick={() => {
															setSubmittingId(`archive:${version.id}`);
															setReason("");
														}}
													>
														<Archive className="mr-2 h-4 w-4" />
														Arquivar versão
													</Button>
												)}
											</div>
										) : null}
									</AccordionContent>
								</AccordionItem>
							);
						})}
					</Accordion>
				)}
			</CardContent>
		</Card>
	);
}
