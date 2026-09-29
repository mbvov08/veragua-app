"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Period } from "@/lib/finanzas/period";

export default function PeriodPicker({ period }: { period: Period }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(next: Partial<{ period: string; value: string }>) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.period) params.set("period", next.period);
    if (next.value) params.set("value", next.value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <select value={period.mode} onChange={(e) => update({ period: e.target.value })} className="input w-auto">
        <option value="month">Mensual</option>
        <option value="year">Anual</option>
      </select>
      {period.mode === "month" ? (
        <input
          type="month"
          value={period.value}
          onChange={(e) => update({ value: e.target.value })}
          className="input w-auto"
        />
      ) : (
        <input
          type="number"
          value={period.value}
          onChange={(e) => update({ value: e.target.value })}
          className="input w-24"
        />
      )}
    </div>
  );
}
