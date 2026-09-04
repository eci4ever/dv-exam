import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppSidebar, type SidebarUser } from "#/components/app-sidebar";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "#/components/ui/breadcrumb";
import { Separator } from "#/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "#/components/ui/sidebar";

export function DashboardShell({
	user,
	pageTitle,
	children,
	futuristic = true,
}: {
	user: SidebarUser;
	pageTitle: string;
	children: ReactNode;
	futuristic?: boolean;
}) {
	return (
		<SidebarProvider className={futuristic ? "dark bg-[#050816]" : undefined}>
			<AppSidebar user={user} />
			<SidebarInset
				className={
					futuristic
						? "min-w-0 bg-[#050816] text-slate-100 [background-image:radial-gradient(circle_at_72%_0%,rgba(14,165,233,0.1),transparent_28rem)]"
						: "min-w-0 bg-muted/30"
				}
			>
				<header
					className={
						futuristic
							? "sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-sky-400/10 bg-[#050816]/90 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
							: "sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background/90 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
					}
				>
					<div className="flex min-w-0 items-center gap-2 px-4 sm:px-6 lg:px-8">
						<SidebarTrigger className="-ml-1" />
						<Separator
							className="mr-2 data-[orientation=vertical]:h-4"
							orientation="vertical"
						/>
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem className="hidden md:block">
									<BreadcrumbLink asChild>
										<Link to="/dashboard">CaknaExam</Link>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage className="truncate">
										{pageTitle}
									</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
				</header>
				<div className="flex min-h-[calc(100svh-4rem)] flex-1 flex-col">
					{children}
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
