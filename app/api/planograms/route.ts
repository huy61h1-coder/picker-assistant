import { env } from "cloudflare:workers";

type ImportedProduct = {
  locId: number;
  sku: string;
  name: string;
  markerX?: number | null;
  markerY?: number | null;
};

type PlanogramImport = {
  id?: string;
  fileName?: string;
  lineId?: string;
  side?: string;
  products?: ImportedProduct[];
  width?: number;
  height?: number;
  pageNumber?: number;
  pageCount?: number;
};

const validUploadId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function ensureSchema() {
  const db = env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS planograms (
      id TEXT PRIMARY KEY,
      aisle_key TEXT NOT NULL UNIQUE,
      line_id TEXT NOT NULL,
      side TEXT NOT NULL,
      file_name TEXT NOT NULL,
      pdf_key TEXT NOT NULL,
      visual_key TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      page_number INTEGER NOT NULL DEFAULT 1,
      page_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS planogram_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      planogram_id TEXT NOT NULL,
      aisle_key TEXT NOT NULL,
      line_id TEXT NOT NULL,
      side TEXT NOT NULL,
      loc_id INTEGER NOT NULL,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      marker_x REAL,
      marker_y REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (planogram_id) REFERENCES planograms(id) ON DELETE CASCADE
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_planograms_aisle_key ON planograms(aisle_key)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_planogram_products_sku ON planogram_products(sku)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_planogram_products_aisle_loc ON planogram_products(aisle_key, loc_id)"),
  ]);
}

export async function GET() {
  try {
    await ensureSchema();
    const [planogramResult, productResult] = await Promise.all([
      env.DB.prepare("SELECT id, aisle_key, line_id, side, file_name, width, height, page_number, page_count, created_at FROM planograms ORDER BY created_at DESC").all(),
      env.DB.prepare("SELECT planogram_id, aisle_key, line_id, side, loc_id, sku, name, marker_x, marker_y FROM planogram_products ORDER BY aisle_key, loc_id").all(),
    ]);

    const planograms = planogramResult.results.map((row) => ({
      id: row.id,
      aisleKey: row.aisle_key,
      lineId: row.line_id,
      side: row.side,
      fileName: row.file_name,
      width: row.width,
      height: row.height,
      pageNumber: row.page_number,
      pageCount: row.page_count,
      createdAt: row.created_at,
      visualUrl: `/api/planograms/${row.id}/visual`,
      pdfUrl: `/api/planograms/${row.id}/pdf`,
    }));

    const byId = new Map(planograms.map((item) => [item.id, item]));
    const products = productResult.results.map((row) => {
      const planogram = byId.get(String(row.planogram_id));
      return {
        planogramId: row.planogram_id,
        aisle: row.aisle_key,
        lineId: row.line_id,
        side: row.side,
        locId: row.loc_id,
        sku: row.sku,
        name: row.name,
        markerX: row.marker_x,
        markerY: row.marker_y,
        visualUrl: planogram?.visualUrl,
        pdfUrl: planogram?.pdfUrl,
        visualWidth: planogram?.width,
        visualHeight: planogram?.height,
        pageNumber: planogram?.pageNumber,
        verified: true,
        category: "Dữ liệu nhập từ PDF",
      };
    });

    return Response.json({ planograms, products });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không đọc được dữ liệu PDF" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const payload = await request.json() as PlanogramImport;
    const id = String(payload.id || "");
    const fileName = String(payload.fileName || "planogram.pdf").replace(/[\r\n"]/g, "").slice(0, 240);
    const lineId = String(payload.lineId || "").toUpperCase().replace(/[^L0-9]/g, "");
    const side = String(payload.side || "A").toUpperCase().replace(/[^AB]/g, "") || "A";
    const aisleKey = `${lineId}-${side}`;
    const products = Array.isArray(payload.products) ? payload.products : [];
    const width = Math.max(1, Number(payload.width) || 1);
    const height = Math.max(1, Number(payload.height) || 1);
    const pageNumber = Math.max(1, Number(payload.pageNumber) || 1);
    const pageCount = Math.max(1, Number(payload.pageCount) || 1);

    if (!validUploadId.test(id)) {
      return Response.json({ error: "Mã phiên tải lên chưa hợp lệ" }, { status: 400 });
    }
    if (!/^L(?:[1-9]|1\d|2[0-8])$/.test(lineId)) {
      return Response.json({ error: "Line phải nằm trong khoảng L1-L28" }, { status: 400 });
    }
    if (!products.length || products.some((item) => !item.sku || !item.name || !Number.isFinite(Number(item.locId)))) {
      return Response.json({ error: "Danh sách sản phẩm chưa hợp lệ" }, { status: 400 });
    }

    const pdfKey = `planograms/${id}/source.pdf`;
    const visualKey = `planograms/${id}/layout.jpg`;
    const now = new Date().toISOString();
    const old = await env.DB.prepare("SELECT id, pdf_key, visual_key FROM planograms WHERE aisle_key = ?").bind(aisleKey).first<Record<string, string>>();
    const [storedPdf, storedVisual] = await Promise.all([env.FILES.head(pdfKey), env.FILES.head(visualKey)]);

    if (!storedPdf || !storedVisual) {
      return Response.json({ error: "PDF hoặc ảnh layout chưa tải lên hoàn tất" }, { status: 400 });
    }

    const statements = [];
    if (old?.id) {
      statements.push(env.DB.prepare("DELETE FROM planogram_products WHERE planogram_id = ?").bind(old.id));
      statements.push(env.DB.prepare("DELETE FROM planograms WHERE id = ?").bind(old.id));
    }
    statements.push(env.DB.prepare(`INSERT INTO planograms
      (id, aisle_key, line_id, side, file_name, pdf_key, visual_key, width, height, page_number, page_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, aisleKey, lineId, side, fileName, pdfKey, visualKey, width, height, pageNumber, pageCount, now));
    await env.DB.batch(statements);

    const inserts = products.map((product) => env.DB.prepare(`INSERT INTO planogram_products
      (planogram_id, aisle_key, line_id, side, loc_id, sku, name, marker_x, marker_y, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, aisleKey, lineId, side, Number(product.locId), String(product.sku).trim(), String(product.name).trim(), product.markerX ?? null, product.markerY ?? null, now));
    for (let index = 0; index < inserts.length; index += 75) {
      await env.DB.batch(inserts.slice(index, index + 75));
    }
    await env.DB.prepare("PRAGMA optimize").run();

    if (old?.id && old.id !== id) {
      if (old.pdf_key) await env.FILES.delete(old.pdf_key);
      if (old.visual_key) await env.FILES.delete(old.visual_key);
    }

    return Response.json({ id, aisleKey, productCount: products.length }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể lưu PDF" }, { status: 500 });
  }
}
