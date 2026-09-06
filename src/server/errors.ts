export type DomainErrorCode =
	| "forbidden"
	| "invalid-input"
	| "invalid-state"
	| "not-found"
	| "unauthorized";

export class DomainError extends Error {
	readonly code: DomainErrorCode;

	constructor(code: DomainErrorCode, message: string) {
		super(message);
		this.name = "DomainError";
		this.code = code;
	}
}

export function forbidden(message: string) {
	return new DomainError("forbidden", message);
}

export function invalidInput(message: string) {
	return new DomainError("invalid-input", message);
}

export function invalidState(message: string) {
	return new DomainError("invalid-state", message);
}

export function notFound(message: string) {
	return new DomainError("not-found", message);
}

export function unauthorized(message: string) {
	return new DomainError("unauthorized", message);
}
