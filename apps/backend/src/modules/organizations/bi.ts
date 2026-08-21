import { ConstructionError } from "../../lib/errors";
import {
	type MetricSourceResolver,
	metricSourceResolver,
} from "../construction-planning/bi/metric-source-resolver";
import { buildMultiworksAggregate } from "../construction-planning/bi/multiworks-aggregator";
import * as constructionRepository from "../construction-planning/repository";
import type { ConstructionBIWorksFilter } from "../construction-planning/schema";
import * as orgRepository from "./repository";

function applySelectionFilter<
	T extends { id: string; costCenterId?: string | null },
>(works: T[], filter?: ConstructionBIWorksFilter) {
	let filtered = works;
	if (filter?.costCenterIds?.length) {
		const costCenterIds = new Set(filter.costCenterIds);
		filtered = filtered.filter(
			(work) => work.costCenterId && costCenterIds.has(work.costCenterId),
		);
	}
	if (filter?.workIds?.length) {
		const workIds = new Set(filter.workIds);
		filtered = filtered.filter((work) => workIds.has(work.id));
	}
	return filtered;
}

export type OrgBIServiceDependencies = {
	getCostCenterById: typeof orgRepository.getCostCenterById;
	getOrganizationById: typeof orgRepository.getOrganizationById;
	getWorksByCostCenter: typeof constructionRepository.getWorksByCostCenter;
	getWorksByOrganization: typeof constructionRepository.getWorksByOrganization;
	getWorkMeasurementsForBI: typeof constructionRepository.getWorkMeasurementsForBI;
	getWorkMeasurementsForManyWorks: typeof constructionRepository.getWorkMeasurementsForManyWorks;
	resolver: MetricSourceResolver;
};

const defaultDependencies: OrgBIServiceDependencies = {
	getCostCenterById: orgRepository.getCostCenterById,
	getOrganizationById: orgRepository.getOrganizationById,
	getWorksByCostCenter: constructionRepository.getWorksByCostCenter,
	getWorksByOrganization: constructionRepository.getWorksByOrganization,
	getWorkMeasurementsForBI: constructionRepository.getWorkMeasurementsForBI,
	getWorkMeasurementsForManyWorks:
		constructionRepository.getWorkMeasurementsForManyWorks,
	resolver: metricSourceResolver,
};

export class OrgBIService {
	constructor(
		private readonly dependencies: OrgBIServiceDependencies = defaultDependencies,
	) {}

	async getCostCenterBI(
		ownerId: string,
		orgId: string,
		costCenterId: string,
		filter?: ConstructionBIWorksFilter,
		asOfDate?: Date,
	) {
		const cc = await this.dependencies.getCostCenterById(
			ownerId,
			orgId,
			costCenterId,
		);
		if (!cc) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Centro de custo nao encontrado",
				404,
			);
		}

		const works = await this.dependencies.getWorksByCostCenter(
			ownerId,
			costCenterId,
		);

		const selectedWorks = applySelectionFilter(works, filter);

		return buildMultiworksAggregate({
			ownerId,
			works: selectedWorks,
			asOfDate,
			deps: {
				getManualMeasurements: (owner, workId) =>
					this.dependencies.getWorkMeasurementsForBI(owner, workId),
				getManualMeasurementsForManyWorks: (owner, workIds) =>
					this.dependencies.getWorkMeasurementsForManyWorks(owner, workIds),
			},
		});
	}

	async getOrganizationBI(
		ownerId: string,
		orgId: string,
		filter?: ConstructionBIWorksFilter,
		asOfDate?: Date,
	) {
		const org = await this.dependencies.getOrganizationById(ownerId, orgId);
		if (!org) {
			throw new ConstructionError("NOT_FOUND", "Orgao nao encontrado", 404);
		}

		const works = await this.dependencies.getWorksByOrganization(
			ownerId,
			orgId,
		);

		const selectedWorks = applySelectionFilter(works, filter);

		return buildMultiworksAggregate({
			ownerId,
			works: selectedWorks,
			asOfDate,
			deps: {
				getManualMeasurements: (owner, workId) =>
					this.dependencies.getWorkMeasurementsForBI(owner, workId),
				getManualMeasurementsForManyWorks: (owner, workIds) =>
					this.dependencies.getWorkMeasurementsForManyWorks(owner, workIds),
			},
		});
	}
}

export const orgBIService = new OrgBIService();
