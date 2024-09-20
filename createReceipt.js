import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create receipts directory if it doesn't exist
const receiptsDir = path.join(__dirname, 'receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir);
}

export async function createReceipt(receipt, filename) {
  const filePath = path.join(receiptsDir, filename);
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  // Create a promise to handle the completion of the PDF generation
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(filePath);

    writeStream.on('finish', () => {
      resolve(filePath);
    });

    writeStream.on('error', (error) => {
      reject(error);
    });

    doc.pipe(writeStream);

    generateHeader(doc);
    generateCustomerInformation(doc, receipt);
    generateReceiptTable(doc, receipt);
    generateFooter(doc);

    doc.end(); // End the PDF generation
  });
}

function generateHeader(doc) {
  doc
    .image("logo.png", 50, 45, { width: 150 })
    .fillColor("#444444")
    .fontSize(10)
    .text("fashionCulture Inc.", 200, 50, { align: "right" })
    .text("123 Street Avenue", 200, 65, { align: "right" })
    .text("New York, NY, 10025", 200, 80, { align: "right" })
    .moveDown();
}

function generateCustomerInformation(doc, receipt) {
  doc
    .fillColor("#444444")
    .fontSize(20)
    .text("Receipt", 50, 160);

  generateHr(doc, 185);

  const customerInformationTop = 200;

  doc
    .fontSize(10)
    .text("Receipt Number:", 50, customerInformationTop)
    .font("Helvetica-Bold")
    .text(receipt.receipt_nr, 150, customerInformationTop)
    .font("Helvetica")
    .text("Receipt Date:", 50, customerInformationTop + 15)
    .text(formatDate(new Date()), 150, customerInformationTop + 15)
    .text("Total:", 50, customerInformationTop + 30)
    .text(formatCurrency(receipt.total), 150, customerInformationTop + 30)

    .font("Helvetica-Bold")
    .text(receipt.name, 300, customerInformationTop)
    .font("Helvetica")
    .text(receipt.address, 300, customerInformationTop + 15)
    .text(receipt.city)
    .text(receipt.phone)
    .moveDown();

  generateHr(doc, 252);
}

function generateReceiptTable(doc, receipt) {
  let i;
  const receiptTableTop = 330;

  doc.font("Helvetica-Bold");
  generateTableRow(
    doc,
    receiptTableTop,
    "Item",
    "Size",
    "Color",
    "Unit Cost",
    "Quantity",
    "Line Total"
  );
  generateHr(doc, receiptTableTop + 20);
  doc.font("Helvetica");

  for (i = 0; i < receipt.items.length; i++) {
    const item = receipt.items[i];
    const position = receiptTableTop + (i + 1) * 30;
    generateTableRow(
      doc,
      position,
      item.title,
      item.size,
      item.color,
      formatCurrency(item.price / item.quantity),
      item.quantity,
      formatCurrency(item.price)
    );

    generateHr(doc, position + 20);
  }

  const subtotalPosition = receiptTableTop + (i + 1) * 30;
  generateTableRow(
    doc,
    subtotalPosition,
    "",
    "",
    "",
    "",
    "Subtotal",
    formatCurrency(receipt.total)
  );

  const paidToDatePosition = subtotalPosition + 20;
  generateTableRow(
    doc,
    paidToDatePosition,
    "",
    "",
    "",
    "",
    "Total",
    formatCurrency(receipt.total)
  );
}

function generateFooter(doc) {
}

function generateTableRow(
  doc,
  y,
  item,
  size,
  color,
  unitCost,
  quantity,
  lineTotal
) {
  doc
    .fontSize(10)
    .text(item, 50, y)
    .text(size.charAt(0).toUpperCase(), 300, y)
    .text(color.charAt(0).toUpperCase() + color.slice(1), 330, y)
    .text(unitCost, 340, y, { width: 90, align: "right" })
    .text(quantity, 390, y, { width: 90, align: "right" })
    .text(lineTotal, 400, y, { align: "right" });
}

function generateHr(doc, y) {
  doc
    .strokeColor("#aaaaaa")
    .lineWidth(1)
    .moveTo(50, y)
    .lineTo(550, y)
    .stroke();
}

function formatCurrency(cents) {
  return "$" + (cents);
}

function formatDate(date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return year + "/" + month + "/" + day;
}
