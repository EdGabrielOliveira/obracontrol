import { expect, test } from "bun:test";

async function readRouteFiles() {
	const files: string[] = [];
	for await (const file of new Bun.Glob("src/routes/**/*.tsx").scan({
		cwd: process.cwd(),
	})) {
		if (!file.endsWith("routeTree.gen.tsx")) files.push(file);
	}
	return Promise.all(
		files.map(async (file) => ({ file, source: await Bun.file(file).text() })),
	);
}

test("loaders de rota não bloqueiam a troca de tela", async () => {
	const routes = await readRouteFiles();
	const blockingLoaderPattern =
		/loader:\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*(?:Promise\.(?:all|allSettled)|\w+Client\.fetchQuery|\w+Client\.prefetchQuery)/s;

	for (const { file, source } of routes) {
		expect(source, `${file} não deve ter loader assíncrono bloqueante`).not.toMatch(
			/loader:\s*async\b/,
		);
		expect(source, `${file} não deve retornar uma Promise no loader`).not.toMatch(
			blockingLoaderPattern,
		);
	}
});
