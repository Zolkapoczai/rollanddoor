import type { Env } from "./env";
import { handleBejovo } from "./bejovo";
import { futtatCron } from "./cron";
import { handleIgeny } from "./igeny";
import { handleDashboard } from "./dashboard";
import { handleRicsi } from "./ricsi";
import { hiba, withSecurity } from "./util";
import { handleLeiratkozas, handleVevo } from "./vevo";

type Handler = (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response> | Response;

// Pontos API-utak.
const exact: Record<string, Handler> = {
  "/api/igeny": handleIgeny,
  "/api/bejovo-level": handleBejovo,
};

// A HTML-vazak: a token az URL-ben titok, ezert a vazat mindig ugyanugy, tokenfuggetlenul szolgaljuk ki
// (az oldal maga reagal az API 404-ere), de gyorsitotar-, referrer- es keresomotor-tiltassal.
const SHELLS: Record<string, string> = { r: "/r.html", m: "/m.html", le: "/le.html" };

async function shell(request: Request, env: Env, asset: string): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return withSecurity(new Response("Nem engedélyezett módszer.", { status: 405, headers: { "Content-Type": "text/plain; charset=utf-8" } }));
  }
  let res: Response | null = null;
  try {
    let url = new URL(asset, request.url);
    // Az assets .html-t kiterjesztes nelkuli cimre iranyitja (307): kovessuk.
    for (let i = 0; i < 3; i++) {
      res = await env.ASSETS.fetch(new Request(url, { method: "GET", redirect: "manual" }));
      const loc = res.status >= 300 && res.status < 400 ? res.headers.get("Location") : null;
      if (!loc) break;
      url = new URL(loc, url);
    }
  } catch {
    res = null;
  }
  if (!res || res.status !== 200) {
    return new Response("Az oldal még nincs kész.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" },
    });
  }
  const headers = new Headers();
  headers.set("Content-Type", res.headers.get("Content-Type") ?? "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Robots-Tag", "noindex");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  return new Response(request.method === "HEAD" ? null : res.body, { status: 200, headers });
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname } = new URL(request.url);

    try {
      const h = exact[pathname];
      if (h) return await h(request, env, ctx);

      const sh = /^\/(r|m|le)\/[^/]+\/?$/.exec(pathname);
      if (sh) return await shell(request, env, SHELLS[sh[1]]);
      // Ricsi összesítője és a belépőlink oldala ugyanaz a váz.
      // A dashboard régi neve (/pult) átirányít, hogy a már elküldött linkek ne törjenek el.
      if (/^\/pult\/?$/.test(pathname)) return Response.redirect(new URL("/dashboard", request.url).toString(), 301);
      const pb = /^\/pult\/be\/([^/]+)\/?$/.exec(pathname);
      if (pb) return Response.redirect(new URL(`/dashboard/be/${pb[1]}`, request.url).toString(), 301);
      if (/^\/dashboard\/?$/.test(pathname) || /^\/dashboard\/be\/[^/]+\/?$/.test(pathname)) return await shell(request, env, "/dashboard.html");

      if (pathname.startsWith("/api/")) {
        const parts = pathname.slice("/api/".length).replace(/\/+$/, "").split("/");
        if (parts[0] === "r" && parts.length >= 2) return await handleVevo(request, env, ctx, parts);
        if (parts[0] === "m" && parts.length >= 2) return await handleRicsi(request, env, ctx, parts);
        if (parts[0] === "le" && parts.length >= 2) return await handleLeiratkozas(request, env, ctx, parts);
        if (parts[0] === "dashboard") return await handleDashboard(request, env, ctx, parts);
        return hiba("Nem található.", 404);
      }
    } catch {
      console.log(`[hiba] kezeletlen kivetel`); // az utvonal tokent tartalmazhat: nem logoljuk
      return hiba("Váratlan hiba történt, kérjük, próbáld újra később.", 500);
    }

    // /r/, /m/, /le/ token nelkul vagy tovabbi szegmenssel: nincs ilyen oldal.
    if (/^\/(r|m|le|dashboard)\//.test(pathname)) {
      return withSecurity(new Response("Nem található.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } }));
    }
    // Ide csak a run_worker_first mintakon kivuli utak jutnak (elvileg soha); biztonsagi halo.
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx): Promise<void> {
    ctx.waitUntil(
      futtatCron(env, new Date(controller.scheduledTime)).then(
        () => undefined,
        () => console.log("[cron] hiba"),
      ),
    );
  },
} satisfies ExportedHandler<Env>;
