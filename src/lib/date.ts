// Todas las fechas "de calendario" (workDate, fechaEntrega, fechaLimite, fecha de recordatorio,
// periodStart/periodEnd, fechaIngreso/fechaRetiro) se guardan como Date a las 12:00:00 UTC del día
// correspondiente. Esto evita que un cambio de zona horaria del servidor corra el día hacia atrás
// o adelante al mostrarlas: mediodía UTC cae dentro del mismo día calendario en cualquier huso horario
// real (America/Bogota es UTC-5 todo el año, sin horario de verano).

export const COLOMBIA_TZ = "America/Bogota";
const COLOMBIA_OFFSET_MS = -5 * 60 * 60 * 1000;

/** Convierte "YYYY-MM-DD" a un Date a mediodía UTC de ese día. */
export function dateOnlyToUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/** Instante UTC de una hora:minuto de Colombia en la fecha "YYYY-MM-DD" dada. */
export function colombiaDateTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h + 5, min));
}

/** Formatea un Date "de calendario" (mediodía UTC) como "YYYY-MM-DD". */
export function formatDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Día de la semana (0=domingo..6=sábado) de un Date "de calendario". */
export function dayOfWeek(date: Date): number {
  return date.getUTCDay();
}

/** Hoy, como Date "de calendario" (mediodía UTC), usando la fecha local de Colombia. */
export function todayColombia(): Date {
  const now = new Date();
  const coShifted = new Date(now.getTime() + COLOMBIA_OFFSET_MS);
  return new Date(
    Date.UTC(
      coShifted.getUTCFullYear(),
      coShifted.getUTCMonth(),
      coShifted.getUTCDate(),
      12,
      0,
      0
    )
  );
}

/** Dado un instante real (ej. el click de "marcar entrada"), retorna el día calendario de Colombia como Date "de calendario". */
export function workDateFor(instant: Date): Date {
  const coShifted = new Date(instant.getTime() + COLOMBIA_OFFSET_MS);
  return new Date(
    Date.UTC(
      coShifted.getUTCFullYear(),
      coShifted.getUTCMonth(),
      coShifted.getUTCDate(),
      12,
      0,
      0
    )
  );
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function startOfWeekColombia(date: Date = todayColombia()): Date {
  // semana inicia lunes
  const dow = dayOfWeek(date);
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(date, diff);
}

export function formatTimeCo(date: Date): string {
  return date.toLocaleTimeString("es-CO", {
    timeZone: COLOMBIA_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateLongEs(date: Date): string {
  return date.toLocaleDateString("es-CO", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShortEs(date: Date): string {
  return date.toLocaleDateString("es-CO", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

/** Instante UTC que corresponde a una hora:minuto de Colombia en el día calendario dado (workDate). */
export function colombiaClockOnDate(workDate: Date, hour: number, minute = 0): Date {
  const y = workDate.getUTCFullYear();
  const m = workDate.getUTCMonth();
  const d = workDate.getUTCDate();
  return new Date(Date.UTC(y, m, d, hour + 5, minute));
}

/** Horas trabajadas en el día (decimal), restando 1 hora de almuerzo de lunes a viernes. */
export function computeWorkedHours(
  clockIn: Date,
  clockOut: Date,
  dow: number
): number {
  const rawMs = clockOut.getTime() - clockIn.getTime();
  const lunchMs = dow >= 1 && dow <= 5 ? 60 * 60 * 1000 : 0;
  const workedMs = Math.max(0, rawMs - lunchMs);
  return workedMs / (60 * 60 * 1000);
}
