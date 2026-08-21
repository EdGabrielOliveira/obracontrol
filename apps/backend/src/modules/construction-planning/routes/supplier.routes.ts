import { Elysia, t } from "elysia";
import { requireRole } from "../../../lib/authorization-middleware";
import { resolveAuth } from "../../../lib/resolve-auth";
import { parseInput, parseQuery } from "../../../lib/zod-validation";
import {
	createSupplierSchema,
	supplierFilterSchema,
	updateSupplierSchema,
} from "../suppliers/supplier.schema";
import { supplierService } from "../suppliers/supplier.service";

export const supplierRoutes = new Elysia({
	prefix: "/suppliers",
	name: "supplier-routes",
})
	.use(resolveAuth)
	.use(requireRole("read"))
	.get(
		"/",
		async ({ query, user }) => {
			const parsed = parseQuery(supplierFilterSchema, query);
			return supplierService.list({
				ownerId: user.id,
				q: parsed.q,
				page: parsed.page,
				pageSize: parsed.pageSize,
			});
		},
		{ detail: { tags: ["Suppliers"] } },
	)
	.get(
		"/:supplierId",
		async ({ params, user }) => {
			return supplierService.getDetail(user.id, params.supplierId);
		},
		{ detail: { tags: ["Suppliers"] } },
	)
	.use(requireRole("write"))
	.post(
		"/",
		async ({ body, user }) => {
			const parsed = parseInput(createSupplierSchema, body);
			return supplierService.create(
				{
					ownerId: user.id,
					name: parsed.name,
					document: parsed.document,
					responsibleName: parsed.responsibleName,
					responsibleDocument: parsed.responsibleDocument,
					contact: parsed.contact,
					pixKey: parsed.pixKey,
					pixKeyType: parsed.pixKeyType,
					bankCode: parsed.bankCode,
					bankName: parsed.bankName,
					bankBranch: parsed.bankBranch,
					bankAccount: parsed.bankAccount,
					bankAccountType: parsed.bankAccountType,
					addressZipCode: parsed.addressZipCode,
					addressStreet: parsed.addressStreet,
					addressNumber: parsed.addressNumber,
					addressComplement: parsed.addressComplement,
					addressDistrict: parsed.addressDistrict,
					addressCity: parsed.addressCity,
					addressState: parsed.addressState,
					notes: parsed.notes,
				},
				{ userId: user.id },
			);
		},
		{
			body: t.Object({
				name: t.String(),
				document: t.Optional(t.Nullable(t.String())),
				responsibleName: t.Optional(t.Nullable(t.String())),
				responsibleDocument: t.Optional(t.Nullable(t.String())),
				contact: t.Optional(t.Nullable(t.String())),
				pixKey: t.Optional(t.Nullable(t.String())),
				pixKeyType: t.Optional(t.Nullable(t.String())),
				bankCode: t.Optional(t.Nullable(t.String())),
				bankName: t.Optional(t.Nullable(t.String())),
				bankBranch: t.Optional(t.Nullable(t.String())),
				bankAccount: t.Optional(t.Nullable(t.String())),
				bankAccountType: t.Optional(t.Nullable(t.String())),
				addressZipCode: t.Optional(t.Nullable(t.String())),
				addressStreet: t.Optional(t.Nullable(t.String())),
				addressNumber: t.Optional(t.Nullable(t.String())),
				addressComplement: t.Optional(t.Nullable(t.String())),
				addressDistrict: t.Optional(t.Nullable(t.String())),
				addressCity: t.Optional(t.Nullable(t.String())),
				addressState: t.Optional(t.Nullable(t.String())),
				notes: t.Optional(t.Nullable(t.String())),
			}),
			detail: { tags: ["Suppliers"] },
		},
	)
	.patch(
		"/:supplierId",
		async ({ params, body, user }) => {
			const parsed = parseInput(updateSupplierSchema, body);
			return supplierService.update(
				user.id,
				params.supplierId,
				{
					name: parsed.name,
					document: parsed.document,
					responsibleName: parsed.responsibleName,
					responsibleDocument: parsed.responsibleDocument,
					contact: parsed.contact,
					pixKey: parsed.pixKey,
					pixKeyType: parsed.pixKeyType,
					bankCode: parsed.bankCode,
					bankName: parsed.bankName,
					bankBranch: parsed.bankBranch,
					bankAccount: parsed.bankAccount,
					bankAccountType: parsed.bankAccountType,
					addressZipCode: parsed.addressZipCode,
					addressStreet: parsed.addressStreet,
					addressNumber: parsed.addressNumber,
					addressComplement: parsed.addressComplement,
					addressDistrict: parsed.addressDistrict,
					addressCity: parsed.addressCity,
					addressState: parsed.addressState,
					notes: parsed.notes,
				},
				{ userId: user.id },
			);
		},
		{
			body: t.Object({
				name: t.Optional(t.String()),
				document: t.Optional(t.Nullable(t.String())),
				responsibleName: t.Optional(t.Nullable(t.String())),
				responsibleDocument: t.Optional(t.Nullable(t.String())),
				contact: t.Optional(t.Nullable(t.String())),
				pixKey: t.Optional(t.Nullable(t.String())),
				pixKeyType: t.Optional(t.Nullable(t.String())),
				bankCode: t.Optional(t.Nullable(t.String())),
				bankName: t.Optional(t.Nullable(t.String())),
				bankBranch: t.Optional(t.Nullable(t.String())),
				bankAccount: t.Optional(t.Nullable(t.String())),
				bankAccountType: t.Optional(t.Nullable(t.String())),
				addressZipCode: t.Optional(t.Nullable(t.String())),
				addressStreet: t.Optional(t.Nullable(t.String())),
				addressNumber: t.Optional(t.Nullable(t.String())),
				addressComplement: t.Optional(t.Nullable(t.String())),
				addressDistrict: t.Optional(t.Nullable(t.String())),
				addressCity: t.Optional(t.Nullable(t.String())),
				addressState: t.Optional(t.Nullable(t.String())),
				notes: t.Optional(t.Nullable(t.String())),
			}),
			detail: { tags: ["Suppliers"] },
		},
	)
	.delete(
		"/:supplierId",
		async ({ params, user }) => {
			await supplierService.remove(user.id, params.supplierId, {
				userId: user.id,
			});
			return new Response(null, { status: 204 });
		},
		{ detail: { tags: ["Suppliers"] } },
	);
