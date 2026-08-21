import { prisma } from "../../lib/prisma";

export type ContractGovernanceScope = {
	getWorkId: (ownerId: string, contractId: string) => Promise<string | null>;
};

export const contractGovernanceScope: ContractGovernanceScope = {
	async getWorkId(ownerId, contractId) {
		const contract = await prisma.contract.findFirst({
			where: { id: contractId, ownerId },
			select: { workId: true },
		});
		return contract?.workId ?? null;
	},
};
