import { ConstructionError } from "../../lib/errors";

export type CompanyMappingRow = {
	organizationId: string;
	companyId: string;
	ownerId: string;
};

export function validateCompanyMapping(
	rows: readonly CompanyMappingRow[],
	knownOrganizations: ReadonlyMap<string, { ownerId: string }>,
	knownCompanies: ReadonlyMap<string, { ownerId: string }>,
): CompanyMappingRow[] {
	const organizations = new Set<string>();
	const result = rows.map((row) => {
		if (!row.organizationId || !row.companyId || !row.ownerId) {
			throw new ConstructionError(
				"COMPANY_MAPPING_INVALID",
				"Mapping exige organizationId, companyId e ownerId",
				422,
			);
		}
		if (organizations.has(row.organizationId)) {
			throw new ConstructionError(
				"COMPANY_MAPPING_DUPLICATE",
				`Organizacao duplicada no mapping: ${row.organizationId}`,
				422,
			);
		}
		organizations.add(row.organizationId);
		const organization = knownOrganizations.get(row.organizationId);
		const company = knownCompanies.get(row.companyId);
		if (!organization || !company) {
			throw new ConstructionError(
				"COMPANY_MAPPING_UNKNOWN_ID",
				`Organizacao ou empresa inexistente: ${row.organizationId}/${row.companyId}`,
				422,
			);
		}
		if (
			organization.ownerId !== row.ownerId ||
			company.ownerId !== row.ownerId
		) {
			throw new ConstructionError(
				"COMPANY_MAPPING_OWNER_MISMATCH",
				`Owner divergente no mapping: ${row.organizationId}`,
				422,
			);
		}
		return { ...row };
	});
	return result.sort((left, right) =>
		left.organizationId.localeCompare(right.organizationId),
	);
}
