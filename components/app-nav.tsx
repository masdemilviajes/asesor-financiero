"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  LayoutDashboard,
  ListChecks,
  Settings,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

// Las secciones se van agregando aquí conforme se construye cada fase.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/importar", label: "Importar", icon: Upload },
  { href: "/revisar", label: "Revisar", icon: ListChecks },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Contador de pendientes junto a "Revisar". */
function Count({ href, pending }: { href: string; pending: number }) {
  if (href !== "/revisar" || pending <= 0) return null;
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
      {NAV_ITEMS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(pathname, href) ? "page" : undefined}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
            isActive(pathname, href) && "bg-muted font-medium text-foreground",
          )}
        >
          {label}
          <Count href={href} pending={pending} />
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
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(pathname, href) ? "page" : undefined}
          className={cn(
            "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs text-muted-foreground",
            isActive(pathname, href) && "font-medium text-foreground",
          )}
        >
          <span className="relative">
            <Icon className="size-5" aria-hidden />
            <span className="absolute -top-1.5 left-3.5 flex">
              <Count href={href} pending={pending} />
            </span>
          </span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
