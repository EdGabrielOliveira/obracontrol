import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	BookOpen,
	Check,
	ChevronDown,
	Code2,
	ExternalLink,
	KeyRound,
} from "lucide-react";
import { getApiDocumentation } from "@/api/documentation";
import { documentationKeys } from "@/api/query-keys";
import { ErrorFeedback } from "@/atoms/error-feedback";
import { LoadingSpinner } from "@/atoms/loading-spinner";
import { Container } from "@/components/atoms/Container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { queryClient } from "@/lib/query-client";
import type {
	ApiDocumentationGroup,
	ApiDocumentationNavigationGroup,
} from "@/utils/api-documentation";
import {
	buildCurlExample,
	createResponseExample,
	getDocumentationNavigation,
	getGetOperations,
	getGroupAnchor,
	getOperationAnchor,
	getOperationDescription,
	getOperationTitle,
	getParameterDescription,
	getResponseMediaType,
	getSuccessResponse,
	groupGetOperations,
} from "@/utils/api-documentation";

function DocumentationNavigationGroup({
	group,
	depth = 0,
}: {
	group: ApiDocumentationNavigationGroup | ApiDocumentationGroup;
	depth?: number;
}) {
	const children = "children" in group ? group.children : [];
	const operationCount =
		group.operations.length +
		children.reduce((total, child) => total + child.operations.length, 0);

	return (
		<details
			open
			className={depth === 0 ? "group/sidebar" : "group/subsidebar"}
		>
			<summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted [&::-webkit-details-marker]:hidden">
				<span className="min-w-0 truncate">{group.label}</span>
				<span className="flex items-center gap-1 text-xs text-muted-foreground">
					{operationCount}
					<ChevronDown
						className={`h-3.5 w-3.5 transition-transform ${depth === 0 ? "group-open/sidebar:rotate-180" : "group-open/subsidebar:rotate-180"}`}
					/>
				</span>
			</summary>
			<div className="ml-2 border-l pl-2">
				{group.operations.length > 0 && (
					<a
						href={`#${getGroupAnchor(group.key)}`}
						className="block truncate px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
					>
						{children.length > 0 ? "Rotas gerais" : "Todas as rotas"}
					</a>
				)}
				{group.operations.map(({ path, operation }) => (
					<a
						key={path}
						href={`#${getOperationAnchor(path)}`}
						title={getOperationTitle(path, operation)}
						className="block truncate px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
					>
						{getOperationTitle(path, operation)}
					</a>
				))}
				{children.map((child) => (
					<DocumentationNavigationGroup
						key={child.key}
						group={child}
						depth={depth + 1}
					/>
				))}
			</div>
		</details>
	);
}

export const Route = createFileRoute("/documentacao-api/")({
	loader: () => {
		void queryClient.prefetchQuery({
			queryKey: documentationKeys.all,
			queryFn: getApiDocumentation,
		}).catch(() => undefined);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Documentação da API - ObraControl" },
		],
	}),
});

