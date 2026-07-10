"use client";

import {
  CameraIcon,
  Check,
  FileIcon,
  FolderIcon,
  LightbulbIcon,
  LinkIcon,
  LoaderIcon,
  LogOutIcon,
  MenuIcon,
  MonitorSmartphoneIcon,
  PlusIcon,
  Server,
  SettingsIcon,
  TerminalIcon,
  TrashIcon,
  UploadIcon,
  User,
  UserRoundPenIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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
  Dialog as CreateDialog,
  DialogContent as CreateDialogContent,
  DialogDescription as CreateDialogDescription,
  DialogFooter as CreateDialogFooter,
  DialogHeader as CreateDialogHeader,
  DialogTitle as CreateDialogTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { authClient, useSession } from "@/lib/auth-client";

// ─── Types ──────────────────────────────────────────────────────────────────

type TabId =
  | "account"
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

const navItems: { id: TabId; label: string; icon: typeof User | null }[] = [
  { id: "account", label: "Account", icon: User },
  { id: "projects", label: "Projects", icon: FolderIcon },
  { id: "mcp-servers", label: "MCP Servers", icon: Server },
  { id: "mcp-apps", label: "MCP Apps", icon: Server },
  { id: "skills", label: "Skills", icon: LightbulbIcon },
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "personalize", label: "Personalization", icon: UserRoundPenIcon },
];

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab?: TabId;
}

export function SettingsSheet({ open, onOpenChange, tab }: SettingsSheetProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="overflow-hidden p-0 h-[min(500px,85dvh)] w-[calc(100vw-2rem)] max-w-[680px] md:max-w-[680px]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your account, projects, and integrations.
        </DialogDescription>
        <SidebarProvider className="min-h-0 h-full items-stretch">
          <InnerSettings initialTab={tab} onClose={() => onOpenChange(false)} />
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}

function InnerSettings({
  onClose,
  initialTab,
}: {
  onClose: () => void;
  initialTab?: TabId;
}) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? "account");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeLabel =
    navItems.find((n) => n.id === activeTab)?.label ?? "Settings";

  return (
    <>
      {/* Mobile nav sheet — slides from right */}
      <Sheet onOpenChange={setMobileNavOpen} open={mobileNavOpen}>
        <SheetContent className="w-[260px] sm:w-[300px]" side="right">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-sm">Navigation</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileNavOpen(false);
                  }}
                  type="button"
                >
                  {Icon ? <Icon className="size-4 shrink-0" /> : null}
                  {item.label}
                </button>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar — narrower */}
      <Sidebar
        className="hidden md:flex border-r border-border/50 w-40 shrink-0"
        collapsible="none"
      >
        <SidebarContent className="pt-2">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        asChild
                        className={`mx-1.5 rounded-md transition-colors ${
                          isActive
                            ? "bg-accent text-accent-foreground font-medium shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        }`}
                        isActive={isActive}
                        onClick={() => setActiveTab(item.id)}
                      >
                        <button type="button">
                          {Icon ? <Icon className="size-4" /> : null}
                          <span className="text-[13px]">{item.label}</span>
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      {/* Content */}
      <main className="flex min-h-0 md:h-[500px] flex-1 flex-col overflow-hidden">
        {/* Mobile header inside content */}
        <div className="flex md:hidden shrink-0 items-center justify-between border-b border-border/50 bg-muted/10 px-3 py-2.5">
          <span className="text-sm font-medium">{activeLabel}</span>
          <div className="flex items-center gap-1">
            <Button
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
              size="icon-sm"
              variant="ghost"
            >
              <MenuIcon className="size-4" />
            </Button>
            <Button
              aria-label="Close settings"
              onClick={onClose}
              size="icon-sm"
              variant="ghost"
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3 md:p-4">
          {activeTab === "account" && <AccountTab />}
          {activeTab === "projects" && <ProjectsTab />}
          {activeTab === "mcp-servers" && <McpTab />}
          {activeTab === "mcp-apps" && <McpAppsTab />}
          {activeTab === "skills" && <SkillsTab />}
          {activeTab === "general" && <GeneralTab />}
          {activeTab === "personalize" && <PersonalizationTab />}
        </div>
      </main>
    </>
  );
}

// ─── Account Tab (merged profile + edit into one card) ─────────────────────

