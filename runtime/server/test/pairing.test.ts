import { describe, expect, it } from "vitest";
import { PairingRegistry } from "../src/pairing.js";

describe("PairingRegistry", () => {
  it("creates unique 4-digit codes and claims once", () => {
    const registry = new PairingRegistry();
    const session = registry.createPinSession("feature-a", "token-a");
    expect(session.code).toMatch(/^\d{4}$/);
    expect(registry.claimByCode(session.code)?.token).toBe("token-a");
    expect(registry.claimByCode(session.code)).toBeNull();
  });

  it("validates token against feature", () => {
    const registry = new PairingRegistry();
    registry.registerTokenSession("feature-a", "token-a");
    expect(registry.getByToken("token-a", "feature-a")).toBeTruthy();
    expect(registry.getByToken("token-a", "feature-b")).toBeUndefined();
  });
});
