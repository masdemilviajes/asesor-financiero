"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Ellipsis,
  LayoutDashboard,
  ListChecks,
  Settings,
  Target,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Dónde aparece: en el celular solo caben 5 botones. */
  on: "both" | "desktop" | "mobile";
  /** Rutas que también marcan este botón como activo. */
  also?: string[];
};

// Las secciones se van agregando aquí conforme se construye cada fase.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: LayoutDashboard, on: "both" },
  { href: "/movimientos", label: "Movimientos", icon: ArrowLeftRight, on: "both" },
  { href: "/importar", label: "Importar", icon: Upload, on: "both" },
  { href: "/revisar", label: "Revisar", icon: ListChecks, on: "desktop" },
  { href: "/metas", label: "Metas", icon: Target, on: "both" },
  { href: "/ajustes", label: "Ajustes", icon: Settings, on: "desktop" },
  { href: "/mas", label: "Más", icon: Ellipsis, on: "mobile", also: ["/revisar", "/ajustes"] },
];

function isActive(pathname: string, item: NavItem) {
  if (item.href === "/") return pathname === "/";
  return [item.href, ...(item.also ?? [])].some((href) => pathname.startsWith(href));
}

/** Contador de gastos pendientes de revisar. */
function Count({ item, pending }: { item: NavItem; pending: number }) {
  if (pending <= 0 || (item.href !== "/revisar" && item.href !== "/mas")) return null;
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[0.65rem] leading-none font-medium whitespace-nowrap text-background tabular-nums">
      {pending > 99 ? "99+" : pending}
      <span className="sr-only"> pendientes</span>
    </span>
  );
}

/** Navegación superior para escritorio. */
export function DesktopNav({ pending = 0 }: { pending?: number }) {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
      {NAV_ITEMS.filter((item) => item.on !== "mobile").map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item) ? "page" : undefined}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
            isActive(pathname, item) && "bg-muted font-medium text-foreground",
          )}
        >
          {item.label}
          <Count item={item} pending={pending} />
        </Link>
      ))}
    </nav>
  );
}

/** Barra inferior para celular, con botones grandes. */
export function MobileNav({ pending = 0 }: { pending?: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {NAV_ITEMS.filter((item) => item.on !== "desktop").map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item) ? "page" : undefined}
          className={cn(
            "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs text-muted-foreground",
            isActive(pathname, item) && "font-medium text-foreground",
          )}
        >
          <span className="relative">
            <item.icon className="size-5" aria-hidden />
            <span className="absolute -top-1.5 left-3.5 flex">
              <Count item={item} pending={pending} />
            </span>
          </span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
