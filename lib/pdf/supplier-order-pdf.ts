import PDFDocument from "pdfkit";

export type SupplierAddress = {
  name: string;
  email: string;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
};

export type SupplierOrderPdfLine = {
  productName: string;
  articleCode: string;
  variantSegment: "youth" | "adult";
  sizeLabel: string;
  quantity: number;
};

function safe(s: unknown): string {
  return String(s ?? "").trim();
}

export async function buildSupplierOrderPdf(params: {
  orderId: string;
  orderDate: string;
  supplier: SupplierAddress;
  note?: string | null;
  lines: SupplierOrderPdfLine[];
}): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));

  const title = "Leveranciersbestelling";
  doc.fontSize(18).font("Helvetica-Bold").text(title);
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica").fillColor("#444");
  doc.text(`Orderdatum: ${safe(params.orderDate)}`);
  doc.text(`Order ID: ${safe(params.orderId)}`);
  doc.moveDown();

  doc.fillColor("#000").font("Helvetica-Bold").text("Leverancier");
  doc.font("Helvetica").fontSize(10);
  doc.text(safe(params.supplier.name));
  if (params.supplier.address_line1) doc.text(safe(params.supplier.address_line1));
  if (params.supplier.address_line2) doc.text(safe(params.supplier.address_line2));
  const pcCity = [safe(params.supplier.postal_code), safe(params.supplier.city)].filter(Boolean).join(" ");
  if (pcCity) doc.text(pcCity);
  if (params.supplier.country) doc.text(safe(params.supplier.country));
  doc.text(`E-mail: ${safe(params.supplier.email)}`);
  if (params.supplier.phone) doc.text(`Telefoon: ${safe(params.supplier.phone)}`);
  doc.moveDown();

  if (params.note && safe(params.note)) {
    doc.font("Helvetica-Bold").text("Opmerking");
    doc.font("Helvetica").text(safe(params.note));
    doc.moveDown();
  }

  // Table header
  const startX = doc.x;
  let y = doc.y + 6;
  const col = {
    product: startX,
    code: startX + 240,
    variant: startX + 340,
    size: startX + 405,
    qty: startX + 460
  };

  doc.font("Helvetica-Bold").fontSize(10);
  doc.text("Product", col.product, y, { width: 235 });
  doc.text("Artikel", col.code, y, { width: 95 });
  doc.text("Variant", col.variant, y, { width: 60 });
  doc.text("Maat", col.size, y, { width: 50 });
  doc.text("Aantal", col.qty, y, { width: 60, align: "right" });
  y += 18;
  doc.moveTo(startX, y).lineTo(startX + 500, y).strokeColor("#ddd").stroke();
  y += 8;

  doc.font("Helvetica").fontSize(10).fillColor("#000");

  const lines = [...params.lines].sort((a, b) => {
    const c = a.productName.localeCompare(b.productName, "nl");
    if (c !== 0) return c;
    const v = a.variantSegment.localeCompare(b.variantSegment);
    if (v !== 0) return v;
    return a.sizeLabel.localeCompare(b.sizeLabel, "nl");
  });

  for (const l of lines) {
    if (y > 760) {
      doc.addPage();
      y = doc.y;
    }
    doc.text(safe(l.productName), col.product, y, { width: 235 });
    doc.text(safe(l.articleCode), col.code, y, { width: 95 });
    doc.text(l.variantSegment === "youth" ? "YOUTH" : "ADULT", col.variant, y, { width: 60 });
    doc.text(safe(l.sizeLabel), col.size, y, { width: 50 });
    doc.text(String(l.quantity), col.qty, y, { width: 60, align: "right" });
    y += 16;
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    doc.on("end", () => resolve());
    doc.on("error", (err) => reject(err));
  });

  return Buffer.concat(chunks);
}

