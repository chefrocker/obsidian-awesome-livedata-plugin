import { requestUrl } from "obsidian";
import type { WidgetConfig } from "../parser/block-parser";
import { parseJsonPath } from "../util/json-path";
import type { Logger } from "../util/logger";

interface CacheEntry {
    value: unknown;
    timestamp: number;
}

export class RestClient {
    private cache: Map<string, CacheEntry> = new Map();

    constructor(
        private settingsRef: { enableCaching: boolean; cacheTimeout: number; maxRetries: number },
        private logger: Logger,
    ) {}

    private cacheKey(cfg: WidgetConfig): string {
        return `${cfg.url}::${cfg.path ?? ""}`;
    }

    async fetch(cfg: WidgetConfig): Promise<{ value: unknown; cached: boolean; timestamp: number }> {
        if (!cfg.url) throw new Error("REST config missing url");

        const key = this.cacheKey(cfg);
        if (this.settingsRef.enableCaching) {
            const cached = this.cache.get(key);
            if (cached && (Date.now() - cached.timestamp) / 1000 < this.settingsRef.cacheTimeout) {
                return { value: cached.value, cached: true, timestamp: cached.timestamp };
            }
        }

        let lastErr: unknown;
        for (let attempt = 0; attempt <= this.settingsRef.maxRetries; attempt++) {
            try {
                const res = await requestUrl({
                    url: cfg.url,
                    method: cfg.method ?? "GET",
                    headers: cfg.headers,
                    body: cfg.body,
                });
                const contentType = (res.headers["content-type"] ?? res.headers["Content-Type"] ?? "").toString();
                let value: unknown;
                if (contentType.includes("application/json")) {
                    value = cfg.path && cfg.path !== "value"
                        ? parseJsonPath(res.json, cfg.path)
                        : (typeof res.json === "object" ? JSON.stringify(res.json, null, 2) : res.json);
                } else {
                    value = cfg.path && cfg.path !== "value"
                        ? parseJsonPath(res.text, cfg.path)
                        : res.text;
                }
                const entry = { value, timestamp: Date.now() };
                this.cache.set(key, entry);
                return { value, cached: false, timestamp: entry.timestamp };
            } catch (e) {
                lastErr = e;
                this.logger.debug(`REST retry ${attempt + 1}/${this.settingsRef.maxRetries}`, e);
                if (attempt < this.settingsRef.maxRetries) {
                    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                }
            }
        }
        throw lastErr;
    }
}
