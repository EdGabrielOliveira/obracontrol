import { ConstructionError } from "../../../lib/errors";

export type InstrumentRequirementCode =
	| "COMPANY_TEMPLATE_REQUIRED"
	| "COMPANY_TEMPLATE_INVALID"
	| "SUPPLIER_REQUIRED"
	| "SUPPLIER_NAME_REQUIRED"
	| "CONTRACT_OBJECT_REQUIRED"
	| "SUPPLIER_DOCUMENT_REQUIRED"
	| "SUPPLIER_RESPONSIBLE_REQUIRED"
	| "SUPPLIER_RESPONSIBLE_DOCUMENT_REQUIRED"
	| "SUPPLIER_ADDRESS_REQUIRED"
	| "WORK_ADDRESS_REQUIRED";

export type InstrumentRequirement = {
	code: InstrumentRequirementCode;
	field: string;
	message: string;
	resource: "EMPRESA" | "CONTRATO" | "FORNECEDOR" | "OBRA";
	complete: boolean;
};

export type InstrumentReadiness = {
	ready: boolean;
	requirements: InstrumentRequirement[];
};

type InstrumentReadinessInput = {
	hasDocxTemplate: boolean;
	templateIsValid: boolean;
	hasSupplier: boolean;
	objectDescription: string | null;
	supplier: {
		name: string | null;
		document: string | null;
		responsibleName: string | null;
		responsibleDocument: string | null;
		hasCompleteAddress: boolean;
		contact: string | null;
	} | null;
	workAddress: string | null;
};

function isFilled(value: string | null | undefined): boolean {
	return Boolean(value?.trim());
}

function isCnpj(value: string | null | undefined): boolean {
	return Boolean(value && value.replace(/\D/g, "").length === 14);
}

function requirement(
	code: InstrumentRequirementCode,
	field: string,
	message: string,
	resource: InstrumentRequirement["resource"],
	complete: boolean,
): InstrumentRequirement {
	return { code, field, message, resource, complete };
}

export function assessInstrumentReadiness(
	input: InstrumentReadinessInput,
): InstrumentReadiness {
	const supplier = input.supplier;
	const requirements = [
		requirement(
			"COMPANY_TEMPLATE_REQUIRED",
			"company.contractTemplate",
			"A empresa precisa ter um template DOCX cadastrado.",
			"EMPRESA",
			input.hasDocxTemplate,
		),
		requirement(
			"COMPANY_TEMPLATE_INVALID",
			"company.contractTemplate",
			"O template DOCX da empresa contém campos inválidos.",
			"EMPRESA",
			!input.hasDocxTemplate || input.templateIsValid,
		),
		requirement(
			"SUPPLIER_REQUIRED",
			"contract.supplierId",
			"Vincule um fornecedor cadastrado ao contrato.",
			"CONTRATO",
			input.hasSupplier,
		),
		requirement(
			"SUPPLIER_NAME_REQUIRED",
			"supplier.name",
			"Preencha a razão social da empresa fornecedora.",
			"FORNECEDOR",
			isFilled(supplier?.name),
		),
		requirement(
			"CONTRACT_OBJECT_REQUIRED",
			"contract.objectDescription",
			"Preencha o objeto do contrato.",
			"CONTRATO",
			isFilled(input.objectDescription),
		),
		requirement(
			"SUPPLIER_DOCUMENT_REQUIRED",
			"supplier.document",
			"Preencha o CNPJ da empresa fornecedora.",
			"FORNECEDOR",
			isCnpj(supplier?.document),
		),
		requirement(
			"SUPPLIER_RESPONSIBLE_REQUIRED",
			"supplier.responsibleName",
			"Preencha o nome do responsável legal do fornecedor.",
			"FORNECEDOR",
			isFilled(supplier?.responsibleName),
		),
		requirement(
			"SUPPLIER_RESPONSIBLE_DOCUMENT_REQUIRED",
			"supplier.responsibleDocument",
			"Preencha o CPF do responsável legal do fornecedor.",
			"FORNECEDOR",
			isFilled(supplier?.responsibleDocument),
		),
		requirement(
			"SUPPLIER_ADDRESS_REQUIRED",
			"supplier.address",
			"Preencha o endereço completo do fornecedor.",
			"FORNECEDOR",
			supplier?.hasCompleteAddress ?? false,
		),
		requirement(
			"WORK_ADDRESS_REQUIRED",
			"work.address",
			"Preencha o endereço da obra.",
			"OBRA",
			isFilled(input.workAddress),
		),
	];
	return {
		ready: requirements.every((item) => item.complete),
		requirements,
	};
}

export function assertInstrumentReady(readiness: InstrumentReadiness): void {
	if (readiness.ready) return;
	const pending = readiness.requirements.filter((item) => !item.complete);
	throw new ConstructionError(
		"INSTRUMENT_NOT_READY",
		"Preencha os dados obrigatórios antes de gerar o PDF.",
		422,
		pending.map(({ code, field, message }) => ({ code, field, message })),
	);
}
