import { App, Modal, Notice, Setting } from "obsidian";

export interface ConnectionChoice {
    useAuth: boolean;
    username?: string;
    password?: string;
    persist?: boolean;
}

export class ConnectionOptionsModal extends Modal {
    private useAuth = false;
    private username = "";
    private password = "";
    private persist = false;
    private authBox!: HTMLElement;

    constructor(app: App, private canPersist: boolean, private onSubmit: (c: ConnectionChoice) => void) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "MQTT connection" });

        new Setting(contentEl)
            .setName("Use authentication")
            .addToggle(t => t.setValue(this.useAuth).onChange(v => { this.useAuth = v; this.authBox.style.display = v ? "block" : "none"; }));

        this.authBox = contentEl.createDiv();
        this.authBox.style.display = "none";

        new Setting(this.authBox)
            .setName("Username")
            .addText(t => t.onChange(v => this.username = v));
        new Setting(this.authBox)
            .setName("Password")
            .addText(t => { t.inputEl.type = "password"; t.onChange(v => this.password = v); });
        new Setting(this.authBox)
            .setName("Save to OS keychain")
            .setDesc(this.canPersist ? "Uses Electron safeStorage." : "Not available on this platform.")
            .addToggle(t => t.setDisabled(!this.canPersist).setValue(this.persist).onChange(v => this.persist = v));

        new Setting(contentEl)
            .addButton(b => b.setButtonText("Connect").setCta().onClick(() => {
                if (this.useAuth && !this.username && !this.password) {
                    new Notice("Enter at least a username or password.");
                    return;
                }
                this.onSubmit({ useAuth: this.useAuth, username: this.username, password: this.password, persist: this.persist });
                this.close();
            }))
            .addButton(b => b.setButtonText("Cancel").onClick(() => this.close()));
    }
}
