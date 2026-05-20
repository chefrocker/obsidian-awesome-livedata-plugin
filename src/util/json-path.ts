export function parseJsonPath(raw: unknown, path: string | undefined): unknown {
    let data: unknown = raw;

    if (typeof raw === "string") {
        try {
            data = JSON.parse(raw);
        } catch {
            return raw;
        }
    }

    if (!path || path === "value") {
        if (typeof data === "object" && data !== null) return JSON.stringify(data, null, 2);
        return data;
    }

    const parts = path.split(".");
    let cursor: any = data;
    for (const part of parts) {
        if (cursor == null) return undefined;
        const arr = part.match(/^(.+)\[(\d+)\]$/);
        if (arr) {
            cursor = cursor[arr[1]];
            if (!Array.isArray(cursor)) return undefined;
            cursor = cursor[parseInt(arr[2], 10)];
        } else {
            cursor = cursor[part];
        }
    }

    if (cursor === undefined) return undefined;
    if (typeof cursor === "object" && cursor !== null) return JSON.stringify(cursor, null, 2);
    return cursor;
}
