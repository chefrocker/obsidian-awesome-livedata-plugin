import { Notice, Plugin, MarkdownPostProcessorContext } from "obsidian";
import { DEFAULT_SETTINGS, LiveDataSettings } from "./settings";
import { LiveDataSettingTab } from "./settings-tab";
import { Logger } from "./util/logger";
import { isDesktop } from "./util/platform";
import { MqttConnection } from "./mqtt/client";
import { SubscriptionManager } from "./mqtt/subscription-manager";
import { RestClient } from "./rest/client";
import { LiveDataWidget } from "./widget/live-data-widget";
import { parseLiveDataBlock } from "./parser/block-parser";
import { legacyBodyToLivedata } from "./parser/legacy";
import { canPersistCredentials, decryptCredentials, encryptCredentials, zeroize, type Credentials } from "./storage/credentials";
import { ConnectionOptionsModal } from "./connection-modal";
import { InsertWizardModal } from "./commands/insert-wizard";
import { migrateCurrentNote, migrateVault, MigrateVaultConfirmModal } from "./commands/migrate";
import { OVERVIEW_VIEW_TYPE, OverviewView } from "./views/overview-view";
import { TopicsMonitorModal } from "./views/topics-monitor-modal";
import { MqttPublisher } from "./mqtt/publisher";
import { HistoryStore } from "./storage/history";

export default class LiveDataHubPlugin extends Plugin {
    settings!: LiveDataSettings;
    logger!: Logger;
    restClient!: RestClient;
    subscriptions: SubscriptionManager = new SubscriptionManager();
    historyStore!: HistoryStore;
    publisher!: MqttPublisher;
    mqtt: MqttConnection | null = null;
    widgets: Set<LiveDataWidget> = new Set();
    private credentials: Credentials = { username: "", password: "" };
    private inactivityTimer: number | null = null;
    private saveDebounce: number | null = null;

    async onload(): Promise<void> {
        await this.loadSettings();
        this.logger = new Logger(this.settings);
        this.restClient = new RestClient(this.settings, this.logger);
        this.historyStore = new HistoryStore();
        await this.historyStore.init();
        this.publisher = new MqttPublisher(this);

        // Restore credentials from keychain if present
        if (isDesktop() && this.settings.persistCredentialsToKeychain && this.settings.encryptedCredentialsB64) {
            const restored = decryptCredentials(this.settings.encryptedCredentialsB64);
            if (restored) this.credentials = restored;
        }

        this.addSettingTab(new LiveDataSettingTab(this.app, this));

        // New unified block
        this.registerMarkdownCodeBlockProcessor("livedata", (source, el, ctx) => this.processLiveDataBlock(source, el, ctx, null));

        // Optional legacy blocks
        if (this.settings.enableLegacyBlockTypes) {
            const handler = (legacyType: string) => (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
                const migrated = legacyBodyToLivedata(legacyType, source);
                this.processLiveDataBlock(migrated, el, ctx, `Legacy "${legacyType}" block — run "Migrate old blocks" to convert.`);
            };
            this.registerMarkdownCodeBlockProcessor("mqtt", handler("mqtt"));
            this.registerMarkdownCodeBlockProcessor("rest", handler("rest"));
            this.registerMarkdownCodeBlockProcessor("api", handler("api"));
            this.registerMarkdownCodeBlockProcessor("live-data", handler("live-data"));
        }

        // Sidebar view
        this.registerView(OVERVIEW_VIEW_TYPE, (leaf) => new OverviewView(leaf, this));
        this.addRibbonIcon("activity", "Live Data Hub: overview", () => this.activateOverview());

        // Commands
        this.addCommand({ id: "insert-widget", name: "Insert widget", callback: () => new InsertWizardModal(this.app, this).open() });
        this.addCommand({ id: "migrate-current-note", name: "Migrate old blocks in current note", callback: () => migrateCurrentNote(this.app) });
        this.addCommand({ id: "migrate-vault", name: "Migrate old blocks in vault", callback: () => new MigrateVaultConfirmModal(this.app, () => migrateVault(this.app)).open() });
        this.addCommand({ id: "open-overview", name: "Open overview", callback: () => this.activateOverview() });
        this.addCommand({ id: "connect-mqtt", name: "Connect to MQTT broker", callback: () => this.connectMQTT() });
        this.addCommand({ id: "disconnect-mqtt", name: "Disconnect from MQTT broker", callback: () => this.disconnectMQTT() });
        this.addCommand({ id: "view-topics", name: "View active MQTT topics", callback: () => new TopicsMonitorModal(this.app, this).open() });
        this.addCommand({ id: "refresh-all-rest", name: "Refresh all REST API blocks", callback: () => this.refreshAllRestBlocks() });
        this.addCommand({ id: "clear-credentials", name: "Clear stored credentials", callback: () => this.clearCredentials() });

        this.refreshAutoLogout();

        if (this.settings.autoConnect) {
            window.setTimeout(() => {
                const hasCreds = !!(this.credentials.username || this.credentials.password);
                const isLocalhost = ["localhost", "127.0.0.1"].includes(this.settings.brokerHost);
                if (hasCreds || isLocalhost || !this.settings.useSessionOnly) {
                    this.openMqttConnection();
                }
            }, 2000);
        }
    }

