"use client";

import { useEffect } from "react";

const KEYS = {
  theme: "personalize-theme",
  font: "personalize-font",
  fontSize: "personalize-font-size",
  spacing: "personalize-spacing",
  showAvatars: "personalize-avatars",
} as const;

function apply() {
  const root = document.documentElement;
  const w = document.getElementById("personalize-root");
  if (!w) {
    return;
  }

  const t = localStorage.getItem(KEYS.theme) || "modern";
  const f = localStorage.getItem(KEYS.font) || "sora";
  const fs = localStorage.getItem(KEYS.fontSize) || "m";
  const sp = localStorage.getItem(KEYS.spacing) || "compact";
  const av = localStorage.getItem(KEYS.showAvatars) === "1";

  root.classList.remove(
    "theme-modern",
    "theme-company",
    "font-sora",
    "font-onest",
    "font-reddit-mono"
  );
  root.classList.add(`theme-${t}`, `font-${f}`);

  w.classList.remove(
    "text-size-s",
    "text-size-m",
    "text-size-l",
    "text-size-xl"
  );
  w.classList.add(`text-size-${fs}`);

  w.classList.remove("spacing-compact", "spacing-cozy", "spacing-roomy");
  w.classList.add(`spacing-${sp}`);

  w.classList.toggle("hide-avatars", !av);
}

export function PersonalizationApplier() {
  useEffect(() => {
    fetch("/api/user/personalization")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { settings?: Record<string, string | boolean> } | null) => {
        if (!data?.settings) {
          return;
        }
        const s = data.settings;
        if (s.theme) {
          localStorage.setItem(KEYS.theme, String(s.theme));
        }
        if (s.font) {
          localStorage.setItem(KEYS.font, String(s.font));
        }
        if (s.fontSize) {
          localStorage.setItem(KEYS.fontSize, String(s.fontSize));
        }
        if (s.spacing) {
          localStorage.setItem(KEYS.spacing, String(s.spacing));
        }
        if (s.showAvatars !== undefined) {
          localStorage.setItem(KEYS.showAvatars, s.showAvatars ? "1" : "0");
        }
        apply();
      })
      .catch(() => {
        // Silently ignore — non-critical background operation
      });
  }, []);

  return null;
}
