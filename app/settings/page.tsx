import { Suspense } from "react";
import { getEnvStatus } from "@/lib/env-status";
import { SettingsTabs } from "./_components/settings-tabs";

export const metadata = {
  title: "Settings — ClipPilot",
};

export default function SettingsPage() {
  // Pass env-var status as the initial prop; AiProvidersTab will
  // fetch DB-stored key status client-side and merge on mount.
  const envStatus = getEnvStatus();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Configure API keys, storage, and compliance preferences.
        </p>
      </div>
      {/* Suspense required because SettingsTabs + ConnectedAccountsTab use useSearchParams() */}
      <Suspense fallback={<div className="h-10 animate-pulse rounded-md bg-muted" />}>
        <SettingsTabs envStatus={envStatus} />
      </Suspense>
    </div>
  );
}
