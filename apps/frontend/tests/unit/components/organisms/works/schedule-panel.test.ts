import { describe, expect, it } from "bun:test";
import { isReplanningEligible } from "@/components/organisms/works/schedule-panel";

describe("isReplanningEligible", () => {
	const referenceDate = new Date("2026-08-06T12:00:00Z");

	it("permite somente atividade atrasada e ainda não concluída", () => {
		expect(
			isReplanningEligible(
				{ plannedEnd: "2026-08-01", completionPercentage: 0.75 },
				referenceDate,
			),
		).toBe(true);
	});

	it("oculta replanejamento para atividade futura ou concluída", () => {
		expect(
			isReplanningEligible(
				{ plannedEnd: "2026-08-07", completionPercentage: 0.75 },
				referenceDate,
			),
		).toBe(false);
		expect(
			isReplanningEligible(
				{ plannedEnd: "2026-08-01", completionPercentage: 1 },
				referenceDate,
			),
		).toBe(false);
	});
});
