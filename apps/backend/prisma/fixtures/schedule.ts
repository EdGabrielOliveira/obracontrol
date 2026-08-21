import type { BaseDef, RevDef } from "./types";

export const CRONOGRAMA_PADRAO: BaseDef[] = [
	{ idx: "1.1", start: "02-01", end: "02-28", weight: 0.06 },
	{ idx: "1.2", start: "02-01", end: "02-21", weight: 0.02 },
	{ idx: "2.1", start: "03-01", end: "04-15", weight: 0.07 },
	{ idx: "2.2", start: "04-01", end: "05-31", weight: 0.14 },
	{ idx: "2.3", start: "05-15", end: "06-30", weight: 0.06 },
	{ idx: "3.1", start: "06-01", end: "08-15", weight: 0.12 },
	{ idx: "3.2", start: "07-01", end: "09-30", weight: 0.14 },
	{ idx: "3.3", start: "09-01", end: "10-15", weight: 0.09 },
	{ idx: "4.1", start: "09-15", end: "11-15", weight: 0.08 },
	{ idx: "4.2", start: "10-01", end: "11-30", weight: 0.04 },
	{ idx: "5.1", start: "10-01", end: "12-15", weight: 0.08 },
	{ idx: "5.2", start: "10-15", end: "12-15", weight: 0.05 },
	{ idx: "5.3", start: "11-01", end: "12-20", weight: 0.05 },
	{ idx: "6.1", start: "11-01", end: "12-31", weight: 0.0 },
	{ idx: "6.2", start: "11-15", end: "12-31", weight: 0.0 },
	{ idx: "6.3", start: "11-15", end: "12-31", weight: 0.0 },
	{ idx: "6.4", start: "12-01", end: "12-31", weight: 0.0 },
	{ idx: "7.1", start: "12-01", end: "12-31", weight: 0.0 },
	{ idx: "7.2", start: "12-01", end: "12-31", weight: 0.0 },
];

export const REPLANEJAMENTO_PADRAO: RevDef[] = [
	{
		idx: "2.2",
		ver: "R1",
		start: "04-15",
		end: "06-10",
		revDate: "04-10",
		reason: "Ajuste de metodo executivo de estacas apos sondagem complementar",
	},
	{
		idx: "3.2",
		ver: "R1",
		start: "07-15",
		end: "10-05",
		revDate: "07-10",
		reason: "Revisao apos atraso na entrega de formas pela concreteira",
	},
];
