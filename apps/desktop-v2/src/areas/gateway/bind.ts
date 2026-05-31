/**
 * Gateway Area — bind functions
 * Binds event listeners for channel CRUD operations, ping, drag reorder,
 * and channel context menus.
 */
import type { AreaContext, CompanionRuntimeSnapshot, DesktopCompanionController, LocalControlClientLike, ChannelAddFormData } from "../../types";
import { t, escapeHtml } from "../../shared/utils";
import { openAddChannelModal, openEditChannelModal } from "../../utils/channelModal";
import { confirmDialog, showToast } from "../../utils/modal";
import { enableChannelDragReorder } from "../../utils/dragReorder";
import { openContextMenu } from "../../utils/contextMenu";

export function bindGatewayArea(ctx: AreaContext): void {
  bindExternalToolGatewayControls(ctx.target, ctx.snapshot, ctx.controller, ctx.controlClient);
  bindChannelControls(ctx.target, ctx.snapshot, ctx.controller, ctx.controlClient);
}

function bindExternalToolGatewayControls(
  target: HTMLElement,
  snapshot: CompanionRuntimeSnapshot,
  controller?: DesktopCompanionController,
  controlClient?: LocalControlClientLike,
): void {
  target.querySelectorAll<HTMLButtonElement>("[data-external-gateway-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.externalGatewayAction;
      if (!controlClient) {
        showToast(t("gateway.externalToolGatewayUnavailable", "第三方工具网关控制不可用"), "error");
        return;
      }
      try {
        const next =
          action === "start" ? await controlClient.startExternalToolGateway?.()
            : action === "stop" ? await controlClient.stopExternalToolGateway?.()
              : action === "restart" ? await controlClient.restartExternalToolGateway?.()
                : await controlClient.getExternalToolGatewayStatus?.();
        if (!next) {
          showToast(t("gateway.externalToolGatewayDesktopOnly", "请在桌面版窗口中操作第三方工具网关"), "error");
          return;
        }
        snapshot.gateway.externalToolGateway = next;
        controller?.render(snapshot);
        showToast(next.message || t("gateway.externalToolGatewayUpdated", "第三方工具网关状态已更新"), next.state === "error" ? "error" : "success");
      } catch (error: any) {
        const message = String(error?.message || error || "");
        const display = message.includes("tauri_invoke_unavailable")
          ? t("gateway.externalToolGatewayDesktopOnly", "请在桌面版窗口中操作第三方工具网关")
          : message;
        showToast(t("gateway.externalToolGatewayFailed", "第三方工具网关操作失败") + ": " + display, "error");
      }
    });
  });
}

