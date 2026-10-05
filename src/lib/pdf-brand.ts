import PDFDocument from "pdfkit";

export const BRAND = {
  verdeOscuro: "#1c281a",
  verdeHeader: "#263521",
  dorado: "#c9a23e",
  tierraTexto: "#46301f",
  grisTexto: "#52514e",
};

// Datos de contacto/registro del negocio, para que los comprobantes se vean completos
// cuando se le envían a un cliente o proveedor (igual a como aparecían en Treinta).
export const CONTACTO_NEGOCIO = {
  direccion: "Carrera 14 # 27 Norte - 80",
  telefono: "3124809415",
  email: "almadecampo.ventas@gmail.com",
  nit: "1092851991",
};

export function drawContacto(doc: PDFKit.PDFDocument) {
  const c = CONTACTO_NEGOCIO;
  doc.font("Helvetica").fontSize(9).fillColor(BRAND.grisTexto);
  doc.text(`${c.direccion}  ·  ${c.telefono}  ·  ${c.email}  ·  NIT ${c.nit}`, 50, doc.y);
  doc.moveDown(0.8);
}

export function drawHeader(doc: PDFKit.PDFDocument, subtitulo: string) {
  const pageWidth = doc.page.width;

  doc.rect(0, 0, pageWidth, 80).fill(BRAND.verdeHeader);
  doc
    .fillColor("#ffffff")
    .font("Times-Roman")
    .fontSize(26)
    .text("veragua", 50, 22);
  doc.rect(50, 52, 40, 2).fill(BRAND.dorado);
  doc
    .fillColor("#e8e4d8")
    .font("Helvetica")
    .fontSize(11)
    .text(subtitulo, 50, 58);

  doc.fillColor(BRAND.tierraTexto).font("Helvetica");
  doc.y = 100;
}

export function drawRow(doc: PDFKit.PDFDocument, label: string, value: string, opts?: { bold?: boolean; color?: string }) {
  const startX = 50;
  const width = doc.page.width - 100;
  doc
    .font(opts?.bold ? "Helvetica-Bold" : "Helvetica")
    .fillColor(opts?.color ?? BRAND.tierraTexto)
    .fontSize(opts?.bold ? 12 : 10.5)
    .text(label, startX, doc.y, { continued: true, width: width * 0.6 })
    .text(value, { align: "right", width: width * 0.4 });
  doc.moveDown(0.4);
}

function productoColumnas(doc: PDFKit.PDFDocument) {
  const startX = 50;
  const width = doc.page.width - 100;
  const wNombre = width * 0.46;
  const wCantidad = width * 0.16;
  const wPrecio = width * 0.19;
  const wValor = width * 0.19;
  return {
    nombre: { x: startX, w: wNombre },
    cantidad: { x: startX + wNombre, w: wCantidad },
    precio: { x: startX + wNombre + wCantidad, w: wPrecio },
    valor: { x: startX + wNombre + wCantidad + wPrecio, w: wValor },
  };
}

export function drawProductoHeader(doc: PDFKit.PDFDocument) {
  const startX = 50;
  const cols = productoColumnas(doc);
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND.grisTexto);
  doc.text("Producto", cols.nombre.x, y, { width: cols.nombre.w });
  doc.text("Cant.", cols.cantidad.x, y, { width: cols.cantidad.w, align: "right" });
  doc.text("Precio unit.", cols.precio.x, y, { width: cols.precio.w, align: "right" });
  doc.text("Valor", cols.valor.x, y, { width: cols.valor.w, align: "right" });
  doc.y = y;
  doc.moveDown(1);
  doc.moveTo(startX, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor("#e0dccb").lineWidth(0.5).stroke();
  doc.moveDown(0.3);
}

export function drawProductoRow(doc: PDFKit.PDFDocument, nombre: string, cantidad: number, precioUnitario: string, valor: string) {
  const cols = productoColumnas(doc);
  const y = doc.y;
  doc.font("Helvetica").fontSize(10).fillColor(BRAND.tierraTexto);
  const alturaNombre = doc.heightOfString(nombre, { width: cols.nombre.w });
  doc.text(nombre, cols.nombre.x, y, { width: cols.nombre.w });
  doc.text(String(cantidad), cols.cantidad.x, y, { width: cols.cantidad.w, align: "right" });
  doc.text(precioUnitario, cols.precio.x, y, { width: cols.precio.w, align: "right" });
  doc.text(valor, cols.valor.x, y, { width: cols.valor.w, align: "right" });
  doc.y = y + Math.max(alturaNombre, 12);
  doc.moveDown(0.3);
}

export function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.verdeHeader).text(title, 50, doc.y);
  doc.moveTo(50, doc.y + 2).lineTo(doc.page.width - 50, doc.y + 2).strokeColor("#e0dccb").lineWidth(1).stroke();
  doc.moveDown(0.5);
  doc.fillColor(BRAND.tierraTexto);
}

export function drawFooter(doc: PDFKit.PDFDocument, nota: string) {
  doc.moveDown(1.5);
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(BRAND.grisTexto)
    .text(nota, 50, doc.y, { width: doc.page.width - 100 });
  doc.text(`Generado el ${new Date().toLocaleDateString("es-CO")}`, 50, doc.y + 4);
}

export function newPdfBuffer(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  build(doc);
  doc.end();
  return done;
}
