import { prisma } from "@/lib/prisma";
import { addDays, todayColombia, dayOfWeek } from "@/lib/date";

const ORDER_HORIZON_DAYS = 21;
const REMINDER_HORIZON_DAYS = 14;

/** Genera (si faltan) los pedidos de reglas recurrentes para las próximas semanas. Idempotente. */
export async function ensureRecurringOrdersGenerated() {
  const rules = await prisma.recurringOrderRule.findMany({
    where: { activo: true },
  });
  if (rules.length === 0) return;

  const today = todayColombia();
  const dates: Date[] = [];
  for (let i = 0; i <= ORDER_HORIZON_DAYS; i++) dates.push(addDays(today, i));

  const candidates = rules.flatMap((rule) =>
    dates
      .filter((d) => dayOfWeek(d) === rule.diaSemana)
      .map((fechaEntrega) => ({
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
  if (candidates.length === 0) return;

  // skipDuplicates se apoya en @@unique([recurringRuleId, fechaEntrega]): evita
  // repetir un findUnique por cada combinación regla×fecha en cada carga de página.
  await prisma.order.createMany({ data: candidates, skipDuplicates: true });
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
  await Promise.all([ensureRecurringOrdersGenerated(), ensureRemindersGenerated()]);
}
