import { getDocument, GlobalWorkerOptions, Util } from "pdfjs-dist/build/pdf.mjs";

const pdfWorkerUrl = "/pdf.worker.mjs?v=5.6.205";

let pdfWorker: Worker | null = null;

// Create the worker only when the user starts parsing a PDF. This keeps the
// worker out of server rendering and prevents PDF.js from falling back to a
// fake worker in the page context.
function ensurePdfWorker() {
  if (!pdfWorker) pdfWorker = new Worker(pdfWorkerUrl, { type: "module" });
  GlobalWorkerOptions.workerPort = pdfWorker;
}

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type ParsedProduct = {
  locId: number;
  sku: string;
  barcode?: string;
  name: string;
  markerX?: number | null;
  markerY?: number | null;
};

export type ParsedPlanogram = {
  products: ParsedProduct[];
  visual: {
    src: string;
    width: number;
    height: number;
    pageNumber: number;
    pageCount: number;
    markers: Array<{ locId: number; x: number; y: number }>;
  };
};

const headerWords = ["loc", "sku", "barcode", "ean", "item", "product", "description", "planogram", "pog", "page"];

function tidy(value: unknown) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/(\d{6,14})(?=\p{L})/gu, "$1 ").replace(/(\p{L})(\d{6,14})/gu, "$1 $2").replace(/\s+/g, " ").trim();
}

function isHeader(line: string) {
  const lower = line.toLowerCase();
  return headerWords.some((word) => lower.includes(word));
}

function isSku(value: string) { return /^\d{5,10}$/.test(value); }
function isBarcode(value: string) { return /^\d{11,15}$/.test(value); }
function isLocation(value: string) { return /^\d{1,4}$/.test(value); }

function cleanName(value: string) {
  return tidy(value.replace(/\b(?:EA|PCS|PC|UNIT|QTY|FACE|FACING|SHELF)\b/gi, ""));
}

function hasProductName(value: string) {
  return /\p{L}/u.test(value);
}

function groupLines(items: any[]) {
  const sorted = items.filter((item) => tidy(item.str)).map((item) => ({ str: String(item.str), x: item.transform[4], y: item.transform[5], width: item.width || 0 })).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Array<{ y: number; items: typeof sorted }> = [];
  for (const item of sorted) {
    const last = lines.at(-1);
    if (!last || Math.abs(last.y - item.y) > 3) lines.push({ y: item.y, items: [item] });
    else last.items.push(item);
  }
  return lines.map((line) => {
    const tokens = line.items.sort((a, b) => a.x - b.x);
    let text = "";
    let previous: (typeof tokens)[number] | null = null;
    for (const token of tokens) {
      if (previous && token.x - (previous.x + previous.width) > 2) text += " ";
      text += token.str;
      previous = token;
    }
    return tidy(text);
  }).filter(Boolean);
}

function adjacentLocation(tokens: string[], skuIndex: number) {
  // In a planogram product-list row, the shelf position is the short number
  // immediately before the product identifier / barcode. Never invent a
  // sequential number: it would point the customer to a different product.
  for (let index = skuIndex - 1; index >= Math.max(0, skuIndex - 5); index -= 1) {
    if (isLocation(tokens[index]) && Number(tokens[index]) > 0) return Number(tokens[index]);
  }
  return null;
}

