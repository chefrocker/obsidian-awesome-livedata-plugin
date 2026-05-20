/**
 * F-15: Bulk widgets from template.
 * Generates multiple livedata blocks from a list, reducing repetition.
 */

export function parseTemplate(source: string): { items: Array<Record<string, string>>; baseConfig: Record<string, string> } | null {
    const lines = source.split(/\r?\n/);
    const baseConfig: Record<string, string> = {};
    const items: Array<Record<string, string>> = [];
    let inItems = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        if (trimmed === "items:") {
            inItems = true;
            continue;
        }
        if (inItems) {
            if (trimmed.startsWith("-")) {
                const item: Record<string, string> = {};
                const itemStr = trimmed.slice(1).trim();
                for (const pair of itemStr.split(",")) {
                    const [k, v] = pair.split(":").map(s => s.trim());
                    if (k && v) item[k] = v;
                }
                if (Object.keys(item).length) items.push(item);
            }
        } else {
            const i = trimmed.indexOf(":");
            if (i > 0) {
                const k = trimmed.substring(0, i).trim();
                const v = trimmed.substring(i + 1).trim();
                baseConfig[k] = v;
            }
        }
    }

    return Object.keys(baseConfig).length ? { items, baseConfig } : null;
}

export function generateBulkBlocks(template: { items: Array<Record<string, string>>; baseConfig: Record<string, string> }): string[] {
    return template.items.map(item => {
        const lines: string[] = ["```livedata"];
        for (const [k, v] of Object.entries(template.baseConfig)) {
            lines.push(`${k}: ${v}`);
        }
        for (const [k, v] of Object.entries(item)) {
            lines.push(`${k}: ${v}`);
        }
        lines.push("```");
        return lines.join("\n");
    });
}
