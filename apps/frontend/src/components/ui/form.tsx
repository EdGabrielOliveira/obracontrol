import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const Form = React.forwardRef<
	HTMLFormElement,
	React.FormHTMLAttributes<HTMLFormElement>
>(({ className, ...props }, ref) => {
	return <form ref={ref} className={cn("space-y-6", className)} {...props} />;
});
Form.displayName = "Form";

interface FormFieldContextValue {
	name: string;
	id: string;
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(
	null,
);

const useFormField = () => {
	const fieldContext = React.useContext(FormFieldContext);
	if (!fieldContext) {
		throw new Error("useFormField should be used within <FormField>");
	}
	return fieldContext;
};

interface FormFieldProps {
	name: string;
	children: React.ReactNode;
}

const FormField = ({ name, children }: FormFieldProps) => {
	const id = React.useId();
	const value = React.useMemo(() => ({ name, id }), [name, id]);

	return (
		<FormFieldContext.Provider value={value}>
			<div className="space-y-2">{children}</div>
		</FormFieldContext.Provider>
	);
};

const FormItem = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
	return <div ref={ref} className={cn("space-y-2", className)} {...props} />;
});
FormItem.displayName = "FormItem";

const FormLabel = React.forwardRef<
	HTMLLabelElement,
	React.ComponentPropsWithoutRef<typeof Label>
>(({ className, ...props }, ref) => {
	const { id } = useFormField();

	return (
		<Label
			ref={ref}
			className={cn(
				"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
				className,
			)}
			htmlFor={id}
			{...props}
		/>
	);
});
FormLabel.displayName = "FormLabel";

const FormControl = React.forwardRef<
	HTMLElement,
	React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
	const { id } = useFormField();

	return <Slot ref={ref} id={id} {...props} />;
});
FormControl.displayName = "FormControl";

const FormDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
	return (
		<p
			ref={ref}
			className={cn("text-xs text-muted-foreground", className)}
			{...props}
		/>
	);
});
FormDescription.displayName = "FormDescription";

const FormMessage = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement> & { error?: string }
>(({ className, children, error, ...props }, ref) => {
	const body = error || children;

	if (!body) {
		return null;
	}

	return (
		<p
			ref={ref}
			className={cn("text-xs font-medium text-destructive", className)}
			{...props}
		>
			{body}
		</p>
	);
});
FormMessage.displayName = "FormMessage";

export {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	useFormField,
};
