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
	shellComponent: RootDocument,
});

function NotFoundPage() {
	return (
		<main className="grid min-h-svh place-items-center bg-slate-950 px-6 text-center text-slate-100">
			<section className="max-w-md space-y-5">
				<p className="text-sm font-medium tracking-[0.2em] text-cyan-300">
					404
				</p>
				<h1 className="text-3xl font-semibold tracking-tight">
					Page not found
				</h1>
				<p className="text-sm leading-6 text-slate-400">
					This link may have moved or is no longer available.
				</p>
				<Link
					className="inline-flex h-10 items-center justify-center rounded-md bg-cyan-300 px-4 text-sm font-medium text-slate-950 transition-colors hover:bg-cyan-200"
					to="/"
				>
					Back to home
				</Link>
			</section>
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
