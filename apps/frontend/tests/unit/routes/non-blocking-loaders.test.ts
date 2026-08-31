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

	for (const { file, source } of routes) {
		expect(source, `${file} não deve ter loader assíncrono bloqueante`).not.toMatch(
			/loader:\s*async\b/,
		);
	}
});
