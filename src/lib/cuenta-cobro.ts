import { BRAND } from "@/lib/pdf-brand";

/** Quién cobra y a dónde se paga — sale tal cual en cada cuenta de cobro. */
export const EMISOR = {
  nombre: "Manuela Botero Villa",
  negocio: "Veragua",
  nit: "1.092.851.991-0",
  cedula: "1.092.851.991",
  direccion: "Carrera 14 # 27 Norte - 80, local 109, Armenia",
  email: "admin@veraguaalimentos.com",
  ciudad: "Armenia",
  cuentas: [
    ["Davivienda", "Ahorros N.º 488451607904"],
    ["Bancolombia", "Ahorros N.º 75634264469"],
    ["Nequi", "311 324 9937"],
    ["Llave Bre-B", "@manuela99102"],
  ] as const,
};

const formatCOP = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function hasta999(n: number): string {
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const r = n % 100;
  let t = CENTENAS[c];
  if (r > 0) {
    if (t) t += " ";
    t += r < 30 ? UNIDADES[r] : DECENAS[Math.floor(r / 10)] + (r % 10 ? ` y ${UNIDADES[r % 10]}` : "");
  }
  return t;
}

/** "uno" → "un" y "veintiuno" → "veintiún" cuando va antes de "mil"/"millones". */
function apocopar(t: string): string {
  return t.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");
}

export function numeroALetras(n: number): string {
  n = Math.round(n);
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? "un millón" : `${apocopar(hasta999(millones))} millones`);
  if (miles) partes.push(miles === 1 ? "mil" : `${apocopar(hasta999(miles))} mil`);
  if (resto) partes.push(hasta999(resto));
  return partes.join(" ");
}

