import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
	getAdminUser,
	replaceAdminUserScope,
	updateAdminUser,
} from "@/api/admin-users";
import { listCompanies } from "@/api/companies";
import { listAllCostCenters, listOrganizations } from "@/api/organizations";
import { adminUserKeys } from "@/api/query-keys";
import { listWorks } from "@/api/works";
import { AccessDenied } from "@/atoms/access-denied";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import {
	InputFormField,
	SelectFormField,
} from "@/components/molecules/FormField";
import { UserScopeForm } from "@/components/organisms/users/user-membership-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { requireAuthorizationCapability } from "@/lib/route-authorization";
import type { UserScopeInput } from "@/types/admin-users";
import type { Role } from "@/types/authorization";
import { ROLE_LABELS } from "@/types/authorization";

export const Route = createFileRoute("/app/usuarios/$userId/edit")({
	beforeLoad: () => requireAuthorizationCapability("canManageUsers"),
	loader: ({ params }) => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: adminUserKeys.detail(params.userId),
				queryFn: () => getAdminUser(params.userId),
			}),
			queryClient.prefetchQuery({
				queryKey: ["admin-user-edit-organizations"],
				queryFn: () => listOrganizations({ limit: 100 }),
			}),
			queryClient.prefetchQuery({
				queryKey: ["admin-user-edit-cost-centers"],
				queryFn: () => listAllCostCenters({ limit: 100 }),
			}),
			queryClient.prefetchQuery({
				queryKey: ["admin-user-edit-works"],
				queryFn: () => listWorks({ limit: 100 }),
			}),
			queryClient.prefetchQuery({
				queryKey: ["admin-user-edit-companies"],
				queryFn: listCompanies,
			}),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Editar - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { userId } = useParams({ from: "/app/usuarios/$userId/edit" });
	const { capabilities, authorization, loading } = useAuth();
	const queryClient = useQueryClient();
	const userQuery = useQuery({
		queryKey: adminUserKeys.detail(userId),
		queryFn: () => getAdminUser(userId),
	});
	const form = useForm<{ name: string; role: Role }>({
		defaultValues: { name: "", role: "SUPERVISOR" },
	});
	useEffect(() => {
		if (userQuery.data) {
			form.reset({
				name: userQuery.data.name,
				role: userQuery.data.role as Role,
			});
		}
	}, [userQuery.data]);
	const profileMutation = useMutation({
		mutationFn: () => {
			const { name, role } = form.getValues();
			return updateAdminUser(userId, { name: name.trim(), role });
		},
		onSuccess: () => {
			toast.success("Dados do usuário atualizados.");
			queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
			queryClient.invalidateQueries({ queryKey: adminUserKeys.detail(userId) });
		},
		onError: () => toast.error("Erro ao atualizar os dados do usuário."),
	});
	const saveScopeMutation = useMutation({
		mutationFn: (scope: UserScopeInput) => replaceAdminUserScope(userId, scope),
		onSuccess: () => {
			toast.success("Escopo atualizado.");
			queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
			queryClient.invalidateQueries({ queryKey: adminUserKeys.detail(userId) });
		},
		onError: () => toast.error("Erro ao atualizar o escopo."),
	});
	const organizationsQuery = useQuery({
		queryKey: ["admin-user-edit-organizations"],
		queryFn: () => listOrganizations({ limit: 100 }),
	});
	const costCentersQuery = useQuery({
		queryKey: ["admin-user-edit-cost-centers"],
		queryFn: () => listAllCostCenters({ limit: 100 }),
	});
	const worksQuery = useQuery({
		queryKey: ["admin-user-edit-works"],
		queryFn: () => listWorks({ limit: 100 }),
	});
	const companiesQuery = useQuery({
		queryKey: ["admin-user-edit-companies"],
		queryFn: listCompanies,
	});

	if (loading) return <LoadingSpinner title="Carregando autorização..." />;
	if (!capabilities?.canManageUsers) return <AccessDenied />;
	if (userQuery.isLoading)
		return <LoadingSpinner title="Carregando usuário..." />;
	if (userQuery.error || !userQuery.data) return <ErrorFeedback />;

	const user = userQuery.data;
	const organizations =
		organizationsQuery.data?.data ?? authorization?.organizations ?? [];
	const costCenters =
		costCentersQuery.data?.data.map((item) => ({
			id: item.id,
			organizationId: item.organization?.id ?? "",
			name: item.name,
		})) ??
		authorization?.costCenters ??
		[];
	const works = (worksQuery.data?.data ?? []).flatMap((work) =>
		work.organizationId && work.costCenterId
			? [
					{
						id: work.id,
						name: work.name,
						organizationId: work.organizationId,
						costCenterId: work.costCenterId,
					},
				]
			: [],
	);
	const initialScope = {
		companyIds: user.companyMemberships
			.filter((item) => !item.revokedAt)
			.map((item) => item.companyId),
		organizationIds: user.organizationMemberships
			.filter((item) => !item.revokedAt)
			.map((item) => item.organizationId),
		costCenterIds: user.costCenterMemberships
			.filter((item) => !item.revokedAt)
			.map((item) => item.costCenterId),
		workIds: user.workMemberships
			.filter((item) => !item.revokedAt)
			.map((item) => item.workId),
	};

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Administração"
				title={`Editar: ${user.name}`}
				description={user.email}
				actions={
					<Link to="/app/usuarios/$userId" params={{ userId }}>
						<Button variant="outline">Cancelar</Button>
					</Link>
				}
			/>
			<div className="mb-6 flex items-center gap-3">
				<Badge variant="secondary">
					{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}
				</Badge>
				<Badge variant={user.emailVerified ? "default" : "secondary"}>
					{user.emailVerified ? "E-mail verificado" : "E-mail não verificado"}
				</Badge>
			</div>
			<div className="mb-6 grid gap-4 md:grid-cols-2">
				<Controller
					name="name"
					control={form.control}
					render={({ field, fieldState }) => (
						<InputFormField
							label="Nome"
							field={field}
							fieldState={fieldState}
						/>
					)}
				/>
				<Controller
					name="role"
					control={form.control}
					render={({ field, fieldState }) => (
						<SelectFormField
							label="Papel"
							field={field}
							fieldState={fieldState}
							placeholder="Selecione um papel"
							options={[
								{ id: "ADMIN", value: "ADMIN", label: "ADMIN" },
								{ id: "GERENTE", value: "GERENTE", label: "GERENTE" },
								{ id: "GESTOR", value: "GESTOR", label: "GESTOR" },
								{ id: "SUPERVISOR", value: "SUPERVISOR", label: "SUPERVISOR" },
							]}
						/>
					)}
				/>
			</div>
			<div className="mb-6 flex justify-end">
				<Button
					disabled={profileMutation.isPending || !form.watch("name").trim()}
					onClick={() => profileMutation.mutate()}
				>
					Salvar dados
				</Button>
			</div>
			<UserScopeForm
				role={form.watch("role")}
				isPending={saveScopeMutation.isPending}
				submitLabel="Salvar escopo"
				organizations={organizations}
				costCenters={costCenters}
				companies={companiesQuery.data ?? []}
				works={works}
				initial={initialScope}
				onSubmit={(scope) => saveScopeMutation.mutate(scope)}
			/>
		</PageContainer>
	);
}
