import { PrismaClient } from "@prisma/client";
import { getOrCreateBaselineVersion } from "../../src/lib/budget-version-adapter";

async function main() {
	const apply = process.argv.includes("--apply");
	const prisma = new PrismaClient();
	try {
		const works = await prisma.constructionWork.findMany({
			where: { activeImportId: { not: null } },
			select: { id: true, ownerId: true },
			orderBy: { id: "asc" },
		});
		const candidates: string[] = [];
		for (const work of works) {
			const active = await prisma.budgetVersion.count({
				where: { workId: work.id, isActive: true },
			});
			if (active === 0) candidates.push(work.id);
		}
		if (apply) {
			for (const workId of candidates) {
				const work = works.find((item) => item.id === workId);
				if (work) await getOrCreateBaselineVersion(work.ownerId, workId);
			}
		}
		console.log(
			JSON.stringify(
				{
					mode: apply ? "APPLY" : "DRY_RUN",
					repaired: apply ? candidates : [],
					candidates,
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
