import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { strToU8, zipSync } from "fflate";
import { Prisma } from "../generated/prisma/client";
import { createLocalPrisma } from "../src/lib/prisma-local";

const prisma = createLocalPrisma();
const OWNER_ID = "seed-engpac-admin";
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "EngPac@2026";
const seedDir = dirname(fileURLToPath(import.meta.url));
const dt = (value: string) => new Date(`${value}T00:00:00.000Z`);
const money = (value: number) => new Prisma.Decimal(value.toFixed(2));
const hashPassword = (password: string) =>
	Bun.password.hash(password, {
		algorithm: "bcrypt",
		cost: 10,
	});

const encodeXml = (value: string) => strToU8(value);

function buildDefaultContractTemplate(): Uint8Array<ArrayBuffer> {
	const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>MODELO DE CONTRATO</w:t></w:r></w:p>
    <w:p><w:r><w:t>Contratante: {{empresa.nome}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Contratada: {{fornecedor.nome}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>CNPJ da contratada: {{fornecedor.documento}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Endereço da contratada: {{fornecedor.endereco}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Responsável legal: {{fornecedor.responsavel_nome}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>CPF do responsável: {{fornecedor.responsavel_cpf}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Contato: {{fornecedor.contato}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Obra: {{obra.nome}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Endereço da obra: {{obra.endereco}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Contrato: {{contrato.codigo}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Objeto: {{contrato.objeto}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Valor: R$ {{contrato.valor}} ({{contrato.valor_extenso}})</w:t></w:r></w:p>
    <w:p><w:r><w:t>Início: {{contrato.inicio}} | Término: {{contrato.fim}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Multa: R$ {{contrato.multa}} ({{contrato.multa_extenso}})</w:t></w:r></w:p>
    <w:p><w:r><w:t>{{contrato.atividades}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Foro: {{empresa.foro}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Data de emissão: {{data.emissao}}</w:t></w:r></w:p>
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;

	return new Uint8Array(
		zipSync({
			"[Content_Types].xml": encodeXml(`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`),
			"_rels/.rels": encodeXml(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`),
			"word/document.xml": encodeXml(documentXml),
		}),
	);
}

async function loadContractTemplate(
	file: string,
): Promise<Uint8Array<ArrayBuffer>> {
	try {
		return new Uint8Array(await readFile(resolve(seedDir, "templates", file)));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		console.warn(
			`Template ${file} não encontrado; usando o modelo DOCX padrão do seed.`,
		);
		return buildDefaultContractTemplate();
	}
}

type WorkSeed = {
	code: string;
	name: string;
	center: string;
	address: string;
	client: string;
	area: number;
	start: string;
	end: string;
	responsible: string;
	factor: number;
	withAmendment?: boolean;
	withPendingQuotation?: boolean;
};

const WORKS: WorkSeed[] = [
	{
		code: "ENG-001",
		name: "Residencial Parque das Acacias",
		center: "obras-civis",
		address: "Rua das Acacias, 240 - Campinas/SP",
		client: "Parque das Acacias SPE Ltda.",
		area: 4280,
		start: "2026-01-15",
		end: "2026-12-20",
		responsible: "Eng. Marina Alves",
		factor: 1,
		withAmendment: true,
	},
	{
		code: "ENG-003",
		name: "Pavimentacao e drenagem Jardim Europa",
		center: "infraestrutura-privada",
		address: "Jardim Europa - Valinhos/SP",
		client: "Prefeitura Municipal de Valinhos",
		area: 12600,
		start: "2026-03-10",
		end: "2027-01-30",
		responsible: "Eng. Rafael Costa",
		factor: 0.55,
		withPendingQuotation: true,
	},
	{
		code: "ENG-004",
		name: "Contencao e recuperacao do Córrego Central",
		center: "recuperacao-ambiental",
		address: "Av. Central, s/n - Campinas/SP",
		client: "Municipio de Campinas",
		area: 3200,
		start: "2026-04-05",
		end: "2026-11-15",
		responsible: "Eng. Juliana Prado",
		factor: 0.34,
	},
].filter((work) => work.code !== "ENG-004");

const SUPPLIERS = [
	{
		name: "Concrelar Materiais e Servicos Ltda.",
		document: "12345678000195",
		email: "comercial@concrelar.com.br",
		responsibleName: "Marcos Henrique Almeida",
		responsibleDocument: "52998224725",
		address: {
			zipCode: "13050000",
			street: "Rua das Palmeiras",
			number: "240",
			district: "Jardim Proença",
			city: "Campinas",
			state: "SP",
		},
	},
	{
		name: "Terrapleno Engenharia Ltda.",
		document: "23456789000195",
		email: "contato@terrapleno.com.br",
		responsibleName: "Juliana Martins Souza",
		responsibleDocument: "11144477735",
		address: {
			zipCode: "13070000",
			street: "Avenida das Nações",
			number: "810",
			district: "Cambuí",
			city: "Campinas",
			state: "SP",
		},
	},
	{
		name: "Eletrica Campinas Instalacoes Ltda.",
		document: "34567890000130",
		email: "obras@eletricacampinas.com.br",
		responsibleName: "Rafael Gomes Ferreira",
		responsibleDocument: "39053344705",
		address: {
			zipCode: "13083000",
			street: "Rua do Comércio",
			number: "55",
			district: "Taquaral",
			city: "Campinas",
			state: "SP",
		},
	},
	{
		name: "Aco Forte Estruturas Ltda.",
		document: "45678901000175",
		email: "vendas@acoforte.com.br",
		responsibleName: "Camila Oliveira Ribeiro",
		responsibleDocument: "15350946056",
		address: {
			zipCode: "13054000",
			street: "Rua dos Metalúrgicos",
			number: "1200",
			district: "Distrito Industrial",
			city: "Campinas",
			state: "SP",
		},
	},
];

async function clearDatabase() {
	const tables = await prisma.$queryRaw<Array<{ name: string }>>`
		SELECT name FROM sqlite_master
		WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
	`;
	await prisma.$executeRaw`PRAGMA foreign_keys = OFF`;
	for (const { name } of tables.filter(
		(table) => table.name !== "_prisma_migrations",
	)) {
		const escapedName = name.replaceAll('"', '""');
		await prisma.$executeRawUnsafe(`DELETE FROM "${escapedName}"`);
	}
	await prisma.$executeRaw`PRAGMA foreign_keys = ON`;
}

async function createUser(
	id: string,
	email: string,
	name: string,
	role: string,
) {
	const user = await prisma.user.create({
		data: { id, email, name, role, emailVerified: true },
	});
	await prisma.account.create({
		data: {
			id: `credential-${id}`,
			userId: id,
			accountId: id,
			providerId: "credential",
			issuer: "local:credential",
			password: await hashPassword(PASSWORD),
		},
	});
	return user;
}

async function createWorkData(
	ownerId: string,
	centerId: string,
	work: WorkSeed,
	supplierIds: string[],
) {
	const created = await prisma.constructionWork.create({
		data: {
			ownerId,
			costCenterId: centerId,
			code: work.code,
			name: work.name,
			address: work.address,
			clientName: work.client,
			areaM2: money(work.area),
			plannedStart: dt(work.start),
			plannedEnd: dt(work.end),
			// O corte do BI usa a data-base como data de referência. Manter a
			// data de início aqui fazia todos os fatos de maio/junho parecerem
			// futuros, deixando AC, EV, CPI, SPI e EAC indisponíveis.
			baseDate: dt("2026-06-30"),
			operationalStatus: work.factor >= 0.8 ? "EM_EXECUCAO" : "PLANEJADA",
			responsibleName: work.responsible,
			bdiPercentage: money(18),
		},
	});

	const imported = await prisma.constructionImport.create({
		data: {
			ownerId,
			workId: created.id,
			fileName: `${work.code}-orcamento.xlsx`,
			sheetName: "Orcamento",
			rowCount: 9,
			status: "IMPORTED",
			importedSections: [
				"Obra",
				"Orcamento",
				"Cronograma Original",
				"Medicoes",
				"Custos Realizados",
			],
		},
	});
	const items = new Map<
		string,
		{ id: string; quantity: number; total: number; description: string }
	>();
	const stages = [
		[
			"1",
			"Servicos preliminares",
			[
				["1.1", "Mobilizacao e canteiro", "vb", 1, 18500],
				["1.2", "Locacao e limpeza do terreno", "m2", work.area, 18],
			],
		],
		[
			"2",
			"Fundacoes e estrutura",
			[
				[
					"2.1",
					"Fundacao em concreto armado",
					"m3",
					180 * work.factor + 90,
					780,
				],
				["2.2", "Estrutura de concreto", "m3", 240 * work.factor + 120, 920],
			],
		],
		[
			"3",
			"Instalacoes e acabamentos",
			[
				["3.1", "Instalacoes eletricas", "vb", 1, 42000],
				["3.2", "Pavimentacao e acabamento", "m2", work.area * 0.72, 145],
			],
		],
	] as const;
	let sortOrder = 0;
	for (const [stageIndex, stageDescription, stageItems] of stages) {
		const stage = await prisma.constructionBudgetItem.create({
			data: {
				ownerId,
				workId: created.id,
				importId: imported.id,
				index: stageIndex,
				type: "STAGE",
				description: stageDescription,
				totalBudget: money(0),
				totalCost: money(0),
				sortOrder: sortOrder++,
			},
		});
		let stageTotal = 0;
		for (const [index, description, unit, quantity, unitCost] of stageItems) {
			const total = quantity * unitCost;
			stageTotal += total;
			const item = await prisma.constructionBudgetItem.create({
				data: {
					ownerId,
					workId: created.id,
					importId: imported.id,
					parentId: stage.id,
					index,
					type: "ITEM",
					description,
					unit,
					quantity: money(quantity),
					laborUnitCost: money(unitCost * 0.42),
					materialUnitCost: money(unitCost * 0.48),
					equipmentUnitCost: money(unitCost * 0.1),
					otherUnitCost: money(0),
					unitCostTotal: money(unitCost),
					unitCost: money(unitCost),
					totalBudget: money(total),
					totalCost: money(total),
					completionPercentage: money(work.factor * 100),
					providedStatus: work.factor > 0 ? "EM_EXECUCAO" : "NAO_INICIADO",
					computedStatus: work.factor > 0 ? "IN_PROGRESS" : "NOT_STARTED",
					sortOrder: sortOrder++,
				},
			});
			items.set(index, { id: item.id, quantity, total, description });
		}
		await prisma.constructionBudgetItem.update({
			where: { id: stage.id },
			data: { totalBudget: money(stageTotal), totalCost: money(stageTotal) },
		});
	}
	await prisma.constructionWork.update({
		where: { id: created.id },
		data: { activeImportId: imported.id },
	});

	const operationalItems = await prisma.constructionBudgetItem.findMany({
		where: { workId: created.id, importId: imported.id },
		orderBy: { sortOrder: "asc" },
	});
	const identityByIndex = new Map<string, string>();
	for (const operationalItem of operationalItems) {
		const identity = await prisma.budgetItemIdentity.upsert({
			where: {
				workId_index: { workId: created.id, index: operationalItem.index },
			},
			create: {
				ownerId,
				workId: created.id,
				index: operationalItem.index,
			},
			update: {},
		});
		identityByIndex.set(operationalItem.index, identity.id);
		await prisma.constructionBudgetItem.update({
			where: { id: operationalItem.id },
			data: { identityId: identity.id },
		});
	}

	const baselineVersion = await prisma.budgetVersion.create({
		data: {
			ownerId,
			workId: created.id,
			versionNumber: 1,
			label: "Baseline 2026",
			status: "VIGENTE",
			isActive: true,
			budgetImportId: imported.id,
			kind: "ORIGINAL",
			reason: "Orcamento inicial de planejamento da obra.",
		},
	});
	const versionItemByIndex = new Map<string, string>();
	for (const operationalItem of operationalItems) {
		const parentIndex = operationalItems.find(
			(candidate) => candidate.id === operationalItem.parentId,
		)?.index;
		const versionItem = await prisma.budgetVersionItem.create({
			data: {
				versionId: baselineVersion.id,
				identityId: identityByIndex.get(operationalItem.index) as string,
				parentVersionId: parentIndex
					? (versionItemByIndex.get(parentIndex) ?? null)
					: null,
				index: operationalItem.index,
				type: operationalItem.type,
				description: operationalItem.description,
				unit: operationalItem.unit,
				quantity: operationalItem.quantity,
				unitCost: operationalItem.unitCost,
				totalCost: operationalItem.totalCost,
				plannedStart: operationalItem.plannedStart,
				plannedEnd: operationalItem.plannedEnd,
				sortOrder: operationalItem.sortOrder,
			},
		});
		versionItemByIndex.set(operationalItem.index, versionItem.id);
	}

	if (work.withAmendment) {
		const amendment = await prisma.budgetVersion.create({
			data: {
				ownerId,
				workId: created.id,
				versionNumber: 2,
				label: "Aditivo 01 - reforco de fundacoes",
				status: "RASCUNHO",
				isActive: false,
				sourceVersionId: baselineVersion.id,
				budgetImportId: imported.id,
				kind: "ADITIVO",
				acrescimoBruto: money(48000),
				supressao: money(0),
				impactoLiquido: money(48000),
				percentualImpacto: money(4.26),
				reason: "Inclusao de reforco estrutural identificado na execucao.",
			},
		});
		const baselineItems = await prisma.budgetVersionItem.findMany({
			where: { versionId: baselineVersion.id },
			orderBy: { sortOrder: "asc" },
		});
		const amendmentItemByIndex = new Map<string, string>();
		for (const source of baselineItems) {
			const parentIndex = baselineItems.find(
				(parent) => parent.id === source.parentVersionId,
			)?.index;
			const copied = await prisma.budgetVersionItem.create({
				data: {
					versionId: amendment.id,
					identityId: source.identityId,
					sourceVersionItemId: source.id,
					parentVersionId: parentIndex
						? (amendmentItemByIndex.get(parentIndex) ?? null)
						: null,
					index: source.index,
					type: source.type,
					description: source.description,
					unit: source.unit,
					quantity: source.quantity,
					unitCost: source.unitCost,
					totalCost: source.totalCost,
					plannedStart: source.plannedStart,
					plannedEnd: source.plannedEnd,
					sortOrder: source.sortOrder,
				},
			});
			amendmentItemByIndex.set(source.index, copied.id);
		}
		const newIdentity = await prisma.budgetItemIdentity.create({
			data: { ownerId, workId: created.id, index: "2.3" },
		});
		await prisma.budgetVersionItem.create({
			data: {
				versionId: amendment.id,
				identityId: newIdentity.id,
				parentVersionId: amendmentItemByIndex.get("2") ?? null,
				index: "2.3",
				type: "ITEM",
				description: "Reforco estrutural e contenção adicional",
				unit: "m3",
				quantity: money(120),
				unitCost: money(400),
				totalCost: money(48000),
				plannedStart: dt("2026-07-01"),
				plannedEnd: dt("2026-08-15"),
				sortOrder: 99,
			},
		});
	}

	for (const [index, item] of items) {
		await prisma.constructionBaselineSchedule.create({
			data: {
				ownerId,
				workId: created.id,
				importId: imported.id,
				budgetItemId: item.id,
				rowNumber: Number(index.replace(".", "")),
				index,
				plannedStart: dt(work.start),
				plannedEnd: dt(work.end),
				plannedWeight: new Prisma.Decimal((1 / items.size).toFixed(4)),
			},
		});
		await prisma.constructionMeasurement.create({
			data: {
				ownerId,
				workId: created.id,
				importId: imported.id,
				budgetItemId: item.id,
				rowNumber: Number(index.replace(".", "")),
				index,
				title: "Medicao importada do acompanhamento",
				measurementDate: dt("2026-06-30"),
				measuredPercentageAccumulated: money(work.factor * 100),
				measuredQuantityAccumulated: money(item.quantity * work.factor),
				measuredValue: money(item.total * work.factor),
				status: "APROVADA",
				notes: "Registro inicial do acompanhamento fisico-financeiro.",
			},
		});
	}

	const costs = [
		[
			"MATERIAL",
			"Compra de materiais conforme planejamento",
			36000,
			`NF-${work.code}-001`,
			supplierIds[0],
			"2.1",
		],
		[
			"MAO_DE_OBRA",
			"Equipe propria e subempreitada",
			28500 * work.factor,
			`RPA-${work.code}-002`,
			supplierIds[1],
			"1.1",
		],
		[
			"EQUIPAMENTO",
			"Locacao de equipamentos de obra",
			14800 * work.factor,
			`LOC-${work.code}-003`,
			supplierIds[2],
			"3.1",
		],
	] as const;
	for (let i = 0; i < costs.length; i++) {
		const [category, description, amount, document, supplierId, budgetIndex] =
			costs[i];
		const linkedItem = items.get(budgetIndex);
		if (!linkedItem) throw new Error(`Item de custo ausente: ${budgetIndex}`);
		await prisma.constructionActualCost.create({
			data: {
				ownerId,
				workId: created.id,
				importId: imported.id,
				budgetItemId: linkedItem.id,
				rowNumber: i + 2,
				costDate: dt(`2026-0${i + 4}-15`),
				budgetIndex,
				category,
				description,
				amount: money(amount),
				costType: "CURRENT",
				sourceDocument: document,
				appropriationStatus: "APPROPRIATED",
				supplierId,
				supplierName: SUPPLIERS.find((_supplier) =>
					supplierIds.includes(supplierId),
				)?.name,
				costGroup: "CUSTO_DIRETO",
				paymentStatus: i === 0 ? "PAID" : "OPEN",
			},
		});
	}

	const workMeasurementProgress = [
		Math.min(work.factor * 75, 75),
		work.factor * 100,
	];
	for (let n = 0; n < 2; n++) {
		const measurement = await prisma.workMeasurement.create({
			data: {
				ownerId,
				workId: created.id,
				number: n + 1,
				date: dt(n === 0 ? "2026-05-31" : "2026-06-30"),
				title: `Medicao fisica ${String(n + 1).padStart(2, "0")}`,
				createdBy: ownerId,
				notes:
					n === 0
						? "Conferencia de campo realizada."
						: "Medicao consolidada do periodo.",
			},
		});
		for (const item of items.values()) {
			const accumulated = workMeasurementProgress[n];
			const previous = n === 0 ? 0 : workMeasurementProgress[0];
			const progress = Math.max(0, accumulated - previous);
			await prisma.workMeasurementItem.create({
				data: {
					measurementId: measurement.id,
					budgetItemId: item.id,
					measuredQuantity: money((item.quantity * progress) / 100),
					measuredValue: money((item.total * progress) / 100),
					measuredPercentage: money(progress),
					accumulatedQuantity: money((item.quantity * accumulated) / 100),
					accumulatedValue: money((item.total * accumulated) / 100),
					accumulatedPercentage: money(accumulated),
				},
			});
		}
	}

	const supplierId = supplierIds[work.code === "ENG-002" ? 2 : 0];
	const serviceItems = [...items.entries()].slice(1, 4);
	const contractValue =
		serviceItems.reduce((sum, [, item]) => sum + item.total, 0) * 0.94;
	const contract = await prisma.contract.create({
		data: {
			ownerId,
			workId: created.id,
			code: `${work.code}-C-001`,
			supplierId,
			supplierName:
				SUPPLIERS.find((_supplier) => supplierIds.includes(supplierId))?.name ??
				"Fornecedor EngPac",
			serviceType: "Execucao de obra civil",
			objectDescription: `Execução de serviços de ${work.name.toLowerCase()}, incluindo fornecimento de mão de obra, materiais e equipamentos conforme orçamento aprovado.`,
			title: `Contrato de execucao - ${work.name}`,
			contractValue: money(contractValue),
			startDate: dt(work.start),
			endDate: dt(work.end),
			status: work.factor > 0.8 ? "EM_ANDAMENTO" : "RASCUNHO",
			createdBy: ownerId,
			notes:
				"Contrato demonstrativo com servicos, medicoes e pagamentos vinculados.",
		},
	});
	const services = [] as Array<{ id: string; quantity: number; total: number }>;
	for (let i = 0; i < serviceItems.length; i++) {
		const [index, item] = serviceItems[i];
		const service = await prisma.contractService.create({
			data: {
				contractId: contract.id,
				type: "ITEM",
				description: item.description,
				unit: "m3",
				quantity: money(item.quantity),
				unitCost: money((item.total / item.quantity) * 0.94),
				totalCost: money(item.total * 0.94),
				budgetItemId: items.get(index)?.id,
				sortOrder: i + 1,
			},
		});
		services.push({
			id: service.id,
			quantity: item.quantity,
			total: item.total * 0.94,
		});
	}

	if (work.withPendingQuotation) {
		const quotation = await prisma.quotation.create({
			data: {
				ownerId,
				workId: created.id,
				contractCode: `${work.code}-COT-001`,
				serviceType: "Execucao de drenagem e pavimentacao",
				title: `Cotacao pendente - ${work.name}`,
				observation: "Aguardando comparacao e escolha do fornecedor.",
				startDate: dt("2026-07-15"),
				endDate: dt("2026-11-30"),
				status: "EM_COTACAO",
				maxSuppliers: 3,
				createdBy: ownerId,
			},
		});
		for (const [_sortOrder, [index, item]] of serviceItems.entries()) {
			const budgetItemId = items.get(index)?.id;
			if (!budgetItemId) continue;
			await prisma.quotationBudgetItem.create({
				data: {
					ownerId,
					workId: created.id,
					quotationId: quotation.id,
					budgetItemId,
					quantity: money(item.quantity),
				},
			});
		}
		await prisma.quotationProposal.createMany({
			data: [
				{
					quotationId: quotation.id,
					supplierId: supplierIds[0],
					supplierName: SUPPLIERS[0].name,
					supplierDocument: SUPPLIERS[0].document,
					supplierEmail: SUPPLIERS[0].email,
					value: money(contractValue * 1.08),
					serviceDescription: "Proposta inicial aguardando analise",
				},
				{
					quotationId: quotation.id,
					supplierId: supplierIds[1],
					supplierName: SUPPLIERS[1].name,
					supplierDocument: SUPPLIERS[1].document,
					supplierEmail: SUPPLIERS[1].email,
					value: money(contractValue * 1.03),
					serviceDescription: "Proposta alternativa em avaliacao",
				},
			],
		});
	}
	for (const [n, accumulated] of [
		[1, work.factor * 48],
		[2, work.factor * 100],
	] as const) {
		const measurement = await prisma.contractMeasurement.create({
			data: {
				ownerId,
				contractId: contract.id,
				number: n,
				date: dt(n === 1 ? "2026-06-10" : "2026-07-10"),
				title: `Medicao contratual ${String(n).padStart(2, "0")}`,
				createdBy: ownerId,
				retentionValue: money(contractValue * 0.05),
				notes: "Conferencia e aceite pela fiscalizacao EngPac.",
			},
		});
		for (const service of services)
			await prisma.contractMeasurementItem.create({
				data: {
					measurementId: measurement.id,
					serviceId: service.id,
					measuredQuantity: money((service.quantity * accumulated) / 100),
					measuredValue: money((service.total * accumulated) / 100),
					measuredPercentage: money(accumulated),
					accumulatedQuantity: money((service.quantity * accumulated) / 100),
					accumulatedValue: money((service.total * accumulated) / 100),
					accumulatedPercentage: money(accumulated),
				},
			});
		await prisma.contractPayment.create({
			data: {
				ownerId,
				contractId: contract.id,
				measurementId: measurement.id,
				date: dt(n === 1 ? "2026-06-20" : "2026-07-20"),
				value: money((contractValue * accumulated) / 100),
				retentionValue: money(((contractValue * accumulated) / 100) * 0.05),
				discountValue: money(0),
				paidValue: money(
					n === 1 ? ((contractValue * accumulated) / 100) * 0.95 : 0,
				),
				description: `Pagamento referente a medicao contratual ${n}`,
				status: n === 1 ? "PAGO" : "EM_ABERTO",
			},
		});
	}

	const seededWorkMeasurementItems = await prisma.workMeasurementItem.findMany({
		where: { measurement: { ownerId, workId: created.id } },
		select: { id: true, budgetItemId: true },
	});
	const seededContractMeasurementItems =
		await prisma.contractMeasurementItem.findMany({
			where: { measurement: { ownerId, contractId: contract.id } },
			select: {
				id: true,
				service: { select: { budgetItemId: true } },
			},
		});
	const contractMeasurementByBudget = new Map(
		seededContractMeasurementItems
			.filter((item) => item.service.budgetItemId)
			.map((item) => [item.service.budgetItemId as string, item.id]),
	);
	for (const workMeasurementItem of seededWorkMeasurementItems) {
		const contractMeasurementItemId = contractMeasurementByBudget.get(
			workMeasurementItem.budgetItemId,
		);
		if (!contractMeasurementItemId) continue;
		await prisma.constructionMeasurementCoverage.create({
			data: {
				ownerId,
				workMeasurementItemId: workMeasurementItem.id,
				contractMeasurementItemId,
				quantity: money(1),
				amount: money(1000),
			},
		});
	}

	const seededCosts = await prisma.constructionActualCost.findMany({
		where: { workId: created.id, importId: imported.id },
		select: { id: true, budgetItemId: true, amount: true, costDate: true },
	});
	for (const cost of seededCosts) {
		const item = operationalItems.find(
			(candidate) => candidate.id === cost.budgetItemId,
		);
		if (!item) continue;
		const identityId = identityByIndex.get(item.index) as string;
		const versionItemId = versionItemByIndex.get(item.index) as string;
		const impact = await prisma.constructionBudgetImpact.create({
			data: {
				ownerId,
				workId: created.id,
				budgetItemIdentityId: identityId,
				budgetVersionItemId: versionItemId,
				sourceType: "ACTUAL_COST",
				sourceId: cost.id,
				componentId: "amount",
				impactType: "CONSUMPTION",
				status: "APPROVED",
				amount: cost.amount,
				effectiveAt: cost.costDate ?? dt(work.start),
			},
		});
		await prisma.constructionLedgerEvent.create({
			data: {
				ownerId,
				workId: created.id,
				budgetItemIdentityId: identityId,
				budgetVersionItemId: versionItemId,
				eventType: "INCURRED_CREATE",
				sourceType: "ACTUAL_COST",
				sourceId: cost.id,
				componentId: "amount",
				amount: cost.amount,
				competence: (cost.costDate ?? dt(work.start)).toISOString().slice(0, 7),
				occurredAt: cost.costDate ?? dt(work.start),
				budgetImpactId: impact.id,
			},
		});
	}

	for (const service of services) {
		const sourceItem = serviceItems.find(
			([, item]) => item.total * 0.94 === service.total,
		);
		if (!sourceItem) continue;
		const [budgetIndex] = sourceItem;
		const identityId = identityByIndex.get(budgetIndex) as string;
		const versionItemId = versionItemByIndex.get(budgetIndex) as string;
		const impact = await prisma.constructionBudgetImpact.create({
			data: {
				ownerId,
				workId: created.id,
				budgetItemIdentityId: identityId,
				budgetVersionItemId: versionItemId,
				sourceType: "CONTRACT_SERVICE",
				sourceId: service.id,
				componentId: "contracted",
				impactType: "COMMITMENT",
				status: "APPROVED",
				quantity: money(service.quantity),
				amount: money(service.total),
				budgetUnitCostSnapshot: money(service.total / service.quantity),
				effectiveAt: dt(work.start),
			},
		});
		await prisma.constructionLedgerEvent.create({
			data: {
				ownerId,
				workId: created.id,
				budgetItemIdentityId: identityId,
				budgetVersionItemId: versionItemId,
				eventType: "COMMITMENT_INCREASE",
				sourceType: "CONTRACT_SERVICE",
				sourceId: service.id,
				componentId: "contracted",
				amount: money(service.total),
				competence: work.start.slice(0, 7),
				occurredAt: dt(work.start),
				budgetImpactId: impact.id,
			},
		});
	}

	for (const competencia of ["2026-05", "2026-06"]) {
		await prisma.constructionMonthlyFact.create({
			data: {
				ownerId,
				workId: created.id,
				competencia,
				origem: "SEED_REALISTA",
				version: 1,
				status: "ACEITO",
				fingerprint: `${work.code}-${competencia}-seed-realista`,
				createdBy: ownerId,
				reason: "Fato mensal demonstrativo para análise gerencial.",
				valores: {
					orcado: items.size
						? [...items.values()].reduce((sum, item) => sum + item.total, 0)
						: 0,
					executado: work.factor * 100000,
					medido: work.factor * 85000,
					progressoFisico: work.factor * 100,
				},
			},
		});
	}
	return created;
}

export async function runSeed() {
	await clearDatabase();
	const admin = await createUser(
		OWNER_ID,
		"admin@engpac.com.br",
		"EngPac",
		"ADMIN",
	);
	const engineer = await createUser(
		"seed-engpac-engenheiro",
		"engenheiro@engpac.com.br",
		"Eng. Marina Alves",
		"GERENTE",
	);
	const inspector = await createUser(
		"seed-engpac-fiscal",
		"fiscal@engpac.com.br",
		"Fiscal de Obras EngPac",
		"SUPERVISOR",
	);
	const financial = await createUser(
		"seed-engpac-financeiro",
		"financeiro@engpac.com.br",
		"Financeiro EngPac",
		"GESTOR",
	);
	const templateBytes = await loadContractTemplate("engpac.docx");
	const templateSha256 = createHash("sha256")
		.update(templateBytes)
		.digest("hex");
	const company = await prisma.company.create({
		data: {
			ownerId: admin.id,
			name: "ENGENHARIA DE AVALIAÇÕES PERICIAIS E CONSTRUÇÕES LTDA",
			tradeName: "ENGPAC",
			document: "13348041000115",
			addressCity: "Campinas",
			addressState: "SP",
			contactEmail: "contato@engpac.com.br",
			contactPhone: "+55 19 3232-2026",
			managerName: "EngPac",
			contractTemplate: "engpac.docx",
			contractTemplateType: "DOCX",
			contractTemplateBlob: templateBytes,
			contractTemplateSha256: templateSha256,
			contractTemplateVersion: 1,
		},
	});
	for (const item of [
		{
			name: "Econtecx Construções e Empreendimentos LTDA",
			tradeName: "ECONTECX",
			document: "12518352000112",
			city: "Brasília",
			state: "DF",
			file: "econtecx.docx",
		},
		{
			name: "Gennesis Engenharia e Consultoria Ltda",
			tradeName: "GENNESIS",
			document: "17851596000136",
			city: "Brasília",
			state: "DF",
			file: "gennesis.docx",
		},
	]) {
		const bytes = await loadContractTemplate(item.file);
		await prisma.company.create({
			data: {
				ownerId: admin.id,
				name: item.name,
				tradeName: item.tradeName,
				document: item.document,
				addressCity: item.city,
				addressState: item.state,
				contractTemplate: item.file,
				contractTemplateType: "DOCX",
				contractTemplateBlob: bytes,
				contractTemplateSha256: createHash("sha256")
					.update(bytes)
					.digest("hex"),
				contractTemplateVersion: 1,
			},
		});
	}
	const organization = await prisma.organization.create({
		data: {
			ownerId: admin.id,
			name: "ENGPAC Engenharia e Construcoes",
			companyId: company.id,
			managerName: "EngPac",
			address: "Av. das Industrias, 800 - Campinas/SP",
		},
	});
	const centers = new Map<string, string>();
	for (const center of [
		{
			key: "obras-civis",
			name: "Centro de Custo - Obras Civis",
			managerName: "Eng. Marina Alves",
			address: "Campinas/SP",
			organizationId: organization.id,
		},
		{
			key: "infraestrutura-privada",
			name: "Centro de Custo - Infraestrutura",
			managerName: "Eng. Rafael Costa",
			address: "Campinas e regiao/SP",
			organizationId: organization.id,
		},
	]) {
		const created = await prisma.costCenter.create({
			data: {
				ownerId: admin.id,
				organizationId: center.organizationId,
				name: center.name,
				managerName: center.managerName,
				address: center.address,
			},
		});
		centers.set(center.key, created.id);
	}
	await prisma.organizationMembership.createMany({
		data: [organization.id].flatMap((organizationId) =>
			[admin, engineer, inspector, financial].map((user) => ({
				organizationId,
				userId: user.id,
				role: user.role,
			})),
		),
	});
	for (const user of [admin, engineer, inspector, financial])
		for (const centerId of centers.values())
			await prisma.costCenterMembership.create({
				data: { costCenterId: centerId, userId: user.id, role: user.role },
			});
	const supplierIds: string[] = [];
	for (const supplier of SUPPLIERS) {
		const created = await prisma.constructionSupplier.create({
			data: {
				ownerId: admin.id,
				name: supplier.name,
				document: supplier.document,
				contact: supplier.email,
				responsibleName: supplier.responsibleName,
				responsibleDocument: supplier.responsibleDocument,
				addressZipCode: supplier.address.zipCode,
				addressStreet: supplier.address.street,
				addressNumber: supplier.address.number,
				addressDistrict: supplier.address.district,
				addressCity: supplier.address.city,
				addressState: supplier.address.state,
				notes: "Fornecedor homologado EngPac.",
			},
		});
		supplierIds.push(created.id);
	}
	const createdWorks = [];
	for (const work of WORKS) {
		const centerId = centers.get(work.center);
		if (!centerId) throw new Error(`Centro ausente: ${work.center}`);
		const created = await createWorkData(admin.id, centerId, work, supplierIds);
		createdWorks.push(created);
		await prisma.workMembership.createMany({
			data: [admin, engineer, inspector].map((user) => ({
				workId: created.id,
				userId: user.id,
				role: user.id === inspector.id ? "SUPERVISOR" : user.role,
			})),
		});
		for (const supplierId of supplierIds)
			await prisma.constructionWorkSupplier.create({
				data: { ownerId: admin.id, workId: created.id, supplierId },
			});
	}
	await prisma.auditLog.createMany({
		data: createdWorks.flatMap((work) => [
			{
				userId: admin.id,
				ownerId: admin.id,
				action: "CREATE",
				entityType: "WORK",
				entityId: work.id,
				entityDescription: `Obra ${work.code} - ${work.name}`,
			},
			...([] as never[]),
		]),
	});
	console.log(
		JSON.stringify(
			{
				companies: await prisma.company.count(),
				organizations: await prisma.organization.count(),
				users: 4,
				organizationMemberships: await prisma.organizationMembership.count(),
				costCenters: centers.size,
				works: createdWorks.length,
				suppliers: supplierIds.length,
				contracts: await prisma.contract.count(),
				contractMeasurements: await prisma.contractMeasurement.count(),
				workMeasurements: await prisma.workMeasurement.count(),
				actualCosts: await prisma.constructionActualCost.count(),
				budgetVersions: await prisma.budgetVersion.count(),
				budgetVersionItems: await prisma.budgetVersionItem.count(),
				budgetIdentities: await prisma.budgetItemIdentity.count(),
				ledgerEvents: await prisma.constructionLedgerEvent.count(),
				budgetImpacts: await prisma.constructionBudgetImpact.count(),
				monthlyFacts: await prisma.constructionMonthlyFact.count(),
				measurementCoverages:
					await prisma.constructionMeasurementCoverage.count(),
			},
			null,
			2,
		),
	);
	console.log(
		`Seed EngPac concluido. Login: admin@engpac.com.br / ${PASSWORD}`,
	);
}

if (import.meta.main)
	runSeed()
		.catch((error) => {
			console.error("Erro no seed EngPac:", error);
			process.exit(1);
		})
		.finally(() => prisma.$disconnect());
