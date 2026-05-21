import { Platform } from "obsidian";

export function isMobile(): boolean {
    return Platform.isMobile;
}

export function isDesktop(): boolean {
    return Platform.isDesktop;
}

/** Canonical MQTT transport schemes. `tcp`/`tls` are accepted aliases for `mqtt`/`mqtts`. */
export type MqttScheme = "ws" | "wss" | "mqtt" | "mqtts";
export type MqttSchemeInput = MqttScheme | "tcp" | "tls";

/** Normalize aliases to canonical schemes: tcp→mqtt, tls→mqtts. */
export function normalizeScheme(scheme: string): MqttScheme {
    const s = scheme.toLowerCase();
    if (s === "tcp") return "mqtt";
    if (s === "tls") return "mqtts";
    if (s === "ws" || s === "wss" || s === "mqtt" || s === "mqtts") return s;
    return "ws";
}

/** True for raw TCP transports (mqtt/mqtts), which require Node `net`/`tls` (desktop only). */
export function isTcpScheme(scheme: MqttScheme): boolean {
    return scheme === "mqtt" || scheme === "mqtts";
}

export function isSchemeAllowed(scheme: MqttScheme): boolean {
    if (Platform.isMobile) return scheme === "ws" || scheme === "wss";
    return true;
}
