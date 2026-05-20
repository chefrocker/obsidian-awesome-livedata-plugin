/**
 * F-17: Dataview integration.
 * Registers `live()` function for Dataview queries.
 */

export interface DataviewLiveContext {
    getLastValue(key: string): unknown;
    getHistory(key: string, maxAgeMs: number): Array<{ timestamp: number; value: number }>;
}

export function registerDataviewFunction(app: any, context: DataviewLiveContext): void {
    try {
        const dv = app.plugins?.plugins?.dataview?.api;
        if (!dv) return;
        dv.define("live", (key: string) => context.getLastValue(key));
    } catch {
        // Dataview not available or incompatible
    }
}
