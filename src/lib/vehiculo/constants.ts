export const ANGULOS = [
  { value: "FRENTE", label: "Frente" },
  { value: "TRASERA", label: "Parte trasera" },
  { value: "COSTADO_IZQUIERDO", label: "Costado izquierdo" },
  { value: "COSTADO_DERECHO", label: "Costado derecho" },
  { value: "INTERIOR_CABINA", label: "Interior de la cabina" },
  { value: "TABLERO", label: "Tablero (kilometraje y combustible visibles)" },
  { value: "INTERIOR_FURGON", label: "Interior del furgón de carga" },
] as const;

export const PUNTOS_EVALUACION = [
  { value: "CARROCERIA_PINTURA", label: "Carrocería y pintura" },
  { value: "VIDRIOS_ESPEJOS", label: "Vidrios y espejos" },
  { value: "LLANTAS", label: "Llantas (incluida la de repuesto)" },
  { value: "LUCES_DIRECCIONALES", label: "Luces y direccionales" },
  { value: "FRENOS", label: "Frenos" },
  { value: "LIMPIABRISAS", label: "Limpiabrisas" },
  { value: "NIVELES", label: "Niveles de aceite, agua y frenos" },
  { value: "ASEO_INTERIOR", label: "Aseo interior" },
] as const;

export const EQUIPAMIENTO_ITEMS = [
  { value: "SOAT", label: "SOAT" },
  { value: "REVISION_TECNICO_MECANICA", label: "Revisión técnico-mecánica" },
  { value: "TARJETA_PROPIEDAD", label: "Tarjeta de propiedad" },
  { value: "EXTINTOR", label: "Extintor" },
  { value: "BOTIQUIN", label: "Botiquín" },
  { value: "KIT_CARRETERA", label: "Kit de carretera" },
  { value: "GATO", label: "Gato" },
  { value: "CRUCETA", label: "Cruceta" },
] as const;

export const NOVEDAD_TIPOS = [
  { value: "DANOS_NUEVOS", label: "Daños nuevos" },
  { value: "COMPARENDOS_INCIDENTES", label: "Comparendos o incidentes" },
] as const;

export const COMBUSTIBLE_NIVELES = [
  { value: "RESERVA", label: "Reserva" },
  { value: "1/4", label: "1/4" },
  { value: "1/2", label: "1/2" },
  { value: "3/4", label: "3/4" },
  { value: "LLENO", label: "Lleno" },
] as const;

export const ESTADO_EVALUACION = [
  { value: "BUENO", label: "Bueno" },
  { value: "REGULAR", label: "Regular" },
  { value: "MALO", label: "Malo" },
] as const;

export const TIPO_USO = [
  { value: "RUTA_EMPRESA", label: "Ruta de la empresa" },
  { value: "ALQUILER", label: "Alquiler" },
] as const;

export const TIPO_RECIBO = [
  { value: "COMBUSTIBLE", label: "Tanqueo" },
  { value: "PEAJE", label: "Peaje" },
  { value: "PAGO_CONDUCTOR", label: "Pago al conductor" },
] as const;

export const ESTADO_DANIO = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "DESCONTADO", label: "Descontado" },
  { value: "PAGADO", label: "Pagado" },
] as const;

export function labelDe(lista: readonly { value: string; label: string }[], value: string): string {
  return lista.find((x) => x.value === value)?.label ?? value;
}
