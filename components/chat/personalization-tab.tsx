"use client";

import { LoaderIcon, SaveIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ─── Types ──────────────────────────────────────────────────────────────────

type AiSettings = {
  baseStyle:
    | "default"
    | "professional"
    | "friendly"
    | "candid"
    | "quirky"
    | "efficient"
    | "cynical";
  warm: "default" | "more" | "less";
  enthusiastic: "default" | "more" | "less";
  headersAndLists: "default" | "more" | "less";
  emoji: "default" | "more" | "less";
  customInstructions: string;
  nickname: string;
  occupation: string;
  moreAboutYou: string;
};

const DEFAULTS: AiSettings = {
  baseStyle: "default",
  warm: "default",
  enthusiastic: "default",
  headersAndLists: "default",
  emoji: "default",
  customInstructions: "",
  nickname: "",
  occupation: "",
  moreAboutYou: "",
};

const BASE_STYLES = [
  { value: "default", label: "Default", description: "Balanced and natural" },
  {
    value: "professional",
    label: "Professional",
    description: "Polished and precise",
  },
  { value: "friendly", label: "Friendly", description: "Warm and chatty" },
  { value: "candid", label: "Candid", description: "Direct and encouraging" },
  { value: "quirky", label: "Quirky", description: "Playful and imaginative" },
  { value: "efficient", label: "Efficient", description: "Concise and plain" },
  { value: "cynical", label: "Cynical", description: "Critical and sarcastic" },
] as const;

const CHARACTERISTICS = [
  {
    key: "warm" as const,
    label: "Warm",
    description: "Friendliness and empathy in responses",
  },
  {
    key: "enthusiastic" as const,
    label: "Enthusiastic",
    description: "Energy and excitement",
  },
  {
    key: "headersAndLists" as const,
    label: "Headers & Lists",
    description: "Structured formatting",
  },
  {
    key: "emoji" as const,
    label: "Emoji",
    description: "Emoji usage in responses",
  },
] as const;

const LEVEL_OPTIONS = [
  {
    value: "more",
    label: "More",
    description: "Friendlier and more personable",
  },
  { value: "default", label: "Default", description: "" },
  {
    value: "less",
    label: "Less",
    description: "More professional and factual",
  },
] as const;

// ─── API helpers ────────────────────────────────────────────────────────────

async function fetchAiSettings(): Promise<AiSettings> {
  const r = await fetch("/api/user/personalization");
  if (!r.ok) {
    return DEFAULTS;
  }
  const data = (await r.json()) as { settings: Record<string, string> };
  return {
    baseStyle:
      (data.settings.baseStyle as AiSettings["baseStyle"]) ||
      DEFAULTS.baseStyle,
    warm: (data.settings.warm as AiSettings["warm"]) || DEFAULTS.warm,
    enthusiastic:
      (data.settings.enthusiastic as AiSettings["enthusiastic"]) ||
      DEFAULTS.enthusiastic,
    headersAndLists:
      (data.settings.headersAndLists as AiSettings["headersAndLists"]) ||
      DEFAULTS.headersAndLists,
    emoji: (data.settings.emoji as AiSettings["emoji"]) || DEFAULTS.emoji,
    customInstructions: data.settings.customInstructions || "",
    nickname: data.settings.nickname || "",
    occupation: data.settings.occupation || "",
    moreAboutYou: data.settings.moreAboutYou || "",
  };
}

async function saveAiSettings(s: AiSettings): Promise<void> {
  await fetch("/api/user/personalization", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(s),
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PersonalizationTab() {
  const [settings, setSettings] = useState<AiSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAiSettings().then((s) => {
      if (cancelled) {
        return;
      }
      setSettings(s);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const scheduleSave = useCallback((next: AiSettings) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(() => {
      saveAiSettings(next).catch(() => {
        // Silently save — errors are non-critical UI preference updates
      });
    }, 800);
  }, []);

  const update = useCallback(
    <K extends keyof AiSettings>(key: K, value: AiSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        setDirty(true);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  const handleSaveNow = useCallback(async () => {
    setSaving(true);
    try {
      await saveAiSettings(settings);
      setDirty(false);
      toast.success("Personalization saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [settings]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Base Style & Tone ── */}
      <section className="rounded-lg border border-border/50 bg-card p-3 space-y-3">
        <div>
          <h3 className="text-xs font-medium text-foreground">
            Base style and tone
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Set the style and tone of how Watt AI responds to you.
          </p>
        </div>
        <div className="relative">
          <select
            className="w-full h-9 rounded-lg border border-border/50 bg-input/30 px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 cursor-pointer appearance-none"
            onChange={(e) =>
              update("baseStyle", e.target.value as AiSettings["baseStyle"])
            }
            value={settings.baseStyle}
          >
            {BASE_STYLES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} — {s.description}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <svg
              className="size-3 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M19 9l-7 7-7-7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* ── Characteristics ── */}
      <section className="rounded-lg border border-border/50 bg-card p-3 space-y-3">
        <div>
          <h3 className="text-xs font-medium text-foreground">
            Characteristics
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Fine-tune additional customizations on top of your base style.
          </p>
        </div>

        {CHARACTERISTICS.map((c) => (
          <div className="flex items-center justify-between" key={c.key}>
            <span className="text-xs font-medium text-muted-foreground">
              {c.label}
            </span>
            <select
              className="h-8 w-[140px] rounded-lg border border-border/50 bg-input/30 px-2 py-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 cursor-pointer appearance-none"
              onChange={(e) =>
                update(c.key, e.target.value as AiSettings[typeof c.key])
              }
              value={settings[c.key]}
            >
              {LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value === "default" ? "Default" : o.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </section>

      {/* ── Custom Instructions ── */}
      <section className="rounded-lg border border-border/50 bg-card p-3 space-y-2">
        <div>
          <h3 className="text-xs font-medium text-foreground">
            Custom instructions
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Tell Watt AI how you want it to behave in every conversation.
          </p>
        </div>
        <Textarea
          className="min-h-[100px] text-xs resize-y"
          onChange={(e) => update("customInstructions", e.target.value)}
          placeholder="e.g. You are an expert in coding and system design..."
          value={settings.customInstructions}
        />
      </section>

      {/* ── About You ── */}
      <section className="rounded-lg border border-border/50 bg-card p-3 space-y-3">
        <div>
          <h3 className="text-xs font-medium text-foreground">About you</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            This information helps Watt AI tailor responses to you.
          </p>
        </div>
        <div className="space-y-2">
          <label
            className="text-[11px] font-medium text-muted-foreground"
            htmlFor="pn-nickname"
          >
            Nickname
          </label>
          <input
            className="h-9 w-full rounded-lg border border-border/50 bg-input/30 px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            id="pn-nickname"
            onChange={(e) => update("nickname", e.target.value)}
            placeholder="What should Watt AI call you?"
            value={settings.nickname}
          />
        </div>
        <div className="space-y-2">
          <label
            className="text-[11px] font-medium text-muted-foreground"
            htmlFor="pn-occupation"
          >
            Occupation
          </label>
          <input
            className="h-9 w-full rounded-lg border border-border/50 bg-input/30 px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            id="pn-occupation"
            onChange={(e) => update("occupation", e.target.value)}
            placeholder="e.g. Software Engineer, Student, Designer..."
            value={settings.occupation}
          />
        </div>
      </section>

      {/* ── More About You ── */}
      <section className="rounded-lg border border-border/50 bg-card p-3 space-y-2">
        <div>
          <h3 className="text-xs font-medium text-foreground">
            More about you
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Anything else Watt AI should know to give you better responses.
          </p>
        </div>
        <Textarea
          className="min-h-[80px] text-xs resize-y"
          onChange={(e) => update("moreAboutYou", e.target.value)}
          placeholder="e.g. Projects you've completed, topics you're interested in..."
          value={settings.moreAboutYou}
        />
      </section>

      {/* ── Save button (only when dirty) ── */}
      {dirty && (
        <Button
          className="w-full justify-center gap-2"
          disabled={saving}
          onClick={handleSaveNow}
          size="sm"
        >
          {saving ? (
            <LoaderIcon className="size-3.5 animate-spin" />
          ) : (
            <SaveIcon className="size-3.5" />
          )}
          Save personalization
        </Button>
      )}
    </div>
  );
}
