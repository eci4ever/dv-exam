export type PlatformUser = {
	id: string;
	name: string;
	email: string;
	role: string | null;
	banned: number | null;
	emailVerified: number | boolean;
	createdAt: number;
};
export type PlatformOrganization = {
	id: string;
	name: string;
	slug: string;
	status: string;
	memberCount: number;
	ownerName: string | null;
	ownerEmail: string | null;
	createdAt: number;
	archivedAt: number | null;
};
export type PlatformAuditRecord = {
	id: string;
	action: string;
	outcome: string;
	actorName: string;
	actorEmail: string;
	targetType: string;
	targetId: string | null;
	reason: string;
	metadata: string | null;
	createdAt: number;
};
export type PlatformUserPage = { users: PlatformUser[]; hasMore: boolean };
export type PlatformOrganizationPage = {
	organizations: PlatformOrganization[];
	hasMore: boolean;
};
export type PlatformAuditPage = {
	records: PlatformAuditRecord[];
	hasMore: boolean;
};
