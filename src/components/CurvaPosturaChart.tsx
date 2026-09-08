"use client";

import { useMemo, useState } from "react";

export type PosturaPoint = {
  fecha: string; // YYYY-MM-DD
  galpon: number | null;
  local: number | null;
};

const COLOR_GALPON = "#2a78d6";
const COLOR_LOCAL = "#eb6834";

const WIDTH = 720;
const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 40 };

function niceMax(value: number) {
  if (value <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export default function CurvaPosturaChart({
  data,
  showGalpon = true,
  showLocal = true,
}: {
  data: PosturaPoint[];
  showGalpon?: boolean;
  showLocal?: boolean;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const maxVal = useMemo(() => {
    const values = data.flatMap((d) => [d.galpon ?? 0, d.local ?? 0]);
    return niceMax(Math.max(1, ...values));
  }, [data]);

  const n = data.length;
  const x = (i: number) => (n <= 1 ? PAD.left : PAD.left + (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;

  function pathFor(key: "galpon" | "local") {
    let d = "";
    let started = false;
    data.forEach((point, i) => {
      const v = point[key];
      if (v === null) {
        started = false;
        return;
      }
      d += `${started ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      started = true;
    });
    return d.trim();
  }

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => maxVal * f);

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    if (n <= 1) {
      setHoverIndex(0);
      return;
    }
    const ratio = Math.min(1, Math.max(0, (relX - PAD.left) / innerW));
    setHoverIndex(Math.round(ratio * (n - 1)));
  }

  const hover = hoverIndex !== null ? data[hoverIndex] : null;
  const showEveryNth = Math.max(1, Math.ceil(n / 7));

  return (
    <div className="relative">
      <div className="mb-2 flex items-center gap-4 text-xs">
        {showGalpon && (
          <span className="flex items-center gap-1.5 text-tierra-600">
            <span className="inline-block h-0.5 w-4" style={{ backgroundColor: COLOR_GALPON }} />
            Producción galpón (buenos)
          </span>
        )}
        {showLocal && (
          <span className="flex items-center gap-1.5 text-tierra-600">
            <span className="inline-block h-0.5 w-4" style={{ backgroundColor: COLOR_LOCAL }} />
            Recepción en el local
          </span>
        )}
      </div>

      {n === 0 ? (
        <p className="py-10 text-center text-sm text-tierra-500">Aún no hay datos en este rango.</p>
      ) : (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none"
          onPointerMove={handleMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          {gridLines.map((gv, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(gv)}
                y2={y(gv)}
                stroke="#e5e0d3"
                strokeWidth={1}
              />
              <text x={PAD.left - 6} y={y(gv) + 3} textAnchor="end" fontSize={9} fill="#8a8577">
                {Math.round(gv).toLocaleString("es-CO")}
              </text>
            </g>
          ))}

          {data.map((d, i) =>
            i % showEveryNth === 0 ? (
              <text
                key={d.fecha}
                x={x(i)}
                y={HEIGHT - 8}
                textAnchor="middle"
                fontSize={9}
                fill="#8a8577"
              >
                {d.fecha.slice(5)}
              </text>
            ) : null
          )}

          {showLocal && (
            <path d={pathFor("local")} fill="none" stroke={COLOR_LOCAL} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {showGalpon && (
            <path d={pathFor("galpon")} fill="none" stroke={COLOR_GALPON} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}

          {hoverIndex !== null && (
            <line
              x1={x(hoverIndex)}
              x2={x(hoverIndex)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke="#8a8577"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          )}

          {hover?.galpon !== null && hover?.galpon !== undefined && hoverIndex !== null && (
            <circle cx={x(hoverIndex)} cy={y(hover.galpon)} r={4} fill={COLOR_GALPON} stroke="#fff" strokeWidth={2} />
          )}
          {hover?.local !== null && hover?.local !== undefined && hoverIndex !== null && (
            <circle cx={x(hoverIndex)} cy={y(hover.local)} r={4} fill={COLOR_LOCAL} stroke="#fff" strokeWidth={2} />
          )}
        </svg>
      )}

      {hover && hoverIndex !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-verde-100 bg-white px-3 py-2 text-xs shadow-md"
          style={{
            left: `${Math.min(88, Math.max(2, (x(hoverIndex) / WIDTH) * 100))}%`,
          }}
        >
          <p className="mb-1 font-medium text-tierra-800">{hover.fecha}</p>
          {showGalpon && (
            <p className="flex items-center gap-1.5 text-tierra-700">
              <span className="inline-block h-0.5 w-3" style={{ backgroundColor: COLOR_GALPON }} />
              Galpón: <span className="font-semibold">{hover.galpon ?? "—"}</span>
            </p>
          )}
          {showLocal && (
            <p className="flex items-center gap-1.5 text-tierra-700">
              <span className="inline-block h-0.5 w-3" style={{ backgroundColor: COLOR_LOCAL }} />
              Local: <span className="font-semibold">{hover.local ?? "—"}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
