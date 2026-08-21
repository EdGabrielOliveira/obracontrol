import { describe, expect, it, mock } from "bun:test";

const submitApproval = mock(
	async (): Promise<{
		status: "APPROVED" | "PENDING";
		approvalRequestId: string | null;
		data?: unknown;
		scope?: { organizationId: string; costCenterId: string | null };
	}> => ({
		status: "PENDING",
		approvalRequestId: "req-1",
		scope: { organizationId: "org-1", costCenterId: "cc-1" },
	}),
);

mock.module("../../../../src/modules/governance/approval.service", () => ({
	submitApproval,
}));

mock.module("../../../../src/modules/construction-planning/repository", () => ({
	getWorkOrThrow: mock(async () => ({ id: "work-1", ownerId: "owner-1" })),
	findWorkByOwnerAndCode: mock(async () => null),
	getWorkById: mock(async () => null),
}));

mock.module(
	"../../../../src/modules/construction-planning/contract.repository",
	() => ({
		getContractById: mock(async () => null),
		countAmendments: mock(async () => 0),
	}),
);

mock.module("../suppliers/supplier.repository", () => ({
	getSupplierById: mock(async () => null),
	findSupplierByDocument: mock(async () => null),
	findWorkSupplier: mock(async () => null),
}));

mock.module("../../lib/governance", () => ({
	assertNoPendingEffect: mock(async () => undefined),
}));

mock.module(
	"../../../../src/modules/construction-planning/governance-guard",
	() => ({
		constructionGovernanceGuard: {
			assertWritable: mock(async () => undefined),
			isWritableBlocked: mock(async () => false),
		},
	}),
);

const { contractService } = await import(
	"../../../../src/modules/construction-planning/contract.service"
);

describe("createContract deferido (USR-002/DEC-005)", () => {
	it("SUPERVISOR recebe PENDING e o contrato nao e criado", async () => {
		submitApproval.mockResolvedValueOnce({
			status: "PENDING",
			approvalRequestId: "req-1",
			scope: { organizationId: "org-1", costCenterId: "cc-1" },
		});

		const result = await contractService.createContract(
			"owner-1",
			"work-1",
			{
				code: "CT-PEND-1",
				supplierName: "Fornecedor",
				contractValue: 1000,
				objectDescription: "Servicos de fundacao",
				status: "RASCUNHO",
			},
			{ userId: "supervisor-1" },
		);

		expect(result).toMatchObject({
			status: "PENDING",
			approvalRequest: {
				requiredApproverRole: "GESTOR",
				organizationId: "org-1",
				costCenterId: "cc-1",
			},
		});
		expect(submitApproval).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: "supervisor-1",
				effectAction: "CONTRACT_CREATE",
				resourceId: null,
				payload: expect.objectContaining({
					contract: expect.objectContaining({ code: "CT-PEND-1" }),
				}),
			}),
		);
	});

	it("GERENTE recebe EXECUTED com o contrato criado", async () => {
		submitApproval.mockResolvedValueOnce({
			status: "APPROVED",
			approvalRequestId: "req-2",
			data: { id: "contract-1", code: "CT-EXEC-1" },
		});

		const result = await contractService.createContract(
			"owner-1",
			"work-1",
			{
				code: "CT-EXEC-1",
				supplierName: "Fornecedor",
				contractValue: 1000,
				objectDescription: "Servicos de fundacao",
				status: "RASCUNHO",
			},
			{ userId: "gerente-1" },
		);

		expect(result).toMatchObject({
			status: "EXECUTED",
			data: { id: "contract-1" },
		});
	});
});
