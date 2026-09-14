export function validatePasswordChange(input: {
	password: string;
	confirmation: string;
}) {
	if (input.password.length < 8 || input.password.length > 128) {
		throw new Error("Password must be between 8 and 128 characters.");
	}
	if (input.password !== input.confirmation) {
		throw new Error("Passwords do not match.");
	}
	return input.password;
}

export function validateDisplayName(value: string) {
	const name = value.trim();
	if (name.length < 2 || name.length > 80) {
		throw new Error("Name must be between 2 and 80 characters.");
	}
	return name;
}

export function validateAccountDeletion(input: {
	confirmation: string;
	password: string;
}) {
	if (input.confirmation !== "DELETE") {
		throw new Error('Type "DELETE" to confirm account deletion.');
	}
	if (!input.password) {
		throw new Error("Enter your current password.");
	}
	return { password: input.password };
}
