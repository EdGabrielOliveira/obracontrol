import { ClipboardCheck } from "lucide-react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useState,
} from "react";
import { ActionConfirmationModal } from "@/components/molecules/Modal/ActionConfirmationModal";
import { useAuth } from "@/lib/auth-context";

type CreationConfirmationContextValue = {
	requestCreationConfirmation: (action: () => void) => void;
};

const CreationConfirmationContext =
	createContext<CreationConfirmationContextValue | null>(null);

export function CreationConfirmationProvider({
	children,
}: {
	children: ReactNode;
}) {
	const { role } = useAuth();
	const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

	const requestCreationConfirmation = useCallback(
		(action: () => void) => {
			if (role !== "GESTOR" && role !== "SUPERVISOR") {
				action();
				return;
			}
			setPendingAction(() => action);
		},
		[role],
	);

	const close = () => setPendingAction(null);
	const confirm = () => {
		const action = pendingAction;
		setPendingAction(null);
		action?.();
	};

	return (
		<CreationConfirmationContext.Provider
			value={{ requestCreationConfirmation }}
		>
			{children}
			<ActionConfirmationModal
				isOpen={pendingAction !== null}
				onClose={close}
				title="Confirmar criação"
				description="Confirme os dados para continuar com esta criação."
				icon={ClipboardCheck}
				iconColor="warning"
				alert={{
					message:
						"Esta criação será enviada para avaliação e poderá ficar pendente até a aprovação responsável.",
					variant: "warning",
				}}
				confirmLabel="Confirmar e enviar"
				confirmVariant="warning"
				onConfirm={confirm}
			/>
		</CreationConfirmationContext.Provider>
	);
}

export function useCreationConfirmation() {
	const context = useContext(CreationConfirmationContext);
	if (!context) {
		throw new Error(
			"useCreationConfirmation must be used within CreationConfirmationProvider",
		);
	}
	return context;
}
