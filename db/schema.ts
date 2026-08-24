import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const planograms = sqliteTable(
  "planograms",
  {
    id: text("id").primaryKey(),
    aisleKey: text("aisle_key").notNull(),
    lineId: text("line_id").notNull(),
    side: text("side").notNull(),
    fileName: text("file_name").notNull(),
    pdfKey: text("pdf_key").notNull(),
    visualKey: text("visual_key").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    pageNumber: integer("page_number").notNull().default(1),
    pageCount: integer("page_count").notNull().default(1),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("idx_planograms_aisle_key").on(table.aisleKey)],
);

export const planogramProducts = sqliteTable(
  "planogram_products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    planogramId: text("planogram_id").notNull().references(() => planograms.id, { onDelete: "cascade" }),
    aisleKey: text("aisle_key").notNull(),
    lineId: text("line_id").notNull(),
    side: text("side").notNull(),
    locId: integer("loc_id").notNull(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    markerX: real("marker_x"),
    markerY: real("marker_y"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_planogram_products_sku").on(table.sku),
    index("idx_planogram_products_aisle_loc").on(table.aisleKey, table.locId),
  ],
);

export const masterProducts = sqliteTable(
  "master_products",
  {
    id: text("id").primaryKey(),
    sku: text("sku").notNull(),
    barcode: text("barcode").notNull().default(""),
    name: text("name").notNull(),
    line: text("line").notNull(),
    locId: integer("loc_id"),
    price: integer("price").notNull().default(0),
    stock: integer("stock").notNull().default(0),
    loss: integer("loss").notNull().default(0),
    expDate: text("exp_date").notNull().default(""),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_master_products_sku").on(table.sku),
    index("idx_master_products_line").on(table.line),
  ],
);
