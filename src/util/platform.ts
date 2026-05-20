import { Platform } from "obsidian";

export function isMobile(): boolean {
    return Platform.isMobile;
}

export function isDesktop(): boolean {
    return Platform.isDesktop;
}

export type MqttScheme = "ws" | "wss" | "mqtt" | "mqtts";

export function isSchemeAllowed(scheme: MqttScheme): boolean {
    if (Platform.isMobile) return scheme === "ws" || scheme === "wss";
    return true;
}
