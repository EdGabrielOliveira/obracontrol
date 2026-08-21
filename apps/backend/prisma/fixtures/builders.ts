import { gerarMedicoes, ORCAMENTO_PADRAO } from "./budget";
import { CRONOGRAMA_PADRAO, REPLANEJAMENTO_PADRAO } from "./schedule";
import {
	type BaseDef,
	type CostDef,
	type MedDef,
	money,
	type RevDef,
	type WorkDef,
	type WorkMeasurementProfile,
} from "./types";

type WorkScenario =
	| "CONCLUIDA"
	| "ADIANTADA"
	| "NORMAL"
	| "ATRASO_LEVE"
	| "ATRASADA"
	| "MUITO_ATRASADA"
	| "CRITICA_FINANCEIRA"
	| "RECEM_INICIADA";

function wrapMonth(m: number): number {
	return ((m - 1 + 120) % 12) + 1;
}

function shiftSchedule(schedule: BaseDef[], offsetMonths: number): BaseDef[] {
	if (offsetMonths === 0) return schedule;
	return schedule.map((b) => {
		const sMonths = wrapMonth(Number(b.start.split("-")[0]) + offsetMonths);
		const eMonths = wrapMonth(Number(b.end.split("-")[0]) + offsetMonths);
		return {
			...b,
			start: `${String(sMonths).padStart(2, "0")}-${b.start.split("-")[1]}`,
			end: `${String(eMonths).padStart(2, "0")}-${b.end.split("-")[1]}`,
		};
	});
}

const SCENARIO_CONFIG: Record<
	WorkScenario,
	{
		progressMonths: Record<string, number>;
		statusOp: string;
		hasReplanning: boolean;
		costOverrunFactor: number;
		suspendedItems: boolean;
		defaultStart: string;
		defaultEnd: string;
		defaultBase: string;
	}
> = {
	CONCLUIDA: {
		progressMonths: {
			"01-31": 0.15,
			"02-28": 0.35,
			"03-31": 0.55,
			"04-30": 0.78,
			"05-31": 0.95,
			"06-30": 1.0,
		},
		statusOp: "CONCLUIDA",
		hasReplanning: false,
		costOverrunFactor: 0.95,
		suspendedItems: false,
		defaultStart: "01-15",
		defaultEnd: "07-15",
		defaultBase: "01-15",
	},
	ADIANTADA: {
		progressMonths: {
			"03-31": 0.12,
			"04-30": 0.3,
			"05-31": 0.5,
			"06-30": 0.68,
			"07-31": 0.82,
		},
		statusOp: "EM_ANDAMENTO",
		hasReplanning: false,
		costOverrunFactor: 0.95,
		suspendedItems: false,
		defaultStart: "02-01",
		defaultEnd: "10-31",
		defaultBase: "03-01",
	},
	NORMAL: {
		progressMonths: {
			"03-31": 0.03,
			"04-30": 0.1,
			"05-31": 0.22,
			"06-30": 0.35,
			"07-31": 0.48,
			"08-31": 0.58,
		},
		statusOp: "EM_ANDAMENTO",
		hasReplanning: true,
		costOverrunFactor: 1.0,
		suspendedItems: false,
		defaultStart: "02-01",
		defaultEnd: "12-31",
		defaultBase: "05-01",
	},
	ATRASO_LEVE: {
		progressMonths: {
			"04-30": 0.02,
			"05-31": 0.08,
			"06-30": 0.18,
			"07-31": 0.28,
			"08-31": 0.38,
		},
		statusOp: "EM_ANDAMENTO",
		hasReplanning: true,
		costOverrunFactor: 1.08,
		suspendedItems: false,
		defaultStart: "03-01",
		defaultEnd: "01-31",
		defaultBase: "06-01",
	},
	ATRASADA: {
		progressMonths: {
			"05-31": 0.02,
			"06-30": 0.07,
			"07-31": 0.14,
			"08-31": 0.2,
		},
		statusOp: "EM_ANDAMENTO",
		hasReplanning: true,
		costOverrunFactor: 1.15,
		suspendedItems: false,
		defaultStart: "02-15",
		defaultEnd: "12-31",
		defaultBase: "07-01",
	},
	MUITO_ATRASADA: {
		progressMonths: {
			"06-30": 0.02,
			"07-31": 0.05,
			"08-31": 0.1,
		},
		statusOp: "EM_ANDAMENTO",
		hasReplanning: true,
		costOverrunFactor: 1.25,
		suspendedItems: true,
		defaultStart: "02-01",
		defaultEnd: "02-28",
		defaultBase: "08-01",
	},
	CRITICA_FINANCEIRA: {
		progressMonths: {
			"04-30": 0.04,
			"05-31": 0.14,
			"06-30": 0.28,
			"07-31": 0.42,
			"08-31": 0.55,
		},
		statusOp: "EM_ANDAMENTO",
		hasReplanning: false,
		costOverrunFactor: 1.4,
		suspendedItems: false,
		defaultStart: "03-01",
		defaultEnd: "01-31",
		defaultBase: "06-01",
	},
	RECEM_INICIADA: {
		progressMonths: {
			"07-31": 0.03,
			"08-31": 0.1,
		},
		statusOp: "EM_ANDAMENTO",
		hasReplanning: false,
		costOverrunFactor: 1.0,
		suspendedItems: false,
		defaultStart: "06-01",
		defaultEnd: "04-30",
		defaultBase: "08-01",
	},
};

