import axios from "axios";
import type {
	ApprovalRequestView,
	GovernanceRecord,
	GovernanceTransitionInput,
} from "@/types/governance";
import { api } from "./api";

function governancePath(entityType: string, entityId: string) {
	return `/governance/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`;
}

export function toGovernanceApiStatus(
	status: GovernanceTransitionInput["toStatus"],
): GovernanceTransitionInput["toStatus"] {
	return status === "ACEITO" ? "ACCEPT" : status;
}

// WORK_STATUS was introduced after the original work-scoped governance
// endpoint. Keeping this fallback makes a rolling frontend/backend deployment
// safe: an already deployed frontend can still manage a work while an older
// backend instance is being replaced.
function legacyEntityType(entityType: string, error: unknown): string | null {
	if (
		entityType === "WORK_STATUS" &&
		axios.isAxiosError(error) &&
		error.response?.status === 404
	) {
		return "WORK";
	}
	return null;
}

export async function getGovernanceRecord(
	entityType: string,
	entityId: string,
) {
	try {
		const { data } = await api.get<GovernanceRecord>(
			governancePath(entityType, entityId),
		);
		return data;
	} catch (error) {
		const legacyType = legacyEntityType(entityType, error);
		if (!legacyType) throw error;
		const { data } = await api.get<GovernanceRecord>(
			governancePath(legacyType, entityId),
		);
		return data;
	}
}

export async function transitionGovernance(
	entityType: string,
	entityId: string,
	input: GovernanceTransitionInput,
) {
	const apiInput = {
		...input,
		toStatus: toGovernanceApiStatus(input.toStatus),
	};
	try {
		const { data } = await api.post<GovernanceRecord>(
			`${governancePath(entityType, entityId)}/transition`,
			apiInput,
		);
		return data;
	} catch (error) {
		const legacyType = legacyEntityType(entityType, error);
		if (!legacyType) throw error;
		const { data } = await api.post<GovernanceRecord>(
			`${governancePath(legacyType, entityId)}/transition`,
			input,
		);
		return data;
	}
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
