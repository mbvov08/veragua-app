import { colombiaClockOnDate, dayOfWeek } from "@/lib/date";

/** Fin de la jornada ordinaria pactada (hora de Colombia) por día de la semana (0=domingo). */
export const JORNADA_FIN: Record<number, { hour: number; minute: number } | null> = {
  0: null, // domingo: sin jornada ordinaria pactada
  1: { hour: 19, minute: 0 },
  2: { hour: 19, minute: 0 },
  3: { hour: 19, minute: 0 },
  4: { hour: 19, minute: 0 },
  5: { hour: 19, minute: 0 },
  6: { hour: 17, minute: 0 }, // sábado
};

/** Instante en que termina la jornada ordinaria ese día calendario, o null si no hay jornada (domingo). */
export function finJornadaOrdinaria(workDate: Date): Date | null {
  const cfg = JORNADA_FIN[dayOfWeek(workDate)];
  if (!cfg) return null;
  return colombiaClockOnDate(workDate, cfg.hour, cfg.minute);
}
