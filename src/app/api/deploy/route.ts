import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { incidentRecord } from "@/lib/scenarios";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { scenarioId?: string };
  if (body.scenarioId !== "payment-retry-incident") {
    return apiError("Only the cold-start deployment can be simulated.");
  }

  return NextResponse.json({
    incident: incidentRecord,
    status: "OUTAGE",
    affectedUsers: "38,412",
    checkoutSuccessRate: "12.4%",
    provider429Rate: "87.1%",
    startedAt: new Date().toISOString(),
  });
}
