import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useGanttHeaders } from "@/components/atoms/use-gantt-headers";
import { cn } from "@/lib/utils";
import type { GanttItem, ScheduleItem } from "@/types/schedule";
import { formatDate } from "@/utils/format";
import {
	getStatusBorderColor,
	getStatusColor,
	getStatusGhostColor,
} from "@/utils/gantt-status";

type GanttRow = ScheduleItem & {
	depth: number;
	gantt?: GanttItem;
	children?: ScheduleItem[];
};

interface GanttChartProps {
	items: ScheduleItem[];
	ganttMap: Map<string, GanttItem>;
}

const ROW_HEIGHT = 40;
const DAY_WIDTH_BASE = 2.5;
const MIN_BAR_WIDTH = 6;

function daysBetween(a: string, b: string): number {
	const da = new Date(a);
	const db = new Date(b);
	return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDuration(days: number): string {
	if (days < 30) return `${days}d`;
	const months = Math.floor(days / 30);
	const remaining = days % 30;
	return remaining > 0 ? `${months}m ${remaining}d` : `${months}m`;
}

function flattenWithCollapse(
	items: ScheduleItem[],
	collapsed: Set<string>,
	ganttMap: Map<string, GanttItem>,
	depth = 0,
): Array<GanttRow & { visible: boolean }> {
	const result: Array<GanttRow & { visible: boolean }> = [];
	for (const item of items) {
		const isCollapsed = collapsed.has(item.id);
		const children = item.children ?? [];
		const hasChildren = children.length > 0;

		if (isCollapsed && hasChildren) {
			const childDates = collectChildDates(children, ganttMap);
			const avgMeasured = item.completionPercentage;

			result.push({
				...item,
				depth,
				visible: true,
				gantt: ganttMap.get(item.id),
				plannedStart: childDates.minStart ?? item.plannedStart,
				plannedEnd: childDates.maxEnd ?? item.plannedEnd,
				completionPercentage: avgMeasured,
			});
		} else {
			result.push({
				...item,
				depth,
				visible: true,
				gantt: ganttMap.get(item.id),
			});
		}

		if (hasChildren && !isCollapsed) {
			result.push(
				...flattenWithCollapse(children, collapsed, ganttMap, depth + 1),
			);
		}
	}
	return result;
}

function collectChildDates(
	items: ScheduleItem[],
	ganttMap: Map<string, GanttItem>,
): { minStart: string | null; maxEnd: string | null } {
	let minStart: string | null = null;
	let maxEnd: string | null = null;

	for (const item of items) {
		const gantt = ganttMap.get(item.id);
		const start = gantt?.baselineStart ?? item.plannedStart;
		const end = gantt?.baselineEnd ?? item.plannedEnd;

		if (start && (!minStart || start < minStart)) minStart = start;
		if (end && (!maxEnd || end > maxEnd)) maxEnd = end;

		if (item.children) {
			const childDates = collectChildDates(item.children, ganttMap);
			if (childDates.minStart && (!minStart || childDates.minStart < minStart))
				minStart = childDates.minStart;
			if (childDates.maxEnd && (!maxEnd || childDates.maxEnd > maxEnd))
				maxEnd = childDates.maxEnd;
		}
	}

	return { minStart, maxEnd };
}

function GanttBar({
	row,
	timelineStart,
	dayWidth,
}: {
	row: GanttRow;
	timelineStart: Date;
	dayWidth: number;
}) {
	const gantt = row.gantt;
	const start = gantt?.baselineStart ?? row.plannedStart;
	const end = gantt?.baselineEnd ?? row.plannedEnd;
	const measured = gantt?.measuredPercentage ?? row.completionPercentage;
	const status = gantt?.status ?? row.computedStatus;

	if (!start || !end) return null;

	const totalDays = Math.max(daysBetween(start, end), 1);
	const offsetDays = Math.max(
		(new Date(start).getTime() - timelineStart.getTime()) /
			(1000 * 60 * 60 * 24),
		0,
	);
	const barWidth = Math.max(Math.round(totalDays * dayWidth), MIN_BAR_WIDTH);
	const left = Math.round(offsetDays * dayWidth);
	const progressWidth = Math.round(barWidth * Math.min(measured, 1));

	const pctValue = Math.round(measured * 100);

	return (
		<div
			className="group/bar relative flex items-center"
			style={{ height: ROW_HEIGHT, paddingLeft: left }}
		>
			<div
				className="relative flex items-center"
				style={{ width: barWidth, height: 16 }}
			>
				<div
					className={cn(
						"absolute inset-0 rounded-sm border",
						getStatusGhostColor(status),
						getStatusBorderColor(status),
					)}
				/>
				<div
					className={cn(
						"absolute inset-y-0 left-0 rounded-l-sm",
						getStatusColor(status),
						measured >= 0.99 && "rounded-r-sm",
					)}
					style={{ width: progressWidth }}
				/>

				{barWidth > 40 && (
					<span
						className={cn(
							"absolute inset-0 flex items-center justify-center text-[10px] font-semibold leading-none",
							measured >= 0.5 ? "text-white" : "text-foreground",
						)}
					>
						{pctValue}%
					</span>
				)}
			</div>

			{barWidth <= 40 && (
				<span className="ml-1.5 text-[10px] tabular-nums text-muted-foreground whitespace-nowrap">
					{pctValue}%
				</span>
			)}

			<div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-30">
				{row.description} — {pctValue}%
			</div>
		</div>
	);
}

interface GanttControlsProps {
	zoom: number;
	setZoom: (zoom: number | ((z: number) => number)) => void;
	collapsed: Set<string>;
	setCollapsed: (
		collapsed: Set<string> | ((prev: Set<string>) => Set<string>),
	) => void;
	items: ScheduleItem[];
}

function GanttControls({
	zoom,
	setZoom,
	collapsed,
	setCollapsed,
	items,
}: GanttControlsProps) {
	return (
		<div className="flex items-center gap-3">
			<div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-0.5">
				<button
					type="button"
					onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
					className="rounded-md px-2.5 py-1 text-xs font-medium hover:bg-background transition-colors"
				>
					−
				</button>
				<span className="min-w-[48px] text-center text-xs text-muted-foreground">
					{Math.round(zoom * 100)}%
				</span>
				<button
					type="button"
					onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
					className="rounded-md px-2.5 py-1 text-xs font-medium hover:bg-background transition-colors"
				>
					+
				</button>
			</div>
			<button
				type="button"
				onClick={() => {
					if (collapsed.size > 0) {
						setCollapsed(new Set());
					} else {
						setCollapsed(new Set(items.map((i) => i.id)));
					}
				}}
				className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
			>
				{collapsed.size > 0 ? "Expandir tudo" : "Recolher tudo"}
			</button>
		</div>
	);
}

interface GanttTableProps {
	flatItems: Array<GanttRow & { visible: boolean }>;
	collapsed: Set<string>;
	toggleCollapse: (id: string) => void;
}

function GanttTable({ flatItems, collapsed, toggleCollapse }: GanttTableProps) {
	return (
		<div className="shrink-0" style={{ width: 500, minWidth: 500 }}>
			<div
				className="flex items-center border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
				style={{ height: 44 }}
			>
				<div className="flex items-center px-4" style={{ width: 70 }}>
					Índice
				</div>
				<div className="flex-1 px-3">Descrição</div>
				<div className="w-16 px-2 text-right">Duração</div>
				<div className="w-28 px-2 text-right">Início (base)</div>
				<div className="w-28 px-2 text-right">Fim (base)</div>
			</div>

			{flatItems.map((row) => {
				const start = row.gantt?.baselineStart ?? row.plannedStart;
				const end = row.gantt?.baselineEnd ?? row.plannedEnd;
				const days = start && end ? daysBetween(start, end) : 0;
				const isStage = row.type === "STAGE";
				const isCollapsedItem = collapsed.has(row.id);
				const hasChildren = isStage;

				return (
					<div
						key={row.id}
						className={cn(
							"flex items-center border-b border-border text-sm transition-colors hover:bg-muted/30",
							isStage && "bg-muted/20 font-semibold",
						)}
						style={{ height: ROW_HEIGHT }}
					>
						<div
							className="flex items-center px-3 font-mono text-xs text-muted-foreground"
							style={{ width: 70 }}
						>
							<span style={{ paddingLeft: row.depth * 16 }}>{row.index}</span>
						</div>
						<div className="flex flex-1 items-center gap-1.5 px-3 min-w-0">
							{hasChildren && (
								<button
									type="button"
									onClick={() => toggleCollapse(row.id)}
									className="shrink-0 rounded p-0.5 hover:bg-muted transition-colors"
								>
									<ChevronRight
										className={cn(
											"h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
											!isCollapsedItem && "rotate-90",
										)}
									/>
								</button>
							)}
							{!hasChildren && <span className="w-5" />}
							<span className="truncate">{row.description}</span>
						</div>
						<div className="w-16 px-2 text-right text-xs text-muted-foreground tabular-nums">
							{days > 0 ? formatDuration(days) : "—"}
						</div>
						<div className="w-28 px-2 text-right text-xs text-muted-foreground tabular-nums">
							{start ? formatDate(start) : "—"}
						</div>
						<div className="w-28 px-2 text-right text-xs text-muted-foreground tabular-nums">
							{end ? formatDate(end) : "—"}
						</div>
					</div>
				);
			})}
		</div>
	);
}

interface GanttTimelineProps {
	monthHeaders: ReturnType<typeof useGanttHeaders>;
	timelineStart: Date;
	dayWidth: number;
	timelineWidth: number;
	flatItems: Array<GanttRow & { visible: boolean }>;
	showTodayLine: boolean;
	todayOffset: number;
}

function GanttTimeline({
	monthHeaders,
	timelineStart,
	dayWidth,
	timelineWidth,
	flatItems,
	showTodayLine,
	todayOffset,
}: GanttTimelineProps) {
	const headerWidths = useMemo(() => {
		return monthHeaders.map((header) => {
			const startOffset = Math.max(
				(header.start.getTime() - timelineStart.getTime()) /
					(1000 * 60 * 60 * 24),
				0,
			);
			const endOffset = Math.max(
				(header.end.getTime() - timelineStart.getTime()) /
					(1000 * 60 * 60 * 24),
				0,
			);
			return Math.round((endOffset - startOffset) * dayWidth);
		});
	}, [monthHeaders, timelineStart, dayWidth]);

	const headerPositions = useMemo(() => {
		const positions: number[] = [];
		let accumulated = 0;
		for (const width of headerWidths) {
			positions.push(accumulated);
			accumulated += width;
		}
		return positions;
	}, [headerWidths]);

	return (
		<div className="relative flex-1 min-w-0 overflow-hidden border-l border-border">
			<div
				className="flex border-b border-border bg-muted/40"
				style={{ height: 44, minWidth: timelineWidth }}
			>
				{monthHeaders.map((header, index) => {
					return (
						<div
							key={header.label}
							className="flex items-center justify-center border-r border-border px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0"
							style={{ width: headerWidths[index] }}
						>
							{header.label}
						</div>
					);
				})}
			</div>

			<div className="absolute inset-0 pointer-events-none" style={{ top: 44 }}>
				{headerPositions.map((left, index) => (
					<div
						key={monthHeaders[index].label}
						className="absolute top-0 bottom-0 w-px bg-border/60"
						style={{ left }}
					/>
				))}
			</div>

			{showTodayLine && (
				<div
					className="absolute top-0 bottom-0 z-20 w-0.5 bg-status-danger"
					style={{ left: Math.round(todayOffset * dayWidth) }}
				>
					<div className="absolute -top-0.5 -left-[5px] h-2.5 w-2.5 rounded-full bg-status-danger shadow-sm" />
				</div>
			)}

			<div style={{ minWidth: timelineWidth }}>
				{flatItems.map((row) => {
					const isStage = row.type === "STAGE";
					return (
						<div
							key={row.id}
							className={cn(
								"border-b border-border transition-colors hover:bg-muted/20",
								isStage && "bg-muted/10",
							)}
							style={{ height: ROW_HEIGHT }}
						>
							<GanttBar
								row={row}
								timelineStart={timelineStart}
								dayWidth={dayWidth}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function GanttLegend() {
	return (
		<div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
			<div className="flex items-center gap-1.5">
				<div className="h-2.5 w-5 rounded-sm bg-status-success" />
				<span>Concluído</span>
			</div>
			<div className="flex items-center gap-1.5">
				<div className="h-2.5 w-5 rounded-sm bg-info" />
				<span>Em andamento</span>
			</div>
			<div className="flex items-center gap-1.5">
				<div className="h-2.5 w-5 rounded-sm border border-border bg-muted" />
				<span>Não iniciado</span>
			</div>
			<div className="flex items-center gap-1.5">
				<div className="h-3 w-0.5 bg-status-danger" />
				<span>Hoje</span>
			</div>
			<div className="flex items-center gap-1.5">
				<ChevronRight className="h-3 w-3" />
				<span>Recolher/expandir</span>
			</div>
		</div>
	);
}

export function GanttChart({ items, ganttMap }: GanttChartProps) {
	const [zoom, setZoom] = useState(1);
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

	const toggleCollapse = (id: string) => {
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const flatItems = useMemo(() => {
		return flattenWithCollapse(items, collapsed, ganttMap);
	}, [items, ganttMap, collapsed]);

	const { timelineStart, totalDays } = useMemo(() => {
		let minDate: Date | null = null;
		let maxDate: Date | null = null;

		for (const row of flatItems) {
			const start = row.gantt?.baselineStart ?? row.plannedStart;
			const end = row.gantt?.baselineEnd ?? row.plannedEnd;
			if (start) {
				const d = new Date(start);
				if (!minDate || d < minDate) minDate = d;
			}
			if (end) {
				const d = new Date(end);
				if (!maxDate || d > maxDate) maxDate = d;
			}
		}

		const today = new Date();

		if (!minDate || !maxDate) {
			const d = new Date(today);
			d.setMonth(d.getMonth() + 12);
			return {
				timelineStart: new Date(today.getFullYear(), today.getMonth(), 1),
				totalDays: 365,
			};
		}

		const start = new Date(minDate);
		start.setDate(1);

		let end = new Date(maxDate);
		end.setMonth(end.getMonth() + 1);
		end.setDate(0);

		const minEnd = new Date(start);
		minEnd.setMonth(minEnd.getMonth() + 12);
		minEnd.setDate(0);

		if (end < minEnd) {
			end = minEnd;
		}

		const days = Math.round(
			(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
		);

		return { timelineStart: start, totalDays: days };
	}, [flatItems]);

	const dayWidth = DAY_WIDTH_BASE * zoom;

	const timelineWidth = Math.round(totalDays * dayWidth);

	const timelineEndAdjusted = useMemo(() => {
		const end = new Date(timelineStart);
		end.setDate(end.getDate() + totalDays);
		return end;
	}, [timelineStart, totalDays]);

	const monthHeaders = useGanttHeaders(timelineStart, timelineEndAdjusted);

	const today = new Date();
	const todayUtc = Date.UTC(
		today.getFullYear(),
		today.getMonth(),
		today.getDate(),
	);
	const timelineStartUtc = Date.UTC(
		timelineStart.getFullYear(),
		timelineStart.getMonth(),
		timelineStart.getDate(),
	);
	const timelineEndUtc = Date.UTC(
		timelineEndAdjusted.getFullYear(),
		timelineEndAdjusted.getMonth(),
		timelineEndAdjusted.getDate(),
	);
	const todayOffset = Math.max(
		(todayUtc - timelineStartUtc) / (1000 * 60 * 60 * 24),
		0,
	);
	const showTodayLine =
		todayUtc >= timelineStartUtc && todayUtc <= timelineEndUtc;

	return (
		<div className="space-y-3">
			<GanttControls
				zoom={zoom}
				setZoom={setZoom}
				collapsed={collapsed}
				setCollapsed={setCollapsed}
				items={items}
			/>

			<div className="flex w-full overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
				<GanttTable
					flatItems={flatItems}
					collapsed={collapsed}
					toggleCollapse={toggleCollapse}
				/>

				<GanttTimeline
					monthHeaders={monthHeaders}
					timelineStart={timelineStart}
					dayWidth={dayWidth}
					timelineWidth={timelineWidth}
					flatItems={flatItems}
					showTodayLine={showTodayLine}
					todayOffset={todayOffset}
				/>
			</div>

			<GanttLegend />
		</div>
	);
}
