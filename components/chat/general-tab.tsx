"use client";

import { LoaderIcon, Moon, RotateCcw, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// ─── Types ──────────────────────────────────────────────────────────────────

type Settings = {
  theme: "modern" | "company";
  font: "sora" | "onest" | "reddit-mono";
  fontSize: "s" | "m" | "l" | "xl";
  spacing: "compact" | "cozy" | "roomy";
  showAvatars: boolean;
};

const DEFAULTS: Settings = {
  theme: "modern",
  font: "sora",
  fontSize: "m",
  spacing: "compact",
  showAvatars: false,
};

// ─── localStorage helpers ────────────────────────────────────────────────────

const KEYS = {
  theme: "personalize-theme",
  font: "personalize-font",
  fontSize: "personalize-font-size",
  spacing: "personalize-spacing",
  showAvatars: "personalize-avatars",
} as const;

function readLocal(): Settings {
  if (typeof window === "undefined") {
    return DEFAULTS;
  }
  return {
    theme:
      (localStorage.getItem(KEYS.theme) as Settings["theme"]) || DEFAULTS.theme,
    font:
      (localStorage.getItem(KEYS.font) as Settings["font"]) || DEFAULTS.font,
    fontSize:
      (localStorage.getItem(KEYS.fontSize) as Settings["fontSize"]) ||
      DEFAULTS.fontSize,
    spacing:
      (localStorage.getItem(KEYS.spacing) as Settings["spacing"]) ||
      DEFAULTS.spacing,
    showAvatars: localStorage.getItem(KEYS.showAvatars) === "1",
  };
}

function writeLocal(s: Settings) {
  localStorage.setItem(KEYS.theme, s.theme);
  localStorage.setItem(KEYS.font, s.font);
  localStorage.setItem(KEYS.fontSize, s.fontSize);
  localStorage.setItem(KEYS.spacing, s.spacing);
  localStorage.setItem(KEYS.showAvatars, s.showAvatars ? "1" : "0");
}

function clearLocal() {
  for (const k of Object.values(KEYS)) {
    localStorage.removeItem(k);
  }
}

// ─── Apply settings to DOM ──────────────────────────────────────────────────

function applyToDOM(s: Settings) {
  const root = document.documentElement;
  const wrapper = document.getElementById("personalize-root");

  root.classList.remove("theme-modern", "theme-company");
  root.classList.add(`theme-${s.theme}`);

  root.classList.remove("font-sora", "font-onest", "font-reddit-mono");
  root.classList.add(`font-${s.font}`);

  if (wrapper) {
    wrapper.classList.remove(
      "text-size-s",
      "text-size-m",
      "text-size-l",
      "text-size-xl"
    );
    wrapper.classList.add(`text-size-${s.fontSize}`);

    wrapper.classList.remove(
      "spacing-compact",
      "spacing-cozy",
      "spacing-roomy"
    );
    wrapper.classList.add(`spacing-${s.spacing}`);

    wrapper.classList.toggle("hide-avatars", !s.showAvatars);
  }
}

function clearDOM() {
  const root = document.documentElement;
  const wrapper = document.getElementById("personalize-root");

  root.classList.remove(
    "theme-modern",
    "theme-company",
    "font-sora",
    "font-onest",
    "font-reddit-mono"
  );
  root.classList.add("theme-modern", "font-sora");

  if (wrapper) {
    wrapper.classList.remove(
      "text-size-s",
      "text-size-m",
      "text-size-l",
      "text-size-xl",
      "spacing-compact",
      "spacing-cozy",
      "spacing-roomy",
      "hide-avatars"
    );
    wrapper.classList.add("text-size-m", "spacing-compact");
  }
}

// ─── API helpers ────────────────────────────────────────────────────────────

async function fetchSettings(): Promise<Settings> {
  const r = await fetch("/api/user/personalization");
  if (!r.ok) {
    return DEFAULTS;
  }
  const data = (await r.json()) as { settings: Settings };
  return { ...DEFAULTS, ...data.settings };
}

async function saveSettings(s: Settings): Promise<void> {
  await fetch("/api/user/personalization", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(s),
  });
}

async function resetSettings(): Promise<Settings> {
  const r = await fetch("/api/user/personalization", { method: "DELETE" });
  if (!r.ok) {
    return DEFAULTS;
  }
  const data = (await r.json()) as { settings: Settings };
  return { ...DEFAULTS, ...data.settings };
}

// ─── Shared option button ────────────────────────────────────────────────────

