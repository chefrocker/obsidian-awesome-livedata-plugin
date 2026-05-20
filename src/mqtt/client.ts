import mqtt from "mqtt";
import type { MqttClient, IClientOptions } from "mqtt";
import { Notice } from "obsidian";
import { isMobile, type MqttScheme, isSchemeAllowed } from "../util/platform";
import type { Logger } from "../util/logger";
import type { Credentials } from "../storage/credentials";

export interface MqttClientOptions {
    host: string;
    port: number;
    path: string;
    scheme: MqttScheme;
    credentials: Credentials;
    defaultQos: 0 | 1 | 2;
}

export type MessageHandler = (topic: string, payload: string) => void;
export type StatusHandler = (status: "connecting" | "connected" | "offline" | "error", detail?: string) => void;

export class MqttConnection {
    private client: MqttClient | null = null;
    private subscribed: Set<string> = new Set();

    constructor(
        private opts: MqttClientOptions,
        private logger: Logger,
        private onMessage: MessageHandler,
        private onStatus: StatusHandler,
    ) {}

    get connected(): boolean {
        return !!this.client?.connected;
    }

    connect(): void {
        if (this.client?.connected) return;

        if (!isSchemeAllowed(this.opts.scheme)) {
            const msg = "MQTT over TCP is not available on mobile. Use ws:// or wss://.";
            new Notice(msg);
            this.onStatus("error", msg);
            return;
        }

        const pathPart = this.opts.path && this.opts.path.startsWith("/") ? this.opts.path : (this.opts.path ? `/${this.opts.path}` : "");
        const url = `${this.opts.scheme}://${this.opts.host}:${this.opts.port}${pathPart}`;
        this.logger.debug("Connecting to", url);
        this.onStatus("connecting");

        const options: IClientOptions = {
            clientId: `obsidian-livedata-${Math.random().toString(16).slice(2, 10)}`,
            clean: true,
            keepalive: 60,
            reconnectPeriod: 5000,
            connectTimeout: 30000,
            protocolVersion: 4,
            rejectUnauthorized: !isMobile(),
        };
        if (this.opts.credentials.username) {
            options.username = this.opts.credentials.username;
            if (this.opts.credentials.password) options.password = this.opts.credentials.password;
        }

        try {
            this.client = mqtt.connect(url, options);
        } catch (e: any) {
            this.logger.error("mqtt.connect threw", e);
            new Notice(`MQTT connect failed: ${e?.message ?? e}`);
            this.onStatus("error", String(e?.message ?? e));
            return;
        }

        this.client.on("connect", () => {
            this.logger.debug("MQTT connected");
            this.onStatus("connected");
            for (const t of this.subscribed) {
                this.client?.subscribe(t, { qos: this.opts.defaultQos });
            }
        });
        this.client.on("message", (topic: string, payload: Buffer) => {
            this.onMessage(topic, payload.toString());
        });
        this.client.on("error", (err: Error) => {
            this.logger.error("MQTT error", err);
            this.onStatus("error", err.message);
        });
        this.client.on("offline", () => this.onStatus("offline"));
        this.client.on("reconnect", () => this.logger.debug("MQTT reconnect"));
        this.client.on("close", () => this.logger.debug("MQTT close"));
    }

    subscribe(topic: string, qos?: 0 | 1 | 2): void {
        this.subscribed.add(topic);
        if (this.client?.connected) {
            this.client.subscribe(topic, { qos: qos ?? this.opts.defaultQos });
        }
    }

    unsubscribe(topic: string): void {
        this.subscribed.delete(topic);
        if (this.client?.connected) this.client.unsubscribe(topic);
    }

    publish(topic: string, payload: string, qos?: 0 | 1 | 2): void {
        if (!this.client?.connected) return;
        this.client.publish(topic, payload, { qos: qos ?? this.opts.defaultQos });
    }

    disconnect(): void {
        if (!this.client) return;
        this.subscribed.clear();
        this.client.end(true);
        this.client = null;
        this.onStatus("offline");
    }
}
