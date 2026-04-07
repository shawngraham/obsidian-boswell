import { App, Modal } from "obsidian";

export class ConfirmModal extends Modal {
  constructor(
    app: App,
    private message: string,
    private onConfirm: () => void,
    private confirmLabel = "Confirm"
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("p", { text: this.message, cls: "bsw-confirm-msg" });
    const row = contentEl.createDiv({ cls: "bsw-modal-actions" });
    row.createEl("button", { text: "Cancel", cls: "bsw-btn bsw-btn-secondary" })
       .addEventListener("click", () => this.close());
    row.createEl("button", { text: this.confirmLabel, cls: "bsw-btn bsw-btn-danger" })
       .addEventListener("click", () => { this.onConfirm(); this.close(); });
  }

  onClose(): void { this.contentEl.empty(); }
}
