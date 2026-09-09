import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowUpRight,
	BadgeAlert,
	Bell,
	Check,
	ClipboardCheck,
	FileCheck2,
	Inbox,
	ReceiptText,
	X,
} from "lucide-react";
import type { ComponentType } from "react";
import { toast } from "sonner";
import {
	dismissNotification,
	listNotifications,
	markNotificationRead,
} from "@/api/notifications";
import { notificationKeys } from "@/api/query-keys";
import { EmptyState } from "@/atoms/empty-state";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { PageContainer } from "@/components/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import type { NotificationView } from "@/types/notifications";

export const Route = createFileRoute("/app/notificacoes/")({
	loader: () => {
		void Promise.all([
			queryClient.prefetchQuery({
				queryKey: notificationKeys.list("PENDING"),
				queryFn: () => listNotifications("PENDING"),
			}),
			queryClient.prefetchQuery({
				queryKey: notificationKeys.list("READ"),
				queryFn: () => listNotifications("READ"),
			}),
		]);
	},
	component: NotificationsPage,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Notificações - ObraControl" },
		],
	}),
});

const notificationEventLabels: Record<string, string> = {
	COST_APPROVE: "Aprovação de custo",
	MEASUREMENT_APPROVE: "Aprovação de medição",
	CONTRACT_APPROVE: "Aprovação de contrato",
	APPROVAL_REQUESTED: "Nova aprovação necessária",
	APPROVAL_DECISION_REQUIRED: "Aprovação necessária",
	APPROVAL_MANAGER_REVIEW_REQUIRED: "Revisão gerencial necessária",
	CONTRACT_AMENDMENT_APPROVAL_REQUIRED: "Aditivo aguardando aprovação",
};

const notificationEventIcons: Record<
	string,
	ComponentType<{ className?: string }>
> = {
	APPROVAL_REQUESTED: ClipboardCheck,
	APPROVAL_DECISION_REQUIRED: ClipboardCheck,
	APPROVAL_MANAGER_REVIEW_REQUIRED: ClipboardCheck,
	CONTRACT_AMENDMENT_APPROVAL_REQUIRED: FileCheck2,
	COST_APPROVE: ReceiptText,
	MEASUREMENT_APPROVE: ReceiptText,
};

function notificationHeadline(notification: NotificationView) {
	return (
		notificationEventLabels[notification.eventType] ??
		(notification.title.trim() || "Notificação do sistema")
	);
}

function notificationDescription(notification: NotificationView) {
	const body = notification.body?.trim();
	if (!body || /^[A-Z_]+:[0-9a-f-]{20,}$/i.test(body)) {
		return "Há uma ação disponível para sua análise.";
	}
	return body;
}

function notificationDate(createdAt: string) {
	const date = new Date(createdAt);
	if (Number.isNaN(date.getTime())) return "Data indisponível";

	const now = new Date();
	const isToday = date.toDateString() === now.toDateString();
	return isToday
		? `Hoje, às ${date.toLocaleTimeString("pt-BR", {
				hour: "2-digit",
				minute: "2-digit",
			})}`
		: date.toLocaleDateString("pt-BR", {
				day: "2-digit",
				month: "short",
				year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
			});
}

function NotificationsList({
	notifications,
	onOpen,
	onRead,
	onDismiss,
	isUpdating,
}: {
	notifications: NotificationView[];
	onOpen: (notification: NotificationView) => void;
	onRead: (id: string) => void;
	onDismiss: (id: string) => void;
	isUpdating: boolean;
}) {
	return (
		<div className="divide-y divide-border">
			{notifications.map((notification) => (
				<article
					key={notification.id}
					className={cn(
						"group border-l-2 px-4 py-3 transition-colors hover:bg-primary/[0.025] sm:px-5 sm:py-3.5",
						notification.status === "PENDING"
							? "border-l-primary"
							: "border-l-transparent",
					)}
				>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<button
							type="button"
							className="group/notification min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							onClick={() => onOpen(notification)}
							aria-label={`Abrir notificação: ${notificationHeadline(notification)}`}
						>
							<div className="flex items-start gap-3">
								<div
									className={cn(
										"mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary",
									)}
									aria-hidden="true"
								>
									{(() => {
										const Icon =
											notificationEventIcons[notification.eventType] ??
											(notification.status === "PENDING" ? BadgeAlert : Bell);
										return <Icon className="h-4 w-4" />;
									})()}
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<h3 className="text-sm font-semibold leading-5 text-foreground transition-colors group-hover/notification:text-primary">
											{notificationHeadline(notification)}
										</h3>
										{notification.status === "PENDING" && (
											<Badge variant="tag" tone="warning">
												<span
													className="h-1.5 w-1.5 rounded-full bg-warning"
													aria-hidden="true"
												/>
												Não lida
											</Badge>
										)}
									</div>
									<div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
										<time
											dateTime={notification.createdAt}
											title={new Date(notification.createdAt).toLocaleString(
												"pt-BR",
											)}
										>
											{notificationDate(notification.createdAt)}
										</time>
									</div>
									<p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
										{notificationDescription(notification)}
									</p>
									<span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary">
										Ver detalhes
										<ArrowUpRight className="h-3 w-3 transition-transform group-hover/notification:translate-x-0.5 group-hover/notification:-translate-y-0.5" />
									</span>
								</div>
							</div>
						</button>
						<div className="flex shrink-0 items-center justify-end gap-0.5 border-t pt-2 sm:border-t-0 sm:pt-0">
							{notification.status === "PENDING" && (
								<Button
									size="icon-sm"
									variant="ghost"
									aria-label="Marcar como lida"
									title="Marcar como lida"
									disabled={isUpdating}
									onClick={() => onRead(notification.id)}
								>
									<Check className="h-4 w-4" />
								</Button>
							)}
							<Button
								size="icon-sm"
								variant="ghost"
								aria-label="Descartar"
								title="Descartar notificação"
								disabled={isUpdating}
								onClick={() => onDismiss(notification.id)}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</article>
			))}
		</div>
	);
}

function NotificationsPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const pendingQuery = useQuery({
		queryKey: notificationKeys.list("PENDING"),
		queryFn: () => listNotifications("PENDING"),
	});
	const readQuery = useQuery({
		queryKey: notificationKeys.list("READ"),
		queryFn: () => listNotifications("READ"),
	});
	const mutation = useMutation({
		mutationFn: ({ id, action }: { id: string; action: "read" | "dismiss" }) =>
			action === "read" ? markNotificationRead(id) : dismissNotification(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: notificationKeys.all });
			queryClient.invalidateQueries({ queryKey: notificationKeys.count });
		},
		onError: () => toast.error("Não foi possível atualizar a notificação."),
	});
	if (pendingQuery.isLoading || readQuery.isLoading) {
		return <LoadingSpinner title="Carregando notificações..." />;
	}
	if (pendingQuery.error || readQuery.error) {
		return (
			<ErrorFeedback
				onRetry={() => {
					void pendingQuery.refetch();
					void readQuery.refetch();
				}}
			/>
		);
	}
	const openNotification = async (notification: NotificationView) => {
		if (notification.status === "PENDING") {
			await markNotificationRead(notification.id);
			queryClient.invalidateQueries({ queryKey: notificationKeys.all });
			queryClient.invalidateQueries({ queryKey: notificationKeys.count });
		}
		const detailPath = notification.body?.match(
			/\/app\/obras\/[^\s]+\/contratos\/[^\s]+/,
		)?.[0];
		if (detailPath) {
			navigate({ to: detailPath as never });
			return;
		}
		const workPath = notification.body?.match(/\/app\/obras\/([^\s/]+)/)?.[0];
		if (workPath) {
			navigate({
				to: "/app/obras/$workId",
				params: { workId: workPath.split("/")[3] ?? "" },
			});
		} else if (
			notification.eventType.startsWith("APPROVAL") ||
			notification.eventType.includes("APPROVE")
		) {
			navigate({ to: "/app/aprovacoes" });
		}
	};
	const actions = {
		onOpen: (notification: NotificationView) =>
			void openNotification(notification),
		onRead: (id: string) => mutation.mutate({ id, action: "read" }),
		onDismiss: (id: string) => mutation.mutate({ id, action: "dismiss" }),
	};

	return (
		<PageContainer>
			<PageHeader
				eyebrow="Sistema"
				title="Notificações"
				description="Acompanhe pendências e eventos relevantes do sistema."
			/>
			<Tabs defaultValue="pending" className="space-y-4">
				<TabsList>
					<TabsTrigger value="pending">
						Não lidas ({pendingQuery.data?.total ?? 0})
					</TabsTrigger>
					<TabsTrigger value="read">
						Lidas ({readQuery.data?.total ?? 0})
					</TabsTrigger>
				</TabsList>
				<TabsContent value="pending">
					{pendingQuery.data?.data.length === 0 ? (
						<EmptyState
							icon={<Inbox className="h-10 w-10" />}
							title="Nenhuma notificação pendente"
							description="Notificações de aprovações e eventos aparecerão aqui."
						/>
					) : (
						<Card className="gap-0 overflow-hidden py-0">
							<CardHeaderWithIcon
								icon={Inbox}
								title="Não lidas"
								description={`${pendingQuery.data?.total ?? 0} notificação(ões) pendente(s)`}
								className="border-b px-4 py-4 sm:px-6"
							/>
							<CardContent className="p-0">
								<NotificationsList
									notifications={pendingQuery.data?.data ?? []}
									{...actions}
									isUpdating={mutation.isPending}
								/>
							</CardContent>
						</Card>
					)}
				</TabsContent>
				<TabsContent value="read">
					{readQuery.data?.data.length === 0 ? (
						<EmptyState
							icon={<Check className="h-10 w-10" />}
							title="Nenhuma notificação lida"
							description="Notificações marcadas como lidas aparecerão aqui."
						/>
					) : (
						<Card className="gap-0 overflow-hidden py-0">
							<CardHeaderWithIcon
								icon={Check}
								title="Lidas"
								description={`${readQuery.data?.total ?? 0} notificação(ões) lida(s)`}
								className="border-b px-4 py-4 sm:px-6"
							/>
							<CardContent className="p-0">
								<NotificationsList
									notifications={readQuery.data?.data ?? []}
									{...actions}
									isUpdating={mutation.isPending}
								/>
							</CardContent>
						</Card>
					)}
				</TabsContent>
			</Tabs>
		</PageContainer>
	);
}
