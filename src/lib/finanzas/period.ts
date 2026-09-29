import { dateOnlyToUTC } from "@/lib/date";

export type PeriodMode = "month" | "year";

export interface Period {
  mode: PeriodMode;
  value: string; // "YYYY-MM" o "YYYY"
  start: Date;
  end: Date;
  label: string;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function resolvePeriod(searchParams: { period?: string; value?: string }): Period {
  const now = new Date();
  const mode: PeriodMode = searchParams.period === "year" ? "year" : "month";

  if (mode === "year") {
    const year =
      searchParams.value && /^\d{4}$/.test(searchParams.value) ? Number(searchParams.value) : now.getFullYear();
    return {
      mode,
      value: String(year),
      start: dateOnlyToUTC(`${year}-01-01`),
      end: dateOnlyToUTC(`${year}-12-31`),
      label: String(year),
    };
  }

  const defaultValue = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const value = searchParams.value && /^\d{4}-\d{2}$/.test(searchParams.value) ? searchParams.value : defaultValue;
  const [yearStr, monthStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const end = lastDayOfMonth(year, month);

  const label = new Date(year, month - 1, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });

  return {
    mode,
    value,
    start: dateOnlyToUTC(`${value}-01`),
    end: dateOnlyToUTC(`${value}-${pad(end)}`),
    label,
  };
}
