import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { join } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

const appRoot = new URL("..", import.meta.url).pathname;
const screenshotDir = join(appRoot, "test-results", "visual");

describe("Desktop and Control Center browser visual smoke", () => {
  it("renders without horizontal overflow or clipped control text on desktop and mobile", async () => {
    mkdirSync(screenshotDir, { recursive: true });
    const port = await getAvailablePort();
    const vite = await createServer({
      root: appRoot,
      logLevel: "error",
      configFile: false,
      server: {
        host: "127.0.0.1",
        port,
        strictPort: true,
      },
    });
    let browser;

    try {
      await vite.listen();
      browser = await chromium.launch();
      const url = vite.resolvedUrls?.local[0];
      assert.ok(url, "Vite dev server should expose a local URL");

      for (const viewport of [
        { name: "desktop", width: 1280, height: 900 },
        { name: "mobile", width: 390, height: 844 },
      ]) {
        const page = await browser.newPage({
          viewport: {
            width: viewport.width,
            height: viewport.height,
          },
        });

        await page.goto(url, { waitUntil: "networkidle" });
        await page.waitForSelector('[data-control-area="settings"]');

        const layout = await page.evaluate(() => {
          const root = document.documentElement;
          const requiredSelectors = [
            ".companion-orb",
            ".companion-panel",
            ".control-center-nav",
            '[data-control-area="companion"]',
            '[data-control-area="gateway"]',
            '[data-control-area="costs"]',
            '[data-control-area="skills"]',
            '[data-control-area="sessions"]',
            '[data-control-area="safety"]',
            '[data-control-area="settings"]',
          ];
          const collapsed = requiredSelectors
            .map((selector) => {
              const element = document.querySelector(selector);
              const rect = element?.getBoundingClientRect();
              return {
                selector,
                width: rect?.width ?? 0,
                height: rect?.height ?? 0,
              };
            })
            .filter((item) => item.width <= 0 || item.height <= 0);
          const clippedText = [...document.querySelectorAll("button, a, dt, dd, h1, h2")]
            .map((element) => ({
              text: element.textContent?.trim() ?? "",
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
            }))
            .filter((item) => item.clientWidth > 0 && item.scrollWidth > item.clientWidth + 1);

          return {
            scrollWidth: root.scrollWidth,
            clientWidth: root.clientWidth,
            collapsed,
            clippedText,
          };
        });

        assert.ok(
          layout.scrollWidth <= layout.clientWidth + 1,
          `${viewport.name} layout should not horizontally overflow: ${layout.scrollWidth} > ${layout.clientWidth}`,
        );
        assert.deepEqual(layout.collapsed, []);
        assert.deepEqual(layout.clippedText, []);

        const screenshot = await page.screenshot({
          fullPage: true,
          path: join(screenshotDir, `${viewport.name}.png`),
        });
        assert.ok(screenshot.length > 10_000, `${viewport.name} screenshot should be non-empty`);

        await page.close();
      }
    } finally {
      await browser?.close();
      await vite.close();
    }
  });
});

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : undefined;
      server.close(() => {
        if (port) {
          resolve(port);
        } else {
          reject(new Error("Unable to allocate a local port"));
        }
      });
    });
  });
}
