import { PrismaClient } from "@prisma/client";
import { ORCAMENTO_PADRAO } from "./budget";
import { OBRAS } from "./works";

const prisma = new PrismaClient();

async function main() {
	const items = await prisma.constructionBudgetItem.findMany({
		select: { id: true, workId: true, index: true, ownerId: true },
		orderBy: { sortOrder: "asc" },
	});

	let updated = 0;
	for (const item of items) {
		const fixture = ORCAMENTO_PADRAO.find((f) => f.idx === item.index);
		if (!fixture) {
			console.log(
				`  Índice ${item.index} não encontrado nos fixtures, pulando`,
			);
			continue;
		}

		const totalUnit =
			fixture.labor + fixture.material + fixture.equip + fixture.other;
		const total = fixture.qty * totalUnit;

		await prisma.constructionBudgetItem.update({
			where: { id: item.id },
			data: {
				quantity: fixture.parent ? fixture.qty : null,
				laborUnitCost: fixture.parent ? fixture.labor : null,
				materialUnitCost: fixture.parent ? fixture.material : null,
				equipmentUnitCost: fixture.parent ? fixture.equip : null,
				otherUnitCost: fixture.parent ? fixture.other : null,
				unitCostTotal: fixture.parent ? totalUnit : null,
				totalBudget: total,
				unitCost: fixture.parent ? totalUnit : null,
				totalCost: total,
				completionPercentage: 0,
			},
		});
		updated++;
	}

	console.log(`✅ ${updated} itens de orçamento atualizados`);

	// Fix actual costs - they have amt defined in works.ts
	// Find the work code for each cost
	const costs = await prisma.constructionActualCost.findMany({
		select: { id: true, workId: true },
	});

	let costsUpdated = 0;
	for (const cost of costs) {
		const work = await prisma.constructionWork.findUnique({
			where: { id: cost.workId },
			select: { code: true, ownerId: true },
		});
		if (!work) continue;

		const obraDef = OBRAS.find((o) => o.code === work.code);
		if (!obraDef) continue;

		// Find the cost index by checking the costs array order
		const workCosts = await prisma.constructionActualCost.findMany({
			where: { workId: cost.workId },
			select: { id: true },
			orderBy: { costDate: "asc" },
		});
		const costIndex = workCosts.findIndex((c) => c.id === cost.id);
		if (costIndex === -1 || costIndex >= obraDef.costs.length) continue;

		const costDef = obraDef.costs[costIndex];

		await prisma.constructionActualCost.update({
			where: { id: cost.id },
			data: { amount: costDef.amt },
		});
		costsUpdated++;
	}

	console.log(`✅ ${costsUpdated} custos atualizados`);
}

main()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
