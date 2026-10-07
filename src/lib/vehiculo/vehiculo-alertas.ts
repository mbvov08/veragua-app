import { prisma } from "@/lib/prisma";
import { todayColombia, addDays } from "@/lib/date";
import { comparePuntos } from "@/lib/vehiculo/comparacion";

const TITULO_ABIERTA = "🚐 Salida abierta";
const TITULO_NOVEDAD = "🚐 Devolución con novedades";
const TITULO_DOCUMENTOS = "🚐 Documentos del vehículo";

const HORAS_ABIERTA_ALERTA = 14;
const DIAS_ANTES_VENCIMIENTO = 30;

async function getOrCreateReglaSistema(titulo: string) {
  const existente = await prisma.reminderRule.findFirst({ where: { titulo, esUnico: true } });
  if (existente) return existente;

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  if (!admin) return null;

  return prisma.reminderRule.create({ data: { titulo, diaSemana: 0, esUnico: true, creadoPorId: admin.id } });
}

/** A diferencia del patrón de reabastecimiento (que solo crea la instancia si falta),
 * esta condición puede volverse cierta en cualquier momento del día — una salida que
 * se abrió hace 10h puede pasar las 14h mientras alguien tiene la página abierta. Por
 * eso se recalcula y se hace upsert en cada carga en vez de "crear solo si falta". */
export async function ensureSalidaAbiertaAlertaGenerada() {
  const hoy = todayColombia();
  const regla = await getOrCreateReglaSistema(TITULO_ABIERTA);
  if (!regla) return;

  const limite = new Date(Date.now() - HORAS_ABIERTA_ALERTA * 60 * 60 * 1000);
  const abiertas = await prisma.vehiculoSalida.findMany({
    where: { checkinAt: null, checkoutAt: { lte: limite } },
    include: { vehiculo: true, conductor: true },
  });

  const mensajeOverride =
    abiertas.length > 0
      ? `Llevan más de ${HORAS_ABIERTA_ALERTA}h abiertas: ${abiertas.map((s) => `${s.vehiculo.placa} (${s.conductor.name})`).join(", ")}.`
      : "";

  await prisma.reminderInstance.upsert({
    where: { reminderRuleId_fecha: { reminderRuleId: regla.id, fecha: hoy } },
    update: { mensajeOverride },
    create: { reminderRuleId: regla.id, fecha: hoy, mensajeOverride },
  });
}

/** Mismo motivo que la anterior: una devolución con novedades puede registrarse en
 * cualquier momento del día de hoy. */
export async function ensureSalidaNovedadAlertaGenerada() {
  const hoy = todayColombia();
  const regla = await getOrCreateReglaSistema(TITULO_NOVEDAD);
  if (!regla) return;

  const inicioHoy = new Date(hoy);
  inicioHoy.setUTCHours(0, 0, 0, 0);
  const finHoy = new Date(hoy);
  finHoy.setUTCHours(23, 59, 59, 999);

  const cerradasHoy = await prisma.vehiculoSalida.findMany({
    where: { checkinAt: { gte: inicioHoy, lte: finHoy } },
    include: { vehiculo: true, conductor: true, novedades: true, evaluaciones: true },
  });

  const nombres: string[] = [];
  for (const s of cerradasHoy) {
    const tieneNovedad = s.novedades.some((n) => n.marcado);
    const evalEntrega = s.evaluaciones.filter((e) => e.momento === "ENTREGA");
    const evalDevolucion = s.evaluaciones.filter((e) => e.momento === "DEVOLUCION");
    const empeoro = comparePuntos(evalEntrega, evalDevolucion).some((c) => c.empeoro);
    if (tieneNovedad || empeoro) nombres.push(`${s.vehiculo.placa} (${s.conductor.name})`);
  }

  const mensajeOverride = nombres.length > 0 ? `Devolución con novedades o puntos que empeoraron: ${nombres.join(", ")}.` : "";

  await prisma.reminderInstance.upsert({
    where: { reminderRuleId_fecha: { reminderRuleId: regla.id, fecha: hoy } },
    update: { mensajeOverride },
    create: { reminderRuleId: regla.id, fecha: hoy, mensajeOverride },
  });
}

/** Las fechas de vencimiento de documentos no cambian durante el día, así que aquí sí
 * alcanza con "crear solo si falta" como el patrón original de reabastecimiento. */
export async function ensureDocumentoVencimientoAlertaGenerada() {
  const hoy = todayColombia();
  const regla = await getOrCreateReglaSistema(TITULO_DOCUMENTOS);
  if (!regla) return;

  const yaExiste = await prisma.reminderInstance.findUnique({
    where: { reminderRuleId_fecha: { reminderRuleId: regla.id, fecha: hoy } },
  });
  if (yaExiste) return;

  const limite = addDays(hoy, DIAS_ANTES_VENCIMIENTO);
  const vehiculos = await prisma.vehiculo.findMany({
    where: {
      activo: true,
      OR: [{ soatVenceAt: { lte: limite } }, { revisionTecnicoMecanicaVenceAt: { lte: limite } }],
    },
  });

  const avisos: string[] = [];
  for (const v of vehiculos) {
    if (v.soatVenceAt && v.soatVenceAt <= limite) avisos.push(`${v.placa}: SOAT vence ${v.soatVenceAt.toISOString().slice(0, 10)}`);
    if (v.revisionTecnicoMecanicaVenceAt && v.revisionTecnicoMecanicaVenceAt <= limite) {
      avisos.push(`${v.placa}: revisión técnico-mecánica vence ${v.revisionTecnicoMecanicaVenceAt.toISOString().slice(0, 10)}`);
    }
  }

  const mensajeOverride = avisos.length > 0 ? avisos.join("; ") + "." : "";

  try {
    await prisma.reminderInstance.create({ data: { reminderRuleId: regla.id, fecha: hoy, mensajeOverride } });
  } catch (e) {
    console.error("[vehiculo-alertas] error creando instancia de documentos (puede ser carrera benigna):", e);
  }
}
