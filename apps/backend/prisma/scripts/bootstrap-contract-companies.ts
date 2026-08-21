import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const email = process.env.CONTRACT_ADMIN_EMAIL;
const password = process.env.CONTRACT_ADMIN_PASSWORD;
if (!email || !password)
	throw new Error(
		"CONTRACT_ADMIN_EMAIL e CONTRACT_ADMIN_PASSWORD são obrigatórios",
	);

const root = resolve(import.meta.dir, "../templates");
const companies = [
	{
		name: "ENGENHARIA DE AVALIAÇÕES PERICIAIS E CONSTRUÇÕES LTDA",
		document: "13348041000115",
		tradeName: "ENGPAC",
		city: "Natal",
		state: "RN",
		file: "engpac.docx",
	},
	{
		name: "Econtecx Construções e Empreendimentos LTDA",
		document: "12518352000112",
		tradeName: "ECONTECX",
		city: "Brasília",
		state: "DF",
		file: "econtecx.docx",
	},
	{
		name: "Gennesis Engenharia e Consultoria Ltda",
		document: "17851596000136",
		tradeName: "GENNESIS",
		city: "Brasília",
		state: "DF",
		file: "gennesis.docx",
	},
] as const;

const user = await prisma.user.upsert({
	where: { email },
	create: {
		id: `contract-admin-${crypto.randomUUID()}`,
		email,
		name: "Administrador",
		role: "ADMIN",
		emailVerified: true,
	},
	update: { name: "Administrador", role: "ADMIN", emailVerified: true },
});
await prisma.account.upsert({
	where: { id: `credential-${user.id}` },
	create: {
		id: `credential-${user.id}`,
		userId: user.id,
		accountId: user.id,
		providerId: "credential",
		issuer: "local:credential",
		password: await Bun.password.hash(password, {
			algorithm: "bcrypt",
			cost: 10,
		}),
	},
	update: {
		password: await Bun.password.hash(password, {
			algorithm: "bcrypt",
			cost: 10,
		}),
		accountId: user.id,
		providerId: "credential",
		issuer: "local:credential",
	},
});

for (const item of companies) {
	const bytes = await readFile(resolve(root, item.file));
	const hash = createHash("sha256").update(bytes).digest("hex");
	const existing = await prisma.company.findFirst({
		where: {
			ownerId: user.id,
			OR: [
				{ name: item.name },
				{ document: item.document },
				{ tradeName: item.tradeName },
			],
		},
		select: {
			id: true,
			contractTemplateSha256: true,
			contractTemplateVersion: true,
		},
	});
	const templateVersion =
		existing?.contractTemplateSha256 === hash
			? existing.contractTemplateVersion
			: (existing?.contractTemplateVersion ?? 0) + 1;
	const data = {
		ownerId: user.id,
		name: item.name,
		document: item.document,
		tradeName: item.tradeName,
		addressCity: item.city,
		addressState: item.state,
		contractTemplate: item.file,
		contractTemplateType: "DOCX",
		contractTemplateBlob: bytes,
		contractTemplateSha256: hash,
		contractTemplateVersion: templateVersion,
	};
	if (existing) {
		await prisma.company.update({ where: { id: existing.id }, data });
	} else {
		await prisma.company.create({ data });
	}
}
console.log(`Bootstrap concluído para ${email}`);
await prisma.$disconnect();