type CostTemplate = {
	idx: string | null;
	cat: "MATERIAL" | "EQUIPMENT" | "LABOR" | "OTHER";
	desc: string;
	baseAmt: number;
	supplier: string;
	group: string | null;
	payDelay: number;
};

const COST_POOL: Record<string, CostTemplate[]> = {
	"1": [
		{
			idx: "1.1",
			cat: "MATERIAL",
			desc: "Container e tapumes",
			baseAmt: 45000,
			supplier: "Materiais de Construcao Santa Rita",
			group: "Materiais",
			payDelay: 0,
		},
		{
			idx: "1.1",
			cat: "LABOR",
			desc: "Mobilizacao de equipe",
			baseAmt: 18000,
			supplier: "Empreiteira Nova Era",
			group: "Mao de obra",
			payDelay: 0,
		},
		{
			idx: "1.2",
			cat: "MATERIAL",
			desc: "Ligacao provisoria de energia",
			baseAmt: 8000,
			supplier: "Eletrica Central Instalacoes",
			group: "Materiais",
			payDelay: 0,
		},
		{
			idx: "1.2",
			cat: "OTHER",
			desc: "Taxas de ligacao (agua/luz)",
			baseAmt: 3500,
			supplier: "Diversos / Rateio",
			group: null,
			payDelay: 0,
		},
	],
	"2": [
		{
			idx: "2.1",
			cat: "EQUIPMENT",
			desc: "Locacao de escavadeira hidraulica",
			baseAmt: 52000,
			supplier: "Locadora EquipMaster",
			group: "Equipamentos",
			payDelay: 0,
		},
		{
			idx: "2.1",
			cat: "LABOR",
			desc: "Equipe de escavacao - mes",
			baseAmt: 25000,
			supplier: "Empreiteira Nova Era",
			group: "Mao de obra",
			payDelay: 0,
		},
		{
			idx: "2.2",
			cat: "MATERIAL",
			desc: "Aco CA-50 para estacas",
			baseAmt: 78000,
			supplier: "Ferragens e Aco Nacional",
			group: "Materiais",
			payDelay: 0,
		},
		{
			idx: "2.2",
			cat: "EQUIPMENT",
			desc: "Locacao de bate-estacas e guindaste",
			baseAmt: 65000,
			supplier: "Locadora EquipMaster",
			group: "Equipamentos",
			payDelay: 0,
		},
		{
			idx: "2.3",
			cat: "MATERIAL",
			desc: "Concreto usinado FCK 30MPa",
			baseAmt: 52000,
			supplier: "Concreteira Supermix",
			group: "Materiais",
			payDelay: 0,
		},
		{
			idx: "2.3",
			cat: "LABOR",
			desc: "Mao de obra fundacoes - mes",
			baseAmt: 38000,
			supplier: "Empreiteira Nova Era",
			group: "Mao de obra",
			payDelay: 0,
		},
	],
	"3": [
		{
			idx: "3.1",
			cat: "MATERIAL",
			desc: "Formas e escoramentos metalicos",
			baseAmt: 28000,
			supplier: "Materiais de Construcao Santa Rita",
			group: "Materiais",
			payDelay: 1,
		},
		{
			idx: "3.1",
			cat: "MATERIAL",
			desc: "Concreto armado - pilares",
			baseAmt: 68000,
			supplier: "Concreteira Supermix",
			group: "Materiais",
			payDelay: 1,
		},
		{
			idx: "3.1",
			cat: "LABOR",
			desc: "Mao de obra estrutura - mes",
			baseAmt: 42000,
			supplier: "Empreiteira Nova Era",
			group: "Mao de obra",
			payDelay: 1,
		},
		{
			idx: "3.2",
			cat: "MATERIAL",
			desc: "Concreto armado - vigas e lajes",
			baseAmt: 95000,
			supplier: "Concreteira Supermix",
			group: "Materiais",
			payDelay: 1,
		},
		{
			idx: "3.2",
			cat: "LABOR",
			desc: "Equipe de vigas e lajes - mes",
			baseAmt: 48000,
			supplier: "Construtora Omega Ltda",
			group: "Mao de obra",
			payDelay: 1,
		},
		{
			idx: "3.3",
			cat: "MATERIAL",
			desc: "Estrutura metalica - cobertura",
			baseAmt: 35000,
			supplier: "Ferragens e Aco Nacional",
			group: "Materiais",
			payDelay: 2,
		},
		{
			idx: "3.3",
			cat: "LABOR",
			desc: "Montagem de estrutura metalica",
			baseAmt: 22000,
			supplier: "Construtora Omega Ltda",
			group: "Mao de obra",
			payDelay: 2,
		},
		{
			idx: "3.3",
			cat: "EQUIPMENT",
			desc: "Guindaste para montagem",
			baseAmt: 18000,
			supplier: "Locadora EquipMaster",
			group: "Equipamentos",
			payDelay: 2,
		},
	],
	"4": [
		{
			idx: "4.1",
			cat: "MATERIAL",
			desc: "Blocos ceramicos e argamassa",
			baseAmt: 38000,
			supplier: "Materiais de Construcao Santa Rita",
			group: "Materiais",
			payDelay: 2,
		},
		{
			idx: "4.1",
			cat: "LABOR",
			desc: "Equipe de alvenaria - mes",
			baseAmt: 32000,
			supplier: "Empreiteira Nova Era",
			group: "Mao de obra",
			payDelay: 2,
		},
		{
			idx: "4.2",
			cat: "MATERIAL",
			desc: "Drywall e perfis metalicos",
			baseAmt: 22000,
			supplier: "Materiais de Construcao Santa Rita",
			group: "Materiais",
			payDelay: 2,
		},
		{
			idx: "4.2",
			cat: "LABOR",
			desc: "Equipe de drywall - mes",
			baseAmt: 15000,
			supplier: "Construtora Omega Ltda",
			group: "Mao de obra",
			payDelay: 2,
		},
	],
	"5": [
		{
			idx: "5.1",
			cat: "MATERIAL",
			desc: "Cabos e disjuntores (instalacao eletrica)",
			baseAmt: 65000,
			supplier: "Eletrica Central Instalacoes",
			group: "Materiais",
			payDelay: 2,
		},
		{
			idx: "5.1",
			cat: "LABOR",
			desc: "Equipe eletrica - mes",
			baseAmt: 28000,
			supplier: "Eletrica Central Instalacoes",
			group: "Mao de obra",
			payDelay: 2,
		},
		{
			idx: "5.2",
			cat: "MATERIAL",
			desc: "Tubos PPR e conexoes",
			baseAmt: 35000,
			supplier: "Hidraulica Sul Servicos",
			group: "Materiais",
			payDelay: 2,
		},
		{
			idx: "5.2",
			cat: "LABOR",
			desc: "Equipe hidraulica - mes",
			baseAmt: 22000,
			supplier: "Hidraulica Sul Servicos",
			group: "Mao de obra",
			payDelay: 2,
		},
		{
			idx: "5.3",
			cat: "MATERIAL",
			desc: "Sistema de climatizacao (HVAC)",
			baseAmt: 85000,
			supplier: "Eletrica Central Instalacoes",
			group: "Materiais",
			payDelay: 3,
		},
		{
			idx: "5.3",
			cat: "LABOR",
			desc: "Instalacao de HVAC - mes",
			baseAmt: 35000,
			supplier: "Construtora Omega Ltda",
			group: "Mao de obra",
			payDelay: 3,
		},
	],
	"6": [
		{
			idx: "6.1",
			cat: "MATERIAL",
			desc: "Revestimentos ceramicos",
			baseAmt: 42000,
			supplier: "Materiais de Construcao Santa Rita",
			group: "Materiais",
			payDelay: 3,
		},
		{
			idx: "6.1",
			cat: "LABOR",
			desc: "Equipe de revestimento - mes",
			baseAmt: 25000,
			supplier: "Empreiteira Nova Era",
			group: "Mao de obra",
			payDelay: 3,
		},
		{
			idx: "6.2",
			cat: "MATERIAL",
			desc: "Tinta acrilica e materiais de pintura",
			baseAmt: 18000,
			supplier: "Materiais de Construcao Santa Rita",
			group: "Materiais",
			payDelay: 3,
		},
		{
			idx: "6.2",
			cat: "LABOR",
			desc: "Equipe de pintura - mes",
			baseAmt: 22000,
			supplier: "Empreiteira Nova Era",
			group: "Mao de obra",
			payDelay: 3,
		},
		{
			idx: "6.3",
			cat: "MATERIAL",
			desc: "Esquadrias de aluminio e vidro",
			baseAmt: 52000,
			supplier: "Ferragens e Aco Nacional",
			group: "Materiais",
			payDelay: 3,
		},
		{
			idx: "6.4",
			cat: "MATERIAL",
			desc: "Forro de gesso acartonado",
			baseAmt: 15000,
			supplier: "Materiais de Construcao Santa Rita",
			group: "Materiais",
			payDelay: 3,
		},
		{
			idx: "6.4",
			cat: "LABOR",
			desc: "Equipe de forro - mes",
			baseAmt: 12000,
			supplier: "Construtora Omega Ltda",
			group: "Mao de obra",
			payDelay: 3,
		},
	],
	"7": [
		{
			idx: "7.1",
			cat: "MATERIAL",
			desc: "Piso intertravado e meio-fio",
			baseAmt: 28000,
			supplier: "Materiais de Construcao Santa Rita",
			group: "Materiais",
			payDelay: 3,
		},
		{
			idx: "7.1",
			cat: "EQUIPMENT",
			desc: "Compactacao mecanica e nivelamento",
			baseAmt: 12000,
			supplier: "Locadora EquipMaster",
			group: "Equipamentos",
			payDelay: 3,
		},
		{
			idx: "7.2",
			cat: "MATERIAL",
			desc: "Gramas e mudas para paisagismo",
			baseAmt: 8000,
			supplier: "Diversos / Rateio",
			group: null,
			payDelay: 3,
		},
		{
			idx: "7.2",
			cat: "LABOR",
			desc: "Equipe de paisagismo - mes",
			baseAmt: 10000,
			supplier: "Construtora Omega Ltda",
			group: "Mao de obra",
			payDelay: 3,
		},
	],
};

