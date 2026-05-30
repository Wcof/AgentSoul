// 渠道添加/编辑弹窗 — 从 CCX AddChannelModal.vue 移植
// 支持快速添加模式（粘贴自动解析）和详细表单模式
// 全 vanilla TS + HTML template strings

import type { ChannelListItemViewModel, ChannelApiType, ChannelAddFormData } from "../types";
import { parseQuickInput, type QuickInputParseResult } from "./quickInputParser";
import { openModal, closeModal, showToast } from "./modal";
import i18nInstance from "../i18n";

function t(key: string, fallback: string): string {
  const instance = typeof i18nInstance !== "undefined" && typeof i18nInstance.t === "function" ? i18nInstance : null;
  return instance ? instance.t(key) : fallback;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}

// ─── 渠道类型选项 ───

const API_TYPE_OPTIONS: Array<{ value: ChannelApiType; label: string }> = [
  { value: "openai-chat", label: "OpenAI Chat" },
  { value: "claude", label: "Claude (Messages)" },
  { value: "codex", label: "Codex (Responses)" },
  { value: "gemini", label: "Gemini" },
];

// ─── 快速添加模式渲染 ───

function renderQuickAddMode(parseResult: QuickInputParseResult, quickInputText = ""): string {
  const urlDetected = parseResult.detectedBaseUrls.length > 0;
  const keyDetected = parseResult.detectedApiKeys.length > 0;

  return `
    <div class="modal-quick-add">
      <div class="quick-add-input-area">
        <label class="modal-label">${t("addChannel.quickInputLabel", "Quick Input")}</label>
        <textarea
          class="modal-textarea quick-input-textarea"
          id="quick-input-textarea"
          rows="8"
          placeholder="${t("addChannel.quickInputPlaceholder", "每行输入一个 API Key 或 Base URL\n\n示例:\nsk-xxx-your-api-key\nhttps://api.example.com/v1")}"
          spellcheck="false"
        >${escapeHtml(quickInputText)}</textarea>
      </div>

      <div class="quick-add-detection">
        <!-- Base URL 检测结果 -->
        <div class="detection-item ${urlDetected ? "detection-item--ok" : "detection-item--error"}">
          <span class="detection-icon">${urlDetected ? "&#10003;" : "&#10007;"}</span>
          <div class="detection-detail">
            <span class="detection-label">${t("addChannel.baseUrl", "Base URL")}</span>
            ${urlDetected
      ? parseResult.detectedBaseUrls.map((url) => `<code class="detection-url">${escapeHtml(url)}</code>`).join("")
      : `<span class="detection-error">${t("addChannel.enterValidUrl", "请输入有效的 URL")}</span>`
    }
          </div>
          ${urlDetected ? `<span class="detection-count">${parseResult.detectedBaseUrls.length}</span>` : ""}
        </div>

        <!-- API Key 检测结果 -->
        <div class="detection-item ${keyDetected ? "detection-item--ok" : "detection-item--error"}">
          <span class="detection-icon">${keyDetected ? "&#10003;" : "&#10007;"}</span>
          <div class="detection-detail">
            <span class="detection-label">${t("addChannel.apiKeys", "API Keys")}</span>
            ${keyDetected
      ? `<span class="detection-success">${t("addChannel.detectedKeys", "{count} keys detected").replace("{count}", String(parseResult.detectedApiKeys.length))}</span>`
      : `<span class="detection-error">${t("addChannel.enterApiKey", "请至少输入一个 API Key")}</span>`
    }
          </div>
          ${keyDetected ? `<span class="detection-count">${parseResult.detectedApiKeys.length}</span>` : ""}
        </div>

        <!-- 自动生成的渠道名 -->
        <div class="detection-item detection-item--info">
          <span class="detection-icon">&#9670;</span>
          <div class="detection-detail">
            <span class="detection-label">${t("addChannel.channelName", "渠道名称")}</span>
            <span class="detection-value">${escapeHtml(parseResult.generatedChannelName)}</span>
          </div>
        </div>

        <!-- 渠道类型 -->
        ${parseResult.detectedServiceType ? `
        <div class="detection-item detection-item--info">
          <span class="detection-icon">&#9670;</span>
          <div class="detection-detail">
            <span class="detection-label">${t("addChannel.channelType", "渠道类型")}</span>
            <span class="detection-value">${escapeHtml(parseResult.detectedServiceType)}</span>
          </div>
        </div>
        ` : ""}
      </div>
    </div>
  `;
}

// ─── 详细表单模式渲染 ───

