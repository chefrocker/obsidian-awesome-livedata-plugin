// Dual MQTT loader.
//
// Obsidian runs plugins in two very different environments:
//   - Desktop (Electron): Node.js is available → raw TCP (mqtt:// / mqtts://) works.
//   - Mobile (Capacitor):  no Node.js → only WebSocket (ws:// / wss://) works.
//
// mqtt.js ships two builds. We import the WebSocket build STATICALLY (safe on every
// platform, uses the native WebSocket and never touches Node `net`/`tls`), and load
// the full Node build LAZILY via require() only when a TCP scheme is actually used on
// desktop. Because esbuild initializes require()'d CommonJS modules on first call, the
// Node build's `net`/`tls` requires never fire on mobile.
//
// CRITICAL: never add a static `import ... from "mqtt"` (bare specifier) anywhere — under
// esbuild `platform: "node"` that resolves to the Node build and would eager-load `net`,
// crashing the plugin on mobile.

import * as mqttWs from "mqtt/dist/mqtt.esm";
import type { MqttClient, IClientOptions } from "mqtt";
import { isTcpScheme, type MqttScheme } from "../util/platform";

export type MqttConnectFn = (url: string, opts: IClientOptions) => MqttClient;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveConnect(mod: any): MqttConnectFn | undefined {
    return mod?.connect ?? mod?.default?.connect ?? mod?.default;
}

let nodeConnect: MqttConnectFn | null = null;

/**
 * Return the appropriate mqtt.connect() implementation for the given scheme.
 * - ws/wss  → bundled WebSocket build (all platforms)
 * - mqtt/mqtts → lazily-required Node build (desktop only)
 * @throws if a TCP scheme is requested but the Node build cannot be loaded (e.g. mobile).
 */
export function getMqttConnect(scheme: MqttScheme): MqttConnectFn {
    if (isTcpScheme(scheme)) {
        if (nodeConnect) return nodeConnect;

        // Guard: no Node `require` means we're on mobile — TCP is impossible there.
        if (typeof require !== "function") {
            throw new Error("MQTT over TCP requires Node.js (desktop only). Use ws:// or wss:// instead.");
        }

        let mod: unknown;
        try {
            // Direct, statically-analyzable require() so esbuild BUNDLES the Node mqtt
            // build (with net/tls). It is wrapped in esbuild's lazy __commonJS init, so the
            // bundled net/tls requires only fire here on desktop — never at module load,
            // and never on mobile (this branch is gated out before we reach it).
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            mod = require("mqtt");
        } catch (e) {
            throw new Error(`MQTT over TCP could not be initialized: ${(e as Error)?.message ?? e}`);
        }

        const connect = resolveConnect(mod);
        if (!connect) {
            throw new Error("Failed to load the Node MQTT build for TCP transport.");
        }
        nodeConnect = connect;
        return nodeConnect;
    }

    const wsConnect = resolveConnect(mqttWs);
    if (!wsConnect) {
        throw new Error("Failed to load the WebSocket MQTT build.");
    }
    return wsConnect;
}
