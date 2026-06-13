"use client";

import {
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PanelLeftIcon,
  PenSquareIcon,
  PlusIcon,
  SettingsIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import type { User } from "@/app/(auth)/auth";
import { CreateProjectDialog } from "@/components/chat/create-project-dialog";
import { SettingsSheet } from "@/components/chat/settings-sheet";
import {
  getChatHistoryPaginationKey,
  SidebarHistory,
} from "@/components/chat/sidebar-history";
import { ChatItem } from "@/components/chat/sidebar-history-item";
import { ProjectFilesDialog } from "@/components/chat/project-files-dialog";
import { SidebarUserNav } from "@/components/chat/sidebar-user-nav";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Chat } from "@/lib/db/schema";

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile, toggleSidebar } = useSidebar();
  const { mutate } = useSWRConfig();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"account" | "projects" | "mcp">("account");
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [filesDialogTarget, setFilesDialogTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [projects, setProjects] = useState<
    Array<{
      id: string;
      name: string;
      description: string | null;
      fileCount: number;
    }>
  >([]);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(
    null
  );
  const [projectChats, setProjectChats] = useState<
    Record<string, Chat[]>
  >({});

  const loadProjects = useCallback(async () => {
    if (!user) {
      return;
    }
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/projects`
      );
      if (response.ok) {
        const data = (await response.json()) as {
          projects: Array<{
            id: string;
            name: string;
            description: string | null;
            fileCount: number;
          }>;
        };
        setProjects(data.projects);
      }
    } catch {
      // silent
    }
  }, [user]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string | undefined>).detail;
      if (detail === "projects") {
        setSettingsTab("projects");
      } else {
        setSettingsTab("account");
      }
      setSettingsOpen(true);
    };
    window.addEventListener("open-settings", handler);
    return () => window.removeEventListener("open-settings", handler);
  }, []);

  const toggleProject = async (projectId: string) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
      return;
    }
    setExpandedProjectId(projectId);

    // Always refetch to pick up newly created chats
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/projects/${projectId}/chats?limit=50`
      );
      if (res.ok) {
        const data = (await res.json()) as { chats: Chat[] };
        setProjectChats((prev) => ({
          ...prev,
          [projectId]: data.chats,
        }));
      }
    } catch {
      // silent
    }
  };

  const startProjectChat = (projectId: string) => {
    setOpenMobile(false);
    router.push(`/?projectId=${projectId}`);
  };

  const handleRenameProject = async () => {
    if (!renameTarget || !renameName.trim()) return;
    try {
      const r = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/projects`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: renameTarget.id, name: renameName.trim() }),
        }
      );
      if (!r.ok) throw new Error("Rename failed");
      toast.success("Project renamed");
      setRenameTarget(null);
      loadProjects();
    } catch {
      toast.error("Failed to rename project");
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteTarget) return;
    try {
      const r = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/projects?projectId=${deleteTarget.id}`,
        { method: "DELETE" }
      );
      if (!r.ok) throw new Error("Delete failed");
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      setExpandedProjectId(null);
      loadProjects();
    } catch {
      toast.error("Failed to delete project");
    }
  };

  const handleDeleteAll = () => {
    setShowDeleteAllDialog(false);
    router.replace("/");
    mutate(unstable_serialize(getChatHistoryPaginationKey), [], {
      revalidate: false,
    });

    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history`, {
      method: "DELETE",
    });

    toast.success("All chats deleted");
  };

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="pb-0 pt-3">
          <SidebarMenu>
            <SidebarMenuItem className="flex flex-row items-center justify-between">
              <div className="group/logo relative flex items-center justify-center">
                <SidebarMenuButton
                  asChild
                  className="size-8 px-0! items-center justify-center group-data-[collapsible=icon]:group-hover/logo:opacity-0"
                  tooltip="Chatbot"
                >
                  <Link href="/" onClick={() => setOpenMobile(false)}>
                    <MessageSquareIcon className="size-4 text-sidebar-foreground/50" />
                  </Link>
                </SidebarMenuButton>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      className="pointer-events-none absolute inset-0 size-8 opacity-0 group-data-[collapsible=icon]:pointer-events-auto group-data-[collapsible=icon]:group-hover/logo:opacity-100"
                      onClick={() => toggleSidebar()}
                    >
                      <PanelLeftIcon className="size-4" />
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent className="hidden md:block" side="right">
                    Open sidebar
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <SidebarTrigger className="text-sidebar-foreground/60 transition-colors duration-150 hover:text-sidebar-foreground" />
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="pt-1">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="h-8 rounded-lg border border-sidebar-border text-[13px] text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    onClick={() => {
                      setOpenMobile(false);
                      router.push("/");
                    }}
                    tooltip="New Chat"
                  >
                    <PenSquareIcon className="size-4" />
                    <span className="font-medium">New chat</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {user && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="rounded-lg text-sidebar-foreground/40 transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setShowDeleteAllDialog(true)}
                      tooltip="Delete All Chats"
                    >
                      <TrashIcon className="size-4" />
                      <span className="text-[13px]">Delete all</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {user && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="rounded-lg text-sidebar-foreground/40 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      onClick={() => setSettingsOpen(true)}
                      tooltip="Settings"
                    >
                      <SettingsIcon className="size-4" />
                      <span className="text-[13px]">Settings</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {user && (
            <SidebarGroup>
              <SidebarGroupContent>
                <Collapsible onOpenChange={setProjectsOpen} open={projectsOpen}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className="text-[13px] text-sidebar-foreground/60"
                      tooltip="Projects"
                    >
                      <FolderIcon className="size-4" />
                      <span>Projects</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMobile(false);
                          setCreateProjectOpen(true);
                        }}
                        className="ml-auto mr-1 flex size-5 items-center justify-center rounded text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      >
                        <PlusIcon className="size-3.5" />
                      </button>
                      <ChevronRightIcon
                        className={`size-3 transition-transform duration-200 ${projectsOpen ? "rotate-90" : ""}`}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-1 space-y-0.5 group-data-[collapsible=icon]:hidden">

                      <div className="mt-0.5 space-y-0.5">
                        {projects.map((project) => {
                          const isExpanded = expandedProjectId === project.id;
                          return (
                            <div key={project.id}>
                              <div
                                className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition-colors duration-150 hover:bg-sidebar-accent/50 ${
                                  isExpanded
                                    ? "text-sidebar-foreground"
                                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                                }`}
                              >
                                <button
                                  onClick={() => toggleProject(project.id)}
                                  className="flex flex-1 items-center gap-2 overflow-hidden"
                                >
                                  {isExpanded ? (
                                    <FolderOpenIcon className="size-3.5 shrink-0 text-sidebar-foreground/50" />
                                  ) : (
                                    <FolderIcon className="size-3.5 shrink-0 text-sidebar-foreground/40" />
                                  )}
                                  <span className="truncate">
                                    {project.name}
                                  </span>
                                </button>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="flex size-6 shrink-0 items-center justify-center rounded text-sidebar-foreground/20 opacity-0 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground/60 group-hover:opacity-100 data-[state=open]:opacity-100">
                                      <MoreHorizontalIcon className="size-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="min-w-[150px]">
                                    <DropdownMenuItem
                                      className="cursor-pointer gap-2 text-[12px]"
                                      onClick={() => startProjectChat(project.id)}
                                    >
                                      <PenSquareIcon className="size-3.5" />
                                      New chat
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="cursor-pointer gap-2 text-[12px]"
                                      onClick={() =>
                                        setFilesDialogTarget({
                                          id: project.id,
                                          name: project.name,
                                        })
                                      }
                                    >
                                      <FileTextIcon className="size-3.5" />
                                      View files
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="cursor-pointer gap-2 text-[12px]"
                                      onClick={() => {
                                        setRenameName(project.name);
                                        setRenameTarget({ id: project.id, name: project.name });
                                      }}
                                    >
                                      <span className="size-3.5 flex items-center justify-center text-[11px]">✎</span>
                                      Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="cursor-pointer gap-2 text-[12px] text-destructive"
                                      onClick={() =>
                                        setDeleteTarget({ id: project.id, name: project.name })
                                      }
                                    >
                                      <TrashIcon className="size-3.5" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              {isExpanded && (
                                <div className="ml-3 mt-0.5 border-l border-sidebar-border/20 pl-2">
                                  {!projectChats[project.id] ? (
                                    <div className="px-2 py-2 text-[11px] text-sidebar-foreground/20">
                                      Loading...
                                    </div>
                                  ) : projectChats[project.id].length ===
                                    0 ? (
                                    <div className="px-2 py-2 text-[11px] text-sidebar-foreground/30">
                                      No chats yet
                                    </div>
                                  ) : (
                                    projectChats[project.id].map(
                                      (chat, idx) => (
                                        <ChatItem
                                          key={chat.id}
                                          chat={chat}
                                          isActive={false}
                                          onDelete={() => {}}
                                          setOpenMobile={setOpenMobile}
                                          index={idx}
                                          showIndex
                                          compact
                                        />
                                      )
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {projects.length === 0 && (
                          <div className="px-2 py-3 text-center text-[11px] text-sidebar-foreground/30">
                            No projects yet
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
          <SidebarHistory user={user} />
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border pt-2 pb-3">
          {user && <SidebarUserNav user={user} />}
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SettingsSheet onOpenChange={setSettingsOpen} open={settingsOpen} tab={settingsTab} />

      {filesDialogTarget && (
        <ProjectFilesDialog
          projectId={filesDialogTarget.id}
          projectName={filesDialogTarget.name}
          open={!!filesDialogTarget}
          onOpenChange={(o) => {
            if (!o) setFilesDialogTarget(null);
          }}
        />
      )}

      {/* Rename Project Dialog */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(o) => {
          if (!o) setRenameTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRenameProject();
            }}
          >
            <Input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              placeholder="Project name"
              autoFocus
              className="mb-4"
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRenameTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!renameName.trim()}>
                Rename
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name}" and all its
              files. Chats in this project will be kept but unlinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteProject}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        onCreated={(project) => {
          loadProjects();
          setTimeout(() => {
            router.push(`/?projectId=${project.id}`);
          }, 200);
        }}
      />

      <AlertDialog
        onOpenChange={setShowDeleteAllDialog}
        open={showDeleteAllDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all chats?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all
              your chats and remove them from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll}>
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
