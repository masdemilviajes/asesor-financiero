"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteRule } from "../revisar/actions";

export type RuleRow = { id: string; patron_texto: string; categoria: string };

/** Reglas aprendidas de las correcciones; se pueden borrar si alguna no sirve. */
export function RulesCard({ rules }: { rules: RuleRow[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <Card className="pb-0">
      <CardHeader>
        <CardTitle>Reglas aprendidas</CardTitle>
        <CardDescription>
          Se crean solas cuando corriges una categoría o marcas una transferencia. Si una
          descripción contiene estas palabras, se le aplica lo mismo.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rules.length === 0 ? (
          <p className="px-4 pb-4 text-muted-foreground">Aún no hay reglas.</p>
        ) : (
          <ul className="divide-y border-t">
            {rules.map((rule) => (
              <li key={rule.id} className="flex min-h-12 items-center justify-between gap-3 px-4 py-1">
                <span className="min-w-0 text-sm">
                  <span className="font-mono">{rule.patron_texto}</span>
                  <span className="text-muted-foreground"> → {rule.categoria}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label={`Borrar regla ${rule.patron_texto}`}
                  disabled={pendingId === rule.id}
                  onClick={() => {
                    setPendingId(rule.id);
                    startTransition(async () => {
                      await deleteRule(rule.id);
                      setPendingId(null);
                    });
                  }}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
