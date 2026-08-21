import { CircleAlert, CircleCheck } from "lucide-react";
import type { ContractInstrumentReadiness } from "@/api/contract-artifacts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const resourceLabel = {
	EMPRESA: "Empresa",
	CONTRATO: "Contrato",
	FORNECEDOR: "Fornecedor",
	OBRA: "Obra",
} as const;

type InstrumentReadinessCardProps = {
	readiness?: ContractInstrumentReadiness;
	isLoading: boolean;
	error?: string | null;
};

export function InstrumentReadinessCard({
	readiness,
	isLoading,
	error,
}: InstrumentReadinessCardProps) {
	if (isLoading) {
		return (
			<Alert className="mb-4">
				<AlertTitle>Verificando cadastro para geração do PDF...</AlertTitle>
			</Alert>
		);
	}

	if (error) {
		return (
			<Alert className="status-warning mb-4">
				<CircleAlert />
				<AlertTitle>Não foi possível validar a geração do contrato</AlertTitle>
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		);
	}

	if (!readiness) return null;
	if (readiness.ready) {
		return (
			<Alert className="status-success mb-4 hidden!">
				<CircleCheck />
				<AlertTitle>Cadastro pronto para gerar o PDF</AlertTitle>
				<AlertDescription>
					Os dados obrigatórios do contrato, fornecedor, obra e empresa estão
					completos.
				</AlertDescription>
			</Alert>
		);
	}

	const pending = readiness.requirements.filter((item) => !item.complete);
	const supplierPending = pending.filter(
		(item) =>
			item.resource === "FORNECEDOR" || item.code === "SUPPLIER_REQUIRED",
	);
	const otherPending = pending.filter(
		(item) =>
			item.resource !== "FORNECEDOR" && item.code !== "SUPPLIER_REQUIRED",
	);
	return (
		<Alert className="status-warning mb-4">
			<CircleAlert />
			<AlertTitle>Este contrato ainda não pode ser gerado</AlertTitle>
			<AlertDescription>
				<p className="mb-2">
					Faltam {pending.length} requisito(s) obrigatório(s) para gerar o
					instrumento do contrato:
				</p>
				{supplierPending.length > 0 ? (
					<div className="mb-2">
						<p className="font-medium">
							O fornecedor não possui cadastro ou dados suficientes:
						</p>
						<ul className="list-disc space-y-1 pl-5">
							{supplierPending.map((item) => (
								<li key={item.code}>{item.message}</li>
							))}
						</ul>
					</div>
				) : null}
				{otherPending.length > 0 ? (
					<ul className="list-disc space-y-1 pl-5">
						{otherPending.map((item) => (
							<li key={item.code}>
								<span className="font-medium">
									{resourceLabel[item.resource]}:
								</span>{" "}
								{item.message}
							</li>
						))}
					</ul>
				) : null}
			</AlertDescription>
		</Alert>
	);
}
