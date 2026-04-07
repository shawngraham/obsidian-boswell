import { WorkspaceLeaf, setIcon } from "obsidian";
import type BswPlugin from "../main";
import type { Researcher, Task } from "../types";
import { BaseView } from "./BaseView";
import { ResearcherModal } from "../modals/ResearcherModal";
import { ConfirmModal } from "../modals/ConfirmModal";

export const VIEW_TYPE_RESEARCHERS = "bsw-researchers";

export class ResearchersView extends BaseView {
  constructor(leaf: WorkspaceLeaf, plugin: BswPlugin) { super(leaf, plugin); }
  getViewType() { return VIEW_TYPE_RESEARCHERS; }
  getDisplayText() { return "Boswell Researchers"; }
  getIcon() { return "users"; }

  async onOpen() { await this.refresh(); }
  async onClose() { this.contentEl.empty(); }

  async refresh() {
    const [researchers, tasks] = await Promise.all([
      this.plugin.dm.loadResearchers(),
      this.plugin.dm.loadTasks(),
    ]);

    const el = this.contentEl;
    el.empty();
    el.addClass("bsw-view");

    const header = el.createDiv({ cls: "bsw-view-header" });
    header.createEl("h1", { cls: "bsw-page-title", text: "Researchers" });
    const addBtn = header.createEl("button", { cls: "bsw-btn bsw-btn-primary" });
    setIcon(addBtn, "plus");
    addBtn.createEl("span", { text: " Add Researcher" });
    addBtn.addEventListener("click", () => {
      new ResearcherModal(this.app, null, async (r) => {
        await this.plugin.dm.saveResearchers([...researchers, r]);
        await this.plugin.refreshViews();
      }).open();
    });

    const grid = el.createDiv({ cls: "bsw-researcher-grid" });

    if (researchers.length === 0) {
      grid.createEl("p", { cls: "bsw-empty", text: "No researchers added yet." });
      return;
    }

    researchers.forEach((r) => {
      const assignedTasks = tasks.filter((t) => t.assigneeId === r.id);
      const done = assignedTasks.filter((t) => t.status === "done").length;

      const card = grid.createDiv({ cls: "bsw-researcher-card" });

      // Name (editable inline)
      const nameInput = card.createEl("input", { cls: "bsw-inline-input bsw-researcher-name", type: "text" }) as HTMLInputElement;
      nameInput.value = r.name;
      nameInput.addEventListener("change", async () => {
        const updated = researchers.map((res) => res.id === r.id ? { ...res, name: nameInput.value } : res);
        await this.plugin.dm.saveResearchers(updated);
      });

      // Role
      const roleInput = card.createEl("input", { cls: "bsw-inline-input bsw-researcher-role", type: "text" }) as HTMLInputElement;
      roleInput.value = r.role;
      roleInput.placeholder = "Role";
      roleInput.addEventListener("change", async () => {
        const updated = researchers.map((res) => res.id === r.id ? { ...res, role: roleInput.value } : res);
        await this.plugin.dm.saveResearchers(updated);
      });

      // Contact fields
      const contacts = card.createDiv({ cls: "bsw-researcher-contacts" });
      const contactFields: Array<{ icon: string; key: keyof Researcher; type: string; placeholder: string }> = [
        { icon: "mail", key: "email", type: "email", placeholder: "Email" },
        { icon: "phone", key: "phone", type: "tel", placeholder: "Phone" },
        { icon: "id-card", key: "studentID", type: "text", placeholder: "Student ID" },
      ];
      contactFields.forEach(({ icon, key, type, placeholder }) => {
        const row = contacts.createDiv({ cls: "bsw-contact-row" });
        const iconEl = row.createSpan({ cls: "bsw-contact-icon" });
        setIcon(iconEl, icon);
        const inp = row.createEl("input", { cls: "bsw-inline-input bsw-small", type, placeholder }) as HTMLInputElement;
        inp.value = (r[key] as string) ?? "";
        inp.addEventListener("change", async () => {
          const updated = researchers.map((res) => res.id === r.id ? { ...res, [key]: inp.value || undefined } : res);
          await this.plugin.dm.saveResearchers(updated);
        });
      });

      // Task summary
      if (assignedTasks.length > 0) {
        const taskSection = card.createDiv({ cls: "bsw-researcher-tasks" });
        taskSection.createEl("p", { cls: "bsw-label-muted", text: "Assigned Tasks" });
        const badge = taskSection.createEl("span", {
          cls: "bsw-badge bsw-badge-info",
          text: `${done}/${assignedTasks.length} done`,
        });
        assignedTasks.slice(0, 4).forEach((t) => {
          const row = taskSection.createDiv({ cls: "bsw-task-mini-row" });
          const dot = row.createDiv({ cls: "bsw-dot bsw-dot-sm" });
          dot.addClass(t.status === "done" ? "bsw-dot-green" : t.status === "blocked" ? "bsw-dot-danger" : t.status === "in-progress" ? "bsw-dot-blue" : "bsw-dot-neutral");
          row.createEl("span", { cls: "bsw-small", text: t.title });
        });
      }

      // Remove button
      const footer = card.createDiv({ cls: "bsw-researcher-footer" });
      const removeBtn = footer.createEl("button", { cls: "bsw-btn bsw-btn-ghost bsw-text-danger bsw-small" });
      removeBtn.setText("Remove");
      removeBtn.addEventListener("click", () => {
        new ConfirmModal(this.app, `Remove ${r.name}?`, async () => {
          await this.plugin.dm.saveResearchers(researchers.filter((res) => res.id !== r.id));
          await this.plugin.refreshViews();
        }, "Remove").open();
      });
    });
  }
}
