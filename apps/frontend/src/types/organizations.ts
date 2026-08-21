import type { AddressValue } from "./address";
import type { MultiworksBIResponse } from "./bi";

export type Organization = {
	id: string;
	name: string;
	companyId?: string | null;
	managerName?: string | null;
	structuredAddress?: AddressValue | null;
	createdAt: string;
	_count?: { costCenters: number };
};

export type CreateOrganizationInput = {
	name: string;
	companyId?: string;
	managerName?: string;
	structuredAddress?: AddressValue | null;
};

export type UpdateOrganizationInput = Partial<CreateOrganizationInput>;

export type CostCenter = {
	id: string;
	name: string;
	organizationId: string;
	createdAt: string;
	managerName?: string | null;
	address?: string | null;
	structuredAddress?: AddressValue | null;
};

export type CreateCostCenterInput = {
	name: string;
	managerName?: string;
	structuredAddress?: AddressValue | null;
};

export type UpdateCostCenterInput = {
	name?: string;
	organizationId?: string;
	structuredAddress?: AddressValue | null;
};

export type OrganizationBIData = MultiworksBIResponse;

export type CostCenterDetail = CostCenter & {
	organization: { id: string; name: string } | null;
};

export type CostCenterBIData = MultiworksBIResponse;
