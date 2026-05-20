/**
 * F-20: Multi-broker support.
 * Allows switching between multiple MQTT brokers via `broker: name` in blocks.
 */

export interface BrokerConfig {
    id: string;
    name: string;
    host: string;
    port: number;
    path: string;
    useTLS: boolean;
}

export interface MultiBrokerStore {
    brokers: Record<string, BrokerConfig>;
    default: string;
}

export const DEFAULT_MULTI_BROKER: MultiBrokerStore = {
    brokers: {
        default: { id: "default", name: "Default", host: "localhost", port: 9001, path: "", useTLS: false },
    },
    default: "default",
};