function getActiveStages(progressMonths: Record<string, number>): string[] {
	const maxProgress = Math.max(...Object.values(progressMonths));
	if (maxProgress >= 0.95) return ["1", "2", "3", "4", "5", "6", "7"];
	if (maxProgress >= 0.6) return ["1", "2", "3", "4", "5"];
	if (maxProgress >= 0.4) return ["1", "2", "3", "4"];
	if (maxProgress >= 0.2) return ["1", "2", "3"];
	if (maxProgress >= 0.05) return ["1", "2"];
	return ["1"];
}

function pick<T>(arr: T[], index: number): T {
	return arr[index % arr.length];
}

function generateCosts(
	scenario: WorkScenario,
	budgetScale: number,
	startDate: string,
	costOverrunFactor: number,
	hasSuspended: boolean,
): CostDef[] {
	const config = SCENARIO_CONFIG[scenario];
	const activeStages = getActiveStages(config.progressMonths);
	const startMonth = Number(startDate.split("-")[0]);

	const costs: CostDef[] = [];
	let docCounter = 100;

	const paymentStatuses = (payDelay: number): "PAID" | "OPEN" => {
		const referenceMonth = 8;
		return startMonth + payDelay < referenceMonth - 1 ? "PAID" : "OPEN";
	};

	for (const stage of activeStages) {
		const templates = COST_POOL[stage] ?? [];
		for (
			let i = 0;
			i < Math.min(templates.length, 3 + (activeStages.indexOf(stage) % 2));
			i++
		) {
			const tpl = templates[i];
			const payStatus = paymentStatuses(tpl.payDelay);
			const monthsSinceStart = Math.max(
				1,
				activeStages.indexOf(stage) * 2 + i + 1,
			);
			const costMonth = Math.min(12, startMonth + monthsSinceStart);
			const costDate = `${String(costMonth).padStart(2, "0")}-${String(10 + (i % 20)).padStart(2, "0")}`;
			const scaledAmt = money(
				tpl.baseAmt *
					budgetScale *
					(payStatus === "PAID" ? 1 : costOverrunFactor),
			);

			docCounter++;
			costs.push({
				date: costDate,
				idx: tpl.idx,
				cat: tpl.cat,
				desc: tpl.desc,
				amt: scaledAmt,
				type: payStatus === "PAID" ? "CURRENT" : "CURRENT",
				doc: `NF-${String(docCounter).padStart(6, "0")}`,
				supplier: tpl.supplier,
				group: tpl.group,
				pay: payStatus,
			});
		}
	}

	if (hasSuspended) {
		costs.push({
			date: "08-01",
			idx: "4.1",
			cat: "MATERIAL",
			desc: "Materiais paralisados (decisao de suspensao)",
			amt: money(15000 * budgetScale),
			type: "CURRENT",
			doc: "NF-SUSP-001",
			supplier: "Diversos / Rateio",
			group: null,
			pay: "OPEN",
		});
	}

	if (scenario === "MUITO_ATRASADA" || scenario === "CRITICA_FINANCEIRA") {
		costs.push({
			date: "08-15",
			idx: null,
			cat: "OTHER",
			desc: "Juros e multas por atraso contratual",
			amt: money(8000 * budgetScale * costOverrunFactor),
			type: "CURRENT",
			doc: "NF-JUR-001",
			supplier: "Diversos / Rateio",
			group: null,
			pay: "OPEN",
		});
	}

	return costs;
}

