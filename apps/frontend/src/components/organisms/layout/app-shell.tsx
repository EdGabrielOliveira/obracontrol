import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
	ArrowLeft,
	Bell,
	Building,
	Building2,
	ChartPie,
	ClipboardList,
	DollarSign,
	FileText,
	FolderOpen,
	HardHat,
	Home,
	Landmark,
	LayoutDashboard,
	LogOut,
	Menu,
	ScrollText,
	Settings,
	ShieldCheck,
	Truck,
	Users,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getUnreadNotificationCount } from "@/api/notifications";
import { notificationKeys } from "@/api/query-keys";
import { ActionConfirmationModal } from "@/components/molecules/Modal/ActionConfirmationModal";
import { CreationConfirmationProvider } from "@/components/providers/creation-confirmation-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useResponsive } from "@/hooks/use-responsive";
import { signOut } from "@/lib/auth-client";
import { useAuth } from "@/lib/auth-context";
import { clearAuthSessionCache } from "@/lib/query-cache";
import { queryClient } from "@/lib/query-client";
import {
	type AuthorizationCapabilities,
	ROLE_LABELS,
} from "@/types/authorization";
import { SafeBoundary } from "./safe-boundary";

const WORK_PATH_REGEX = /^\/app\/obras\/([^/]+)/;
const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isInsideWorkPath(pathname: string) {
	const match = pathname.match(WORK_PATH_REGEX);
	return match ? UUID_REGEX.test(match[1]) : false;
}

interface NavItem {
	label: string;
	to: string;
	icon: React.ComponentType<{ className?: string }>;
	matches: (p: string) => boolean;
	search?: Record<string, string>;
	adminOnly?: boolean;
	visibleForRoles?: Array<"ADMIN" | "GERENTE" | "GESTOR" | "SUPERVISOR">;
	requiredCapability?: keyof AuthorizationCapabilities;
	badge?: number;
}

interface NavGroup {
	label: string;
	items: NavItem[];
}

function buildWorkContextNavGroups(pathname: string): NavGroup[] {
	const match = pathname.match(WORK_PATH_REGEX);
	if (!match) return [];
	const [, workId] = match;
	if (!UUID_REGEX.test(workId)) return [];
	const base = `/app/obras/${workId}` as const;

	return [
		{
			label: "Obra",
			items: [
				{
					label: "Visão Geral",
					to: base,
					icon: Home,
					matches: (p) => p === base,
				},
				{
					label: "Orçamento",
					to: `${base}/orcamento`,
					icon: FileText,
					matches: (p) => p.startsWith(`${base}/orcamento`),
				},
				{
					label: "Custos",
					to: `${base}/custos`,
					icon: DollarSign,
					matches: (p) => p.startsWith(`${base}/custos`),
				},
				{
					label: "Medições",
					to: `${base}/medicoes`,
					icon: ClipboardList,
					matches: (p) => p.startsWith(`${base}/medicoes`),
				},
				{
					label: "Contratos",
					to: `${base}/contratos`,
					icon: FolderOpen,
					matches: (p) => p.startsWith(`${base}/contratos`),
				},
				{
					label: "Estatísticas da obra",
					to: `${base}/estatisticas`,
					icon: LayoutDashboard,
					visibleForRoles: ["ADMIN", "GERENTE", "GESTOR"],
					matches: (p) => p.startsWith(`${base}/estatisticas`),
				},
			],
		},
		{
			label: "Gestão",
			items: [
				{
					label: "Histórico",
					to: `${base}/historico`,
					icon: ScrollText,
					visibleForRoles: ["ADMIN", "GERENTE"],
					matches: (p) => p.startsWith(`${base}/historico`),
				},
				{
					label: "Aprovações",
					to: `${base}/aprovacoes`,
					icon: ShieldCheck,
					visibleForRoles: ["ADMIN", "GERENTE"],
					matches: (p) => p.startsWith(`${base}/aprovacoes`),
				},
			],
		},
	];
}

