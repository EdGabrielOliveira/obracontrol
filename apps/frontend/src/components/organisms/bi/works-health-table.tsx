import { Building2, CheckSquare, Square } from "lucide-react";
import { DataSection } from "@/components/atoms/data-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { MultiworksBIResponse } from "@/types/bi";
import {
	classifyBalance,
	classifyIndex,
	HEALTH_TONE,
} from "@/utils/evm-health";
import { formatCurrency, formatRatioAsPercentage } from "@/utils/format";

interface WorksHealthTableProps {
	works: MultiworksBIResponse["works"];
	selected: Set<string>;
	allSelected: boolean;
	onToggle: (workId: string) => void;
	onToggleAll: () => void;
}

export function WorksHealthTable({
	works,
	selected,
	allSelected,
	onToggle,
	onToggleAll,
}: WorksHealthTableProps) {
	return (
		<DataSection
			title="Obras consideradas"
			icon={Building2}
			description="Obras incluídas na análise"
		>
			<div className="mb-3 flex items-center gap-2">
				<Button variant="ghost" size="sm" onClick={onToggleAll}>
					{allSelected ? (
						<CheckSquare className="mr-2 h-4 w-4" />
					) : (
						<Square className="mr-2 h-4 w-4" />
					)}
					{selected.size === 0
						? "Todas as obras"
						: `${selected.size} obra(s) selecionada(s)`}
				</Button>
			</div>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-12" />
						<TableHead>Obra</TableHead>
						<TableHead className="w-40">Progresso</TableHead>
						<TableHead className="w-28 text-right">SPI</TableHead>
						<TableHead className="w-28 text-right">CPI</TableHead>
						<TableHead className="text-right">Saldo atual</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{works.map((work) => {
						const isSelected = selected.has(work.workId);
						const spiTone = classifyIndex(work.schedulePerformanceIndex);
						const cpiTone = classifyIndex(work.costPerformanceIndex);
						const balanceTone = classifyBalance(work.currentBudgetBalance);
						const measuredWidth = `${Math.min(
							Math.max(work.measuredPercentage * 100, 2),
							100,
						)}%`;
						return (
							<TableRow
								key={work.workId}
								className="cursor-pointer"
								onClick={() => onToggle(work.workId)}
							>
								<TableCell>
									{isSelected ? (
										<CheckSquare className="h-4 w-4 text-primary" />
									) : (
										<Square className="h-4 w-4 text-muted-foreground" />
									)}
								</TableCell>
								<TableCell className="font-medium">{work.name}</TableCell>
								<TableCell>
									<div className="flex items-center gap-2">
										<div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
											<div
												className="h-full rounded-full bg-info"
												style={{ width: measuredWidth }}
											/>
										</div>
										<span className="w-12 text-right text-xs font-bold tabular-nums text-muted-foreground">
											{formatRatioAsPercentage(work.measuredPercentage)}
										</span>
									</div>
								</TableCell>
								<TableCell className="text-right">
									<Badge variant="tag" tone={HEALTH_TONE[spiTone].badge}>
										{work.schedulePerformanceIndex != null
											? work.schedulePerformanceIndex.toFixed(2)
											: "N/A"}
									</Badge>
								</TableCell>
								<TableCell className="text-right">
									<Badge variant="tag" tone={HEALTH_TONE[cpiTone].badge}>
										{work.costPerformanceIndex != null
											? work.costPerformanceIndex.toFixed(2)
											: "N/A"}
									</Badge>
								</TableCell>
								<TableCell
									className={`text-right font-mono text-sm font-bold tabular-nums ${HEALTH_TONE[balanceTone].text}`}
								>
									{formatCurrency(work.currentBudgetBalance)}
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</DataSection>
	);
}
