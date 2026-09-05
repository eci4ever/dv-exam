import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
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
				title: "Cakna Exam — Sistem Pengurusan Peperiksaan Online",
			},
			{
				name: "description",
				content:
					"Platform pintar untuk merancang peperiksaan, mengurus markah dan memahami prestasi pelajar.",
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
					Halaman tidak ditemui
				</h1>
				<p className="text-sm leading-6 text-slate-400">
					Pautan ini mungkin telah dipindahkan atau tidak lagi tersedia.
				</p>
				<Link
					className="inline-flex h-10 items-center justify-center rounded-md bg-cyan-300 px-4 text-sm font-medium text-slate-950 transition-colors hover:bg-cyan-200"
					to="/"
				>
					Kembali ke laman utama
				</Link>
			</section>
		</main>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="ms">
			<head>
				<HeadContent />
			</head>
			<body>
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
				<Scripts />
			</body>
		</html>
	);
}
