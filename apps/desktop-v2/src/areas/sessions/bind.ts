/**
 * Sessions Area — bind functions
 */
import type { AreaContext, CompanionRuntimeSnapshot, DesktopCompanionController, LocalControlClientLike } from "../../types";
import { t, escapeHtml } from "../../shared/utils";
import { confirmDialog, showToast } from "../../utils/modal";

export function bindSessionsArea(ctx: AreaContext): void {
  bindSessionControls(ctx.target, ctx.snapshot, ctx.controller, ctx.controlClient);
}

import { resolveSessionResumeFeedback } from "../../shared/utils";

export function bindSessionControls(
  target: HTMLElement,
  snapshot: CompanionRuntimeSnapshot,
  controller?: DesktopCompanionController,
  controlClient?: LocalControlClientLike,
): void {
  const syncWorkSessionsFromLocal = (): void => {
    snapshot.sessions.workSessions = snapshot.localSessions.map((session) => ({
      id: session.id,
      source: "gateway-session-repository",
      client: session.provider,
      projectPath: session.projectDir,
      lastActiveAt: session.lastActiveAt,
      evidenceSummary: session.summary || "",
      searchable: true,
      resumable: !!session.isResumable,
      resumeCommand: session.resumeCommand,
    }));
  };

  // Search
  target.querySelectorAll<HTMLInputElement>("[data-session-search]").forEach((input) => {
    input.addEventListener("input", () => {
      const keyword = input.value.trim().toLowerCase();
      const sessions = snapshot.localSessions;
      const filtered = keyword
        ? sessions.filter((s) => s.projectDir.toLowerCase().includes(keyword) || (s.summary || "").toLowerCase().includes(keyword) || s.provider.toLowerCase().includes(keyword))
        : sessions;
      if (keyword) showToast(t("sessions.searchResult", "搜索结果") + `: ${filtered.length}`, "info");
      const listEl = target.querySelector(".session-results");
      if (listEl) {
        listEl.innerHTML = filtered.map((s) => `
          <article class="session-row">
            <h3>${escapeHtml(s.projectDir)}</h3>
            <p>${t("sessions.source", "Session Source")}: ${escapeHtml(s.provider)} · ${escapeHtml(s.lastActiveAt)}</p>
            ${s.summary ? `<p>${escapeHtml(s.summary)}</p>` : ''}
            <p>${s.messageCount} ${t("sessions.messages", "messages")} · ${t("sessions.resumable", "Resumable")}: ${s.isResumable ? t("common.yes", "yes") : t("common.no", "no")}</p>
            ${s.isResumable ? `<button type="button" data-session-launch="${escapeHtml(s.id)}">${t("sessions.resume", "Resume Session")}</button>` : ''}
          </article>
        `).join("");
      }
    });
  });

  // Launch session
  target.querySelectorAll<HTMLButtonElement>("[data-session-launch]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const sessionId = btn.dataset.sessionLaunch!;
      const session = snapshot.localSessions.find((s) => s.id === sessionId);
      if (!session?.isResumable) { showToast(t("sessions.notResumable", "此会话不可恢复"), "info"); return; }
      const confirmed = await confirmDialog(
        t("sessions.confirmLaunch", "确认启动"),
        t("sessions.confirmLaunchMessage", "确定要恢复此会话吗？") + ` (${sessionId})`,
        { confirmText: t("app.actions.launch", "Launch"), cancelText: t("app.actions.cancel", "Cancel") },
      );
      if (confirmed && controlClient) {
        showToast(t("sessions.resuming", "正在恢复会话..."), "info");
        const result = await controlClient.resumeSession(sessionId);
        if (result.success) {
          showToast(t("sessions.resumed", "会话已恢复"), "success");
        } else {
          const feedback = resolveSessionResumeFeedback(result.message);
          const reason = t(feedback.key, result.message || t("sessions.resumeFailed", "恢复失败"));
          const hint = feedback.hintKey ? ` ${t(feedback.hintKey, "")}`.trim() : "";
          showToast(`${t("sessions.resumeFailed", "恢复失败")}: ${reason}${hint ? ` · ${hint}` : ""}`, feedback.level);
        }
      } else if (confirmed) {
        showToast(t("sessions.notAvailable", "Session resume not available in local mode"), "info");
      }
    });
  });

  // Delete session
  target.querySelectorAll<HTMLButtonElement>("[data-session-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const sessionId = btn.dataset.sessionDelete!;
      const confirmed = await confirmDialog(
        t("app.dialog.confirmTitle", "请确认"),
        t("sessions.confirmDelete", "确定要删除此会话吗？"),
        { confirmText: t("app.actions.delete", "删除"), cancelText: t("app.actions.cancel", "取消"), danger: true },
      );
      if (confirmed) {
        if (controlClient) await controlClient.deleteSession(sessionId);
        snapshot.localSessions = snapshot.localSessions.filter((s) => s.id !== sessionId);
        syncWorkSessionsFromLocal();
        controller?.render(snapshot);
        showToast(t("sessions.deleted", "会话已删除"), "success");
      }
    });
  });
}
