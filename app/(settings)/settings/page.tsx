"use client";

import {
  BrainIcon,
  CheckIcon,
  ClockIcon,
  FileIcon,
  FolderIcon,
  GlobeIcon,
  KeyIcon,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { authClient, useSession } from "@/lib/auth-client";

// ─── Types ──────────────────────────────────────────────────────────────────

type TabId =
  | "account"
  | "security"
  | "projects"
  | "mcp-servers"
  | "mcp-apps"
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
  headers: Record<string, string> | null;
  enabled: boolean;
  lastConnectedAt: string | null;
  createdAt: string;
};

// ─── Tab Definition ─────────────────────────────────────────────────────────

const tabs: { id: TabId; label: string; icon: typeof UserIcon | null }[] = [
  { id: "account", label: "Account", icon: UserIcon },
  { id: "security", label: "Security", icon: KeyIcon },
  { id: "projects", label: "Projects", icon: FolderIcon },
  { id: "mcp-servers", label: "MCP Servers", icon: ServerIcon },
  { id: "mcp-apps", label: "MCP Apps", icon: ServerIcon },
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
      {activeTab === "security" && <SecurityTab />}
      {activeTab === "projects" && <ProjectsTab />}
      {activeTab === "mcp-servers" && <McpTab />}
      {activeTab === "mcp-apps" && <McpAppsTab />}
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

// ─── Security Tab ────────────────────────────────────────────────────────────

function SecurityTab() {
  const router = useRouter();
  const session = useSession();
  const _user = session?.data?.user;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDeleteAccount = async () => {
    try {
      const response = await fetch("/api/user/account", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete account");
      }

      toast.success("Account deleted. Redirecting...");
      authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/login");
          },
        },
      });
      setShowDeleteDialog(false);
    } catch {
      toast.error("Failed to delete account");
    }
  };

  return (
    <div className="space-y-6">
      {/* Danger Zone */}
      <section className="rounded-xl border border-destructive/50 bg-card p-6">
        <h2 className="mb-4 text-sm font-medium text-destructive">
          Danger Zone
        </h2>
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
            <TrashIcon className="size-5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium">Delete Account</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Permanently delete your account and all associated data. This
              cannot be undone.
            </p>
          </div>
          <Button
            className="shrink-0 gap-1.5"
            onClick={() => setShowDeleteDialog(true)}
            size="sm"
            variant="destructive"
          >
            <TrashIcon className="size-3.5" />
            Delete Account
          </Button>
        </div>
      </section>

      {/* Delete Confirmation Dialog */}
      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your account? This action cannot
              be undone. Your chats, projects, and all associated data will be
              permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteAccount}
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Projects Tab ────────────────────────────────────────────────────────────

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

      toast.success(`\"${project.name}\" deleted`);
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

      toast.success(`Uploaded \"${file.name}\"`);
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

      toast.success(`\"${file.fileName}\" removed`);
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