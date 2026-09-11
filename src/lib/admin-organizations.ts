import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import {
	and,
	asc,
	count,
	countDistinct,
	desc,
	eq,
	isNull,
	like,
	ne,
	or,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth";

const organizationSortFields = [
	"name",
	"owner",
	"memberCount",
	"createdAt",
] as const;
const memberRoles = ["admin", "teacher", "student"] as const;

export type OrganizationSortField = (typeof organizationSortFields)[number];
export type OrganizationMemberRole = (typeof memberRoles)[number];

export interface AdminOrganizationListInput {
	search?: string;
	page?: number;
	pageSize?: number;
	sortBy?: OrganizationSortField;
	sortDirection?: "asc" | "desc";
}

export interface AdminOrganizationInput {
	organizationId: string;
}

export interface UpdateAdminOrganizationInput extends AdminOrganizationInput {
	name: string;
	slug: string;
}

export interface SearchAvailableOrganizationUsersInput
	extends AdminOrganizationInput {
	search: string;
}

export interface AddAdminOrganizationMemberInput
	extends AdminOrganizationInput {
	userId: string;
	role: OrganizationMemberRole;
}

export interface UpdateAdminOrganizationMemberRoleInput
	extends AdminOrganizationInput {
	memberId: string;
	role: OrganizationMemberRole;
}

export interface AdminOrganizationMemberInput extends AdminOrganizationInput {
	memberId: string;
}

export interface DeleteAdminOrganizationInput extends AdminOrganizationInput {
	confirmationName: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function requiredString(
	value: unknown,
	field: string,
	options?: { min?: number; max?: number },
) {
	if (typeof value !== "string") {
		throw new Error(`${field} is required.`);
	}

	const normalized = value.trim();
	if (normalized.length < (options?.min ?? 1)) {
		throw new Error(`${field} is too short.`);
	}
	if (options?.max && normalized.length > options.max) {
		throw new Error(`${field} is too long.`);
	}

	return normalized;
}

function validateOrganizationIdInput(value: unknown): AdminOrganizationInput {
	if (!isObject(value)) throw new Error("Invalid organization request.");
	return {
		organizationId: requiredString(value.organizationId, "Organization"),
	};
}

function validateListInput(
	value: unknown,
): Required<AdminOrganizationListInput> {
	const input = isObject(value) ? value : {};
	const search =
		typeof input.search === "string" ? input.search.trim().slice(0, 100) : "";
	const page =
		typeof input.page === "number" && Number.isInteger(input.page)
			? Math.max(1, input.page)
			: 1;
	const pageSize =
		typeof input.pageSize === "number" && Number.isInteger(input.pageSize)
			? Math.min(100, Math.max(1, input.pageSize))
			: 25;
	const sortBy = organizationSortFields.includes(
		input.sortBy as OrganizationSortField,
	)
		? (input.sortBy as OrganizationSortField)
		: "createdAt";
	const sortDirection = input.sortDirection === "asc" ? "asc" : "desc";

	return { search, page, pageSize, sortBy, sortDirection };
}

function validateUpdateInput(value: unknown): UpdateAdminOrganizationInput {
	const organization = validateOrganizationIdInput(value);
	if (!isObject(value)) throw new Error("Invalid organization request.");

	const name = requiredString(value.name, "Organization name", {
		min: 2,
		max: 80,
	});
	const slug = requiredString(value.slug, "Organization slug", {
		min: 2,
		max: 64,
	});

	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
		throw new Error(
			"Organization slug can only contain lowercase letters, numbers, and single hyphens.",
		);
	}

	return { ...organization, name, slug };
}

function validateSearchUsersInput(
	value: unknown,
): SearchAvailableOrganizationUsersInput {
	const organization = validateOrganizationIdInput(value);
	if (!isObject(value)) throw new Error("Invalid member search request.");
	const search = requiredString(value.search, "Search", { min: 2, max: 100 });
	return { ...organization, search };
}

function validateMemberRole(value: unknown): OrganizationMemberRole {
	if (
		typeof value !== "string" ||
		!memberRoles.includes(value as OrganizationMemberRole)
	) {
		throw new Error("Select a valid organization role.");
	}
	return value as OrganizationMemberRole;
}

function validateAddMemberInput(
	value: unknown,
): AddAdminOrganizationMemberInput {
	const organization = validateOrganizationIdInput(value);
	if (!isObject(value)) throw new Error("Invalid member request.");
	return {
		...organization,
		userId: requiredString(value.userId, "User"),
		role: validateMemberRole(value.role),
	};
}

function validateUpdateMemberRoleInput(
	value: unknown,
): UpdateAdminOrganizationMemberRoleInput {
	const organization = validateOrganizationIdInput(value);
	if (!isObject(value)) throw new Error("Invalid member request.");
	return {
		...organization,
		memberId: requiredString(value.memberId, "Member"),
		role: validateMemberRole(value.role),
	};
}

function validateMemberInput(value: unknown): AdminOrganizationMemberInput {
	const organization = validateOrganizationIdInput(value);
	if (!isObject(value)) throw new Error("Invalid member request.");
	return {
		...organization,
		memberId: requiredString(value.memberId, "Member"),
	};
}

function validateDeleteInput(value: unknown): DeleteAdminOrganizationInput {
	const organization = validateOrganizationIdInput(value);
	if (!isObject(value)) throw new Error("Invalid organization request.");
	return {
		...organization,
		confirmationName: requiredString(value.confirmationName, "Confirmation"),
	};
}

async function requirePlatformAdmin() {
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({ headers });

	if (!session?.user.role?.split(",").includes("admin")) {
		throw new Error("Administrator access is required.");
	}

	return session;
}

async function organizationExists(organizationId: string) {
	const [organization] = await db
		.select({ id: schema.organization.id })
		.from(schema.organization)
		.where(eq(schema.organization.id, organizationId))
		.limit(1);

	if (!organization) throw new Error("Organization not found.");
}

async function getOrganizationDetails(organizationId: string) {
	const [organization] = await db
		.select({
			id: schema.organization.id,
			name: schema.organization.name,
			slug: schema.organization.slug,
			logo: schema.organization.logo,
			createdAt: schema.organization.createdAt,
		})
		.from(schema.organization)
		.where(eq(schema.organization.id, organizationId))
		.limit(1);

	if (!organization) throw new Error("Organization not found.");

	const members = await db
		.select({
			id: schema.member.id,
			userId: schema.user.id,
			name: schema.user.name,
			email: schema.user.email,
			image: schema.user.image,
			role: schema.member.role,
			createdAt: schema.member.createdAt,
		})
		.from(schema.member)
		.innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
		.where(eq(schema.member.organizationId, organizationId))
		.orderBy(asc(schema.member.createdAt));

	members.sort((first, second) => {
		const firstOwner = first.role.split(",").includes("owner");
		const secondOwner = second.role.split(",").includes("owner");
		if (firstOwner !== secondOwner) return firstOwner ? -1 : 1;
		return first.name.localeCompare(second.name);
	});

	return {
		organization,
		members,
		owner:
			members.find((member) => member.role.split(",").includes("owner")) ??
			null,
	};
}

export const listAdminOrganizations = createServerFn({ method: "GET" })
	.validator(validateListInput)
	.handler(async ({ data }) => {
		await requirePlatformAdmin();

		const ownerMember = alias(schema.member, "ownerMember");
		const ownerUser = alias(schema.user, "ownerUser");
		const organizationMember = alias(schema.member, "organizationMember");
		const memberCount = count(organizationMember.id);
		const searchPattern = `%${data.search}%`;
		const searchCondition = data.search
			? or(
					like(schema.organization.name, searchPattern),
					like(schema.organization.slug, searchPattern),
					like(ownerUser.name, searchPattern),
					like(ownerUser.email, searchPattern),
				)
			: undefined;

		const orderColumn =
			data.sortBy === "name"
				? schema.organization.name
				: data.sortBy === "owner"
					? ownerUser.name
					: data.sortBy === "memberCount"
						? memberCount
						: schema.organization.createdAt;
		const orderDirection = data.sortDirection === "asc" ? asc : desc;

		const baseRows = db
			.select({
				id: schema.organization.id,
				name: schema.organization.name,
				slug: schema.organization.slug,
				logo: schema.organization.logo,
				createdAt: schema.organization.createdAt,
				ownerId: ownerUser.id,
				ownerName: ownerUser.name,
				ownerEmail: ownerUser.email,
				memberCount,
			})
			.from(schema.organization)
			.leftJoin(
				ownerMember,
				and(
					eq(ownerMember.organizationId, schema.organization.id),
					eq(ownerMember.role, "owner"),
				),
			)
			.leftJoin(ownerUser, eq(ownerUser.id, ownerMember.userId))
			.leftJoin(
				organizationMember,
				eq(organizationMember.organizationId, schema.organization.id),
			)
			.where(searchCondition)
			.groupBy(
				schema.organization.id,
				ownerUser.id,
				ownerUser.name,
				ownerUser.email,
			)
			.orderBy(orderDirection(orderColumn))
			.limit(data.pageSize)
			.offset((data.page - 1) * data.pageSize);

		const [organizations, totalRows] = await Promise.all([
			baseRows,
			db
				.select({ count: countDistinct(schema.organization.id) })
				.from(schema.organization)
				.leftJoin(
					ownerMember,
					and(
						eq(ownerMember.organizationId, schema.organization.id),
						eq(ownerMember.role, "owner"),
					),
				)
				.leftJoin(ownerUser, eq(ownerUser.id, ownerMember.userId))
				.where(searchCondition),
		]);
		const total = totalRows[0]?.count ?? 0;

		return {
			organizations,
			total,
			page: data.page,
			pageSize: data.pageSize,
			pageCount: Math.max(1, Math.ceil(total / data.pageSize)),
		};
	});

export const getAdminOrganization = createServerFn({ method: "GET" })
	.validator(validateOrganizationIdInput)
	.handler(async ({ data }) => {
		await requirePlatformAdmin();
		return getOrganizationDetails(data.organizationId);
	});

export const updateAdminOrganization = createServerFn({ method: "POST" })
	.validator(validateUpdateInput)
	.handler(async ({ data }) => {
		await requirePlatformAdmin();
		await organizationExists(data.organizationId);

		const duplicate = await db
			.select({ id: schema.organization.id })
			.from(schema.organization)
			.where(
				and(
					eq(schema.organization.slug, data.slug),
					ne(schema.organization.id, data.organizationId),
				),
			)
			.limit(1);

		if (duplicate.length) {
			throw new Error("This organization slug is already in use.");
		}

		await db
			.update(schema.organization)
			.set({ name: data.name, slug: data.slug })
			.where(eq(schema.organization.id, data.organizationId));

		return getOrganizationDetails(data.organizationId);
	});

export const searchAvailableOrganizationUsers = createServerFn({
	method: "GET",
})
	.validator(validateSearchUsersInput)
	.handler(async ({ data }) => {
		await requirePlatformAdmin();
		await organizationExists(data.organizationId);

		const existingMember = alias(schema.member, "existingMember");
		const searchPattern = `%${data.search}%`;

		return db
			.select({
				id: schema.user.id,
				name: schema.user.name,
				email: schema.user.email,
				image: schema.user.image,
			})
			.from(schema.user)
			.leftJoin(
				existingMember,
				and(
					eq(existingMember.userId, schema.user.id),
					eq(existingMember.organizationId, data.organizationId),
				),
			)
			.where(
				and(
					isNull(existingMember.id),
					or(isNull(schema.user.banned), eq(schema.user.banned, false)),
					or(
						like(schema.user.name, searchPattern),
						like(schema.user.email, searchPattern),
					),
				),
			)
			.orderBy(asc(schema.user.name))
			.limit(10);
	});

export const addAdminOrganizationMember = createServerFn({ method: "POST" })
	.validator(validateAddMemberInput)
	.handler(async ({ data }) => {
		await requirePlatformAdmin();
		await organizationExists(data.organizationId);

		const [existingUser] = await db
			.select({ id: schema.user.id, banned: schema.user.banned })
			.from(schema.user)
			.where(eq(schema.user.id, data.userId))
			.limit(1);

		if (!existingUser || existingUser.banned) {
			throw new Error("This user is not available.");
		}

		const [existingMember] = await db
			.select({ id: schema.member.id })
			.from(schema.member)
			.where(
				and(
					eq(schema.member.organizationId, data.organizationId),
					eq(schema.member.userId, data.userId),
				),
			)
			.limit(1);

		if (existingMember) {
			throw new Error("This user is already an organization member.");
		}

		await auth.api.addMember({
			body: {
				organizationId: data.organizationId,
				role: data.role,
				userId: data.userId,
			},
		});

		return getOrganizationDetails(data.organizationId);
	});

export const updateAdminOrganizationMemberRole = createServerFn({
	method: "POST",
})
	.validator(validateUpdateMemberRoleInput)
	.handler(async ({ data }) => {
		await requirePlatformAdmin();
		await organizationExists(data.organizationId);

		const [existingMember] = await db
			.select({ id: schema.member.id, role: schema.member.role })
			.from(schema.member)
			.where(
				and(
					eq(schema.member.id, data.memberId),
					eq(schema.member.organizationId, data.organizationId),
				),
			)
			.limit(1);

		if (!existingMember) throw new Error("Organization member not found.");
		if (existingMember.role.split(",").includes("owner")) {
			throw new Error("Transfer ownership before changing the owner's role.");
		}

		await db
			.update(schema.member)
			.set({ role: data.role })
			.where(eq(schema.member.id, data.memberId));

		return getOrganizationDetails(data.organizationId);
	});

export const transferAdminOrganizationOwnership = createServerFn({
	method: "POST",
})
	.validator(validateMemberInput)
	.handler(async ({ data }) => {
		await requirePlatformAdmin();
		await organizationExists(data.organizationId);

		const [targetMember] = await db
			.select({ id: schema.member.id, role: schema.member.role })
			.from(schema.member)
			.where(
				and(
					eq(schema.member.id, data.memberId),
					eq(schema.member.organizationId, data.organizationId),
				),
			)
			.limit(1);

		if (!targetMember) throw new Error("Organization member not found.");
		if (targetMember.role.split(",").includes("owner")) {
			throw new Error("This member already owns the organization.");
		}

		await db.batch([
			db
				.update(schema.member)
				.set({ role: "admin" })
				.where(
					and(
						eq(schema.member.organizationId, data.organizationId),
						eq(schema.member.role, "owner"),
					),
				),
			db
				.update(schema.member)
				.set({ role: "owner" })
				.where(
					and(
						eq(schema.member.id, data.memberId),
						eq(schema.member.organizationId, data.organizationId),
					),
				),
		]);

		return getOrganizationDetails(data.organizationId);
	});

export const removeAdminOrganizationMember = createServerFn({ method: "POST" })
	.validator(validateMemberInput)
	.handler(async ({ data }) => {
		await requirePlatformAdmin();
		await organizationExists(data.organizationId);

		const [existingMember] = await db
			.select({ id: schema.member.id, role: schema.member.role })
			.from(schema.member)
			.where(
				and(
					eq(schema.member.id, data.memberId),
					eq(schema.member.organizationId, data.organizationId),
				),
			)
			.limit(1);

		if (!existingMember) throw new Error("Organization member not found.");
		if (existingMember.role.split(",").includes("owner")) {
			throw new Error("Transfer ownership before removing the owner.");
		}

		await db
			.delete(schema.member)
			.where(
				and(
					eq(schema.member.id, data.memberId),
					eq(schema.member.organizationId, data.organizationId),
				),
			);

		return getOrganizationDetails(data.organizationId);
	});

export const deleteAdminOrganization = createServerFn({ method: "POST" })
	.validator(validateDeleteInput)
	.handler(async ({ data }) => {
		await requirePlatformAdmin();

		const [organization] = await db
			.select({ id: schema.organization.id, name: schema.organization.name })
			.from(schema.organization)
			.where(eq(schema.organization.id, data.organizationId))
			.limit(1);

		if (!organization) throw new Error("Organization not found.");
		if (data.confirmationName !== organization.name) {
			throw new Error(
				"Enter the organization name exactly to confirm deletion.",
			);
		}

		await db.batch([
			db
				.update(schema.session)
				.set({ activeOrganizationId: null })
				.where(eq(schema.session.activeOrganizationId, data.organizationId)),
			db
				.delete(schema.invitation)
				.where(eq(schema.invitation.organizationId, data.organizationId)),
			db
				.delete(schema.member)
				.where(eq(schema.member.organizationId, data.organizationId)),
			db
				.delete(schema.organization)
				.where(eq(schema.organization.id, data.organizationId)),
		]);

		return { organizationId: data.organizationId };
	});
