export interface PairingSession {
  feature: string;
  sessionId?: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  paired: boolean;
  pairedAt?: string;
}

export interface PinSession extends PairingSession {
  code: string;
}

const PIN_TTL_MS = 10 * 60_000;

export class PairingRegistry {
  private readonly byToken = new Map<string, PairingSession>();
  private readonly byCode = new Map<string, PinSession>();

  createPinSession(feature: string, token: string, sessionId?: string): PinSession {
    this.pruneExpired();
    const code = this.generateUniqueCode();
    const now = Date.now();
    const session: PinSession = {
      code,
      feature,
      sessionId,
      token,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + PIN_TTL_MS).toISOString(),
      paired: false
    };
    this.byCode.set(code, session);
    this.byToken.set(token, session);
    return session;
  }

  registerTokenSession(feature: string, token: string, sessionId?: string): PairingSession {
    const now = Date.now();
    const session: PairingSession = {
      feature,
      sessionId,
      token,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + PIN_TTL_MS).toISOString(),
      paired: false
    };
    this.byToken.set(token, session);
    return session;
  }

  claimByCode(code: string): PinSession | null {
    this.pruneExpired();
    const session = this.byCode.get(code);
    if (!session || session.paired) return null;
    session.paired = true;
    session.pairedAt = new Date().toISOString();
    this.byCode.delete(code);
    return session;
  }

  getByToken(token: string, feature: string): PairingSession | undefined {
    this.pruneExpired();
    const session = this.byToken.get(token);
    if (!session || session.feature !== feature) return undefined;
    return session;
  }

  getToken(token: string): PairingSession | undefined {
    this.pruneExpired();
    return this.byToken.get(token);
  }

  activePin(): PinSession | null {
    this.pruneExpired();
    for (const session of this.byCode.values()) {
      if (!session.paired) return session;
    }
    return null;
  }

  clear(): void {
    this.byToken.clear();
    this.byCode.clear();
  }

  private generateUniqueCode(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      if (!this.byCode.has(code)) return code;
    }
    throw new Error("unable to allocate unique pairing code");
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [token, session] of this.byToken.entries()) {
      if (Date.parse(session.expiresAt) <= now) {
        this.byToken.delete(token);
        if ("code" in session) {
          this.byCode.delete((session as PinSession).code);
        }
      }
    }
  }
}
