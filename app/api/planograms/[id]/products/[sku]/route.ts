import { env } from "cloudflare:workers";

const validPlanogramId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ id: string; sku: string }> }) {
  try {
    const { id, sku } = await context.params;
    const payload = await request.json() as { locId?: number; markerX?: number; markerY?: number };
    const locId = Number(payload.locId);
    const markerX = Number(payload.markerX);
    const markerY = Number(payload.markerY);

    if (!validPlanogramId.test(id) || !sku || !Number.isInteger(locId) || locId < 1) {
      return Response.json({ error: "Sản phẩm cần cập nhật chưa hợp lệ" }, { status: 400 });
    }
    if (!Number.isFinite(markerX) || !Number.isFinite(markerY) || markerX < 0 || markerX > 1 || markerY < 0 || markerY > 1) {
      return Response.json({ error: "Tọa độ trên ảnh chưa hợp lệ" }, { status: 400 });
    }

    const result = await env.DB.prepare("UPDATE planogram_products SET marker_x = ?, marker_y = ? WHERE planogram_id = ? AND sku = ? AND loc_id = ?")
      .bind(markerX, markerY, id, sku, locId)
      .run();
    if (!result.meta.changes) return Response.json({ error: "Không tìm thấy sản phẩm để cập nhật" }, { status: 404 });

    return Response.json({ markerX, markerY });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể lưu điểm đánh dấu" }, { status: 500 });
  }
}
