import { TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatNullableCurrency } from "@/utils/format";

const noInformation = "Sem informações";
const formatProjection = (value: number | null, available = value != null) =>
	available && value != null ? formatNullableCurrency(value) : noInformation;

interface PortfolioProjectionsProps {
	cards: {
		totalBac: number;
		totalEacTypical: number | null;
		totalEtc: number | null;
		totalVac: number | null;
	};
}

export function PortfolioProjections({ cards }: PortfolioProjectionsProps) {
	const eacTone =
		cards.totalEacTypical != null && cards.totalEacTypical > cards.totalBac
			? "text-destructive"
			: "text-success";
	const vacTone =
		cards.totalVac != null && cards.totalVac < 0
			? "text-destructive"
			: "text-success";

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card className="card-shadow">
				<CardContent className="flex flex-col gap-2 p-4">
					<div className="flex items-center gap-2">
						<Wallet className={`h-4 w-4 ${eacTone}`} />
						<span className="text-xs font-medium text-muted-foreground">
							Custo Final (EAC)
						</span>
					</div>
					<span className={`text-lg font-bold ${eacTone}`}>
						{formatProjection(cards.totalEacTypical)}
					</span>
				</CardContent>
			</Card>
			<Card className="card-shadow">
				<CardContent className="flex flex-col gap-2 p-4">
					<div className="flex items-center gap-2">
						<TrendingDown className="h-4 w-4 text-muted-foreground" />
						<span className="text-xs font-medium text-muted-foreground">
							Falta Gastar (ETC)
						</span>
					</div>
					<span className="text-lg font-bold text-muted-foreground">
						{formatProjection(cards.totalEtc)}
					</span>
				</CardContent>
			</Card>
			<Card className="card-shadow">
				<CardContent className="flex flex-col gap-2 p-4">
					<div className="flex items-center gap-2">
						<TrendingUp className={`h-4 w-4 ${vacTone}`} />
						<span className="text-xs font-medium text-muted-foreground">
							Variação Final (VAC)
						</span>
					</div>
					<span className={`text-lg font-bold ${vacTone}`}>
						{formatProjection(cards.totalVac)}
					</span>
				</CardContent>
			</Card>
			<Card className="card-shadow">
				<CardContent className="flex flex-col gap-2 p-4">
					<div className="flex items-center gap-2">
						<Wallet className="h-4 w-4 text-muted-foreground" />
						<span className="text-xs font-medium text-muted-foreground">
							Orçamento Total (BAC)
						</span>
					</div>
					<span className="text-lg font-bold">
						{formatProjection(cards.totalBac, cards.totalBac > 0)}
					</span>
				</CardContent>
			</Card>
		</div>
	);
}
