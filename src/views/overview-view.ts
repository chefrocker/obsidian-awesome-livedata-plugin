import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type LiveDataHubPlugin from "../main";

export const OVERVIEW_VIEW_TYPE = "live-data-overview";

export class OverviewView extends ItemView {
    private container!: HTMLElement;
    private refreshHandle: number | null = null;

    constructor(leaf: WorkspaceLeaf, private plugin: LiveDataHubPlugin) {
        super(leaf);
    }

    getViewType(): string { return OVERVIEW_VIEW_TYPE; }
    getDisplayText(): string { return "Live Data Overview"; }
    getIcon(): string { return "activity"; }

    async onOpen(): Promise<void> {
        this.container = this.contentEl.createDiv({ cls: "live-data-overview" });
        this.render();
        this.refreshHandle = window.setInterval(() => this.render(), 5000);
        this.plugin.registerInterval(this.refreshHandle);
    }

    async onClose(): Promise<void> {
        if (this.refreshHandle != null) window.clearInterval(this.refreshHandle);
    }

    render(): void {
        this.container.empty();
        const toolbar = this.container.createDiv({ cls: "live-data-overview-toolbar" });
        const reconnect = toolbar.createEl("button", { text: "Reconnect All" });
        reconnect.addEventListener("click", () => this.plugin.reconnectAll());
        const pause = toolbar.createEl("button", { text: "Refresh REST" });
        pause.addEventListener("click", () => this.plugin.refreshAllRestBlocks());

        const widgets = this.plugin.listWidgets();
        const groups: Record<string, typeof widgets> = { mqtt: [], rest: [] };
        for (const w of widgets) groups[w.cfg.source].push(w);

        for (const source of ["mqtt", "rest"] as const) {
            this.container.createEl("h3", { text: source === "mqtt" ? "MQTT" : "REST" });
            const list = this.container.createEl("ul", { cls: "live-data-overview-list" });
            if (groups[source].length === 0) {
                list.createEl("li", { cls: "live-data-overview-empty", text: "no active widgets" });
                continue;
            }
            for (const w of groups[source]) {
                const s = w.summary();
                const li = list.createEl("li", { cls: "live-data-overview-item" });
                const dot = li.createSpan({ cls: `live-data-status-dot live-data-status-${s.status}` });
                setIcon(dot, "circle");
                li.createSpan({ cls: "live-data-overview-key", text: s.key || "(unnamed)" });
                li.createSpan({ cls: "live-data-overview-value", text: String(s.value ?? "—") });
            }
        }
    }
}
