import { readFile } from "node:fs/promises";
import { prisma } from "../../src/lib/prisma";
import {
	type CompanyMappingRow,
	validateCompanyMapping,
} from "../../src/modules/organizations/company-mapping";

const path = process.argv[2] ?? "prisma/mappings/company-mapping.v1.json";
const input = JSON.parse(await readFile(path, "utf8")) as {
	version: number;
	rows: CompanyMappingRow[];
};
if (input.version !== 1) throw new Error("company mapping version must be 1");
const [organizations, companies] = await Promise.all([
	prisma.organization.findMany({ select: { id: true, ownerId: true } }),
	prisma.company.findMany({ select: { id: true, ownerId: true } }),
]);
const result = validateCompanyMapping(
	input.rows,
	new Map(organizations.map((row) => [row.id, { ownerId: row.ownerId }])),
	new Map(companies.map((row) => [row.id, { ownerId: row.ownerId }])),
);
const orphaned = organizations.filter(
	(org) => !result.some((row) => row.organizationId === org.id),
);
if (orphaned.length > 0) {
	throw new Error(`organizations without mapping: ${orphaned.length}`);
}
console.log(JSON.stringify({ version: 1, rows: result, orphaned: 0 }, null, 2));
