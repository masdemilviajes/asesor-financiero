import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney, todayInTimezone } from "@/lib/config";
import { addDays } from "@/lib/dates";
import { plural } from "@/lib/format";
import { goalProgress, PACE_WEEKS, type Contribution, type Goal, type GoalProgress } from "@/lib/goals";
import { createClient } from "@/lib/supabase/server";
import { ContributionDialog, GoalDialog } from "./goal-dialogs";
import { SuggestButton } from "./suggest-button";

export const metadata: Metadata = { title: "Metas" };
export const maxDuration = 60;

const longDate = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const formatDate = (fecha: string) => longDate.format(new Date(`${fecha}T00:00:00Z`));

function statusLabel(p: GoalProgress): string {
  switch (p.estado) {
    case "cumplida":
      return "Cumplida";
    case "a_tiempo":
      return "A tiempo";
    case "retraso":
      return `${plural(p.semanasRetraso, "semana", "semanas")} de retraso`;
    case "vencida":
      return "Fecha vencida";
    default:
      return "Sin aportaciones recientes";
  }
}

function paceText(p: GoalProgress): string {
  if (p.estado === "cumplida") return "¡Meta alcanzada!";
  if (p.ritmoSemanal <= 0) {
    return `No has aportado en las últimas ${PACE_WEEKS} semanas, así que no hay ritmo para proyectar.`;
  }
  const ritmo = `Tu ritmo de las últimas ${PACE_WEEKS} semanas es de ${formatMoney(p.ritmoSemanal)} por semana.`;
  if (p.estado === "a_tiempo") {
    return `${ritmo} A ese ritmo llegas a tiempo${p.fechaEstimada ? `, hacia el ${formatDate(p.fechaEstimada)}` : ""}.`;
  }
  return `${ritmo} A ese ritmo llegarías${p.fechaEstimada ? ` el ${formatDate(p.fechaEstimada)}` : ""}, con ${plural(p.semanasRetraso, "semana", "semanas")} de retraso.`;
}

export default async function MetasPage() {
  const today = todayInTimezone();
  const supabase = await createClient();
  const [goalsRes, contribRes] = await Promise.all([
    supabase.from("savings_goals").select("*").order("fecha_objetivo"),
    supabase
      .from("savings_contributions")
      .select("goal_id, fecha, monto")
      .gt("fecha", addDays(today, -7 * PACE_WEEKS)),
  ]);
  const goals = (goalsRes.data ?? []) as Goal[];
  const contributions = (contribRes.data ?? []) as Contribution[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Metas de ahorro</h1>
          <p className="text-sm text-muted-foreground">
            Cuánto te falta y cuánto apartar cada semana para llegar a tiempo.
          </p>
        </div>
        <GoalDialog defaultDate={addDays(today, 182)}>
          <Button size="lg" className="h-12 w-full text-base sm:w-auto sm:px-5">
            <Plus aria-hidden /> Nueva meta
          </Button>
        </GoalDialog>
      </div>

      {goals.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Aún no tienes metas de ahorro.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((goal) => {
            const p = goalProgress(goal, contributions, today);
            return (
              <Card key={goal.id} data-testid="meta">
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold tracking-tight break-words">{goal.nombre}</h2>
                      <p className="text-sm text-muted-foreground">
                        Para el {formatDate(goal.fecha_objetivo)}
                        {p.estado !== "cumplida" && p.semanasRestantes > 0
                          ? ` · quedan ${plural(Math.ceil(p.semanasRestantes), "semana", "semanas")}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={
                        p.estado === "retraso" || p.estado === "vencida"
                          ? "shrink-0 rounded-full border border-foreground px-2.5 py-0.5 text-xs font-medium"
                          : "shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                      }
                    >
                      {statusLabel(p)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="flex items-baseline justify-between gap-3 tabular-nums">
                      <span>
                        <span className="text-xl font-semibold">{formatMoney(goal.monto_actual)}</span>
                        <span className="text-sm text-muted-foreground">
                          {" "}
                          de {formatMoney(goal.monto_objetivo)}
                        </span>
                      </span>
                      <span className="text-sm text-muted-foreground">{Math.round(p.porcentaje)}%</span>
                    </p>
                    <div
                      className="h-2 rounded-full bg-muted"
                      role="img"
                      aria-label={`${Math.round(p.porcentaje)}% de avance`}
                    >
                      <div
                        className="h-full rounded-full bg-foreground"
                        style={{ width: `${p.porcentaje}%` }}
                      />
                    </div>
                  </div>

                  {p.estado !== "cumplida" ? (
                    <dl className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Falta</dt>
                        <dd className="font-medium tabular-nums">{formatMoney(p.falta)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Por semana</dt>
                        <dd className="font-medium tabular-nums">{formatMoney(p.porSemana)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Por quincena</dt>
                        <dd className="font-medium tabular-nums">{formatMoney(p.porQuincena)}</dd>
                      </div>
                    </dl>
                  ) : null}

                  <p className="text-sm text-muted-foreground">{paceText(p)}</p>

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <ContributionDialog goal={goal} today={today} suggested={p.porSemana}>
                        <Button size="lg" className="h-11 flex-1 px-4">
                          Registrar aportación
                        </Button>
                      </ContributionDialog>
                      <GoalDialog goal={goal} defaultDate={goal.fecha_objetivo}>
                        <Button variant="outline" size="lg" className="h-11 px-4">
                          Editar
                        </Button>
                      </GoalDialog>
                    </div>
                    {p.diferenciaSemanal > 0 ? <SuggestButton goalId={goal.id} /> : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
