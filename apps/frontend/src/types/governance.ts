export type GovernanceStatus = "RASCUNHO" | "EM_REVISAO" | "ACEITO" | "TRAVADO";

export type GovernanceRecord = {
	id: string | null;
	ownerId: string;
	entityType: string;
	entityId: string;
	status: GovernanceStatus;
	version: number;
	reason: string | null;
	changedBy: string | null;
	changedAt: string | null;
};

export type GovernanceTransitionInput = {
	toStatus: GovernanceStatus;
	reason?: string;
	override?: boolean;
};

export type ApprovalRequestView = {
	id: string;
	status:
		| "PENDING"
		| "APPROVED"
		| "REJECTED"
		| "CONFLICTED"
		| "CANCELLED"
		| "EXECUTED";
	effectAction: string;
	actor: { id: string; name: string; role: string };
	scope: {
		organizationId: string;
		costCenterId: string | null;
		resourceType: string;
		resourceId: string | null;
	};
	target: {
		label: string;
		path: string | null;
	};
	description: string | null;
	requiredApproverRole: "GESTOR" | "GERENTE";
	createdAt: string;
	decisionReason: string | null;
};
