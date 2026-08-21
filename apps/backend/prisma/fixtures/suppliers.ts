export type SupplierDef = {
	key: string;
	name: string;
	document: string;
	contact: string;
	pixKey: string;
	pixKeyType: "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";
	bankCode: string;
	bankName: string;
	bankBranch: string;
	bankAccount: string;
	bankAccountType: "CONTA_CORRENTE" | "CONTA_POUPANCA";
	addressCity: string;
	addressState: string;
	notes: string;
};

export const SUPPLIERS: SupplierDef[] = [
	{
		key: "concreteira-supermix",
		name: "Concreteira Supermix",
		document: "12.345.678/0001-90",
		contact: "comercial@supermix.com.br",
		pixKey: "12.345.678/0001-90",
		pixKeyType: "CNPJ",
		bankCode: "341",
		bankName: "Itau Unibanco",
		bankBranch: "1234",
		bankAccount: "00012345-6",
		bankAccountType: "CONTA_CORRENTE",
		addressCity: "Sao Paulo",
		addressState: "SP",
		notes: "Fornecimento de concreto usinado e bombeamento.",
	},
	{
		key: "empreiteira-nova-era",
		name: "Empreiteira Nova Era",
		document: "23.456.789/0001-01",
		contact: "obras@novaera.com.br",
		pixKey: "23.456.789/0001-01",
		pixKeyType: "CNPJ",
		bankCode: "001",
		bankName: "Banco do Brasil",
		bankBranch: "5678",
		bankAccount: "00098765-4",
		bankAccountType: "CONTA_CORRENTE",
		addressCity: "Campinas",
		addressState: "SP",
		notes: "Empreitada de mao de obra civil.",
	},
	{
		key: "eletrica-central",
		name: "Eletrica Central Instalacoes",
		document: "34.567.890/0001-12",
		contact: "propostas@eletricacentral.com.br",
		pixKey: "34.567.890/0001-12",
		pixKeyType: "CNPJ",
		bankCode: "237",
		bankName: "Bradesco",
		bankBranch: "9012",
		bankAccount: "00054321-0",
		bankAccountType: "CONTA_CORRENTE",
		addressCity: "Sao Paulo",
		addressState: "SP",
		notes: "Instalacoes eletricas, hidraulicas e SPDA.",
	},
	{
		key: "materiais-santa-rita",
		name: "Materiais de Construcao Santa Rita",
		document: "45.678.901/0001-23",
		contact: "vendas@santarita.com.br",
		pixKey: "vendas@santarita.com.br",
		pixKeyType: "EMAIL",
		bankCode: "104",
		bankName: "Caixa Economica Federal",
		bankBranch: "3456",
		bankAccount: "00023456-7",
		bankAccountType: "CONTA_CORRENTE",
		addressCity: "Sao Jose dos Campos",
		addressState: "SP",
		notes: "Materiais de construcao e acabamento.",
	},
	{
		key: "locadora-equipmaster",
		name: "Locadora EquipMaster",
		document: "56.789.012/0001-34",
		contact: "financeiro@equipmaster.com.br",
		pixKey: "56.789.012/0001-34",
		pixKeyType: "CNPJ",
		bankCode: "033",
		bankName: "Santander",
		bankBranch: "7890",
		bankAccount: "00087654-3",
		bankAccountType: "CONTA_CORRENTE",
		addressCity: "Guarulhos",
		addressState: "SP",
		notes: "Locacao de equipamentos e maquinas.",
	},
	{
		key: "ferragens-aco-nacional",
		name: "Ferragens e Aco Nacional",
		document: "67.890.123/0001-45",
		contact: "comercial@aconacional.com.br",
		pixKey: "67.890.123/0001-45",
		pixKeyType: "CNPJ",
		bankCode: "341",
		bankName: "Itau Unibanco",
		bankBranch: "6543",
		bankAccount: "00076543-2",
		bankAccountType: "CONTA_CORRENTE",
		addressCity: "Sao Paulo",
		addressState: "SP",
		notes: "Ferragens, aco e formas.",
	},
	{
		key: "construtora-omega",
		name: "Construtora Omega Ltda",
		document: "78.901.234/0001-56",
		contact: "contato@construtoraomega.com.br",
		pixKey: "78.901.234/0001-56",
		pixKeyType: "CNPJ",
		bankCode: "001",
		bankName: "Banco do Brasil",
		bankBranch: "2109",
		bankAccount: "00065432-1",
		bankAccountType: "CONTA_CORRENTE",
		addressCity: "Sao Paulo",
		addressState: "SP",
		notes: "Obras civis e superestrutura.",
	},
];

export const SUPPLIER_BY_NAME: Record<string, SupplierDef> = Object.fromEntries(
	SUPPLIERS.map((supplier) => [supplier.name, supplier]),
);
