"use client";

import { useTransition } from "react";
import { updateTaskStatus } from "@/lib/actions/tasks";

const OPTIONS = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "EN_PROCESO", label: "En proceso" },
  { value: "COMPLETADO", label: "Completado" },
];

export default function TaskStatusSelect({ taskId, estado }: { taskId: string; estado: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={estado}
      disabled={isPending}
      onChange={(e) => startTransition(() => updateTaskStatus(taskId, e.target.value))}
      className="input w-auto py-1 text-xs"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
