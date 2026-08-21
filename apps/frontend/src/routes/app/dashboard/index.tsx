import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { getMultiworksBI, getWorkBI } from "@/api/bi";
import { getContractSummary } from "@/api/contracts";
import {
	getCostCenterBI,
	getOrganizationBI,
	listAllCostCenters,
	listOrganizations,
} from "@/api/organizations";
import {
	biKeys,
	costCenterKeys,
	organizationKeys,
	workKeys,
} from "@/api/query-keys";
import { DashboardPage } from "@/components/organisms/dashboard/dashboard-page";
import { queryClient } from "@/lib/query-client";
import { requireManagementAccess } from "@/lib/route-authorization";
import {
	type DashboardSearch,
	dashboardSearchSchema,
} from "@/schemas/dashboard";
import type { AnalysisFilter } from "@/types/bi";
import { parseBIWorkIds } from "@/utils/bi-search";

export function toMultiworksFilter(search: DashboardSearch): AnalysisFilter {
	const workIds = parseBIWorkIds(search.workIds);
	return {
		...(workIds.length > 0 ? { workIds } : {}),
		...(search.q?.trim() ? { q: search.q.trim() } : {}),
		...(search.status ? { status: search.status } : {}),
	};
}

export const Route = createFileRoute("/app/dashboard/")({
	beforeLoad: requireManagementAccess,
	validateSearch: dashboardSearchSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: ({ deps }) => {
		const filter = toMultiworksFilter(deps.search);
		const selectedOrgId = deps.search.orgId;
		const selectedCCId = deps.search.ccId;
		const selectedWorkId = deps.search.workId;
		const selectedWorks = filter.workIds;
		const organizationFilter = selectedWorks ? { workIds: selectedWorks } : {};

		void Promise.all([
			...(deps.search.scope !== "system"
				? [
						queryClient.prefetchQuery({
							queryKey: organizationKeys.list(),
							queryFn: () => listOrganizations({ limit: 100 }),
						}),
						queryClient.prefetchQuery({
							queryKey: costCenterKeys.allList(),
							queryFn: () => listAllCostCenters({ limit: 100 }),
						}),
					]
				: []),
			...(deps.search.scope === "system"
				? [
						queryClient.prefetchQuery({
							queryKey: biKeys.multiworks(filter),
							queryFn: () => getMultiworksBI(filter),
						}),
					]
				: []),
			...(deps.search.scope === "organization" && selectedOrgId
				? [
						queryClient.prefetchQuery({
							queryKey: biKeys.overview(selectedOrgId, organizationFilter),
							queryFn: () =>
								getOrganizationBI(selectedOrgId, organizationFilter),
						}),
					]
				: []),
			...(deps.search.scope === "costCenter" && selectedOrgId && selectedCCId
				? [
						queryClient.prefetchQuery({
							queryKey: biKeys.costCenterOverview(
								selectedOrgId,
								selectedCCId,
								organizationFilter,
							),
							queryFn: () =>
								getCostCenterBI(
									selectedOrgId,
									selectedCCId,
									organizationFilter,
								),
						}),
					]
				: []),
			...(deps.search.scope === "work" && selectedWorkId
				? [
						queryClient.prefetchQuery({
							queryKey: workKeys.bi(selectedWorkId),
							queryFn: () => getWorkBI(selectedWorkId),
						}),
						queryClient.prefetchQuery({
							queryKey: biKeys.multiworks(),
							queryFn: () => getMultiworksBI(),
						}),
						queryClient.prefetchQuery({
							queryKey: workKeys.contractsSummary(selectedWorkId),
							queryFn: () => getContractSummary(selectedWorkId),
						}),
					]
				: []),
		]);
	},
	component: DashboardRouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Dashboard Analítico - ObraControl" },
		],
	}),
});

function DashboardRouteComponent() {
	const search = useSearch({ from: Route.id });
	const navigate = useNavigate({ from: Route.id });
	const filter = toMultiworksFilter(search);

	const multiworksQuery = useQuery({
		queryKey: biKeys.multiworks(filter),
		queryFn: () => getMultiworksBI(filter),
		enabled: search.scope === "system",
	});

	const organizationsQuery = useQuery({
		queryKey: organizationKeys.list(),
		queryFn: () => listOrganizations({ limit: 100 }),
		enabled: search.scope !== "system",
	});

	const costCentersQuery = useQuery({
		queryKey: costCenterKeys.allList(),
		queryFn: () => listAllCostCenters({ limit: 100 }),
		enabled: search.scope !== "system",
	});

	const selectedWorks = filter.workIds;
	const organizationFilter = selectedWorks ? { workIds: selectedWorks } : {};

	const organizationQuery = useQuery({
		queryKey: biKeys.overview(search.orgId ?? "", organizationFilter),
		queryFn: () =>
			getOrganizationBI(search.orgId as string, organizationFilter),
		enabled: search.scope === "organization" && !!search.orgId,
	});

	const costCenterQuery = useQuery({
		queryKey: biKeys.costCenterOverview(
			search.orgId ?? "",
			search.ccId ?? "",
			organizationFilter,
		),
		queryFn: () =>
			getCostCenterBI(
				search.orgId as string,
				search.ccId as string,
				organizationFilter,
			),
		enabled: search.scope === "costCenter" && !!search.orgId && !!search.ccId,
	});

	const workQuery = useQuery({
		queryKey: workKeys.bi(search.workId ?? ""),
		queryFn: () => getWorkBI(search.workId as string),
		enabled: search.scope === "work" && !!search.workId,
	});

	const workOptionsQuery = useQuery({
		queryKey: biKeys.multiworks(),
		queryFn: () => getMultiworksBI(),
		enabled: search.scope === "work",
	});

	const contractSummaryQuery = useQuery({
		queryKey: workKeys.contractsSummary(search.workId ?? ""),
		queryFn: () => getContractSummary(search.workId as string),
		enabled: search.scope === "work" && !!search.workId,
	});

	const handleSearchChange = (changes: Partial<DashboardSearch>) => {
		navigate({ search: (previous) => ({ ...previous, ...changes }) });
	};

	return (
		<DashboardPage
			search={search}
			onSearchChange={handleSearchChange}
			multiworks={multiworksQuery.data}
			multiworksLoading={multiworksQuery.isLoading}
			multiworksError={multiworksQuery.error}
			onMultiworksRetry={() => multiworksQuery.refetch()}
			organizations={organizationsQuery.data}
			costCenters={costCentersQuery.data}
			organizationQuery={{
				data: organizationQuery.data,
				isLoading: organizationQuery.isLoading,
				error: organizationQuery.error,
				onRetry: () => organizationQuery.refetch(),
			}}
			costCenterQuery={{
				data: costCenterQuery.data,
				isLoading: costCenterQuery.isLoading,
				error: costCenterQuery.error,
				onRetry: () => costCenterQuery.refetch(),
			}}
			workQuery={{
				data: workQuery.data,
				isLoading: workQuery.isLoading,
				error: workQuery.error,
				onRetry: () => workQuery.refetch(),
			}}
			workOptions={workOptionsQuery.data}
			contractSummary={contractSummaryQuery.data}
		/>
	);
}
