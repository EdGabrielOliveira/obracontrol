export interface BreadcrumbItem {
	label: string;
	to?: string;
}

export function useBreadcrumb(params: {
	orgName?: string;
	orgId?: string;
	ccName?: string;
	ccId?: string;
	workName?: string;
	workId?: string;
	contractName?: string;
	contractId?: string;
	section?: string;
}): BreadcrumbItem[] {
	const items: BreadcrumbItem[] = [];

	if (params.orgName && params.orgId) {
		items.push({ label: "Organizações", to: "/app/organizacoes" });
		items.push({
			label: params.orgName,
			to: `/app/organizacoes/${params.orgId}`,
		});
	} else if (params.ccName && params.ccId) {
		items.push({ label: "Centros de Custo", to: "/app/centros-de-custo" });
		items.push({
			label: params.ccName,
			to: `/app/centros-de-custo/${params.ccId}`,
		});
	} else if (params.workName && params.workId) {
		items.push({ label: "Obras", to: "/app/obras" });
		items.push({
			label: params.workName,
			to: `/app/obras/${params.workId}`,
		});
	} else if (params.section) {
		items.push({ label: "Obras", to: "/app/obras" });
	}

	if (params.contractName && params.contractId && params.workId) {
		items.push({
			label: params.contractName,
			to: `/app/obras/${params.workId}/contratos/${params.contractId}`,
		});
	}

	if (params.section) {
		items.push({ label: params.section });
	}

	return items;
}
