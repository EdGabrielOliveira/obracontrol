export function safeRedirectPath(value: string | undefined) {
	if (!value?.startsWith("/") || value.startsWith("//")) return "/";
	if (value.includes("\\") || value.includes("@")) return "/";
	if (value.includes("..")) return "/";
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		if (code <= 31 || code === 127) return "/";
	}
	return value;
}
