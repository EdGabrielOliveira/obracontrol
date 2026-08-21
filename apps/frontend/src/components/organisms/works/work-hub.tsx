import type { ReactNode } from "react";
import type { WorkManagementResponse } from "@/api/management";
import type { WorkHubTab } from "@/schemas/work-hub";
import type { AuditLogEntry } from "@/types/audit";
import type { WorkBIResponse } from "@/types/bi";
import type { ScheduleResponse } from "@/types/schedule";
import type { AuditFilters } from "./audit-log-table";
import { HistoryTab } from "./history-tab";
import { SummaryTab } from "./summary-tab";

type WorkHubProps = {
	workId: string;
	canAccessGovernance: boolean;
	activeTab: WorkHubTab;
	aprovacoes: ReactNode;
	bi: WorkBIResponse | undefined;
	biLoading: boolean;
	biError: Error | null;
	onBiRetry: () => void;
	mgmt: WorkManagementResponse | undefined;
	mgmtLoading: boolean;
	mgmtError: Error | null;
	onMgmtRetry: () => void;
	schedule: ScheduleResponse | null | undefined;
	asOfDate: string | undefined;
	onAsOfDateChange: (value: string | undefined) => void;
	hasNoBudget: boolean;
	onGoToBudget: () => void;
	auditRows: AuditLogEntry[];
	auditTotal: number;
	auditPage: number;
	auditLimit: number;
	auditLoading: boolean;
	auditError: Error | null;
	auditFilters: AuditFilters;
	onAuditRetry: () => void;
	onAuditFiltersChange: (filters: AuditFilters) => void;
	onAuditPageChange: (page: number) => void;
	onOpenAuditDetail: (row: AuditLogEntry) => void;
	onOpenAuditNavigationTarget: (
		target: NonNullable<AuditLogEntry["navigationTarget"]>,
	) => void;
};

export function WorkHub({
	workId,
	canAccessGovernance,
	activeTab,
	aprovacoes,
	bi,
	biLoading,
	biError,
	onBiRetry,
	mgmt,
	mgmtLoading,
	mgmtError,
	onMgmtRetry,
	schedule,
	asOfDate,
	onAsOfDateChange,
	hasNoBudget,
	onGoToBudget,
	auditRows,
	auditTotal,
	auditPage,
	auditLimit,
	auditLoading,
	auditError,
	auditFilters,
	onAuditRetry,
	onAuditFiltersChange,
	onAuditPageChange,
	onOpenAuditDetail,
	onOpenAuditNavigationTarget,
}: WorkHubProps) {
	if (activeTab === "historico" && canAccessGovernance) {
		return (
			<HistoryTab
				workId={workId}
				canViewHistory={canAccessGovernance}
				rows={auditRows}
				total={auditTotal}
				page={auditPage}
				limit={auditLimit}
				loading={auditLoading}
				error={auditError}
				onRetry={onAuditRetry}
				filters={auditFilters}
				onFiltersChange={onAuditFiltersChange}
				onPageChange={onAuditPageChange}
				onOpenDetail={onOpenAuditDetail}
				onOpenNavigationTarget={onOpenAuditNavigationTarget}
			/>
		);
	}

	if (activeTab === "aprovacoes" && canAccessGovernance) return aprovacoes;

	return (
		<SummaryTab
			bi={bi}
			biLoading={biLoading}
			biError={biError}
			onBiRetry={onBiRetry}
			mgmt={mgmt}
			mgmtLoading={mgmtLoading}
			mgmtError={mgmtError}
			onMgmtRetry={onMgmtRetry}
			schedule={schedule}
			asOfDate={asOfDate}
			onAsOfDateChange={onAsOfDateChange}
			hasNoBudget={hasNoBudget}
			onGoToBudget={onGoToBudget}
		/>
	);
}
