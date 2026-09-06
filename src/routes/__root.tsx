import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TooltipProvider } from "#/components/ui/tooltip";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Cakna Exam — Online Examination Management System",
			},
			{
				name: "description",
				content:
					"A smart platform to plan examinations, manage results and understand learner performance.",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	notFoundComponent: NotFoundPage,
	errorComponent: RootErrorPage,
	pendingComponent: RootPendingPage,
	shellComponent: RootDocument,
});

function RootErrorPage() {
	return (
		<main className="grid min-h-svh place-items-center bg-muted/30 px-6 text-center">
			<section className="max-w-md space-y-4 rounded-xl border bg-background p-6 shadow-sm">
				<p className="text-sm font-medium text-destructive">
					Something went wrong
				</p>
				<h1 className="text-xl font-semibold">This page could not be loaded</h1>
				<p className="text-sm text-muted-foreground">
					Please try again or return to the dashboard.
				</p>
				<Link
					className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
					to="/dashboard"
				>
					Return to dashboard
				</Link>
			</section>
		</main>
	);
}

function NotFoundPage() {
	return (
		<main className="grid min-h-svh place-items-center bg-muted/30 px-6 text-center">
			<section className="max-w-md space-y-4 rounded-xl border bg-background p-6 shadow-sm">
				<p className="text-sm font-medium text-muted-foreground">404</p>
				<h1 className="text-xl font-semibold">Page not found</h1>
				<p className="text-sm text-muted-foreground">
					This link may have moved or is no longer available.
				</p>
				<Link
					className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
					to="/"
				>
					Back to home
				</Link>
			</section>
		</main>
	);
}

function RootPendingPage() {
	return (
		<main className="grid min-h-svh place-items-center bg-muted/30 px-6">
			<output className="text-sm text-muted-foreground">Loading…</output>
		</main>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<TooltipProvider>
					{children}
					<TanStackDevtools
						config={{
							position: "bottom-right",
						}}
						plugins={[
							{
								name: "Tanstack Router",
								render: <TanStackRouterDevtoolsPanel />,
							},
							TanStackQueryDevtools,
						]}
					/>
				</TooltipProvider>
				<Scripts />
			</body>
		</html>
	);
}
