import { NextRequest, NextResponse } from "next/server";

/**
 * CORS for /api/v1: the mobile app's web build (and any future SPA host)
 * calls the API cross-origin with Bearer auth — no cookies, so a permissive
 * origin is safe here.
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-max-age": "86400",
};

export function middleware(req: NextRequest) {
  if (req.method === "OPTIONS")
    return new NextResponse(null, { status: 204, headers: CORS });
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
}

export const config = { matcher: "/api/:path*" };
