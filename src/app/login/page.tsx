import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">Log in to your account.</p>

        <div className="mt-6">
          <AuthForm mode="login" />
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-emerald-700 hover:underline">
            Sign up
          </Link>
        </p>
      </Card>
    </main>
  );
}
