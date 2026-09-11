import { createAccessControl } from "better-auth/plugins/access";
import {
	adminAc,
	defaultStatements,
	ownerAc,
} from "better-auth/plugins/organization/access";

const statement = {
	...defaultStatements,
	exam: ["create", "read", "update", "delete", "publish"],
	question: ["create", "read", "update", "delete"],
	attempt: ["create", "readOwn", "readAll", "submit", "grade"],
	result: ["readOwn", "readAll", "publish"],
} as const;

export const organizationAccessControl = createAccessControl(statement);

const owner = organizationAccessControl.newRole({
	...ownerAc.statements,
	exam: ["create", "read", "update", "delete", "publish"],
	question: ["create", "read", "update", "delete"],
	attempt: ["create", "readOwn", "readAll", "submit", "grade"],
	result: ["readOwn", "readAll", "publish"],
});

const admin = organizationAccessControl.newRole({
	...adminAc.statements,
	exam: ["create", "read", "update", "delete", "publish"],
	question: ["create", "read", "update", "delete"],
	attempt: ["create", "readOwn", "readAll", "submit", "grade"],
	result: ["readOwn", "readAll", "publish"],
});

const teacher = organizationAccessControl.newRole({
	exam: ["create", "read", "update", "delete", "publish"],
	question: ["create", "read", "update", "delete"],
	attempt: ["readAll", "grade"],
	result: ["readAll", "publish"],
});

const student = organizationAccessControl.newRole({
	exam: ["read"],
	attempt: ["create", "readOwn", "submit"],
	result: ["readOwn"],
});

export const organizationRoles = {
	owner,
	admin,
	teacher,
	student,
};

export function formatOrganizationRole(role: string) {
	return role
		.split("_")
		.map((part) => part.replace(/^./, (character) => character.toUpperCase()))
		.join(" ");
}
