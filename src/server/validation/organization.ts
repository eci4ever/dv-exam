import { z } from "zod";

const organizationIdSchema = z.string().trim().min(1);
const invitationIdSchema = z.string().trim().min(1);

export const setActiveOrganizationSchema = z.object({
	organizationId: organizationIdSchema,
});
export const inviteOrganizationMemberSchema = z.object({
	organizationId: organizationIdSchema,
	email: z.string().trim().toLowerCase().email(),
	role: z.enum(["admin", "member"]),
});
export const updateOrganizationMemberSchema = z.object({
	organizationId: organizationIdSchema,
	memberId: z.string().trim().min(1),
	role: z.enum(["admin", "member"]),
});
export const removeOrganizationMemberSchema = z.object({
	organizationId: organizationIdSchema,
	memberIdOrEmail: z.string().trim().min(1),
});
export const cancelOrganizationInvitationSchema = z.object({
	invitationId: invitationIdSchema,
});
export const respondToOrganizationInvitationSchema = z.object({
	invitationId: invitationIdSchema,
	response: z.enum(["accept", "reject"]),
});
export const updateOrganizationProfileSchema = z.object({
	organizationId: organizationIdSchema,
	name: z.string().trim().min(3).max(200),
});
