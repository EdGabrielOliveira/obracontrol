import { spawnSync } from "node:child_process";
import { resolveTestDatabaseUrl } from "../../support/test-database-guard";

const E2E_TEST_FILES = [
	"./tests/e2e-db/import-export.dbtest.ts",
	"./tests/e2e-db/characterize-fundacao.dbtest.ts",
	"./tests/e2e-db/characterize-orcamento.dbtest.ts",
	"./tests/e2e-db/characterize-orcamento-valores.dbtest.ts",
	"./tests/e2e-db/characterize-aprovacoes.dbtest.ts",
	"./tests/e2e-db/characterize-med003.dbtest.ts",
	"./tests/e2e-db/flows.dbtest.ts",
	"./tests/e2e-db/permission-revision.dbtest.ts",
	"./tests/e2e-db/contract-requests.dbtest.ts",
	"./tests/e2e-db/audit-remediation-preflight.dbtest.ts",
	"./tests/e2e-db/users-scope-workids.dbtest.ts",
	"./tests/e2e-db/organizations-reports-scope.dbtest.ts",
	"./tests/e2e-db/scope-grant-inert.dbtest.ts",
	"./tests/e2e-db/governance-post-decision-notify.dbtest.ts",
	"./tests/e2e-db/governance-reversal.dbtest.ts",
	"./tests/e2e-db/contract-gateway.dbtest.ts",
];

const resolved = resolveTestDatabaseUrl();

if (!resolved.ok) {
	console.error(`Guard de banco de teste: ${resolved.reason}`);
	process.exit(1);
}

console.log(`Executando E2E no banco de teste: ${resolved.url}`);

let exitCode = 0;
const selectedFiles = process.env.E2E_ONLY
	? E2E_TEST_FILES.filter((file) =>
			file.includes(process.env.E2E_ONLY as string),
		)
	: E2E_TEST_FILES;
for (const file of selectedFiles) {
	console.log(`\n[E2E] ${file}`);
	const result = spawnSync(
		"bun",
		["test", "--parallel=1", "--timeout=30000", file],
		{
			env: { ...process.env, DATABASE_URL: resolved.url },
			stdio: "inherit",
		},
	);
	const status = result.status ?? 1;
	console.log(`[E2E] ${file} status=${status}`);
	if (status !== 0) exitCode = status;
}

process.exit(exitCode);
