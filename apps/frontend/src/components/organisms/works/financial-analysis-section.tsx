import { PackageSearch, TrendingDown, Users } from "lucide-react";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Card, CardContent } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { FinancialBreakdown, UnappropriatedCosts } from "@/types/bi";
import {
	formatCurrency,
	formatDate,
	formatRatioAsPercentage,
} from "@/utils/format";

const ABC_CLASS_STYLE: Record<string, string> = {
	A: "status-success",
	B: "status-warning",
	C: "bg-muted text-foreground",
};

interface FinancialAnalysisSectionProps {
	financial: FinancialBreakdown;
	unappropriatedCosts: UnappropriatedCosts;
}

export function FinancialAnalysisSection({
	financial,
	unappropriatedCosts,
}: FinancialAnalysisSectionProps) {
	const suppliers = financial.abcBySupplier ?? [];
	const groups = financial.byGroup ?? [];
	const unappropriated = unappropriatedCosts.items ?? [];

	return (
		<div className="space-y-6">
			{suppliers.length > 0 && (
				<Card>
					<CardHeaderWithIcon
						icon={Users}
						title="Curva ABC de Fornecedores"
						description="Classificação Pareto por volume de custo realizado"
					/>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Classe</TableHead>
									<TableHead>Fornecedor</TableHead>
									<TableHead className="text-right">Total</TableHead>
									<TableHead className="text-right">Participação</TableHead>
									<TableHead className="text-right">Acumulado</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{suppliers.map((supplier) => (
									<TableRow key={supplier.supplierName}>
										<TableCell>
											<span
												className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
													ABC_CLASS_STYLE[supplier.abcClass]
												}`}
											>
												{supplier.abcClass}
											</span>
										</TableCell>
										<TableCell>{supplier.supplierName}</TableCell>
										<TableCell className="text-right">
											{formatCurrency(supplier.totalAmount)}
										</TableCell>
										<TableCell className="text-right">
											{formatRatioAsPercentage(supplier.percentage)}
										</TableCell>
										<TableCell className="text-right">
											{formatRatioAsPercentage(supplier.accumulatedPercentage)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}

			{groups.length > 0 && (
				<Card>
					<CardHeaderWithIcon
						icon={TrendingDown}
						title="Custos por Grupo"
						description="Distribuição dos custos realizados por grupo"
					/>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Grupo</TableHead>
									<TableHead className="text-right">Total</TableHead>
									<TableHead className="text-right">%</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{groups.map((group) => (
									<TableRow key={group.group}>
										<TableCell>{group.group}</TableCell>
										<TableCell className="text-right">
											{formatCurrency(group.totalAmount)}
										</TableCell>
										<TableCell className="text-right">
											{formatRatioAsPercentage(group.percentage)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}

			{unappropriated.length > 0 && (
				<Card>
					<CardHeaderWithIcon
						icon={PackageSearch}
						title="Custos Não Apropriados"
						description="Gastos sem vínculo com item de orçamento"
					/>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Data</TableHead>
									<TableHead>Descrição</TableHead>
									<TableHead>Fornecedor</TableHead>
									<TableHead>Categoria</TableHead>
									<TableHead>Tipo</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Valor</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{unappropriated.map((item) => (
									<TableRow
										key={`${item.description}-${item.costDate ?? ""}-${item.amount}`}
									>
										<TableCell>
											{item.costDate ? formatDate(item.costDate) : "—"}
										</TableCell>
										<TableCell>{item.description}</TableCell>
										<TableCell>{item.supplierName ?? "—"}</TableCell>
										<TableCell>{item.category ?? "—"}</TableCell>
										<TableCell>
											{item.costType === "CURRENT" ? "Atual" : "Futuro"}
										</TableCell>
										<TableCell>{item.paymentStatus ?? "—"}</TableCell>
										<TableCell className="text-right">
											{formatCurrency(item.amount)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
