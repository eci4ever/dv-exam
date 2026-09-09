import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Menu, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="min-h-svh overflow-hidden bg-[#f7f7f5] text-neutral-950">
      <header className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <a className="flex items-center gap-2.5 text-lg font-semibold tracking-tight" href="#top">
          <span className="grid size-8 place-items-center rounded-full bg-neutral-950 text-white">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          arc<span className="text-neutral-400">.</span>
        </a>

        <nav className="hidden items-center gap-8 text-sm font-medium text-neutral-600 md:flex" aria-label="Navigasi utama">
          <a className="transition-colors hover:text-neutral-950" href="#work">
            Cara kerja
          </a>
          <a className="transition-colors hover:text-neutral-950" href="#stories">
            Cerita
          </a>
          <a className="transition-colors hover:text-neutral-950" href="#about">
            Tentang kami
          </a>
        </nav>

        <div className="hidden md:block">
          <Button className="h-10 rounded-full px-5" size="lg">
            Mulakan projek
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <Button className="size-10 rounded-full md:hidden" variant="outline" size="icon" aria-label="Buka menu">
          <Menu className="size-4" aria-hidden="true" />
        </Button>
      </header>

      <section id="top" className="relative mx-auto flex min-h-[calc(100svh-5rem)] max-w-7xl items-center px-6 py-20 lg:px-8 lg:py-24">
        <div className="absolute top-[12%] right-[-8rem] -z-0 size-72 rounded-full bg-amber-200/60 blur-3xl sm:size-96" />
        <div className="absolute bottom-[8%] left-[-9rem] -z-0 size-72 rounded-full bg-sky-200/50 blur-3xl sm:size-96" />

        <div className="relative z-10 max-w-4xl">
          <p className="mb-7 flex items-center gap-2 text-sm font-medium text-neutral-600">
            <span className="size-2 rounded-full bg-emerald-500" />
            Studio digital untuk pasukan yang berani bergerak.
          </p>
          <h1 className="max-w-4xl text-balance text-5xl font-semibold tracking-[-0.06em] text-neutral-950 sm:text-7xl lg:text-8xl">
            Idea yang terasa <em className="font-serif font-normal tracking-[-0.04em]">bermakna.</em>
          </h1>
          <p className="mt-8 max-w-xl text-pretty text-lg leading-8 text-neutral-600 sm:text-xl">
            Kami membantu jenama yang bercita-cita besar membina pengalaman digital yang jelas, berguna, dan sukar dilupakan.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button className="h-12 rounded-full px-6 text-base" size="lg">
              Mari berbincang
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            <a className="px-2 text-sm font-medium text-neutral-600 underline decoration-neutral-300 underline-offset-4 transition-colors hover:text-neutral-950" href="#work">
              Lihat cara kami bekerja
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
