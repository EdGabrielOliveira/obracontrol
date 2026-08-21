import {
	ADMIN,
	type ApiKeyDef,
	type CostCenterDef,
	hashDemoApiKey,
	type OrganizationDef,
	type SeedUserDef,
} from "./types";

export const SEED_USERS: SeedUserDef[] = [
	{
		...ADMIN,
		password: process.env.SEED_ADMIN_PASSWORD ?? ["qwe", "123", "qwe"].join(""),
		role: "ADMIN",
	},
];

export const ORGANIZATIONS: OrganizationDef[] = [
	{
		key: "grupo-atlas",
		name: "Grupo Atlas Engenharia",
		ownerId: ADMIN.id,
	},
	{
		key: "secretaria-infra",
		name: "Secretaria Estadual de Infraestrutura",
		ownerId: ADMIN.id,
	},
	{
		key: "construtora-nova-era",
		name: "Construtora Nova Era Ltda",
		ownerId: ADMIN.id,
	},
];

export const COST_CENTERS: CostCenterDef[] = [
	{
		key: "residencial",
		organizationKey: "grupo-atlas",
		name: "Residencial e Incorporacao",
		ownerId: ADMIN.id,
	},
	{
		key: "comercial",
		organizationKey: "grupo-atlas",
		name: "Comercial e Expansoes",
		ownerId: ADMIN.id,
	},
	{
		key: "infraestrutura",
		organizationKey: "secretaria-infra",
		name: "Infraestrutura Viaria",
		ownerId: ADMIN.id,
	},
	{
		key: "saude-educacao",
		organizationKey: "secretaria-infra",
		name: "Saude e Educacao",
		ownerId: ADMIN.id,
	},
	{
		key: "incorporacoes",
		organizationKey: "construtora-nova-era",
		name: "Incorporacoes e Loteamentos",
		ownerId: ADMIN.id,
	},
	{
		key: "industrial",
		organizationKey: "construtora-nova-era",
		name: "Obras Industriais e Corporativas",
		ownerId: ADMIN.id,
	},
];

export const WORK_ALLOCATIONS: Record<string, string> = {
	"OB-001-25": "residencial",
	"OB-002-25": "residencial",
	"OB-003-25": "residencial",
	"OB-004-25": "residencial",
	"OB-005-25": "residencial",
	"OB-006-25": "residencial",
	"OB-007-25": "comercial",
	"OB-008-25": "comercial",
	"OB-009-25": "comercial",
	"OB-010-25": "comercial",
	"OB-011-25": "comercial",
	"OB-012-25": "comercial",
	"OB-013-25": "infraestrutura",
	"OB-014-25": "infraestrutura",
	"OB-015-25": "infraestrutura",
	"OB-016-25": "infraestrutura",
	"OB-017-25": "infraestrutura",
	"OB-018-25": "infraestrutura",
	"OB-019-25": "saude-educacao",
	"OB-020-25": "saude-educacao",
	"OB-021-25": "saude-educacao",
	"OB-022-25": "saude-educacao",
	"OB-023-25": "saude-educacao",
	"OB-024-25": "saude-educacao",
	"OB-025-25": "incorporacoes",
	"OB-026-25": "incorporacoes",
	"OB-027-25": "incorporacoes",
	"OB-028-25": "incorporacoes",
	"OB-029-25": "incorporacoes",
	"OB-030-25": "incorporacoes",
	"OB-031-25": "industrial",
	"OB-032-25": "industrial",
	"OB-033-25": "industrial",
	"OB-034-25": "industrial",
	"OB-035-25": "industrial",
	"OB-036-25": "industrial",
};

const activeDemoKey = "obi_demo_portfolio_key_000000000001";
const revokedDemoKey = "obi_demo_revoked_key_0000000000001";

export const API_KEYS: ApiKeyDef[] = [
	{
		id: activeDemoKey.slice(0, 11),
		ownerId: ADMIN.id,
		userId: ADMIN.id,
		name: "Integracao BI Demo",
		fullKey: activeDemoKey,
		expiresAt: "2026-12-31",
		revokedAt: null,
		lastUsedAt: "2026-07-20",
	},
	{
		id: revokedDemoKey.slice(0, 11),
		ownerId: ADMIN.id,
		userId: ADMIN.id,
		name: "Chave revogada de homologacao",
		fullKey: revokedDemoKey,
		expiresAt: null,
		revokedAt: "2026-07-01",
		lastUsedAt: "2026-06-28",
	},
];

export function apiKeyHash(fullKey: string) {
	return hashDemoApiKey(fullKey);
}
