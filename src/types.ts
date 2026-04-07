// ─── Core types ──────────────────────────────────────────────────────────────

export interface ProjectMetadata {
  title: string;
  pi: string;
  institution: string;
  description: string;
  currency: string;
  startDate?: string;
  endDate?: string;
}

export const DEFAULT_META: ProjectMetadata = {
  title: "Research Project",
  pi: "",
  institution: "",
  description: "",
  currency: "$",
};

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  reportFiled: boolean;
  category?: string;
}

export interface Funding {
  id: string;
  source: string;
  amount: number;
  expenses: Expense[];
  deadline?: string;
  notes?: string;
}

export interface Task {
  id: string;
  title: string;
  status: "todo" | "in-progress" | "blocked" | "done";
  assigneeId?: string;
  dueDate?: string;
  description?: string;
  parentType?: "writing" | "experiment";
  parentId?: string;
  parentTitle?: string;
  linkedNotePath?: string;
}

export interface Researcher {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  studentID?: string;
  tasks: string[];
}

export interface WritingProject {
  id: string;
  title: string;
  wordCount: number;
  targetWordCount: number;
  status: "drafting" | "review" | "final";
  taskId?: string;
  linkedNotePath?: string;
}

export interface Experiment {
  id: string;
  title: string;
  date: string;
  status: "planned" | "running" | "completed";
  /**
   * Aliases pre-populated with the title so the experiment note is immediately
   * reachable via [[title]] wikilinks without knowing the file's id-based name.
   */
  aliases?: string[];
  /** URL to a GitHub (or any remote) code repository */
  codeRepoUrl?: string;
  /** Vault-relative path to a local folder or note containing code */
  codeFolderPath?: string;
  taskId?: string;
  /** Transient — first line of note body for list previews, not stored in YAML */
  summaryPreview?: string;
}

export interface LogEntry {
  date: string;
  preview?: string;
}

export interface BswSettings {
  dataFolder: string;
  openOnStartup: boolean;
}

export const DEFAULT_SETTINGS: BswSettings = {
  dataFolder: "_boswell",
  openOnStartup: false,
};
