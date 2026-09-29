"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCOP } from "@/lib/finanzas/format";
import type { ChannelContribution } from "@/lib/finanzas/calculations";

export default function ChannelContributionChart({ data }: { data: ChannelContribution[] }) {
  const chartData = data.map((d) => ({
    name: d.channel_name,
    Ingresos: d.revenue,
    "Costos directos": d.direct_costs,
    "Margen de contribución": d.contributionMargin,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dde2d0" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => new Intl.NumberFormat("es-CO", { notation: "compact" }).format(v)} />
          <Tooltip formatter={(value) => formatCOP(Number(value))} />
          <Legend />
          <Bar dataKey="Ingresos" fill="#465c34" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Costos directos" fill="#9c6b38" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Margen de contribución" fill="#b08a2f" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
