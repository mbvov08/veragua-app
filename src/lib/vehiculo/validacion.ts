// Sin imports de servidor a propósito: se usa tanto en componentes cliente (feedback
// progresivo mientras se llena el formulario) como de nuevo en el server action al
// guardar — ahí es donde el chequeo realmente cuenta, el del cliente es solo UX.
import { ANGULOS, PUNTOS_EVALUACION, EQUIPAMIENTO_ITEMS, NOVEDAD_TIPOS, labelDe } from "@/lib/vehiculo/constants";

export type FotoDraft = { angulo: string; blob: Blob | null };
export type EvaluacionDraft = { punto: string; estado: "BUENO" | "REGULAR" | "MALO" | ""; nota: string };
export type EquipoDraft = { item: string; presente: boolean | null };
export type NovedadDraft = { tipo: string; marcado: boolean; detalle: string };

export interface ActaEntregaDraft {
  vehiculoId: string;
  conductorId: string;
  tipoUso: string;
  zona: string;
  checkoutKm: string;
  checkoutCombustible: string;
  fotos: FotoDraft[];
  evaluaciones: EvaluacionDraft[];
  equipamiento: EquipoDraft[];
  firmaConductorVacia: boolean;
  firmaRepVacia: boolean;
}

export interface ActaDevolucionDraft {
  checkinKm: string;
  checkinCombustible: string;
  fotos: FotoDraft[];
  evaluaciones: EvaluacionDraft[];
  equipamiento: EquipoDraft[];
  novedades: NovedadDraft[];
  firmaConductorVacia: boolean;
  firmaRepVacia: boolean;
}

function validarComun(args: {
  km: string;
  combustible: string;
  fotos: FotoDraft[];
  evaluaciones: EvaluacionDraft[];
  equipamiento: EquipoDraft[];
  firmaConductorVacia: boolean;
  firmaRepVacia: boolean;
  requiereFirmaRep: boolean;
}): string[] {
  const faltas: string[] = [];

  if (!args.km || Number(args.km) < 0) faltas.push("Kilometraje");
  if (!args.combustible) faltas.push("Nivel de combustible");

  for (const a of ANGULOS) {
    const foto = args.fotos.find((f) => f.angulo === a.value);
    if (!foto?.blob) faltas.push(`Foto: ${a.label}`);
  }

  for (const p of PUNTOS_EVALUACION) {
    const ev = args.evaluaciones.find((e) => e.punto === p.value);
    if (!ev?.estado) {
      faltas.push(`Evaluación: ${p.label}`);
    } else if (ev.estado !== "BUENO" && !ev.nota.trim()) {
      faltas.push(`Observación obligatoria para "${p.label}" (quedó en ${labelDe(PUNTOS_EVALUACION, ev.estado)})`);
    }
  }

  for (const it of EQUIPAMIENTO_ITEMS) {
    const eq = args.equipamiento.find((e) => e.item === it.value);
    if (eq?.presente === null || eq?.presente === undefined) faltas.push(`Dotación: ${it.label} (sí/no)`);
  }

  if (args.firmaConductorVacia) faltas.push("Firma del conductor");
  if (args.requiereFirmaRep && args.firmaRepVacia) faltas.push("Firma de la persona de la empresa");

  return faltas;
}

export function validarActaEntrega(draft: ActaEntregaDraft, opts?: { requiereFirmaRep?: boolean }): string[] {
  const requiereFirmaRep = opts?.requiereFirmaRep ?? true;
  const faltas: string[] = [];
  if (!draft.vehiculoId) faltas.push("Vehículo");
  if (!draft.conductorId) faltas.push("Conductor");
  if (!draft.tipoUso) faltas.push("Tipo de uso");
  // La zona ya no es obligatoria: una ruta puede tocar varias zonas en un mismo viaje
  // (ver el campo "Ruta / paradas" de texto libre en el formulario).

  faltas.push(
    ...validarComun({
      km: draft.checkoutKm,
      combustible: draft.checkoutCombustible,
      fotos: draft.fotos,
      evaluaciones: draft.evaluaciones,
      equipamiento: draft.equipamiento,
      firmaConductorVacia: draft.firmaConductorVacia,
      firmaRepVacia: draft.firmaRepVacia,
      requiereFirmaRep,
    })
  );

  return faltas;
}

export function validarActaDevolucion(draft: ActaDevolucionDraft, checkoutKm: number): string[] {
  const faltas: string[] = [];

  if (draft.checkinKm && Number(draft.checkinKm) < checkoutKm) {
    faltas.push(`El kilometraje de devolución no puede ser menor al de entrega (${checkoutKm})`);
  }

  faltas.push(
    ...validarComun({
      km: draft.checkinKm,
      combustible: draft.checkinCombustible,
      fotos: draft.fotos,
      evaluaciones: draft.evaluaciones,
      equipamiento: draft.equipamiento,
      firmaConductorVacia: draft.firmaConductorVacia,
      firmaRepVacia: draft.firmaRepVacia,
      requiereFirmaRep: true,
    })
  );

  for (const n of NOVEDAD_TIPOS) {
    const nov = draft.novedades.find((x) => x.tipo === n.value);
    if (nov?.marcado && !nov.detalle.trim()) {
      faltas.push(`Detalle obligatorio para la novedad "${n.label}"`);
    }
  }

  return faltas;
}
