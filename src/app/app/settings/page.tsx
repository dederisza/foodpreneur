import { requireAppContext } from "@/lib/context";
import { Card } from "@/components/ui/Card";
import { BusinessSwitcher } from "@/components/business/BusinessSwitcher";
import { CreateBusinessForm } from "@/components/business/CreateBusinessForm";

export default async function SettingsPage() {
  const ctx = await requireAppContext();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Account and business management.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Account</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-400">Name</dt>
            <dd className="font-medium text-slate-900">
              {ctx.user.displayName ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Email</dt>
            <dd className="font-medium text-slate-900">{ctx.user.email}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Your businesses</h2>
        <div className="mt-4">
          <BusinessSwitcher
            businesses={ctx.businesses}
            activeBusinessId={ctx.activeBusiness?.id ?? null}
          />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Add another business</h2>
        <p className="mt-1 text-sm text-slate-500">
          The architecture supports managing multiple businesses under one account.
        </p>
        <div className="mt-4 max-w-md">
          <CreateBusinessForm />
        </div>
      </Card>
    </div>
  );
}
