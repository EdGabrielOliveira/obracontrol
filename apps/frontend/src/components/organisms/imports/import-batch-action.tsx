import { type ComponentProps, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ConstructionTemplateKind } from "@/types/import";
import { ImportBatchModal } from "./import-batch-modal";

interface ImportBatchActionProps {
	workId: string;
	model: ConstructionTemplateKind;
	children: ReactNode;
	buttonProps?: Omit<ComponentProps<typeof Button>, "onClick" | "children">;
}

export function ImportBatchAction({
	workId,
	model,
	children,
	buttonProps,
}: ImportBatchActionProps) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Button {...buttonProps} onClick={() => setOpen(true)}>
				{children}
			</Button>
			<ImportBatchModal
				open={open}
				onOpenChange={setOpen}
				workId={workId}
				model={model}
			/>
		</>
	);
}
