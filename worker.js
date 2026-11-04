const ALLOWED_ORIGINS = [
  "https://najkloo.github.io",
  "https://bad-ekstra.pages.dev"
];
const API_HOST = "https://sportapi.ai";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response(null, {status:403});
      return new Response(null, {status:204, headers:cors});
    }
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return Response.json({success:false,message:"Origin not allowed."},{status:403,headers:cors});
    }
    if (request.method !== "GET") {
      return Response.json({success:false,message:"Method not allowed."},{status:405,headers:cors});
    }
    if (!env.SPORTAPI_KEY) {
      return Response.json({success:false,message:"SPORTAPI_KEY is not configured."},{status:500,headers:cors});
    }

    const path=url.pathname;
    const allowedPath =
      path === "/api/leagues" ||
      /^\/api\/standings\/[0-9]+$/.test(path) ||
      /^\/api\/fixtures\/date\/[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(path) ||
      /^\/api\/fixtures\/[0-9]+\/stats$/.test(path) ||
      /^\/api\/fixtures\/[0-9]+\/events$/.test(path);

    if (!allowedPath) return Response.json({success:false,message:"Endpoint not allowed."},{status:404,headers:cors});

    const upstreamUrl=API_HOST+path+url.search;
    const cacheKey=new Request(upstreamUrl,{method:"GET"});
    const cache=caches.default;

    try {
      const cached=await cache.match(cacheKey);
      if(cached){
        const headers=new Headers(cached.headers);
        Object.entries(cors).forEach(([k,v])=>headers.set(k,v));
        headers.set("X-API-Cache","HIT");
        return new Response(cached.body,{status:cached.status,headers});
      }
      const upstream=await fetch(upstreamUrl,{
        method:"GET",
        headers:{"X-Api-Key":env.SPORTAPI_KEY,"Accept":"application/json"}
      });
      const body=await upstream.text();
      const headers=new Headers(cors);
      headers.set("Content-Type",upstream.headers.get("Content-Type")||"application/json");
      headers.set("Cache-Control","no-store");
      headers.set("X-API-Cache","MISS");
      const response=new Response(body,{status:upstream.status,headers});

      if(upstream.ok){
        const cacheHeaders=new Headers(headers);
        const isHistorical =
          path.includes("/stats") || path.includes("/events") ||
          (path.includes("/fixtures/date/") && path.slice(-10)<new Date().toISOString().slice(0,10));
        cacheHeaders.set("Cache-Control",`public, max-age=${isHistorical?21600:60}`);
        ctx.waitUntil(cache.put(cacheKey,new Response(body,{status:upstream.status,headers:cacheHeaders})));
      }
      return response;
    } catch(error) {
      return Response.json({success:false,message:"SportAPI connection failed.",detail:String(error.message||error)},{status:502,headers:cors});
    }
  }
};
