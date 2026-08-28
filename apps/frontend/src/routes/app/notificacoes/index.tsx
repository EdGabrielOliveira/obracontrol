import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, CircleAlert, Inbox, X } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryClient } from "@/lib/query-client";
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

function notificationLabel(notification: NotificationView) {
	return (
		notificationEventLabels[notification.eventType] ??
		(notification.title.split(":")[0] || "Notificação do sistema")
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
	return Number.isNaN(date.getTime())
		? "Data indisponível"
		: date.toLocaleString("pt-BR");
}

function NotificationsList({
	notifications,
	onOpen,
	onRead,
	onDismiss,
}: {
	notifications: NotificationView[];
	onOpen: (notification: NotificationView) => void;
	onRead: (id: string) => void;
	onDismiss: (id: string) => void;
}) {
	return (
		<div className="space-y-3">
			{notifications.map((notification) => (
				<Card key={notification.id}>
					<CardContent className="flex items-start justify-between gap-4 py-4">
						<button
							type="button"
							className="min-w-0 flex-1 text-left"
							onClick={() => onOpen(notification)}
						>
							<div className="flex items-center gap-2">
								{notification.status === "PENDING" && (
									<CircleAlert className="h-4 w-4 text-warning" />
								)}
								<p className="font-medium">{notificationLabel(notification)}</p>
							</div>
							<p className="mt-1 text-sm text-muted-foreground">
								{notificationDescription(notification)}
							</p>
							<p className="mt-2 text-xs text-muted-foreground">
								{notificationDate(notification.createdAt)}
							</p>
							<span className="mt-2 inline-block text-xs font-medium text-primary">
								Abrir notificação
							</span>
						</button>
						<div className="flex gap-2">
							{notification.status === "PENDING" && (
								<Button
									size="icon"
									variant="ghost"
									aria-label="Marcar como lida"
									onClick={() => onRead(notification.id)}
								>
									<Check className="h-4 w-4" />
								</Button>
							)}
							<Button
								size="icon"
								variant="ghost"
								aria-label="Descartar"
								onClick={() => onDismiss(notification.id)}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					</CardContent>
				</Card>
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
						<Card>
							<CardHeaderWithIcon
								icon={Inbox}
								title="Não lidas"
								description={`${pendingQuery.data?.total ?? 0} notificação(ões) pendente(s)`}
							/>
							<CardContent>
								<NotificationsList
									notifications={pendingQuery.data?.data ?? []}
									{...actions}
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
						<Card>
							<CardHeaderWithIcon
								icon={Check}
								title="Lidas"
								description={`${readQuery.data?.total ?? 0} notificação(ões) lida(s)`}
							/>
							<CardContent>
								<NotificationsList
									notifications={readQuery.data?.data ?? []}
									{...actions}
								/>
							</CardContent>
						</Card>
					)}
				</TabsContent>
			</Tabs>
		</PageContainer>
	);
}