export function buildNavGroups(): NavGroup[] {
	return [
		{
			label: "Principal",
			items: [
				{
					label: "Início",
					to: "/app",
					icon: Home,
					matches: (p: string) => p === "/app",
				},
				{
					label: "Notificações",
					to: "/app/notificacoes",
					icon: Bell,
					matches: (p: string) => p.startsWith("/app/notificacoes"),
				},
			],
		},
		{
			label: "Gestão",
			items: [
				{
					label: "Organizações",
					to: "/app/organizacoes",
					icon: Building2,
					matches: (p: string) => p.startsWith("/app/organizacoes"),
				},
				{
					label: "Centros de Custo",
					to: "/app/centros-de-custo",
					icon: Landmark,
					matches: (p: string) => p.startsWith("/app/centros-de-custo"),
				},
				{
					label: "Obras",
					to: "/app/obras",
					icon: HardHat,
					matches: (p: string) => p === "/app/obras" || p === "/app/obras/",
				},
				{
					label: "Estatísticas",
					to: "/app/dashboard",
					icon: ChartPie,
					visibleForRoles: ["ADMIN", "GERENTE", "GESTOR"],
					matches: (p: string) => p.startsWith("/app/dashboard"),
				},
			],
		},
		{
			label: "Administração",
			items: [
				{
					label: "Aprovações",
					to: "/app/aprovacoes",
					icon: ShieldCheck,
					visibleForRoles: ["ADMIN", "GERENTE", "GESTOR"],
					matches: (p: string) => p.startsWith("/app/aprovacoes"),
				},
				{
					label: "Empresas",
					to: "/app/empresas",
					icon: Building,
					matches: (p: string) => p.startsWith("/app/empresas"),
					requiredCapability: "canManageScopedCompanies",
				},
				{
					label: "Usuários",
					to: "/app/usuarios",
					icon: Users,
					matches: (p: string) => p.startsWith("/app/usuarios"),
					requiredCapability: "canManageUsers",
				},
				{
					label: "Fornecedores",
					to: "/app/fornecedores",
					icon: Truck,
					matches: (p: string) => p.startsWith("/app/fornecedores"),
				},
				{
					label: "Auditoria",
					to: "/app/auditoria",
					icon: ScrollText,
					matches: (p: string) => p.startsWith("/app/auditoria"),
					visibleForRoles: ["ADMIN", "GERENTE"],
				},
				{
					label: "Configurações",
					to: "/app/configuracoes",
					icon: Settings,
					matches: (p: string) => p.startsWith("/app/configuracoes"),
					adminOnly: true,
				},
			],
		},
	];
}