    onunload(): void {
        this.disconnectMQTT();
        if (this.saveDebounce != null) window.clearTimeout(this.saveDebounce);
        if (this.inactivityTimer != null) window.clearTimeout(this.inactivityTimer);
        zeroize(this.credentials);
    }

    private processLiveDataBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext, deprecation: string | null): void {
        const { config, errors } = parseLiveDataBlock(source);
        if (!config) {
            const err = el.createDiv({ cls: "live-data-widget-error" });
            err.setText(`Live Data Hub: ${errors.join(" ")}`);
            return;
        }
        const widget = new LiveDataWidget(el, this, config);
        if (deprecation) widget.setDeprecationNotice(deprecation);
        ctx.addChild(widget);
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        if (!this.settings.offlineCache) this.settings.offlineCache = {};
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    /** Debounced save for high-frequency value updates. */
    scheduleSaveSettings(): void {
        if (this.saveDebounce != null) return;
        this.saveDebounce = window.setTimeout(() => {
            this.saveDebounce = null;
            void this.saveSettings();
        }, 2000);
    }

    // ----- MQTT -----

    isMqttConnected(): boolean {
        return !!this.mqtt?.connected;
    }

    async connectMQTT(): Promise<void> {
        if (this.mqtt?.connected) { new Notice("Already connected."); return; }
        if (this.credentials.username || this.credentials.password) {
            this.openMqttConnection();
            return;
        }
        new ConnectionOptionsModal(this.app, canPersistCredentials(), async (choice) => {
            if (choice.useAuth) {
                this.credentials = { username: choice.username ?? "", password: choice.password ?? "" };
                if (choice.persist && !this.settings.useSessionOnly) {
                    const enc = encryptCredentials(this.credentials);
                    if (enc) {
                        this.settings.encryptedCredentialsB64 = enc;
                        this.settings.persistCredentialsToKeychain = true;
                        await this.saveSettings();
                    }
                }
            } else {
                zeroize(this.credentials);
            }
            this.openMqttConnection();
        }).open();
    }

    private openMqttConnection(): void {
        if (this.mqtt) this.mqtt.disconnect();

        // Intelligently determine MQTT scheme/transport
        const scheme = this.detectMqttScheme();

        this.mqtt = new MqttConnection(
            {
                host: this.settings.brokerHost,
                port: this.settings.brokerPort,
                path: this.settings.brokerPath,
                scheme,
                credentials: this.credentials,
                defaultQos: this.settings.defaultQos,
            },
            this.logger,
            (topic, payload) => this.dispatchMqttMessage(topic, payload),
            (status, detail) => {
                if (status === "connected") new Notice("Connected to MQTT broker");
                else if (status === "error") new Notice(`MQTT error: ${detail ?? ""}`);
            },
        );
        // Re-subscribe to topics widgets registered before the connection existed
        for (const topic of this.subscriptions.allTopics()) {
            this.mqtt.subscribe(topic);
        }
        this.mqtt.connect();
    }

    private detectMqttScheme(): "mqtt" | "mqtts" | "ws" | "wss" {
        // 1. Try to extract scheme from brokerHost if user entered one (e.g., "mqtt://broker.com")
        const schemeMatch = this.settings.brokerHost.match(/^([a-z+]+):\/\//i);
        if (schemeMatch) {
            const extracted = schemeMatch[1].toLowerCase();
            // Validate the extracted scheme is valid
            if (["mqtt", "mqtts", "ws", "wss"].includes(extracted)) {
                return extracted as "mqtt" | "mqtts" | "ws" | "wss";
            }
        }

        // 2. Check if user explicitly set useTLS (if available in settings)
        const useTls = this.settings.useTLS ?? false;

        // 3. Use intelligent defaults based on platform
        if (isDesktop()) {
            // Desktop: prefer TCP (mqtt/mqtts) — more reliable, lower latency
            return useTls ? "mqtts" : "mqtt";
        } else {
            // Mobile: must use WebSocket (ws/wss) — TCP not available in browser
            return useTls ? "wss" : "ws";
        }
    }

    disconnectMQTT(): void {
        if (this.mqtt) {
            this.mqtt.disconnect();
            this.mqtt = null;
            new Notice("Disconnected from MQTT broker");
        }
    }

    reconnectAll(): void {
        this.disconnectMQTT();
        void this.connectMQTT();
    }

    refreshAutoLogout(): void {
        if (this.inactivityTimer != null) { window.clearTimeout(this.inactivityTimer); this.inactivityTimer = null; }
        const minutes = this.settings.autoLogoutMinutes;
        if (minutes <= 0) return;

        const reset = () => {
            if (this.inactivityTimer != null) window.clearTimeout(this.inactivityTimer);
            this.inactivityTimer = window.setTimeout(() => {
                zeroize(this.credentials);
                this.disconnectMQTT();
                new Notice("Credentials cleared due to inactivity");
            }, minutes * 60_000);
        };
        this.registerDomEvent(document, "click", reset);
        this.registerDomEvent(document, "keypress", reset);
        reset();
    }

    async clearCredentials(): Promise<void> {
        zeroize(this.credentials);
        this.settings.encryptedCredentialsB64 = "";
        this.settings.persistCredentialsToKeychain = false;
        await this.saveSettings();
    }

    // ----- Widget plumbing -----

    attachMqttWidget(w: LiveDataWidget): void {
        if (!w.cfg.topic) return;
        const firstSubscriber = this.subscriptions.register(w.cfg.topic, w);
        if (firstSubscriber && this.mqtt?.connected) {
            this.mqtt.subscribe(w.cfg.topic, w.cfg.qos);
        }
    }

    detachMqttWidget(w: LiveDataWidget): void {
        if (!w.cfg.topic) return;
        const last = this.subscriptions.unregister(w.cfg.topic, w);
        if (last && this.mqtt?.connected) this.mqtt.unsubscribe(w.cfg.topic);
    }

    private dispatchMqttMessage(topic: string, payload: string): void {
        for (const w of this.subscriptions.widgetsFor(topic)) {
            w.receiveMqttMessage(payload);
        }
    }

    trackWidget(w: LiveDataWidget): void { this.widgets.add(w); }
    untrackWidget(w: LiveDataWidget): void { this.widgets.delete(w); }
    listWidgets(): LiveDataWidget[] { return Array.from(this.widgets); }

    refreshAllRestBlocks(): void {
        let count = 0;
        for (const w of this.widgets) {
            if (w.cfg.source === "rest") {
                void w.refreshRestOnce();
                count++;
            }
        }
        new Notice(`Refreshing ${count} REST widget${count === 1 ? "" : "s"}`);
    }

    private async activateOverview(): Promise<void> {
        const { workspace } = this.app;
        const existing = workspace.getLeavesOfType(OVERVIEW_VIEW_TYPE)[0];
        if (existing) {
            workspace.revealLeaf(existing);
            return;
        }
        const leaf = workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({ type: OVERVIEW_VIEW_TYPE, active: true });
            workspace.revealLeaf(leaf);
        }
    }
}
