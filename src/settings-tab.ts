import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type LiveDataHubPlugin from "./main";
import { canPersistCredentials } from "./storage/credentials";

export class LiveDataSettingTab extends PluginSettingTab {
    constructor(app: App, private plugin: LiveDataHubPlugin) {
        super(app, plugin);
    }

    display(): void {
        const { containerEl } = this;
        const s = this.plugin.settings;
        containerEl.empty();

        containerEl.createEl("h2", { text: "MQTT broker" });
        new Setting(containerEl)
            .setName("Host")
            .addText(t => t.setValue(s.brokerHost).onChange(async v => { s.brokerHost = v; await this.plugin.saveSettings(); }));
        new Setting(containerEl)
            .setName("Transport")
            .setDesc("WebSocket works on desktop and mobile. Raw TCP (mqtt/mqtts) is desktop only.")
            .addDropdown(d => d
                .addOptions({
                    ws: "WebSocket (ws://)",
                    wss: "WebSocket Secure (wss://)",
                    mqtt: "MQTT TCP (mqtt://) — desktop only",
                    mqtts: "MQTT TCP+TLS (mqtts://) — desktop only",
                })
                .setValue(s.transport)
                .onChange(async v => {
                    s.transport = v as "ws" | "wss" | "mqtt" | "mqtts";
                    s.useTLS = v === "wss" || v === "mqtts";
                    await this.plugin.saveSettings();
                }));
        new Setting(containerEl)
            .setName("Port")
            .setDesc("9001 (WebSocket), 1883 (TCP), 8883 (TCP+TLS).")
            .addText(t => t.setValue(String(s.brokerPort)).onChange(async v => { s.brokerPort = parseInt(v, 10) || 9001; await this.plugin.saveSettings(); }));
        new Setting(containerEl)
            .setName("Path")
            .setDesc("Only used for WebSocket transports, e.g. /mqtt.")
            .addText(t => t.setValue(s.brokerPath).onChange(async v => { s.brokerPath = v; await this.plugin.saveSettings(); }));
        new Setting(containerEl)
            .setName("Auto-connect on startup")
            .addToggle(t => t.setValue(s.autoConnect).onChange(async v => { s.autoConnect = v; await this.plugin.saveSettings(); }));
        new Setting(containerEl)
            .setName("Default QoS")
            .addDropdown(d => d.addOptions({ "0": "0", "1": "1", "2": "2" }).setValue(String(s.defaultQos)).onChange(async v => { s.defaultQos = (parseInt(v, 10) as 0 | 1 | 2); await this.plugin.saveSettings(); }));

        containerEl.createEl("h2", { text: "REST defaults" });
        new Setting(containerEl)
            .setName("Default interval (seconds)")
            .addText(t => t.setValue(String(s.defaultRestInterval)).onChange(async v => { s.defaultRestInterval = parseInt(v, 10) || 30; await this.plugin.saveSettings(); }));
        new Setting(containerEl)
            .setName("Enable caching")
            .addToggle(t => t.setValue(s.enableCaching).onChange(async v => { s.enableCaching = v; await this.plugin.saveSettings(); }));
        new Setting(containerEl)
            .setName("Cache timeout (seconds)")
            .addText(t => t.setValue(String(s.cacheTimeout)).onChange(async v => { s.cacheTimeout = parseInt(v, 10) || 5; await this.plugin.saveSettings(); }));
        new Setting(containerEl)
            .setName("Max retries")
            .addText(t => t.setValue(String(s.maxRetries)).onChange(async v => { s.maxRetries = parseInt(v, 10) || 0; await this.plugin.saveSettings(); }));

        containerEl.createEl("h2", { text: "Status thresholds (seconds)" });
        new Setting(containerEl)
            .setName("Live ↔ stale")
            .addText(t => t.setValue(String(s.statusLiveSeconds)).onChange(async v => { s.statusLiveSeconds = parseInt(v, 10) || 300; await this.plugin.saveSettings(); }));
        new Setting(containerEl)
            .setName("Stale ↔ offline")
            .addText(t => t.setValue(String(s.statusStaleSeconds)).onChange(async v => { s.statusStaleSeconds = parseInt(v, 10) || 1800; await this.plugin.saveSettings(); }));

        containerEl.createEl("h2", { text: "Credentials" });
        const canPersist = canPersistCredentials();
        new Setting(containerEl)
            .setName("Session-only credentials")
            .setDesc("Keep credentials only in memory; clear on app close.")
            .addToggle(t => t.setValue(s.useSessionOnly).onChange(async v => { s.useSessionOnly = v; await this.plugin.saveSettings(); }));
        new Setting(containerEl)
            .setName("Persist to OS keychain")
            .setDesc(canPersist ? "Uses Electron safeStorage (desktop only)." : "Not available on this platform.")
            .addToggle(t => t.setDisabled(!canPersist).setValue(s.persistCredentialsToKeychain).onChange(async v => { s.persistCredentialsToKeychain = v; await this.plugin.saveSettings(); }));
        new Setting(containerEl)
            .setName("Auto-logout after inactivity (minutes, 0 = off)")
            .addText(t => t.setValue(String(s.autoLogoutMinutes)).onChange(async v => { s.autoLogoutMinutes = parseInt(v, 10) || 0; await this.plugin.saveSettings(); this.plugin.refreshAutoLogout(); }));
        new Setting(containerEl)
            .setName("Clear stored credentials")
            .addButton(b => b.setButtonText("Clear").setWarning().onClick(async () => { await this.plugin.clearCredentials(); new Notice("Credentials cleared."); }));

        containerEl.createEl("h2", { text: "Legacy" });
        new Setting(containerEl)
            .setName("Enable legacy block types")
            .setDesc("Process old `mqtt`, `rest`, `api`, `live-data` blocks. Shows a deprecation hint inside the widget.")
            .addToggle(t => t.setValue(s.enableLegacyBlockTypes).onChange(async v => {
                s.enableLegacyBlockTypes = v;
                await this.plugin.saveSettings();
                new Notice("Reload Obsidian to apply the legacy toggle.");
            }));

        containerEl.createEl("h2", { text: "Debug" });
        new Setting(containerEl)
            .setName("Debug mode")
            .setDesc("Verbose logging to the developer console.")
            .addToggle(t => t.setValue(s.debugMode).onChange(async v => { s.debugMode = v; await this.plugin.saveSettings(); }));

        containerEl.createEl("h2", { text: "Connection" });
        const statusEl = containerEl.createDiv({ cls: "live-data-mqtt-status" });
        const renderStatus = () => {
            statusEl.empty();
            statusEl.setText(this.plugin.isMqttConnected() ? "Connected" : "Disconnected");
        };
        renderStatus();
        new Setting(containerEl)
            .addButton(b => b.setButtonText("Connect").onClick(async () => { await this.plugin.connectMQTT(); window.setTimeout(renderStatus, 500); }))
            .addButton(b => b.setButtonText("Disconnect").onClick(() => { this.plugin.disconnectMQTT(); window.setTimeout(renderStatus, 500); }));
    }
}
