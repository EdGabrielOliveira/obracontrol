import { Link } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Card, CardContent } from "@/components/ui/card";
import type { ContractSupplierSummary } from "@/types/contracts";

type SupplierSummaryCardProps = {
	supplier?: ContractSupplierSummary | null;
};

function display(value: string | null | undefined) {
	return value?.trim() || "Não informado";
}

function supplierAddress(supplier: ContractSupplierSummary) {
	return [
		supplier.addressStreet,
		supplier.addressNumber,
		supplier.addressComplement,
		supplier.addressDistrict,
		supplier.addressCity,
		supplier.addressState,
		supplier.addressZipCode,
	]
		.filter((value) => value?.trim())
		.join(", ");
}

export function SupplierSummaryCard({ supplier }: SupplierSummaryCardProps) {
	if (!supplier) return null;

	return (
		<Card className="mb-4">
			<CardHeaderWithIcon
				icon={Building2}
				title="Dados do fornecedor"
				description="Informações cadastrais do fornecedor selecionado."
				actions={
					<Link
						className="link-navigation text-sm font-normal"
						to="/app/fornecedores/$supplierId"
						params={{ supplierId: supplier.id }}
					>
						Ver cadastro completo
					</Link>
				}
			/>
			<CardContent className="grid gap-x-6 gap-y-3 text-sm md:grid-cols-2">
				<p>
					<strong>Razão social:</strong> {display(supplier.name)}
				</p>
				<p>
					<strong>CPF/CNPJ:</strong> {display(supplier.document)}
				</p>
				<p>
					<strong>Responsável legal:</strong>{" "}
					{display(supplier.responsibleName)}
				</p>
				<p>
					<strong>CPF do responsável:</strong>{" "}
					{display(supplier.responsibleDocument)}
				</p>
				<p>
					<strong>Contato:</strong> {display(supplier.contact)}
				</p>
				<p className="md:col-span-2">
					<strong>Endereço:</strong> {display(supplierAddress(supplier))}
				</p>
			</CardContent>
		</Card>
	);
}
