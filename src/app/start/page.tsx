import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function StartPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <Card className="w-full max-w-md text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          Planning a new food business?
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          The START assessment, business planning, and launch readiness
          tools are available in a later development phase.
        </p>
        <div className="mt-6">
          <Link href="/">
            <Button variant="secondary">Back to home</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
