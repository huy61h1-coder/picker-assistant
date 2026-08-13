import { env } from "cloudflare:workers";

const validUploadId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const assetKey = (id: string, asset: string) => `planograms/${id}/${asset === "pdf" ? "source.pdf" : "layout.jpg"}`;

function validateAsset(id: string, asset: string) {
  return validUploadId.test(id) && (asset === "pdf" || asset === "visual");
}

export async function GET(_request: Request, context: { params: Promise<{ id: string; asset: string }> }) {
  const { id, asset } = await context.params;
  if (asset !== "pdf" && asset !== "visual") return new Response("Not found", { status: 404 });

  const row = await env.DB.prepare("SELECT file_name, pdf_key, visual_key FROM planograms WHERE id = ?").bind(id).first<Record<string, string>>();
  if (!row) return new Response("Not found", { status: 404 });

  const key = asset === "pdf" ? row.pdf_key : row.visual_key;
  const object = await env.FILES.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=3600");
  headers.set("content-disposition", `inline; filename="${asset === "pdf" ? row.file_name.replace(/[\r\n\"]/g, "") : "layout.jpg"}"`);
  return new Response(object.body, { headers });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string; asset: string }> }) {
  const { id, asset } = await context.params;
  if (!validateAsset(id, asset)) return Response.json({ error: "Đường dẫn tải lên chưa hợp lệ" }, { status: 404 });

  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
  const contentLength = Number(request.headers.get("content-length") || 0);
  const maxBytes = asset === "pdf" ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
  const accepted = asset === "pdf" ? contentType === "application/pdf" : ["image/jpeg", "image/webp"].includes(contentType);

  if (!accepted) return Response.json({ error: asset === "pdf" ? "Chỉ nhận file PDF" : "Ảnh layout phải là JPEG hoặc WebP" }, { status: 415 });
  if (contentLength > maxBytes) return Response.json({ error: asset === "pdf" ? "PDF tối đa 50 MB" : "Ảnh layout tối đa 8 MB" }, { status: 413 });
  if (!request.body) return Response.json({ error: "File tải lên đang trống" }, { status: 400 });

  await env.FILES.put(assetKey(id, asset), request.body, { httpMetadata: { contentType } });
  return Response.json({ ok: true }, { status: 201 });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; asset: string }> }) {
  const { id, asset } = await context.params;
  if (!validateAsset(id, asset)) return Response.json({ error: "Đường dẫn tải lên chưa hợp lệ" }, { status: 404 });
  await env.FILES.delete(assetKey(id, asset));
  return new Response(null, { status: 204 });
}
