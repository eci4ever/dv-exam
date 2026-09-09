import { Link } from "@tanstack/react-router";
import { NotebookPen } from "lucide-react";

interface AuthLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-5 py-10 sm:px-6">
      <section className="w-full max-w-md">
        <Link className="mx-auto mb-10 flex w-fit items-center gap-2.5 text-base font-bold tracking-tight" to="/">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <NotebookPen className="size-4" aria-hidden="true" />
          </span>
          DV-EXAM
        </Link>

        <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-7 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
      </section>
    </main>
  );
}
