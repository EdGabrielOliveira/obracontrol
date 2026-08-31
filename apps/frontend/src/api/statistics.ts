import { api } from "./api";

export type StatisticsPeriod = "daily" | "weekly" | "monthly";
export type WorkStatisticsResponse = {
	period: StatisticsPeriod;
	asOfDate: string;
	series: Array<{
		date: string;
		costs: number;
		measurements: number;
		contracts: number;
	}>;
	suppliers: Array<{ name: string; costs: number; contracts: number }>;
};

export async function getWorkStatistics(
	workId: string,
	period: StatisticsPeriod,
	asOfDate?: string,
) {
	const { data } = await api.get<WorkStatisticsResponse>(
		`/construction/works/${workId}/statistics`,
		{ params: { period, ...(asOfDate ? { asOfDate } : {}) } },
	);
	return data;
}
