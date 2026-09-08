import PDFDocument from "pdfkit";

export const BRAND = {
  verdeOscuro: "#1c281a",
  verdeHeader: "#263521",
  dorado: "#c9a23e",
  tierraTexto: "#46301f",
  grisTexto: "#52514e",
};

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
