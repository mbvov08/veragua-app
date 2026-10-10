"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Producto = { id: string; nombre: string; precio: number; categoria: string };
type Linea = { productoId: string; nombre: string; porSemana: string; precio: string };

const cop = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

export default function CalculadoraSuscripcion({ productos }: { productos: Producto[] }) {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [semanas, setSemanas] = useState("4");
  const [domicilio, setDomicilio] = useState("6000");
  const [descuento, setDescuento] = useState("10");
  const [cliente, setCliente] = useState("");
  const [compartiendo, setCompartiendo] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const [logoListo, setLogoListo] = useState(false);

  const nSemanas = Math.max(1, Number(semanas) || 1);
  const precioDom = Number(domicilio) || 0;
  const pct = Math.min(100, Math.max(0, Number(descuento) || 0));

  const calculo = useMemo(() => {
    const filas = lineas
      .map((l) => {
        const porSemana = Number(l.porSemana) || 0;
        const mensual = porSemana * nSemanas;
        return { nombre: l.nombre, porSemana, mensual, precio: Number(l.precio) || 0, subtotal: mensual * (Number(l.precio) || 0) };
      })
      .filter((f) => f.porSemana > 0);
    const domicilios = nSemanas * precioDom;
    const completo = filas.reduce((s, f) => s + f.subtotal, 0) + domicilios;
    const conDescuento = completo * (1 - pct / 100);
    return { filas, domicilios, completo, conDescuento, ahorro: completo - conDescuento };
  }, [lineas, nSemanas, precioDom, pct]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      logoRef.current = img;
      setLogoListo(true);
    };
    img.src = "/logo-veragua.png";
  }, []);

  // Dibuja la tarjeta (la misma imagen que se comparte con el cliente).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || calculo.filas.length === 0) return;
    const W = 1080;
    const M = 70;
    const logo = logoListo ? logoRef.current : null;
    const logoW = 340;
    const logoH = logo ? (logo.height / logo.width) * logoW : 0;
    const filasH = calculo.filas.length * 92 + 92;
    const H = 90 + logoH + 150 + filasH + 120 + 330 + 80;
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext("2d");
    if (!g) return;

    g.fillStyle = "#f9f7f2";
    g.fillRect(0, 0, W, H);
    let y = 60;
    if (logo) {
      g.drawImage(logo, (W - logoW) / 2, y, logoW, logoH);
      y += logoH + 30;
    }
    g.textAlign = "center";
    g.fillStyle = "#1c281a";
    g.font = "64px Georgia, 'Times New Roman', serif";
    g.fillText("Tu suscripción mensual", W / 2, y + 60);
    y += 80;
    if (cliente.trim()) {
      g.fillStyle = "#c9a23e";
      g.font = "bold 34px Helvetica, Arial, sans-serif";
      g.fillText(`para ${cliente.trim()}`, W / 2, y + 40);
      y += 50;
    }
    y += 30;
    g.fillStyle = "#c9a23e";
    g.fillRect(M, y, W - 2 * M, 3);
    y += 30;

    const recortar = (texto: string, ancho: number) => {
      let t = texto;
      while (g.measureText(t).width > ancho && t.length > 4) t = t.slice(0, -2);
      return t === texto ? t : `${t.trimEnd()}…`;
    };
    const fila = (izq: string, sub: string, der: string) => {
      g.textAlign = "left";
      g.fillStyle = "#1c281a";
      g.font = "bold 36px Helvetica, Arial, sans-serif";
      g.fillText(recortar(izq, W - 2 * M - 260), M, y + 44);
      g.fillStyle = "#52514e";
      g.font = "26px Helvetica, Arial, sans-serif";
      g.fillText(sub, M, y + 78);
      g.textAlign = "right";
      g.fillStyle = "#1c281a";
      g.font = "bold 36px Helvetica, Arial, sans-serif";
      g.fillText(der, W - M, y + 44);
      y += 92;
    };
    for (const f of calculo.filas) fila(`${f.mensual} × ${f.nombre}`, `${f.porSemana} por semana`, cop(f.subtotal));
    fila(`${nSemanas} × Domicilio`, "uno por cada entrega semanal", cop(calculo.domicilios));

    g.fillStyle = "#dcd6c8";
    g.fillRect(M, y + 4, W - 2 * M, 2);
    y += 40;
    g.textAlign = "left";
    g.fillStyle = "#52514e";
    g.font = "32px Helvetica, Arial, sans-serif";
    g.fillText("Total sin descuento", M, y + 36);
    g.textAlign = "right";
    const txt = cop(calculo.completo);
    g.fillText(txt, W - M, y + 36);
    const w = g.measureText(txt).width;
    g.fillStyle = "#52514e";
    g.fillRect(W - M - w, y + 24, w, 3);
    y += 80;

    // Caja del precio de la suscripción
    g.fillStyle = "#263521";
    g.beginPath();
    g.roundRect(M, y, W - 2 * M, 280, 28);
    g.fill();
    g.textAlign = "center";
    g.fillStyle = "#e8c66a";
    g.font = "bold 34px Helvetica, Arial, sans-serif";
    g.fillText("PAGANDO LA SUSCRIPCIÓN", W / 2, y + 62);
    g.fillStyle = "#ffffff";
    g.font = "bold 128px Helvetica, Arial, sans-serif";
    g.fillText(cop(calculo.conDescuento), W / 2, y + 190);
    g.fillStyle = "#e8e4d8";
    g.font = "32px Helvetica, Arial, sans-serif";
    g.fillText(`${pct}% de descuento · ahorras ${cop(calculo.ahorro)}`, W / 2, y + 240);
  }, [calculo, cliente, nSemanas, pct, logoListo]);

  const resultados = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return [];
    return productos.filter((p) => normalizar(p.nombre).includes(q) && !lineas.some((l) => l.productoId === p.id)).slice(0, 8);
  }, [busqueda, productos, lineas]);

  function agregar(p: Producto) {
    setLineas((prev) => [...prev, { productoId: p.id, nombre: p.nombre, porSemana: "1", precio: String(p.precio) }]);
    setBusqueda("");
  }
  const cambiar = (id: string, campo: "porSemana" | "precio", v: string) =>
    setLineas((prev) => prev.map((l) => (l.productoId === id ? { ...l, [campo]: v } : l)));

  async function imagen(): Promise<Blob | null> {
    return new Promise((res) => canvasRef.current?.toBlob(res, "image/png"));
  }
  async function compartir() {
    setCompartiendo(true);
    try {
      const blob = await imagen();
      if (!blob) return;
      const file = new File([blob], "suscripcion-veragua.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Suscripción Veragua" });
      else descargarBlob(blob);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) alert("No se pudo compartir; usa Descargar imagen.");
    } finally {
      setCompartiendo(false);
    }
  }
  function descargarBlob(blob: Blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "suscripcion-veragua.png";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="label">Entregas en el mes (semanas)</label>
          <input type="number" min="1" value={semanas} onChange={(e) => setSemanas(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Domicilio por entrega</label>
          <input type="number" min="0" value={domicilio} onChange={(e) => setDomicilio(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Descuento por suscribirse (%)</label>
          <input type="number" min="0" max="100" value={descuento} onChange={(e) => setDescuento(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Nombre del cliente (opcional)</label>
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} className="input" />
        </div>
      </div>

      <div>
        <label className="label">Agregar producto</label>
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Busca por nombre (ej. kéfir, huevos mixtos)" className="input" />
        {resultados.length > 0 && (
          <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-verde-100 bg-white">
            {resultados.map((p) => (
              <button key={p.id} type="button" onClick={() => agregar(p)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-verde-50">
                <span>{p.nombre}</span>
                <span className="text-xs text-tierra-500">{cop(p.precio)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {lineas.length > 0 && (
        <div className="space-y-2">
          {lineas.map((l) => (
            <div key={l.productoId} className="flex flex-wrap items-end gap-2 rounded-lg border border-verde-100 bg-verde-50/40 p-2">
              <p className="min-w-0 flex-1 basis-40 truncate text-sm font-medium text-tierra-800">{l.nombre}</p>
              <div>
                <label className="label">Por semana</label>
                <input type="number" min="0" value={l.porSemana} onChange={(e) => cambiar(l.productoId, "porSemana", e.target.value)} className="input w-24" />
              </div>
              <div>
                <label className="label">Precio unidad</label>
                <input type="number" min="0" value={l.precio} onChange={(e) => cambiar(l.productoId, "precio", e.target.value)} className="input w-28" />
              </div>
              <button type="button" onClick={() => setLineas((prev) => prev.filter((x) => x.productoId !== l.productoId))} className="chip-danger">
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}

      {calculo.filas.length === 0 ? (
        <p className="text-sm text-tierra-500">Agrega productos y la cantidad por semana para ver el valor de la suscripción.</p>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-verde-800 p-5 text-center" style={{ backgroundColor: "#263521" }}>
            <p className="text-xs font-semibold tracking-widest text-dorado-300" style={{ color: "#e8c66a" }}>PAGANDO LA SUSCRIPCIÓN</p>
            <p className="text-5xl font-bold text-white sm:text-6xl">{cop(calculo.conDescuento)}</p>
            <p className="mt-1 text-sm text-verde-100" style={{ color: "#e8e4d8" }}>
              Sin descuento {cop(calculo.completo)} · ahorras {cop(calculo.ahorro)} ({pct}%)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={compartir} disabled={compartiendo} className="btn-primary">
              {compartiendo ? "Preparando..." : "Compartir imagen"}
            </button>
            <button type="button" onClick={async () => { const b = await imagen(); if (b) descargarBlob(b); }} className="btn-outline">
              Descargar imagen
            </button>
          </div>
          <canvas ref={canvasRef} className="w-full max-w-md rounded-xl border border-verde-100 shadow-sm" />
        </div>
      )}
    </div>
  );
}