function renderDetailedFormMode(existingChannel?: ChannelListItemViewModel): string {
  const isEdit = !!existingChannel;
  const name = existingChannel?.name ?? "";
  const apiType = existingChannel?.apiType ?? "openai-chat";
  const baseUrl = existingChannel?.baseUrl ?? "";
  const description = existingChannel?.description ?? "";

  return `
    <div class="modal-detailed-form">
      <div class="form-group">
        <label class="modal-label" for="channel-name">${t("addChannel.nameLabel", "渠道名称 *")}</label>
        <input
          type="text"
          id="channel-name"
          class="modal-input"
          value="${escapeHtml(name)}"
          placeholder="${t("addChannel.namePlaceholder", "例如：GPT-4 渠道")}"
          required
        />
      </div>

      <div class="form-group">
        <label class="modal-label" for="channel-api-type">${t("addChannel.serviceTypeLabel", "服务类型 *")}</label>
        <select id="channel-api-type" class="modal-select">
          ${API_TYPE_OPTIONS.map((opt) => `
            <option value="${opt.value}" ${opt.value === apiType ? "selected" : ""}>${opt.label}</option>
          `).join("")}
        </select>
      </div>

      <div class="form-group">
        <label class="modal-label" for="channel-base-url">${t("addChannel.baseUrlLabel", "基础 URL *")}</label>
        <input
          type="url"
          id="channel-base-url"
          class="modal-input"
          value="${escapeHtml(baseUrl)}"
          placeholder="${t("addChannel.baseUrlPlaceholder", "https://api.openai.com/v1")}"
          required
        />
      </div>

      <div class="form-group">
        <label class="modal-label" for="channel-api-key">${t("addChannel.apiKeys", "API 密钥")} *</label>
        <div class="api-key-list" id="api-key-list">
          <div class="api-key-row">
            <input type="password" class="modal-input api-key-input" placeholder="${t("addChannel.addNewApiKeyPlaceholder", "输入完整的 API 密钥")}" spellcheck="false" />
            <button type="button" class="modal-icon-btn modal-icon-btn--danger" data-remove-key title="${t("addChannel.deleteKey", "删除")}">&times;</button>
          </div>
        </div>
        <button type="button" class="modal-btn modal-btn--ghost modal-btn--sm" data-add-key>
          + ${t("addChannel.addNewApiKey", "添加新的 API 密钥")}
        </button>
        <p class="form-hint">${t("addChannel.apiKeyLoadBalance", "可添加多个密钥用于负载均衡")}</p>
      </div>

      <div class="form-group">
        <label class="modal-label" for="channel-description">${t("addChannel.descriptionLabel", "描述 (可选)")}</label>
        <input
          type="text"
          id="channel-description"
          class="modal-input"
          value="${escapeHtml(description)}"
          placeholder="${t("addChannel.descriptionHint", "可选的渠道描述...")}"
        />
      </div>

      <details class="advanced-section">
        <summary class="advanced-toggle">${t("addChannel.advancedOptions", "高级选项")}</summary>
        <div class="advanced-content">
          <div class="form-group">
            <label class="modal-label" for="channel-priority">${t("addChannel.priorityLabel", "优先级")}</label>
            <input type="number" id="channel-priority" class="modal-input" value="${existingChannel?.priority ?? 0}" min="0" max="100" />
            <p class="form-hint">${t("addChannel.priorityHint", "数字越小优先级越高")}</p>
          </div>
          <div class="form-group">
            <label class="modal-label" for="channel-proxy">${t("addChannel.proxyUrlLabel", "代理 URL (可选)")}</label>
            <input type="text" id="channel-proxy" class="modal-input" placeholder="${t("addChannel.proxyUrlPlaceholder", "http://127.0.0.1:7890")}" />
          </div>
          <div class="form-group">
            <label class="modal-label" for="channel-custom-headers">${t("addChannel.customHeadersLabel", "自定义请求头")}</label>
            <textarea id="channel-custom-headers" class="modal-textarea modal-textarea--sm" rows="3" placeholder='{"X-Custom": "value"}'></textarea>
          </div>
          <div class="form-group">
            <label class="modal-label" for="channel-supported-models">${t("addChannel.supportedModelsLabel", "支持的模型")}</label>
            <input type="text" id="channel-supported-models" class="modal-input" placeholder="${t("addChannel.supportedModelsPlaceholder", "gpt-4*, *image*, !*image*")}" />
            <p class="form-hint">${t("addChannel.supportedModelsHint", "留空表示支持所有模型")}</p>
          </div>
        </div>
      </details>
    </div>
  `;
}

// ─── 完整弹窗渲染 ───

