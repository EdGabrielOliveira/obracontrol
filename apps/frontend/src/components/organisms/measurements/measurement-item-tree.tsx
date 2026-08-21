import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { MeasurementTreeItem } from "@/types/measurements";
import { formatCurrency, formatPercentage } from "@/utils/format";

type MeasurementItemTreeProps = {
	items: MeasurementTreeItem[];
	totals: {
		current: { measuredValue: number };
		accumulated: { measuredValue: number };
		balance: { value: number };
	} | null;
};

export function MeasurementItemTree({
	items,
	totals,
}: MeasurementItemTreeProps) {
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

	const toggleExpand = useCallback((id: string) => {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	return (
		<div className="overflow-x-auto">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-10" />
						<TableHead>Índice</TableHead>
						<TableHead>Descrição</TableHead>
						<TableHead className="text-right">% Atual</TableHead>
						<TableHead className="text-right">Valor Atual</TableHead>
						<TableHead className="text-right">% Acum.</TableHead>
						<TableHead className="text-right">Valor Acum.</TableHead>
						<TableHead className="text-right">Saldo</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{items.length === 0 ? (
						<TableRow>
							<TableCell
								colSpan={8}
								className="py-8 text-center text-muted-foreground"
							>
								Nenhum item.
							</TableCell>
						</TableRow>
					) : (
						renderDetailTreeRows(items, 0, expandedIds, toggleExpand)
					)}
				</TableBody>
			</Table>
			{totals && (
				<div className="mt-4 grid grid-cols-3 gap-4 rounded-lg border p-4">
					<div>
						<p className="text-xs text-muted-foreground">
							Atual (esta medição)
						</p>
						<p className="text-sm font-medium">
							{formatCurrency(totals.current.measuredValue)}
						</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">Acumulado</p>
						<p className="text-sm font-medium">
							{formatCurrency(totals.accumulated.measuredValue)}
						</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">Saldo</p>
						<p className="text-sm font-medium">
							{formatCurrency(totals.balance.value)}
						</p>
					</div>
				</div>
			)}
		</div>
	);
}

function renderDetailTreeRows(
	items: MeasurementTreeItem[],
	depth: number,
	expandedIds: Set<string>,
	onToggleExpand: (id: string) => void,
): ReactNode[] {
	return items.flatMap((item) => {
		const hasChildren = item.children.length > 0;
		const isExpanded = expandedIds.has(item.id);
		const rows: ReactNode[] = [];

		rows.push(
			<TableRow key={item.id} className={depth === 0 ? "bg-muted/50" : ""}>
				<TableCell className="w-10">
					<span
						style={{ paddingLeft: `${depth * 1.5}rem` }}
						className="flex items-center"
					>
						{hasChildren ? (
							<button
								type="button"
								onClick={() => onToggleExpand(item.id)}
								className="rounded p-0.5 transition-colors"
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
				<TableCell className="font-mono text-xs">{item.index}</TableCell>
				<TableCell className={depth === 0 ? "font-semibold" : ""}>
					{item.description}
				</TableCell>
				<TableCell className="text-right">
					{formatPercentage(item.measuredCurrent.percentage)}
				</TableCell>
				<TableCell className="text-right font-medium">
					{formatCurrency(item.measuredCurrent.value)}
				</TableCell>
				<TableCell className="text-right">
					{formatPercentage(item.measuredAccumulated.percentage)}
				</TableCell>
				<TableCell className="text-right font-medium">
					{formatCurrency(item.measuredAccumulated.value)}
				</TableCell>
				<TableCell className="text-right">
					{formatCurrency(item.balanceToMeasure.value)}
				</TableCell>
			</TableRow>,
		);

		if (hasChildren && isExpanded) {
			rows.push(
				...renderDetailTreeRows(
					item.children,
					depth + 1,
					expandedIds,
					onToggleExpand,
				),
			);
		}

		return rows;
	});
}
