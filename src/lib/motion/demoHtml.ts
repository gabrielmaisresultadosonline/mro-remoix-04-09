/**
 * Cloudflare Web Analytics can inject its beacon into the standalone demo HTML.
 * A sandboxed demo has origin "null", so that beacon cannot call /cdn-cgi/rum.
 */
export function stripCloudflareRum(html: string): string {
  return html.replace(
    /<script\b(?=[^>]*(?:cloudflareinsights\.com|data-cf-beacon|\/cdn-cgi\/rum))[^>]*>[\s\S]*?<\/script\s*>/gi,
    "",
  );
}