function RouteComponent() {
	const { data, isLoading, error, refetch } = useQuery({
		queryKey: documentationKeys.all,
		queryFn: getApiDocumentation,
	});

	if (isLoading) return <LoadingSpinner title="Carregando documentação..." />;
	if (error || !data) {
		return (
			<Container>
				<div className="mx-auto max-w-5xl py-8">
					<ErrorFeedback
						message="Não foi possível carregar o contrato OpenAPI."
						onRetry={() => void refetch()}
					/>
				</div>
			</Container>
		);
	}

	const operations = getGetOperations(data);
	const groups = groupGetOperations(operations);
	const navigation = getDocumentationNavigation(operations);

	return (
		<div className="flex w-full flex-col min-w-full min-h-screen bg-muted/20">
			<header className="border-b bg-card w-full">
				<Container>
					<div className="flex items-center justify-between gap-4 py-5">
						<div className="flex min-w-0 items-center gap-3">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
								<BookOpen className="h-5 w-5" />
							</div>
							<div className="min-w-0">
								<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									ObraControl
								</p>
								<h1 className="truncate text-xl font-semibold">
									Documentação da API
								</h1>
							</div>
						</div>
						<a
							href="/app"
							className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-primary hover:underline"
						>
							Acessar painel <ExternalLink className="h-4 w-4" />
						</a>
					</div>
				</Container>
			</header>

			<Container>
				<main className="mx-auto grid max-w-7xl items-start gap-8 py-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
					<aside className="lg:sticky lg:top-6">
						<nav
							aria-label="Navegação da documentação"
							className="max-h-[calc(100vh-3rem)] overflow-auto rounded-xl border bg-card p-3 shadow-sm"
						>
							<p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Conteúdo
							</p>
							<a
								href="#documentacao-overview"
								className="mb-2 block rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
							>
								Visão geral
							</a>
							{navigation.map((group) => (
								<DocumentationNavigationGroup key={group.key} group={group} />
							))}
						</nav>
					</aside>

					<div className="min-w-0 space-y-8">
						<section id="documentacao-overview" className="scroll-mt-6">
							<p className="mb-2 text-sm font-medium text-primary">
								Integrações externas
							</p>
							<h2 className="text-3xl font-bold tracking-tight">
								Consulte os dados da sua operação
							</h2>
							<p className="mt-2 max-w-3xl text-muted-foreground">
								Use os exemplos abaixo para integrar sistemas externos ao
								ObraControl. Esta versão documenta as rotas de leitura
								disponíveis para chaves de API.
							</p>
						</section>

						<Alert className="border-primary/30 bg-primary/5">
							<KeyRound className="text-primary" />
							<AlertTitle>Autenticação</AlertTitle>
							<AlertDescription>
								Envie a chave criada no painel no header
								<code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
									Authorization: Bearer &lt;SUA_API_KEY&gt;
								</code>
								de cada requisição. O segredo da chave é exibido somente no
								momento da criação.
							</AlertDescription>
						</Alert>

						<div className="flex items-center justify-between gap-3">
							<div>
								<h2 className="text-xl font-semibold">Rotas de leitura</h2>
								<p className="text-sm text-muted-foreground">
									{operations.length}{" "}
									{operations.length === 1 ? "rota GET" : "rotas GET"}{" "}
									encontradas no OpenAPI em {groups.length}{" "}
									{groups.length === 1 ? "recurso" : "recursos"}.
								</p>
							</div>
							<Badge variant="secondary" className="gap-1.5">
								<Check className="h-3.5 w-3.5" /> Somente GET
							</Badge>
						</div>

						{operations.length === 0 ? (
							<Card>
								<CardContent className="py-10 text-center text-muted-foreground">
									Nenhuma rota GET foi encontrada no contrato OpenAPI.
								</CardContent>
							</Card>
						) : (
							<div className="flex flex-col space-y-8">
								{groups.map((group) => {
									const groupAnchor = getGroupAnchor(group.key);

									return (
										<section
											key={group.key}
											id={groupAnchor}
											className="scroll-mt-6"
										>
											<div className="mb-3 flex items-end justify-between gap-3">
												<div>
													<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
														Recurso
													</p>
													<h3 className="text-xl font-semibold">
														{group.label}
													</h3>
												</div>
												<Badge variant="outline">
													{group.operations.length}{" "}
													{group.operations.length === 1 ? "rota" : "rotas"}
												</Badge>
											</div>

											<div className="space-y-4">
												{group.operations.map(({ path, operation }) => {
													const successResponse = getSuccessResponse(operation);
													const responseExample = createResponseExample(
														getResponseMediaType(operation),
														data,
													);

													return (
														<details
															key={path}
															id={getOperationAnchor(path)}
															className="group scroll-mt-6 overflow-hidden rounded-xl border bg-card shadow-sm"
														>
															<summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
																<Badge className="bg-success text-white hover:bg-success/90">
																	GET
																</Badge>
																<div className="min-w-0 flex-1">
																	<p className="truncate text-sm font-semibold">
																		{getOperationTitle(path, operation)}
																	</p>
																	<code className="block truncate text-xs text-muted-foreground">
																		{path}
																	</code>
																</div>
																<ChevronDown
																	aria-hidden="true"
																	className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
																/>
															</summary>

															<div className="space-y-5 border-t px-5 py-5">
																<div className="space-y-2">
																	<div>
																		<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
																			Descrição da rota
																		</p>
																		<p className="text-sm text-muted-foreground">
																			{getOperationDescription(path, operation)}
																		</p>
																	</div>
																	{operation.tags?.length ? (
																		<div className="mt-3 flex flex-wrap gap-1.5">
																			{operation.tags.map((tag) => (
																				<Badge key={tag} variant="outline">
																					{tag}
																				</Badge>
																			))}
																		</div>
																	) : null}
																</div>

																<div className="grid gap-5 lg:grid-cols-2">
																	<div className="space-y-2">
																		<div className="flex items-center gap-2">
																			<Code2 className="h-4 w-4 text-primary" />
																			<h4 className="font-medium">
																				Como fazer a request
																			</h4>
																		</div>
																		<pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
																			<code>
																				{buildCurlExample(path, operation)}
																			</code>
																		</pre>
																	</div>

																	<div className="space-y-2">
																		<h4 className="font-medium">Parâmetros</h4>
																		{operation.parameters?.length ? (
																			<div className="divide-y rounded-lg border text-sm">
																				{operation.parameters.map(
																					(parameter) => (
																						<div
																							key={`${parameter.in}-${parameter.name}`}
																							className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_2fr]"
																						>
																							<code className="font-medium">
																								{parameter.name}
																							</code>
																							<span className="text-muted-foreground">
																								{getParameterDescription(
																									parameter,
																								)}
																							</span>
																						</div>
																					),
																				)}
																			</div>
																		) : (
																			<p className="rounded-lg border px-3 py-3 text-sm text-muted-foreground">
																				Esta rota não possui parâmetros.
																			</p>
																		)}
																	</div>
																</div>

																<div className="space-y-2">
																	<h4 className="font-medium">
																		Body da resposta (HTTP{" "}
																		{successResponse?.status ?? "200"})
																	</h4>
																	{successResponse && (
																		<p className="text-sm text-muted-foreground">
																			<Badge variant="outline" className="mr-2">
																				HTTP {successResponse.status}
																			</Badge>
																			{successResponse.description}
																		</p>
																	)}
																	{responseExample ? (
																		<pre className="max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
																			<code>{responseExample}</code>
																		</pre>
																	) : (
																		<p className="rounded-lg border px-3 py-3 text-sm text-muted-foreground">
																			O back-end ainda não publicou o schema ou
																			um exemplo para o body desta resposta.
																		</p>
																	)}
																</div>
															</div>
														</details>
													);
												})}
											</div>
										</section>
									);
								})}
							</div>
						)}

						<p className="text-center text-xs text-muted-foreground">
							A documentação é gerada a partir do contrato OpenAPI atual do
							back-end.
						</p>
					</div>
				</main>
			</Container>
		</div>
	);
}
