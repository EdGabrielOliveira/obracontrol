import type { CostCenter, Organization } from "@/types/organizations";
import type { WorkSummaryWithHierarchy } from "@/types/works";

export type WorkListingRow = WorkSummaryWithHierarchy & {
	orgId: string;
	ccId: string;
};

export type CostCenterListingRow = CostCenter & {
	organizationName?: string;
};

export function buildWorkRows(
	works: WorkSummaryWithHierarchy[],
	input?: {
		organizations: Organization[];
		costCenters: CostCenter[];
	},
): WorkListingRow[] {
	const organizationById = input
		? new Map(input.organizations.map((org) => [org.id, org.name] as const))
		: null;
	const costCenterById = input
		? new Map(input.costCenters.map((cc) => [cc.id, cc] as const))
		: null;

	return works.map((work) => ({
		...work,
		orgId:
			work.organizationId ??
			(work.costCenterId
				? (costCenterById?.get(work.costCenterId)?.organizationId ?? "")
				: ""),
		ccId: work.costCenterId ?? "",
		organizationName: (() => {
			const resolvedOrgId =
				work.organizationId ??
				(work.costCenterId
					? (costCenterById?.get(work.costCenterId)?.organizationId ?? "")
					: "");
			return (
				work.organizationName ??
				(resolvedOrgId ? (organizationById?.get(resolvedOrgId) ?? "") : "")
			);
		})(),
		costCenterName:
			work.costCenterName ??
			(work.costCenterId
				? (costCenterById?.get(work.costCenterId)?.name ?? "")
				: ""),
	}));
}

export function buildCostCenterRows(input: {
	organizations: Organization[];
	costCenters: CostCenter[];
}): CostCenterListingRow[] {
	const organizationById = new Map(
		input.organizations.map((org) => [org.id, org.name] as const),
	);

	return input.costCenters.map((costCenter) => ({
		...costCenter,
		organizationName: organizationById.get(costCenter.organizationId) ?? "",
	}));
}
