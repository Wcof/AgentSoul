/**
 * Prompts Area — bind functions
 */
import type { AreaContext, CompanionRuntimeSnapshot, DesktopCompanionController, LocalControlClientLike } from "../../types";
import { t } from "../../shared/utils";
import { confirmDialog, showToast, openModal, closeModal } from "../../utils/modal";

export function bindPromptsArea(ctx: AreaContext): void {
  bindPromptControls(ctx.target, ctx.snapshot, ctx.controller, ctx.controlClient);
}

export function bindPromptControls(target: HTMLElement, snapshot: CompanionRuntimeSnapshot, controller?: DesktopCompanionController, controlClient?: LocalControlClientLike): void {
  target.querySelectorAll<HTMLButtonElement>("[data-prompt-favorite]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const promptId = btn.dataset.promptFavorite!;
      const original = snapshot.prompts.find((p) => p.id === promptId);
      const updated = controlClient ? await controlClient.togglePromptFavorite(promptId, original ? !original.isFavorite : undefined) : null;
      if (updated) {
        const idx = snapshot.prompts.findIndex((p) => p.id === promptId);
        if (idx >= 0) snapshot.prompts[idx] = updated;
        showToast(t("prompt.favToggled", updated.isFavorite ? "已收藏" : "已取消收藏") + ": " + updated.name, "success");
        controller?.render(snapshot);
      }
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-prompt-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openModal(`
        <h3>${t("prompt.addPrompt", "添加 Prompt 模板")}</h3>
        <div class="form-group"><label class="modal-label">${t("prompt.name", "名称")}</label><input type="text" class="modal-input" id="prompt-add-name" placeholder="我的提示词模板" /></div>
        <div class="form-group"><label class="modal-label">${t("prompt.nameZh", "中文名称")}</label><input type="text" class="modal-input" id="prompt-add-nameZh" placeholder="我的 Prompt" /></div>
        <div class="form-group"><label class="modal-label">${t("prompt.content", "内容")}</label><textarea class="modal-input" id="prompt-add-content" rows="6" placeholder="在这里编写提示词内容..."></textarea></div>
        <div class="form-group"><label class="modal-label">${t("prompt.category", "分类")}</label><input type="text" class="modal-input" id="prompt-add-category" placeholder="例如: 开发" /></div>
        <div class="form-group"><label class="modal-label">${t("prompt.tags", "标签")}</label><input type="text" class="modal-input" id="prompt-add-tags" placeholder="标签1, 标签2" /></div>
        <div class="modal-actions"><button type="button" class="modal-btn modal-btn--ghost" data-modal-close>${t("common.cancel", "取消")}</button><button type="button" class="modal-btn modal-btn--primary" id="prompt-add-submit">${t("common.add", "添加")}</button></div>
      `);
      document.getElementById("prompt-add-submit")?.addEventListener("click", async () => {
        const name = (document.getElementById("prompt-add-name") as HTMLInputElement)?.value?.trim();
        const content = (document.getElementById("prompt-add-content") as HTMLTextAreaElement)?.value?.trim();
        if (!name || !content) { showToast(t("prompt.fillRequired", "请填写名称和内容"), "error"); return; }
        const nameZh = (document.getElementById("prompt-add-nameZh") as HTMLInputElement)?.value?.trim();
        const category = (document.getElementById("prompt-add-category") as HTMLInputElement)?.value?.trim();
        const tagsStr = (document.getElementById("prompt-add-tags") as HTMLInputElement)?.value?.trim();
        const tags = tagsStr ? tagsStr.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
        const prompt = controlClient ? await controlClient.createPrompt({ name, nameZh, content, category, tags }) : null;
        if (prompt) { snapshot.prompts.push(prompt); closeModal(); controller?.render(snapshot); showToast(t("prompt.added", "Prompt 模板已添加") + ": " + name, "success"); }
        else { closeModal(); showToast(t("prompt.notAvailable", "Prompt management not available in local mode"), "info"); }
      });
    });
  });

  target.querySelectorAll<HTMLButtonElement>("[data-prompt-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const promptId = btn.dataset.promptDelete!;
      const prompt = snapshot.prompts.find((p) => p.id === promptId);
      const confirmed = await confirmDialog(t("app.dialog.confirmTitle", "请确认"), t("prompt.confirmDelete", "确定要删除此 Prompt 模板吗？") + (prompt ? ` (${prompt.name})` : ""), { confirmText: t("app.actions.delete", "删除"), cancelText: t("app.actions.cancel", "取消"), danger: true });
      if (confirmed) {
        if (controlClient) await controlClient.deletePrompt(promptId);
        snapshot.prompts = snapshot.prompts.filter((p) => p.id !== promptId);
        controller?.render(snapshot);
        showToast(t("prompt.deleted", "Prompt 模板已删除"), "success");
      }
    });
  });
}
