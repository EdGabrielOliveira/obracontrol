import { PrismaClient } from "@prisma/client";

type ReconciliationRow = {
	workId: string;
	activeVersions: number;
	activeImports: number;
	activeOperationalItems: number;
	missingOperationalIdentities: number;
	versionLeafTotal: string;
	operationalLeafTotal: string;
	status: "OK" | "REVIEW";
};

function sumLeaf<T extends { id: string; totalCost: unknown }>(
	items: T[],
	parents: Set<string>,
) {
	return items
		.filter((item) => !parents.has(item.id))
		.reduce((sum, item) => sum + Number(item.totalCost ?? 0), 0);
}

export async function reconcileBudgetVersions(prisma: PrismaClient) {
	const works = await prisma.constructionWork.findMany({
		select: { id: true, activeImportId: true },
		orderBy: { id: "asc" },
	});
	const rows: ReconciliationRow[] = [];

	for (const work of works) {
		const [activeVersions, activeImports] = await Promise.all([
			prisma.budgetVersion.findMany({
				where: { workId: work.id, isActive: true },
				include: {
					items: {
						select: { id: true, totalCost: true, parentVersionId: true },
					},
				},
			}),
			work.activeImportId
				? prisma.constructionImport.count({
						where: { id: work.activeImportId },
					})
				: Promise.resolve(0),
		]);
		const operationalItems = work.activeImportId
			? await prisma.constructionBudgetItem.findMany({
					where: { workId: work.id, importId: work.activeImportId },
					select: {
						id: true,
						identityId: true,
						totalCost: true,
						parentId: true,
					},
				})
			: [];
		const versionItems = activeVersions[0]?.items ?? [];
		const versionParents = new Set(
			versionItems
				.map((item) => item.parentVersionId)
				.filter((id): id is string => Boolean(id)),
		);
		const operationalParents = new Set(
			operationalItems
				.map((item) => item.parentId)
				.filter((id): id is string => Boolean(id)),
		);
		const missingOperationalIdentities = operationalItems.filter(
			(item) => !item.identityId,
		).length;
		const versionLeafTotal = sumLeaf(versionItems, versionParents);
		const operationalLeafTotal = sumLeaf(operationalItems, operationalParents);
		const status =
			activeVersions.length === 1 &&
			activeImports === 1 &&
			missingOperationalIdentities === 0 &&
			Math.abs(versionLeafTotal - operationalLeafTotal) <= 0.01
				? "OK"
				: "REVIEW";
		rows.push({
			workId: work.id,
			activeVersions: activeVersions.length,
			activeImports,
			activeOperationalItems: operationalItems.length,
			missingOperationalIdentities,
			versionLeafTotal: versionLeafTotal.toFixed(2),
			operationalLeafTotal: operationalLeafTotal.toFixed(2),
			status,
		});
	}
	return rows;
}

async function main() {
	const prisma = new PrismaClient();
	try {
		const rows = await reconcileBudgetVersions(prisma);
		console.log(
			JSON.stringify(
				{
					total: rows.length,
					review: rows.filter((row) => row.status === "REVIEW").length,
					rows,
				},
				null,
				2,
			),
		);
	} finally {
		await prisma.$disconnect();
	}
}

if (import.meta.main) void main();
