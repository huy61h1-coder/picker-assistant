import { env } from "cloudflare:workers";

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
