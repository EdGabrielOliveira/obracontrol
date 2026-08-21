import "@tanstack/react-table";

declare module "@tanstack/react-table" {
	interface ColumnMeta<TData, TValue> {
		mobileLabel?: string;
		hideOnMobile?: boolean;
		className?: string;
	}
}
