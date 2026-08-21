import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { CardHeaderWithIcon } from "@/components/molecules/card-header-with-icon";
import type { DataQualityIssue } from "@/types/bi";

const severityLabel: Record<DataQualityIssue["severity"], string> = {
	HIGH: "Alta",
	MEDIUM: "Média",
	LOW: "Baixa",
};

export function DataQualityIssues({ issues }: { issues?: DataQualityIssue[] }) {
	if (!issues || issues.length === 0) return null;

	return (
		<section
			aria-label="Qualidade dos dados"
			className="status-warning rounded-xl py-3 pb-0"
		>
			<CardHeaderWithIcon
				icon={AlertTriangle}
				title={`Qualidade dos dados (${issues.length})`}
				description="Itens que precisam de atenção"
			/>
			<ul className="mt-2 flex flex-col gap-2 px-6 pb-4 text-xs text-warning">
				{issues.map((issue) => (
					<li
						key={`${issue.workId ?? "portfolio"}-${issue.code}-${issue.metric ?? "general"}`}
					>
						<strong>{severityLabel[issue.severity]}:</strong> {issue.message}
						{issue.suggestedAction && (
							<span className="ml-1 text-warning">
								Ação: {issue.suggestedAction}
							</span>
						)}
						{issue.workId && (
							<Link
								to="/app/obras/$workId"
								params={{ workId: issue.workId }}
								className="link-navigation ml-1 font-medium"
							>
								Abrir obra
							</Link>
						)}
					</li>
				))}
			</ul>
		</section>
	);
}
