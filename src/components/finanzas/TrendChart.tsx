"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCOP } from "@/lib/finanzas/format";
import type { MonthlyTrendPoint } from "@/lib/finanzas/queries";

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}

export default function TrendChart({ data }: { data: MonthlyTrendPoint[] }) {
  const chartData = data.map((d) => ({ name: monthLabel(d.month), Ingresos: d.income, Egresos: d.expense }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dde2d0" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => new Intl.NumberFormat("es-CO", { notation: "compact" }).format(v)} />
          <Tooltip formatter={(value) => formatCOP(Number(value))} />
          <Legend />
          <Line type="monotone" dataKey="Ingresos" stroke="#465c34" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Egresos" stroke="#9c6b38" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
