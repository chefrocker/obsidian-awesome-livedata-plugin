/**
 * F-21: Generic WebSocket source (non-MQTT).
 * `source: websocket` with custom URL and message parsing.
 */

export interface WebSocketSourceConfig {
    url: string;
    messageParser?: "json" | "text" | "csv";
    jsonPath?: string;
}

export class WebSocketConnection {
    private ws: WebSocket | null = null;

    constructor(
        private cfg: WebSocketSourceConfig,
        private onMessage: (data: unknown) => void,
        private onError: (err: string) => void,
    ) {}

    connect(): void {
        try {
            this.ws = new WebSocket(this.cfg.url);
            this.ws.onmessage = (e) => {
                let data: unknown = e.data;
                if (this.cfg.messageParser === "json") {
                    try {
                        data = JSON.parse(e.data);
                    } catch {
                        data = e.data;
                    }
                }
                this.onMessage(data);
            };
            this.ws.onerror = () => this.onError("WebSocket error");
            this.ws.onclose = () => this.onError("WebSocket closed");
        } catch (e: any) {
            this.onError(e?.message ?? String(e));
        }
    }

    disconnect(): void {
        if (this.ws) this.ws.close();
        this.ws = null;
    }

    get connected(): boolean {
        return !!this.ws && this.ws.readyState === WebSocket.OPEN;
    }
}
