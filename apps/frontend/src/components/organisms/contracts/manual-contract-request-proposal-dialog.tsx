import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ManualContractRequestProposalInput } from "@/types/contract-requests";
import {
	formatCnpj,
	formatCurrencyInput,
	parseCurrencyInput,
} from "@/utils/format";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (input: ManualContractRequestProposalInput) => void;
	isSubmitting?: boolean;
};

export function ManualContractRequestProposalDialog({
	open,
	onOpenChange,
	onSubmit,
	isSubmitting = false,
}: Props) {
	const [supplierName, setSupplierName] = useState("");
	const [cnpj, setCnpj] = useState("");
	const [proposalValue, setProposalValue] = useState("");
	const [notes, setNotes] = useState("");

	useEffect(() => {
		if (open) {
			setSupplierName("");
			setCnpj("");
			setProposalValue("");
			setNotes("");
		}
	}, [open]);

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const value = parseCurrencyInput(proposalValue);
		if (
			!supplierName.trim() ||
			!cnpj.trim() ||
			!Number.isFinite(value) ||
			value <= 0
		) {
			return;
		}
		onSubmit({
			supplierName: supplierName.trim(),
			cnpj: cnpj.replace(/\D/g, ""),
			proposalValue: value,
			...(notes.trim() ? { notes: notes.trim() } : {}),
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Adicionar participante</DialogTitle>
					<DialogDescription>
						Inclua uma nova proposta no comparativo sem importar outro Excel.
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-4" onSubmit={submit}>
					<div className="space-y-2">
						<Label htmlFor="manual-supplier-name">Razão social</Label>
						<Input
							id="manual-supplier-name"
							value={supplierName}
							onChange={(event) => setSupplierName(event.target.value)}
							placeholder="Nome do fornecedor"
							autoFocus
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="manual-supplier-cnpj">CNPJ</Label>
						<Input
							id="manual-supplier-cnpj"
							value={cnpj}
							onChange={(event) => setCnpj(formatCnpj(event.target.value))}
							inputMode="numeric"
							maxLength={18}
							placeholder="00.000.000/0000-00"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="manual-proposal-value">Valor da proposta</Label>
						<Input
							id="manual-proposal-value"
							type="text"
							inputMode="decimal"
							value={proposalValue}
							onChange={(event) =>
								setProposalValue(formatCurrencyInput(event.target.value))
							}
							placeholder="R$ 0,00"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="manual-proposal-notes">
							Observações (opcional)
						</Label>
						<Textarea
							id="manual-proposal-notes"
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
							placeholder="Informações adicionais da proposta"
							className="min-h-20"
						/>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancelar
						</Button>
						<Button type="submit" loading={isSubmitting}>
							Adicionar ao comparativo
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
