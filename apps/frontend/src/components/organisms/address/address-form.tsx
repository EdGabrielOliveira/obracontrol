import { useRef, useState } from "react";
import { lookupCep } from "@/api/address";
import {
	INPUT_MASKS,
	MaskedInput,
} from "@/components/molecules/FormField/MaskedField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AddressValue } from "@/types/address";
import { applyCepLookup } from "@/utils/address";

type AddressFormProps = {
	value: AddressValue;
	onChange: (value: AddressValue) => void;
	disabled?: boolean;
};

const fieldLabels: Array<[keyof AddressValue, string, string]> = [
	["street", "Rua (opcional)", "Rua / avenida"],
	["district", "Bairro (opcional)", "Bairro"],
	["number", "Número (opcional)", "Número"],
	["city", "Cidade", "Cidade"],
	["state", "Estado", "UF"],
	["complement", "Complemento", "Opcional"],
];

export function AddressForm({ value, onChange, disabled }: AddressFormProps) {
	const [loading, setLoading] = useState(false);
	const [lookupError, setLookupError] = useState<string | null>(null);
	const previousZipLength = useRef(value.zipCode.replace(/\D/g, "").length);

	async function lookupAddress(address: AddressValue) {
		if (address.zipCode.replace(/\D/g, "").length !== 8) {
			setLookupError("Informe um CEP válido com 8 dígitos.");
			return;
		}
		setLoading(true);
		setLookupError(null);
		try {
			const result = await lookupCep(address.zipCode);
			onChange(applyCepLookup(address, result));
		} catch {
			setLookupError(
				"Não foi possível consultar o CEP. Preencha os campos manualmente.",
			);
		} finally {
			setLoading(false);
		}
	}

	const update = (key: keyof AddressValue, next: string) => {
		const nextAddress = { ...value, [key]: next };
		onChange(nextAddress);
		if (key !== "zipCode") return;

		const nextZipLength = next.replace(/\D/g, "").length;
		const reachedCompleteCep =
			nextZipLength === 8 && previousZipLength.current !== 8;
		previousZipLength.current = nextZipLength;
		if (reachedCompleteCep && !disabled) void lookupAddress(nextAddress);
	};

	return (
		<div className="space-y-4">
			<div className="flex items-end gap-2">
				<div className="flex-1 space-y-2">
					<Label htmlFor="address-zip-code">CEP</Label>
					<MaskedInput
						id="address-zip-code"
						mask={INPUT_MASKS.cep}
						value={value.zipCode}
						onChange={(event) => update("zipCode", event.target.value)}
						placeholder="00000-000"
						disabled={disabled || loading}
					/>
				</div>
				<Button
					type="button"
					variant="outline"
					onClick={() => void lookupAddress(value)}
					loading={loading}
					disabled={disabled}
				>
					Buscar CEP
				</Button>
			</div>
			{lookupError && <p className="text-sm text-destructive">{lookupError}</p>}
			<div className="grid gap-4 md:grid-cols-2">
				{fieldLabels.map(([key, label, placeholder]) => (
					<div className="space-y-2" key={key}>
						<Label htmlFor={`address-${key}`}>{label}</Label>
						<Input
							id={`address-${key}`}
							value={value[key] ?? ""}
							onChange={(event) => update(key, event.target.value)}
							placeholder={placeholder}
							disabled={disabled}
						/>
					</div>
				))}
			</div>
			{value.latitude != null && value.longitude != null && (
				<div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
					<span>
						Coordenadas: {value.latitude.toFixed(6)},{" "}
						{value.longitude.toFixed(6)}
					</span>
					<a
						href={`https://www.google.com/maps?q=${value.latitude},${value.longitude}`}
						target="_blank"
						rel="noreferrer"
						className="font-medium text-primary hover:underline"
					>
						Abrir no mapa
					</a>
				</div>
			)}
		</div>
	);
}
