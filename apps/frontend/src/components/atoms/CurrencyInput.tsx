import { Input } from "@/components/ui/input";

type CurrencyInputProps = {
	id?: string;
	name?: string;
	value?: string;
	onValueChange?: (value: string | undefined) => void;
	onBlur?: () => void;
	disabled?: boolean;
	placeholder?: string;
	"aria-invalid"?: boolean | "true" | "false";
	className?: string;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

function parseCurrency(value: string): number | null {
	const normalized = value.trim();
	if (!normalized) return null;

	const cleaned = normalized.replace(/[^\d,.-]/g, "");
	const hasComma = cleaned.includes(",");
	const decimalNormalized = hasComma
		? cleaned.replace(/\./g, "").replace(",", ".")
		: cleaned;
	const parsed = Number(decimalNormalized);

	return Number.isNaN(parsed) ? null : parsed;
}

function formatCurrencyValue(value: string | undefined): string {
	if (!value) return "";

	const parsed = parseCurrency(value);
	return parsed === null ? value : currencyFormatter.format(parsed);
}

export const CurrencyInput = (props: CurrencyInputProps) => {
	const {
		value,
		onValueChange,
		placeholder = "Digite o valor",
		className,
		...inputProps
	} = props;

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const digits = event.currentTarget.value.replace(/\D/g, "");

		if (!digits) {
			onValueChange?.(undefined);
			return;
		}

		onValueChange?.(currencyFormatter.format(Number(digits) / 100));
	};

	return (
		<Input
			{...inputProps}
			type="text"
			inputMode="decimal"
			value={formatCurrencyValue(value)}
			onChange={handleChange}
			placeholder={placeholder}
			className={className}
		/>
	);
};
