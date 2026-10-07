const SEVERIDAD: Record<string, number> = { BUENO: 0, REGULAR: 1, MALO: 2 };

export type EvalRow = { punto: string; estado: string };

/** Compara los puntos de evaluación de entrega vs. devolución — lo reutilizan el badge
 * "N puntos empeoraron" del historial, la tabla resaltada del detalle, y la alerta de
 * devolución con novedades. */
export function comparePuntos(entrega: EvalRow[], devolucion: EvalRow[]): { punto: string; empeoro: boolean }[] {
  const estadoEntregaPorPunto = new Map(entrega.map((e) => [e.punto, e.estado]));
  return devolucion.map((d) => {
    const antes = estadoEntregaPorPunto.get(d.punto);
    const empeoro = antes !== undefined && (SEVERIDAD[d.estado] ?? 0) > (SEVERIDAD[antes] ?? 0);
    return { punto: d.punto, empeoro };
  });
}

export function contarPuntosQueEmpeoraron(entrega: EvalRow[], devolucion: EvalRow[]): number {
  return comparePuntos(entrega, devolucion).filter((p) => p.empeoro).length;
}
