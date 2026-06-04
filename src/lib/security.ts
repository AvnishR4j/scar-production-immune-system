import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";

const MAX_JSON_BYTES = 4_096;
const SESSION_TTL_MS = 2 * 60 * 60 * 1_000;
const RATE_WINDOW_MS = 10 * 60 * 1_000;

type RateEntry = {
  count: number;
  resetAt: number;
};

const rateStore = new Map<string, RateEntry>();

function sessionSecret() {
  return (
    process.env.SCAR_SESSION_SECRET ||
    process.env.HINDSIGHT_API_KEY ||
    process.env.GROQ_API_KEY ||
    "scar-local-demo-only-no-paid-provider"
  );
}

function signature(bankId: string, issuedAt: number) {
  return createHmac("sha256", sessionSecret())
    .update(`${bankId}:${issuedAt}`)
    .digest("base64url");
}

export function createSessionToken(bankId: string, issuedAt = Date.now()) {
  return `${issuedAt}.${signature(bankId, issuedAt)}`;
}

export function verifySessionToken(bankId: string, token: string, now = Date.now()) {
  const [issuedAtRaw, receivedSignature, extra] = token.split(".");
  if (!issuedAtRaw || !receivedSignature || extra) return false;

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now + 60_000) return false;
  if (now - issuedAt > SESSION_TTL_MS) return false;

  const expected = Buffer.from(signature(bankId, issuedAt));
  const received = Buffer.from(receivedSignature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export function enforceRateLimit(
  request: NextRequest,
  scope: string,
  limit: number,
): NextResponse | null {
  const now = Date.now();
  if (rateStore.size > 5_000) {
    for (const [storedKey, entry] of rateStore) {
      if (entry.resetAt <= now || rateStore.size > 4_000) rateStore.delete(storedKey);
    }
  }

  const key = `${scope}:${clientKey(request)}`;
  const current = rateStore.get(key);

  if (!current || current.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return null;
  }

  current.count += 1;
  if (current.count <= limit) return null;

  return NextResponse.json(
    { error: "Too many demo requests. Try again shortly." },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(Math.ceil((current.resetAt - now) / 1_000)),
      },
    },
  );
}

export function enforceSameOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  try {
    if (new URL(origin).origin === request.nextUrl.origin) return null;
  } catch {
    // Invalid origins are rejected below.
  }

  return NextResponse.json(
    { error: "Cross-origin requests are not allowed." },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

export async function parseJsonBody<T>(
  request: NextRequest,
  schema: ZodType<T>,
): Promise<{ data: T } | { response: NextResponse }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return {
      response: NextResponse.json(
        { error: "Content-Type must be application/json." },
        { status: 415, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
    return {
      response: NextResponse.json(
        { error: "Request body is too large." },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > MAX_JSON_BYTES) {
      return {
        response: NextResponse.json(
          { error: "Request body is too large." },
          { status: 413, headers: { "Cache-Control": "no-store" } },
        ),
      };
    }

    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      return {
        response: NextResponse.json(
          { error: "Invalid request." },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        ),
      };
    }

    return { data: parsed.data };
  } catch {
    return {
      response: NextResponse.json(
        { error: "Invalid JSON request." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
}

export function noStoreJson(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(data, { ...init, headers });
}
