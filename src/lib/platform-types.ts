export type OrganizationStatus = "active" | "suspended";

export type AuditCategory =
	| "auth"
	| "user"
	| "organization"
	| "plan"
	| "system"
	| "security";

export interface PlatformPlan {
	id: string;
	name: string;
	slug: string;
	description: string;
	memberLimit: number;
	activeExamLimit: number;
	monthlyAttemptLimit: number;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface OrganizationEntitlement {
	organizationId: string;
	planId: string;
	status: OrganizationStatus;
	suspensionReason: string | null;
	suspendedAt: Date | null;
	suspendedBy: string | null;
	assignedAt: Date;
	assignedBy: string | null;
	updatedAt: Date;
}

export interface PlatformSettings {
	id: string;
	publicSignupEnabled: boolean;
	defaultPlanId: string;
	maintenanceEnabled: boolean;
	maintenanceMessage: string | null;
	updatedAt: Date;
	updatedBy: string | null;
}

export interface AuditEvent {
	id: string;
	category: AuditCategory;
	type: string;
	result: "success" | "failure";
	actorUserId: string | null;
	effectiveUserId: string | null;
	targetType: string | null;
	targetId: string | null;
	organizationId: string | null;
	sessionId: string | null;
	userAgent: string | null;
	metadata: Record<string, string | number | boolean | null> | null;
	createdAt: Date;
}
