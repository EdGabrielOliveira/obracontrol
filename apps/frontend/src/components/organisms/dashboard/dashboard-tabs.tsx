import { BarChart3, Building2, CircleDollarSign, HardHat } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardTab } from "@/types/dashboard";

interface DashboardTabsProps {
	activeTab: DashboardTab;
	onTabChange: (tab: DashboardTab) => void;
}

const tabs: Array<{
	value: DashboardTab;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}> = [
	{ value: "system", label: "Sistema", icon: BarChart3 },
	{ value: "organization", label: "Organização", icon: Building2 },
	{ value: "costCenter", label: "Centro de Custo", icon: CircleDollarSign },
	{ value: "work", label: "Obra", icon: HardHat },
];

export function DashboardTabs({ activeTab, onTabChange }: DashboardTabsProps) {
	return (
		<Tabs
			value={activeTab}
			onValueChange={(v) => onTabChange(v as DashboardTab)}
		>
			<TabsList>
				{tabs.map((tab) => (
					<TabsTrigger key={tab.value} value={tab.value} className="gap-2">
						<tab.icon className="h-4 w-4" />
						{tab.label}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
