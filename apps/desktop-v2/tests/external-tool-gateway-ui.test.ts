import { describe, expect, it } from "vitest";
import { buildSnapshot } from "./helpers/snapshot.js";
import { loadPureFunctions } from "./helpers/module-loader.js";

const fns = await loadPureFunctions();

describe("third-party tool gateway controls", () => {
  it("renders as a manually controlled third-party tool gateway, not a Claude-only service", () => {
    const snapshot = buildSnapshot({
      gateway: {
        externalToolGateway: {
          state: "stopped",
          host: "127.0.0.1",
          port: 3001,
          url: "http://127.0.0.1:3001",
          pid: null,
          message: "第三方工具网关未启动",
        },
      },
    });

    const html = fns.renderGatewayArea(snapshot);

    expect(html).toMatch(/第三方工具网关/);
    expect(html).toMatch(/data-external-gateway-action="start"/);
    expect(html).toMatch(/data-external-gateway-action="stop"/);
    expect(html).toMatch(/data-external-gateway-action="restart"/);
    expect(html).toMatch(/项目启动时不会自动开启/);
    expect(html).toMatch(/Codex/);
    expect(html).toMatch(/Gemini/);
    expect(html).not.toMatch(/Claude CLI 专用/);
    expect(html).not.toMatch(/Claude-only/);
  });
});
