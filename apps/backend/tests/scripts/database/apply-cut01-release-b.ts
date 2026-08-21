import { PrismaClient } from "@prisma/client";
import {
	DEFAULT_TEST_DATABASE_URL,
	validateTestDatabaseUrl,
} from "../../support/test-database-guard";

const databaseUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
const validated = validateTestDatabaseUrl(databaseUrl);
if (!validated.ok) throw new Error(`CUT-01 recusado: ${validated.reason}`);

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
try {
	const organizations = await prisma.organization.count({
		where: { companyId: null },
	});
	const legacyCosts = await prisma.constructionActualCost.count({
		where: { budgetVersionItemId: null },
	});
	if (organizations || legacyCosts) {
		throw new Error(
			`CUT-01 bloqueado: organizations=${organizations}, legacyCosts=${legacyCosts}`,
		);
	}
	await prisma.$transaction(async (tx) => {
		await tx.$executeRawUnsafe(
			'ALTER TABLE "Organization" ALTER COLUMN "companyId" SET NOT NULL',
		);
		await tx.$executeRawUnsafe(
			'ALTER TABLE "ConstructionActualCost" ALTER COLUMN "budgetVersionItemId" SET NOT NULL',
		);
	});
	console.log("CUT-01 Release B aplicado no banco de teste com sucesso.");
} finally {
	await prisma.$disconnect();
}
