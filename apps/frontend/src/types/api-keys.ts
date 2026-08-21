export type ApiKey = {
	id: string;
	keyPrefix: string;
	name: string;
	lastUsedAt: string | null;
	expiresAt: string | null;
	createdAt: string;
	organizationId?: string | null;
};

export type CreateApiKeyResponse = {
	id: string;
	name: string;
	key: string;
	expiresAt: string | null;
	organizationId?: string | null;
};
