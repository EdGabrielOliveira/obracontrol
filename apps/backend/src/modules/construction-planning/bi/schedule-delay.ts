export type ScheduleDelayAlert = {
	delayed: boolean;
	spi: number | null;
	scheduleVariance: number | null;
	daysBehind: number | null;
	reason: string | null;
};

export function detectScheduleDelay(input: {
	spi: number | null | undefined;
	scheduleVariance: number | null | undefined;
	plannedEnd: Date | null | undefined;
	dataDate: Date | null | undefined;
}): ScheduleDelayAlert {
	const { spi, scheduleVariance, plannedEnd, dataDate } = input;

	const spiDelayed =
		spi !== null && spi !== undefined && Number.isFinite(spi) && spi < 1;

	const varianceDelayed =
		scheduleVariance !== null &&
		scheduleVariance !== undefined &&
		Number.isFinite(scheduleVariance) &&
		scheduleVariance < 0;

	let daysBehind: number | null = null;
	if (plannedEnd && dataDate && !Number.isNaN(plannedEnd.getTime())) {
		const ms = dataDate.getTime() - plannedEnd.getTime();
		if (ms > 0) daysBehind = Math.ceil(ms / 86_400_000);
	}

	const delayed = Boolean(spiDelayed || varianceDelayed || daysBehind);
	const reason = delayed
		? spiDelayed
			? "SPI abaixo de 1 indica cronograma atrasado"
			: varianceDelayed
				? "Valor agregado (EV) abaixo do planejado (PV)"
				: "Data de corte passou do fim planejado"
		: null;

	return {
		delayed,
		spi: spi ?? null,
		scheduleVariance: scheduleVariance ?? null,
		daysBehind,
		reason,
	};
}
