import type { SupplierFormValues } from "@/schemas/suppliers";

type ImportedSupplier = {
	name: string;
	document: string | null;
	address: string | null;
	phone: string | null;
	email: string | null;
	responsibleName: string | null;
};

const emptyAddress = {
	zipCode: "",
	street: "",
	district: "",
	number: "",
	city: "",
	state: "",
	complement: "",
	latitude: null,
	longitude: null,
};

/** Maps the data available in a quotation file to the supplier registration. */
export function supplierImportDefaults(
	supplier: ImportedSupplier,
): Partial<SupplierFormValues> {
	return {
		name: supplier.name,
		document: supplier.document ?? "",
		responsibleName: supplier.responsibleName ?? "",
		contact: [supplier.phone, supplier.email].filter(Boolean).join(" · "),
		structuredAddress: {
			...emptyAddress,
			street: supplier.address ?? "",
		},
	};
}
