"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function formatRemaining(ms: number) {
  if (ms <= 0) {
    return { hours: "00", minutes: "00", seconds: "00", total: 0 };
  }
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
    total: ms,
  };
}

export function Timer({
  data,
}: {
  data: {
    durationMs: number;
    duration: number;
    unit: string;
    label?: string;
    startedAt: string;
  };
}) {
  const endRef = useRef(new Date(data.startedAt).getTime() + data.durationMs);
  const [remaining, setRemaining] = useState(() =>
    formatRemaining(endRef.current - Date.now())
  );
  const [done, setDone] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const tick = () => {
      const left = endRef.current - Date.now();
      if (left <= 0) {
        setRemaining(formatRemaining(0));
        setDone(true);
        return;
      }
      setRemaining(formatRemaining(left));
    };

    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, []);

  const playAlarm = useCallback(() => {
    if (!audioRef.current) {
      // ponytail: inline beep via oscillator, no external assets needed
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.stop(ctx.currentTime + 0.5);
    }
  }, []);

  useEffect(() => {
    if (done) {
      playAlarm();
    }
  }, [done, playAlarm]);

  const progress = 1 - remaining.total / data.durationMs;

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-red-500/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-muted-foreground text-xs">
          {data.label || "Timer"}
        </div>
        {done ? (
          <span className="rounded-full bg-green-500/20 px-2 py-0.5 font-medium text-green-600 text-xs dark:text-green-400">
            Done
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">
            {data.duration} {data.unit}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-200"
          style={{ width: `${Math.min(progress * 100, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-center gap-1 font-mono font-light text-4xl text-foreground tabular-nums tracking-tight">
        <span>{remaining.hours}</span>
        <span className="text-muted-foreground">:</span>
        <span>{remaining.minutes}</span>
        <span className="text-muted-foreground">:</span>
        <span>{remaining.seconds}</span>
      </div>

      <div className="mt-2 flex justify-center text-muted-foreground text-xs">
        <span>h</span>
        <span className="mx-6">m</span>
        <span>s</span>
      </div>
    </div>
  );
}