function renderChannelModal(options: {
  isEdit: boolean;
  isQuickMode: boolean;
  existingChannel?: ChannelListItemViewModel;
  parseResult: QuickInputParseResult;
  quickInputText?: string;
}): string {
  const { isEdit, isQuickMode, existingChannel, parseResult, quickInputText } = options;
  const title = isEdit
    ? t("addChannel.editTitle", "编辑渠道")
    : t("addChannel.createTitle", "添加新渠道");
  const subtitle = isEdit
    ? t("addChannel.editSubtitle", "修改渠道配置信息")
    : isQuickMode
      ? t("addChannel.quickSubtitle", "快速批量添加 API 密钥")
      : t("addChannel.fullSubtitle", "配置 API 渠道信息和密钥");

  const modeButton = isEdit ? "" : `
    <button type="button" class="modal-btn modal-btn--ghost modal-btn--sm" data-toggle-mode>
      ${isQuickMode
      ? `\u{1F4DD} ${t("addChannel.detailedMode", "详细配置")}`
      : `\u{26A1} ${t("addChannel.quickMode", "快速添加")}`
    }
    </button>
  `;

  return `
    <div class="channel-modal">
      <div class="modal-header">
        <div class="modal-header-text">
          <h2 class="modal-title">${escapeHtml(title)}</h2>
          <p class="modal-subtitle">${escapeHtml(subtitle)}</p>
        </div>
        ${modeButton}
      </div>

      <div class="modal-body">
        ${isQuickMode && !isEdit
      ? renderQuickAddMode(parseResult, quickInputText ?? "")
      : renderDetailedFormMode(existingChannel)
    }
      </div>

      <div class="modal-footer">
        <button type="button" class="modal-btn modal-btn--ghost" data-modal-close>
          ${t("app.actions.cancel", "Cancel")}
        </button>
        <button type="button" class="modal-btn modal-btn--primary" data-submit-channel>
          ${isEdit
      ? t("addChannel.updateChannel", "更新渠道")
      : t("addChannel.createChannel", "创建渠道")
    }
        </button>
      </div>
    </div>
  `;
}

// ─── 打开弹窗 ───

export interface ChannelModalCallbacks {
  onSubmit: (data: ChannelAddFormData, existingId?: string) => void;
}

/** 打开添加渠道弹窗 */
export function openAddChannelModal(callbacks: ChannelModalCallbacks): void {
  let isQuickMode = true;
  let quickInputText = "";
  let parseResult: QuickInputParseResult = {
    detectedBaseUrl: "",
    detectedBaseUrls: [],
    detectedApiKeys: [],
    detectedServiceType: null,
    generatedChannelName: "New Channel",
  };

  function render(isQuick: boolean, result: QuickInputParseResult): void {
    const body = dialog.querySelector(".modal-content");
    if (!body) return;

    // 替换内容（保留 close btn 和 backdrop）
    body.innerHTML = `
      <button type="button" class="modal-close-btn" data-modal-close aria-label="Close">&times;</button>
      ${renderChannelModal({ isEdit: false, isQuickMode: isQuick, parseResult: result, quickInputText })}
    `;
    bindModalEvents();
  }

  const dialog = openModal(
    renderChannelModal({ isEdit: false, isQuickMode: true, parseResult, quickInputText }),
    {
      className: "agentsoul-modal--channel",
      maxWidth: "640px",
    },
  );

  function bindModalEvents(): void {
    // 快速输入解析
    const textarea = dialog.querySelector<HTMLTextAreaElement>("#quick-input-textarea");
    if (textarea) {
      textarea.addEventListener("input", () => {
        const nextValue = textarea.value;
        const selectionStart = textarea.selectionStart ?? nextValue.length;
        const selectionEnd = textarea.selectionEnd ?? nextValue.length;
        quickInputText = nextValue;
        parseResult = parseQuickInput(nextValue);
        isQuickMode = true;
        render(true, parseResult);
        // 重新聚焦 textarea
        const newTextarea = dialog.querySelector<HTMLTextAreaElement>("#quick-input-textarea");
        if (newTextarea) {
          newTextarea.focus();
          const safeStart = Math.min(selectionStart, newTextarea.value.length);
          const safeEnd = Math.min(selectionEnd, newTextarea.value.length);
          newTextarea.setSelectionRange(safeStart, safeEnd);
        }
      });
    }

    // 模式切换
    dialog.querySelector("[data-toggle-mode]")?.addEventListener("click", () => {
      isQuickMode = !isQuickMode;
      render(isQuickMode, parseResult);
    });

    // 添加 API Key
    dialog.querySelector("[data-add-key]")?.addEventListener("click", () => {
      const list = dialog.querySelector("#api-key-list");
      if (!list) return;
      const row = document.createElement("div");
      row.className = "api-key-row";
      row.innerHTML = `
        <input type="password" class="modal-input api-key-input" placeholder="${t("addChannel.addNewApiKeyPlaceholder", "输入完整的 API 密钥")}" spellcheck="false" />
        <button type="button" class="modal-icon-btn modal-icon-btn--danger" data-remove-key title="${t("addChannel.deleteKey", "删除")}">&times;</button>
      `;
      list.appendChild(row);
      (row.querySelector("input") as HTMLInputElement)?.focus();
    });

    // 删除 API Key（事件委托）
    dialog.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.matches("[data-remove-key]")) {
        const row = target.closest(".api-key-row");
        if (row) row.remove();
      }
    });

    // 提交
    dialog.querySelector("[data-submit-channel]")?.addEventListener("click", () => {
      handleSubmit();
    });

    // Enter 提交
    dialog.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "TEXTAREA") {
          e.preventDefault();
          handleSubmit();
        }
      }
    });
  }

  function handleSubmit(): void {
    if (isQuickMode) {
      // 快速模式：用解析结果提交
      if (parseResult.detectedApiKeys.length === 0) {
        showToast(t("addChannel.enterApiKey", "请至少输入一个 API Key"), "error");
        return;
      }
      if (parseResult.detectedBaseUrls.length === 0 && !parseResult.detectedBaseUrl) {
        showToast(t("addChannel.enterValidUrl", "请输入有效的 URL"), "error");
        return;
      }
      callbacks.onSubmit({
        name: parseResult.generatedChannelName,
        apiType: (parseResult.detectedServiceType as ChannelApiType) ?? "openai-chat",
        baseUrl: parseResult.detectedBaseUrl,
        apiKeys: parseResult.detectedApiKeys,
        description: "",
      });
    } else {
      // 详细模式：从表单收集
      const name = (dialog.querySelector("#channel-name") as HTMLInputElement)?.value?.trim();
      const apiType = (dialog.querySelector("#channel-api-type") as HTMLSelectElement)?.value as ChannelApiType;
      const baseUrl = (dialog.querySelector("#channel-base-url") as HTMLInputElement)?.value?.trim();
      const description = (dialog.querySelector("#channel-description") as HTMLInputElement)?.value?.trim();
      const priority = parseInt((dialog.querySelector("#channel-priority") as HTMLInputElement)?.value || "0", 10);
      const proxyUrl = (dialog.querySelector("#channel-proxy") as HTMLInputElement)?.value?.trim();

      const apiKeys = Array.from(dialog.querySelectorAll<HTMLInputElement>(".api-key-input"))
        .map((input) => input.value.trim())
        .filter((k) => k.length > 0);

      if (!name) {
        showToast(t("addChannel.fieldRequired", "此字段为必填项"), "error");
        return;
      }
      if (!baseUrl) {
        showToast(t("addChannel.invalidUrl", "请输入有效的 URL"), "error");
        return;
      }
      if (apiKeys.length === 0) {
        showToast(t("addChannel.apiKeyRequired", "至少需要一个密钥"), "error");
        return;
      }

      callbacks.onSubmit({
        name,
        apiType,
        baseUrl,
        apiKeys,
        description,
        priority,
        proxyUrl: proxyUrl || undefined,
      });
    }

    closeModal();
    showToast(t("store.channel.added", "渠道添加成功"), "success");
  }

  bindModalEvents();
}

