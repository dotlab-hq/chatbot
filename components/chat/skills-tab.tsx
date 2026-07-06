"use client";

import {
  BrainIcon,
  CheckIcon,
  CompassIcon,
  LoaderIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";

// ─── Types ──────────────────────────────────────────────────────────────────

type Skill = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  content: string;
  isSystem: boolean;
  ownerId: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

// ─── Skills Tab Component ───────────────────────────────────────────────────

export function SkillsTab() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"personal" | "system">("personal");

  // Dialog states
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);
  const [showDiscover, setShowDiscover] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formIsSystem, setFormIsSystem] = useState(false);

  const loadSkills = useCallback(async () => {
    try {
      const response = await fetch("/api/skills");
      if (response.ok) {
        const data = (await response.json()) as {
          skills: Skill[];
          isAdmin: boolean;
        };
        setSkills(data.skills);
        setIsAdmin(data.isAdmin);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const personalSkills = skills.filter((s) => !s.isSystem);
  const systemSkills = skills.filter((s) => s.isSystem);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormContent("");
    setFormIsSystem(false);
  };

  const openCreate = (asSystem = false) => {
    resetForm();
    if (asSystem) {
      setFormIsSystem(true);
    }
    setEditingSkill(null);
    setShowCreate(true);
  };

  const openEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setFormName(skill.name);
    setFormDescription(skill.description ?? "");
    setFormContent(skill.content);
    setFormIsSystem(skill.isSystem);
    setShowCreate(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formContent.trim()) {
      return;
    }
    setCreating(true);

    try {
      if (editingSkill) {
        // Update existing skill
        const response = await fetch(`/api/skills/${editingSkill.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            description: formDescription.trim() || undefined,
            content: formContent.trim(),
            isSystem: formIsSystem,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to update skill");
        }
        toast.success("Skill updated");
      } else {
        // Create new skill
        const response = await fetch("/api/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            description: formDescription.trim() || undefined,
            content: formContent.trim(),
            isSystem: formIsSystem,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create skill");
        }
        toast.success("Skill created");
      }

      setShowCreate(false);
      resetForm();
      setEditingSkill(null);
      await loadSkills();
    } catch {
      toast.error(
        editingSkill ? "Failed to update skill" : "Failed to create skill"
      );
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (skill: Skill) => {
    try {
      const response = await fetch(`/api/skills/${skill.id}/toggle`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to toggle skill");
      }
      await loadSkills();
    } catch {
      toast.error("Failed to toggle skill");
    }
  };

  const handleDelete = async (skill: Skill) => {
    try {
      const response = await fetch(`/api/skills/${skill.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete skill");
      }
      toast.success(`"${skill.name}" removed`);
      setDeleteTarget(null);
      await loadSkills();
    } catch {
      toast.error("Failed to delete skill");
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
          <h2 className="text-sm font-medium text-muted-foreground">Skills</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage skills that extend the AI's capabilities. Only enabled skills
            are sent to the LLM.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setShowDiscover(true);
            }}
            size="sm"
            variant="outline"
          >
            <CompassIcon className="size-4" />
            Discover
          </Button>
          <Button
            onClick={() => {
              openCreate(activeTab === "system");
            }}
            size="sm"
          >
            <PlusIcon className="size-4" />
            Add Skill
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border/50 bg-muted/30 p-1">
        <button
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "personal"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => {
            setActiveTab("personal");
          }}
          type="button"
        >
          Personal
          {personalSkills.length > 0 && (
            <span className="ml-1.5 text-muted-foreground">
              ({personalSkills.length})
            </span>
          )}
        </button>
        <button
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "system"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => {
            setActiveTab("system");
          }}
          type="button"
        >
          System
          {systemSkills.length > 0 && (
            <span className="ml-1.5 text-muted-foreground">
              ({systemSkills.length})
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "personal" && (
        <section>
          {personalSkills.length === 0 ? (
            <div className="rounded-xl border border-border/50 bg-card p-6 text-center">
              <SparklesIcon className="mx-auto mb-2 size-6 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No personal skills yet. Create one to extend the AI with your
                own instructions.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {personalSkills.map((skill) => (
                <SkillRow
                  canDelete={skill.ownerId !== undefined}
                  key={skill.id}
                  onDelete={() => {
                    setDeleteTarget(skill);
                  }}
                  onEdit={() => {
                    openEdit(skill);
                  }}
                  onToggle={() => {
                    handleToggle(skill);
                  }}
                  skill={skill}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "system" && (
        <section>
          {systemSkills.length === 0 ? (
            <div className="rounded-xl border border-border/50 bg-card p-6 text-center">
              <BrainIcon className="mx-auto mb-2 size-6 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No system skills available. Check back later for new
                capabilities.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {systemSkills.map((skill) => (
                <SkillRow
                  canDelete={isAdmin}
                  key={skill.id}
                  onDelete={() => {
                    setDeleteTarget(skill);
                  }}
                  onEdit={
                    isAdmin
                      ? () => {
                          openEdit(skill);
                        }
                      : undefined
                  }
                  onToggle={() => {
                    handleToggle(skill);
                  }}
                  skill={skill}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Create/Edit Dialog */}
      <Dialog onOpenChange={setShowCreate} open={showCreate}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSkill
                ? "Edit Skill"
                : formIsSystem
                  ? "Create System Skill"
                  : "Create Skill"}
            </DialogTitle>
            <DialogDescription>
              {editingSkill
                ? "Update the skill's instructions and details."
                : formIsSystem
                  ? "Create a system skill available to all users."
                  : "Create a new skill with custom instructions for the AI."}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="skill-name">
                Name
              </label>
              <Input
                id="skill-name"
                onChange={(e) => {
                  setFormName(e.target.value);
                }}
                placeholder="e.g., Code Review Expert"
                required
                value={formName}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="skill-desc">
                Description{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="skill-desc"
                onChange={(e) => {
                  setFormDescription(e.target.value);
                }}
                placeholder="What does this skill help with?"
                value={formDescription}
              />
            </div>
            {isAdmin && (
              <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
                <button
                  aria-label={
                    formIsSystem
                      ? "Switch to personal skill"
                      : "Switch to system skill"
                  }
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors ${
                    formIsSystem ? "bg-primary" : "bg-muted"
                  }`}
                  data-state={formIsSystem ? "checked" : "unchecked"}
                  onClick={() => {
                    setFormIsSystem(!formIsSystem);
                  }}
                  type="button"
                >
                  <span
                    className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${
                      formIsSystem ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                <div className="flex-1">
                  <p className="text-sm font-medium">System Skill</p>
                  <p className="text-xs text-muted-foreground">
                    System skills are available to all users by default
                  </p>
                </div>
                {formIsSystem && (
                  <Badge className="shrink-0" variant="secondary">
                    System
                  </Badge>
                )}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="skill-content">
                Instructions
              </label>
              <Textarea
                className="min-h-[200px] font-mono text-sm"
                id="skill-content"
                onChange={(e) => {
                  setFormContent(e.target.value);
                }}
                placeholder="Enter the system prompt / instructions for this skill..."
                required
                value={formContent}
              />
              <p className="text-xs text-muted-foreground">
                These instructions will be included in the AI's system prompt
                when this skill is enabled.
              </p>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  setShowCreate(false);
                  setEditingSkill(null);
                }}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                disabled={creating || !formName.trim() || !formContent.trim()}
                type="submit"
              >
                {creating ? (
                  <LoaderIcon className="size-4 animate-spin" />
                ) : editingSkill ? (
                  <CheckIcon className="size-4" />
                ) : (
                  <PlusIcon className="size-4" />
                )}
                {editingSkill ? "Save Changes" : "Create Skill"}
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
            <AlertDialogTitle>Delete Skill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This action cannot be undone.
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

      {/* Discover Skills Modal */}
      <Dialog onOpenChange={setShowDiscover} open={showDiscover}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Discover Skills</DialogTitle>
            <DialogDescription>
              Browse available system skills and enable the ones you need.
            </DialogDescription>
          </DialogHeader>
          {systemSkills.length === 0 ? (
            <div className="py-8 text-center">
              <BrainIcon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No system skills available yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {systemSkills.map((skill) => (
                <div
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4 transition-colors hover:border-border"
                  key={skill.id}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                    <BrainIcon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{skill.name}</p>
                    {skill.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {skill.description}
                      </p>
                    )}
                    <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground/70">
                      {skill.slug}
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      handleToggle(skill);
                    }}
                    size="sm"
                    variant={skill.isEnabled ? "outline" : "default"}
                  >
                    {skill.isEnabled ? (
                      <>
                        <XIcon className="size-3" />
                        Disable
                      </>
                    ) : (
                      <>
                        <CheckIcon className="size-3" />
                        Enable
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Skill Row ──────────────────────────────────────────────────────────────

function SkillRow({
  skill,
  canDelete,
  onToggle,
  onEdit,
  onDelete,
}: {
  skill: Skill;
  canDelete: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4 transition-colors hover:border-border">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        {skill.isSystem ? (
          <BrainIcon className="size-4 text-muted-foreground" />
        ) : (
          <SparklesIcon className="size-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{skill.name}</p>
          {skill.isSystem && (
            <Badge className="text-[10px]" variant="secondary">
              System
            </Badge>
          )}
        </div>
        {skill.description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {skill.description}
          </p>
        )}
        <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground/70">
          {skill.slug}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button
          aria-label={skill.isEnabled ? "Disable skill" : "Enable skill"}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          onClick={onToggle}
          type="button"
        >
          {skill.isEnabled ? (
            <XIcon className="size-4" />
          ) : (
            <CheckIcon className="size-4" />
          )}
        </button>
        {onEdit && (
          <button
            aria-label="Edit skill"
            className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
            onClick={onEdit}
            type="button"
          >
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        {canDelete && (
          <button
            aria-label="Delete skill"
            className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            onClick={onDelete}
            type="button"
          >
            <TrashIcon className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
