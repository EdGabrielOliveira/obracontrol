import React, { useId } from "react";
import { type IMaskInputProps, IMaskMixin } from "react-imask";
import { Input } from "@/components/ui/input";

export type MaskedInputProps = Omit<
	React.ComponentProps<typeof Input>,
	"ref"
> & {
	mask?: IMaskInputProps<HTMLInputElement>["mask"];
};

export const INPUT_MASKS = {
	cpf: "000.000.000-00",
	cnpj: "00.000.000/0000-00",
	cep: "00000-000",
	phone: "(00) 0 0000-0000",
} as const;

type MaskedInputRenderProps = React.ComponentProps<typeof Input> & {
	inputRef: React.Ref<HTMLInputElement>;
	mask?: MaskedInputProps["mask"];
};

const MaskedInputMixed = IMaskMixin(
	({ inputRef, mask: _mask, ...props }: MaskedInputRenderProps) => (
		<Input {...props} ref={inputRef} />
	),
);

export const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
	function MaskedInputFn({ mask, ...props }, ref) {
		const id = useId();
		return <MaskedInputMixed id={id} inputRef={ref} mask={mask} {...props} />;
	},
);

MaskedInput.displayName = "MaskedInput";
