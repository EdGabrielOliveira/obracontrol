import { describe, expect, it } from "bun:test";
import { ConstructionError } from "../../../../src/lib/errors";
import { validateCompanyMapping } from "../../../../src/modules/organizations/company-mapping";

const organizations = new Map([
	["org-1", { ownerId: "owner-1" }],
	["org-2", { ownerId: "owner-1" }],
]);
const companies = new Map([["company-1", { ownerId: "owner-1" }]]);

describe("company mapping", () => {
	it("valida e ordena mapping explicito", () => {
		expect(
			validateCompanyMapping(
				[
					{
						organizationId: "org-2",
						companyId: "company-1",
						ownerId: "owner-1",
					},
					{
						organizationId: "org-1",
						companyId: "company-1",
						ownerId: "owner-1",
					},
				],
				organizations,
				companies,
			),
		).toEqual([
			{ organizationId: "org-1", companyId: "company-1", ownerId: "owner-1" },
			{ organizationId: "org-2", companyId: "company-1", ownerId: "owner-1" },
		]);
	});

	it("rejeita duplicata, id desconhecido e owner cruzado", () => {
		for (const rows of [
			[
				{ organizationId: "org-1", companyId: "company-1", ownerId: "owner-1" },
				{ organizationId: "org-1", companyId: "company-1", ownerId: "owner-1" },
			],
			[
				{
					organizationId: "missing",
					companyId: "company-1",
					ownerId: "owner-1",
				},
			],
			[{ organizationId: "org-1", companyId: "company-1", ownerId: "owner-2" }],
		]) {
			expect(() =>
				validateCompanyMapping(rows, organizations, companies),
			).toThrow(ConstructionError);
		}
	});
});
