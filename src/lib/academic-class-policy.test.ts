import { describe, expect, it } from "vitest";
import {
	assertActiveClass,
	assertClassAccess,
	assertClassManager,
	normalizeClassCode,
	validateAcademicClass,
} from "@/lib/academic-class-policy";

describe("academic class policy", () => {
	it("normalizes and validates class details", () => {
		expect(normalizeClassCode(" form-1 ")).toBe("FORM-1");
		expect(
			validateAcademicClass({ name: " Form One ", code: " form-1 " }),
		).toEqual({ name: "Form One", code: "FORM-1", description: null });
		expect(() =>
			validateAcademicClass({ name: "A", code: "bad code" }),
		).toThrow();
	});

	it("limits management to owner and admin", () => {
		expect(() => assertClassManager("owner")).not.toThrow();
		expect(() => assertClassManager("admin")).not.toThrow();
		expect(() => assertClassManager("teacher")).toThrow("manager access");
	});

	it("prevents archived class mutations", () => {
		expect(() => assertActiveClass("active")).not.toThrow();
		expect(() => assertActiveClass("archived")).toThrow("Archived classes");
	});

	it("allows only assigned teachers outside workspace management", () => {
		expect(() => assertClassAccess("teacher", true)).not.toThrow();
		expect(() => assertClassAccess("teacher", false)).toThrow("Class access");
		expect(() => assertClassAccess("student", true)).toThrow("Class access");
	});
});
