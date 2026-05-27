import puppeteer from "@cloudflare/puppeteer";
import type { AppEnv } from "@/lib/env";

export async function renderMarkdownToPdf(
  env: Pick<AppEnv, "BROWSER">,
  html: string,
): Promise<ArrayBuffer> {
  const browser = await puppeteer.launch(env.BROWSER as never);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "letter",
      margin: { top: "1in", bottom: "1in", left: "0.8in", right: "0.8in" },
      printBackground: true,
    });
    const u8 = pdf as unknown as Uint8Array;
    return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
  } finally {
    await browser.close();
  }
}

export function reportHtml(title: string, markdownAsHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 720px; margin: 0 auto; color: #0f172a; line-height: 1.6; }
  h1 { color: #4F46E5; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
  h2 { color: #334155; margin-top: 28px; }
  pre, code { background: #f1f5f9; padding: 8px 12px; border-radius: 6px; }
  ul { padding-left: 22px; }
  blockquote { border-left: 4px solid #e2e8f0; padding-left: 12px; color: #475569; }
</style></head><body>${markdownAsHtml}</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as const
    )[c] ?? c,
  );
}