function parseProducts(lines: string[]): ParsedProduct[] {
  const records: ParsedProduct[] = [];

  for (const line of lines) {
    if (!line || isHeader(line)) continue;
    const tokens = line.split(" ");
    const skuIndex = tokens.findIndex(isSku);
    const barcodeIndex = tokens.findIndex(isBarcode);
    if (skuIndex < 0 && barcodeIndex < 0) continue;
    const firstIdentifier = Math.min(skuIndex < 0 ? Number.MAX_SAFE_INTEGER : skuIndex, barcodeIndex < 0 ? Number.MAX_SAFE_INTEGER : barcodeIndex);
    const lastIdentifier = Math.max(skuIndex, barcodeIndex);
    const locId = adjacentLocation(tokens, firstIdentifier);
    const nameTokens = tokens.slice(lastIdentifier + 1);
    while (nameTokens.length && /^\d+(?:\.\d+)?$/.test(nameTokens.at(-1) || "")) nameTokens.pop();
    const name = cleanName(nameTokens.join(" "));
    const sku = skuIndex >= 0 ? tokens[skuIndex] : tokens[barcodeIndex];
    const barcode = barcodeIndex >= 0 ? tokens[barcodeIndex] : "";
    if (!name || !hasProductName(name) || !locId || !sku) continue;
    records.push({ locId, sku, barcode, name });
  }

  if (!records.length) {
    for (const line of lines) {
      if (!line || isHeader(line)) continue;
      const match = line.match(/(?:^|\s)(\d{1,4})\s+(\d{5,10})(?:\s+(\d{11,15}))?\s+(.+)$/);
      const name = cleanName(match?.[4] ?? "");
      if (!match || !Number(match[1]) || !hasProductName(name)) continue;
      records.push({ locId: Number(match[1]), sku: match[2], barcode: match[3] || "", name });
    }
  }

  const seen = new Set<string>();
  return records.filter((record) => {
    const key = `${record.locId}|${record.sku}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.locId - b.locId);
}

type Marker = { locId: number; x: number; y: number; fontSize: number };

function markerCandidates(items: any[], viewport: any): Marker[] {
  return items.map((item) => {
    const value = tidy(item.str);
    if (!isLocation(value)) return null;
    const transformed = Util.transform(viewport.transform, item.transform);
    const rect = viewport.convertToViewportRectangle([item.transform[4], item.transform[5], item.transform[4] + (item.width || 8), item.transform[5] + Math.max(Math.abs(item.transform?.[3]) || 0, 8)]);
    const x = (Math.min(rect[0], rect[2]) + Math.max(rect[0], rect[2])) / 2 / viewport.width;
    const y = (Math.min(rect[1], rect[3]) + Math.max(rect[1], rect[3])) / 2 / viewport.height;
    return { locId: Number(value), x: Math.min(.98, Math.max(.02, x)), y: Math.min(.98, Math.max(.02, y)), fontSize: Math.max(8, Math.abs(transformed[3]) || 0) };
  }).filter(Boolean) as Marker[];
}

function spreadScore(markers: Marker[]) {
  if (!markers.length) return 0;
  const xs = markers.map((marker) => marker.x);
  const ys = markers.map((marker) => marker.y);
  const xSpread = Math.max(...xs) - Math.min(...xs);
  const ySpread = Math.max(...ys) - Math.min(...ys);
  return xSpread * 90 + ySpread * 70 + xSpread * ySpread * 280 + markers.length * 2;
}

function selectMarkers(candidates: Marker[], validLocations: Set<number>) {
  const groups = new Map<number, Marker[]>();
  for (const marker of candidates) {
    if (!validLocations.has(marker.locId)) continue;
    groups.set(marker.locId, [...(groups.get(marker.locId) || []), marker]);
  }
  const selected = new Map<number, Marker>();
  for (const [locId, markers] of groups) selected.set(locId, markers.reduce((best, marker) => marker.fontSize > best.fontSize ? marker : best));

  for (let pass = 0; pass < 5; pass += 1) {
    for (const [locId, choices] of groups) {
      let best = selected.get(locId)!;
      let bestScore = spreadScore([...selected.values()]);
      for (const choice of choices) {
        const next = new Map(selected); next.set(locId, choice);
        const score = spreadScore([...next.values()]);
        if (score > bestScore) { best = choice; bestScore = score; }
      }
      selected.set(locId, best);
    }
  }
  return [...selected.values()];
}

async function renderPage(pdf: any, pageNumber: number) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.45 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Trình duyệt không thể tạo ảnh layout");
  await page.render({ canvasContext: context, viewport }).promise;
  return { src: canvas.toDataURL("image/jpeg", .9), width: canvas.width, height: canvas.height };
}

export async function extractPlanogramFromPdf(file: File): Promise<ParsedPlanogram> {
  ensurePdfWorker();
  const loading = getDocument({ data: await file.arrayBuffer() });
  const pdf = await loading.promise;

  try {
    const allLines: string[] = [];
    const pages: Array<{ pageNumber: number; candidates: Marker[] }> = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      allLines.push(...groupLines(content.items));
      pages.push({ pageNumber, candidates: markerCandidates(content.items, viewport) });
    }

    if (!allLines.length) throw new Error("PDF chỉ có ảnh scan và không có lớp chữ. Cần OCR trước hoặc dùng PDF xuất trực tiếp từ hệ thống planogram.");
    const products = parseProducts(allLines);
    if (!products.length) throw new Error("Không nhận diện được cột số vị trí, SKU và tên sản phẩm. Bạn có thể kiểm tra lại định dạng danh sách trong PDF.");

    const validLocations = new Set(products.map((product) => product.locId));
    const ranked = pages.map((page) => ({ ...page, markers: selectMarkers(page.candidates, validLocations) }))
      .sort((a, b) => b.markers.length - a.markers.length || spreadScore(b.markers) - spreadScore(a.markers));
    const chosen = ranked[0];
    if (!chosen || !chosen.markers.length) throw new Error("Đã đọc được danh sách nhưng không tìm thấy các số vị trí trên hình layout.");

    const rendered = await renderPage(pdf, chosen.pageNumber);
    const markerMap = new Map(chosen.markers.map((marker) => [marker.locId, marker]));
    return {
      products: products.map((product) => ({ ...product, markerX: markerMap.get(product.locId)?.x ?? null, markerY: markerMap.get(product.locId)?.y ?? null })),
      visual: { ...rendered, pageNumber: chosen.pageNumber, pageCount: pdf.numPages, markers: chosen.markers.map(({ locId, x, y }) => ({ locId, x, y })) },
    };
  } finally {
    try { pdf.cleanup(); } catch {}
    loading.destroy();
  }
}
