import {
	BookOpen,
	Calculator,
	CreditCard,
	Download,
	Package,
	Receipt,
} from "lucide-react";
import { toast } from "sonner";
import {
	exportCompleto,
	exportContratos,
	exportCustos,
	exportMedicoes,
	exportOrcamento,
} from "@/api/export";
import { AsOfDatePicker } from "@/components/molecules/as-of-date-picker";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { downloadBlob } from "@/lib/download";

const EXPORT_ITEMS = [
	{
		label: "Orçamento",
		filename: "orcamento.xlsx",
		icon: Calculator,
		exportFn: exportOrcamento,
	},
	{
		label: "Medições",
		filename: "medicoes.xlsx",
		icon: Receipt,
		exportFn: exportMedicoes,
	},
	{
		label: "Custos",
		filename: "custos.xlsx",
		icon: CreditCard,
		exportFn: exportCustos,
	},
	{
		label: "Contratos",
		filename: "contratos.xlsx",
		icon: BookOpen,
		exportFn: exportContratos,
	},
	{
		label: "Completo",
		filename: "obra-completa.xlsx",
		icon: Package,
		exportFn: exportCompleto,
	},
] as const;

type WorkReportsTabProps = {
	workId: string;
	asOfDate?: string;
	onAsOfDateChange: (value: string | undefined) => void;
};

export function WorkReportsTab({
	workId,
	asOfDate,
	onAsOfDateChange,
}: WorkReportsTabProps) {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeaderWithIcon
					icon={Download}
					title="Exportações"
					description="Escolha o conjunto de dados que deseja baixar."
				/>
				<CardContent>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
						{EXPORT_ITEMS.map((item) => (
							<Button
								key={item.label}
								variant="outline"
								className="flex h-auto flex-col gap-2 py-4"
								onClick={async () => {
									try {
										const blob = await item.exportFn(workId, asOfDate);
										downloadBlob(blob, item.filename);
										toast.success("Exportação concluída!");
									} catch {
										toast.error(
											`Erro ao exportar ${item.label.toLowerCase()}.`,
										);
									}
								}}
							>
								<item.icon className="h-5 w-5 text-muted-foreground" />
								<span className="text-sm">{item.label}</span>
							</Button>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
