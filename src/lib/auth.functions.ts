import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getAuth } from "./auth";

export const getSession = createServerFn({ method: "GET" }).handler(async () =>
	getAuth().api.getSession({ headers: getRequestHeaders() }),
);
