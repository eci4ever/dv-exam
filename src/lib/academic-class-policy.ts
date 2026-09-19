export type AcademicClassStatus = "active" | "archived";
export type AcademicClassMemberRole = "teacher" | "student";

export function normalizeClassCode(value: string) {
	return value.trim().toUpperCase();
}

export function validateAcademicClass(input: {
	name: string;
	code: string;
	description?: string | null;
}) {
	const name = input.name.trim();
	const code = normalizeClassCode(input.code);
	const description = input.description?.trim() || null;
	if (name.length < 2 || name.length > 80)
		throw new Error("Class name must be between 2 and 80 characters.");
	if (!/^[A-Z0-9-]{2,24}$/.test(code))
		throw new Error(
			"Class code must be 2–24 uppercase letters, numbers, or hyphens.",
		);
	if (description && description.length > 240)
		throw new Error("Description must be 240 characters or fewer.");
	return { name, code, description };
}

export function assertActiveClass(status: AcademicClassStatus) {
	if (status !== "active")
		throw new Error("Archived classes cannot be changed.");
}

export function assertClassManager(role: string) {
	if (!role.split(",").some((item) => item === "owner" || item === "admin"))
		throw new Error("Workspace manager access is required.");
}