export function AppShell() {
	const [mobileOpen, setMobileOpen] = useState(false);
	const [logoutOpen, setLogoutOpen] = useState(false);
	const location = useLocation();
	const { user, capabilities, role } = useAuth();
	const { isMobile, isCollapsed } = useResponsive();
	const { data: notificationCount = 0 } = useQuery({
		queryKey: notificationKeys.count,
		queryFn: getUnreadNotificationCount,
		enabled: !!user,
		staleTime: 0,
		refetchOnMount: "always",
	});

	const isInsideWork = isInsideWorkPath(location.pathname);

	const isAdmin = role === "ADMIN";
	const roleLabel = role ? ROLE_LABELS[role] : null;

	const canShowItem = (item: NavItem) => {
		if (
			item.visibleForRoles &&
			!item.visibleForRoles.includes(
				role as "ADMIN" | "GERENTE" | "GESTOR" | "SUPERVISOR",
			)
		) {
			return false;
		}
		if (item.requiredCapability) {
			return capabilities?.[item.requiredCapability] ?? false;
		}
		if (item.adminOnly) {
			return isAdmin;
		}
		return true;
	};

	const navigationGroups = useMemo(() => {
		const groups = isInsideWork
			? buildWorkContextNavGroups(location.pathname)
			: buildNavGroups().filter((group) => group.label !== "Principal");

		return groups
			.map((group) => ({
				...group,
				items: group.items.filter(canShowItem),
			}))
			.filter((group) => group.items.length > 0);
	}, [location.pathname, isInsideWork, isAdmin, capabilities, role]);

	const globalNavigationGroups = useMemo(
		() =>
			buildNavGroups()
				.filter((group) => group.label === "Principal")
				.map((group) => ({
					...group,
					items: group.items
						.filter(canShowItem)
						.map((item) =>
							item.to === "/app/notificacoes"
								? { ...item, badge: notificationCount }
								: item,
						),
				}))
				.filter((group) => group.items.length > 0),
		[isAdmin, capabilities, role, notificationCount],
	);

	const initials = useMemo(() => {
		const name = user?.name || user?.email || "U";
		return name
			.split(" ")
			.map((w) => w[0])
			.slice(0, 2)
			.join("")
			.toUpperCase();
	}, [user]);

	const closeMobile = () => setMobileOpen(false);

	const logoutMutation = useMutation({
		mutationFn: async () => {
			const result = await signOut();
			if (result.error) {
				throw new Error(result.error.message ?? "Falha ao encerrar sessão");
			}
			queryClient.clear();
			clearAuthSessionCache(queryClient);
			closeMobile();
		},
		onSuccess: () => {
			window.location.replace("/auth/login");
		},
		onError: () => {
			toast.error("Não foi possível desconectar.");
		},
	});

	const renderNavItem = (item: NavItem) => {
		const active = item.matches(location.pathname);
		const Icon = item.icon;

		const linkContent = (
			<Link
				key={item.to}
				to={item.to}
				search={item.search}
				onClick={closeMobile}
				className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all ${
					isCollapsed ? "relative h-9 w-9 justify-center" : "h-9 px-3"
				} ${
					active
						? "bg-white/15 text-white border-l-2 border-white"
						: "text-white/70 hover:bg-white/10 hover:text-white"
				}`}
			>
				<Icon className="h-4 w-4 shrink-0" />
				{!isCollapsed && <span className="truncate">{item.label}</span>}
				{typeof item.badge === "number" && item.badge > 0 && (
					<span
						className={`rounded-full bg-destructive text-center py-0.5 h-4 w-4 text-xs font-semibold leading-none text-destructive-foreground ${
							isCollapsed ? "absolute -right-1 -top-1" : "ml-auto"
						}`}
					>
						{item.badge > 9 ? "9+" : item.badge}
					</span>
				)}
			</Link>
		);

		if (isCollapsed) {
			return (
				<Tooltip key={item.to}>
					<TooltipTrigger asChild>{linkContent}</TooltipTrigger>
					<TooltipContent side="right" sideOffset={8}>
						{item.label}
					</TooltipContent>
				</Tooltip>
			);
		}

		return linkContent;
	};

	const renderNavigationGroups = (groups: NavGroup[]) => (
		<nav className="space-y-5" aria-label="Navegação principal">
			{groups.map((group) => (
				<div key={group.label}>
					{!isCollapsed && (
						<p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-white/50">
							{group.label}
						</p>
					)}
					<div className="space-y-1">{group.items.map(renderNavItem)}</div>
				</div>
			))}
		</nav>
	);

	const sidebarNav = (
		<div className="flex min-h-0 flex-1 flex-col gap-4">
			<div className="shrink-0">
				{renderNavigationGroups(globalNavigationGroups)}
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto">
				{renderNavigationGroups(navigationGroups)}
			</div>
		</div>
	);

	const sidebarFooter = (
		<div className="space-y-3">
			{isInsideWork && (
				<div className="mb-3 border-b border-white/10 pb-3">
					{isCollapsed ? (
						<div className="flex justify-center">
							<Tooltip>
								<TooltipTrigger asChild>
									<Link
										to="/app/obras"
										onClick={closeMobile}
										className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition-all hover:bg-white/10 hover:text-white"
										aria-label="Voltar para obras"
									>
										<ArrowLeft className="h-4 w-4" />
									</Link>
								</TooltipTrigger>
								<TooltipContent side="right" sideOffset={8}>
									Voltar para obras
								</TooltipContent>
							</Tooltip>
						</div>
					) : (
						<Link
							to="/app/obras"
							onClick={closeMobile}
							className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
						>
							<ArrowLeft className="h-4 w-4 shrink-0" />
							<span className="truncate">Voltar para obras</span>
						</Link>
					)}
				</div>
			)}

			{isCollapsed ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="flex justify-center">
							<Avatar size="default">
								<AvatarFallback>{initials}</AvatarFallback>
							</Avatar>
						</div>
					</TooltipTrigger>
					<TooltipContent side="right" sideOffset={8}>
						<p className="font-medium">
							{user?.name || user?.email || "Usuário"}
						</p>
						{roleLabel && (
							<p className="text-xs text-muted-foreground">{roleLabel}</p>
						)}
					</TooltipContent>
				</Tooltip>
			) : (
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium text-white">
								{user?.name || user?.email || "Usuário"}
							</p>
							{roleLabel && (
								<p className="truncate text-xs text-white/60">{roleLabel}</p>
							)}
						</div>
					</div>
					<Button
						type="button"
						variant="destructive"
						size={"sm"}
						aria-label="Desconectar da conta"
						title="Desconectar da conta"
						className="w-min cursor-pointer justify-start text-white hover:bg-white/10 hover:text-white"
						onClick={() => setLogoutOpen(true)}
					>
						<LogOut />
					</Button>
				</div>
			)}

			{isCollapsed && (
				<div className="flex justify-center">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								aria-label="Desconectar da conta"
								title="Desconectar da conta"
								onClick={() => setLogoutOpen(true)}
							>
								<LogOut className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="right" sideOffset={8}>
							Desconectar
						</TooltipContent>
					</Tooltip>
				</div>
			)}

			<ActionConfirmationModal
				isOpen={logoutOpen}
				onClose={() => setLogoutOpen(false)}
				title="Sair da conta?"
				description="Você precisará entrar novamente para acessar o ObraControl."
				icon={LogOut}
				iconColor="warning"
				cancelLabel="Cancelar"
				confirmLabel="Sair"
				confirmVariant="destructive"
				confirmIsLoading={logoutMutation.isPending}
				onConfirm={() => logoutMutation.mutate()}
			/>
		</div>
	);

	const sidebarLogo = (
		<Link
			to="/app"
			className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}
		>
			<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
				<Building2 className="h-5 w-5" />
			</div>
			{!isCollapsed && (
				<div className="min-w-0">
					<p className="text-lg font-bold tracking-tight text-white">
						ObraControl
					</p>
					<p className="text-xs text-white/60">Gestão e BI de obras</p>
				</div>
			)}
		</Link>
	);

	const sidebar = (
		<aside
			className={`sidebar-accent fixed inset-y-0 left-0 z-50 flex flex-col px-3 py-4 text-white shadow-sm transition-all duration-200 ease-in-out ${
				isMobile
					? mobileOpen
						? "w-64 translate-x-0"
						: "w-64 -translate-x-full"
					: isCollapsed
						? "w-16"
						: "w-64"
			}`}
		>
			<div className={`mb-6 ${isCollapsed ? "flex justify-center" : "px-2"}`}>
				{sidebarLogo}
			</div>
			<div className="flex min-h-0 flex-1 flex-col">{sidebarNav}</div>
			<Separator className="my-3 bg-white/20" />
			{sidebarFooter}
		</aside>
	);

	const overlay = isMobile && mobileOpen && (
		<div
			className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-200"
			onClick={closeMobile}
			aria-hidden="true"
		/>
	);

	const mobileHeader = isMobile && (
		<header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-card/95 px-4 backdrop-blur">
			<Button
				type="button"
				variant="ghost"
				size="icon"
				onClick={() => setMobileOpen((o) => !o)}
				aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
			>
				{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
			</Button>
			<span className="ml-3 text-sm font-semibold text-card-foreground">
				ObraControl
			</span>
		</header>
	);

	const contentMargin = isMobile ? "" : isCollapsed ? "md:pl-16" : "lg:pl-64";

	return (
		<CreationConfirmationProvider>
			<TooltipProvider>
				<div className="min-h-screen bg-background text-foreground">
					{!isMobile && sidebar}
					{overlay}
					{isMobile && sidebar}

					<div
						className={`${contentMargin} min-w-0 max-w-full overflow-x-hidden`}
					>
						{mobileHeader}
						<main className="min-w-0">
							<SafeBoundary key={location.pathname}>
								<Outlet />
							</SafeBoundary>
						</main>
					</div>
				</div>
			</TooltipProvider>
		</CreationConfirmationProvider>
	);
}
