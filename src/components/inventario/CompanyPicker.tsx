"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { COMPANIES, COMPANY_LABEL } from "@/lib/finanzas/queries";

export default function InventarioCompanyPicker({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("company", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select value={current} onChange={(e) => update(e.target.value)} className="input w-auto">
      {COMPANIES.map((c) => (
        <option key={c} value={c}>
          {COMPANY_LABEL[c]}
        </option>
      ))}
    </select>
  );
}
