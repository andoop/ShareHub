import { describe, expect, it } from "vitest";
import { RuntimeEvents } from "../src/events.js";
import { createHttpServer } from "../src/http.js";
import { createTempRepo } from "./helpers.js";

describe("durable device pairing", () => {
  it("keeps the paired token valid across a server restart", async () => {
    const { paths } = await createTempRepo();

    const app1 = await createHttpServer(paths, new RuntimeEvents(), async () => {});
    const start = await app1.inject({ method: "POST", url: "/mobile-sync/start", payload: {} });
    const code = (start.json() as { code: string }).code;
    const claim = await app1.inject({ method: "POST", url: "/pair/by-code", payload: { code } });
    const token = (claim.json() as { token: string }).token;
    expect((await app1.inject({ method: "GET", url: `/sessions?token=${token}` })).statusCode).toBe(200);
    await app1.close();

    // "Restart": a brand-new server over the same runtime paths with a fresh
    // in-memory pairing registry. The token must still authorize.
    const app2 = await createHttpServer(paths, new RuntimeEvents(), async () => {});
    expect((await app2.inject({ method: "GET", url: `/sessions?token=${token}` })).statusCode).toBe(200);
    expect((await app2.inject({ method: "GET", url: "/sessions?token=nope" })).statusCode).toBe(401);
    await app2.close();
  });

  it("persists QR pairing tokens too", async () => {
    const { paths } = await createTempRepo();

    const app1 = await createHttpServer(paths, new RuntimeEvents(), async () => {});
    const pairing = await app1.inject({ method: "GET", url: "/pairing?feature=feature-a" });
    const token = (pairing.json() as { token: string }).token;
    await app1.close();

    const app2 = await createHttpServer(paths, new RuntimeEvents(), async () => {});
    expect((await app2.inject({ method: "GET", url: `/sessions?token=${token}` })).statusCode).toBe(200);
    await app2.close();
  });
});