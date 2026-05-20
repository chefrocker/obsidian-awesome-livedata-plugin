/**
 * Convert one of the legacy block bodies (mqtt / rest / api / live-data) to a
 * livedata block body. The block fence is added by the caller.
 */
export function legacyBodyToLivedata(legacyType: string, body: string): string {
    const lines = body.split(/\r?\n/);
    const raw: Record<string, string> = {};
    for (const line of lines) {
        const i = line.indexOf(":");
        if (i < 0) continue;
        const k = line.substring(0, i).trim();
        const v = line.substring(i + 1).trim();
        if (k) raw[k] = v;
    }

    let source: "mqtt" | "rest";
    if (legacyType === "mqtt") source = "mqtt";
    else if (legacyType === "rest" || legacyType === "api") source = "rest";
    else source = raw.url ? "rest" : "mqtt"; // live-data: auto

    const out: string[] = [`source: ${source}`];
    out.push(`display: number`);
    const order = ["topic", "url", "method", "label", "unit", "path", "interval", "headers", "body", "qos"];
    for (const k of order) {
        if (raw[k] != null && raw[k] !== "") out.push(`${k}: ${raw[k]}`);
    }
    return out.join("\n") + "\n";
}

const FENCE_RE = /^(```+|~~~+)(mqtt|rest|api|live-data)\s*$/gm;

/**
 * Rewrite all legacy fences in a Markdown document.
 * Returns { content, count } — count of converted blocks.
 */
export function migrateMarkdown(content: string): { content: string; count: number } {
    let count = 0;
    const lines = content.split(/\r?\n/);
    const out: string[] = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const fence = line.match(/^(```+|~~~+)(mqtt|rest|api|live-data)\s*$/);
        if (fence) {
            const closer = fence[1];
            const type = fence[2];
            const body: string[] = [];
            i++;
            while (i < lines.length && !lines[i].startsWith(closer)) {
                body.push(lines[i]);
                i++;
            }
            out.push(`${closer}livedata`);
            out.push(legacyBodyToLivedata(type, body.join("\n")).trimEnd());
            out.push(closer);
            count++;
            i++; // skip closing fence
        } else {
            out.push(line);
            i++;
        }
    }
    FENCE_RE.lastIndex = 0;
    return { content: out.join("\n"), count };
}
