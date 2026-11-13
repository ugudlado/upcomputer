import { UPCOMPUTER_HOSTED_APP_URL } from "@t3tools/shared/upcomputerIdentity";
import { parseThreadLinkHref } from "@t3tools/shared/threadLinks";

function pageOrigin(): string | undefined {
  const location = globalThis.location;
  return location?.protocol === "http:" || location?.protocol === "https:"
    ? location.origin
    : undefined;
}

/**
 * Where copied thread and prompt links point: the explicitly configured hosted app, else the
 * server this page is served from. Only a page with no web origin (a packaged desktop shell)
 * falls back to app.up.computer.
 */
export function threadLinkOrigin(): string {
  return import.meta.env.VITE_HOSTED_APP_URL?.trim() || pageOrigin() || UPCOMPUTER_HOSTED_APP_URL;
}

export function parsePageThreadLinkHref(href: string) {
  return parseThreadLinkHref(href, pageOrigin());
}
