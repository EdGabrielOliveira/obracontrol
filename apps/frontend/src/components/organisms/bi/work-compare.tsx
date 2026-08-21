import { Link } from "@tanstack/react-router";
import { BarChart3, Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";

import { BarChartComponent } from "@/atoms/bar-chart";
import { EmptyState } from "@/atoms/empty-state";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { StatusBadge } from "@/atoms/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CompareWorkItem, ComparisonResponse } from "@/types/bi";
import type { WorkSummaryWithHierarchy } from "@/types/works";
import { formatCurrency, formatRatioAsPercentage } from "@/utils/format";

const SCHEDULE_RISK_MAP: Record<
	string,
	{
		label: string;
		variant: "destructive" | "secondary" | "default" | "outline";
	}
> = {
	AHEAD: { label: "Adiantado", variant: "default" },
	ON_TRACK: { label: "No prazo", variant: "secondary" },
	BEHIND: { label: "Atrasado", variant: "destructive" },
	UNAVAILABLE: { label: "Indisponível", variant: "outline" },
};

const CPI_COLOR_CLASS = "text-success font-medium";
const SPI_COLOR_CLASS = "text-success font-medium";
const BAD_CPI_COLOR_CLASS = "text-destructive font-medium";
const BAD_SPI_COLOR_CLASS = "text-destructive font-medium";
const NEUTRAL_COLOR_CLASS = "text-muted-foreground";

function cpiColor(value: number | null): string {
	if (value == null) return NEUTRAL_COLOR_CLASS;
	if (value >= 1) return CPI_COLOR_CLASS;
	return BAD_CPI_COLOR_CLASS;
}

function spiColor(value: number | null): string {
	if (value == null) return NEUTRAL_COLOR_CLASS;
	if (value >= 1) return SPI_COLOR_CLASS;
	return BAD_SPI_COLOR_CLASS;
}

type WorkCompareViewProps = {
	selectedIds: string[];
	onSelectionChange: (ids: string[]) => void;
	allWorks: WorkSummaryWithHierarchy[];
	compareData: ComparisonResponse | null;
	compareLoading: boolean;
	error: Error | null;
};

export function WorkCompareView({
	selectedIds,
	onSelectionChange,
	allWorks,
	compareData,
	compareLoading,
	error,
}: WorkCompareViewProps) {
	const [open, setOpen] = useState(false);

	const selectedWorks = useMemo(
		() => allWorks.filter((w) => selectedIds.includes(w.id)),
		[allWorks, selectedIds],
	);

	const toggleWork = (workId: string) => {
		onSelectionChange(
			selectedIds.includes(workId)
				? selectedIds.filter((id) => id !== workId)
				: [...selectedIds, workId],
		);
	};

	const chartData = useMemo(() => {
		if (!compareData?.works) return [];
		return compareData.works.map((w) => ({
			name: w.name,
			Orçado: w.activeBudget,
			Medido: w.earnedValue,
		}));
	}, [compareData]);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-4">
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger asChild>
						<Button
							variant="outline"
							role="combobox"
							aria-expanded={open}
							className="w-[400px] justify-between"
						>
							{selectedIds.length === 0
								? "Selecionar obras para comparar..."
								: `${selectedIds.length} obra${selectedIds.length > 1 ? "s" : ""} selecionada${selectedIds.length > 1 ? "s" : ""}`}
							<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-[400px] p-0">
						<Command>
							<CommandInput placeholder="Buscar obra..." />
							<CommandList>
								<CommandEmpty>Nenhuma obra encontrada.</CommandEmpty>
								<CommandGroup>
									{allWorks.map((work) => (
										<CommandItem
											key={work.id}
											value={work.id}
											onSelect={() => toggleWork(work.id)}
										>
											<Check
												className={cn(
													"mr-2 h-4 w-4",
													selectedIds.includes(work.id)
														? "opacity-100"
														: "opacity-0",
												)}
											/>
											<div className="flex flex-col">
												<span className="font-medium">{work.name}</span>
												<span className="text-muted-foreground text-xs">
													{work.code}
												</span>
											</div>
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>

				{selectedIds.length > 0 && (
					<div className="flex flex-wrap gap-1">
						{selectedWorks.map((work) => (
							<Badge
								key={work.id}
								variant="secondary"
								className="cursor-pointer"
								onClick={() => toggleWork(work.id)}
							>
								{work.name} ×
							</Badge>
						))}
					</div>
				)}
			</div>

			{selectedIds.length < 2 && (
				<EmptyState
					icon={<BarChart3 className="h-12 w-12" />}
					title="Comparar obras"
					description="Selecione ao menos 2 obras para comparar lado a lado."
				/>
			)}

			{compareLoading && <LoadingSpinner title="Carregando comparação..." />}

			{error && <ErrorFeedback message="Erro ao carregar comparação." />}

			{compareData && selectedIds.length >= 2 && (
				<>
					<div className="overflow-x-auto rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-48">Indicador</TableHead>
									{compareData.works.map((work) => (
										<TableHead key={work.workId} className="min-w-[200px]">
											<div className="flex flex-col gap-1">
												<Link
													to="/app/obras/$workId"
													params={{ workId: work.workId }}
													className="link-navigation font-semibold"
												>
													{work.name}
												</Link>
												<div className="flex items-center gap-2">
													<span className="text-muted-foreground text-xs">
														{work.code}
													</span>
													<StatusBadge status={work.status} />
												</div>
											</div>
										</TableHead>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>{comparisonRows(compareData.works)}</TableBody>
						</Table>
					</div>

					{chartData.length > 0 && (
						<div className="rounded-md border p-4">
							<h3 className="mb-4 font-semibold text-lg">Orçado vs Medido</h3>
							<BarChartComponent data={chartData} height={300} />
						</div>
					)}
				</>
			)}
		</div>
	);
}

function comparisonRows(works: CompareWorkItem[]) {
	const rows: Array<{
		label: string;
		render: (w: CompareWorkItem) => React.ReactNode;
	}> = [
		{
			label: "Orçamento (R$)",
			render: (w) => formatCurrency(w.activeBudget),
		},
		{
			label: "Medido (R$)",
			render: (w) => formatCurrency(w.earnedValue),
		},
		{
			label: "Saldo (R$)",
			render: (w) => {
				const color = w.balance >= 0 ? "text-success" : "text-destructive";
				return <span className={color}>{formatCurrency(w.balance)}</span>;
			},
		},
		{
			label: "% Medido",
			render: (w) => formatRatioAsPercentage(w.measuredPercentage),
		},
		{
			label: "VP (R$)",
			render: (w) => formatCurrency(w.plannedValue),
		},
		{
			label: "VA (R$)",
			render: (w) => formatCurrency(w.earnedValue),
		},
		{
			label: "CR (R$)",
			render: (w) => formatCurrency(w.actualCost),
		},
		{
			label: "IDC (CPI)",
			render: (w) => (
				<span className={cpiColor(w.costPerformanceIndex)}>
					{w.costPerformanceIndex != null
						? w.costPerformanceIndex.toFixed(2)
						: "N/A"}
				</span>
			),
		},
		{
			label: "IDP (SPI)",
			render: (w) => (
				<span className={spiColor(w.schedulePerformanceIndex)}>
					{w.schedulePerformanceIndex != null
						? w.schedulePerformanceIndex.toFixed(2)
						: "N/A"}
				</span>
			),
		},
		{
			label: "VPr (SV)",
			render: (w) => {
				if (w.scheduleVariance == null)
					return <span className={NEUTRAL_COLOR_CLASS}>N/A</span>;
				const color =
					w.scheduleVariance >= 0 ? "text-success" : "text-destructive";
				return (
					<span className={color}>{formatCurrency(w.scheduleVariance)}</span>
				);
			},
		},
		{
			label: "VC (CV)",
			render: (w) => {
				if (w.costVariance == null)
					return <span className={NEUTRAL_COLOR_CLASS}>N/A</span>;
				const color = w.costVariance >= 0 ? "text-success" : "text-destructive";
				return <span className={color}>{formatCurrency(w.costVariance)}</span>;
			},
		},
		{
			label: "Início",
			render: (w) => w.plannedStart ?? "N/A",
		},
		{
			label: "Fim",
			render: (w) => w.plannedEnd ?? "N/A",
		},
		{
			label: "Risco",
			render: (w) => {
				const config = SCHEDULE_RISK_MAP[w.scheduleRisk] ?? {
					label: w.scheduleRisk,
					variant: "outline" as const,
				};
				return <Badge variant={config.variant}>{config.label}</Badge>;
			},
		},
	];

	return rows.map((row) => (
		<TableRow key={row.label}>
			<TableCell className="font-medium">{row.label}</TableCell>
			{works.map((w) => (
				<TableCell key={w.workId}>{row.render(w)}</TableCell>
			))}
		</TableRow>
	));
}
