import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Menu, NotebookPen } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:h-20 sm:px-6 lg:px-8">
        <a className="flex items-center gap-2.5 text-base font-bold tracking-tight" href="#top">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <NotebookPen className="size-4" aria-hidden="true" />
          </span>
          DV-EXAM
        </a>

        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex" aria-label="Primary navigation">
          <a className="transition-colors hover:text-foreground" href="#platform">
            Platform
          </a>
          <a className="transition-colors hover:text-foreground" href="#pricing">
            Pricing
          </a>
          <a className="transition-colors hover:text-foreground" href="#support">
            Support
          </a>
        </nav>

        <div className="hidden md:block">
          <Button className="h-10 rounded-lg px-5" size="lg">
            Start for free
          </Button>
        </div>

        <Button className="size-10 rounded-lg md:hidden" variant="outline" size="icon" aria-label="Open menu">
          <Menu className="size-4" aria-hidden="true" />
        </Button>
      </header>

      <section id="top" className="mx-auto flex min-h-[calc(100svh-4.5rem)] max-w-7xl items-center px-5 py-16 sm:min-h-[calc(100svh-5rem)] sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="max-w-4xl">
          <p className="mb-7 inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
            <BadgeCheck className="size-4" aria-hidden="true" />
            Exam management, made simpler.
          </p>
          <h1 className="max-w-4xl text-balance text-5xl font-semibold tracking-[-0.055em] leading-[0.98] sm:text-7xl lg:text-8xl">
            Manage exams. <span className="text-muted-foreground">Focus on learning.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground sm:mt-8 sm:text-xl">
            DV-EXAM is a SaaS platform that gives students one simple place to manage exam schedules, preparation, and results.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3 sm:mt-10 sm:gap-4">
            <Button className="h-12 rounded-lg px-6 text-base" size="lg">
              Start for free
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            <a className="px-2 text-sm font-medium text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground" href="#platform">
              Sign in to your account
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
