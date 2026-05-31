/**
 * MCP Area — bind functions
 */
import type { AreaContext, CompanionRuntimeSnapshot, DesktopCompanionController, LocalControlClientLike } from "../../types";
import { t } from "../../shared/utils";
import { confirmDialog, showToast, openModal, closeModal } from "../../utils/modal";

export function bindMcpArea(ctx: AreaContext): void {
  bindMcpControls(ctx.target, ctx.snapshot, ctx.controller, ctx.controlClient);
}

export function bindMcpControls(target: HTMLElement, snapshot: CompanionRuntimeSnapshot, controller?: DesktopCompanionController, controlClient?: LocalControlClientLike): void {
  target.querySelectorAll<HTMLButtonElement>("[data-mcp-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const serverId = btn.dataset.mcpToggle!;
      if (!controlClient) { showToast(t("mcp.notAvailable", "MCP management not available in local mode"), "info"); return; }
      const updated = await controlClient.toggleMcpServer(serverId);
      if (updated) {
        const idx = snapshot.mcpServers.findIndex((s) => s.id === serverId);
        if (idx >= 0) snapshot.mcpServers[idx] = updated;
        showToast(t("mcp.statusToggled", updated.status === "running" ? "MCP 服务器已启动" : "MCP 服务器已停止") + ": " + updated.name, updated.status === "running" ? "success" : "info");
        controller?.render(snapshot);
      } else showToast(t("mcp.notAvailable", "MCP management not available in local mode"), "info");
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-mcp-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!controlClient) { showToast(t("mcp.notAvailable", "MCP management not available in local mode"), "info"); return; }
      openModal(`
        <h3>${t("mcp.addServer", "添加 MCP 服务器")}</h3>
        <div class="form-group"><label class="modal-label">${t("mcp.serverName", "名称")}</label><input type="text" class="modal-input" id="mcp-add-name" placeholder="我的 MCP 服务" /></div>
        <div class="form-group"><label class="modal-label">${t("mcp.command", "命令")}</label><input type="text" class="modal-input" id="mcp-add-command" placeholder="例如: npx" /></div>
        <div class="form-group"><label class="modal-label">${t("mcp.args", "参数")}</label><input type="text" class="modal-input" id="mcp-add-args" placeholder="-y @modelcontextprotocol/server-filesystem" /></div>
        <div class="modal-actions"><button type="button" class="modal-btn modal-btn--ghost" data-modal-close>${t("common.cancel", "取消")}</button><button type="button" class="modal-btn modal-btn--primary" id="mcp-add-submit">${t("common.add", "添加")}</button></div>
      `);
      document.getElementById("mcp-add-submit")?.addEventListener("click", async () => {
        const name = (document.getElementById("mcp-add-name") as HTMLInputElement)?.value?.trim();
        const command = (document.getElementById("mcp-add-command") as HTMLInputElement)?.value?.trim();
        const argsStr = (document.getElementById("mcp-add-args") as HTMLInputElement)?.value?.trim();
        if (!name || !command) { showToast(t("mcp.fillRequired", "请填写必填字段"), "error"); return; }
        const args = argsStr ? argsStr.split(" ").filter(Boolean) : undefined;
        const server = await controlClient.createMcpServer({ name, command, args });
        if (server) { snapshot.mcpServers.push(server); closeModal(); controller?.render(snapshot); showToast(t("mcp.serverAdded", "MCP 服务器已添加") + ": " + name, "success"); }
        else { closeModal(); showToast(t("mcp.notAvailable", "MCP management not available in local mode"), "info"); }
      });
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-mcp-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const serverId = btn.dataset.mcpDelete!;
      const server = snapshot.mcpServers.find((s) => s.id === serverId);
      const confirmed = await confirmDialog(t("app.dialog.confirmTitle", "请确认"), t("mcp.confirmDelete", "确定要删除此 MCP 服务器吗？") + (server ? ` (${server.name})` : ""), { confirmText: t("app.actions.delete", "删除"), cancelText: t("app.actions.cancel", "取消"), danger: true });
      if (confirmed) {
        if (controlClient) await controlClient.deleteMcpServer(serverId);
        snapshot.mcpServers = snapshot.mcpServers.filter((s) => s.id !== serverId);
        controller?.render(snapshot);
        showToast(t("mcp.serverDeleted", "MCP 服务器已删除"), "success");
      }
    });
  });
}
