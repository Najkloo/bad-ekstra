const ALLOWED_ORIGINS = [
  "https://najkloo.github.io",
  "https://bad-ekstra.pages.dev"
];

const SPORTAPI_HOST = "https://sportapi.ai";
const REFEREE_SOURCE_URL = "https://zawodtyper.pl/wp-content/NP_ajax.php";
const REFEREE_LEAGUE_ID = 106;
const REFEREE_SEASON_KEY = "referees:ekstraklasa:latest";
const REFEREE_META_KEY = "referees:ekstraklasa:meta";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function jsonResponse(data, status, cors) {
  return Response.json(data, {
    status,
    headers: { ...cors, "Cache-Control": "no-store" }
  });
}

function jsonError(message, status, cors, detail) {
  return jsonResponse({ success: false, message, ...(detail ? { detail } : {}) }, status, cors);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeReferees(payload) {
  if (!payload || payload.success !== true || !Array.isArray(payload.data)) {
    throw new Error("Źródło zwróciło nieoczekiwany format danych.");
  }

  const rows = payload.data.map((row) => ({
    refereeId: String(row.referee_id ?? ""),
    name: String(row.referee_display_name ?? "").trim(),
    allNames: String(row.all_names ?? ""),
    season: String(row.season ?? ""),
    leagueId: String(row.league_id ?? REFEREE_LEAGUE_ID),
    matches: toNumber(row.matches),
    yellowCards: toNumber(row.yellow_cards),
    redCards: toNumber(row.red_cards),
    penalties: toNumber(row.penalties),
    fouls: toNumber(row.fouls)
  })).filter((row) => row.refereeId && row.name);

  if (!rows.length) throw new Error("Źródło nie zwróciło żadnych poprawnych rekordów sędziów.");
  if (rows.some((row) => row.leagueId !== String(REFEREE_LEAGUE_ID))) {
    throw new Error("Odpowiedź zawiera rekordy z innej ligi niż Ekstraklasa.");
  }
  return rows;
}

async function refreshRefereeData(env) {
  if (!env.REFEREE_CACHE) throw new Error("Brak bindingu REFEREE_CACHE w środowisku Workera.");

  const response = await fetch(REFEREE_SOURCE_URL, {
    method: "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: "api_get_referee_stats", league_id: REFEREE_LEAGUE_ID }),
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) throw new Error(`Zawód Typer zwrócił HTTP ${response.status}.`);
  const payload = await response.json();
  const referees = normalizeReferees(payload);
  const snapshot = {
    success: true,
    source: "Zawód Typer",
    league: "PKO BP Ekstraklasa",
    leagueId: REFEREE_LEAGUE_ID,
    season: referees[0]?.season || null,
    updatedAt: new Date().toISOString(),
    count: referees.length,
    data: referees
  };

  // Zapis następuje dopiero po walidacji całej odpowiedzi; poprzedni snapshot pozostaje przy błędzie.
  await env.REFEREE_CACHE.put(REFEREE_SEASON_KEY, JSON.stringify(snapshot));
  await env.REFEREE_CACHE.put(REFEREE_META_KEY, JSON.stringify({
    updatedAt: snapshot.updatedAt,
    count: snapshot.count,
    season: snapshot.season,
    source: snapshot.source,
    leagueId: snapshot.leagueId
  }));
  return snapshot;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors });
    }
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return jsonError("Origin not allowed.", 403, cors);

    // Ręczne odświeżanie. Token jest wymagany; nie umieszczaj go w kodzie strony ani repozytorium.
    if (path === "/api/referees/refresh") {
      if (request.method !== "POST") return jsonError("Method not allowed.", 405, cors);
      if (!env.REFEREE_REFRESH_TOKEN) return jsonError("REFEREE_REFRESH_TOKEN is not configured.", 500, cors);
      const authorization = request.headers.get("Authorization") || "";
      if (authorization !== `Bearer ${env.REFEREE_REFRESH_TOKEN}`) return jsonError("Unauthorized.", 401, cors);
      try {
        const snapshot = await refreshRefereeData(env);
        return jsonResponse({
          success: true,
          message: "Statystyki sędziów zostały zaktualizowane.",
          updatedAt: snapshot.updatedAt,
          count: snapshot.count,
          season: snapshot.season,
          data: snapshot.data
        }, 200, cors);
      } catch (error) {
        console.error("Manual referee refresh failed:", error);
        return jsonError("Nie udało się zaktualizować statystyk sędziów.", 502, cors, String(error.message || error));
      }
    }

    if (request.method !== "GET") return jsonError("Method not allowed.", 405, cors);

    if (path === "/api/referees") {
      if (!env.REFEREE_CACHE) return jsonError("REFEREE_CACHE is not configured in Cloudflare.", 503, cors);
      try {
        const stored = await env.REFEREE_CACHE.get(REFEREE_SEASON_KEY);
        if (!stored) {
          return jsonResponse({ success: true, available: false, message: "Brak zapisanych statystyk sędziów. Wykonaj ręczną aktualizację." }, 200, cors);
        }
        return jsonResponse(JSON.parse(stored), 200, cors);
      } catch (error) {
        return jsonError("Nie udało się odczytać statystyk sędziów.", 500, cors, String(error.message || error));
      }
    }

    const isSportRoute =
      path === "/api/leagues" ||
      /^\/api\/standings\/[0-9]+$/.test(path) ||
      /^\/api\/fixtures\/date\/[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(path) ||
      /^\/api\/fixtures\/[0-9]+\/(stats|events)$/.test(path);

    if (!isSportRoute) return jsonError("Endpoint not allowed.", 404, cors);
    if (!env.SPORTAPI_KEY) return jsonError("SPORTAPI_KEY is not configured.", 500, cors);

    const upstreamUrl = SPORTAPI_HOST + path + url.search;
    const upstreamHeaders = { "Accept": "application/json", "X-Api-Key": env.SPORTAPI_KEY };
    let cacheSeconds = path.includes("/stats") || path.includes("/events") ? 21600 : 60;
    if (path.includes("/fixtures/date/") && path.slice(-10) < new Date().toISOString().slice(0, 10)) cacheSeconds = 21600;

    const cacheKey = new Request(upstreamUrl, { method: "GET" });
    const cache = caches.default;
    try {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const headers = new Headers(cached.headers);
        Object.entries(cors).forEach(([key, value]) => headers.set(key, value));
        headers.set("X-API-Cache", "HIT");
        return new Response(cached.body, { status: cached.status, headers });
      }

      const upstream = await fetch(upstreamUrl, { method: "GET", headers: upstreamHeaders });
      const body = await upstream.text();
      const headers = new Headers(cors);
      headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");
      headers.set("Cache-Control", "no-store");
      headers.set("X-API-Cache", "MISS");
      const result = new Response(body, { status: upstream.status, headers });
      if (upstream.ok) {
        const cacheHeaders = new Headers(headers);
        cacheHeaders.set("Cache-Control", `public, max-age=${cacheSeconds}`);
        ctx.waitUntil(cache.put(cacheKey, new Response(body, { status: upstream.status, headers: cacheHeaders })));
      }
      return result;
    } catch (error) {
      return jsonError("SportAPI connection failed.", 502, cors, String(error.message || error));
    }
  },

  // Funkcja pozostaje gotowa do użycia po ponownym dodaniu Cron Trigger.
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const snapshot = await refreshRefereeData(env);
        console.log(`Referee stats updated: ${snapshot.count} referees, season ${snapshot.season || "unknown"}.`);
      } catch (error) {
        console.error("Referee stats refresh failed:", error);
      }
    })());
  }
};
