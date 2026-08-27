import { beforeEach, describe, expect, it, mock } from "bun:test";

const assertWritable = mock(async () => undefined);
const getMeasurement = mock(async () => ({ id: "contract-measurement-1" }));
const getContractLedgerContext = mock(async () => ({ workId: "work-1" }));
const countPaidPaymentsForMeasurement = mock(async () => 0);
const updateMeasurementStatus = mock(async () => ({
	id: "contract-measurement-1",
}));
const applyContractMeasurementAcceptance = mock(async () => undefined);
const reverseContractMeasurementAcceptance = mock(async () => undefined);
const activateContractMeasurement = mock(async () => undefined);
const discardPendingContractMeasurement = mock(async () => undefined);
const deactivateContractMeasurement = mock(async () => undefined);
const findFirst = mock(async () => ({
	id: "contract-measurement-1",
	status: "RASCUNHO",
	number: 1,
	title: "Medição",
	statusReason: null,
	items: [],
}));
const writeAudit = mock(async () => undefined);

mock.module(
	"../../../../src/modules/construction-planning/contract-measurement.repository",
	() => ({
		getContractLedgerContext,
		countPaidPaymentsForMeasurement,
		updateMeasurementStatus,
	}),
);
mock.module(
	"../../../../src/modules/construction-planning/measurement-acceptance-effects",
	() => ({
		applyContractMeasurementAcceptance,
		reverseContractMeasurementAcceptance,
	}),
);
mock.module(
	"../../../../src/modules/construction-planning/measurement-coverage.service",
	() => ({
		measurementCoverageService: {
			activateContractMeasurement,
			discardPendingContractMeasurement,
			deactivateContractMeasurement,
		},
	}),
);
mock.module("../../../../src/lib/resource-scope", () => ({
	resolveResourceScope: mock(async () => ({ companyIds: ["owner-1"] })),
}));
mock.module("../../../../src/lib/audit-writer", () => ({ writeAudit }));
mock.module("../../../../src/lib/transaction-retry", () => ({
	withSerializableRetry: async (operation: (tx: unknown) => Promise<unknown>) =>
		operation({ contractMeasurement: { findFirst } }),
}));

const { setContractMeasurementStatus } = await import(
	"../../../../src/modules/construction-planning/contract-measurement-status.service"
);

describe("setContractMeasurementStatus", () => {
	beforeEach(() => {
		assertWritable.mockClear();
		getMeasurement.mockClear();
		getContractLedgerContext.mockClear();
		countPaidPaymentsForMeasurement.mockClear();
		updateMeasurementStatus.mockClear();
		applyContractMeasurementAcceptance.mockClear();
		reverseContractMeasurementAcceptance.mockClear();
		activateContractMeasurement.mockClear();
		discardPendingContractMeasurement.mockClear();
		deactivateContractMeasurement.mockClear();
		findFirst.mockClear();
		findFirst.mockResolvedValue({
			id: "contract-measurement-1",
			status: "RASCUNHO",
			number: 1,
			title: "Medição",
			statusReason: null,
			items: [],
		});
		writeAudit.mockClear();
	});

	it("materializes reserved coverage only after accepting the measurement", async () => {
		await setContractMeasurementStatus({
			ownerId: "owner-1",
			contractId: "contract-1",
			measurementId: "contract-measurement-1",
			status: "ACEITO",
			reason: null,
			role: "ADMIN",
			actorId: "user-1",
			assertWritable,
			getMeasurement,
		});

		expect(applyContractMeasurementAcceptance).toHaveBeenCalledTimes(1);
		expect(updateMeasurementStatus).toHaveBeenCalledWith(
			"owner-1",
			"contract-1",
			"contract-measurement-1",
			"ACEITO",
			null,
			"user-1",
			expect.anything(),
			"RASCUNHO",
		);
		expect(activateContractMeasurement).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"contract-measurement-1",
			{ userId: "user-1" },
			expect.anything(),
		);
		expect(discardPendingContractMeasurement).not.toHaveBeenCalled();
		expect(writeAudit).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				action: "STATUS_CHANGED",
				entityType: "CONTRACT_MEASUREMENT",
				previousState: { status: "RASCUNHO", statusReason: null },
				newState: { status: "ACEITO", statusReason: null },
			}),
		);
	});

	it("discards pending coverage when rejecting a draft", async () => {
		await setContractMeasurementStatus({
			ownerId: "owner-1",
			contractId: "contract-1",
			measurementId: "contract-measurement-1",
			status: "RECUSADO",
			reason: "Documento incompleto",
			role: "ADMIN",
			actorId: "user-1",
			assertWritable,
			getMeasurement,
		});

		expect(applyContractMeasurementAcceptance).not.toHaveBeenCalled();
		expect(activateContractMeasurement).not.toHaveBeenCalled();
		expect(discardPendingContractMeasurement).toHaveBeenCalledWith(
			"contract-measurement-1",
			expect.anything(),
		);
	});

	it("reverses acceptance and coverage when leaving accepted", async () => {
		findFirst.mockResolvedValue({
			id: "contract-measurement-1",
			status: "ACEITO",
			number: 1,
			title: "Medição",
			statusReason: null,
			items: [],
		});

		await setContractMeasurementStatus({
			ownerId: "owner-1",
			contractId: "contract-1",
			measurementId: "contract-measurement-1",
			status: "RECUSADO",
			reason: "Revisão necessária",
			role: "ADMIN",
			actorId: "user-1",
			assertWritable,
			getMeasurement,
		});

		expect(reverseContractMeasurementAcceptance).toHaveBeenCalledTimes(1);
		expect(deactivateContractMeasurement).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"contract-measurement-1",
			{ userId: "user-1" },
			expect.anything(),
		);
		expect(discardPendingContractMeasurement).not.toHaveBeenCalled();
	});
});
