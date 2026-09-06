import { z } from "zod";

const idSchema = z.string().trim().min(1);
const reasonSchema = z.string().trim().min(3).max(1_000);
const emailSchema = z.string().trim().toLowerCase().email();

export const createOrganizationSchema = z.object({
	name: z.string().trim().min(3).max(200),
	adminEmail: emailSchema.optional().or(z.literal("")),
});

export const updateUserAccessSchema = z.object({
	userId: idSchema,
	action: z.enum(["ban", "unban", "make-admin", "make-user"]),
	reason: reasonSchema,
});

export const platformUsersQuerySchema = z
	.object({
		query: z.string().trim().max(200).optional(),
		limit: z.number().int().min(1).max(100).default(50),
		offset: z.number().int().nonnegative().default(0),
	})
	.default({});

export const platformOrganizationsQuerySchema = z
	.object({
		query: z.string().trim().max(200).optional(),
		limit: z.number().int().min(1).max(100).default(50),
		offset: z.number().int().nonnegative().default(0),
	})
	.default({});

export const resendUserVerificationSchema = z.object({
	userId: idSchema,
	reason: reasonSchema,
});

export const updatePlatformOrganizationSchema = z.object({
	organizationId: idSchema,
	name: z.string().trim().min(3).max(200),
	reason: reasonSchema,
});

export const setOrganizationOwnerSchema = z.object({
	organizationId: idSchema,
	email: emailSchema,
	reason: reasonSchema,
});

export const updateOrganizationLifecycleSchema = z.object({
	organizationId: idSchema,
	action: z.enum(["suspend", "reactivate", "archive", "restore"]),
	reason: reasonSchema,
});

export const revokeUserSessionsSchema = z.object({
	userId: idSchema,
	reason: reasonSchema,
});

export const platformAuditLogQuerySchema = z
	.object({
		action: z.string().trim().max(200).optional(),
		actor: z.string().trim().min(1).max(200).optional(),
		target: idSchema.optional(),
		from: z.number().int().nonnegative().optional(),
		to: z.number().int().nonnegative().optional(),
		limit: z.number().int().min(1).max(100).default(50),
		offset: z.number().int().nonnegative().default(0),
	})
	.refine((data) => !data.from || !data.to || data.from <= data.to, {
		message: "The start date must be before the end date.",
	})
	.default({});

export const updatePlatformSettingsSchema = z.object({
	platformName: z.string().trim().min(1).max(200),
	supportEmail: emailSchema,
	invitationExpiryHours: z.number().int().min(1).max(720),
	emailSenderName: z.string().trim().min(1).max(200),
	reason: reasonSchema,
});
