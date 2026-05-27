export async function verifyTurnstile(
  token: string,
  secret: string | undefined,
  remoteIp: string,
): Promise<boolean> {
  if (!secret) return true;
  const body = new URLSearchParams({ secret, response: token, remoteip: remoteIp });
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  if (!r.ok) return false;
  const json = (await r.json()) as { success: boolean };
  return json.success === true;
}
