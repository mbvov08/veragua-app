import { prisma } from "@/lib/prisma";
import { addDays, todayColombia, dayOfWeek } from "@/lib/date";
import { ensureReabastecimientoAlertaGenerada } from "@/lib/inventario/reabastecimiento-alertas";
import {
  ensureSalidaAbiertaAlertaGenerada,
  ensureSalidaNovedadAlertaGenerada,
  ensureDocumentoVencimientoAlertaGenerada,
} from "@/lib/vehiculo/vehiculo-alertas";

const ORDER_HORIZON_DAYS = 21;
const REMINDER_HORIZON_DAYS = 14;

/** Genera (si faltan) los pedidos de reglas recurrentes para las próximas semanas. Idempotente. */
export async function ensureRecurringOrdersGenerated() {
  const rules = await prisma.recurringOrderRule.findMany({
    where: { activo: true },
    include: { items: true },
  });
  if (rules.length === 0) return;

  const today = todayColombia();
  const dates: Date[] = [];
  for (let i = 0; i <= ORDER_HORIZON_DAYS; i++) dates.push(addDays(today, i));

  type Candidate = {
    cliente: string;
    direccion: string;
    telefono: string | null;
    zona: string;
    fechaEntrega: Date;
    notas: string | null;
    recurringRuleId: string;
    creadoPorId: string;
  };
  const candidatesByRule = new Map<string, Candidate[]>();
  for (const rule of rules) {
    const fechas = dates.filter((d) => dayOfWeek(d) === rule.diaSemana && (!rule.fechaFin || d <= rule.fechaFin));
    if (fechas.length === 0) continue;
    candidatesByRule.set(
      rule.id,
      fechas.map((fechaEntrega) => ({
        cliente: rule.cliente,
        direccion: rule.direccion,
        telefono: rule.telefono,
        zona: rule.zona,
        fechaEntrega,
        notas: rule.notas,
        recurringRuleId: rule.id,
        creadoPorId: rule.creadoPorId,
      }))
    );
  }
  const candidates = [...candidatesByRule.values()].flat();
  if (candidates.length === 0) return;

  // skipDuplicates se apoya en @@unique([recurringRuleId, fechaEntrega]): evita
  // repetir un findUnique por cada combinación regla×fecha en cada carga de página.
  await prisma.order.createMany({ data: candidates, skipDuplicates: true });

  // Copia los productos de la plantilla de la regla (si tiene) a los pedidos recién
  // creados que todavía no tengan items — así no hay que agregarlos a mano cada semana.
  const reglasConItems = rules.filter((r) => r.items.length > 0 && candidatesByRule.has(r.id));
  for (const rule of reglasConItems) {
    const fechas = (candidatesByRule.get(rule.id) ?? []).map((c) => c.fechaEntrega);
    const ordenesSinItems = await prisma.order.findMany({
      where: { recurringRuleId: rule.id, fechaEntrega: { in: fechas }, items: { none: {} } },
      select: { id: true },
    });
    if (ordenesSinItems.length === 0) continue;
    const itemsData = ordenesSinItems.flatMap((o) =>
      rule.items.map((it) => ({ orderId: o.id, productoId: it.productoId, cantidad: it.cantidad }))
    );
    await prisma.orderItem.createMany({ data: itemsData });
  }
}

/** Genera (si faltan) las instancias de recordatorios recurrentes para las próximas semanas. Idempotente. */
export async function ensureRemindersGenerated() {
  const rules = await prisma.reminderRule.findMany({ where: { activo: true, esUnico: false } });
  if (rules.length === 0) return;

  const today = todayColombia();
  const dates: Date[] = [];
  for (let i = 0; i <= REMINDER_HORIZON_DAYS; i++) dates.push(addDays(today, i));

  const candidates = rules.flatMap((rule) =>
    dates.filter((d) => dayOfWeek(d) === rule.diaSemana).map((fecha) => ({ reminderRuleId: rule.id, fecha }))
  );
  if (candidates.length === 0) return;

  await prisma.reminderInstance.createMany({ data: candidates, skipDuplicates: true });
}

export async function ensureAllGenerated() {
  await Promise.all([
    ensureRecurringOrdersGenerated(),
    ensureRemindersGenerated(),
    ensureReabastecimientoAlertaGenerada(),
    ensureSalidaAbiertaAlertaGenerada(),
    ensureSalidaNovedadAlertaGenerada(),
    ensureDocumentoVencimientoAlertaGenerada(),
  ]);
}
