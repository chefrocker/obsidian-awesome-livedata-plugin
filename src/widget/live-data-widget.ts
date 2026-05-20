import { MarkdownRenderChild } from "obsidian";
import type LiveDataHubPlugin from "../main";
import type { WidgetConfig } from "../parser/block-parser";
import { renderDisplay } from "./displays";
import { computeStatus, formatAbsolute, formatRelative, type WidgetStatus } from "./timestamp";
import { parseJsonPath } from "../util/json-path";

export class LiveDataWidget extends MarkdownRenderChild {
    private valueEl!: HTMLElement;
    private timestampEl!: HTMLElement;
    private statusDotEl!: HTMLElement;
    private statusTextEl!: HTMLElement;
    private lastUpdate: number | null = null;
    private lastValue: unknown = null;
    private tickHandle: number | null = null;
    private restTimer: number | null = null;
    private paused = false;
    private deprecationNotice: string | null = null;
    private lastAlertFired = false;

    constructor(
        containerEl: HTMLElement,
        private plugin: LiveDataHubPlugin,
        public readonly cfg: WidgetConfig,
    ) {
        super(containerEl);
    }

    setDeprecationNotice(msg: string): void {
        this.deprecationNotice = msg;
    }

    onload(): void {
        this.buildLayout();
        this.applyOfflineCache();

        if (this.cfg.source === "mqtt" && this.cfg.topic) {
            this.plugin.attachMqttWidget(this);
        } else if (this.cfg.source === "rest" && this.cfg.url) {
            this.startRestPolling();
        }

        this.tickHandle = window.setInterval(() => this.refreshTimestampUi(), 10_000);
        this.plugin.registerInterval(this.tickHandle);
        this.plugin.trackWidget(this);
    }

    onunload(): void {
        if (this.tickHandle != null) window.clearInterval(this.tickHandle);
        if (this.restTimer != null) window.clearInterval(this.restTimer);
        if (this.cfg.source === "mqtt" && this.cfg.topic) {
            this.plugin.detachMqttWidget(this);
        }
        this.plugin.untrackWidget(this);
    }

    private buildLayout(): void {
        const card = this.containerEl.createDiv({ cls: `live-data-widget live-data-widget-${this.cfg.source}` });

        const header = card.createDiv({ cls: "live-data-widget-header" });
        header.createSpan({ cls: "live-data-widget-icon", text: this.cfg.icon ?? (this.cfg.source === "mqtt" ? "📡" : "🌐") });
        header.createSpan({ cls: "live-data-widget-label", text: this.cfg.label ?? (this.cfg.source === "mqtt" ? this.cfg.topic ?? "MQTT" : "REST") });
        const statusWrap = header.createDiv({ cls: "live-data-widget-status" });
        this.statusDotEl = statusWrap.createSpan({ cls: "live-data-widget-status-dot live-data-status-offline" });
        this.statusTextEl = statusWrap.createSpan({ cls: "live-data-widget-status-text", text: "offline" });

        this.valueEl = card.createDiv({ cls: "live-data-widget-value", text: "—" });

        const footer = card.createDiv({ cls: "live-data-widget-footer" });
        this.timestampEl = footer.createSpan({ cls: "live-data-widget-timestamp", text: "never" });

        if (this.cfg.source === "rest") {
            const controls = card.createDiv({ cls: "live-data-widget-controls" });
            controls.createEl("button", { text: "Refresh", cls: "live-data-widget-btn" })
                .addEventListener("click", () => this.refreshRestOnce());
            const pauseBtn = controls.createEl("button", { text: "Pause", cls: "live-data-widget-btn" });
            pauseBtn.addEventListener("click", () => {
                this.paused = !this.paused;
                pauseBtn.setText(this.paused ? "Resume" : "Pause");
            });
        }

        if (this.cfg.source === "mqtt" && this.cfg.publishTopic && !this.cfg.readonly) {
            const controls = card.createDiv({ cls: "live-data-widget-controls" });
            controls.createEl("button", { text: "Publish 1", cls: "live-data-widget-btn" })
                .addEventListener("click", () => this.publishValue("1"));
            controls.createEl("button", { text: "Publish 0", cls: "live-data-widget-btn" })
                .addEventListener("click", () => this.publishValue("0"));
        }

        if (this.deprecationNotice) {
            card.createDiv({ cls: "live-data-widget-deprecation", text: this.deprecationNotice });
        }
    }

    private applyOfflineCache(): void {
        const key = this.cacheKey();
        if (!key) return;
        const cached = this.plugin.settings.offlineCache[key];
        if (cached) {
            this.lastUpdate = cached.timestamp;
            this.lastValue = cached.value;
            renderDisplay({ el: this.valueEl, cfg: this.cfg }, cached.value);
            this.refreshTimestampUi();
            this.valueEl.classList.add("live-data-widget-cached");
        }
    }

