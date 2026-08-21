import { Link } from "@tanstack/react-router";
import { TrendingDown, TrendingUp } from "lucide-react";
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
import {
	classifyIndex,
	HEALTH_TONE,
	type HealthTone,
} from "@/utils/evm-health";

interface RankingsProps {
	rankings: MultiworksBIResponse["rankings"];
}

const toneLabel: Record<HealthTone, string> = {
	good: "OK",
	attention: "Atenção",
	critical: "Crítico",
	unknown: "N/A",
};

function RankingTable({
	items,
	title,
	icon: Icon,
	description,
}: {
	items: Array<{ workId: string; name: string; value: number | null }>;
	title: string;
	icon: typeof TrendingDown;
	description: string;
}) {
	if (items.length === 0) {
		return (
			<DataSection title={title} icon={Icon} description={description}>
				<EmptyState
					title="Nenhum dado disponível"
					description="Os índices serão exibidos aqui quando houver dados."
				/>
			</DataSection>
		);
	}

	const maxValue = Math.max(
		...items
			.map((item) => item.value)
			.filter((value): value is number => value != null),
	);

	return (
		<DataSection
			title={title}
			icon={Icon}
			description={description}
			className="mt-6"
		>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Obra</TableHead>
						<TableHead className="w-40">Índice</TableHead>
						<TableHead className="w-32 text-right">Status</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{items.map((item) => {
						const tone = classifyIndex(item.value);
						const visual = HEALTH_TONE[tone];
						const width =
							item.value != null && maxValue > 0
								? `${Math.max((item.value / maxValue) * 100, 4)}%`
								: "4%";
						return (
							<TableRow key={item.workId}>
								<TableCell className="font-medium">
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
								<TableCell>
									<div className="flex items-center gap-2">
										<div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
											<div
												className={`h-full rounded-full ${visual.bar}`}
												style={{ width }}
											/>
										</div>
										<span className="w-12 text-right font-mono text-xs tabular-nums">
											{item.value != null ? item.value.toFixed(2) : "-"}
										</span>
									</div>
								</TableCell>
								<TableCell className="text-right">
									<Badge
										variant="tag"
										tone={visual.badge}
										className={
											tone === "unknown"
												? "bg-muted text-muted-foreground"
												: undefined
										}
									>
										{toneLabel[tone]}
									</Badge>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</DataSection>
	);
}

export function Rankings({ rankings }: RankingsProps) {
	return (
		<>
			<RankingTable
				items={rankings.costPerformance}
				title="Ranking CPI"
				icon={TrendingDown}
				description="Índice de desempenho de custo por obra"
			/>
			<RankingTable
				items={rankings.schedulePerformance}
				title="Ranking SPI"
				icon={TrendingUp}
				description="Índice de desempenho de prazo por obra"
			/>
		</>
	);
}