function generateWorkMeasurements(
	scenario: WorkScenario,
): WorkMeasurementProfile[] {
	const config = SCENARIO_CONFIG[scenario];
	const months = Object.entries(config.progressMonths).sort(([a], [b]) =>
		a.localeCompare(b),
	);

	const profiles: WorkMeasurementProfile[] = [];
	let measurementNumber = 1;

	for (const [date, overallProgress] of months) {
		const monthName = new Date(`2026-${date}T00:00:00.000Z`).toLocaleDateString(
			"pt-BR",
			{ month: "long" },
		);

		const progressByIndex: Record<string, number> = {};

		for (const item of ORCAMENTO_PADRAO.filter((i) => i.parent !== null)) {
			const stageNum = Number(item.idx.split(".")[0]);
			let itemRatio: number;
			if (stageNum <= 1) itemRatio = Math.min(1, overallProgress + 0.25);
			else if (stageNum === 2) itemRatio = Math.max(0, overallProgress - 0.05);
			else if (stageNum === 3) itemRatio = Math.max(0, overallProgress - 0.2);
			else if (stageNum === 4) itemRatio = Math.max(0, overallProgress - 0.4);
			else if (stageNum === 5) itemRatio = Math.max(0, overallProgress - 0.5);
			else if (stageNum >= 6) itemRatio = Math.max(0, overallProgress - 0.65);
			else itemRatio = overallProgress;

			if (itemRatio > 0) {
				progressByIndex[item.idx] = Math.round(itemRatio * 10000) / 100;
			}
		}

		profiles.push({
			number: measurementNumber,
			date,
			title: `Medicao ${measurementNumber} - ${monthName}/2026`,
			progressByIndex,
			notes: `Medicao referente a ${monthName}/2026.`,
		});

		measurementNumber++;
	}

	return profiles;
}

