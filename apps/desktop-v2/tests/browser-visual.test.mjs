import { describe, it, expect } from "vitest";
import { mkdirSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { join } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

const appRoot = new URL("..", import.meta.url).pathname;
const screenshotDir = join(appRoot, "test-results", "visual");

describe("Desktop Body browser visual smoke", () => {
  it("draws a colorful desktop companion avatar in pet-only mode instead of the grey fallback", async () => {
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
      const page = await browser.newPage({ viewport: { width: 260, height: 260 } });
      await page.addInitScript((spriteDataUrl) => {
        globalThis.isTauri = true;
        globalThis.__TAURI_INTERNALS__ = {
          convertFileSrc: () => spriteDataUrl,
        };
      }, codexLikeSpriteDataUrl());
      await page.goto(`${url}?shellMode=desktop-companion`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForSelector(".pet-widget__character canvas", { timeout: 20_000 });
      await page.waitForFunction(() => {
        const canvas = document.querySelector("canvas");
        if (!(canvas instanceof HTMLCanvasElement)) return false;
        const context = canvas.getContext("2d");
        if (!context) return false;
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let index = 3; index < pixels.length; index += 4) {
          if (pixels[index] !== 0) return true;
        }
        return false;
      }, { timeout: 20_000 });

      const avatarPixels = await page.evaluate(() => {
        const canvas = document.querySelector("canvas");
        if (!(canvas instanceof HTMLCanvasElement)) return { visible: 0, colorful: 0, greyFallback: 0 };
        const context = canvas.getContext("2d");
        if (!context) return { visible: 0, colorful: 0, greyFallback: 0 };
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let visible = 0;
        let colorful = 0;
        let greyFallback = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          const a = pixels[index + 3];
          if (a === 0) continue;
          visible += 1;
          if (Math.max(r, g, b) - Math.min(r, g, b) > 24) colorful += 1;
          if (Math.abs(r - 136) <= 3 && Math.abs(g - 136) <= 3 && Math.abs(b - 136) <= 3) greyFallback += 1;
        }
        return { visible, colorful, greyFallback };
      });
      expect(avatarPixels.visible).toBeGreaterThan(500);
      expect(avatarPixels.colorful).toBeGreaterThan(500);
      expect(avatarPixels.greyFallback).toBeLessThan(100);
      await page.close();
    } finally {
      await browser?.close();
      await vite.close();
    }
  }, 60_000);

  it("renders Desktop Body as pet-only without legacy Control Center DOM on desktop and mobile", async () => {
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

        await page.addInitScript(() => {
          globalThis.isTauri = true;
          globalThis.__TAURI_INTERNALS__ = {
            convertFileSrc: (assetPath) => assetPath,
          };
        });
        await page.goto(`${url}?shellMode=desktop-companion`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForSelector(".pet-widget .companion-canvas", {
          timeout: 20_000,
          state: "attached",
        });

        const bodyDom = await page.evaluate(() => {
          const widget = document.querySelector(".pet-widget");
          const character = document.querySelector(".pet-widget__character");
          const canvas = document.querySelector(".companion-canvas");
          const root = document.documentElement;
          const widgetRect = widget?.getBoundingClientRect();
          return {
            hasWidget: Boolean(widget),
            hasCharacter: Boolean(character),
            hasCanvas: Boolean(canvas),
            hasControlArea: Boolean(document.querySelector("[data-control-area]")),
            hasNavTarget: Boolean(document.querySelector("[data-nav-target]")),
            hasLegacyShellText: document.body.innerHTML.includes("renderAgentSoulShell"),
            inlineChatClosed: !document.querySelector("[data-companion-inline-form]"),
            assetPackButtonsClosed: document.querySelectorAll('[data-pet-tool="asset-pack"]').length,
            widgetWidth: widgetRect?.width ?? 0,
            widgetHeight: widgetRect?.height ?? 0,
            scrollWidth: root.scrollWidth,
            clientWidth: root.clientWidth,
          };
        });
        expect(bodyDom.hasWidget).toBe(true);
        expect(bodyDom.hasCharacter).toBe(true);
        expect(bodyDom.hasCanvas).toBe(true);
        expect(bodyDom.hasControlArea).toBe(false);
        expect(bodyDom.hasNavTarget).toBe(false);
        expect(bodyDom.hasLegacyShellText).toBe(false);
        expect(bodyDom.inlineChatClosed).toBe(true);
        expect(bodyDom.assetPackButtonsClosed).toBe(0);
        expect(bodyDom.widgetWidth).toBeGreaterThan(100);
        expect(bodyDom.widgetHeight).toBeGreaterThan(100);
        expect(bodyDom.scrollWidth <= bodyDom.clientWidth + 1).toBeTruthy();

        const screenshot = await page.screenshot({
          fullPage: true,
          path: join(screenshotDir, `${viewport.name}.png`),
        });
        expect(screenshot.length).toBeGreaterThan(1_000);

        await page.close();
      }
    } finally {
      await browser?.close();
      await vite.close();
    }
  }, 90_000);
});

function codexLikeSpriteDataUrl() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <rect width="256" height="256" fill="#00ff00"/>
      <ellipse cx="128" cy="142" rx="70" ry="78" fill="#8b5cf6"/>
      <circle cx="92" cy="65" r="28" fill="#7c3aed"/>
      <circle cx="164" cy="65" r="28" fill="#7c3aed"/>
      <path d="M68 126c18-58 102-58 120 0v42c0 48-120 48-120 0z" fill="#111827"/>
      <circle cx="128" cy="149" r="46" fill="#f5f3ff"/>
      <circle cx="111" cy="139" r="6" fill="#111827"/>
      <circle cx="145" cy="139" r="6" fill="#111827"/>
      <path d="M113 164c10 10 20 10 30 0" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round"/>
      <ellipse cx="128" cy="197" rx="38" ry="22" fill="#ffffff"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

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
