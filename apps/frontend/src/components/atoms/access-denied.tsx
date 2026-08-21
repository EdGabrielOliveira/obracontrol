import { ShieldX } from "lucide-react";
import { PageContainer } from "@/atoms/page-container";
import { PageHeader } from "@/components/atoms/page-header";

export function AccessDenied() {
	return (
		<PageContainer
			DesktopHeader={
				<PageHeader title="Sem permissão" description="Acesso restrito" />
			}
		>
			<div className="flex flex-col items-center gap-3 py-16 text-center">
				<ShieldX className="h-10 w-10 text-muted-foreground" />
				<p className="text-sm text-muted-foreground">
					Você não tem permissão para acessar esta área.
				</p>
			</div>
		</PageContainer>
	);
}