type WorkProfile = {
	code: string;
	name: string;
	client: string;
	scenario: WorkScenario;
	budgetScale: number;
	startDate?: string;
	endDate?: string;
	baseDate?: string;
	area?: number | null;
	resp?: string;
};

const ENGINEERS = [
	"Eng. Ricardo Nunes",
	"Enga. Camila Andrade",
	"Eng. Claudio Mello",
	"Enga. Patricia Lopes",
	"Eng. Fernando Santos",
	"Eng. Mariana Costa",
];

export function buildWork(profile: WorkProfile): WorkDef {
	const config = SCENARIO_CONFIG[profile.scenario];
	const start = profile.startDate ?? config.defaultStart;
	const end = profile.endDate ?? config.defaultEnd;
	const baseDate = profile.baseDate ?? config.defaultBase;
	const area =
		profile.area ??
		(profile.budgetScale > 1.5
			? Math.round(5000 * profile.budgetScale)
			: profile.budgetScale < 0.7
				? Math.round(1500 * profile.budgetScale * 2)
				: null);
	const resp =
		profile.resp ?? pick(ENGINEERS, Number(profile.code.slice(3, 6)));

	const budgetItems = ORCAMENTO_PADRAO.map((item) => ({
		...item,
		labor: Math.round(item.labor * profile.budgetScale),
		material: Math.round(item.material * profile.budgetScale),
		equip: Math.round(item.equip * profile.budgetScale),
		other: Math.round(item.other * profile.budgetScale),
	}));

	const baselines: BaseDef[] = shiftSchedule(
		CRONOGRAMA_PADRAO,
		Number(start.split("-")[0]) - 2,
	);

	const revisions: RevDef[] = config.hasReplanning
		? REPLANEJAMENTO_PADRAO.map((r) => ({
				...r,
				start: shiftSchedule(
					[{ idx: r.idx, start: r.start, end: r.end, weight: 0 }],
					Number(start.split("-")[0]) - 2,
				)[0].start,
				end: shiftSchedule(
					[{ idx: r.idx, start: r.start, end: r.end, weight: 0 }],
					Number(start.split("-")[0]) - 2,
				)[0].end,
				revDate: shiftSchedule(
					[{ idx: r.idx, start: r.revDate, end: r.revDate, weight: 0 }],
					Number(start.split("-")[0]) - 2,
				)[0].start,
			}))
		: [];

	const meds: MedDef[] = gerarMedicoes(config.progressMonths);

	const costs: CostDef[] = generateCosts(
		profile.scenario,
		profile.budgetScale,
		start,
		config.costOverrunFactor,
		config.suspendedItems,
	);

	const workMeasurements: WorkMeasurementProfile[] = generateWorkMeasurements(
		profile.scenario,
	);

	return {
		code: profile.code,
		name: profile.name,
		client: profile.client,
		baseDate,
		start,
		end,
		area,
		statusOp: config.statusOp,
		resp,
		items: budgetItems,
		baselines,
		revisions,
		meds,
		costs,
		workMeasurements,
	};
}
