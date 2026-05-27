import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getReport, setReportPdfKey } from "@/lib/db/queries/reports";
import { renderMarkdownToPdf, reportHtml } from "@/lib/pdf";
import { putReportPdf } from "@/lib/r2";
import { marked } from "marked";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const { success } = await env.RATE_LIMITER_PDF.limit({ key: `u:${user.userId}` });
    if (!success) throw new AppError("RATE_LIMITED", "PDF rate limit");
    const r = await getReport(db, user.userId, ctx.params.id);
    if (!r) throw new AppError("NOT_FOUND", "report not found");

    if (r.pdfR2Key) {
      const obj = await env.R2.get(r.pdfR2Key);
      if (obj) return new Response(obj.body, { headers: { "content-type": "application/pdf" } });
    }
    const html = reportHtml(r.title, marked.parse(r.contentMd) as string);
    const pdf = await renderMarkdownToPdf(env, html);
    const key = await putReportPdf(env, user.userId, r.id, r.version, pdf);
    await setReportPdfKey(db, r.id, key);
    return new Response(pdf, { headers: { "content-type": "application/pdf" } });
  });
