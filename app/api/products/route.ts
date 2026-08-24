import { env } from "cloudflare:workers";

type ProductInput = {
  sku?: string;
  barcode?: string;
  name?: string;
  line?: string;
  locId?: number | null;
  price?: number;
  stock?: number;
  loss?: number;
  expDate?: string;
};

const seedProducts: Required<Omit<ProductInput, "locId"> & { locId: number }>[] = [
  { sku: "10531914", barcode: "45497410531914", name: "HC TẤM TRẢI LÀM MÁT ICECOLD 160X200GY", line: "12", locId: 1, price: 450000, stock: 5, loss: 0, expDate: "2026-12-31" },
  { sku: "10763049", barcode: "45497410763049", name: "HC GỐI MOCHI PILLOW BE", line: "12", locId: 5, price: 185000, stock: 45, loss: 2, expDate: "2026-06-15" },
  { sku: "8969583", barcode: "8801260418800", name: "BVS SOONSOOHANMYEON 23CM 18 MIẾNG", line: "16", locId: 18, price: 45000, stock: 0, loss: 0, expDate: "2027-01-10" },
];

function cleanSku(value: unknown) {
  return String(value ?? "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 40);
}

function cleanLine(value: unknown) {
  const match = String(value ?? "").match(/\d{1,2}/);
  const line = Number(match?.[0]);
  return line >= 1 && line <= 28 ? String(line).padStart(2, "0") : "DAILY";
}

async function ensureSchema() {
  const db = env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS master_products (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      barcode TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      line TEXT NOT NULL,
      loc_id INTEGER,
      price INTEGER NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      loss INTEGER NOT NULL DEFAULT 0,
      exp_date TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_master_products_sku ON master_products(sku)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_master_products_line ON master_products(line)"),
  ]);

  const count = await db.prepare("SELECT COUNT(*) AS count FROM master_products").first<{ count: number }>();
  if (Number(count?.count ?? 0) === 0) {
    const now = new Date().toISOString();
    await db.batch(seedProducts.map((product) => db.prepare(`INSERT INTO master_products
      (id, sku, barcode, name, line, loc_id, price, stock, loss, exp_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), product.sku, product.barcode, product.name, product.line, product.locId, product.price, product.stock, product.loss, product.expDate, now)));
  }
}

function mapProduct(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    sku: String(row.sku),
    barcode: String(row.barcode ?? ""),
    name: String(row.name),
    line: String(row.line),
    locId: row.loc_id == null ? null : Number(row.loc_id),
    price: Number(row.price ?? 0),
    stock: Number(row.stock ?? 0),
    loss: Number(row.loss ?? 0),
    expDate: String(row.exp_date ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function GET() {
  try {
    await ensureSchema();
    const result = await env.DB.prepare("SELECT * FROM master_products ORDER BY CAST(line AS INTEGER), name").all<Record<string, unknown>>();
    return Response.json({ products: result.results.map(mapProduct) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không đọc được Master Data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json() as { products?: ProductInput[]; line?: string };
    const products = Array.isArray(body.products) ? body.products : [];
    if (!products.length) return Response.json({ error: "Danh sách sản phẩm trống" }, { status: 400 });
    const now = new Date().toISOString();
    const statements = products.map((product) => {
      const sku = cleanSku(product.sku);
      const name = String(product.name ?? "").trim().slice(0, 500);
      if (!sku || !name) throw new Error("SKU hoặc tên sản phẩm chưa hợp lệ");
      return env.DB.prepare(`INSERT INTO master_products
        (id, sku, barcode, name, line, loc_id, price, stock, loss, exp_date, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(sku) DO UPDATE SET
          barcode = CASE WHEN excluded.barcode <> '' THEN excluded.barcode ELSE master_products.barcode END,
          name = excluded.name,
          line = excluded.line,
          loc_id = excluded.loc_id,
          updated_at = excluded.updated_at`)
        .bind(crypto.randomUUID(), sku, String(product.barcode ?? "").slice(0, 40), name, cleanLine(product.line ?? body.line), product.locId ?? null, Math.max(0, Number(product.price ?? 0)), Math.max(0, Number(product.stock ?? 0)), Math.max(0, Number(product.loss ?? 0)), String(product.expDate ?? "").slice(0, 10), now);
    });
    for (let index = 0; index < statements.length; index += 75) await env.DB.batch(statements.slice(index, index + 75));
    await env.DB.prepare("PRAGMA optimize").run();
    return Response.json({ imported: statements.length }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể đồng bộ Master Data" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json() as ProductInput;
    const sku = cleanSku(body.sku);
    const current = await env.DB.prepare("SELECT * FROM master_products WHERE sku = ?").bind(sku).first<Record<string, unknown>>();
    if (!current) return Response.json({ error: "Không tìm thấy sản phẩm" }, { status: 404 });
    const next = {
      barcode: body.barcode == null ? String(current.barcode ?? "") : String(body.barcode).slice(0, 40),
      name: body.name == null ? String(current.name) : String(body.name).trim().slice(0, 500),
      line: body.line == null ? String(current.line) : cleanLine(body.line),
      locId: body.locId === undefined ? current.loc_id : body.locId,
      price: body.price === undefined ? Number(current.price) : Math.max(0, Number(body.price) || 0),
      stock: body.stock === undefined ? Number(current.stock) : Math.max(0, Math.trunc(Number(body.stock) || 0)),
      loss: body.loss === undefined ? Number(current.loss) : Math.max(0, Math.trunc(Number(body.loss) || 0)),
      expDate: body.expDate === undefined ? String(current.exp_date ?? "") : String(body.expDate).slice(0, 10),
    };
    const now = new Date().toISOString();
    await env.DB.prepare(`UPDATE master_products SET barcode = ?, name = ?, line = ?, loc_id = ?, price = ?, stock = ?, loss = ?, exp_date = ?, updated_at = ? WHERE sku = ?`)
      .bind(next.barcode, next.name, next.line, next.locId ?? null, next.price, next.stock, next.loss, next.expDate, now, sku).run();
    const updated = await env.DB.prepare("SELECT * FROM master_products WHERE sku = ?").bind(sku).first<Record<string, unknown>>();
    return Response.json({ product: mapProduct(updated!) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể cập nhật sản phẩm" }, { status: 500 });
  }
}
