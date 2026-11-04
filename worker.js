const ALLOWED_ORIGIN = "https://najkloo.github.io";
const API_HOST = "https://sportapi.ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (origin && origin !== ALLOWED_ORIGIN) {
      return Response.json({ success: false, message: "Origin not allowed." }, {
        status: 403, headers: corsHeaders
      });
    }

    if (request.method !== "GET") {
      return Response.json({ success: false, message: "Method not allowed." }, {
        status: 405, headers: corsHeaders
      });
    }

    if (!env.SPORTAPI_KEY) {
      return Response.json({ success: false, message: "SPORTAPI_KEY is not configured." }, {
        status: 500, headers: corsHeaders
      });
    }

    const path = url.pathname;
    const allowedPath =
      path === "/api/leagues" ||
      /^\/api\/standings\/[0-9]+$/.test(path) ||
      /^\/api\/fixtures\/date\/[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(path) ||
      /^\/api\/fixtures\/[0-9]+\/stats$/.test(path);

    if (!allowedPath) {
      return Response.json({ success: false, message: "Endpoint not allowed." }, {
        status: 404, headers: corsHeaders
      });
    }

    const upstreamUrl = API_HOST + path + url.search;
    const cacheKey = new Request(upstreamUrl, { method: "GET" });
    const cache = caches.default;

    try {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const headers = new Headers(cached.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
        headers.set("X-API-Cache", "HIT");
        return new Response(cached.body, { status: cached.status, headers });
      }

      const upstream = await fetch(upstreamUrl, {
        method: "GET",
        headers: {
          "X-Api-Key": env.SPORTAPI_KEY,
          "Accept": "application/json"
        }
      });

      const body = await upstream.text();
      const headers = new Headers(corsHeaders);
      headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");
      headers.set("Cache-Control", "no-store");
      headers.set("X-API-Cache", "MISS");

      const response = new Response(body, { status: upstream.status, headers });

      if (upstream.ok) {
        const cacheHeaders = new Headers(headers);
        cacheHeaders.set("Cache-Control", "public, max-age=120");
        ctx.waitUntil(cache.put(cacheKey, new Response(body, {
          status: upstream.status, headers: cacheHeaders
        })));
      }

      return response;
    } catch (error) {
      return Response.json({
        success: false,
        message: "SportAPI connection failed.",
        detail: String(error.message || error)
      }, { status: 502, headers: corsHeaders });
    }
  }
};
