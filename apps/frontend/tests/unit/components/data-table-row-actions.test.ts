import { describe, expect, it, vi } from "bun:test";
import type { DropDownMenuActionItem } from "@/components/molecules/DropdownMenu/DropDownMenu";
import type { RowActionItem } from "@/components/atoms/data-table";

describe("DataTable rowActions", () => {
	it("RowActionItem is assignable to DropDownMenuActionItem", () => {
		const item: RowActionItem = {
			label: "Editar",
			icon: null,
			onClick: vi.fn(),
		};
		const menu: DropDownMenuActionItem = item;
		expect(menu.label).toBe("Editar");
	});

	it("RowActionItem supports variant field", () => {
		const item: RowActionItem = {
			label: "Excluir",
			icon: null,
			onClick: vi.fn(),
			variant: "destructive",
		};
		expect(item.variant).toBe("destructive");
	});

	it("RowActionItem variant defaults to undefined", () => {
		const item: RowActionItem = {
			label: "Ação",
			icon: null,
			onClick: vi.fn(),
		};
		expect(item.variant).toBeUndefined();
	});

	it("rowActions array accepts false, null, undefined alongside items", () => {
		const items: (RowActionItem | false | null | undefined)[] = [
			{ label: "Editar", icon: null, onClick: vi.fn() },
			false,
			null,
			undefined,
			{ label: "Excluir", icon: null, onClick: vi.fn(), variant: "destructive" },
		];
		expect(items.length).toBe(5);
	});

	it("RowActionItem onClick is callable", () => {
		const onClick = vi.fn();
		const item: RowActionItem = {
			label: "Ação",
			icon: null,
			onClick,
		};
		item.onClick();
		expect(onClick).toHaveBeenCalledOnce();
	});
});
