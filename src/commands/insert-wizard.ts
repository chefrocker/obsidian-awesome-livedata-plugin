import { App, Modal, Notice, Setting, MarkdownView } from "obsidian";
import type LiveDataHubPlugin from "../main";
import type { DisplayType, WidgetSource } from "../parser/block-parser";
import { ALL_DISPLAYS } from "../widget/displays";

interface WizardState {
    source: WidgetSource;
    display: DisplayType;
    label: string;
    unit: string;
    path: string;
    topic: string;
    url: string;
    method: "GET" | "POST";
    interval: string;
}

export class InsertWizardModal extends Modal {
    private state: WizardState = {
        source: "mqtt",
        display: "number",
        label: "",
        unit: "",
        path: "value",
        topic: "",
        url: "",
        method: "GET",
        interval: "",
    };
    private previewEl!: HTMLElement;

    constructor(app: App, private plugin: LiveDataHubPlugin) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Insert Live Data Widget" });

        new Setting(contentEl)
            .setName("Source")
            .addDropdown(d => d
                .addOptions({ mqtt: "MQTT", rest: "REST" })
                .setValue(this.state.source)
                .onChange((v) => { this.state.source = v as WidgetSource; this.render(); }));

        new Setting(contentEl)
            .setName("Display")
            .addDropdown(d => {
                for (const opt of ALL_DISPLAYS) d.addOption(opt, opt);
                d.setValue(this.state.display);
                d.onChange((v) => { this.state.display = v as DisplayType; this.render(); });
            });

        new Setting(contentEl)
            .setName("Label")
            .addText(t => t.setValue(this.state.label).onChange(v => { this.state.label = v; this.render(); }));

        new Setting(contentEl)
            .setName("Unit (e.g. °C, %, €)")
            .addText(t => t.setValue(this.state.unit).onChange(v => { this.state.unit = v; this.render(); }));

        new Setting(contentEl)
            .setName("JSON path (default: value)")
            .addText(t => t.setValue(this.state.path).onChange(v => { this.state.path = v; this.render(); }));

        const sourceFields = contentEl.createDiv();
        const renderSourceFields = () => {
            sourceFields.empty();
            if (this.state.source === "mqtt") {
                new Setting(sourceFields)
                    .setName("Topic")
                    .addText(t => t.setValue(this.state.topic).onChange(v => { this.state.topic = v; this.render(); }));
            } else {
                new Setting(sourceFields)
                    .setName("URL")
                    .addText(t => t.setValue(this.state.url).onChange(v => { this.state.url = v; this.render(); }));
                new Setting(sourceFields)
                    .setName("Method")
                    .addDropdown(d => d.addOptions({ GET: "GET", POST: "POST" }).setValue(this.state.method).onChange(v => { this.state.method = v as "GET" | "POST"; this.render(); }));
                new Setting(sourceFields)
                    .setName("Interval (seconds)")
                    .addText(t => t.setPlaceholder(String(this.plugin.settings.defaultRestInterval)).setValue(this.state.interval).onChange(v => { this.state.interval = v; this.render(); }));
            }
        };
        renderSourceFields();

        contentEl.createEl("h3", { text: "Preview" });
        this.previewEl = contentEl.createEl("pre", { cls: "live-data-wizard-preview" });

        new Setting(contentEl)
            .addButton(b => b.setButtonText("Insert").setCta().onClick(() => this.insertBlock()))
            .addButton(b => b.setButtonText("Cancel").onClick(() => this.close()));

        // Re-render fields whenever source changes
        const origRender = this.render.bind(this);
        this.render = () => { renderSourceFields(); origRender(); };
        this.render();
    }

    private render(): void {
        this.previewEl.setText(this.buildBlock());
    }

    private buildBlock(): string {
        const lines: string[] = ["```livedata", `source: ${this.state.source}`, `display: ${this.state.display}`];
        if (this.state.label) lines.push(`label: ${this.state.label}`);
        if (this.state.unit) lines.push(`unit: ${this.state.unit}`);
        if (this.state.path) lines.push(`path: ${this.state.path}`);
        if (this.state.source === "mqtt") {
            if (this.state.topic) lines.push(`topic: ${this.state.topic}`);
        } else {
            if (this.state.url) lines.push(`url: ${this.state.url}`);
            if (this.state.method && this.state.method !== "GET") lines.push(`method: ${this.state.method}`);
            if (this.state.interval) lines.push(`interval: ${this.state.interval}`);
        }
        lines.push("```");
        return lines.join("\n");
    }

    private insertBlock(): void {
        if (this.state.source === "mqtt" && !this.state.topic) {
            new Notice("MQTT widget needs a topic.");
            return;
        }
        if (this.state.source === "rest" && !this.state.url) {
            new Notice("REST widget needs a URL.");
            return;
        }
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) {
            new Notice("Open a note to insert the widget.");
            return;
        }
        const editor = view.editor;
        editor.replaceSelection(this.buildBlock() + "\n");
        this.close();
    }
}