function UserAvatar({
  user,
  size = "md",
  className = "",
}: {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = { sm: "size-6", md: "size-11", lg: "size-20" };

  const hue = user?.email
    ? user.email.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360
    : 220;

  const initials = (user?.name ?? user?.email ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (user?.image) {
    return (
      <Image
        alt="Avatar"
        className={`${sizeClasses[size]} rounded-full object-cover ring-1 ring-border/50 shrink-0 ${className}`}
        height={80}
        src={user.image}
        unoptimized
        width={80}
      />
    );
  }

  const textSize =
    size === "sm" ? "text-xs" : size === "lg" ? "text-2xl" : "text-sm";
  const hueBucket = (Math.round(hue / 30) * 30) % 360;
  return (
    <div
      className={`${sizeClasses[size]} flex items-center justify-center rounded-full ${textSize} font-semibold text-white shrink-0 ${className} avatar-gradient-${hueBucket}`}
    >
      {initials}
    </div>
  );
}

function AccountTab() {
  const session = useSession();
  const router = useRouter();
  const user = session?.data?.user;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showEdit, setShowEdit] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setEmail(user.email ?? "");
    }
  }, [user]);

  const openEdit = () => {
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setShowEdit(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      if (!r.ok) {
        throw new Error("Profile update failed");
      }
      toast.success("Profile updated");
      await session?.refetch();
      setShowEdit(false);
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/user/avatar", { method: "POST", body: fd });
      if (!r.ok) {
        throw new Error("Avatar upload failed");
      }
      toast.success("Avatar updated");
      await session?.refetch();
    } catch {
      toast.error("Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      const r = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: null }),
      });
      if (!r.ok) {
        throw new Error("Failed to remove avatar");
      }
      toast.success("Avatar removed");
      await session?.refetch();
    } catch {
      toast.error("Failed to remove avatar");
    }
  };

  return (
    <div className="space-y-2">
      {/* Profile card */}
      <section className="rounded-lg border border-border bg-card p-3 md:p-4">
        <div className="flex items-center gap-3">
          <UserAvatar size="md" user={user} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-tight truncate">
              {user?.name ?? "Unnamed"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              Member since{" "}
              {new Date(user?.createdAt ?? Date.now()).toLocaleDateString()}
            </p>
          </div>
          <Button
            className="shrink-0 h-7 text-xs gap-1"
            onClick={openEdit}
            size="sm"
            variant="outline"
          >
            Edit Profile
          </Button>
        </div>
      </section>

      {/* Sign out of this device */}
      <section className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/60">
            <MonitorSmartphoneIcon className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Sign out of this device</p>
            <p className="text-[10px] text-muted-foreground">
              You can sign back in at any time.
            </p>
          </div>
          <Button
            className="shrink-0 h-7 text-xs gap-1"
            onClick={() => {
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => router.push("/login"),
                },
              });
            }}
            size="sm"
            variant="outline"
          >
            <LogOutIcon className="size-3" />
            Sign Out
          </Button>
        </div>
      </section>

      {/* Edit profile dialog */}
      <Dialog onOpenChange={setShowEdit} open={showEdit}>
        <CreateDialogContent>
          <CreateDialogHeader>
            <CreateDialogTitle>Edit Profile</CreateDialogTitle>
            <CreateDialogDescription>
              Update your name, email, or avatar.
            </CreateDialogDescription>
          </CreateDialogHeader>
          <form className="space-y-4" onSubmit={handleSave}>
            {/* Avatar section */}
            <div className="flex items-center gap-3">
              <div className="relative group">
                <UserAvatar size="lg" user={user} />
                <button
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                  disabled={uploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  {uploadingAvatar ? (
                    <LoaderIcon className="size-5 text-white animate-spin" />
                  ) : (
                    <CameraIcon className="size-5 text-white" />
                  )}
                </button>
              </div>
              <div className="flex flex-col gap-1">
                <input
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  aria-label="Upload avatar image"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  ref={fileInputRef}
                  type="file"
                />
                <Button
                  className="h-7 text-xs gap-1"
                  disabled={uploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {uploadingAvatar ? (
                    <LoaderIcon className="size-3 animate-spin" />
                  ) : (
                    <UploadIcon className="size-3" />
                  )}
                  {user?.image ? "Change Avatar" : "Upload Avatar"}
                </Button>
                {user?.image && (
                  <Button
                    className="h-7 text-xs gap-1"
                    onClick={handleRemoveAvatar}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="dialog-name">
                Name
              </label>
              <Input
                id="dialog-name"
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                value={name}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="dialog-email">
                Email
              </label>
              <Input
                id="dialog-email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                type="email"
                value={email}
              />
            </div>
            <CreateDialogFooter>
              <Button
                onClick={() => setShowEdit(false)}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button disabled={saving} type="submit">
                {saving ? (
                  <LoaderIcon className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Save Changes
              </Button>
            </CreateDialogFooter>
          </form>
        </CreateDialogContent>
      </Dialog>
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
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const r = await fetch("/api/projects");
      if (r.ok) {
        const d = (await r.json()) as { projects: Project[] };
        setProjects(d.projects);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFiles = useCallback(async (projectId: string) => {
    setLoadingFiles(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/files`);
      if (r.ok) {
        const d = (await r.json()) as { files: ProjectFile[] };
        setProjectFiles(d.files);
      }
    } catch {
      /* silent */
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);
  useEffect(() => {
    if (selectedProject) {
      loadFiles(selectedProject.id);
    }
  }, [selectedProject, loadFiles]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      return;
    }
    setCreating(true);
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
        }),
      });
      if (!r.ok) {
        throw new Error("Project creation failed");
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
      const r = await fetch(`/api/projects?id=${project.id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        throw new Error("Project deletion failed");
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
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/projects/${selectedProject.id}/files`, {
        method: "POST",
        body: fd,
      });
      if (!r.ok) {
        throw new Error("File upload failed");
      }
      toast.success(`Uploaded "${file.name}"`);
      window.dispatchEvent(new CustomEvent("project-files-changed"));
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
      const r = await fetch(
        `/api/projects/${selectedProject.id}/files?id=${file.id}`,
        { method: "DELETE" }
      );
      if (!r.ok) {
        throw new Error("File deletion failed");
      }
      toast.success(`"${file.fileName}" removed`);
      window.dispatchEvent(new CustomEvent("project-files-changed"));
      await loadFiles(selectedProject.id);
      await loadProjects();
    } catch {
      toast.error("Failed to delete file");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-card/50 p-8 text-center">
          <FolderIcon className="mx-auto mb-2 size-7 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No projects yet
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground/60">
            Create a project to upload files and build knowledge.
          </p>
          <Button
            className="mt-4 h-7 text-xs gap-1"
            onClick={() => setShowCreate(true)}
            size="sm"
          >
            <PlusIcon className="size-3.5" />
            Create your first project
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {projects.length} project{projects.length === 1 ? "" : "s"}
            </p>
            <Button
              className="h-7 text-xs gap-1"
              onClick={() => setShowCreate(true)}
              size="sm"
            >
              <PlusIcon className="size-3.5" />
              New
            </Button>
          </div>
          <div className="space-y-1.5">
            {projects.map((project) => (
              <button
                className={`w-full text-left group cursor-pointer rounded-lg border bg-card p-3 transition-colors ${
                  selectedProject?.id === project.id
                    ? "border-primary/50 ring-1 ring-primary/20 bg-accent/30"
                    : "border-border hover:border-border/80"
                }`}
                key={project.id}
                onClick={() => setSelectedProject(project)}
                type="button"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {project.name}
                    </p>
                    {project.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {project.description}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileIcon className="size-3" />
                        {project.fileCount} file
                        {project.fileCount === 1 ? "" : "s"}
                      </span>
                      <span className="text-muted-foreground/30">/</span>
                      <span>
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    aria-label="Delete project"
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 -mr-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(project);
                    }}
                    type="button"
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <Dialog
        onOpenChange={(o) => {
          if (!o) {
            setSelectedProject(null);
            setProjectFiles([]);
          }
        }}
        open={!!selectedProject}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedProject?.name}</DialogTitle>
            <DialogDescription>
              {selectedProject?.description || "Project files"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {projectFiles.length} file{projectFiles.length === 1 ? "" : "s"}
            </p>
            <label>
              <input
                accept=".txt,.md,.pdf,.csv,.json,.docx"
                className="hidden"
                onChange={handleFileUpload}
                type="file"
              />
              <Button
                asChild
                className="h-7 text-xs gap-1"
                disabled={uploading}
                size="sm"
                variant="outline"
              >
                <span>
                  {uploading ? (
                    <LoaderIcon className="size-3 animate-spin" />
                  ) : (
                    <UploadIcon className="size-3" />
                  )}
                  Upload
                </span>
              </Button>
            </label>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {loadingFiles ? (
              <div className="flex items-center justify-center py-6">
                <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : projectFiles.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No files uploaded yet.
              </p>
            ) : (
              <div className="space-y-1">
                {projectFiles.map((file) => (
                  <div
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
                    key={file.id}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">
                          {file.fileName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {file.fileSize
                            ? `${(file.fileSize / 1024).toFixed(1)} KB`
                            : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusBadge status={file.liveStatus ?? file.status} />
                      <button
                        aria-label="Delete file"
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDeleteFile(file)}
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
        </DialogContent>
      </Dialog>

      <CreateDialog onOpenChange={setShowCreate} open={showCreate}>
        <CreateDialogContent>
          <CreateDialogHeader>
            <CreateDialogTitle>Create Project</CreateDialogTitle>
            <CreateDialogDescription>
              Create a new project with a vector store for knowledge retrieval.
            </CreateDialogDescription>
          </CreateDialogHeader>
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
            <CreateDialogFooter>
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
            </CreateDialogFooter>
          </form>
        </CreateDialogContent>
      </CreateDialog>

      <AlertDialog
        onOpenChange={(o) => {
          if (!o) {
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
              This cannot be undone.
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
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTransport, setFormTransport] = useState<
    "stdio" | "sse" | "streamable-http"
  >("sse");
  const [formUrl, setFormUrl] = useState("");
  const [formCommand, setFormCommand] = useState("");
  const [formArgs, setFormArgs] = useState("");
  const [formHeaders, setFormHeaders] = useState("");

  const loadServers = useCallback(async () => {
    try {
      const r = await fetch("/api/mcp-servers");
      if (r.ok) {
        const d = (await r.json()) as { servers: McpServer[] };
        setServers(d.servers);
      }
    } catch {
      /* silent */
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
    setFormHeaders("");
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
    setFormHeaders(
      server.headers
        ? Object.entries(server.headers)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n")
        : ""
    );
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
        headers: formHeaders.trim()
          ? formHeaders
              .split(/^\s*$/gm)
              .filter((line) => line.includes(":"))
              .reduce((acc, line) => {
                const [key, ...values] = line.split(":");
                acc[key.trim()] = values.join(":").trim();
                return acc;
              }, {} as Record<string, string>)
          : undefined,
      };
      const url = editingServer
        ? `/api/mcp-servers?id=${editingServer.id}`
        : "/api/mcp-servers";
      const r = await fetch(url, {
        method: editingServer ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        throw new Error("MCP server save failed");
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
      const r = await fetch(`/api/mcp-servers?id=${server.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !server.enabled }),
      });
      if (!r.ok) {
        throw new Error("MCP server toggle failed");
      }
      await loadServers();
    } catch {
      toast.error("Failed to toggle server");
    }
  };

  const handleDelete = async (server: McpServer) => {
    try {
      const r = await fetch(`/api/mcp-servers?id=${server.id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        throw new Error("MCP server deletion failed");
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
      <div className="flex items-center justify-center py-10">
        <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {servers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-card/50 p-8 text-center">
          <Server className="mx-auto mb-2 size-7 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No MCP servers configured
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground/60">
            Add a server to extend the chatbot with external tools.
          </p>
          <Button
            className="mt-4 h-7 text-xs gap-1"
            onClick={openCreate}
            size="sm"
          >
            <PlusIcon className="size-3.5" />
            Add your first server
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {servers.length} server{servers.length === 1 ? "" : "s"}
            </p>
            <Button
              className="h-7 text-xs gap-1"
              onClick={openCreate}
              size="sm"
            >
              <PlusIcon className="size-3.5" />
              Add
            </Button>
          </div>
          <div className="space-y-1.5">
            {servers.map((server) => (
              <div
                className="group rounded-lg border border-border bg-card p-3 transition-colors hover:shadow-sm"
                key={server.id}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="truncate text-sm font-medium">
                        {server.name}
                      </p>
                      <TransportBadge transport={server.transport} />
                      {server.enabled ? (
                        <Badge
                          className="border-green-500/50 text-green-600 text-[10px] h-4"
                          variant="outline"
                        >
                          On
                        </Badge>
                      ) : (
                        <Badge
                          className="text-muted-foreground text-[10px] h-4"
                          variant="outline"
                        >
                          Off
                        </Badge>
                      )}
                    </div>
                    {server.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {server.description}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
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
                            <LinkIcon className="size-3" />
                            {server.url}
                          </span>
                        )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 -mr-1">
                    <button
                      aria-label={server.enabled ? "Disable" : "Enable"}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted"
                      onClick={() => handleToggle(server)}
                      type="button"
                    >
                      {server.enabled ? (
                        <XIcon className="size-3.5" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                    </button>
                    <button
                      aria-label="Edit"
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                      onClick={() => openEdit(server)}
                      type="button"
                    >
                      <LinkIcon className="size-3.5" />
                    </button>
                    <button
                      aria-label="Delete"
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      onClick={() => setDeleteTarget(server)}
                      type="button"
                    >
                      <TrashIcon className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <CreateDialog onOpenChange={setShowCreate} open={showCreate}>
        <CreateDialogContent className="max-h-[85vh] overflow-y-auto">
          <CreateDialogHeader>
            <CreateDialogTitle>
              {editingServer ? "Edit MCP Server" : "Add MCP Server"}
            </CreateDialogTitle>
            <CreateDialogDescription>
              Configure a Model Context Protocol server to extend the chatbot
              with external tools and resources.
            </CreateDialogDescription>
          </CreateDialogHeader>
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
              <Select
                onValueChange={(value: "stdio" | "sse" | "streamable-http") =>
                  setFormTransport(value)
                }
                value={formTransport}
              >
                <SelectTrigger id="mcp-transport">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sse">SSE (Server-Sent Events)</SelectItem>
                  <SelectItem value="streamable-http">
                    Streamable HTTP
                  </SelectItem>
                  <SelectItem value="stdio">Stdio (Local Process)</SelectItem>
                </SelectContent>
              </Select>
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
            {formTransport !== "stdio" && (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="mcp-headers">
                  Headers{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </label>
                <Textarea
                  id="mcp-headers"
                  onChange={(e) => setFormHeaders(e.target.value)}
                  placeholder={"Authorization: Bearer token\nX-Custom: value"}
                  rows={3}
                  value={formHeaders}
                />
                <p className="text-[11px] text-muted-foreground">
                  One header per line, format: Key: Value
                </p>
              </div>
            )}
            <CreateDialogFooter>
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
                  <Check className="size-4" />
                ) : (
                  <PlusIcon className="size-4" />
                )}
                {editingServer ? "Save" : "Add Server"}
              </Button>
            </CreateDialogFooter>
          </form>
        </CreateDialogContent>
      </CreateDialog>

      <AlertDialog
        onOpenChange={(o) => {
          if (!o) {
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
              This will disconnect any active sessions.
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProjectFile["status"] }) {
  const styles: Record<string, string> = {
    uploading: "border-blue-500/50 text-blue-600 bg-blue-500/5",
    processing: "border-amber-500/50 text-amber-600 bg-amber-500/5",
    ready: "border-green-500/50 text-green-600 bg-green-500/5",
    failed: "border-destructive/50 text-destructive bg-destructive/5",
  };
  return (
    <Badge
      className={`text-[10px] h-4 ${styles[status] ?? ""}`}
      variant="outline"
    >
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
    <Badge className="text-[10px] h-4" variant="secondary">
      {labels[transport] ?? transport}
    </Badge>
  );
}

// ─── MCP Apps Tab ──────────────────────────────────────────────────────────

function McpAppsTab() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadServers = async () => {
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
    };

    loadServers();
  }, []);

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
      <div>
        <h2 className="text-xl font-semibold tracking-tight">MCP Apps</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage Model Context Protocol server apps that provide interactive UI components.
        </p>
      </div>

      <Tabs defaultValue="apps" className="w-full">
        <TabsList>
          <TabsTrigger value="apps">Apps List</TabsTrigger>
          <TabsTrigger value="info">About MCP Apps</TabsTrigger>
        </TabsList>

        <TabsContent value="apps" className="mt-6">
          {servers.length === 0 ? (
            <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
              <Server className="mx-auto mb-3 size-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">
                No MCP apps configured
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Configure MCP servers to extend the chatbot with interactive apps.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {servers.map((app) => (
                <div key={app.name} className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium truncate">{app.name}</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] h-4">
                          {app.transport.toUpperCase()}
                        </Badge>
                        <Badge variant={app.enabled ? "default" : "secondary"} className="text-[10px] h-4">
                          {app.enabled ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {app.lastConnectedAt && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Last connected: {new Date(app.lastConnectedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="info" className="mt-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-lg font-medium">About MCP Apps</h3>
            <p className="text-sm text-muted-foreground">
              MCP Apps extend Model Context Protocol tools with interactive UI resources. When a tool has <code>_meta.ui.resourceUri</code>, the model calls it and you can render its <code>ui://</code> HTML in a sandboxed iframe.
            </p>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Key Features:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                <li><strong>Split Tool Visibility:</strong> Tools marked with <code>visibility: [&quot;model&quot;, &quot;app&quot;]</code> can be shown to the model while interactive UIs stay separate</li>
                <li><strong>Sandboxed Rendering:</strong> MCP App resources are rendered in iframes with proper security policies</li>
                <li><strong>Host Bridge:</strong> Your app acts as a bridge between the model and interactive UI components</li>
                <li><strong>Tool Bridging:</strong> Model-initiated tool calls to app-visible tools are proxied back to the original MCP server</li>
              </ul>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
