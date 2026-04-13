"use client";

import { useState } from "react";
import type { EnvStatus } from "@/lib/env-status";
import { AiProvidersTab } from "./ai-providers-tab";
import { StorageTab } from "./storage-tab";
import { ComplianceTab } from "./compliance-tab";
import { AboutTab } from "./about-tab";

const TABS = ["AI Providers", "Storage", "Compliance", "About"] as const;
type Tab = (typeof TABS)[number];

interface Props {
  envStatus: EnvStatus;
}

export function SettingsTabs({ envStatus }: Props) {
  const [active, setActive] = useState<Tab>("AI Providers");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
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
        {active === "Compliance" && <ComplianceTab envStatus={envStatus} />}
        {active === "About" && <AboutTab />}
      </div>
    </div>
  );
}
