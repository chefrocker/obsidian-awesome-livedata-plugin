import { App, Modal, Notice, Setting, TFile, MarkdownView } from "obsidian";
import { migrateMarkdown } from "../parser/legacy";

export async function migrateCurrentNote(app: App): Promise<void> {
    const view = app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file) {
        new Notice("Open a note first.");
        return;
    }
    const file = view.file;
    const original = await app.vault.read(file);
    const { content, count } = migrateMarkdown(original);
    if (count === 0) {
        new Notice("No legacy blocks found in this note.");
        return;
    }
    await app.vault.modify(file, content);
    new Notice(`Converted ${count} legacy block${count === 1 ? "" : "s"}.`);
}

export class MigrateVaultConfirmModal extends Modal {
    constructor(app: App, private onConfirm: () => void) {
        super(app);
    }
    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Migrate all legacy blocks" });
        contentEl.createEl("p", {
            text: "This rewrites every `mqtt`, `rest`, `api` and `live-data` code block in the vault into the new `livedata` syntax. Make sure your vault is backed up.",
        });
        new Setting(contentEl)
            .addButton(b => b.setButtonText("Migrate vault").setWarning().onClick(() => { this.close(); this.onConfirm(); }))
            .addButton(b => b.setButtonText("Cancel").onClick(() => this.close()));
    }
}

export async function migrateVault(app: App): Promise<void> {
    const files = app.vault.getMarkdownFiles();
    let totalBlocks = 0;
    let touchedFiles = 0;
    for (const file of files as TFile[]) {
        const original = await app.vault.read(file);
        const { content, count } = migrateMarkdown(original);
        if (count > 0) {
            await app.vault.modify(file, content);
            totalBlocks += count;
            touchedFiles++;
        }
    }
    new Notice(`Migrated ${totalBlocks} blocks in ${touchedFiles} notes.`);
}
