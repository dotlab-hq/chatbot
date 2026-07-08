"use client";

import {
  BrainIcon,
  CheckIcon,
  FileIcon,
  FolderIcon,
  GlobeIcon,
  LinkIcon,
  LoaderIcon,
  LogOutIcon,
  MessageSquareIcon,
  MonitorSmartphoneIcon,
  PlusIcon,
  ServerIcon,
  SettingsIcon,
  TerminalIcon,
  TrashIcon,
  UploadIcon,
  UserIcon,
  UserRoundPenIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { GeneralTab } from "@/components/chat/general-tab";
import { PersonalizationTab } from "@/components/chat/personalize-tab";
import { SkillsTab } from "@/components/chat/skills-tab";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { authClient, useSession } from "@/lib/auth-client";

// ─── Types ──────────────────────────────────────────────────────────────────

type TabId =
  | "account"
  | "projects"
  | "mcp"
  | "skills"
  | "general"
  | "personalize";

type Project = {
  id: string;
  name: string;
  description: string | null;
  vectorStoreId: string | null;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
};

type ProjectFile = {
  id: string;
  projectId: string;
  openaiFileId: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  status: "uploading" | "processing" | "ready" | "failed";
  liveStatus?: "uploading" | "processing" | "ready" | "failed";
  createdAt: string;
};

type ProjectChat = {
  id: string;
  title: string;
  createdAt: string;
};

type McpServer = {
  id: string;
  name: string;
  description: string | null;
  transport: "stdio" | "sse" | "streamable-http";
  url: string | null;
  command: string | null;
  args: string[] | null;
  enabled: boolean;
  lastConnectedAt: string | null;
  createdAt: string;
};

// ─── Tab Definition ─────────────────────────────────────────────────────────

const tabs: { id: TabId; label: string; icon: typeof UserIcon | null }[] = [
  { id: "account", label: "Account", icon: UserIcon },
  { id: "projects", label: "Projects", icon: FolderIcon },
  { id: "mcp", label: "MCP Servers", icon: ServerIcon },
  { id: "skills", label: "Skills", icon: BrainIcon },
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "personalize", label: "Personalization", icon: UserRoundPenIcon },
];

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const session = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("account");

  useEffect(() => {
    if (!session?.data) {
      router.push("/login");
    }
  }, [session, router]);

  if (!session?.data) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Manage your account, projects, and integrations.
      </p>

      {/* Tab Navigation */}
      <nav className="mb-8 flex gap-1 rounded-xl border border-border/50 bg-muted/30 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {Icon && <Icon className="size-4" />}
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Tab Content */}
      {activeTab === "account" && <AccountTab />}
      {activeTab === "projects" && <ProjectsTab />}
      {activeTab === "mcp" && <McpTab />}
      {activeTab === "skills" && <SkillsTab />}
      {activeTab === "general" && <GeneralTab />}
      {activeTab === "personalize" && <PersonalizationTab />}
    </div>
  );
}

// ─── Account Tab ────────────────────────────────────────────────────────────

function AccountTab() {
  const session = useSession();
  const router = useRouter();
  const user = session?.data?.user;

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setEmail(user.email ?? "");
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      toast.success("Profile updated successfully");
      await session?.refetch();
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  // Generate avatar color from email
  const hue = user?.email
    ? user.email.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360
    : 220;

  const initials = (user?.name ?? user?.email ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <section className="rounded-xl border border-border/50 bg-card p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">
          Profile
        </h2>
        <div className="flex items-center gap-4">
          <div
            className={`flex size-16 items-center justify-center rounded-full text-lg font-semibold text-white bg-[hsl(${hue},70%,50%)]`}
          >
            {initials}
          </div>
          <div>
            <p className="text-sm font-medium">{user?.name ?? "Unnamed"}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Member since{" "}
              {new Date(user?.createdAt ?? Date.now()).toLocaleDateString()}
            </p>
          </div>
        </div>
      </section>

      {/* Edit Profile */}
      <section className="rounded-xl border border-border/50 bg-card p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">
          Edit Profile
        </h2>
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="name">
              Name
            </label>
            <Input
              id="name"
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              value={name}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              type="email"
              value={email}
            />
          </div>
          <div className="flex justify-end">
            <Button disabled={saving} type="submit">
              {saving ? (
                <LoaderIcon className="size-4 animate-spin" />
              ) : (
                <CheckIcon className="size-4" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </section>

      {/* Sign out of this device */}
      <section className="rounded-xl border border-border/50 bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/60">
            <MonitorSmartphoneIcon className="size-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-medium">Sign out of this device</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              You will be redirected to the login page. You can sign back in at
              any time.
            </p>
          </div>
          <Button
            className="shrink-0 gap-1.5"
            onClick={() => {
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    router.push("/login");
                  },
                },
              });
            }}
            size="sm"
            variant="outline"
          >
            <LogOutIcon className="size-3.5" />
            Sign Out
          </Button>
        </div>
      </section>
    </div>
  );
}

