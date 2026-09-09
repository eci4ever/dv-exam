import { Link, createFileRoute } from "@tanstack/react-router";

import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to access your DV-EXAM workspace."
      footer={
        <>
          New to DV-EXAM?{" "}
          <Link className="font-medium text-foreground underline underline-offset-4" to="/signup">
            Create an account
          </Link>
        </>
      }
    >
      <div className="space-y-5">
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
          <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" />
        </div>
        <Button className="mt-1 h-10 w-full" type="button">
          Sign in
        </Button>
      </div>
    </AuthLayout>
  );
}
