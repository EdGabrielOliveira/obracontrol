import { Link } from "@tanstack/react-router";
import {
	Building2,
	Calendar,
	CalendarClock,
	CircleDollarSign,
	Info,
	MapPin,
	TrendingDown,
	TrendingUp,
	User,
} from "lucide-react";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { WorkDetail } from "@/types/works";
import {
	formatCurrency,
	formatDate,
	formatRatioAsPercentage,
} from "@/utils/format";

interface WorkDetailHeaderProps {
	work: WorkDetail;
}

function RiskBadge({
	risk,
	type,
}: {
	risk: string;
	type: "schedule" | "cost";
}) {
	const configs = {
		schedule: {
			AHEAD: { label: "Adiantado", color: "status-success" },
			ON_TRACK: { label: "No prazo", color: "status-info" },
			BEHIND: { label: "Atrasado", color: "status-danger" },
			UNAVAILABLE: {
				label: "Indisponível",
				color: "bg-muted text-muted-foreground",
			},
		},
		cost: {
			BELOW_COST: { label: "Abaixo", color: "status-success" },
			ON_COST: { label: "No orçamento", color: "status-info" },
			OVER_COST: { label: "Acima", color: "status-danger" },
			UNAVAILABLE: {
				label: "Indisponível",
				color: "bg-muted text-muted-foreground",
			},
		},
	};
	const config =
		configs[type][risk as keyof (typeof configs)[typeof type]] ??
		configs[type].UNAVAILABLE;
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
				config.color,
			)}
		>
			{config.label}
		</span>
	);
}

export function WorkDetailHeader({ work }: WorkDetailHeaderProps) {
	const progress = work.measuredPercentage ?? 0;
	const progressWidth = Math.min(progress * 100, 100);
	const hasNoBudget = !work.activeBudget && !work.lastImportAt;
	return (
		<div className="space-y-4">
			<Card>
				<CardHeaderWithIcon
					icon={Info}
					title="Dados da obra"
					description="Informações gerais e hierarquia"
				/>
				<CardContent>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3">
						{work.organizationName && (
							<div className="flex items-center gap-2 text-sm">
								<Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
								<div>
									<p className="text-xs text-muted-foreground">Organização</p>
									<p className="font-medium">{work.organizationName}</p>
								</div>
							</div>
						)}
						{work.costCenterName && (
							<div className="flex items-center gap-2 text-sm">
								<Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
								<div>
									<p className="text-xs text-muted-foreground">
										Centro de Custo
									</p>
									<p className="font-medium">{work.costCenterName}</p>
								</div>
							</div>
						)}
						{work.clientName && (
							<div className="flex items-center gap-2 text-sm">
								<Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
								<div>
									<p className="text-xs text-muted-foreground">Cliente</p>
									<p className="font-medium truncate">{work.clientName}</p>
								</div>
							</div>
						)}
						{work.responsibleName && (
							<div className="flex items-center gap-2 text-sm">
								<User className="h-4 w-4 shrink-0 text-muted-foreground" />
								<div>
									<p className="text-xs text-muted-foreground">Responsável</p>
									<p className="font-medium truncate">{work.responsibleName}</p>
								</div>
							</div>
						)}
						{work.plannedStart && (
							<div className="flex items-center gap-2 text-sm">
								<Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
								<div>
									<p className="text-xs text-muted-foreground">Prazo</p>
									<p className="font-medium">
										{formatDate(work.plannedStart)} –{" "}
										{work.plannedEnd ? formatDate(work.plannedEnd) : "—"}
									</p>
								</div>
							</div>
						)}
						{work.areaM2 && (
							<div className="flex items-center gap-2 text-sm">
								<MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
								<div>
									<p className="text-xs text-muted-foreground">Área</p>
									<p className="font-medium">{work.areaM2} m²</p>
								</div>
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			{hasNoBudget ? (
				<Card>
					<CardContent className="flex flex-col items-center gap-4 py-10 text-center">
						<p className="text-base font-medium text-muted-foreground">
							Nenhum orçamento importado
						</p>
						<p className="text-sm text-muted-foreground">
							Importe uma planilha ou crie um orçamento para começar a
							acompanhar a obra.
						</p>
						<Link
							to="/app/obras/$workId/orcamento"
							params={{ workId: work.id }}
						>
							<Button size="sm">Ir para Orçamento</Button>
						</Link>
					</CardContent>
				</Card>
			) : (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-2 xl:grid-cols-4">
					<Card>
						<CardContent className="py-4">
							<p className="text-xs font-medium text-muted-foreground">
								Orçamento Ativo
							</p>
							<p className="mt-1 text-lg font-semibold text-foreground">
								{formatCurrency(work.activeBudget ?? 0)}
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="py-4">
							<p className="text-xs font-medium text-muted-foreground">
								% Medido
							</p>
							<p className="mt-1 text-lg font-semibold text-foreground">
								{formatRatioAsPercentage(progress)}
							</p>
							<div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
								<div
									className="h-full rounded-full bg-primary transition-all duration-500"
									style={{ width: `${progressWidth}%` }}
								/>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="py-4">
							<div className="flex items-center justify-between">
								<p className="text-xs font-medium text-muted-foreground">
									Risco Cronograma
								</p>
								{work.scheduleRisk === "BEHIND" && (
									<TrendingDown className="h-4 w-4 text-destructive" />
								)}
								{work.scheduleRisk === "AHEAD" && (
									<TrendingUp className="h-4 w-4 text-success" />
								)}
							</div>
							<div className="mt-2">
								<RiskBadge risk={work.scheduleRisk} type="schedule" />
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="py-4">
							<div className="flex items-center justify-between">
								<p className="text-xs font-medium text-muted-foreground">
									Risco Custo
								</p>
								{work.costRisk === "OVER_COST" && (
									<TrendingDown className="h-4 w-4 text-destructive" />
								)}
								{work.costRisk === "BELOW_COST" && (
									<TrendingUp className="h-4 w-4 text-success" />
								)}
							</div>
							<div className="mt-2">
								<RiskBadge risk={work.costRisk} type="cost" />
							</div>
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
}