// ─── Projects Tab ───────────────────────────────────────────────────────────

function ProjectsTab() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [projectChats, setProjectChats] = useState<ProjectChat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/projects");
      if (response.ok) {
        const data = (await response.json()) as { projects: Project[] };
        setProjects(data.projects);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFiles = useCallback(async (projectId: string) => {
    setLoadingFiles(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/files`);
      if (response.ok) {
        const data = (await response.json()) as { files: ProjectFile[] };
        setProjectFiles(data.files);
      }
    } catch {
      // silent
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  const loadChats = useCallback(async (projectId: string) => {
    setLoadingChats(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/chats?limit=50`);
      if (response.ok) {
        const data = (await response.json()) as { chats: ProjectChat[] };
        setProjectChats(data.chats);
      }
    } catch {
      // silent
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (selectedProject) {
      loadFiles(selectedProject.id);
      loadChats(selectedProject.id);
    }
  }, [selectedProject, loadFiles, loadChats]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      return;
    }
    setCreating(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create project");
      }

      toast.success("Project created");
      setNewName("");
      setNewDescription("");
      setShowCreate(false);
      await loadProjects();
    } catch {
      toast.error("Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (project: Project) => {
    try {
      const response = await fetch(`/api/projects?id=${project.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete project");
      }

      toast.success(`"${project.name}" deleted`);
      if (selectedProject?.id === project.id) {
        setSelectedProject(null);
        setProjectFiles([]);
      }
      setDeleteTarget(null);
      await loadProjects();
    } catch {
      toast.error("Failed to delete project");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProject) {
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/projects/${selectedProject.id}/files`,
        { method: "POST", body: formData }
      );

      if (!response.ok) {
        throw new Error("Failed to upload file");
      }

      toast.success(`Uploaded "${file.name}"`);
      await loadFiles(selectedProject.id);
      await loadProjects();
    } catch {
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteFile = async (file: ProjectFile) => {
    if (!selectedProject) {
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${selectedProject.id}/files?id=${file.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete file");
      }

      toast.success(`"${file.fileName}" removed`);
      await loadFiles(selectedProject.id);
      await loadProjects();
    } catch {
      toast.error("Failed to delete file");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">
            Your Projects
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Projects use OpenAI Vector Stores for knowledge retrieval.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <PlusIcon className="size-4" />
          New Project
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              className="rounded-xl border border-border/50 bg-card p-4"
              key={i}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="size-7 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
          <FolderIcon className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No projects yet. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <button
              className={`w-full text-left group cursor-pointer rounded-xl border bg-card p-4 transition-colors ${
                selectedProject?.id === project.id
                  ? "border-primary/50 ring-1 ring-primary/20"
                  : "border-border/50 hover:border-border"
              }`}
              key={project.id}
              onClick={() => {
                setSelectedProject(project);
              }}
              type="button"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{project.name}</p>
                  {project.description && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {project.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileIcon className="size-3" />
                      {project.fileCount} file
                      {project.fileCount === 1 ? "" : "s"}
                    </span>
                    <span>
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  aria-label="Delete project"
                  className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(project);
                  }}
                  type="button"
                >
                  <TrashIcon className="size-4" />
                </button>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected Project Detail */}
      {selectedProject && (
        <div className="space-y-6">
          {/* Project Info */}
          <section className="rounded-xl border border-border/50 bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">{selectedProject.name}</h3>
                {selectedProject.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {selectedProject.description}
                  </p>
                )}
                {selectedProject.vectorStoreId && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <LinkIcon className="size-3" />
                    Vector Store connected
                  </p>
                )}
              </div>
            </div>

            {/* Chats */}
            <div className="mb-5">
              <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                Chats
              </h4>
              {loadingChats ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton className="h-10 w-full" key={i} />
                  ))}
                </div>
              ) : projectChats.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  No chats in this project yet. Start a chat from the sidebar to
                  link it here.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {projectChats.map((c) => (
                    <a
                      className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/50"
                      href={`/chat/${c.id}`}
                      key={c.id}
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquareIcon className="size-3.5 text-muted-foreground" />
                        <span className="truncate text-xs font-medium">
                          {c.title}
                        </span>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Files */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-medium text-muted-foreground">
                  Files
                </h4>
                <label>
                  <input
                    accept=".txt,.md,.pdf,.csv,.json,.docx"
                    className="hidden"
                    onChange={handleFileUpload}
                    type="file"
                  />
                  <Button
                    asChild
                    disabled={uploading}
                    size="sm"
                    variant="outline"
                  >
                    <span>
                      {uploading ? (
                        <LoaderIcon className="size-4 animate-spin" />
                      ) : (
                        <UploadIcon className="size-4" />
                      )}
                      Upload File
                    </span>
                  </Button>
                </label>
              </div>
              {loadingFiles ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <Skeleton className="h-10 w-full" key={i} />
                  ))}
                </div>
              ) : projectFiles.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  No files uploaded yet. Upload documents to populate the vector
                  store.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {projectFiles.map((file) => (
                    <div
                      className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2"
                      key={file.id}
                    >
                      <div className="flex items-center gap-2">
                        <FileIcon className="size-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-medium">{file.fileName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {file.fileSize
                              ? `${(file.fileSize / 1024).toFixed(1)} KB`
                              : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={file.liveStatus ?? file.status} />
                        <button
                          aria-label="Delete file"
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            handleDeleteFile(file);
                          }}
                          type="button"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog onOpenChange={setShowCreate} open={showCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>
              Create a new project with an OpenAI Vector Store for knowledge
              retrieval.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="project-name">
                Name
              </label>
              <Input
                id="project-name"
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My Project"
                required
                value={newName}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="project-desc">
                Instructions
              </label>
              <Textarea
                id="project-desc"
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Custom instructions for this project's AI context..."
                rows={3}
                value={newDescription}
              />
            </div>
            <DialogFooter>
              <Button
                onClick={() => setShowCreate(false)}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button disabled={creating || !newName.trim()} type="submit">
                {creating ? (
                  <LoaderIcon className="size-4 animate-spin" />
                ) : (
                  <PlusIcon className="size-4" />
                )}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        open={!!deleteTarget}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This will also remove all files and the associated vector store
              data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  handleDelete(deleteTarget);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── MCP Servers Tab ────────────────────────────────────────────────────────

function McpTab() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<McpServer | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTransport, setFormTransport] = useState<
    "stdio" | "sse" | "streamable-http"
  >("sse");
  const [formUrl, setFormUrl] = useState("");
  const [formCommand, setFormCommand] = useState("");
  const [formArgs, setFormArgs] = useState("");

  const loadServers = useCallback(async () => {
    try {
      const response = await fetch("/api/mcp-servers");
      if (response.ok) {
        const data = (await response.json()) as { servers: McpServer[] };
        setServers(data.servers);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormTransport("sse");
    setFormUrl("");
    setFormCommand("");
    setFormArgs("");
  };

  const openCreate = () => {
    resetForm();
    setEditingServer(null);
    setShowCreate(true);
  };

  const openEdit = (server: McpServer) => {
    setEditingServer(server);
    setFormName(server.name);
    setFormDescription(server.description ?? "");
    setFormTransport(server.transport);
    setFormUrl(server.url ?? "");
    setFormCommand(server.command ?? "");
    setFormArgs(server.args?.join(" ") ?? "");
    setShowCreate(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      return;
    }
    setCreating(true);

    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        transport: formTransport,
        url: formUrl.trim() || undefined,
        command: formCommand.trim() || undefined,
        args: formArgs.trim() ? formArgs.trim().split(/\s+/) : undefined,
      };

      const url = editingServer
        ? `/api/mcp-servers?id=${editingServer.id}`
        : "/api/mcp-servers";
      const method = editingServer ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save server");
      }

      toast.success(editingServer ? "Server updated" : "Server added");
      setShowCreate(false);
      resetForm();
      setEditingServer(null);
      await loadServers();
    } catch {
      toast.error("Failed to save MCP server");
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (server: McpServer) => {
    try {
      const response = await fetch(`/api/mcp-servers?id=${server.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !server.enabled }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle server");
      }
      await loadServers();
    } catch {
      toast.error("Failed to toggle server");
    }
  };

  const handleDelete = async (server: McpServer) => {
    try {
      const response = await fetch(`/api/mcp-servers?id=${server.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete server");
      }
      toast.success(`"${server.name}" removed`);
      setDeleteTarget(null);
      await loadServers();
    } catch {
      toast.error("Failed to delete MCP server");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">
            MCP Servers
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Connect Model Context Protocol servers to extend capabilities.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <PlusIcon className="size-4" />
          Add Server
        </Button>
      </div>

      {servers.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
          <ServerIcon className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No MCP servers configured. Add one to extend the chatbot with
            external tools.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((server) => (
            <div
              className="group rounded-xl border border-border/50 bg-card p-4 transition-colors hover:border-border"
              key={server.id}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {server.name}
                    </p>
                    <TransportBadge transport={server.transport} />
                    {server.enabled ? (
                      <Badge
                        className="border-green-500/50 text-green-600"
                        variant="outline"
                      >
                        Enabled
                      </Badge>
                    ) : (
                      <Badge
                        className="text-muted-foreground"
                        variant="outline"
                      >
                        Disabled
                      </Badge>
                    )}
                  </div>
                  {server.description && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {server.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    {server.transport === "stdio" && server.command && (
                      <span className="flex items-center gap-1">
                        <TerminalIcon className="size-3" />
                        {server.command}
                      </span>
                    )}
                    {(server.transport === "sse" ||
                      server.transport === "streamable-http") &&
                      server.url && (
                        <span className="flex items-center gap-1">
                          <GlobeIcon className="size-3" />
                          {server.url}
                        </span>
                      )}
                    {server.lastConnectedAt && (
                      <span>
                        Last connected{" "}
                        {new Date(server.lastConnectedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    aria-label={
                      server.enabled ? "Disable server" : "Enable server"
                    }
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                    onClick={() => {
                      handleToggle(server);
                    }}
                    type="button"
                  >
                    {server.enabled ? (
                      <XIcon className="size-4" />
                    ) : (
                      <CheckIcon className="size-4" />
                    )}
                  </button>
                  <button
                    aria-label="Edit server"
                    className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                    onClick={() => {
                      openEdit(server);
                    }}
                    type="button"
                  >
                    <LinkIcon className="size-4" />
                  </button>
                  <button
                    aria-label="Delete server"
                    className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    onClick={() => {
                      setDeleteTarget(server);
                    }}
                    type="button"
                  >
                    <TrashIcon className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog onOpenChange={setShowCreate} open={showCreate}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingServer ? "Edit MCP Server" : "Add MCP Server"}
            </DialogTitle>
            <DialogDescription>
              Configure a Model Context Protocol server to extend the chatbot
              with external tools and resources.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="mcp-name">
                Name
              </label>
              <Input
                id="mcp-name"
                onChange={(e) => setFormName(e.target.value)}
                placeholder="My MCP Server"
                required
                value={formName}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="mcp-desc">
                Description
              </label>
              <Input
                id="mcp-desc"
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What does this server provide?"
                value={formDescription}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="mcp-transport">
                Transport
              </label>
              <select
                className="h-9 w-full min-w-0 rounded-4xl border border-input bg-input/30 px-3 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
                id="mcp-transport"
                onChange={(e) =>
                  setFormTransport(
                    e.target.value as "stdio" | "sse" | "streamable-http"
                  )
                }
                value={formTransport}
              >
                <option value="sse">SSE (Server-Sent Events)</option>
                <option value="streamable-http">Streamable HTTP</option>
                <option value="stdio">Stdio (Local Process)</option>
              </select>
            </div>

            {formTransport === "stdio" ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="mcp-command">
                    Command
                  </label>
                  <Input
                    id="mcp-command"
                    onChange={(e) => setFormCommand(e.target.value)}
                    placeholder="npx"
                    value={formCommand}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="mcp-args">
                    Arguments{" "}
                    <span className="text-muted-foreground">
                      (space-separated)
                    </span>
                  </label>
                  <Input
                    id="mcp-args"
                    onChange={(e) => setFormArgs(e.target.value)}
                    placeholder="@modelcontextprotocol/server-filesystem /path"
                    value={formArgs}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="mcp-url">
                  URL
                </label>
                <Input
                  id="mcp-url"
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder={
                    formTransport === "sse"
                      ? "https://example.com/mcp/sse"
                      : "https://example.com/mcp"
                  }
                  value={formUrl}
                />
              </div>
            )}

            <DialogFooter>
              <Button
                onClick={() => {
                  setShowCreate(false);
                  setEditingServer(null);
                }}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button disabled={creating || !formName.trim()} type="submit">
                {creating ? (
                  <LoaderIcon className="size-4 animate-spin" />
                ) : editingServer ? (
                  <CheckIcon className="size-4" />
                ) : (
                  <PlusIcon className="size-4" />
                )}
                {editingServer ? "Save" : "Add Server"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        open={!!deleteTarget}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove MCP Server</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &quot;{deleteTarget?.name}&quot;?
              This will disconnect any active sessions with this server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  handleDelete(deleteTarget);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Small Helpers ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProjectFile["status"] }) {
  const styles: Record<string, string> = {
    uploading: "border-blue-500/50 text-blue-600 bg-blue-500/5",
    processing: "border-amber-500/50 text-amber-600 bg-amber-500/5",
    ready: "border-green-500/50 text-green-600 bg-green-500/5",
    failed: "border-destructive/50 text-destructive bg-destructive/5",
  };

  return (
    <Badge className={`text-[10px] ${styles[status] ?? ""}`} variant="outline">
      {status}
    </Badge>
  );
}

function TransportBadge({ transport }: { transport: McpServer["transport"] }) {
  const labels: Record<string, string> = {
    stdio: "Stdio",
    sse: "SSE",
    "streamable-http": "HTTP",
  };

  return (
    <Badge className="text-[10px]" variant="secondary">
      {labels[transport] ?? transport}
    </Badge>
  );
}
