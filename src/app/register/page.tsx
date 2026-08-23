import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";
import { Card } from "@/components/ui/Card";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Start understanding your food business today.
        </p>

        <div className="mt-6">
          <AuthForm mode="register" />
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-emerald-700 hover:underline">
            Log in
          </Link>
        </p>
      </Card>
    </main>
  );
}