export function bindChannelControls(
  target: HTMLElement,
  snapshot: CompanionRuntimeSnapshot,
  controller?: DesktopCompanionController,
  controlClient?: LocalControlClientLike,
): void {
  const persistChannelOrder = async (): Promise<void> => {
    if (!controlClient) return;
    await Promise.all(
      snapshot.channels.map((channel, index) =>
        controlClient.updateChannel(channel.id, { priority: index }),
      ),
    );
  };

  // Add channel
  target.querySelectorAll<HTMLButtonElement>("[data-channel-action=\"add\"]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openAddChannelModal({ onSubmit: (data) => handleChannelAdd(data, snapshot, controller, controlClient) });
    });
  });

  // Ping all
  target.querySelectorAll<HTMLButtonElement>("[data-channel-action=\"ping-all\"]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!controlClient) {
        showToast(t("store.channel.pingNotAvailable", "Ping not available"), "info");
        return;
      }
      showToast(t("store.channel.pinging", "正在测试中"), "info");
      for (const ch of snapshot.channels) {
        const result = await controlClient.pingChannel(ch.id);
        if (result.reachable) {
          ch.circuitState = "closed";
        }
      }
      controller?.render(snapshot);
      showToast(t("store.channel.pingComplete", "批量测试完成"), "success");
    });
  });

  // Edit channel
  target.querySelectorAll<HTMLButtonElement>("[data-channel-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const channelId = btn.dataset.channelEdit!;
      const channel = snapshot.channels.find((c) => c.id === channelId);
      if (channel) {
        openEditChannelModal(channel, { onSubmit: (data) => handleChannelEdit(data, channelId, snapshot, controller, controlClient) });
      }
    });
  });

  // Delete channel
  target.querySelectorAll<HTMLButtonElement>("[data-channel-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const channelId = btn.dataset.channelDelete!;
      const channel = snapshot.channels.find((c) => c.id === channelId);
      const confirmed = await confirmDialog(
        t("app.dialog.confirmTitle", "Please confirm"),
        t("toast.confirmDeleteChannel", "确定要删除这个渠道吗？") + (channel ? ` (${channel.name})` : ""),
        { confirmText: t("app.actions.delete", "Delete"), cancelText: t("app.actions.cancel", "Cancel"), danger: true },
      );
      if (confirmed) {
        handleChannelDelete(channelId, snapshot, controller, controlClient);
      }
    });
  });

  // Ping single channel
  target.querySelectorAll<HTMLButtonElement>("[data-channel-ping]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const channelId = btn.dataset.channelPing!;
      if (!controlClient) {
        showToast(t("store.channel.pingNotAvailable", "Ping not available"), "info");
        return;
      }
      showToast(t("store.channel.pinging", "正在测试中") + `: ${channelId}`, "info");
      const result = await controlClient.pingChannel(channelId);
      if (result.reachable) {
        showToast(`✓ ${channelId}: ${result.latencyMs}ms (HTTP ${result.statusCode})`, "success");
      } else {
        showToast(`✗ ${channelId}: ${result.error || "unreachable"} (${result.latencyMs}ms)`, "error");
      }
    });
  });

  // Channel context menu
  target.querySelectorAll<HTMLButtonElement>("[data-channel-menu]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const channelId = btn.dataset.channelMenu!;
      const channel = snapshot.channels.find((c) => c.id === channelId);
      if (!channel) return;
      const rect = btn.getBoundingClientRect();
      openContextMenu(rect.right, rect.bottom, [
        { icon: "✏", label: t("gateway.edit", "Edit"), action: () => {
          openEditChannelModal(channel, { onSubmit: (data) => handleChannelEdit(data, channelId, snapshot, controller, controlClient) });
        }},
        { icon: "📡", label: t("gateway.ping", "Ping"), action: () => {
          void (async () => {
            if (!controlClient) { showToast(t("store.channel.pingNotAvailable", "Ping not available"), "info"); return; }
            showToast(t("store.channel.pinging", "正在测试中") + `: ${channel.name}`, "info");
            const result = await controlClient.pingChannel(channel.id);
            if (result.reachable) { showToast(`✓ ${channel.name}: ${result.latencyMs}ms (HTTP ${result.statusCode})`, "success"); }
            else { showToast(`✗ ${channel.name}: ${result.error || "unreachable"} (${result.latencyMs}ms)`, "error"); }
          })();
        }},
        { icon: "📝", label: "Copy Config", action: () => {
          const config = JSON.stringify({ name: channel.name, apiType: channel.apiType, baseUrl: channel.baseUrl }, null, 2);
          navigator.clipboard?.writeText(config);
          showToast(t("orchestration.copied", "已复制"), "success");
        }},
        { icon: "⬆", label: t("orchestration.moveTop", "置顶"), action: () => {
          void (async () => {
            const idx = snapshot.channels.indexOf(channel);
            if (idx > 0) { snapshot.channels.splice(idx, 1); snapshot.channels.unshift(channel); snapshot.channels.forEach((c, i) => c.priority = i); await persistChannelOrder(); controller?.render(snapshot); }
          })();
        }},
        { icon: "⬇", label: t("orchestration.moveBottom", "置底"), action: () => {
          void (async () => {
            const idx = snapshot.channels.indexOf(channel);
            if (idx < snapshot.channels.length - 1) { snapshot.channels.splice(idx, 1); snapshot.channels.push(channel); snapshot.channels.forEach((c, i) => c.priority = i); await persistChannelOrder(); controller?.render(snapshot); }
          })();
        }},
        { icon: "⚠", label: channel.status === "suspended" ? t("orchestration.resume", "恢复") : t("orchestration.pause", "暂停"), action: () => {
          void (async () => {
            const nextStatus = channel.status === "suspended" ? "active" : "suspended";
            if (controlClient) {
              const updated = await controlClient.updateChannel(channel.id, { status: nextStatus });
              const idx = snapshot.channels.findIndex((c) => c.id === channel.id);
              if (idx >= 0) snapshot.channels[idx] = updated;
            } else {
              channel.status = nextStatus as typeof channel.status;
            }
            snapshot.dashboardStats.activeChannels = snapshot.channels.filter((c) => c.status === "active").length;
            controller?.render(snapshot);
          })();
        }, separatorAfter: true },
        { icon: "🗑", label: t("gateway.delete", "Delete"), danger: true, action: async () => {
          const confirmed = await confirmDialog(
            t("app.dialog.confirmTitle", "Please confirm"),
            t("toast.confirmDeleteChannel", "确定要删除这个渠道吗？") + ` (${channel.name})`,
            { confirmText: t("app.actions.delete", "Delete"), cancelText: t("app.actions.cancel", "Cancel"), danger: true },
          );
          if (confirmed) handleChannelDelete(channelId, snapshot, controller, controlClient);
        }},
      ]);
    });
  });

  // Drag reorder
  const channelList = target.querySelector<HTMLElement>(".channel-list");
  if (channelList) {
    enableChannelDragReorder(channelList, {
      onReorder: (orderedIds) => {
        void (async () => {
          const channelMap = new Map(snapshot.channels.map((c) => [c.id, c]));
          const reordered = orderedIds.map((id) => channelMap.get(id)).filter(Boolean);
          if (reordered.length === snapshot.channels.length) {
            snapshot.channels = reordered as typeof snapshot.channels;
            snapshot.channels.forEach((c, i) => c.priority = i);
            await persistChannelOrder();
            controller?.render(snapshot);
          }
        })();
      },
    });
  }
}

