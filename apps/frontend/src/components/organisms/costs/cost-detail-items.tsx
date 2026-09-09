import { Layers3, PackageOpen, Search, X } from "lucide-react";
import { Fragment, useState } from "react";
import type { CostItem } from "@/api/costs";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	CATEGORY_LABEL,
	COST_TYPE_LABEL,
	formatCurrency,
	formatDate,
	naturalSortIndex,
	PAYMENT_STATUS_LABEL,
} from "@/utils/format";

type CostGroup = {
	key: string;
	index: string | null;
	description: string;
	items: CostItem[];
	total: number;
};

function getBudgetIndex(item: CostItem): string | null {
	return (
		item.budgetVersionItem?.index ??
		item.budgetItem?.index ??
		item.budgetIndex ??
		null
	);
}

function getBudgetDescription(item: CostItem): string {
	return (
		item.budgetVersionItem?.description ?? item.budgetItem?.description ?? ""
	);
}

function getStageIndex(index: string | null): string | null {
	if (!index) return null;
	const parts = index.split(".");
	return parts.length > 1 ? parts.slice(0, 2).join(".") : index;
}

function getStageDescription(
	items: CostItem[],
	stageIndex: string | null,
): string {
	if (!stageIndex) return "";
	const stageItem = items.find((item) => getBudgetIndex(item) === stageIndex);
	if (stageItem) return getBudgetDescription(stageItem);

	const linkedStage = items.find((item) => {
		const parent =
			item.budgetVersionItem?.parentVersion ?? item.budgetItem?.parent;
		return parent?.index === stageIndex;
	});
	return linkedStage
		? (linkedStage.budgetVersionItem?.parentVersion?.description ??
				linkedStage.budgetItem?.parent?.description ??
				"")
		: "";
}

function buildCostGroups(items: CostItem[]): CostGroup[] {
	const groups = new Map<string, CostGroup>();
	for (const item of items) {
		const index = getStageIndex(getBudgetIndex(item));
		const key = index ?? "unallocated";
		const group = groups.get(key);
		if (group) {
			group.items.push(item);
			group.total += Number(item.amount);
			continue;
		}
		groups.set(key, {
			key,
			index,
			description: "",
			items: [item],
			total: Number(item.amount),
		});
	}

	return [...groups.values()]
		.map((group) => ({
			...group,
			description: getStageDescription(group.items, group.index),
		}))
		.sort((a, b) => {
			if (a.index === null) return 1;
			if (b.index === null) return -1;
			return naturalSortIndex(a.index, b.index);
		});
}

function categoryTone(category: string): BadgeTone {
	if (category === "MATERIAL") return "info";
	if (category === "MAO_DE_OBRA" || category === "LABOR") return "success";
	if (category === "EQUIPAMENTO" || category === "EQUIPMENT") return "warning";
	return "neutral";
}

