import { PrismaClient } from "@prisma/client";

type Row = {
	workId: string;
	itemId: string;
	index: string;
	action: "WOULD_LINK" | "ALREADY_LINKED";
};

export async function backfillBudgetItemIdentities(
	prisma: PrismaClient,
	apply: boolean,
): Promise<Row[]> {
	const works = await prisma.constructionWork.findMany({
		where: { activeImportId: { not: null } },
		select: { id: true, ownerId: true, activeImportId: true },
		orderBy: { id: "asc" },
	});
	const rows: Row[] = [];

	for (const work of works) {
		if (!work.activeImportId) continue;
		const items = await prisma.constructionBudgetItem.findMany({
			where: { workId: work.id, importId: work.activeImportId },
			select: { id: true, index: true, identityId: true },
			orderBy: { index: "asc" },
		});

		for (const item of items) {
			if (item.identityId) {
				rows.push({
					workId: work.id,
					itemId: item.id,
					index: item.index,
					action: "ALREADY_LINKED",
				});
				continue;
			}

			rows.push({
				workId: work.id,
				itemId: item.id,
				index: item.index,
				action: "WOULD_LINK",
			});
			if (!apply) continue;

			await prisma.$transaction(async (tx) => {
				const identity = await tx.budgetItemIdentity.upsert({
					where: { workId_index: { workId: work.id, index: item.index } },
					create: {
						ownerId: work.ownerId,
						workId: work.id,
						index: item.index,
					},
					update: {},
					select: { id: true },
				});
				await tx.constructionBudgetItem.update({
					where: { id: item.id },
					data: { identityId: identity.id },
				});
			});
		}
	}

	return rows;
}

async function main() {
	const apply = process.argv.includes("--apply");
	const prisma = new PrismaClient();
	try {
		const rows = await backfillBudgetItemIdentities(prisma, apply);
		const pending = rows.filter((row) => row.action === "WOULD_LINK");
		console.log(
			JSON.stringify(
				{
					mode: apply ? "APPLY" : "DRY_RUN",
					total: rows.length,
					pending: pending.length,
					rows: pending,
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
