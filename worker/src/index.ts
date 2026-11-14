import type { Env } from "./env";
import { handleBejovo } from "./bejovo";
import { handleIgeny } from "./igeny";
import { hiba, withSecurity } from "./util";

type Handler = (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response> | Response;

// Pontos API-utak. A /r/*, /m/*, /le/* a 2. korhoz fenntartott (prefix-utak).
const exact: Record<string, Handler> = {
  "/api/igeny": handleIgeny,
  "/api/bejovo-level": handleBejovo,
};

const reserved: Record<string, Handler> = {
  "/r/": notFound,
  "/m/": notFound,
  "/le/": notFound,
};

function notFound(): Response {
  return withSecurity(new Response("Nem található.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } }));
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname } = new URL(request.url);

    const h = exact[pathname];
    if (h) {
      try {
        return await h(request, env, ctx);
      } catch {
        console.log(`[hiba] kezeletlen kivetel: ${pathname}`);
        return hiba("Váratlan hiba történt, kérjük, próbálja újra később.", 500);
      }
    }
    for (const [prefix, rh] of Object.entries(reserved)) {
      if (pathname.startsWith(prefix)) return rh(request, env, ctx);
    }
    if (pathname.startsWith("/api/")) return hiba("Nem található.", 404);

    // Ide csak a run_worker_first mintakon kivuli utak jutnak (elvileg soha); biztonsagi halo.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
