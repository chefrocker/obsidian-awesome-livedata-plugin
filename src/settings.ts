export interface LiveDataSettings {
    brokerHost: string;
    brokerPort: number;
    brokerPath: string;
    /** Transport scheme. mqtt/mqtts = raw TCP (desktop only); ws/wss = WebSocket (all platforms). */
    transport: "ws" | "wss" | "mqtt" | "mqtts";
    /** @deprecated Superseded by `transport`. Kept for migration of older configs. */
    useTLS: boolean;
    autoConnect: boolean;
    debugMode: boolean;
    defaultQos: 0 | 1 | 2;
    defaultRestInterval: number;
    enableCaching: boolean;
    cacheTimeout: number;
    maxRetries: number;
    useSessionOnly: boolean;
    autoLogoutMinutes: number;
    persistCredentialsToKeychain: boolean;
    /** Base64 of safeStorage-encrypted JSON {username,password}. Desktop only. */
    encryptedCredentialsB64: string;
    enableLegacyBlockTypes: boolean;
    statusLiveSeconds: number;
    statusStaleSeconds: number;
    /** Cache of last-known values, keyed by `mqtt:<topic>` or `rest:<url>`. */
    offlineCache: Record<string, { value: string; timestamp: number }>;
}

export const DEFAULT_SETTINGS: LiveDataSettings = {
    brokerHost: "localhost",
    brokerPort: 9001,
    brokerPath: "",
    transport: "ws",
    useTLS: false,
    autoConnect: false,
    debugMode: false,
    defaultQos: 1,
    defaultRestInterval: 30,
    enableCaching: true,
    cacheTimeout: 5,
    maxRetries: 3,
    useSessionOnly: false,
    autoLogoutMinutes: 30,
    persistCredentialsToKeychain: false,
    encryptedCredentialsB64: "",
    enableLegacyBlockTypes: false,
    statusLiveSeconds: 300,
    statusStaleSeconds: 1800,
    offlineCache: {},
};
