import { Link } from "@tanstack/react-router";
import { Calendar, CalendarPlus, Plus } from "lucide-react";
import { useState } from "react";
import type { CreateScheduleRevisionInput } from "@/api/schedule";
import { EmptyStateCard } from "@/components/atoms/empty-state-card";
import { ScheduleBaselineTab } from "@/components/organisms/schedule/schedule-baseline-tab";
import { ScheduleRevisionModal } from "@/components/organisms/schedule/schedule-revision-modal";
import { ScheduleRevisionsTab } from "@/components/organisms/schedule/schedule-revisions-tab";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
	GanttItem,
	ScheduleItem,
	ScheduleResponse,
} from "@/types/schedule";
import { flattenItems } from "@/utils/schedule-helpers";

interface SchedulePanelProps {
	workId: string;
	scheduleData?: ScheduleResponse;
	onCreateRevision?: (values: CreateScheduleRevisionInput) => void;
	canEditManualSchedule?: boolean;
}

export function isReplanningEligible(
	item: Pick<ScheduleItem, "plannedEnd" | "completionPercentage">,
	referenceDate = new Date(),
) {
	if (!item.plannedEnd || item.completionPercentage >= 100) return false;
	const plannedEnd = new Date(item.plannedEnd);
	if (Number.isNaN(plannedEnd.getTime())) return false;
	return (
		Date.UTC(
			plannedEnd.getUTCFullYear(),
			plannedEnd.getUTCMonth(),
			plannedEnd.getUTCDate(),
		) <
		Date.UTC(
			referenceDate.getUTCFullYear(),
			referenceDate.getUTCMonth(),
			referenceDate.getUTCDate(),
		)
	);
}

export function SchedulePanel({
	workId,
	scheduleData,
	onCreateRevision,
	canEditManualSchedule = false,
}: SchedulePanelProps) {
	const [activeScheduleTab, setActiveScheduleTab] = useState("revisions");
	const [revisionModalOpen, setRevisionModalOpen] = useState(false);

	const scheduleFlatItems = scheduleData
		? flattenItems(scheduleData.items)
		: [];
	const ganttMap = new Map<string, GanttItem>();
	if (scheduleData?.gantt) {
		for (const g of scheduleData.gantt) {
			ganttMap.set(g.itemId ?? g.id, g);
		}
	}
	const revisions =
		scheduleData?.gantt?.filter((g) => g.revisionDate != null) ?? [];
	const eligibleItems = scheduleFlatItems.filter((item) =>
		isReplanningEligible(item),
	);
	const canReplan = eligibleItems.length > 0;
	const showRevisionHistory = canReplan || revisions.length > 0;

	return (
		<>
			<div className="flex flex-wrap gap-2">
				{canEditManualSchedule && (
					<Link to="/app/obras/$workId/cronograma" params={{ workId }}>
						<Button variant="outline" size="sm">
							<CalendarPlus className="h-4 w-4" />
							Editar cronograma
						</Button>
					</Link>
				)}
				{onCreateRevision && canReplan && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => setRevisionModalOpen(true)}
					>
						<Plus className="h-4 w-4" />
						Novo replanejamento
					</Button>
				)}
			</div>

			{!scheduleData || scheduleFlatItems.length === 0 ? (
				<EmptyStateCard
					icon={Calendar}
					title="Nenhum cronograma registrado"
					description="Use o botão acima para cadastrar as datas dos itens que ainda não possuem cronograma."
				/>
			) : (
				<>
					<ScheduleBaselineTab items={scheduleData.items} ganttMap={ganttMap} />
					{showRevisionHistory && (
						<Tabs
							value={activeScheduleTab}
							onValueChange={setActiveScheduleTab}
						>
							<TabsList className="mt-6 mb-4">
								<TabsTrigger value="revisions">
									Replanejamentos
									{revisions.length > 0 && (
										<span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
											{revisions.length}
										</span>
									)}
								</TabsTrigger>
							</TabsList>
							<TabsContent value="revisions">
								<ScheduleRevisionsTab revisions={revisions} />
							</TabsContent>
						</Tabs>
					)}
				</>
			)}

			<ScheduleRevisionModal
				open={revisionModalOpen}
				onOpenChange={setRevisionModalOpen}
				items={eligibleItems}
				onSubmit={(values) => {
					onCreateRevision?.(values);
					setRevisionModalOpen(false);
				}}
			/>
		</>
	);
}
