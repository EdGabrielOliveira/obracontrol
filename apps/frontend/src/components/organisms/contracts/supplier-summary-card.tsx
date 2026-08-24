import { Link } from "@tanstack/react-router";
import { Building2, UserPlus } from "lucide-react";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
	ContractSupplierCandidate,
	ContractSupplierSummary,
} from "@/types/contracts";

type SupplierSummaryCardProps = {
	supplier?: ContractSupplierSummary | null;
	candidate?: ContractSupplierCandidate | null;
	onRegister?: () => void;
	isRegistering?: boolean;
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

export function SupplierSummaryCard({
	supplier,
	candidate,
	onRegister,
	isRegistering = false,
}: SupplierSummaryCardProps) {
	if (!supplier && !candidate) return null;

	if (!supplier && candidate) {
		return (
			<Card className="mb-4">
				<CardHeaderWithIcon
					icon={Building2}
					title="Fornecedor da cotação"
					description="Dados encontrados no Excel. Cadastre e vincule o fornecedor para concluir os requisitos do contrato."
					actions={
						onRegister ? (
							<Button size="sm" onClick={onRegister} disabled={isRegistering}>
								<UserPlus className="mr-1 h-4 w-4" />
								Cadastrar fornecedor
							</Button>
						) : null
					}
				/>
				<CardContent className="grid gap-x-6 gap-y-3 text-sm md:grid-cols-2">
					<p>
						<strong>Razão social:</strong> {display(candidate.name)}
					</p>
					<p>
						<strong>CPF/CNPJ:</strong> {display(candidate.document)}
					</p>
					<p>
						<strong>Responsável legal:</strong>{" "}
						{display(candidate.responsibleName)}
					</p>
					<p>
						<strong>Contato:</strong>{" "}
						{display(
							[candidate.phone, candidate.email].filter(Boolean).join(" · "),
						)}
					</p>
					<p className="md:col-span-2">
						<strong>Endereço:</strong> {display(candidate.address)}
					</p>
				</CardContent>
			</Card>
		);
	}

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
