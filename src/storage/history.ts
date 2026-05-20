export interface HistoryEntry {
    timestamp: number;
    value: number;
}

const DB_NAME = "LiveDataHub";
const STORE_NAME = "history";

export class HistoryStore {
    private db: IDBDatabase | null = null;
    private ready = false;

    async init(): Promise<void> {
        if (this.ready) return;
        try {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: ["key", "timestamp"] });
                }
            };
            this.db = await new Promise((res, rej) => {
                req.onsuccess = () => res(req.result);
                req.onerror = () => rej(req.error);
            });
            this.ready = true;
        } catch {
            this.ready = true;
        }
    }

    async append(key: string, value: number): Promise<void> {
        if (!this.db) return;
        const tx = this.db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.add({ key, timestamp: Date.now(), value });
    }

    async getRecent(key: string, maxAgeMs: number): Promise<HistoryEntry[]> {
        if (!this.db) return [];
        const since = Date.now() - maxAgeMs;
        const tx = this.db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const range = IDBKeyRange.lowerBound([key, since], true);
        return new Promise((res, rej) => {
            const req = store.getAll(range);
            req.onsuccess = () => res(req.result as HistoryEntry[]);
            req.onerror = () => rej(req.error);
        });
    }

    async clearOld(maxAgeMs: number): Promise<void> {
        if (!this.db) return;
        const until = Date.now() - maxAgeMs;
        const tx = this.db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const range = IDBKeyRange.upperBound(["￿", until], true);
        store.delete(range);
    }

    async exportCsv(key: string): Promise<string> {
        const hist = await this.getRecent(key, Infinity);
        const lines = ["timestamp,value", ...hist.map(e => `${e.timestamp},${e.value}`)];
        return lines.join("\n");
    }
}
