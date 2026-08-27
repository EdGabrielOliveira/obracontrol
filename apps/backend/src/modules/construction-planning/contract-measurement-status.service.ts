import { writeAudit } from "../../lib/audit-writer";
import { ConstructionError } from "../../lib/errors";
import { resolveResourceScope } from "../../lib/resource-scope";
import {
	MEASUREMENT_TRANSITIONS,
	validateStatusTransition,
} from "../../lib/status-machine";
import { withSerializableRetry } from "../../lib/transaction-retry";
import type { MeasurementActorRole } from "../governance/governance.service";
import * as cmRepository from "./contract-measurement.repository";
import {
	applyContractMeasurementAcceptance,
	reverseContractMeasurementAcceptance,
} from "./measurement-acceptance-effects";
import { measurementCoverageService } from "./measurement-coverage.service";

export async function setContractMeasurementStatus(input: {
	ownerId: string;
	contractId: string;
	measurementId: string;
	status: "RASCUNHO" | "ACEITO" | "RECUSADO" | "ARQUIVADO";
	reason: string | null | undefined;
	role: MeasurementActorRole;
	actorId: string;
	assertWritable: () => Promise<void>;
	getMeasurement: () => Promise<unknown>;
}) {
	if (input.role === "SUPERVISOR") {
		throw new ConstructionError(
			"FORBIDDEN",
			"Supervisor nao pode alterar status da medicao",
			403,
		);
	}
	await input.assertWritable();
	if (
		(input.status === "RECUSADO" || input.status === "ARQUIVADO") &&
		!input.reason?.trim()
	) {
		throw new ConstructionError(
			"STATUS_REASON_REQUIRED",
			"Motivo obrigatorio para recusar ou arquivar",
			422,
		);
	}
	const normalizedReason = input.reason?.trim() || null;

	const acceptanceContext = await cmRepository.getContractLedgerContext(
		input.ownerId,
		input.contractId,
	);
	if (!acceptanceContext) {
		throw new ConstructionError("NOT_FOUND", "Contrato nao encontrado", 404);
	}
	const acceptanceScope = await resolveResourceScope(input.ownerId, {
		workId: acceptanceContext.workId,
	});

	await withSerializableRetry(async (tx) => {
		const persisted = await tx.contractMeasurement.findFirst({
			where: {
				id: input.measurementId,
				ownerId: input.ownerId,
				contractId: input.contractId,
			},
			include: { items: true },
		});
		if (!persisted) {
			throw new ConstructionError("NOT_FOUND", "Medicao nao encontrada", 404);
		}

		const currentStatus = persisted.status ?? "RASCUNHO";
		validateStatusTransition(
			"CONTRACT_MEASUREMENT",
			MEASUREMENT_TRANSITIONS,
			currentStatus,
			input.status,
		);
		if (currentStatus === "ACEITO" && input.status !== "ACEITO") {
			const paidPayments = await cmRepository.countPaidPaymentsForMeasurement(
				tx,
				input.ownerId,
				input.measurementId,
			);
			if (paidPayments > 0) {
				throw new ConstructionError(
					"MEASUREMENT_PAID_REQUIRES_PAYMENT_REVERSAL",
					"Estorne os pagamentos registrados antes de retirar a medição do status aceito",
					422,
				);
			}
			const ledgerContext = await cmRepository.getContractLedgerContext(
				input.ownerId,
				input.contractId,
				tx,
			);
			if (!ledgerContext) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Contrato nao encontrado",
					404,
				);
			}
			await reverseContractMeasurementAcceptance({
				tx,
				ownerId: input.ownerId,
				workId: ledgerContext.workId,
				measurementId: input.measurementId,
				actorId: input.actorId,
				scope: acceptanceScope,
			});
			await measurementCoverageService.deactivateContractMeasurement(
				input.ownerId,
				ledgerContext.workId,
				input.measurementId,
				{ userId: input.actorId },
				tx,
			);
		}
		if (input.status === "ACEITO" && currentStatus !== "ACEITO") {
			const ledgerContext = await cmRepository.getContractLedgerContext(
				input.ownerId,
				input.contractId,
				tx,
			);
			if (!ledgerContext) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Contrato nao encontrado",
					404,
				);
			}
			await applyContractMeasurementAcceptance({
				tx,
				ownerId: input.ownerId,
				workId: ledgerContext.workId,
				contractId: input.contractId,
				measurementId: input.measurementId,
				actorId: input.actorId,
				measurement: persisted,
				scope: acceptanceScope,
			});
		}

		const updated = await cmRepository.updateMeasurementStatus(
			input.ownerId,
			input.contractId,
			input.measurementId,
			input.status,
			normalizedReason,
			input.actorId,
			tx,
			currentStatus,
		);
		if (!updated) {
			throw new ConstructionError("NOT_FOUND", "Medicao nao encontrada", 404);
		}
		await writeAudit(tx, {
			userId: input.actorId,
			ownerId: input.ownerId,
			action: "STATUS_CHANGED",
			entityType: "CONTRACT_MEASUREMENT",
			entityId: input.measurementId,
			entityDescription: `Medição de contrato ${persisted.number}${persisted.title ? ` - ${persisted.title}` : ""}`,
			previousState: {
				status: currentStatus,
				statusReason: persisted.statusReason ?? null,
			},
			newState: {
				status: input.status,
				statusReason: normalizedReason,
			},
			metadata: {
				statusField: "status",
				fromStatus: currentStatus,
				toStatus: input.status,
				reason: normalizedReason,
				contractId: input.contractId,
				workId: acceptanceContext.workId,
			},
		});
		if (input.status === "ACEITO" && currentStatus !== "ACEITO") {
			await measurementCoverageService.activateContractMeasurement(
				input.ownerId,
				acceptanceContext.workId,
				input.measurementId,
				{ userId: input.actorId },
				tx,
			);
		}
		if (
			(input.status === "RECUSADO" || input.status === "ARQUIVADO") &&
			currentStatus !== "ACEITO"
		) {
			await measurementCoverageService.discardPendingContractMeasurement(
				input.measurementId,
				tx,
			);
		}
	});

	return input.getMeasurement();
}
