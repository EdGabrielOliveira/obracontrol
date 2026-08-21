import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Supplier } from "@/types/suppliers";

interface SupplierComboboxProps {
	label: string;
	placeholder?: string;
	suppliers: Supplier[];
	value: string;
	onValueChange: (value: string) => void;
	disabled?: boolean;
	invalid?: boolean;
	error?: { message?: string };
}

export function SupplierCombobox({
	label,
	placeholder = "Selecione ou digite o fornecedor...",
	suppliers,
	value,
	onValueChange,
	disabled,
	invalid,
	error,
}: SupplierComboboxProps) {
	const [open, setOpen] = useState(false);
	const selected = suppliers.find((supplier) => supplier.name === value);

	return (
		<Field className="flex flex-col gap-1" data-invalid={invalid}>
			<FieldLabel>{label}</FieldLabel>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant="outline"
						role="combobox"
						aria-expanded={open}
						disabled={disabled}
						className="justify-between font-normal"
					>
						<span className={cn(!value && "text-muted-foreground")}>
							{selected ? selected.name : value || placeholder}
						</span>
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
					<Command>
						<CommandInput
							placeholder="Buscar fornecedor..."
							value={value}
							onChange={(event) => {
								onValueChange(event.target.value);
							}}
						/>
						<CommandList>
							<CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
							<CommandGroup>
								{suppliers.length > 0 && (
									<CommandItem
										value=""
										onSelect={() => {
											onValueChange("");
											setOpen(false);
										}}
									>
										<Check
											className={cn(
												"mr-2 h-4 w-4",
												value === "" ? "opacity-100" : "opacity-0",
											)}
										/>
										Sem fornecedor
									</CommandItem>
								)}
								{suppliers
									.filter(
										(supplier) =>
											supplier.name
												.toLowerCase()
												.includes(value.toLowerCase().trim()) ||
											(supplier.document ?? "")
												.toLowerCase()
												.includes(value.toLowerCase().trim()),
									)
									.map((supplier) => (
										<CommandItem
											key={supplier.id}
											onClick={() => {
												onValueChange(supplier.name);
												setOpen(false);
											}}
										>
											<Check
												className={cn(
													"mr-2 h-4 w-4",
													value === supplier.name ? "opacity-100" : "opacity-0",
												)}
											/>
											{supplier.name}
											{supplier.document && (
												<span className="ml-2 font-mono text-xs text-muted-foreground">
													{supplier.document}
												</span>
											)}
										</CommandItem>
									))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
			{invalid && error && <FieldError errors={[error]} />}
		</Field>
	);
}
