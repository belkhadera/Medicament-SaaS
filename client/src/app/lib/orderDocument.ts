import type { PurchaseOrder, PurchaseOrderStatus } from "../../services/purchaseOrder.service";
import { formatCurrency } from "./inventoryStats";

/**
 * Build a printable "Bon de commande" (purchase-order voucher) as a standalone
 * HTML document and open it in a print window, so the user can Save as PDF /
 * print it. The document carries the full order details PLUS a scannable Code
 * 128 BARCODE of the order id — the same code the receiving scanner reads to
 * stock the goods.
 *
 * The barcode is encoded here by hand: @zxing/library ships only a QR writer
 * (1D writers are compiled out), and adding a barcode package isn't possible in
 * this environment. The scanner reads Code 128 natively via BrowserMultiFormatReader.
 */

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  draft: "Brouillon",
  ordered: "Commandé",
  partial: "Partiel",
  received: "Reçu / Livré",
  cancelled: "Annulé",
};

const supplierName = (po: PurchaseOrder) =>
  typeof po.supplierId === "object" && po.supplierId ? po.supplierId.name : "—";
const medName = (m: any) => (typeof m === "object" && m ? m.name : String(m));

// --- Code 128 (subset B) barcode ------------------------------------------
// Standard module-width patterns for symbol values 0..106 (each: bar/space
// widths, summing to 11 modules; the stop code 106 has the 7-element pattern
// with its terminating bar).
const CODE128_PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112",
];
const START_B = 104;
const STOP = 106;

/** Concatenated bar/space width string for the Code 128-B encoding of `data`. */
function encodeCode128B(data: string): string {
  let checksum = START_B;
  let widths = CODE128_PATTERNS[START_B];
  for (let i = 0; i < data.length; i++) {
    const value = data.charCodeAt(i) - 32; // subset B: ASCII 32..126 -> 0..94
    if (value < 0 || value > 94) continue; // skip anything outside printable ASCII
    widths += CODE128_PATTERNS[value];
    checksum += value * (i + 1);
  }
  widths += CODE128_PATTERNS[checksum % 103];
  widths += CODE128_PATTERNS[STOP];
  return widths;
}

/**
 * Render the order id as a scannable Code 128 <svg> string. Bars start first;
 * widths alternate bar/space. A 10-module quiet zone pads each side.
 */
function barcodeSvg(orderId: string, moduleWidth = 2, barHeight = 70): string {
  const widths = encodeCode128B(orderId);
  const quiet = 10;
  let totalModules = quiet * 2;
  for (const ch of widths) totalModules += Number(ch);
  const width = totalModules * moduleWidth;

  const rects: string[] = [];
  let x = quiet;
  let isBar = true;
  for (const ch of widths) {
    const w = Number(ch);
    if (isBar) {
      rects.push(`<rect x="${x * moduleWidth}" y="0" width="${w * moduleWidth}" height="${barHeight}" />`);
    }
    x += w;
    isBar = !isBar;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${barHeight}" viewBox="0 0 ${width} ${barHeight}" shape-rendering="crispEdges">
    <rect x="0" y="0" width="${width}" height="${barHeight}" fill="#fff" />
    <g fill="#000">${rects.join("")}</g>
  </svg>`;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export function printPurchaseOrderDoc(order: PurchaseOrder): void {
  const created = order.createdAt ? new Date(order.createdAt).toLocaleString("fr-FR") : "—";
  const rows = order.lines
    .map((l) => {
      const total = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
      return `<tr>
        <td>${esc(medName(l.medicationId))}</td>
        <td class="num">${esc(l.quantity)}</td>
        <td class="num">${esc(formatCurrency(Number(l.unitPrice) || 0))}</td>
        <td class="num">${esc(formatCurrency(total))}</td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" />
<title>Bon de commande ${esc(order.reference)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 32px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #64748b; font-size: 13px; }
  .meta { margin-top: 16px; font-size: 14px; line-height: 1.7; }
  .meta b { display: inline-block; min-width: 130px; color: #334155; }
  .code-box { text-align: center; }
  .code-box svg { display: block; margin: 0 auto; }
  .code-box .code { font-family: monospace; font-size: 14px; margin-top: 6px; letter-spacing: 1px; }
  .code-box .hint { font-size: 11px; color: #64748b; max-width: 240px; margin: 6px auto 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 14px; }
  th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
  th { background: #f1f5f9; }
  td.num, th.num { text-align: right; }
  tfoot td { font-weight: bold; background: #f8fafc; }
  .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  @media print { body { margin: 12mm; } }
</style></head>
<body>
  <div class="head">
    <div>
      <h1>Bon de commande</h1>
      <div class="muted">${esc(order.reference)}</div>
      <div class="meta">
        <div><b>Fournisseur :</b> ${esc(supplierName(order))}</div>
        <div><b>Statut :</b> ${esc(STATUS_LABEL[order.status] ?? order.status)}</div>
        <div><b>Créée le :</b> ${esc(created)}</div>
      </div>
    </div>
    <div class="code-box">
      ${barcodeSvg(order.orderId)}
      <div class="code">${esc(order.orderId)}</div>
      <div class="hint">Scannez ce code-barres à la réception pour mettre la marchandise en stock.</div>
    </div>
  </div>

  <table>
    <thead><tr>
      <th>Médicament</th><th class="num">Quantité</th><th class="num">Prix unitaire</th><th class="num">Total ligne</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="3" class="num">Total de la commande</td>
      <td class="num">${esc(formatCurrency(Number(order.totalCost) || 0))}</td>
    </tr></tfoot>
  </table>

  <div class="footer">Document généré le ${esc(new Date().toLocaleString("fr-FR"))} — code de commande : ${esc(order.orderId)}</div>

  <script>window.onload = function () { window.focus(); window.print(); };</script>
</body></html>`;

  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