export function fechaLarga(d: Date): string {
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** "del 1 al 30 de septiembre de 2026", "del 28 de septiembre al 3 de octubre de 2026" o "el 29 de septiembre de 2026". */
export function descripcionPeriodo(desde: Date, hasta: Date): string {
  if (desde.getTime() === hasta.getTime()) return `el ${fechaLarga(desde)}`;
  const mismoMes = desde.getUTCMonth() === hasta.getUTCMonth() && desde.getUTCFullYear() === hasta.getUTCFullYear();
  return mismoMes
    ? `del ${desde.getUTCDate()} al ${fechaLarga(hasta)}`
    : `del ${desde.getUTCDate()} de ${MESES[desde.getUTCMonth()]} al ${fechaLarga(hasta)}`;
}

function fechaCorta(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export type CuentaCobroData = {
  numero: number;
  fechaEmision: Date;
  cliente: { nombre: string; empresa: string | null; nit: string | null; direccion: string; telefono: string | null };
  desde: Date;
  hasta: Date;
  filas: { fecha: Date; producto: string; cantidad: number; precio: number }[];
};

const CREMA = "#f9f7f2";
const BEIGE = "#f0ebdf";

/** Dibuja la cuenta de cobro completa (logo, partes, detalle, forma de pago). */
export function drawCuentaCobro(doc: PDFKit.PDFDocument, data: CuentaCobroData, logo: Buffer | null) {
  const left = 50;
  const pw = doc.page.width;
  const right = pw - 50;
  const width = right - left;

  const pintarFondo = () => doc.rect(0, 0, pw, doc.page.height).fill(CREMA);
  pintarFondo();
  doc.on("pageAdded", pintarFondo);

  // Encabezado: logo a la izquierda, título y fecha a la derecha
  const logoW = 150;
  let logoBottom = 100;
  if (logo) {
    doc.image(logo, left, 40, { width: logoW });
    logoBottom = 40 + logoW * (473 / 520);
  } else {
    doc.font("Times-Roman").fontSize(30).fillColor(BRAND.verdeHeader).text("veragua", left, 60);
  }
  doc.font("Times-Roman").fontSize(27).fillColor(BRAND.verdeOscuro).text("CUENTA DE COBRO", left, 65, { width, align: "right" });
  doc.font("Helvetica-Bold").fontSize(15).fillColor(BRAND.dorado).text(`N.º ${String(data.numero).padStart(3, "0")}`, left, 102, { width, align: "right" });
  doc.font("Helvetica").fontSize(10.5).fillColor(BRAND.grisTexto).text(`${EMISOR.ciudad}, ${fechaLarga(data.fechaEmision)}`, left, 128, { width, align: "right" });

  const linea = (y: number) => doc.moveTo(left, y).lineTo(right, y).lineWidth(1).strokeColor(BRAND.dorado).stroke();
  let y = Math.max(logoBottom + 12, 175);
  linea(y);

  // Cliente / Debe a
  y += 14;
  const colW = width / 2 - 10;
  const bloque = (x: number, titulo: string, nombre: string, lineas: string[]) => {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND.dorado).text(titulo, x, y, { width: colW });
    doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.verdeOscuro).text(nombre, x, y + 16, { width: colW });
    let ly = doc.y + 3;
    doc.font("Helvetica").fontSize(10).fillColor(BRAND.grisTexto);
    for (const l of lineas) {
      doc.text(l, x, ly, { width: colW });
      ly = doc.y + 1;
    }
    return ly;
  };
  const c = data.cliente;
  const yIzq = bloque(left, "CLIENTE", c.nombre, [
    ...(c.empresa ? [c.empresa] : []),
    ...(c.nit ? [`NIT ${c.nit}`] : []),
    ...(c.direccion ? [c.direccion] : []),
    ...(c.telefono ? [`Tel. ${c.telefono}`] : []),
  ]);
  const yDer = bloque(left + width / 2 + 10, "DEBE A", EMISOR.nombre, [EMISOR.negocio, `NIT ${EMISOR.nit}`, EMISOR.direccion, EMISOR.email]);
  y = Math.max(yIzq, yDer) + 10;
  linea(y);

  // Texto con el valor en letras
  const total = data.filas.reduce((s, f) => s + f.cantidad * f.precio, 0);
  y += 16;
  doc.font("Helvetica").fontSize(11).fillColor(BRAND.verdeOscuro);
  doc.text("La suma de ", left, y, { width, continued: true });
  doc.font("Helvetica-Bold").text(`${numeroALetras(total).toUpperCase()} PESOS M/CTE (${formatCOP(total)})`, { continued: true });
  doc.font("Helvetica").text(` por la venta de productos ${data.desde.getTime() === data.hasta.getTime() ? "" : "del periodo "}${descripcionPeriodo(data.desde, data.hasta)}, según el detalle que se relaciona:`);
  y = doc.y + 14;

  // Tabla
  const col = { fecha: left + 12, producto: left + 92, cant: left + 300, precio: left + 345, valor: left + 420 };
  const encabezado = () => {
    doc.rect(left, y, width, 26).fill(BRAND.verdeOscuro);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff");
    doc.text("Fecha", col.fecha, y + 8);
    doc.text("Producto", col.producto, y + 8);
    doc.text("Cant.", col.cant, y + 8, { width: 35, align: "right" });
    doc.text("Precio unit.", col.precio, y + 8, { width: 65, align: "right" });
    doc.text("Valor", col.valor, y + 8, { width: right - col.valor - 12, align: "right" });
    y += 26;
  };
  encabezado();
  for (const f of data.filas) {
    doc.font("Helvetica").fontSize(10);
    const altoProducto = doc.heightOfString(f.producto, { width: 245 });
    const alto = Math.max(24, altoProducto + 12);
    if (y + alto > doc.page.height - 110) {
      doc.addPage();
      y = 50;
      encabezado();
    }
    doc.fillColor(BRAND.verdeOscuro);
    doc.text(fechaCorta(f.fecha), col.fecha, y + 7);
    doc.text(f.producto, col.producto, y + 7, { width: 245 });
    doc.text(String(f.cantidad), col.cant, y + 7, { width: 35, align: "right" });
    doc.text(formatCOP(f.precio), col.precio, y + 7, { width: 65, align: "right" });
    doc.text(formatCOP(f.cantidad * f.precio), col.valor, y + 7, { width: right - col.valor - 12, align: "right" });
    y += alto;
    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor("#dcd6c8").stroke();
  }
  // Total
  doc.moveTo(col.precio, y).lineTo(right, y).lineWidth(1.2).strokeColor(BRAND.dorado).stroke();
  doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.verdeOscuro);
  doc.text("TOTAL", col.precio, y + 10, { width: 65, align: "right" });
  doc.text(formatCOP(total), col.valor, y + 10, { width: right - col.valor - 12, align: "right" });
  y += 40;

  // Notas
  const exentoIva = data.filas.every((f) => /huevo/i.test(f.producto));
  const notas = [
    ...(exentoIva ? ["Producto exento de IVA (huevos frescos, art. 477 del Estatuto Tributario)."] : []),
    "Declaro que no soy responsable de IVA y no estoy obligada a expedir factura electrónica. Se adjunta copia del RUT.",
  ];
  const altoPago = 40 + EMISOR.cuentas.length * 24 + notas.length * 16;
  if (y + altoPago > doc.page.height - 50) {
    doc.addPage();
    y = 50;
  }
  doc.font("Helvetica").fontSize(9.5).fillColor(BRAND.grisTexto);
  for (const n of notas) {
    doc.text(`•  ${n}`, left, y, { width });
    y = doc.y + 3;
  }

  // Forma de pago
  y += 12;
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(BRAND.dorado).text("FORMA DE PAGO", left, y);
  y += 16;
  doc.font("Helvetica").fontSize(10.5).fillColor(BRAND.verdeOscuro).text(`Transferencia a nombre de ${EMISOR.nombre}, C.C. ${EMISOR.cedula}, a cualquiera de estas cuentas:`, left, y, { width });
  y = doc.y + 8;
  const cajaH = EMISOR.cuentas.length * 24 + 8;
  doc.rect(left, y, 400, cajaH).fill(BEIGE);
  EMISOR.cuentas.forEach(([banco, cuenta], i) => {
    const ry = y + 10 + i * 24;
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(BRAND.verdeOscuro).text(banco, left + 14, ry, { width: 150 });
    doc.font("Helvetica").text(cuenta, left + 190, ry, { width: 200 });
  });
}
