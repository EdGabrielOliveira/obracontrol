import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

interface SearchInputProps {
	value?: string;
	onChange: (value: string) => void;
	placeholder?: string;
	delay?: number;
	className?: string;
	clearable?: boolean;
}

export function SearchInput({
	value = "",
	onChange,
	placeholder = "Buscar...",
	delay = 300,
	className,
	clearable = true,
}: SearchInputProps) {
	const [inputValue, setInputValue] = useState(value);
	const debouncedValue = useDebouncedValue(inputValue, delay);

	useEffect(() => {
		setInputValue(value);
	}, [value]);

	useEffect(() => {
		if (debouncedValue !== value) onChange(debouncedValue);
	}, [debouncedValue, onChange, value]);

	return (
		<div className={cn("relative w-full", className)}>
			<Search
				aria-hidden="true"
				className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				aria-label={placeholder}
				placeholder={placeholder}
				value={inputValue}
				onChange={(event) => setInputValue(event.target.value)}
				className={cn("pl-9", clearable && inputValue && "pr-9")}
			/>
			{clearable && inputValue && (
				<button
					type="button"
					aria-label="Limpar busca"
					onClick={() => setInputValue("")}
					className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
				>
					<X aria-hidden="true" className="h-4 w-4" />
				</button>
			)}
		</div>
	);
}
