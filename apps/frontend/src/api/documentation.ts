import type { OpenApiDocument } from "@/types/api-documentation";
import { api } from "./api";

export async function getApiDocumentation() {
	const { data } = await api.get<OpenApiDocument>("/openapi/json");
	return data;
}
