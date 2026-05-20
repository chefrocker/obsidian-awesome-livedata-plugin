/**
 * F-22: Server-Sent Events (SSE) source.
 * `source: sse` with URL and optional event type filter.
 */

export class SSEConnection {
    private es: EventSource | null = null;

    constructor(
        private url: string,
        private eventType: string | undefined,
        private onMessage: (data: unknown) => void,
        private onError: (err: string) => void,
    ) {}

    connect(): void {
        try {
            this.es = new EventSource(this.url);
            const handler = (e: MessageEvent) => {
                let data: unknown = e.data;
                try {
                    data = JSON.parse(e.data);
                } catch {
                    data = e.data;
                }
                this.onMessage(data);
            };
            if (this.eventType) {
                this.es.addEventListener(this.eventType, handler);
            } else {
                this.es.onmessage = handler;
            }
            this.es.onerror = () => this.onError("SSE error");
        } catch (e: any) {
            this.onError(e?.message ?? String(e));
        }
    }

    disconnect(): void {
        if (this.es) this.es.close();
        this.es = null;
    }

    get connected(): boolean {
        return !!this.es && this.es.readyState === EventSource.OPEN;
    }
}
