import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { DesktopNav, MobileNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/supabase/server";
import { logout } from "../login/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
          <span className="font-semibold tracking-tight">Asesor Financiero</span>
          <DesktopNav />
          <form action={logout} className="ml-auto">
            <Button type="submit" variant="ghost" size="lg" aria-label="Cerrar sesión">
              <LogOut aria-hidden />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 md:pb-10">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
