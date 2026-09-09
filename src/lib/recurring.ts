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

  for (const rule of rules) {
    const matchingDates = dates.filter((d) => dayOfWeek(d) === rule.diaSemana);
    for (const fechaEntrega of matchingDates) {
      const exists = await prisma.order.findUnique({
        where: {
          recurringRuleId_fechaEntrega: {
            recurringRuleId: rule.id,
            fechaEntrega,
          },
        },
      });
      if (!exists) {
        await prisma.order.create({
          data: {
            cliente: rule.cliente,
            direccion: rule.direccion,
            telefono: rule.telefono,
            zona: rule.zona,
            fechaEntrega,
            notas: rule.notas,
            recurringRuleId: rule.id,
            creadoPorId: rule.creadoPorId,
          },
        });
      }
    }
  }
}

/** Genera (si faltan) las instancias de recordatorios recurrentes para las próximas semanas. Idempotente. */
export async function ensureRemindersGenerated() {
  const rules = await prisma.reminderRule.findMany({ where: { activo: true, esUnico: false } });
  if (rules.length === 0) return;

  const today = todayColombia();
  const dates: Date[] = [];
  for (let i = 0; i <= REMINDER_HORIZON_DAYS; i++) dates.push(addDays(today, i));

  for (const rule of rules) {
    const matchingDates = dates.filter((d) => dayOfWeek(d) === rule.diaSemana);
    for (const fecha of matchingDates) {
      const exists = await prisma.reminderInstance.findUnique({
        where: {
          reminderRuleId_fecha: {
            reminderRuleId: rule.id,
            fecha,
          },
        },
      });
      if (!exists) {
        await prisma.reminderInstance.create({
          data: { reminderRuleId: rule.id, fecha },
        });
      }
    }
  }
}

export async function ensureAllGenerated() {
  await Promise.all([ensureRecurringOrdersGenerated(), ensureRemindersGenerated()]);
}
