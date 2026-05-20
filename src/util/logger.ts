const PREFIX = "[Live Data Hub]";

export class Logger {
    constructor(private debugRef: { debugMode: boolean }) {}

    debug(...args: unknown[]): void {
        if (this.debugRef.debugMode) console.log(PREFIX, ...args);
    }

    warn(...args: unknown[]): void {
        console.warn(PREFIX, ...args);
    }

    error(...args: unknown[]): void {
        console.error(PREFIX, ...args);
    }
}
