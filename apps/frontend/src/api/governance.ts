import type {
	ApprovalRequestView,
	GovernanceRecord,
	GovernanceTransitionInput,
} from "@/types/governance";
import { api } from "./api";

function governancePath(entityType: string, entityId: string) {
	return `/governance/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`;
}

export async function getGovernanceRecord(
	entityType: string,
	entityId: string,
) {
	const { data } = await api.get<GovernanceRecord>(
		governancePath(entityType, entityId),
	);
	return data;
}

export async function transitionGovernance(
	entityType: string,
	entityId: string,
	input: GovernanceTransitionInput,
) {
	const { data } = await api.post<GovernanceRecord>(
		`${governancePath(entityType, entityId)}/transition`,
		input,
	);
	return data;
}

export async function listPendingApprovals(workId?: string) {
	const { data } = await api.get<ApprovalRequestView[]>(
		"/governance/approvals/pending",
		{ params: workId ? { workId } : undefined },
	);
	return data;
}

export async function decideApproval(input: {
	requestId: string;
	decision: "APPROVE" | "REJECT";
	reason?: string;
}) {
	const { data } = await api.post(
		`/governance/approvals/${encodeURIComponent(input.requestId)}/decide`,
		{ decision: input.decision, reason: input.reason },
	);
	return data;
}
