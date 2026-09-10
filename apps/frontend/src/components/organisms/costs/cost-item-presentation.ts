import type { BadgeTone } from "@/components/ui/badge";

export function categoryTone(category: string): BadgeTone {
	if (category === "MATERIAL") return "info";
	if (category === "MAO_DE_OBRA" || category === "LABOR") return "success";
	if (category === "EQUIPAMENTO" || category === "EQUIPMENT") return "warning";
	return "neutral";
}

export function costTypeTone(costType: string): BadgeTone {
	return costType === "FUTURE" ? "warning" : "success";
}

export function paymentStatusTone(paymentStatus: string): BadgeTone {
	return paymentStatus === "PAID" ? "success" : "warning";
}
