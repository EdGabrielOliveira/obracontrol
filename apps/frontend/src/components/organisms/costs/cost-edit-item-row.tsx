import { ChevronDown, ChevronRight, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CostItem, UpdateActualCostInput } from "@/api/costs";
import {
	categoryTone,
	paymentStatusTone,
} from "@/components/organisms/costs/cost-item-presentation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	COST_CATEGORY_OPTIONS,
	COST_PAYMENT_STATUS_OPTIONS,
	COST_TYPE_OPTIONS,
} from "@/constants/status-options";
import type { CostBudgetItemOption } from "@/types/measurements";
import type { WorkSupplier } from "@/types/suppliers";
import {
	CATEGORY_LABEL,
	formatCurrency,
	formatQuantity,
	toDateInputValue,
} from "@/utils/format";
import { getBudgetIndex } from "./cost-item-groups";

type Draft = {
	amount: string;
	category: string;
	categoryDetail: string;
	description: string;
	costDate: string;
	costType: "CURRENT" | "FUTURE";
	supplierId: string;
	paymentStatus: "PAID" | "OPEN";
};

type EditableField = keyof Draft;

function parseAmount(value: string): number | null {
	const parsed = Number(value.replace(",", "."));
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toDraft(item: CostItem): Draft {
	return {
		amount: String(item.amount),
		category: item.category,
		categoryDetail: item.categoryDetail ?? "",
		description: item.description ?? "",
		costDate: toDateInputValue(item.costDate),
		costType: item.costType === "FUTURE" ? "FUTURE" : "CURRENT",
		supplierId: item.supplierId ?? "",
		paymentStatus:
			item.costType === "FUTURE"
				? "OPEN"
				: item.paymentStatus === "PAID"
					? "PAID"
					: "OPEN",
	};
}

function InlineSelect({
	id,
	value,
	options,
	placeholder,
	disabled,
	onChange,
}: {
	id: string;
	value: string;
	options: ReadonlyArray<{ id: string; value: string; label: string }>;
	placeholder: string;
	disabled?: boolean;
	onChange: (value: string) => void;
}) {
	return (
		<Select value={value} onValueChange={onChange} disabled={disabled}>
			<SelectTrigger
				id={id}
				className="h-10 w-full justify-between rounded-xl bg-background text-sm"
			>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent className="max-h-60">
				<SelectGroup>
					{options.map((option) => (
						<SelectItem key={option.id} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}

function FieldLabel({
	htmlFor,
	children,
}: {
	htmlFor: string;
	children: string;
}) {
	return (
		<label
			htmlFor={htmlFor}
			className="mb-1.5 block text-xs font-medium text-muted-foreground"
		>
			{children}
		</label>
	);
}

export function CostEditItemRow({
	item,
	budgetItem,
	suppliers,
	saving,
	disabled = false,
	onPatch,
}: {
	item: CostItem;
	budgetItem?: CostBudgetItemOption;
	suppliers: WorkSupplier[];
	saving: boolean;
	disabled?: boolean;
	onPatch: (patch: UpdateActualCostInput) => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const [draft, setDraft] = useState(() => toDraft(item));
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingPatch = useRef<UpdateActualCostInput>({});

	useEffect(() => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
		pendingPatch.current = {};
		setDraft(toDraft(item));
	}, [item]);

	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
		},
		[],
	);

	const flush = () => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
		if (Object.keys(pendingPatch.current).length === 0) return;
		onPatch(pendingPatch.current);
		pendingPatch.current = {};
	};

	const schedule = (patch: UpdateActualCostInput) => {
		pendingPatch.current = { ...pendingPatch.current, ...patch };
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(flush, 650);
	};

	const updateField = (field: EditableField, value: string) => {
		const nextDraft = { ...draft, [field]: value } as Draft;
		if (field === "costType" && value === "FUTURE") {
			nextDraft.paymentStatus = "OPEN";
		}
		setDraft(nextDraft);

		if (field === "amount") {
			const amount = parseAmount(value);
			if (amount === null) return;
			schedule({ amount });
			return;
		}
		if (field === "supplierId") {
			schedule({ supplierId: value || null });
			return;
		}
		if (field === "costType") {
			schedule({
				costType: value,
				...(value === "FUTURE" ? { paymentStatus: "OPEN" } : {}),
			});
			return;
		}
		if (field === "paymentStatus") {
			schedule({ paymentStatus: value });
			return;
		}
		schedule({ [field]: value });
	};

	const handleBlur = (field: EditableField) => {
		if (field === "amount" && parseAmount(draft.amount) === null) {
			setDraft((current) => ({ ...current, amount: String(item.amount) }));
		}
		flush();
	};

	return (
		<article className="border-t border-border first:border-t-0">
			<button
				type="button"
				className="flex min-h-16 w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
				onClick={() => setExpanded((current) => !current)}
				aria-expanded={expanded}
				disabled={disabled}
			>
				{expanded ? (
					<ChevronDown className="size-4 shrink-0 text-primary" />
				) : (
					<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
				)}
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-mono text-xs text-muted-foreground">
							{getBudgetIndex(item) ?? "-"}
						</span>
						<Badge variant="outline" tone={categoryTone(draft.category)}>
							{CATEGORY_LABEL[draft.category] ?? draft.category}
						</Badge>
						<Badge
							variant="outline"
							tone={paymentStatusTone(draft.paymentStatus)}
						>
							{draft.paymentStatus === "PAID" ? "Pago" : "Em aberto"}
						</Badge>
						{draft.costType === "FUTURE" ? (
							<Badge variant="outline" tone="warning">
								Futuro
							</Badge>
						) : null}
					</div>
					<p className="mt-1 truncate text-sm font-medium">
						{draft.description || "Sem descrição"}
					</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Quantidade do orçamento:{" "}
						{budgetItem?.quantity == null
							? "—"
							: `${formatQuantity(budgetItem.quantity)}${budgetItem.unit ? ` ${budgetItem.unit}` : ""}`}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{saving ? (
						<LoaderCircle className="size-4 animate-spin text-primary" />
					) : null}
					<span className="text-sm font-bold text-foreground">
						{formatCurrency(parseAmount(draft.amount) ?? Number(item.amount))}
					</span>
				</div>
			</button>

			{expanded ? (
				<div className="grid gap-3 border-t border-border bg-muted/10 px-3 py-4 sm:grid-cols-2 lg:grid-cols-3">
					<div>
						<FieldLabel htmlFor={`cost-amount-${item.id}`}>
							Valor total
						</FieldLabel>
						<Input
							id={`cost-amount-${item.id}`}
							type="number"
							min="0.01"
							step="0.01"
							inputMode="decimal"
							value={draft.amount}
							disabled={disabled}
							onChange={(event) => updateField("amount", event.target.value)}
							onBlur={() => handleBlur("amount")}
							className="h-10 rounded-xl"
						/>
					</div>
					<div>
						<FieldLabel htmlFor={`cost-quantity-${item.id}`}>
							Quantidade do orçamento
						</FieldLabel>
						<Input
							id={`cost-quantity-${item.id}`}
							type="text"
							value={
								budgetItem?.quantity == null
									? "Não informada"
									: `${formatQuantity(budgetItem.quantity)}${budgetItem.unit ? ` ${budgetItem.unit}` : ""}`
							}
							readOnly
							className="h-10 rounded-xl bg-muted/30"
							aria-describedby={`cost-quantity-help-${item.id}`}
						/>
						<p
							id={`cost-quantity-help-${item.id}`}
							className="mt-1 text-[11px] text-muted-foreground"
						>
							Definida no orçamento vinculado.
						</p>
					</div>
					<div>
						<FieldLabel htmlFor={`cost-category-${item.id}`}>
							Categoria
						</FieldLabel>
						<InlineSelect
							id={`cost-category-${item.id}`}
							value={draft.category}
							disabled={disabled}
							options={COST_CATEGORY_OPTIONS}
							placeholder="Selecione"
							onChange={(value) => updateField("category", value)}
						/>
					</div>
					<div>
						<FieldLabel htmlFor={`cost-type-${item.id}`}>
							Tipo do custo
						</FieldLabel>
						<InlineSelect
							id={`cost-type-${item.id}`}
							value={draft.costType}
							disabled={disabled}
							options={COST_TYPE_OPTIONS}
							placeholder="Selecione"
							onChange={(value) => updateField("costType", value)}
						/>
					</div>
					<div>
						<FieldLabel htmlFor={`cost-payment-${item.id}`}>
							Pagamento
						</FieldLabel>
						<InlineSelect
							id={`cost-payment-${item.id}`}
							value={draft.paymentStatus}
							disabled={disabled}
							options={
								draft.costType === "FUTURE"
									? COST_PAYMENT_STATUS_OPTIONS.filter(
											(option) => option.value === "OPEN",
										)
									: COST_PAYMENT_STATUS_OPTIONS
							}
							placeholder="Selecione"
							onChange={(value) => updateField("paymentStatus", value)}
						/>
					</div>
					<div>
						<FieldLabel htmlFor={`cost-date-${item.id}`}>Data</FieldLabel>
						<Input
							id={`cost-date-${item.id}`}
							type="date"
							value={draft.costDate}
							disabled={disabled}
							onChange={(event) => updateField("costDate", event.target.value)}
							onBlur={() => handleBlur("costDate")}
							className="h-10 rounded-xl"
						/>
					</div>
					<div>
						<FieldLabel htmlFor={`cost-supplier-${item.id}`}>
							Fornecedor
						</FieldLabel>
						<InlineSelect
							id={`cost-supplier-${item.id}`}
							value={draft.supplierId || "none"}
							disabled={disabled}
							options={[
								{ id: "none", value: "none", label: "Sem fornecedor" },
								...suppliers.map((supplier) => ({
									id: supplier.supplierId,
									value: supplier.supplierId,
									label: supplier.supplier.name,
								})),
							]}
							placeholder="Selecione"
							onChange={(value) =>
								updateField("supplierId", value === "none" ? "" : value)
							}
						/>
					</div>
					{draft.category === "OUTROS" || draft.categoryDetail ? (
						<div>
							<FieldLabel htmlFor={`cost-category-detail-${item.id}`}>
								Detalhe da categoria
							</FieldLabel>
							<Input
								id={`cost-category-detail-${item.id}`}
								value={draft.categoryDetail}
								disabled={disabled}
								onChange={(event) =>
									updateField("categoryDetail", event.target.value)
								}
								onBlur={() => handleBlur("categoryDetail")}
								placeholder="Ex.: Taxas e licenças"
								className="h-10 rounded-xl"
							/>
						</div>
					) : null}
					<div className="sm:col-span-2 lg:col-span-3">
						<FieldLabel htmlFor={`cost-description-${item.id}`}>
							Descrição / observação
						</FieldLabel>
						<Textarea
							id={`cost-description-${item.id}`}
							value={draft.description}
							disabled={disabled}
							onChange={(event) =>
								updateField("description", event.target.value)
							}
							onBlur={() => handleBlur("description")}
							rows={2}
							className="min-h-20 rounded-xl bg-background"
						/>
					</div>
				</div>
			) : null}
		</article>
	);
}
