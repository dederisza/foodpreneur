import { Card } from "@/components/ui/Card";

export function ComingSoon({ title }: { title: string }) {
  return (
    <Card className="flex flex-col items-center justify-center py-20 text-center">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Available in the next development phase.
      </p>
    </Card>
  );
}
