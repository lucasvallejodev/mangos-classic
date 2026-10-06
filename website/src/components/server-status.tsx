"use client";

import { useEffect, useState } from "react";

export function ServerStatus() {
  const [running, setRunning] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/server-status")
        .then((r) => r.json())
        .then((d) => alive && setRunning(d.running))
        .catch(() => alive && setRunning(null));
    load();
    const timer = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const label = running === null ? "World server: …" : running ? "World server: running" : "World server: stopped";
  const dot = running === null ? "bg-gray-500" : running ? "bg-emerald-400" : "bg-red-400";
  return (
    <span className="flex items-center gap-2 text-xs text-gray-400" title="Imports are only possible while the world server is stopped">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
