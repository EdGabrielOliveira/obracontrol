const ALLOWED_WORK_ROUTE_SECTIONS = new Set([
	"actual-costs",
	"bi",
	"budget",
	"budget-versions",
	"contracts",
	"execution-view",
	"management",
	"measurements",
	"measurement-coverages",
	"overview",
	"schedule",
	"schedule-versions",
	"statistics",
	"work-measurements",
]);

const BLOCKED_WORK_ROUTE_SEGMENTS = new Set([
	"cost-centers",
	"contract-requests",
	"export",
	"gestores",
	"import",
	"import-batches",
	"imports",
	"quotation-templates",
	"quotations",
	"suppliers",
	"templates",
]);

const ALLOWED_ROOT_ROUTES = new Set([
	"/construction/bi/compare",
	"/construction/bi/multiworks",
]);

function isAllowedWorkRoute(pathname: string): boolean {
	const segments = pathname.split("/").filter(Boolean);
	if (segments[0] !== "construction" || segments[1] !== "works") {
		return false;
	}

	if (segments.length === 2 || segments.length === 3) return true;

	const section = segments[3];
	if (!section || !ALLOWED_WORK_ROUTE_SECTIONS.has(section)) return false;

	return !segments
		.slice(4)
		.some((segment) => BLOCKED_WORK_ROUTE_SEGMENTS.has(segment));
}

function isAllowedReportRoute(pathname: string): boolean {
	const segments = pathname.split("/").filter(Boolean);
	if (segments[0] !== "construction" || segments[1] !== "reports") {
		return false;
	}

	if (segments[2] !== "work" && segments[2] !== "contract") return false;
	if (segments.length === 4) return true;
	if (segments.length === 5 && segments[4] === "pdf") return true;
	return (
		segments[2] === "work" &&
		segments.length === 6 &&
		segments[4] === "management" &&
		segments[5] === "pdf"
	);
}

export function isTenantApiRouteAllowed(
	method: string,
	pathname: string,
): boolean {
	if (method.toUpperCase() !== "GET") return false;

	const normalizedPath = pathname.replace(/\/+$/, "") || "/";
	return (
		ALLOWED_ROOT_ROUTES.has(normalizedPath) ||
		isAllowedWorkRoute(normalizedPath) ||
		isAllowedReportRoute(normalizedPath)
	);
}
