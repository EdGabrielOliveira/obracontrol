import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { userScopeSchema } from "@/schemas/admin-users";
import type { UserScopeInput } from "@/types/admin-users";

export const ROLE_LABELS: Record<string, string> = {
	ADMIN: "Administrador",
	GERENTE: "Gerente",
	GESTOR: "Gestor",
	SUPERVISOR: "Supervisor",
};

type OrganizationOption = {
	id: string;
	name: string;
	companyId?: string | null;
};
type CostCenterOption = { id: string; organizationId: string; name: string };
type CompanyOption = { id: string; name: string };
type WorkOption = {
	id: string;
	organizationId: string;
	costCenterId: string;
	name: string;
};

type UserScopeFormProps = {
	isPending?: boolean;
	submitLabel?: string;
	organizations: OrganizationOption[];
	costCenters: CostCenterOption[];
	companies?: CompanyOption[];
	works?: WorkOption[];
	initial?: UserScopeInput;
	onSubmit: (scope: UserScopeInput) => void;
	onChange?: (scope: UserScopeInput) => void;
	showSubmit?: boolean;
};

export function UserScopeForm({
	isPending = false,
	submitLabel = "Salvar escopo",
	organizations,
	costCenters,
	companies = [],
	works = [],
	initial = { organizationIds: [], costCenterIds: [], workIds: [] },
	onSubmit,
	onChange,
	showSubmit = true,
}: UserScopeFormProps) {
	const [organizationIds, setOrganizationIds] = useState<string[]>(
		initial.organizationIds,
	);
	const [costCenterIds, setCostCenterIds] = useState<string[]>(
		initial.costCenterIds,
	);
	const [workIds, setWorkIds] = useState<string[]>(initial.workIds);
	const [companyIds, setCompanyIds] = useState<string[]>([]);

	const centersByOrg = useMemo(() => {
		const map = new Map<string, CostCenterOption[]>();
		for (const cc of costCenters) {
			const list = map.get(cc.organizationId) ?? [];
			list.push(cc);
			map.set(cc.organizationId, list);
		}
		return map;
	}, [costCenters]);

	const toggleId = (
		list: string[],
		setList: (next: string[]) => void,
		id: string,
	) => {
		setList(
			list.includes(id) ? list.filter((item) => item !== id) : [...list, id],
		);
	};

	const scope = useMemo(
		() => ({ organizationIds, costCenterIds, workIds }),
		[organizationIds, costCenterIds, workIds],
	);

	useEffect(() => {
		onChange?.(scope);
	}, [onChange, scope]);

	const handleSubmit = () => {
		const parsed = userScopeSchema.safeParse({
			organizationIds,
			costCenterIds,
			workIds,
		});
		if (!parsed.success) return;
		onSubmit(parsed.data);
	};

	const toggleCompany = (companyId: string) => {
		const isSelected = companyIds.includes(companyId);
		const companyOrgIds = organizations
			.filter((org) => org.companyId === companyId)
			.map((org) => org.id);
		const nextOrganizationIds = isSelected
			? organizationIds.filter((id) => !companyOrgIds.includes(id))
			: [...new Set([...organizationIds, ...companyOrgIds])];
		setCompanyIds(
			isSelected
				? companyIds.filter((id) => id !== companyId)
				: [...companyIds, companyId],
		);
		setOrganizationIds(nextOrganizationIds);
		setCostCenterIds((current) =>
			current.filter((id) =>
				costCenters.some(
					(cc) =>
						cc.id === id && nextOrganizationIds.includes(cc.organizationId),
				),
			),
		);
		setWorkIds((current) =>
			current.filter((id) =>
				works.some(
					(work) =>
						work.id === id && nextOrganizationIds.includes(work.organizationId),
				),
			),
		);
	};

	return (
		<div className="space-y-5">
			{companies.length > 0 && (
				<div className="space-y-2">
					<Label>Empresas</Label>
					<p className="text-sm text-muted-foreground">
						Ao selecionar uma empresa, suas organizações são vinculadas ao
						usuário.
					</p>
					<div className="grid gap-2 sm:grid-cols-2">
						{companies.map((company) => (
							<div
								key={company.id}
								className="flex items-center gap-2 rounded-md border border-border p-3 text-sm"
							>
								<Checkbox
									aria-label={`Vincular empresa ${company.name}`}
									checked={companyIds.includes(company.id)}
									onCheckedChange={() => toggleCompany(company.id)}
								/>
								{company.name}
							</div>
						))}
					</div>
				</div>
			)}
			<div className="space-y-2">
				<Label>Organizações</Label>
				{organizations.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Nenhuma organização disponível no seu escopo.
					</p>
				) : (
					<div className="grid gap-2 sm:grid-cols-2">
						{organizations.map((org) => (
							<div
								key={org.id}
								className="flex items-center gap-2 rounded-md border border-border p-3 text-sm"
							>
								<Checkbox
									aria-label={`Vincular ${org.name}`}
									checked={organizationIds.includes(org.id)}
									onCheckedChange={() =>
										toggleId(organizationIds, setOrganizationIds, org.id)
									}
								/>
								{org.name}
							</div>
						))}
					</div>
				)}
			</div>

			<div className="space-y-2">
				<Label>Centros de custo (obrigatórios para Gestor/Supervisor)</Label>
				{organizationIds.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Selecione ao menos uma organização para escolher centros.
					</p>
				) : (
					organizationIds.flatMap((orgId) => {
						const centers = centersByOrg.get(orgId) ?? [];
						if (centers.length === 0) return [];
						return [
							<div key={orgId} className="space-y-1">
								<p className="text-xs font-medium text-muted-foreground">
									{organizations.find((org) => org.id === orgId)?.name ?? orgId}
								</p>
								<div className="grid gap-2 sm:grid-cols-2">
									{centers.map((cc) => (
										<div
											key={cc.id}
											className="flex items-center gap-2 rounded-md border border-border p-3 text-sm"
										>
											<Checkbox
												aria-label={`Vincular centro ${cc.name}`}
												checked={costCenterIds.includes(cc.id)}
												onCheckedChange={() =>
													toggleId(costCenterIds, setCostCenterIds, cc.id)
												}
											/>
											{cc.name}
										</div>
									))}
								</div>
							</div>,
						];
					})
				)}
			</div>

			<div className="space-y-2">
				<Label>Obras</Label>
				{organizationIds.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Selecione ao menos uma organização para escolher obras.
					</p>
				) : (
					<div className="grid gap-2 sm:grid-cols-2">
						{works
							.filter((work) => organizationIds.includes(work.organizationId))
							.map((work) => (
								<div
									key={work.id}
									className="flex items-center gap-2 rounded-md border border-border p-3 text-sm"
								>
									<Checkbox
										aria-label={`Vincular obra ${work.name}`}
										checked={workIds.includes(work.id)}
										onCheckedChange={() =>
											toggleId(workIds, setWorkIds, work.id)
										}
									/>
									{work.name}
								</div>
							))}
					</div>
				)}
			</div>

			{showSubmit && (
				<Button type="button" onClick={handleSubmit} loading={isPending}>
					{submitLabel}
				</Button>
			)}
		</div>
	);
}
