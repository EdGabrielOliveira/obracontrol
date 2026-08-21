import { createHash } from "node:crypto";

export function dt(s: string) {
	const full = /^\d{4}-/.test(s) ? s : `2026-${s}`;
	return new Date(`${full}T00:00:00.000Z`);
}

export type ItemDef = {
	idx: string;
	parent: string | null;
	desc: string;
	unit: string;
	qty: number;
	labor: number;
	material: number;
	equip: number;
	other: number;
	status: string | null;
	computed: string;
	order: number;
};

export type BaseDef = {
	idx: string;
	start: string;
	end: string;
	weight: number;
};

export type RevDef = {
	idx: string;
	ver: string;
	start: string;
	end: string;
	revDate: string;
	reason: string;
};

export type MedDef = {
	idx: string;
	date: string;
	pct: number;
	qty: number | null;
	note: string;
};

export type CostDef = {
	date: string;
	idx: string | null;
	cat: string;
	desc: string;
	amt: number;
	type: "CURRENT" | "FUTURE";
	doc: string;
	supplier: string | null;
	group: string | null;
	pay: "PAID" | "OPEN";
};

export type WorkDef = {
	code: string;
	name: string;
	client: string;
	baseDate: string;
	start: string;
	end: string;
	area: number | null;
	statusOp: string | null;
	resp: string | null;
	items: ItemDef[];
	baselines: BaseDef[];
	revisions: RevDef[];
	meds: MedDef[];
	costs: CostDef[];
	workMeasurements?: WorkMeasurementProfile[];
};

export const ADMIN = {
	id: "seed-admin-user",
	email: "admin@admin.com",
	name: "Admin",
};

export const IMPORTED_SECTIONS = [
	"Obra",
	"Orcamento",
	"Cronograma Original",
	"Replanejamento",
	"Medicoes",
	"Custos Realizados",
];

export function money(value: number) {
	return Math.round(value * 10_000) / 10_000;
}

export function pct(value: number) {
	return Math.round(value * 100) / 100;
}

export function hashDemoApiKey(fullKey: string) {
	return createHash("sha256").update(fullKey).digest("hex");
}

export type SeedUserDef = {
	id: string;
	email: string;
	name: string;
	password: string;
	role?: string;
};

export type OrganizationDef = {
	key: string;
	name: string;
	ownerId: string;
};

export type CostCenterDef = {
	key: string;
	organizationKey: string;
	name: string;
	ownerId: string;
};

export type ApiKeyDef = {
	id: string;
	ownerId: string;
	userId: string;
	name: string;
	fullKey: string;
	expiresAt: string | null;
	revokedAt: string | null;
	lastUsedAt: string | null;
};

export type WorkMeasurementProfile = {
	number: number;
	date: string;
	title: string;
	progressByIndex: Record<string, number>;
	discountValue?: number;
	retentionValue?: number;
	notes?: string;
};

export type ContractServiceDef = {
	idx: string;
	parent: string | null;
	type: "STAGE" | "ITEM";
	description: string;
	unit: string | null;
	quantity: number | null;
	unitCost: number | null;
	budgetIndex: string | null;
	sortOrder: number;
};

export type ContractMeasurementDef = {
	number: number;
	date: string;
	title: string;
	progressByServiceIdx: Record<string, number>;
	discountValue?: number;
	retentionValue?: number;
	notes?: string;
};

export type ContractPaymentDef = {
	date: string;
	measurementNumber: number | null;
	value: number;
	discountValue?: number;
	retentionValue?: number;
	paidValue: number;
	description: string;
	status: string;
};

export type ContractFolderDef = {
	name: string;
	files: Array<{
		name: string;
		url: string;
		size: number;
		mimeType: string;
	}>;
};

export type ContractProfile = {
	code: string;
	supplierName: string;
	serviceType: string;
	title: string;
	status: string;
	startDate: string;
	endDate: string;
	notes?: string;
	services: ContractServiceDef[];
	measurements: ContractMeasurementDef[];
	payments: ContractPaymentDef[];
	folders: ContractFolderDef[];
};
