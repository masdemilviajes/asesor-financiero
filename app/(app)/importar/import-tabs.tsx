"use client";

import { useState } from "react";
import type { Account, Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FileImport } from "./file-import";
import { PdfImport } from "./pdf-import";
import { QuickCapture } from "./quick-capture";

const TABS = [
  { id: "rapida", label: "Rápida" },
  { id: "archivo", label: "CSV / Excel" },
  { id: "pdf", label: "PDF" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export type ImportContext = {
  userId: string;
  today: string;
  accounts: Pick<Account, "id" | "nombre">[];
  categories: Pick<Category, "id" | "nombre">[];
};

export function ImportTabs(props: ImportContext) {
  const [tab, setTab] = useState<TabId>("rapida");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "h-10 rounded-md text-sm font-medium text-muted-foreground transition-colors",
              tab === t.id && "bg-background text-foreground shadow-sm",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "rapida" ? <QuickCapture {...props} /> : null}
      {tab === "archivo" ? <FileImport {...props} /> : null}
      {tab === "pdf" ? <PdfImport {...props} /> : null}
    </div>
  );
}