    private cacheKey(): string | null {
        if (this.cfg.source === "mqtt" && this.cfg.topic) return `mqtt:${this.cfg.topic}`;
        if (this.cfg.source === "rest" && this.cfg.url) return `rest:${this.cfg.url}::${this.cfg.path ?? ""}`;
        return null;
    }

    /** Called by plugin when an MQTT message arrives for our topic. */
    receiveMqttMessage(payload: string): void {
        let value: unknown = payload;
        if (this.cfg.path && this.cfg.path !== "value") {
            value = parseJsonPath(payload, this.cfg.path);
            if (value === undefined) value = "(path not found)";
        }
        this.applyValue(value);
    }

    private async startRestPolling(): Promise<void> {
        const interval = (this.cfg.interval ?? this.plugin.settings.defaultRestInterval) * 1000;
        await this.refreshRestOnce();
        this.restTimer = window.setInterval(() => {
            if (!this.paused) this.refreshRestOnce();
        }, interval);
        this.plugin.registerInterval(this.restTimer);
    }

    async refreshRestOnce(): Promise<void> {
        try {
            const { value } = await this.plugin.restClient.fetch(this.cfg);
            this.applyValue(value);
        } catch (e: any) {
            this.valueEl.empty();
            this.valueEl.setText(`Error: ${e?.message ?? e}`);
            this.valueEl.classList.add("live-data-widget-error");
        }
    }

    private applyValue(value: unknown): void {
        this.lastValue = value;
        this.lastUpdate = Date.now();
        this.valueEl.classList.remove("live-data-widget-cached", "live-data-widget-error");
        renderDisplay({ el: this.valueEl, cfg: this.cfg }, value);
        this.valueEl.addClass("live-data-widget-pulse");
        window.setTimeout(() => this.valueEl.removeClass("live-data-widget-pulse"), 500);
        this.refreshTimestampUi();

        const key = this.cacheKey();
        if (key) {
            this.plugin.settings.offlineCache[key] = { value: String(value), timestamp: this.lastUpdate };
            this.plugin.scheduleSaveSettings();
        }

        void this.plugin.historyStore.append(key ?? "", Number(value));
        this.checkAlerts(value);
    }

    private checkAlerts(value: unknown): void {
        if (!this.cfg.alertThreshold || !this.cfg.alertCondition) return;
        const n = Number(value);
        if (!Number.isFinite(n)) return;
        let triggered = false;
        switch (this.cfg.alertCondition) {
            case "<": triggered = n < this.cfg.alertThreshold; break;
            case ">": triggered = n > this.cfg.alertThreshold; break;
            case "==": triggered = n === this.cfg.alertThreshold; break;
            case "!=": triggered = n !== this.cfg.alertThreshold; break;
        }
        if (triggered && !this.lastAlertFired) {
            this.lastAlertFired = true;
            const { Notice: NoticeClass } = require("obsidian") as { Notice: typeof import("obsidian").Notice };
            new NoticeClass(`⚠️ ${this.cfg.label ?? "Widget"}: ${n} triggered alert (${this.cfg.alertCondition} ${this.cfg.alertThreshold})`);
        } else if (!triggered) {
            this.lastAlertFired = false;
        }
    }

    private publishValue(payload: string): void {
        if (!this.cfg.publishTopic) return;
        void this.plugin.publisher.publish(this.cfg.publishTopic, payload, this.cfg.qos);
    }

    private refreshTimestampUi(): void {
        if (this.cfg.timestamp === "hidden") {
            this.timestampEl.setText("");
            return;
        }
        if (this.lastUpdate == null) {
            this.timestampEl.setText("never");
            this.timestampEl.removeAttribute("title");
        } else {
            this.timestampEl.setText(formatRelative(this.lastUpdate));
            this.timestampEl.setAttribute("title", formatAbsolute(this.lastUpdate));
        }
        const liveSec = this.cfg.statusThresholds?.live ?? this.plugin.settings.statusLiveSeconds;
        const staleSec = this.cfg.statusThresholds?.stale ?? this.plugin.settings.statusStaleSeconds;
        const status: WidgetStatus = computeStatus(this.lastUpdate, liveSec, staleSec);
        this.statusDotEl.removeClass("live-data-status-live", "live-data-status-stale", "live-data-status-offline");
        this.statusDotEl.addClass(`live-data-status-${status}`);
        this.statusTextEl.setText(status);
    }

    summary(): { source: string; key: string; status: WidgetStatus; value: unknown; lastUpdate: number | null } {
        const liveSec = this.cfg.statusThresholds?.live ?? this.plugin.settings.statusLiveSeconds;
        const staleSec = this.cfg.statusThresholds?.stale ?? this.plugin.settings.statusStaleSeconds;
        return {
            source: this.cfg.source,
            key: (this.cfg.topic ?? this.cfg.url ?? ""),
            status: computeStatus(this.lastUpdate, liveSec, staleSec),
            value: this.lastValue,
            lastUpdate: this.lastUpdate,
        };
    }
}