function Opt({
  active,
  onClick,
  children,
  className = "",
  ariaLabel,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className={`flex items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
        active
          ? "border-primary/50 bg-primary/10 text-foreground shadow-sm"
          : "border-border/50 bg-card text-muted-foreground hover:border-border hover:text-foreground"
      } ${className}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

// ─── GeneralTab ─────────────────────────────────────────────────────────────

export function GeneralTab() {
  const { theme: mode, setTheme: setMode } = useTheme();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [resetting, setResetting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const dbSettings = await fetchSettings();
      if (cancelled) {
        return;
      }

      const local = readLocal();
      const hasLocalOverride = Object.keys(DEFAULTS).some(
        (k) => local[k as keyof Settings] !== DEFAULTS[k as keyof Settings]
      );
      const merged =
        hasLocalOverride && dbSettings.theme === DEFAULTS.theme
          ? { ...dbSettings, ...local }
          : dbSettings;

      setSettings(merged);
      applyToDOM(merged);
      writeLocal(merged);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scheduleSave = useCallback((next: Settings) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(() => {
      saveSettings(next).catch(() => {
        // save failed silently
      });
    }, 500);
  }, []);

  const update = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        applyToDOM(next);
        writeLocal(next);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  const handleReset = useCallback(async () => {
    setResetting(true);
    try {
      const defaults = await resetSettings();
      clearLocal();
      clearDOM();
      setSettings(defaults);
      writeLocal(defaults);
      toast.success("Settings reset to defaults");
    } catch {
      toast.error("Failed to reset settings");
    } finally {
      setResetting(false);
    }
  }, []);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Theme ── */}
      <section className="rounded-lg border border-border/50 bg-card p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Theme
          </span>
          <button
            className="flex items-center gap-2 rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm cursor-pointer"
            type="button"
          >
            <div className="flex gap-1">
              <div className="size-3 rounded-full bg-[#1a1a1a] ring-1 ring-black/10" />
              <div className="size-3 rounded-full bg-[#e5e5e5] ring-1 ring-black/10" />
            </div>
            Modern
          </button>
        </div>
      </section>

      {/* ── Typography ── */}
      <section className="rounded-lg border border-border/50 bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground shrink-0">
            Font
          </span>
          <div className="flex items-center gap-1 flex-wrap justify-end">
            <FontOption
              active={settings.font === "sora"}
              fontClass="font-sora"
              label="Sora"
              onClick={() => update("font", "sora")}
            />
            <FontOption
              active={settings.font === "onest"}
              fontClass="font-onest"
              label="Onest"
              onClick={() => update("font", "onest")}
            />
            <FontOption
              active={settings.font === "reddit-mono"}
              fontClass="font-reddit-mono"
              label="Mono"
              onClick={() => update("font", "reddit-mono")}
            />
          </div>
        </div>
      </section>

      {/* ── Display ── */}
      <section className="rounded-lg border border-border/50 bg-card p-3 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Display
        </h3>

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Mode
          </span>
          <div className="flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5 w-fit">
            <button
              className={`flex items-center justify-center rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                mode === "light"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMode("light")}
              type="button"
            >
              <Sun className="size-3" />
            </button>
            <button
              className={`flex items-center justify-center rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                mode === "dark"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMode("dark")}
              type="button"
            >
              <Moon className="size-3" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Font size
          </span>
          <div className="flex items-center gap-1">
            {(["s", "m", "l", "xl"] as const).map((s) => (
              <Opt
                active={settings.fontSize === s}
                key={s}
                onClick={() => update("fontSize", s)}
              >
                {s.toUpperCase()}
              </Opt>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Spacing
          </span>
          <div className="flex items-center gap-1">
            {(["compact", "cozy", "roomy"] as const).map((s) => (
              <Opt
                active={settings.spacing === s}
                key={s}
                onClick={() => update("spacing", s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Opt>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Avatars
          </span>
          <button
            aria-label="Toggle avatars"
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
              settings.showAvatars ? "bg-primary" : "bg-muted"
            }`}
            onClick={() => update("showAvatars", !settings.showAvatars)}
            type="button"
          >
            <span
              className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform ${
                settings.showAvatars ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </section>

      <Button
        className="w-full justify-center gap-2 text-muted-foreground hover:text-foreground"
        disabled={resetting}
        onClick={handleReset}
        size="sm"
        variant="outline"
      >
        {resetting ? (
          <LoaderIcon className="size-3.5 animate-spin" />
        ) : (
          <RotateCcw className="size-3.5" />
        )}
        Reset all to defaults
      </Button>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FontOption({
  active,
  fontClass,
  label,
  onClick,
}: {
  active: boolean;
  fontClass: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
        active
          ? "border-primary/50 bg-primary/10 text-foreground shadow-sm"
          : "border-border/50 bg-card text-muted-foreground hover:border-border hover:text-foreground"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className={`text-sm font-semibold ${fontClass}`}>Ag</span>
      {label}
    </button>
  );
}
