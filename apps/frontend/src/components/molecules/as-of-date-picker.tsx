import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { formatDate } from "@/utils/format";

function toLocalDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	const [year, month, day] = value.split("-").map(Number);
	if (!year || !month || !day) return undefined;
	return new Date(year, month - 1, day);
}

function toInputValue(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function startOfToday(): Date {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

interface AsOfDatePickerProps {
	value?: string;
	onChange: (value: string | undefined) => void;
	label?: string;
}

export function AsOfDatePicker({
	value,
	onChange,
	label = "Data de corte",
}: AsOfDatePickerProps) {
	const [open, setOpen] = useState(false);
	const selected = toLocalDate(value);
	const display = selected && value ? formatDate(value) : label;

	return (
		<div className="flex items-center gap-2">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					data-empty={!value}
					className="data-[empty=true]:text-muted-foreground inline-flex h-9 w-full items-center justify-start gap-2 rounded-md border border-input bg-background px-3 text-left text-sm font-normal shadow-xs transition-[color,box-shadow] outline-none hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
					type="button"
				>
					<CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
					<span className="whitespace-nowrap">{display}</span>
				</PopoverTrigger>
				<PopoverContent className="w-min p-0" align="start">
					<Calendar
						mode="single"
						className="capitalize"
						locale={ptBR}
						selected={selected}
						defaultMonth={selected ?? startOfToday()}
						disabled={[{ after: startOfToday() }]}
						onSelect={(date) => {
							if (date) {
								onChange(toInputValue(date));
								setOpen(false);
							}
						}}
					/>
				</PopoverContent>
			</Popover>
			{value && (
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8"
					onClick={() => onChange(undefined)}
					title="Limpar data de corte"
				>
					<X className="h-4 w-4" />
				</Button>
			)}
		</div>
	);
}
