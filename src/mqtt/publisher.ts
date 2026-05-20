import type LiveDataHubPlugin from "../main";

export class MqttPublisher {
    constructor(private plugin: LiveDataHubPlugin) {}

    async publish(topic: string, payload: string, qos?: 0 | 1 | 2): Promise<void> {
        if (!this.plugin.mqtt || !this.plugin.mqtt.connected) {
            throw new Error("MQTT not connected");
        }
        this.plugin.mqtt.publish(topic, payload, qos);
    }
}
