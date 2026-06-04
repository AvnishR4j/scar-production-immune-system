import { NextRequest, NextResponse } from "next/server";
import { apiError, sessionSchema } from "@/lib/api";
import { fallbackRetainResult, retainIncident } from "@/lib/hindsight";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const parsed = sessionSchema.safeParse(await request.json());
  if (!parsed.success) return apiError("Invalid memory-bank session.");

  try {
    return NextResponse.json(await retainIncident(parsed.data.bankId));
  } catch {
    return NextResponse.json(fallbackRetainResult());
  }
}
