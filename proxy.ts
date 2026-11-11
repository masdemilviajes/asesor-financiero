import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Revisa que las variables de Supabase existan y tengan forma válida. */
function configProblem(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !key && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter(Boolean);
  if (missing.length > 0) {
    return `Faltan variables de entorno: ${missing.join(", ")}. Agrégalas en Vercel (Environment Variables) y vuelve a desplegar.`;
  }
  if (!/^https:\/\/[^\s/]+\.[^\s/]+\/?$/.test(url!)) {
    // La Project URL es pública (viaja al navegador), así que se puede mostrar.
    return `NEXT_PUBLIC_SUPABASE_URL no es válida: debe ser la Project URL de Supabase, con la forma https://xxxxxxxx.supabase.co (sin comillas y sin nada después).\n\nValor que tiene ahora: [${url!.slice(0, 120)}]`;
  }
  if (/^https?:\/\//.test(key!)) {
    return "NEXT_PUBLIC_SUPABASE_ANON_KEY parece una dirección web: ahí va la publishable key de Supabase, no la URL.";
  }
  return null;
}

// Corre antes de cada petición: refresca la sesión de Supabase y manda al
// login a quien no haya iniciado sesión.
export async function proxy(request: NextRequest) {
  const problem = configProblem();
  if (problem) {
    return new NextResponse(`Asesor Financiero: configuración incompleta.\n\n${problem}`, {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLogin = pathname.startsWith("/login");

  if (!user && !isLogin) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Todo excepto archivos estáticos y los crons (que se protegen con CRON_SECRET).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
