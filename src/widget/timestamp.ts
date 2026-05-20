export type WidgetStatus = "live" | "stale" | "offline";

export function formatRelative(ts: number, now: number = Date.now()): string {
    const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
    if (diffSec < 60) return `vor ${diffSec} Sek.`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `vor ${diffMin} Min.`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `vor ${diffHr} Std.`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `vor ${diffDay} Tag${diffDay === 1 ? "" : "en"}`;
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
    }).format(new Date(ts));
}

export function formatAbsolute(ts: number): string {
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).format(new Date(ts));
}

export function computeStatus(
    lastUpdate: number | null,
    liveSec: number,
    staleSec: number,
    now: number = Date.now(),
): WidgetStatus {
    if (lastUpdate == null) return "offline";
    const ageSec = (now - lastUpdate) / 1000;
    if (ageSec < liveSec) return "live";
    if (ageSec < staleSec) return "stale";
    return "offline";
}
