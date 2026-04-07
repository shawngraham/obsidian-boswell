import { App, Modal } from "obsidian";
import type { Researcher } from "../types";

function field(parent: HTMLElement, label: string): HTMLElement {
  const wrap = parent.createDiv({ cls: "bsw-field" });
  wrap.createEl("label", { text: label, cls: "bsw-field-label" });
  return wrap;
}

function textInput(parent: HTMLElement, placeholder: string, value = ""): HTMLInputElement {
  const inp = parent.createEl("input", { cls: "bsw-input", type: "text", placeholder }) as HTMLInputElement;
  inp.value = value;
  return inp;
}

export class ResearcherModal extends Modal {
  constructor(
    app: App,
    private existing: Partial<Researcher> | null,
    private onSave: (r: Researcher) => void
  ) { super(app); }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("bsw-modal");
    this.titleEl.setText(this.existing ? "Edit Researcher" : "Add Researcher");

    const r = this.existing ?? {};

    const nameField = field(contentEl, "Name *");
    const nameInput = textInput(nameField, "Full name", r.name ?? "");

    const roleField = field(contentEl, "Role *");
    const roleInput = textInput(roleField, "e.g. Graduate Researcher", r.role ?? "");

    const grid = contentEl.createDiv({ cls: "bsw-grid-2" });

    const emailField = field(grid, "Email");
    const emailInput = contentEl.ownerDocument.createElement("input");
    emailInput.className = "bsw-input";
    emailInput.type = "email";
    emailInput.placeholder = "name@university.edu";
    emailInput.value = r.email ?? "";
    emailField.appendChild(emailInput);

    const phoneField = field(grid, "Phone");
    const phoneInput = textInput(phoneField, "555-0100", r.phone ?? "");

    const sidField = field(contentEl, "Student ID");
    const sidInput = textInput(sidField, "S12345", r.studentID ?? "");

    const actions = contentEl.createDiv({ cls: "bsw-modal-actions" });
    actions.createEl("button", { text: "Cancel", cls: "bsw-btn bsw-btn-secondary" })
           .addEventListener("click", () => this.close());
    actions.createEl("button", { text: "Save", cls: "bsw-btn bsw-btn-primary" })
           .addEventListener("click", () => {
             if (!nameInput.value.trim() || !roleInput.value.trim()) return;
             this.onSave({
               id: (r as Researcher).id ?? Date.now().toString(36),
               name: nameInput.value.trim(),
               role: roleInput.value.trim(),
               email: emailInput.value.trim() || undefined,
               phone: phoneInput.value.trim() || undefined,
               studentID: sidInput.value.trim() || undefined,
               tasks: (r as Researcher).tasks ?? [],
             });
             this.close();
           });

    setTimeout(() => nameInput.focus(), 50);
  }

  onClose(): void { this.contentEl.empty(); }
}
