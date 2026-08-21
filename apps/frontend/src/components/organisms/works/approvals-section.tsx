import { ApprovalsTab } from "@/components/organisms/works/approvals-tab";
import type { ApprovalRequestView } from "@/types/governance";

type AprovacoesSectionProps = {
	rows: ApprovalRequestView[];
	loading: boolean;
	error: Error | null;
	onRetry: () => void;
	onDecide: (
		requestId: string,
		decision: "APPROVE" | "REJECT",
		reason?: string,
	) => void;
	decidingId: string | null;
	requiresDecisionReason?: boolean;
	currentUserId?: string;
};

export function AprovacoesSection({
	rows,
	loading,
	error,
	onRetry,
	onDecide,
	decidingId,
	requiresDecisionReason,
	currentUserId,
}: AprovacoesSectionProps) {
	return (
		<ApprovalsTab
			rows={rows}
			loading={loading}
			error={error}
			onRetry={onRetry}
			onDecide={onDecide}
			decidingId={decidingId}
			requiresDecisionReason={requiresDecisionReason}
			currentUserId={currentUserId}
		/>
	);
}
