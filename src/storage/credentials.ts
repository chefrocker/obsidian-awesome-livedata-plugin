import { Platform } from "obsidian";

export interface Credentials {
    username: string;
    password: string;
}

interface SafeStorage {
    isEncryptionAvailable(): boolean;
    encryptString(plain: string): Buffer;
    decryptString(buf: Buffer): string;
}

function getSafeStorage(): SafeStorage | null {
    if (!Platform.isDesktop) return null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const electron = (window as any).require?.("electron");
        const ss: SafeStorage | undefined = electron?.remote?.safeStorage ?? electron?.safeStorage;
        if (ss && ss.isEncryptionAvailable()) return ss;
    } catch {
        /* ignore */
    }
    return null;
}

export function canPersistCredentials(): boolean {
    return getSafeStorage() !== null;
}

export function encryptCredentials(creds: Credentials): string | null {
    const ss = getSafeStorage();
    if (!ss) return null;
    const buf = ss.encryptString(JSON.stringify(creds));
    return buf.toString("base64");
}

export function decryptCredentials(b64: string): Credentials | null {
    const ss = getSafeStorage();
    if (!ss || !b64) return null;
    try {
        const buf = Buffer.from(b64, "base64");
        const plain = ss.decryptString(buf);
        const parsed = JSON.parse(plain);
        return { username: parsed.username ?? "", password: parsed.password ?? "" };
    } catch {
        return null;
    }
}

export function zeroize(creds: Credentials): void {
    creds.username = "";
    creds.password = "";
}
