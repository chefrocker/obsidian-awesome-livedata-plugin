import { Modal, App } from "obsidian";
import type LiveDataHubPlugin from "../main";
import type { LiveDataWidget } from "../widget/live-data-widget";

export class TopicsMonitorModal extends Modal {
    private refreshInterval: number | null = null;

    constructor(
        app: App,
        private plugin: LiveDataHubPlugin,
    ) {
        super(app);
    }

    onOpen(): void {
        this.titleEl.setText("📡 MQTT Topics Monitor");
        this.containerEl.classList.add("live-data-topics-monitor");

        this.refresh();
        this.refreshInterval = window.setInterval(() => this.refresh(), 2000);
        this.plugin.registerInterval(this.refreshInterval);
    }

    onClose(): void {
        if (this.refreshInterval != null) {
            window.clearInterval(this.refreshInterval);
        }
    }

    private refresh(): void {
        const container = this.contentEl;
        container.empty();

        // Collect all topics and their latest values from active widgets
        const topicData = new Map<string, { value: unknown; timestamp: number | null; status: string }>();

        for (const widget of this.plugin.widgets) {
            const summary = widget.summary();
            const key = summary.key || "unknown";
            const existing = topicData.get(key);

            // Keep the most recent update
            if (!existing || (summary.lastUpdate ?? 0) > (existing.timestamp ?? 0)) {
                topicData.set(key, {
                    value: summary.value,
                    timestamp: summary.lastUpdate,
                    status: summary.status,
                });
            }
        }

        // Build hierarchical tree
        const tree = this.buildTree(Array.from(topicData.entries()));

        if (topicData.size === 0) {
            const emptyDiv = container.createDiv({ cls: "live-data-topics-empty" });
            emptyDiv.setText("No active topics yet. Create some live-data blocks to see them here.");
            return;
        }

        const statsDiv = container.createDiv({ cls: "live-data-topics-stats" });
        statsDiv.setText(`📊 ${topicData.size} active topic(s)`);

        this.renderTree(container, tree, "");
    }

    private buildTree(entries: Array<[string, { value: unknown; timestamp: number | null; status: string }]>): Record<string, unknown> {
        const tree: Record<string, unknown> = {};

        for (const [topic, data] of entries) {
            const parts = topic.split("/");
            let current: Record<string, unknown> = tree;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (i === parts.length - 1) {
                    current[part] = data;
                } else {
                    if (typeof current[part] !== "object" || current[part] === null) {
                        current[part] = {};
                    }
                    current = current[part] as Record<string, unknown>;
                }
            }
        }

        return tree;
    }

    private renderTree(
        container: HTMLElement,
        tree: Record<string, unknown>,
        prefix: string,
    ): void {
        const entries = Object.entries(tree).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

        for (const [key, value] of entries) {
            const isData = value && typeof value === "object" && "value" in value;

            if (isData) {
                const data = value as { value: unknown; timestamp: number | null; status: string };
                const itemDiv = container.createDiv({ cls: "live-data-topic-item" });

                const statusColor = data.status === "live" ? "🟢" : data.status === "stale" ? "🟡" : "🔴";
                const timeStr = data.timestamp ? this.formatTime(data.timestamp) : "never";
                const valueStr = String(data.value ?? "—");

                itemDiv.innerHTML = `
                    <span class="live-data-topic-key">${prefix}${key}</span>
                    <span class="live-data-topic-status">${statusColor}</span>
                    <span class="live-data-topic-value">${valueStr}</span>
                    <span class="live-data-topic-time">${timeStr}</span>
                `;
            } else {
                const folderDiv = container.createDiv({ cls: "live-data-topic-folder" });
                folderDiv.setText(`📂 ${prefix}${key}/`);
                this.renderTree(container, value as Record<string, unknown>, `${prefix}${key}/`);
            }
        }
    }

    private formatTime(timestamp: number): string {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (seconds < 60) return `${seconds}s ago`;
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return "old";
    }
}
