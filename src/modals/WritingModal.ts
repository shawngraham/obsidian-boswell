import { App, Modal } from "obsidian";
import type { WritingProject } from "../types";
import { NotePicker } from "./NotePicker";

export class WritingModal extends Modal {
  constructor(app: App, private onSave: (w: WritingProject) => void) { super(app); }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("bsw-modal");
    this.titleEl.setText("New Writing Project");

    const titleField = contentEl.createDiv({ cls: "bsw-field" });
    titleField.createEl("label", { text: "Project Title *", cls: "bsw-field-label" });
    const titleInput = titleField.createEl("input", {
      cls: "bsw-input", type: "text", placeholder: "e.g. Dissertation Chapter 3",
    }) as HTMLInputElement;

    const grid = contentEl.createDiv({ cls: "bsw-grid-2" });

    const targetField = grid.createDiv({ cls: "bsw-field" });
    targetField.createEl("label", { text: "Target Word Count *", cls: "bsw-field-label" });
    const targetInput = targetField.createEl("input", {
      cls: "bsw-input", type: "number", placeholder: "8000",
    }) as HTMLInputElement;

    const statusField = grid.createDiv({ cls: "bsw-field" });
    statusField.createEl("label", { text: "Status", cls: "bsw-field-label" });
    const statusSel = statusField.createEl("select", { cls: "bsw-select" }) as HTMLSelectElement;
    ["drafting", "review", "final"].forEach((s) => statusSel.createEl("option", { text: s, value: s }));

    const noteField = contentEl.createDiv({ cls: "bsw-field" });
    noteField.createEl("label", { text: "Linked Note (optional)", cls: "bsw-field-label" });
    const noteRow = noteField.createDiv({ cls: "bsw-row-gap" });
    let linkedNotePath: string | undefined;
    const noteDisplay = noteRow.createEl("span", { cls: "bsw-muted", text: "No note linked" });
    noteRow.createEl("button", { cls: "bsw-btn bsw-btn-xs", text: "Browse" })
           .addEventListener("click", () => {
             new NotePicker(this.app, (file) => {
               linkedNotePath = file.path;
               noteDisplay.setText(file.path);
               noteDisplay.removeClass("bsw-muted");
             }).open();
           });

    const actions = contentEl.createDiv({ cls: "bsw-modal-actions" });
    actions.createEl("button", { text: "Cancel", cls: "bsw-btn bsw-btn-secondary" })
           .addEventListener("click", () => this.close());
    actions.createEl("button", { text: "Create", cls: "bsw-btn bsw-btn-primary" })
           .addEventListener("click", () => {
             const target = parseInt(targetInput.value, 10);
             if (!titleInput.value.trim() || isNaN(target) || target <= 0) return;
             this.onSave({
               id: Date.now().toString(36),
               title: titleInput.value.trim(),
               wordCount: 0,
               targetWordCount: target,
               status: statusSel.value as WritingProject["status"],
               linkedNotePath,
             });
             this.close();
           });

    setTimeout(() => titleInput.focus(), 50);
  }

  onClose(): void { this.contentEl.empty(); }
}
