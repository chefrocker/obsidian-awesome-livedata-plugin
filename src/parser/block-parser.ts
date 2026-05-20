export type WidgetSource = "mqtt" | "rest";
export type DisplayType = "number" | "text" | "badge" | "toggle" | "gauge" | "sparkline" | "progress";

export interface WidgetConfig {
    source: WidgetSource;
    display: DisplayType;
    label?: string;
    unit?: string;
    icon?: string;
    path?: string;
    timestamp?: "relative" | "absolute" | "both" | "hidden";
    statusThresholds?: { live: number; stale: number };
    readonly?: boolean;

    // MQTT
    topic?: string;
    qos?: 0 | 1 | 2;
    publishTopic?: string;

    // REST
    url?: string;
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    body?: string;
    interval?: number;

    // Advanced
    colorRanges?: string; // "min:max:color;..." e.g. "0:50:green;50:100:red"
    alertThreshold?: number;
    alertCondition?: "<" | ">" | "==" | "!=";
    historyRetentionMs?: number;

    raw: Record<string, string>;
}

export interface ParseResult {
    config?: WidgetConfig;
    errors: string[];
}

const VALID_DISPLAY: DisplayType[] = ["number", "text", "badge", "toggle", "gauge", "sparkline", "progress"];

function parseKeyValue(source: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const rawLine of source.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const i = line.indexOf(":");
        if (i < 0) continue;
        const key = line.substring(0, i).trim();
        const value = line.substring(i + 1).trim();
        if (key) out[key] = value;
    }
    return out;
}

function parseHeaders(raw: string | undefined): Record<string, string> | undefined {
    if (!raw) return undefined;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed as Record<string, string>;
    } catch {
        /* fall through */
    }
    const result: Record<string, string> = {};
    for (const part of raw.split(",")) {
        const [k, ...rest] = part.split(":");
        if (k && rest.length) result[k.trim()] = rest.join(":").trim();
    }
    return Object.keys(result).length ? result : undefined;
}

function parseStatusThresholds(raw: string | undefined): { live: number; stale: number } | undefined {
    if (!raw) return undefined;
    const parts = raw.split("/").map(s => parseInt(s.trim(), 10));
    if (parts.length >= 2 && parts.slice(0, 2).every(n => Number.isFinite(n))) {
        return { live: parts[0], stale: parts[1] };
    }
    return undefined;
}

export function parseLiveDataBlock(source: string): ParseResult {
    const raw = parseKeyValue(source);
    const errors: string[] = [];

    const src = raw.source as WidgetSource | undefined;
    if (src !== "mqtt" && src !== "rest") {
        errors.push('Missing or invalid `source:` (expected `mqtt` or `rest`).');
        return { errors };
    }

    const display = (raw.display ?? "number") as DisplayType;
    if (!VALID_DISPLAY.includes(display)) {
        errors.push(`Invalid display: ${display}. Allowed: ${VALID_DISPLAY.join(", ")}.`);
    }

    const cfg: WidgetConfig = {
        source: src,
        display,
        label: raw.label,
        unit: raw.unit,
        icon: raw.icon,
        path: raw.path,
        timestamp: (raw.timestamp as WidgetConfig["timestamp"]) ?? "relative",
        statusThresholds: parseStatusThresholds(raw.status),
        readonly: raw.readonly === "true",
        colorRanges: raw.colorRanges,
        alertThreshold: raw.alertThreshold ? parseFloat(raw.alertThreshold) : undefined,
        alertCondition: (raw.alertCondition as any),
        historyRetentionMs: raw.historyRetentionMs ? parseFloat(raw.historyRetentionMs) * 1000 : undefined,
        raw,
    };

    if (src === "mqtt") {
        if (!raw.topic) errors.push("MQTT block requires `topic:`.");
        cfg.topic = raw.topic;
        cfg.publishTopic = raw.publishTopic;
        const qos = parseInt(raw.qos ?? "", 10);
        if (qos === 0 || qos === 1 || qos === 2) cfg.qos = qos;
    } else {
        if (!raw.url) errors.push("REST block requires `url:`.");
        cfg.url = raw.url;
        cfg.method = (raw.method?.toUpperCase() as "GET" | "POST") ?? "GET";
        cfg.headers = parseHeaders(raw.headers);
        cfg.body = raw.body;
        const iv = parseInt(raw.interval ?? "", 10);
        if (Number.isFinite(iv) && iv > 0) cfg.interval = iv;
    }

    if (errors.length) return { errors };
    return { config: cfg, errors };
}
