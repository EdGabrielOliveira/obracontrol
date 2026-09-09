import { CalendarDays } from "lucide-react";
import { GanttChart } from "@/components/atoms/gantt-chart";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Card, CardContent } from "@/components/ui/card";
import type { GanttItem, ScheduleItem } from "@/types/schedule";

interface ScheduleBaselineTabProps {
	items: ScheduleItem[];
	ganttMap: Map<string, GanttItem>;
	actionButton?: React.ReactNode;
	hasAmendment?: boolean;
}

export function ScheduleBaselineTab({
	items,
	ganttMap,
	actionButton,
	hasAmendment = false,
}: ScheduleBaselineTabProps) {
	return (
		<Card>
			<CardHeaderWithIcon
				icon={CalendarDays}
				title={hasAmendment ? "Cronograma e revisões" : "Cronograma atual"}
				description={
					hasAmendment
						? "Linha de base e revisões do cronograma da obra."
						: "Planejamento e execução atual da obra."
				}
				actions={actionButton}
			/>
			<CardContent>
				<GanttChart
					items={items}
					ganttMap={ganttMap}
					showAmendmentComparison={hasAmendment}
				/>
			</CardContent>
		</Card>
	);
}
