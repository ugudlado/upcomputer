import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { parsePageThreadLinkHref, threadLinkOrigin } from "./threadLinkOrigin";

const stubPage = (origin: string) => {
  const url = new URL(origin);
  vi.stubGlobal("location", { protocol: url.protocol, origin: url.origin });
};

describe("threadLinkOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("defaults to the page's own origin when no hosted app is configured", () => {
    vi.stubEnv("VITE_HOSTED_APP_URL", "");
    stubPage("https://box.example.test:8443/threads/a/b");
    expect(threadLinkOrigin()).toBe("https://box.example.test:8443");
  });

  it("lets an explicitly configured hosted app win", () => {
    vi.stubEnv("VITE_HOSTED_APP_URL", "https://preview.example.test");
    stubPage("https://box.example.test");
    expect(threadLinkOrigin()).toBe("https://preview.example.test");
  });

  it("does not use a page that is not on the web", () => {
    vi.stubEnv("VITE_HOSTED_APP_URL", "");
    vi.stubGlobal("location", { protocol: "upcomputer:", origin: "null" });
    expect(threadLinkOrigin()).toBe("https://app.up.computer");
  });

  it("reads thread links on the page's own origin and the hosted ones", () => {
    stubPage("https://box.example.test");
    const expected = { environmentId: "env-1", threadId: "thread-1" };
    expect(parsePageThreadLinkHref("https://box.example.test/threads/env-1/thread-1")).toEqual(
      expected,
    );
    expect(parsePageThreadLinkHref("https://app.up.computer/threads/env-1/thread-1")).toEqual(
      expected,
    );
    expect(parsePageThreadLinkHref("t3-thread://v2/env-1/thread-1")).toEqual(expected);
    expect(parsePageThreadLinkHref("https://evil.test/threads/env-1/thread-1")).toBeNull();
  });
});
