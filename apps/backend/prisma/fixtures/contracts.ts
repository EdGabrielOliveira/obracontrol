import type { ContractProfile, ContractServiceDef } from "./types";
import { money } from "./types";

export function serviceTotal(service: ContractServiceDef) {
	if (service.quantity === null || service.unitCost === null) return 0;
	return money(service.quantity * service.unitCost);
}

export function contractValue(profile: ContractProfile) {
	return money(
		profile.services.reduce((sum, service) => sum + serviceTotal(service), 0),
	);
}

function civilContract(
	workCode: string,
	supplierName: string,
	progressFactor = 1,
): ContractProfile {
	return {
		code: `${workCode}-CIV-001`,
		supplierName,
		serviceType: "Mao de obra e estrutura",
		title: "Infraestrutura e estrutura de concreto",
		status: progressFactor >= 1.6 ? "FINALIZADO" : "EM_ANDAMENTO",
		startDate: "03-01",
		endDate: "10-31",
		notes: "Contrato demo gerado por seed deterministico.",
		services: [
			{
				idx: "S1",
				parent: null,
				type: "STAGE",
				description: "Infraestrutura e estrutura",
				unit: null,
				quantity: null,
				unitCost: null,
				budgetIndex: "2",
				sortOrder: 1,
			},
			{
				idx: "S1.1",
				parent: "S1",
				type: "ITEM",
				description: "Fundacoes profundas",
				unit: "m",
				quantity: money(380 * progressFactor),
				unitCost: 315,
				budgetIndex: "2.2",
				sortOrder: 2,
			},
			{
				idx: "S1.2",
				parent: "S1",
				type: "ITEM",
				description: "Concreto armado",
				unit: "m3",
				quantity: money(240 * progressFactor),
				unitCost: 790,
				budgetIndex: "3.1",
				sortOrder: 3,
			},
		],
		measurements: [
			{
				number: 1,
				date: "05-31",
				title: "Medicao estrutura 01",
				progressByServiceIdx: { "S1.1": 35, "S1.2": 12 },
				retentionValue: money(2500 * progressFactor),
				notes: "Avanco inicial aprovado.",
			},
			{
				number: 2,
				date: "06-30",
				title: "Medicao estrutura 02",
				progressByServiceIdx: { "S1.1": 58, "S1.2": 28 },
				retentionValue: money(3500 * progressFactor),
				discountValue: 800,
				notes: "Medicao em conferencia pela fiscalizacao.",
			},
		],
		payments: [
			{
				date: "06-10",
				measurementNumber: 1,
				value: money(78_000 * progressFactor),
				retentionValue: money(2500 * progressFactor),
				discountValue: 0,
				paidValue: money(75_500 * progressFactor),
				description: "Pagamento medicao 01",
				status: "PAGO",
			},
			{
				date: "07-15",
				measurementNumber: 2,
				value: money(64_000 * progressFactor),
				retentionValue: money(3500 * progressFactor),
				discountValue: 800,
				paidValue: progressFactor >= 1.5 ? money(59_700 * progressFactor) : 0,
				description: "Pagamento medicao 02",
				status: progressFactor >= 1.5 ? "PAGO" : "EM_ABERTO",
			},
		],
		folders: [
			{
				name: "Contrato e aditivos",
				files: [
					{
						name: `${workCode}-contrato-civil.pdf`,
						url: `https://demo.obracontrol.local/files/${workCode}/contrato-civil.pdf`,
						size: 842_000,
						mimeType: "application/pdf",
					},
				],
			},
		],
	};
}

function installationsContract(workCode: string): ContractProfile {
	return {
		code: `${workCode}-INST-001`,
		supplierName: "Eletrica Central Instalacoes",
		serviceType: "Instalacoes",
		title: "Instalacoes eletricas e hidraulicas",
		status: "EM_ANDAMENTO",
		startDate: "06-01",
		endDate: "12-15",
		services: [
			{
				idx: "S2",
				parent: null,
				type: "STAGE",
				description: "Instalacoes prediais",
				unit: null,
				quantity: null,
				unitCost: null,
				budgetIndex: "5",
				sortOrder: 1,
			},
			{
				idx: "S2.1",
				parent: "S2",
				type: "ITEM",
				description: "Instalacoes eletricas",
				unit: "pt",
				quantity: 1,
				unitCost: 245_000,
				budgetIndex: "5.1",
				sortOrder: 2,
			},
			{
				idx: "S2.2",
				parent: "S2",
				type: "ITEM",
				description: "Instalacoes hidraulicas",
				unit: "pt",
				quantity: 1,
				unitCost: 163_000,
				budgetIndex: "5.2",
				sortOrder: 3,
			},
		],
		measurements: [
			{
				number: 1,
				date: "07-31",
				title: "Medicao instalacoes 01",
				progressByServiceIdx: { "S2.1": 18, "S2.2": 10 },
				notes: "Medicao em elaboracao.",
			},
		],
		payments: [
			{
				date: "08-20",
				measurementNumber: null,
				value: 45_000,
				retentionValue: 0,
				discountValue: 0,
				paidValue: 0,
				description: "Adiantamento contratual previsto",
				status: "EM_ABERTO",
			},
		],
		folders: [
			{
				name: "Projetos",
				files: [
					{
						name: `${workCode}-diagramas-instalacoes.pdf`,
						url: `https://demo.obracontrol.local/files/${workCode}/diagramas-instalacoes.pdf`,
						size: 1_260_000,
						mimeType: "application/pdf",
					},
				],
			},
		],
	};
}

const SCENARIO_CODES = new Set([
	"OB-005-25",
	"OB-013-25",
	"OB-023-25",
	"OB-030-25",
	"OB-002-25",
	"OB-012-25",
	"OB-020-25",
	"OB-033-25",
	"OB-008-25",
	"OB-018-25",
	"OB-027-25",
	"OB-034-25",
]);

export function buildContractsForWork(workCode: string): ContractProfile[] {
	const codeNum = Number(workCode.slice(3, 6));
	const progressFactor = codeNum <= 6 || codeNum >= 31 ? 1.2 : 1.0;

	const civilSupplier =
		workCode.endsWith("2") || workCode.endsWith("5") || workCode.endsWith("8")
			? "Construtora Omega Ltda"
			: "Empreiteira Nova Era";

	const contracts = [civilContract(workCode, civilSupplier, progressFactor)];

	const hasInstallations = !SCENARIO_CODES.has(workCode) && codeNum % 3 !== 0;
	if (hasInstallations) {
		contracts.push(installationsContract(workCode));
	}

	return contracts;
}
