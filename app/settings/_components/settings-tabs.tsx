"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { EnvStatus } from "@/lib/env-status";
import { AiProvidersTab } from "./ai-providers-tab";
import { StorageTab } from "./storage-tab";
import { ComplianceTab } from "./compliance-tab";
import { AboutTab } from "./about-tab";
import { ConnectedAccountsTab } from "./connected-accounts-tab";

const TABS = ["AI Providers", "Storage", "Connected Accounts", "Compliance", "About"] as const;
type Tab = (typeof TABS)[number];

interface Props {
  envStatus: EnvStatus;
}

export function SettingsTabs({ envStatus }: Props) {
  const searchParams = useSearchParams();
  const [active, setActive] = useState<Tab>("AI Providers");

  // Jump to Connected Accounts tab when redirected from OAuth callback
  useEffect(() => {
    if (searchParams.get("tab") === "connected-accounts") {
      setActive("Connected Accounts");
    }
  }, [searchParams]);

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              active === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {active === "AI Providers" && <AiProvidersTab />}
        {active === "Storage" && <StorageTab envStatus={envStatus} />}
        {active === "Connected Accounts" && <ConnectedAccountsTab />}
        {active === "Compliance" && <ComplianceTab envStatus={envStatus} />}
        {active === "About" && <AboutTab />}
      </div>
    </div>
  );
}
