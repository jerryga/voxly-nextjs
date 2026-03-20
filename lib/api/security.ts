import { NextResponse } from "next/server";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  __voxlyRateLimitStore?: Map<string, RateLimitEntry>;
};

const rateLimitStore =
  globalForRateLimit.__voxlyRateLimitStore ??
  new Map<string, RateLimitEntry>();

if (!globalForRateLimit.__voxlyRateLimitStore) {
  globalForRateLimit.__voxlyRateLimitStore = rateLimitStore;
}

function getRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins(request: Request) {
  const allowed = new Set<string>();

  try {
    allowed.add(new URL(request.url).origin);
  } catch {
    // Ignore malformed request URL; callers will handle null origin checks.
  }

  const publicUrl = process.env.NEXTAUTH_URL?.trim();
  if (publicUrl) {
    try {
      allowed.add(new URL(publicUrl).origin);
    } catch {
      // Ignore malformed NEXTAUTH_URL.
    }
  }

  const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];
  for (const origin of configuredOrigins) {
    const trimmed = origin.trim();
    if (!trimmed) continue;

    try {
      allowed.add(new URL(trimmed).origin);
    } catch {
      // Ignore malformed configured origins.
    }
  }

  return allowed;
}

export function enforceSameOrigin(request: Request) {
  const requestOrigin = getRequestOrigin(request);
  if (!requestOrigin) return null;

  const allowedOrigins = getAllowedOrigins(request);
  if (allowedOrigins.has(requestOrigin)) {
    return null;
  }

  return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") || "unknown";
}

export function enforceRateLimit(
  request: Request,
  key: string,
  {
    limit,
    windowMs,
  }: {
    limit: number;
    windowMs: number;
  },
) {
  const now = Date.now();
  const bucketKey = `${key}:${getClientIp(request)}`;
  const existing = rateLimitStore.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (existing.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  existing.count += 1;
  rateLimitStore.set(bucketKey, existing);
  return null;
}
