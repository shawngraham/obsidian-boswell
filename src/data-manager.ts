import { App, normalizePath, parseYaml, stringifyYaml, TFile, TFolder, Vault } from "obsidian";
import type { BswSettings, Experiment, Funding, LogEntry, ProjectMetadata, Researcher, Task, WritingProject } from "./types";
import { DEFAULT_META } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function frontmatterBlock(data: unknown): string {
  return `---\n${stringifyYaml(data)}---\n`;
}

function parseFrontmatter(content: string): { fm: Record<string, unknown>; body: string } {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: content };
  try {
    const fm = (parseYaml(m[1]) as Record<string, unknown>) ?? {};
    return { fm, body: m[2] ?? "" };
  } catch {
    return { fm: {}, body: content };
  }
}

function safeArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? (val as T[]) : [];
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── DataManager ──────────────────────────────────────────────────────────────

export class DataManager {
  constructor(private app: App, private settings: BswSettings) {}

  private path(...parts: string[]): string {
    return normalizePath([this.settings.dataFolder, ...parts].join("/"));
  }

  // ── ensure folder exists ───────────────────────────────────────────────────

  private async ensureFolder(folderPath: string): Promise<void> {
    const norm = normalizePath(folderPath);
    if (!(this.app.vault.getAbstractFileByPath(norm) instanceof TFolder)) {
      await this.app.vault.createFolder(norm);
    }
  }

  async ensureDataFolder(): Promise<void> {
    await this.ensureFolder(this.settings.dataFolder);
    await this.ensureFolder(this.path("experiments"));
    await this.ensureFolder(this.path("log"));
  }

  // ── generic read / write ───────────────────────────────────────────────────

