import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  createSessionToken,
  enforceSameOrigin,
  verifySessionToken,
} from "@/lib/security";

describe("SCAR signed demo sessions", () => {
  it("accepts a valid token for the matching bank", () => {
    const issuedAt = Date.now();
    const token = createSessionToken("scar-demo-valid-bank", issuedAt);

    expect(verifySessionToken("scar-demo-valid-bank", token, issuedAt + 1_000)).toBe(true);
  });

  it("rejects a token used for another bank", () => {
    const token = createSessionToken("scar-demo-valid-bank");

    expect(verifySessionToken("scar-demo-attacker-bank", token)).toBe(false);
  });

  it("rejects forged and expired tokens", () => {
    const issuedAt = Date.now() - 3 * 60 * 60 * 1_000;
    const expired = createSessionToken("scar-demo-expired-bank", issuedAt);

    expect(verifySessionToken("scar-demo-expired-bank", expired)).toBe(false);
    expect(verifySessionToken("scar-demo-expired-bank", `${issuedAt}.forged`)).toBe(false);
  });
});

describe("SCAR same-origin enforcement", () => {
  it("allows same-origin browser requests", () => {
    const request = new NextRequest("https://scar.example/api/demo/start", {
      method: "POST",
      headers: { origin: "https://scar.example" },
    });

    expect(enforceSameOrigin(request)).toBeNull();
  });

  it("rejects cross-origin browser requests", () => {
    const request = new NextRequest("https://scar.example/api/demo/start", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    });

    expect(enforceSameOrigin(request)?.status).toBe(403);
  });
});
