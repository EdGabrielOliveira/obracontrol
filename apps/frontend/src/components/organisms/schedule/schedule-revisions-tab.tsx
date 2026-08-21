import { createColumnHelper } from "@tanstack/react-table";
import { CalendarClock } from "lucide-react";
import { DataTable } from "@/components/atoms/data-table";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Card, CardContent } from "@/components/ui/card";
import type { GanttItem } from "@/types/schedule";
import { formatDate } from "@/utils/format";

interface ScheduleRevisionsTabProps {
	revisions: GanttItem[];
}

const revisionHelper = createColumnHelper<GanttItem>();

const revisionColumns = [
	revisionHelper.accessor("index", {
		header: "Índice",
		cell: (info) => info.getValue(),
		meta: { className: "font-mono text-xs" },
	}),
	revisionHelper.accessor("description", {
		header: "Descrição",
	}),
	revisionHelper.accessor("revisionVersion", {
		header: "Versão",
		cell: (info) => info.getValue() ?? "-",
	}),
	revisionHelper.accessor("replannedStart", {
		header: "Início Replanejado",
		cell: (info) => formatDate(info.getValue()),
		meta: { className: "text-right" },
	}),
	revisionHelper.accessor("replannedEnd", {
		header: "Fim Replanejado",
		cell: (info) => formatDate(info.getValue()),
		meta: { className: "text-right" },
	}),
	revisionHelper.accessor("revisionDate", {
		header: "Data Revisão",
		cell: (info) => formatDate(info.getValue()),
		meta: { className: "text-right" },
	}),
];

export function ScheduleRevisionsTab({ revisions }: ScheduleRevisionsTabProps) {
	if (revisions.length === 0) {
		return (
			<div className="flex flex-col items-center py-12 text-center">
				<p className="text-sm text-muted-foreground">
					Nenhum replanejamento registrado.
				</p>
			</div>
		);
	}

	return (
		<Card>
			<CardHeaderWithIcon
				icon={CalendarClock}
				title="Revisões do Cronograma"
				description={`${revisions.length} revisão(ões) registrada(s)`}
			/>
			<CardContent>
				<DataTable
					columns={revisionColumns}
					data={revisions}
					searchPlaceholder="Buscar revisões..."
					pageSize={10}
				/>
			</CardContent>
		</Card>
	);
}
