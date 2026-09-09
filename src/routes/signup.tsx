import { Link, createFileRoute } from "@tanstack/react-router";

import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/signup")({ component: Signup });

function Signup() {
  return (
    <AuthLayout
      title="Create your account"
      description="Start organising your exams in one simple workspace."
      footer={
        <>
          Already have an account?{" "}
          <Link className="font-medium text-foreground underline underline-offset-4" to="/login">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="full-name">
            Full name
          </label>
          <Input id="full-name" name="name" type="text" autoComplete="name" placeholder="Your full name" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email address
          </label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">
            Password
          </label>
          <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="Create a password" />
        </div>
        <Button className="mt-1 h-10 w-full" type="button">
          Create account
        </Button>
      </div>
    </AuthLayout>
  );
}
