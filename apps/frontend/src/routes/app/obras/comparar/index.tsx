import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";

import { compareWorks } from "@/api/bi";
import { biKeys, workKeys } from "@/api/query-keys";
import { listWorks } from "@/api/works";
import { LoadingSpinner } from "@/components/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { queryClient } from "@/lib/query-client";
import { requireManagementAccess } from "@/lib/route-authorization";
import { WorkCompareView } from "@/organisms/bi/work-compare";

const compareSearchSchema = z.object({
	workIds: z
		.preprocess((value) => {
			if (typeof value === "string")
				return value
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean);
			if (Array.isArray(value)) return value;
			return undefined;
		}, z.array(z.string()).optional())
		.default([]),
});

export const Route = createFileRoute("/app/obras/comparar/")({
	beforeLoad: requireManagementAccess,
	validateSearch: compareSearchSchema,
	loader: () => {
		void queryClient.prefetchQuery({
			queryKey: workKeys.list({ limit: 1000 }),
			queryFn: () => listWorks({ limit: 1000 }),
		}).catch(() => undefined);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Comparar Obras - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { workIds: urlWorkIds } = useSearch({ from: Route.id });
	const navigate = useNavigate({ from: Route.id });

	const selectedIds = useMemo(() => urlWorkIds ?? [], [urlWorkIds]);

	const { data: worksData, isLoading: worksLoading } = useQuery({
		queryKey: workKeys.list({ limit: 1000 }),
		queryFn: () => listWorks({ limit: 1000 }),
	});

	const {
		data: compareData,
		isLoading: compareLoading,
		error,
	} = useQuery({
		queryKey: biKeys.compare(selectedIds),
		queryFn: () => compareWorks(selectedIds),
		enabled: selectedIds.length >= 2,
	});

	const handleSelectionChange = (ids: string[]) => {
		navigate({
			search: { workIds: ids },
		});
	};

	const allWorks = useMemo(() => worksData?.data ?? [], [worksData]);

	return (
		<PageContainer
			DesktopHeader={
				<PageHeader
					title="Comparar Obras"
					description="Selecione obras para comparar indicadores lado a lado"
				/>
			}
		>
			{worksLoading ? (
				<LoadingSpinner title="Carregando obras..." />
			) : (
				<WorkCompareView
					selectedIds={selectedIds}
					onSelectionChange={handleSelectionChange}
					allWorks={allWorks}
					compareData={compareData ?? null}
					compareLoading={compareLoading}
					error={error}
				/>
			)}
		</PageContainer>
	);
}
