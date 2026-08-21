import { Link } from "@tanstack/react-router";
import { AlertTriangle, Trophy } from "lucide-react";
import { EmptyState } from "@/atoms/empty-state";
import { DataSection } from "@/components/atoms/data-section";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { MultiworksBIResponse } from "@/types/bi";
import { classifyIndex, HEALTH_TONE } from "@/utils/evm-health";

export type TopRankingItem = { workId: string; name: string; value: number };

export type TopRankingsLists = {
	bestCpi: TopRankingItem[];
	worstCpi: TopRankingItem[];
	bestSpi: TopRankingItem[];
	worstSpi: TopRankingItem[];
};

const DEFAULT_LIMIT = 10;

function toItems(
	list: Array<{ workId: string; name: string; value: number | null }>,
): TopRankingItem[] {
	return list
		.filter((item) => item.value != null)
		.map((item) => ({
			workId: item.workId,
			name: item.name,
			value: item.value as number,
		}));
}

export function buildTopLists(
	rankings: MultiworksBIResponse["rankings"],
	limit = DEFAULT_LIMIT,
): TopRankingsLists {
	const cpi = toItems(rankings.costPerformance);
	const spi = toItems(rankings.schedulePerformance);
	return {
		bestCpi: cpi.slice(0, limit),
		worstCpi: [...cpi].reverse().slice(0, limit),
		bestSpi: spi.slice(0, limit),
		worstSpi: [...spi].reverse().slice(0, limit),
	};
}

function MiniRankingTable({
	items,
	metricLabel,
}: {
	items: TopRankingItem[];
	metricLabel: string;
}) {
	if (items.length === 0) {
		return (
			<div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
				Sem dados de {metricLabel}.
			</div>
		);
	}
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="w-10">#</TableHead>
					<TableHead>Obra</TableHead>
					<TableHead className="w-20 text-right">{metricLabel}</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{items.map((item, index) => {
					const tone = classifyIndex(item.value);
					return (
						<TableRow key={`${item.workId}-${metricLabel}`}>
							<TableCell className="font-mono text-xs text-muted-foreground">
								{index + 1}
							</TableCell>
							<TableCell className="text-sm font-medium">
								{item.workId ? (
									<Link
										to="/app/obras/$workId"
										params={{ workId: item.workId }}
										className="link-navigation"
									>
										{item.name}
									</Link>
								) : (
									item.name
								)}
							</TableCell>
							<TableCell className="text-right">
								<Badge variant="tag" tone={HEALTH_TONE[tone].badge}>
									{item.value.toFixed(2)}
								</Badge>
							</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}

function TopRankingSection({
	title,
	icon: Icon,
	description,
	lists,
}: {
	title: string;
	icon: typeof Trophy;
	description: string;
	lists: { spi: TopRankingItem[]; cpi: TopRankingItem[] };
}) {
	const hasData = lists.spi.length > 0 || lists.cpi.length > 0;
	return (
		<DataSection title={title} icon={Icon} description={description}>
			{hasData ? (
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<div>
						<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Prazo (SPI)
						</p>
						<MiniRankingTable items={lists.spi} metricLabel="SPI" />
					</div>
					<div>
						<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Custo (CPI)
						</p>
						<MiniRankingTable items={lists.cpi} metricLabel="CPI" />
					</div>
				</div>
			) : (
				<EmptyState
					title="Nenhum dado de ranking disponível"
					description="Os índices de desempenho serão exibidos aqui quando houver dados."
				/>
			)}
		</DataSection>
	);
}

export function TopRankings({
	rankings,
}: {
	rankings: MultiworksBIResponse["rankings"];
}) {
	const lists = buildTopLists(rankings);
	return (
		<>
			<TopRankingSection
				title="Top 10 melhores obras"
				icon={Trophy}
				description="Maiores índices de desempenho de prazo e custo"
				lists={{ spi: lists.bestSpi, cpi: lists.bestCpi }}
			/>
			<TopRankingSection
				title="Top 10 piores obras"
				icon={AlertTriangle}
				description="Menores índices de desempenho de prazo e custo"
				lists={{ spi: lists.worstSpi, cpi: lists.worstCpi }}
			/>
		</>
	);
}
