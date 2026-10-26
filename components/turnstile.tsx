import { TURNSTILE_SITE_KEY } from "@/lib/security.ts";

/**
 * Cloudflare Turnstile inside a form: the widget adds the hidden `cf-turnstile-response` field that the
 * server action verifies. Renders nothing while no site key is configured (homologation).
 */
export function Turnstile() {
  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <>
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className="cf-turnstile co-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-language="pt-BR" data-size="flexible" data-appearance="interaction-only" />
    </>
  );
}