/** 打开编辑渠道弹窗 */
export function openEditChannelModal(
  channel: ChannelListItemViewModel,
  callbacks: ChannelModalCallbacks,
): void {
  const dialog = openModal(
    renderChannelModal({
      isEdit: true,
      isQuickMode: false,
      existingChannel: channel,
      parseResult: {
        detectedBaseUrl: "",
        detectedBaseUrls: [],
        detectedApiKeys: [],
        detectedServiceType: null,
        generatedChannelName: "",
      },
    }),
    {
      className: "agentsoul-modal--channel",
      maxWidth: "640px",
    },
  );

  // 绑定提交
  dialog.querySelector("[data-submit-channel]")?.addEventListener("click", () => {
    const name = (dialog.querySelector("#channel-name") as HTMLInputElement)?.value?.trim();
    const apiType = (dialog.querySelector("#channel-api-type") as HTMLSelectElement)?.value as ChannelApiType;
    const baseUrl = (dialog.querySelector("#channel-base-url") as HTMLInputElement)?.value?.trim();
    const description = (dialog.querySelector("#channel-description") as HTMLInputElement)?.value?.trim();
    const priority = parseInt((dialog.querySelector("#channel-priority") as HTMLInputElement)?.value || "0", 10);
    const proxyUrl = (dialog.querySelector("#channel-proxy") as HTMLInputElement)?.value?.trim();

    const apiKeys = Array.from(dialog.querySelectorAll<HTMLInputElement>(".api-key-input"))
      .map((input) => input.value.trim())
      .filter((k) => k.length > 0);

    if (!name || !baseUrl) {
      showToast(t("addChannel.fieldRequired", "此字段为必填项"), "error");
      return;
    }

    callbacks.onSubmit({
      name,
      apiType,
      baseUrl,
      apiKeys,
      description,
      priority,
      proxyUrl: proxyUrl || undefined,
    }, channel.id);

    closeModal();
    showToast(t("store.channel.updated", "渠道更新成功"), "success");
  });
}
