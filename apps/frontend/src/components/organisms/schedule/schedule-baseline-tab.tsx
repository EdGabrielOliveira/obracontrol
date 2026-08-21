import { CalendarDays } from "lucide-react";
import { GanttChart } from "@/components/atoms/gantt-chart";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Card, CardContent } from "@/components/ui/card";
import type { GanttItem, ScheduleItem } from "@/types/schedule";

interface ScheduleBaselineTabProps {
	items: ScheduleItem[];
	ganttMap: Map<string, GanttItem>;
}

export function ScheduleBaselineTab({
	items,
	ganttMap,
}: ScheduleBaselineTabProps) {
	return (
		<Card>
			<CardHeaderWithIcon
				icon={CalendarDays}
				title="Cronograma Original"
				description="Linha de base do cronograma da obra."
			/>
			<CardContent>
				<GanttChart items={items} ganttMap={ganttMap} />
			</CardContent>
		</Card>
	);
}
