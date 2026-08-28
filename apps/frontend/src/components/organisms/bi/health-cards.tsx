import {
	CalendarClock,
	type LucideIcon,
	PiggyBank,
	Ruler,
	Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { MultiworksBIResponse } from "@/types/bi";
import {
	classifyBalance,
	HEALTH_TONE,
	type HealthTone,
} from "@/utils/evm-health";
import { formatCurrency } from "@/utils/format";

const noInformation = "Sem informações";

interface HealthCardsProps {
	cards: MultiworksBIResponse["cards"];
	works: MultiworksBIResponse["works"];
}

function HealthCard({
	icon: Icon,
	label,
	value,
	tone,
	meta,
}: {
	icon: LucideIcon;
	label: string;
	value: string;
	tone: HealthTone;
	meta?: { text: string; tone: HealthTone };
}) {
	const visual = HEALTH_TONE[tone];
	return (
		<Card className={`card-shadow border ${visual.card}`}>
			<CardContent className="p-4">
				<div className="flex items-start justify-between gap-2">
					<div>
						<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
							{label}
						</p>
						<p className={`mt-1 text-2xl font-bold ${visual.text}`}>{value}</p>
					</div>
					<span
						className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${visual.icon}`}
					>
						<Icon className="h-5 w-5" />
					</span>
				</div>
				{meta && (
					<p
						className={`mt-2 text-xs font-medium ${HEALTH_TONE[meta.tone].text}`}
					>
						{meta.text}
					</p>
				)}
			</CardContent>
		</Card>
	);
}

export function HealthCards({ cards, works }: HealthCardsProps) {
	const spiValues = works
		.map((work) => work.schedulePerformanceIndex)
		.filter((value): value is number => value != null);
	const averageSpi =
		spiValues.length > 0
			? (
					spiValues.reduce((sum, value) => sum + value, 0) / spiValues.length
				).toFixed(2)
			: null;
	const prazoTone = cards.worksBehindSchedule > 0 ? "critical" : "good";
	const custoTone = (cards.worksAboveCost ?? 0) > 0 ? "critical" : "good";
	const semPlanejamentoTone =
		cards.worksWithoutPlanning > 0 ? "attention" : "good";

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<HealthCard
				icon={CalendarClock}
				label="Prazo"
				value={`${cards.worksBehindSchedule} atrasada(s)`}
				tone={prazoTone}
				meta={{
					text: `${cards.worksAheadSchedule} no prazo${
						averageSpi != null ? ` · SPI médio ${averageSpi}` : ""
					}`,
					tone: prazoTone,
				}}
			/>
			<HealthCard
				icon={Wallet}
				label="Custo"
				value={`${cards.worksAboveCost} acima do orçado`}
				tone={custoTone}
				meta={{
					text: `${cards.worksBelowCost ?? 0} abaixo do orçado`,
					tone: custoTone,
				}}
			/>
			<HealthCard
				icon={Ruler}
				label="Progresso"
				value={`${cards.worksWithProgress} com medição`}
				tone="unknown"
				meta={{
					text: `${cards.worksWithoutPlanning} sem planejamento`,
					tone: semPlanejamentoTone,
				}}
			/>
			<HealthCard
				icon={PiggyBank}
				label="Orçamento ativo"
				value={
					cards.totalActiveBudget > 0
						? formatCurrency(cards.totalActiveBudget)
						: noInformation
				}
				tone="unknown"
				meta={{
					text:
						cards.totalActiveBudget > 0
							? `Saldo total ${formatCurrency(cards.totalBudgetBalance)}`
							: noInformation,
					tone: classifyBalance(cards.totalBudgetBalance),
				}}
			/>
		</div>
	);
}