function matchesSearch(item: CostItem, query: string): boolean {
	const searchableText = [
		getBudgetIndex(item),
		getBudgetDescription(item),
		item.budgetVersionItem?.parentVersion?.index,
		item.budgetVersionItem?.parentVersion?.description,
		item.budgetItem?.parent?.index,
		item.budgetItem?.parent?.description,
		item.description,
		item.category,
		CATEGORY_LABEL[item.category],
		item.categoryDetail,
		item.supplier?.name,
		item.supplierName,
		COST_TYPE_LABEL[item.costType],
		PAYMENT_STATUS_LABEL[item.paymentStatus],
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
	return searchableText.includes(query);
}

function EmptyItems({ filtered }: { filtered: boolean }) {
	return (
		<div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
			<PackageOpen className="mx-auto mb-2 size-8 text-muted-foreground/50" />
			<p className="text-sm font-medium">
				{filtered ? "Nenhum item corresponde à busca" : "Nenhum item de custo"}
			</p>
			<p className="mt-1 text-xs text-muted-foreground">
				{filtered
					? "Tente buscar por outro termo."
					: "Este custo ainda não possui lançamentos detalhados."}
			</p>
		</div>
	);
}

export function CostDetailItems({
	items,
	totalAmount,
}: {
	items: CostItem[];
	totalAmount: number;
}) {
	const [searchQuery, setSearchQuery] = useState("");
	const normalizedSearch = searchQuery.trim().toLowerCase();
	const filteredItems = normalizedSearch
		? items.filter((item) => matchesSearch(item, normalizedSearch))
		: items;
	const groups = buildCostGroups(filteredItems);
	const filteredTotal = filteredItems.reduce(
		(sum, item) => sum + Number(item.amount),
		0,
	);

	return (
		<Card className="gap-4 py-5">
			<CardHeaderWithIcon
				icon={Layers3}
				title={`Itens de custo (${filteredItems.length}${normalizedSearch ? ` de ${items.length}` : ""})`}
				description="Agrupados pelo vínculo orçamentário, como no orçamento da obra."
			/>
			<CardContent className="px-4 sm:px-6">
				<div className="mb-4 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="relative w-full sm:max-w-xl">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
							placeholder="Buscar por índice, descrição, categoria ou fornecedor..."
							aria-label="Buscar itens de custo"
							className="h-10 rounded-xl pl-9 pr-10"
						/>
						{searchQuery ? (
							<button
								type="button"
								aria-label="Limpar busca"
								onClick={() => setSearchQuery("")}
								className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<X className="size-4" />
							</button>
						) : null}
					</div>
					<p className="shrink-0 text-xs text-muted-foreground">
						{filteredItems.length} de {items.length} item(ns)
					</p>
				</div>

				{groups.length === 0 ? (
					<EmptyItems filtered={Boolean(normalizedSearch)} />
				) : (
					<>
						<div className="hidden max-h-[620px] overflow-y-auto overflow-x-hidden rounded-xl border border-border md:block">
							<Table className="w-full table-fixed">
								<TableHeader>
									<TableRow>
										<TableHead className="w-[10%]">Índice</TableHead>
										<TableHead className="w-[14%]">Categoria</TableHead>
										<TableHead className="w-[34%]">Descrição</TableHead>
										<TableHead className="w-[18%]">Data e tipo</TableHead>
										<TableHead className="w-[15%]">Pagamento</TableHead>
										<TableHead className="w-[12%] text-right">Valor</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{groups.map((group) => (
										<Fragment key={group.key}>
											<TableRow className="bg-muted/40 hover:bg-muted/40">
												<TableCell colSpan={6} className="px-3 py-3">
													<div className="flex min-w-0 items-center justify-between gap-3">
														<div className="flex min-w-0 items-center gap-3">
															<span className="shrink-0 rounded-xl bg-primary/10 px-2.5 py-1 font-mono text-xs font-bold text-primary">
																{group.index ?? "N/A"}
															</span>
															<div className="min-w-0">
																<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
																	Etapa do orçamento
																</p>
																{group.description ? (
																	<p className="truncate text-sm font-semibold">
																		{group.description}
																	</p>
																) : null}
															</div>
														</div>
														<div className="shrink-0 text-right">
															<p className="text-sm font-semibold">
																{formatCurrency(group.total)}
															</p>
															<p className="text-[11px] text-muted-foreground">
																{group.items.length} item(ns)
															</p>
														</div>
													</div>
												</TableCell>
											</TableRow>
											{group.items.map((item) => (
												<TableRow key={item.id}>
													<TableCell className="font-mono text-xs text-muted-foreground">
														{getBudgetIndex(item) ?? "-"}
													</TableCell>
													<TableCell>
														<Badge
															variant="outline"
															tone={categoryTone(item.category)}
														>
															{CATEGORY_LABEL[item.category] ?? item.category}
														</Badge>
														{item.categoryDetail ? (
															<p className="mt-1 truncate text-xs text-muted-foreground">
																{item.categoryDetail}
															</p>
														) : null}
													</TableCell>
													<TableCell className="break-words">
														<p className="font-medium text-foreground">
															{item.description ?? "Sem descrição"}
														</p>
														{item.supplier?.name || item.supplierName ? (
															<p className="mt-1 text-xs text-muted-foreground">
																Fornecedor:{" "}
																{item.supplier?.name ?? item.supplierName}
															</p>
														) : null}
													</TableCell>
													<TableCell>
														<div className="space-y-1">
															<p className="font-medium">
																{formatDate(item.costDate)}
															</p>
															<Badge
																variant="outline"
																tone={
																	item.costType === "FUTURE"
																		? "warning"
																		: "success"
																}
															>
																{COST_TYPE_LABEL[item.costType] ??
																	item.costType}
															</Badge>
														</div>
													</TableCell>
													<TableCell>
														<Badge
															variant="outline"
															tone={
																item.paymentStatus === "PAID"
																	? "success"
																	: "warning"
															}
														>
															{PAYMENT_STATUS_LABEL[item.paymentStatus] ??
																item.paymentStatus}
														</Badge>
													</TableCell>
													<TableCell className="text-right font-semibold">
														{formatCurrency(Number(item.amount))}
													</TableCell>
												</TableRow>
											))}
										</Fragment>
									))}
								</TableBody>
								<TableFooter>
									<TableRow>
										<TableCell colSpan={5} className="text-right font-semibold">
											{normalizedSearch ? "Total filtrado" : "Total do custo"}
										</TableCell>
										<TableCell className="text-right font-bold text-primary">
											{formatCurrency(
												normalizedSearch ? filteredTotal : totalAmount,
											)}
										</TableCell>
									</TableRow>
								</TableFooter>
							</Table>
						</div>

						<div className="max-h-[620px] space-y-3 overflow-y-auto overflow-x-hidden md:hidden">
							{groups.map((group) => (
								<section
									key={group.key}
									className="overflow-hidden rounded-xl border border-border"
								>
									<div className="flex items-start justify-between gap-3 bg-muted/40 px-3 py-3">
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<span className="rounded-xl bg-primary/10 px-2 py-1 font-mono text-xs font-bold text-primary">
													{group.index ?? "N/A"}
												</span>
												<span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
													Etapa
												</span>
											</div>
											{group.description ? (
												<p className="mt-1 truncate text-sm font-semibold">
													{group.description}
												</p>
											) : null}
											<p className="mt-1 text-xs text-muted-foreground">
												{group.items.length} lançamento(s)
											</p>
										</div>
										<span className="shrink-0 text-sm font-semibold">
											{formatCurrency(group.total)}
										</span>
									</div>
									<div className="divide-y divide-border">
										{group.items.map((item) => (
											<article key={item.id} className="space-y-3 bg-card p-3">
												<div className="flex items-start justify-between gap-3">
													<div className="min-w-0">
														<p className="mb-1 font-mono text-[11px] text-muted-foreground">
															Índice {getBudgetIndex(item) ?? "-"}
														</p>
														<Badge
															variant="outline"
															tone={categoryTone(item.category)}
														>
															{CATEGORY_LABEL[item.category] ?? item.category}
														</Badge>
														<p className="mt-2 break-words text-sm font-medium">
															{item.description ?? "Sem descrição"}
														</p>
													</div>
													<span className="shrink-0 text-sm font-bold">
														{formatCurrency(Number(item.amount))}
													</span>
												</div>
												<div className="grid grid-cols-2 gap-2 text-xs">
													<div className="rounded-xl bg-muted/40 p-2">
														<p className="text-muted-foreground">Data</p>
														<p className="mt-1 font-medium">
															{formatDate(item.costDate)}
														</p>
													</div>
													<div className="rounded-xl bg-muted/40 p-2">
														<p className="text-muted-foreground">Pagamento</p>
														<p className="mt-1 font-medium">
															{PAYMENT_STATUS_LABEL[item.paymentStatus] ??
																item.paymentStatus}
														</p>
													</div>
												</div>
												<div className="flex flex-wrap items-center gap-2">
													<Badge
														variant="outline"
														tone={
															item.costType === "FUTURE" ? "warning" : "success"
														}
													>
														{COST_TYPE_LABEL[item.costType] ?? item.costType}
													</Badge>
													{item.supplier?.name || item.supplierName ? (
														<span className="max-w-full break-words text-xs text-muted-foreground">
															Fornecedor:{" "}
															{item.supplier?.name ?? item.supplierName}
														</span>
													) : null}
												</div>
											</article>
										))}
									</div>
								</section>
							))}
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
