import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import type {
	ControllerFieldState,
	ControllerRenderProps,
	FieldValues,
} from "react-hook-form";
import { CurrencyInput } from "@/components/atoms/CurrencyInput";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { toDateInputValue } from "@/utils/format";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "../../ui/field";
import { Input } from "../../ui/input";
import type { MaskedInputProps } from "./MaskedField";

const MaskedInput = lazy(() =>
	import("./MaskedField").then((mod) => ({ default: mod.MaskedInput })),
);

function datePartsFromInput(
	value: string | undefined,
): { year: number; month: number; day: number } | null {
	const dateOnly = toDateInputValue(value);
	if (!dateOnly) return null;
	const [year, month, day] = dateOnly.split("-").map(Number);
	if (!year || !month || !day) return null;
	return { year, month, day };
}

function formatLocalDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

type FormFieldProps<
	T extends FieldValues = FieldValues,
	K extends "input" | "textarea" = "input",
> = {
	label: string;
	mode?: "input" | "mask" | "currency" | "datepicker";
	description?: string;
	as?: K;
	field: ControllerRenderProps<T>;
	fieldState: ControllerFieldState;
	mask?: MaskedInputProps["mask"];
} & React.ComponentProps<K>;

export function InputFormField<
	T extends FieldValues = FieldValues,
	K extends "input" | "textarea" = "input",
>({
	as,
	field,
	fieldState,
	label,
	mask,
	description,
	mode = "input",
	...inputProps
}: FormFieldProps<T, K>) {
	const InputEl = (as === "textarea" ? Textarea : Input) as React.ElementType;
	const [open, setOpen] = useState(false);
	const dateParts = field.value ? datePartsFromInput(field.value) : null;
	const calendarDate = dateParts
		? new Date(dateParts.year, dateParts.month - 1, dateParts.day)
		: undefined;
	const displayDate = dateParts
		? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
				new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day)),
			)
		: null;

	return (
		<Field className="flex flex-col gap-1">
			<FieldLabel htmlFor={field.name}>{label}</FieldLabel>
			{mode === "input" && (
				<InputEl
					{...field}
					{...inputProps}
					id={field.name}
					aria-invalid={fieldState.invalid}
				/>
			)}
			{mode === "mask" && (
				<Suspense
					fallback={
						<Input id={field.name} disabled aria-invalid={fieldState.invalid} />
					}
				>
					<MaskedInput
						mask={mask}
						{...field}
						{...(inputProps as React.ComponentProps<"input">)}
					/>
				</Suspense>
			)}
			{mode === "currency" && (
				<CurrencyInput
					id={field.name}
					name={field.name}
					value={String(field.value ?? inputProps.defaultValue ?? "")}
					onValueChange={(v: string | undefined) => field.onChange(v ?? "")}
					onBlur={field.onBlur}
					disabled={field.disabled}
					aria-invalid={fieldState.invalid}
				/>
			)}
			{mode === "datepicker" && (
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger
						data-empty={!field.value}
						className="data-[empty=true]:text-muted-foreground inline-flex w-full items-center justify-start gap-2 rounded-md border border-input bg-card px-3 py-2 text-left text-sm font-normal shadow-xs transition-[color,box-shadow] outline-none hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
						type="button"
					>
						<CalendarIcon className="h-4 w-4 text-muted-foreground" />
						{displayDate ?? "Selecione a data"}
					</PopoverTrigger>
					<PopoverContent className="w-min p-0" align="start">
						<Calendar
							mode="single"
							className="capitalize"
							locale={ptBR}
							selected={calendarDate}
							defaultMonth={calendarDate ?? new Date()}
							onSelect={(date) => {
								if (date) {
									field.onChange(formatLocalDate(date));
									setOpen(false);
								}
							}}
						/>
					</PopoverContent>
				</Popover>
			)}
			{description && <FieldDescription>{description}</FieldDescription>}
			{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
		</Field>
	);
}
