"use client";

import { useEffect } from "react";

function nextDateForWeekday(target: number): string {
  const now = new Date();
  const diff = (target - now.getDay() + 7) % 7;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  const d = String(next.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function ZonaFechaSync({ rutaDias }: { rutaDias: Record<string, number | null> }) {
  useEffect(() => {
    const zonaSelect = document.getElementById("zona") as HTMLSelectElement | null;
    const fechaInput = document.getElementById("fechaEntrega") as HTMLInputElement | null;
    if (!zonaSelect || !fechaInput) return;

    function onZonaChange() {
      const dia = rutaDias[zonaSelect!.value];
      if (dia !== undefined && dia !== null) {
        fechaInput!.value = nextDateForWeekday(dia);
      }
    }

    zonaSelect.addEventListener("change", onZonaChange);
    return () => zonaSelect.removeEventListener("change", onZonaChange);
  }, [rutaDias]);

  return null;
}
