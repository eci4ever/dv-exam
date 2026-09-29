export const PLATFORM_ADMIN_ROLE = "platform_admin" as const;
export const STANDARD_USER_ROLE = "user" as const;

export function isPlatformAdmin(role?: string | null) {
	return role?.split(",").includes(PLATFORM_ADMIN_ROLE) ?? false;
}

export function shouldGrantPlatformAdmin(input: {
	userCount: number;
	userEmail: string;
	bootstrapEmail?: string | null;
}) {
	return (
		input.userCount === 1 ||
		Boolean(
			input.bootstrapEmail?.trim() &&
				input.userEmail.trim().toLowerCase() ===
					input.bootstrapEmail.trim().toLowerCase(),
		)
	);
}
