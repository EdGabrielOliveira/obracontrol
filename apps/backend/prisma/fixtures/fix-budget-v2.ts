import { PrismaClient } from "@prisma/client";
import { ORCAMENTO_PADRAO } from "./budget";
import { OBRAS } from "./works";

const prisma = new PrismaClient();

async function main() {
	// Fix items by finding works and their ACTIVE import
	const works = await prisma.constructionWork.findMany({
		select: { id: true, code: true, activeImportId: true },
	});

	for (const work of works) {
		const importId = work.activeImportId;
		if (!importId) {
			console.log(`Work ${work.code}: no active import, skipping`);
			continue;
		}

		const items = await prisma.constructionBudgetItem.findMany({
			where: { workId: work.id, importId },
			select: { id: true, index: true },
			orderBy: { sortOrder: "asc" },
		});

		let count = 0;
		for (const item of items) {
			const fixture = ORCAMENTO_PADRAO.find((f) => f.idx === item.index);
			if (!fixture) continue;

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
			count++;
		}
		console.log(`Work ${work.code}: ${count} items fixed`);

		// Fix actual costs
		const costs = await prisma.constructionActualCost.findMany({
			where: { workId: work.id, importId },
			orderBy: { costDate: "asc" },
		});

		const obraDef = OBRAS.find((o) => o.code === work.code);
		if (obraDef) {
			let costCount = 0;
			for (let i = 0; i < costs.length && i < obraDef.costs.length; i++) {
				await prisma.constructionActualCost.update({
					where: { id: costs[i].id },
					data: { amount: obraDef.costs[i].amt },
				});
				costCount++;
			}
			console.log(`Work ${work.code}: ${costCount} costs fixed`);
		}
	}

	// Fix contracts
	const contracts = await prisma.contract.findMany({
		include: {
			services: { select: { id: true, quantity: true, unitCost: true } },
		},
	});

	for (const contract of contracts) {
		let calculatedValue = 0;
		for (const s of contract.services) {
			const qty = s.quantity ? Number(s.quantity) : 0;
			const cost = s.unitCost ? Number(s.unitCost) : 0;
			calculatedValue += qty * cost;
		}

		if (calculatedValue > 0) {
			await prisma.contract.update({
				where: { id: contract.id },
				data: { contractValue: calculatedValue },
			});
		}
	}
	console.log(`Contracts: ${contracts.length} updated`);
}

main()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