  private async readFile(filePath: string): Promise<string | null> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) return this.app.vault.read(file);
    return null;
  }

  private async writeFile(filePath: string, content: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(filePath, content);
    }
  }

  // ── Project metadata ───────────────────────────────────────────────────────

  async loadProject(): Promise<ProjectMetadata> {
    const text = await this.readFile(this.path("project.md"));
    if (!text) return { ...DEFAULT_META };
    const { fm } = parseFrontmatter(text);
    const p = (fm.project ?? fm) as Partial<ProjectMetadata>;
    return { ...DEFAULT_META, ...p };
  }

  async saveProject(meta: ProjectMetadata): Promise<void> {
    await this.ensureDataFolder();
    await this.writeFile(this.path("project.md"), frontmatterBlock({ project: meta }));
  }

  // ── Researchers ────────────────────────────────────────────────────────────

  async loadResearchers(): Promise<Researcher[]> {
    const text = await this.readFile(this.path("researchers.md"));
    if (!text) return [];
    const { fm } = parseFrontmatter(text);
    return safeArray<Researcher>(fm.researchers).map((r) => ({ ...r, tasks: safeArray(r.tasks) }));
  }

  async saveResearchers(researchers: Researcher[]): Promise<void> {
    await this.writeFile(this.path("researchers.md"), frontmatterBlock({ researchers }));
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  async loadTasks(): Promise<Task[]> {
    const text = await this.readFile(this.path("tasks.md"));
    if (!text) return [];
    const { fm } = parseFrontmatter(text);
    return safeArray<Task>(fm.tasks);
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    await this.writeFile(this.path("tasks.md"), frontmatterBlock({ tasks }));
  }

  // ── Funding ────────────────────────────────────────────────────────────────

  async loadFunding(): Promise<Funding[]> {
    const text = await this.readFile(this.path("funding.md"));
    if (!text) return [];
    const { fm } = parseFrontmatter(text);
    return safeArray<Funding>(fm.funding).map((f) => ({ ...f, expenses: safeArray(f.expenses) }));
  }

  async saveFunding(funding: Funding[]): Promise<void> {
    await this.writeFile(this.path("funding.md"), frontmatterBlock({ funding }));
  }

  // ── Writing ────────────────────────────────────────────────────────────────

  async loadWriting(): Promise<WritingProject[]> {
    const text = await this.readFile(this.path("writing.md"));
    if (!text) return [];
    const { fm } = parseFrontmatter(text);
    return safeArray<WritingProject>(fm.writing);
  }

  async saveWriting(writing: WritingProject[]): Promise<void> {
    await this.writeFile(this.path("writing.md"), frontmatterBlock({ writing }));
  }

  // ── Experiments ────────────────────────────────────────────────────────────

  async loadExperiments(): Promise<Experiment[]> {
    const folder = this.app.vault.getAbstractFileByPath(this.path("experiments"));
    if (!(folder instanceof TFolder)) return [];
    const experiments: Experiment[] = [];
    for (const child of folder.children) {
      if (!(child instanceof TFile) || child.extension !== "md") continue;
      const content = await this.app.vault.read(child);
      const { fm, body } = parseFrontmatter(content);
      const firstLine = body.trim().split("\n").find((l) => l.trim()) ?? "";
      const rawAliases = fm.aliases;
      const aliases: string[] = Array.isArray(rawAliases)
        ? rawAliases.map(String)
        : typeof rawAliases === "string" ? [rawAliases] : [];
      experiments.push({
        id: child.basename,
        title: (fm.title as string) ?? child.basename,
        date: (fm.date as string) ?? "",
        status: (fm.status as Experiment["status"]) ?? "planned",
        aliases: aliases.length ? aliases : undefined,
        codeRepoUrl: (fm.codeRepoUrl ?? fm.codeLink) as string | undefined,
        codeFolderPath: fm.codeFolderPath as string | undefined,
        taskId: fm.taskId as string | undefined,
        summaryPreview: firstLine.replace(/^#+\s*/, "").slice(0, 120),
      });
    }
    return experiments.sort((a, b) => b.date.localeCompare(a.date));
  }

  async createExperiment(): Promise<Experiment> {
    await this.ensureDataFolder();
    const id = uid();
    const today = new Date().toISOString().split("T")[0];
    const title = "New Experiment";
    const exp: Experiment = { id, title, date: today, status: "planned", aliases: [title] };
    // aliases lets the note be wikilinked by title immediately
    const content = `---\ntitle: "${title}"\naliases:\n  - "${title}"\ndate: ${today}\nstatus: planned\n---\n\nDescribe this experiment here.\n`;
    await this.writeFile(this.path("experiments", `${id}.md`), content);
    return exp;
  }

  async saveExperimentMeta(exp: Experiment): Promise<void> {
    const filePath = this.path("experiments", `${exp.id}.md`);
    const existing = await this.readFile(filePath);
    const { body } = existing ? parseFrontmatter(existing) : { body: "" };
    const { summaryPreview: _, ...meta } = exp;  // summaryPreview is display-only
    await this.writeFile(filePath, `${frontmatterBlock(meta)}\n${body}`);
  }

  async deleteExperiment(id: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(this.path("experiments", `${id}.md`));
    if (file instanceof TFile) await this.app.vault.trash(file, true);
  }

  getExperimentFile(id: string): TFile | null {
    const f = this.app.vault.getAbstractFileByPath(this.path("experiments", `${id}.md`));
    return f instanceof TFile ? f : null;
  }

  // ── Log ────────────────────────────────────────────────────────────────────

  async loadLogEntries(): Promise<LogEntry[]> {
    const folder = this.app.vault.getAbstractFileByPath(this.path("log"));
    if (!(folder instanceof TFolder)) return [];
    const entries: LogEntry[] = [];
    for (const child of folder.children) {
      if (!(child instanceof TFile) || child.extension !== "md") continue;
      const content = await this.app.vault.read(child);
      const { body } = parseFrontmatter(content);
      const firstLine = body.trim().split("\n").find((l) => l.trim() && !l.startsWith("#")) ?? "";
      entries.push({ date: child.basename, preview: firstLine.slice(0, 100) });
    }
    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }

  async getOrCreateLogNote(date: string): Promise<TFile> {
    await this.ensureDataFolder();
    const filePath = this.path("log", `${date}.md`);
    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) return existing;
    const formatted = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const content = `## ${formatted}\n\nWhat did you work on today?\n`;
    return this.app.vault.create(filePath, content);
  }

  async deleteLogEntry(date: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(this.path("log", `${date}.md`));
    if (file instanceof TFile) await this.app.vault.trash(file, true);
  }

  getLogFile(date: string): TFile | null {
    const f = this.app.vault.getAbstractFileByPath(this.path("log", `${date}.md`));
    return f instanceof TFile ? f : null;
  }

  // ── Convenience: initialise a new project ──────────────────────────────────

  async initProject(): Promise<void> {
    await this.ensureDataFolder();
    if (!(await this.readFile(this.path("project.md")))) {
      await this.saveProject(DEFAULT_META);
    }
    if (!(await this.readFile(this.path("researchers.md")))) await this.saveResearchers([]);
    if (!(await this.readFile(this.path("tasks.md")))) await this.saveTasks([]);
    if (!(await this.readFile(this.path("funding.md")))) await this.saveFunding([]);
    if (!(await this.readFile(this.path("writing.md")))) await this.saveWriting([]);
  }

  // ── Linked-note helper ─────────────────────────────────────────────────────

  resolveNote(path: string): TFile | null {
    const f = this.app.vault.getAbstractFileByPath(path);
    return f instanceof TFile ? f : null;
  }
}
