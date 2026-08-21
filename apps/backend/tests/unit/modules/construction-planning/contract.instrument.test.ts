import { beforeEach, describe, expect, it, mock } from "bun:test";

const workFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const contractFindFirst = mock(async () => null);
const contractUpdate = mock(async () => ({
	id: "contract-1",
	instrumentGeneratedAt: new Date(),
	instrumentGeneratedBy: "user-1",
	instrumentTemplateVersion: "modelo.pdf@PDF",
}));
const generateArtifact = mock(async () => ({
	id: "artifact-1",
	contractId: "contract-1",
	version: 1,
	filename: "instrumento-CT-001.pdf",
	mimeType: "application/pdf",
	sha256: "hash",
	templateSha256: "template-hash",
	catalogVersion: "1",
	generationDate: new Date().toISOString(),
	generatedBy: "user-1",
}));

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		constructionWork: { findFirst: workFindFirst },
		contract: {
			findFirst: contractFindFirst,
			update: contractUpdate,
		},
	},
}));

mock.module("../../../../src/modules/audit/audit.service", () => ({
	auditService: { log: mock(async () => undefined) },
}));

mock.module("../../../../src/modules/construction-planning/repository", () => ({
	getWorkOrThrow: mock(async () => ({ id: "work-1" })),
}));

mock.module(
	"../../../../src/modules/construction-planning/contract.repository",
	() => ({
		getContractById: mock(async () => ({
			id: "contract-1",
			code: "CT-001",
			contractValue: 10000,
			penaltyPercent: 20,
		})),
	}),
);

mock.module(
	"../../../../src/modules/construction-planning/instrument/artifact.service",
	() => ({
		generateContractInstrumentArtifact: generateArtifact,
	}),
);

const { ContractService } = await import(
	"../../../../src/modules/construction-planning/contract.service"
);

describe("REL-004 (DEC-001/012) instrumento contratual", () => {
	beforeEach(() => {
		workFindFirst.mockClear();
		contractFindFirst.mockClear();
		contractUpdate.mockClear();
		workFindFirst.mockResolvedValue(null);
	});

	it("delega a geração para o serviço versionado de artefatos", async () => {
		const service = new ContractService({
			assertWritable: mock(async () => undefined),
		} as never);
		const result = await service.generateInstrument(
			"owner-1",
			"work-1",
			"contract-1",
			{ userId: "user-1" },
		);

		expect(generateArtifact).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"contract-1",
			{ userId: "user-1" },
		);
		expect(result.mimeType).toBe("application/pdf");
	});
});
