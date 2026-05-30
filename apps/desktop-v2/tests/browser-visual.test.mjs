import { describe, it, expect } from "vitest";
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
      expect(url).toBeTruthy();

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

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForSelector('[data-control-area="companion"]', {
          timeout: 20_000,
          state: "attached",
        });

        // Verify sidebar-always-visible elements
        const sidebarLayout = await page.evaluate(() => {
          const alwaysVisible = [
            ".companion-orb",
            ".companion-panel",
            ".control-center-nav",
          ];
          const collapsed = alwaysVisible
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
          return { collapsed };
        });
        expect(sidebarLayout.collapsed).toEqual([]);

        // Verify each tab area becomes visible when navigated to
        const tabAreas = ["companion", "gateway", "costs", "skills", "sessions", "safety", "settings"];
        for (const area of tabAreas) {
          const navLink = await page.$(`[data-nav-target="${area}"]`);
          if (navLink) {
            await navLink.click();
            await page.waitForFunction(
              (areaName) => {
                const el = document.querySelector(`[data-control-area="${areaName}"]`);
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
              },
              area,
              { timeout: 5_000 },
            );
          }
          const areaVisible = await page.evaluate((areaName) => {
            const el = document.querySelector(`[data-control-area="${areaName}"]`);
            if (!el) return { exists: false, width: 0, height: 0 };
            const rect = el.getBoundingClientRect();
            return { exists: true, width: rect.width, height: rect.height };
          }, area);
          expect(areaVisible.exists, `area ${area} should exist in DOM`).toBe(true);
          expect(areaVisible.width > 0, `area ${area} should have width > 0`).toBe(true);
          expect(areaVisible.height > 0, `area ${area} should have height > 0`).toBe(true);
        }

        // Check no horizontal overflow
        const overflowCheck = await page.evaluate(() => {
          const root = document.documentElement;
          return {
            scrollWidth: root.scrollWidth,
            clientWidth: root.clientWidth,
          };
        });
        expect(overflowCheck.scrollWidth <= overflowCheck.clientWidth + 1).toBeTruthy();

        const screenshot = await page.screenshot({
          fullPage: true,
          path: join(screenshotDir, `${viewport.name}.png`),
        });
        expect(screenshot.length > 10_000).toBeTruthy();

        await page.close();
      }
    } finally {
      await browser?.close();
      await vite.close();
    }
  }, 90_000);
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
