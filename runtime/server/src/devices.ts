import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RuntimePaths } from "./types.js";

export interface PairedDevice {
  token: string;
  label?: string;
  pairedAt: string;
}

interface DeviceFile {
  version: 1;
  devices: PairedDevice[];
}

const MAX_DEVICES = 20;

/**
 * Durable registry of paired device tokens, persisted to
 * `.sandtable-runtime/session/devices.json`.
 *
 * The short-lived PIN handshake lives in {@link PairingRegistry}; once a device
 * successfully pairs, its access token is promoted here so it keeps working
 * across server restarts — the phone does not need to pair again as long as the
 * runtime data survives. Tokens are validated in memory (loaded on startup) and
 * mirrored to disk on every change.
 */
export class DeviceRegistry {
  private readonly tokens = new Set<string>();
  private devices: PairedDevice[] = [];

  constructor(private readonly paths: RuntimePaths) {}

  private file(): string {
    return path.join(this.paths.session, "devices.json");
  }

  /** Load persisted tokens into memory. Call once before serving requests. */
  async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.file(), "utf8")) as DeviceFile;
      this.devices = Array.isArray(parsed.devices) ? parsed.devices : [];
    } catch {
      this.devices = [];
    }
    this.tokens.clear();
    for (const device of this.devices) {
      if (device.token) this.tokens.add(device.token);
    }
  }

  has(token: string): boolean {
    return this.tokens.has(token);
  }

  /** Persist a newly paired device token (idempotent, capped, newest-first). */
  async add(token: string, label?: string): Promise<void> {
    if (!token || this.tokens.has(token)) return;
    this.devices.push({ token, label, pairedAt: new Date().toISOString() });
    this.tokens.add(token);
    if (this.devices.length > MAX_DEVICES) {
      const removed = this.devices.splice(0, this.devices.length - MAX_DEVICES);
      for (const device of removed) this.tokens.delete(device.token);
    }
    await this.persist();
  }

  async clearAll(): Promise<void> {
    this.devices = [];
    this.tokens.clear();
    await this.persist();
  }

  private async persist(): Promise<void> {
    await mkdir(this.paths.session, { recursive: true });
    await writeFile(
      this.file(),
      `${JSON.stringify({ version: 1, devices: this.devices }, null, 2)}\n`,
      "utf8"
    );
  }
}
