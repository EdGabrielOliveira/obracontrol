import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { createAdminUser } from "@/api/admin-users";
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
import { useCreationConfirmation } from "@/components/providers/creation-confirmation-provider";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import type { AdminUserFormValues } from "@/schemas/admin-users";
import { adminUserFormSchema } from "@/schemas/admin-users";
import type { UserScopeInput } from "@/types/admin-users";
import type { Role } from "@/types/authorization";

export const Route = createFileRoute("/app/usuarios/new")({
	loader: () => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: ["admin-user-form-organizations"],
				queryFn: () => listOrganizations({ limit: 100 }),
			}),
			queryClient.prefetchQuery({
				queryKey: ["admin-user-form-cost-centers"],
				queryFn: () => listAllCostCenters({ limit: 100 }),
			}),
			queryClient.prefetchQuery({
				queryKey: ["admin-user-form-works"],
				queryFn: () => listWorks({ limit: 100 }),
			}),
			queryClient.prefetchQuery({
				queryKey: ["admin-user-form-companies"],
				queryFn: listCompanies,
			}),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Novo Usuário - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { capabilities } = useAuth();
	const { requestCreationConfirmation } = useCreationConfirmation();
	const form = useForm<AdminUserFormValues>({
		resolver: zodResolver(adminUserFormSchema),
		defaultValues: {
			name: "",
			email: "",
			password: "",
			role: "SUPERVISOR",
			organizationIds: [],
			costCenterIds: [],
			workIds: [],
		},
	});
	const [scope, setScope] = useState<UserScopeInput>({
		organizationIds: [],
		costCenterIds: [],
		workIds: [],
	});

	const organizationsQuery = useQuery({
		queryKey: ["admin-user-form-organizations"],
		queryFn: () => listOrganizations({ limit: 100 }),
	});
	const costCentersQuery = useQuery({
		queryKey: ["admin-user-form-cost-centers"],
		queryFn: () => listAllCostCenters({ limit: 100 }),
	});
	const worksQuery = useQuery({
		queryKey: ["admin-user-form-works"],
		queryFn: () => listWorks({ limit: 100 }),
	});
	const companiesQuery = useQuery({
		queryKey: ["admin-user-form-companies"],
		queryFn: listCompanies,
	});

	const mutation = useMutation({
		mutationFn: (nextScope?: UserScopeInput) => {
			const { name, email, password, role } = form.getValues();
			return createAdminUser({
				name,
				email,
				password,
				role: role as Role,
				scope: role === "ADMIN" ? undefined : (nextScope ?? scope),
			});
		},
		onSuccess: () => {
			toast.success("Usuário criado com sucesso!");
			queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
			navigate({ to: "/app/usuarios" });
		},
		onError: () => toast.error("Erro ao criar usuário."),
	});

	if (
		organizationsQuery.isLoading ||
		costCentersQuery.isLoading ||
		worksQuery.isLoading ||
		companiesQuery.isLoading
	) {
		return <LoadingSpinner title="Carregando opções de escopo..." />;
	}
	if (
		organizationsQuery.error ||
		costCentersQuery.error ||
		worksQuery.error ||
		companiesQuery.error
	) {
		return (
			<ErrorFeedback
				message="Não foi possível carregar as opções de escopo."
				onRetry={() => {
					void organizationsQuery.refetch();
					void costCentersQuery.refetch();
					void worksQuery.refetch();
					void companiesQuery.refetch();
				}}
			/>
		);
	}

	const handleSubmit = (nextScope?: UserScopeInput) => {
		const selectedScope = nextScope ?? scope;
		const values = form.getValues();
		const parsed = adminUserFormSchema.safeParse({
			name: values.name,
			email: values.email,
			password: values.password,
			role: values.role,
			organizationIds: selectedScope.organizationIds,
			costCenterIds: selectedScope.costCenterIds,
			workIds: selectedScope.workIds,
		});
		if (!parsed.success) {
			toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
			return;
		}
		if (
			!values.name.trim() ||
			!values.email.trim() ||
			values.password.length < 8
		) {
			toast.error(
				"Preencha nome, e-mail e uma senha com pelo menos 8 caracteres.",
			);
			return;
		}
		if (!values.role) {
			toast.error("Selecione o papel do usuário.");
			return;
		}
		requestCreationConfirmation(() => mutation.mutate(nextScope));
	};

	const organizations = organizationsQuery.data?.data ?? [];
	const costCenters = (costCentersQuery.data?.data ?? []).map((cc) => ({
		id: cc.id,
		organizationId: cc.organization?.id ?? "",
		name: cc.name,
	}));
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
	const companies = companiesQuery.data ?? [];

	if (!capabilities?.canManageUsers) {
		return <AccessDenied />;
	}

	return (
		<PageContainer>
			<PageHeader
				title="Novo Usuário"
				description="Crie um novo usuário no sistema."
			/>
			<div className="space-y-4">
				<Controller
					name="name"
					control={form.control}
					render={({ field, fieldState }) => (
						<InputFormField
							label="Nome"
							field={field}
							fieldState={fieldState}
							placeholder="Nome completo"
							required
						/>
					)}
				/>
				<Controller
					name="email"
					control={form.control}
					render={({ field, fieldState }) => (
						<InputFormField
							label="Email"
							field={field}
							fieldState={fieldState}
							type="email"
							placeholder="email@exemplo.com"
							required
						/>
					)}
				/>
				<Controller
					name="password"
					control={form.control}
					render={({ field, fieldState }) => (
						<InputFormField
							label="Senha"
							field={field}
							fieldState={fieldState}
							type="password"
							placeholder="Mínimo 6 caracteres"
							required
						/>
					)}
				/>
				<Controller
					name="role"
					control={form.control}
					render={({ field, fieldState }) => (
						<SelectFormField
							label="Papel global"
							field={field}
							fieldState={fieldState}
							placeholder="Selecione um papel"
							options={[
								{ id: "SUPERVISOR", value: "SUPERVISOR", label: "Supervisor" },
								{ id: "GESTOR", value: "GESTOR", label: "Gestor" },
								{ id: "GERENTE", value: "GERENTE", label: "Gerente" },
								{ id: "ADMIN", value: "ADMIN", label: "Administrador" },
							]}
						/>
					)}
				/>
			</div>

			{form.watch("role") && form.watch("role") !== "ADMIN" ? (
				<UserScopeForm
					isPending={mutation.isPending}
					organizations={organizations}
					costCenters={costCenters}
					companies={companies}
					works={works}
					initial={scope}
					onSubmit={setScope}
					onChange={setScope}
					showSubmit={false}
				/>
			) : null}
			<div className="flex gap-3 pt-4">
				<Button
					type="button"
					onClick={() => handleSubmit(scope)}
					loading={mutation.isPending}
				>
					Criar usuário
				</Button>
				<Button
					type="button"
					variant="outline"
					onClick={() => navigate({ to: "/app/usuarios" })}
				>
					Cancelar
				</Button>
			</div>
		</PageContainer>
	);
}
