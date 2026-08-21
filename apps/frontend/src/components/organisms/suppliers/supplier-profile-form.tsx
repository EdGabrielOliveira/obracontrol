import { CreditCard, Landmark, MapPin, User, Wallet } from "lucide-react";
import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import {
	InputFormField,
	SelectFormField,
} from "@/components/molecules/FormField";
import { INPUT_MASKS } from "@/components/molecules/FormField/MaskedField";
import { AddressForm } from "@/components/organisms/address/address-form";
import { Card, CardContent } from "@/components/ui/card";
import type { SupplierFormValues } from "@/schemas/suppliers";
import type { AddressValue } from "@/types/address";

const PIX_KEY_TYPE_OPTIONS = [
	{ id: "CPF", value: "CPF", label: "CPF" },
	{ id: "CNPJ", value: "CNPJ", label: "CNPJ" },
	{ id: "EMAIL", value: "EMAIL", label: "E-mail" },
	{ id: "PHONE", value: "PHONE", label: "Telefone" },
	{ id: "RANDOM", value: "RANDOM", label: "Chave aleatória" },
] as const;

const BANK_ACCOUNT_TYPE_OPTIONS = [
	{ id: "CHECKING", value: "CHECKING", label: "Conta corrente" },
	{ id: "SAVINGS", value: "SAVINGS", label: "Poupança" },
] as const;

type SupplierProfileFormProps = {
	control: Control<SupplierFormValues>;
};

const emptyAddress: AddressValue = {
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

export function SupplierProfileForm({ control }: SupplierProfileFormProps) {
	return (
		<div className="space-y-4">
			<Card>
				<CardHeaderWithIcon
					icon={User}
					title="Identificação"
					description="Dados de identificação do fornecedor."
				/>
				<CardContent className="space-y-3">
					<Controller
						name="name"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Nome"
								field={field}
								fieldState={fieldState}
								placeholder="Nome do fornecedor"
							/>
						)}
					/>
					<div className="grid gap-3 sm:grid-cols-2">
						<Controller
							name="document"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Documento (CNPJ/CPF)"
									field={field}
									fieldState={fieldState}
									placeholder="Somente números"
								/>
							)}
						/>
						<Controller
							name="contact"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Contato"
									field={field}
									fieldState={fieldState}
									placeholder="E-mail, telefone..."
								/>
							)}
						/>
					</div>
					<div className="grid gap-3 sm:grid-cols-2">
						<Controller
							name="responsibleName"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Responsável legal"
									field={field}
									fieldState={fieldState}
									placeholder="Nome do responsável"
								/>
							)}
						/>
						<Controller
							name="responsibleDocument"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="CPF do responsável"
									field={field}
									fieldState={fieldState}
									placeholder="000.000.000-00"
									mode="mask"
									mask={INPUT_MASKS.cpf}
								/>
							)}
						/>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={Wallet}
					title="Pagamento (PIX)"
					description="Dados de pagamento do fornecedor."
				/>
				<CardContent className="space-y-3">
					<div className="grid gap-3 sm:grid-cols-2">
						<Controller
							name="pixKey"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Chave PIX"
									field={field}
									fieldState={fieldState}
									placeholder="Chave de pagamento"
								/>
							)}
						/>
						<Controller
							name="pixKeyType"
							control={control}
							render={({ field, fieldState }) => (
								<SelectFormField
									label="Tipo de chave PIX"
									placeholder="Selecione o tipo"
									options={PIX_KEY_TYPE_OPTIONS}
									field={field}
									fieldState={fieldState}
								/>
							)}
						/>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={Landmark}
					title="Dados bancários"
					description="Opcional para gerar o contrato."
				/>
				<CardContent className="space-y-3">
					<div className="grid gap-3 sm:grid-cols-2">
						<Controller
							name="bankName"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Banco"
									field={field}
									fieldState={fieldState}
									placeholder="Nome do banco"
								/>
							)}
						/>
						<Controller
							name="bankCode"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Código do banco"
									field={field}
									fieldState={fieldState}
									placeholder="Ex.: 001"
								/>
							)}
						/>
						<Controller
							name="bankBranch"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Agência"
									field={field}
									fieldState={fieldState}
									placeholder="Número da agência"
								/>
							)}
						/>
						<Controller
							name="bankAccount"
							control={control}
							render={({ field, fieldState }) => (
								<InputFormField
									label="Conta"
									field={field}
									fieldState={fieldState}
									placeholder="Número da conta"
								/>
							)}
						/>
						<Controller
							name="bankAccountType"
							control={control}
							render={({ field, fieldState }) => (
								<SelectFormField
									label="Tipo de conta"
									placeholder="Selecione o tipo"
									options={BANK_ACCOUNT_TYPE_OPTIONS}
									field={field}
									fieldState={fieldState}
								/>
							)}
						/>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={MapPin}
					title="Endereço"
					description="Localização do fornecedor."
				/>
				<CardContent>
					<Controller
						name="structuredAddress"
						control={control}
						render={({ field }) => (
							<AddressForm
								value={field.value ?? emptyAddress}
								onChange={field.onChange}
							/>
						)}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeaderWithIcon
					icon={CreditCard}
					title="Observações"
					description="Notas e observações sobre o fornecedor."
				/>
				<CardContent>
					<Controller
						name="notes"
						control={control}
						render={({ field, fieldState }) => (
							<InputFormField
								label="Notas"
								field={field}
								fieldState={fieldState}
								as="textarea"
								placeholder="Observações sobre o fornecedor..."
							/>
						)}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
