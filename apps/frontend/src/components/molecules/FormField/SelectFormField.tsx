import type { SelectProps } from "@radix-ui/react-select";
import type { FC } from "react";
import type {
	ControllerFieldState,
	ControllerRenderProps,
	FieldValues,
} from "react-hook-form";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Field, FieldError, FieldLabel } from "../../ui/field";

type SelectFormFieldProps<T extends FieldValues = FieldValues> = {
	label: string;
	placeholder: string;
	options: ReadonlyArray<{
		id: string;
		value: string;
		label: string;
	}>;
	field: ControllerRenderProps<T>;
	fieldState: ControllerFieldState;
} & React.ComponentProps<FC<SelectProps>>;

export function SelectFormField<T extends FieldValues = FieldValues>({
	label,
	field,
	options,
	fieldState,
	placeholder,
	...props
}: SelectFormFieldProps<T>) {
	return (
		<Field className="flex flex-col gap-1" data-invalid={fieldState.invalid}>
			<FieldLabel>{label}</FieldLabel>
			<Select onValueChange={field.onChange} {...field} {...props}>
				<SelectTrigger aria-invalid={fieldState.invalid}>
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				<SelectContent className="max-h-60 mt-10">
					<SelectGroup>
						{options.map((option) => (
							<SelectItem key={option.id} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
			{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
		</Field>
	);
}
