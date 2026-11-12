import { CircleAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Clases para que inputs y selects sean cómodos de tocar en celular. */
export const TOUCH_INPUT = "h-11 text-base";
export const TOUCH_SELECT = "w-full [&_select]:h-11 [&_select]:text-base";

export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  // Sin rojo: en esta app el rojo se reserva para "excedido".
  return (
    <p role="alert" className="flex items-start gap-2 text-sm font-medium">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}