async function refreshDashboardStats(snapshot: CompanionRuntimeSnapshot, controlClient?: LocalControlClientLike): Promise<void> {
  if (controlClient) {
    snapshot.dashboardStats = await controlClient.fetchDashboardStats();
    return;
  }
  snapshot.dashboardStats = {
    ...snapshot.dashboardStats,
    totalChannels: snapshot.channels.length,
    activeChannels: snapshot.channels.filter((channel) => channel.status === "active").length,
  };
}

async function handleChannelAdd(data: ChannelAddFormData, snapshot: CompanionRuntimeSnapshot, controller?: DesktopCompanionController, controlClient?: LocalControlClientLike): Promise<void> {
  try {
    if (!controlClient) { showToast(t("store.channel.createFailed", "创建失败") + ": control client unavailable", "error"); return; }
    const newChannel = await controlClient.createChannel({ ...data, type: data.apiType });
    snapshot.channels.push(newChannel);
    await refreshDashboardStats(snapshot, controlClient);
    controller?.render(snapshot);
    showToast(t("store.channel.created", "渠道创建成功") + ": " + data.name, "success");
  } catch (e: any) {
    const message = String(e?.message || "");
    const displayMessage = message.includes("gateway_unreachable:")
      ? t("gateway.offlineHint", "本地网关未启动（127.0.0.1:3001），请先启动后再添加渠道。")
      : message;
    showToast(t("store.channel.createFailed", "创建失败") + ": " + displayMessage, "error");
  }
}

async function handleChannelEdit(data: ChannelAddFormData, channelId: string, snapshot: CompanionRuntimeSnapshot, controller?: DesktopCompanionController, controlClient?: LocalControlClientLike): Promise<void> {
  try {
    if (!controlClient) { showToast(t("store.channel.updateFailed", "更新失败") + ": control client unavailable", "error"); return; }
    const updated = await controlClient.updateChannel(channelId, { ...data, type: data.apiType });
    const idx = snapshot.channels.findIndex((c) => c.id === channelId);
    if (idx >= 0) snapshot.channels[idx] = updated;
    await refreshDashboardStats(snapshot, controlClient);
    controller?.render(snapshot);
    showToast(t("store.channel.updated", "渠道更新成功"), "success");
  } catch (e: any) {
    const message = String(e?.message || "");
    const displayMessage = message.includes("gateway_unreachable:")
      ? t("gateway.offlineHint", "本地网关未启动（127.0.0.1:3001），请先启动后再更新渠道。")
      : message;
    showToast(t("store.channel.updateFailed", "更新失败") + ": " + displayMessage, "error");
  }
}

async function handleChannelDelete(channelId: string, snapshot: CompanionRuntimeSnapshot, controller?: DesktopCompanionController, controlClient?: LocalControlClientLike): Promise<void> {
  try {
    if (!controlClient) { showToast(t("store.channel.deleteFailed", "删除失败") + ": control client unavailable", "error"); return; }
    await controlClient.deleteChannel(channelId);
    snapshot.channels = snapshot.channels.filter((c) => c.id !== channelId);
    await refreshDashboardStats(snapshot, controlClient);
    controller?.render(snapshot);
    showToast(t("store.channel.deleted", "渠道删除成功"), "success");
  } catch (e: any) {
    showToast(t("store.channel.deleteFailed", "删除失败") + ": " + (e?.message || ""), "error");
  }
}
