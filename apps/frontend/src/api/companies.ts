import type { AddressValue } from "@/types/address";
import { api } from "./api";

export type Company = {
	id: string;
	name: string;
	document: string | null;
	tradeName: string | null;
	addressCity: string | null;
	addressState: string | null;
	structuredAddress: AddressValue | null;
	contactEmail: string | null;
	contactPhone: string | null;
	managerName: string | null;
	contractTemplate: string | null;
	organizationCount: number;
	createdAt: string;
	contractTemplateSha256: string | null;
	contractTemplateVersion: number;
};

export type CompanyInput = {
	name: string;
	document?: string;
	tradeName?: string;
	structuredAddress?: AddressValue | null;
	contactEmail?: string;
	contactPhone?: string;
	managerName?: string;
};

export async function listCompanies() {
	const { data } = await api.get<Company[]>("/organizations/companies");
	return data;
}

export async function getCompany(companyId: string) {
	const { data } = await api.get<Company>(
		`/organizations/companies/${companyId}`,
	);
	return data;
}

export async function updateCompany(
	companyId: string,
	input: Partial<CompanyInput>,
) {
	const { data } = await api.patch<Company>(
		`/organizations/companies/${companyId}`,
		input,
	);
	return data;
}

export async function deleteCompany(companyId: string) {
	await api.delete(`/organizations/companies/${companyId}`);
}

export async function createCompany(input: CompanyInput) {
	const { data } = await api.post<Company>("/organizations/companies", input);
	return data;
}

export async function createCompanyWithTemplate(
	input: CompanyInput,
	file: File,
) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(input)) {
		if (value)
			formData.append(
				key,
				typeof value === "object" ? JSON.stringify(value) : value,
			);
	}
	formData.append("file", file);
	const { data } = await api.post<Company>(
		"/organizations/companies/with-template",
		formData,
		{
			headers: { "Content-Type": "multipart/form-data" },
		},
	);
	return data;
}

export async function uploadCompanyTemplate(companyId: string, file: File) {
	const formData = new FormData();
	formData.append("file", file);
	const { data } = await api.post<Company>(
		`/organizations/companies/${companyId}/template`,
		formData,
		{ headers: { "Content-Type": "multipart/form-data" } },
	);
	return data;
}
