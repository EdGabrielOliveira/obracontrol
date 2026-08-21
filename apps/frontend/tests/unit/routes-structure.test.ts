import { expect, test } from "bun:test";

async function readFiles(pattern: string) {
	const files: string[] = [];
	for await (const file of new Bun.Glob(pattern).scan({ cwd: process.cwd() })) {
		files.push(file.replaceAll("\\", "/"));
	}
	return Promise.all(
		files.map(async (file) => ({ file, source: await Bun.file(file).text() })),
	);
}

test("telas mantêm metadata estrutural e estados de query", async () => {
	const routes = await readFiles("src/routes/**/*.tsx");
	const checkedRoutes = routes.filter(
		({ file }) => !file.endsWith("routeTree.gen.tsx"),
	);

	for (const { file, source } of checkedRoutes) {
		expect(source, `${file} deve declarar head`).toContain("head:");
		expect(source, `${file} deve declarar title`).toContain("title:");

		if (source.includes("useQuery(")) {
			expect(source, `${file} deve pré-carregar dados no loader`).toContain(
				"loader:",
			);
			expect(source, `${file} deve tratar loading`).toMatch(
				/isLoading|isPending/,
			);
			expect(source, `${file} deve tratar erro`).toMatch(/\berror\b|isError/);
		}
	}
});

test("organisms com useQuery expõem estados de loading e erro", async () => {
	const components = await readFiles("src/components/**/*.tsx");

	for (const { file, source } of components) {
		if (!source.includes("useQuery(")) continue;
		expect(source, `${file} deve tratar loading`).toMatch(
			/isLoading|isPending/,
		);
		expect(source, `${file} deve tratar erro`).toMatch(/\berror\b|isError/);
	}
});
