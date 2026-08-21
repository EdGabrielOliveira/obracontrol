import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
	// Check one specific item
	const item = await prisma.constructionBudgetItem.findFirst({
		where: { index: "1.1" },
		select: {
			id: true,
			index: true,
			totalCost: true,
			laborUnitCost: true,
			quantity: true,
		},
	});
	console.log("Item 1.1:", JSON.stringify(item, null, 2));

	// Try to update it directly
	const updated = await prisma.constructionBudgetItem.update({
		where: { id: item?.id },
		data: { totalCost: 160000 },
		select: { id: true, totalCost: true },
	});
	console.log("Updated:", JSON.stringify(updated, null, 2));

	// Read it back
	const check = await prisma.constructionBudgetItem.findFirst({
		where: { id: item?.id },
		select: { totalCost: true },
	});
	console.log("Check after update:", JSON.stringify(check, null, 2));
}

main()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
