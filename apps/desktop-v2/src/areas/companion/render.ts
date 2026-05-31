/**
 * Companion Area — render functions
 * Renders the companion section of the control center with vitals,
 * interaction buttons, customization form, and growth history.
 */
import type { CompanionRuntimeSnapshot } from "../../types";
import { t, escapeHtml, resolveVisualState, faceForState, labelForInteraction } from "../../shared/utils";

function sourceTypeZh(sourceType: string): string {
  const map: Record<string, string> = {
    interaction: "互动",
    gateway: "网关",
    "work-session": "工作会话",
  };
  return map[sourceType] ?? sourceType;
}

function moodZh(mood: string): string {
  const map: Record<string, string> = {
    positive: "积极",
    neutral: "平稳",
    negative: "低落",
    fatigued: "疲惫",
    sleeping: "睡眠",
  };
  return map[mood] ?? mood;
}

function activityZh(activity: string): string {
  const map: Record<string, string> = {
    idle: "待机",
    blink: "眨眼",
    attention: "警惕",
    happy: "开心",
    sleep: "睡眠",
    degraded: "降级",
  };
  return map[activity] ?? activity;
}

function healthZh(health: string): string {
  const map: Record<string, string> = {
    healthy: "健康",
    attention: "注意",
    degraded: "降级",
  };
  return map[health] ?? health;
}

function presenceZh(presence: string): string {
  const map: Record<string, string> = {
    ACTIVE: "正在交互",
    PRESENT: "在电脑前",
    IDLE: "短暂离开",
    AWAY: "长时间离开",
    OFFLINE: "应用关闭",
  };
  return map[presence] ?? presence;
}

function companionModeZh(mode: string): string {
  const map: Record<string, string> = {
    AUTONOMOUS: "自主",
    CONVERSING: "对话中",
    THINKING: "思考中",
    QUEUING: "等待输出",
    SLEEPING: "睡眠",
    INTRUDING: "主动打断",
  };
  return map[mode] ?? mode;
}

function outputStrategyZh(strategy: string): string {
  const map: Record<string, string> = {
    silent: "静默",
    queue: "排队",
    express: "表达",
    interrupt: "打断",
  };
  return map[strategy] ?? strategy;
}

function priorityZh(priority: string): string {
  const map: Record<string, string> = {
    LOW: "低",
    MEDIUM: "中",
    HIGH: "高",
    CRITICAL: "关键",
  };
  return map[priority] ?? priority;
}

export function renderCompanionViewModel(
  snapshot: CompanionRuntimeSnapshot,
  _tabOverride?: string,
  pendingApproval?: unknown,
  riskNotices?: unknown[],
) {
  const { companion } = snapshot;
  const kindVal = t(`appearance.${companion.petAppearance.kind}`, companion.petAppearance.kind);
  const skinVal = t(`appearance.${companion.petAppearance.skin}`, companion.petAppearance.skin);
  const visualState = resolveVisualState(snapshot);
  const outfit = companion.petAppearance.outfit ? ` + ${companion.petAppearance.outfit}` : "";

  return {
    viewModelKind: "Companion appearance view model" as const,
    identity: companion.id,
    name: companion.displayName,
    appearanceLabel: `${t("companion.appearance", "Pet Appearance")}: ${kindVal} / ${skinVal}${outfit}`,
    visualState,
    providerRouteLabel: `${t("gateway.activeProvider", "Active Provider Profile")}: ${snapshot.providerProfile.name}`,
    vitals: [
      { label: t("companion.level", "Level"), value: String(companion.vitals.level) },
      { label: t("companion.xp", "XP"), value: String(companion.vitals.xp) },
      { label: t("companion.energy", "Energy"), value: `${companion.vitals.companionEnergy}%` },
      { label: t("companion.hunger", "Hunger"), value: `${companion.vitals.hunger}%` },
      { label: t("companion.intimacy", "Intimacy"), value: `${companion.vitals.intimacy}%` },
    ],
    customization: snapshot.companionCustomization,
    growthHistory: snapshot.growthHistory,
    pendingApproval: pendingApproval ?? null,
    riskNotices: riskNotices ?? [],
    controlCenterCompanionArea: { areaKind: "Control Center Companion Area" },
    controlCenterGatewayArea: { areaKind: "Control Center Gateway Area" },
    controlCenterCostsArea: { areaKind: "Control Center Costs Area" },
    controlCenterSkillsArea: { areaKind: "Control Center Skills Area" },
    controlCenterSessionsArea: { areaKind: "Control Center Sessions Area" },
    controlCenterSafetyArea: { areaKind: "Control Center Safety Area" },
    controlCenterSettingsArea: { areaKind: "Control Center Settings Area" },
  };
}

export function renderCompanionArea(snapshot: CompanionRuntimeSnapshot): string {
  const vm = renderCompanionViewModel(snapshot);
  const cust = vm.customization;
  const recentGrowth = vm.growthHistory.slice(-8).map((event) => ({
    description: event.description,
    sourceType: event.sourceType,
    xpDelta: event.xpDelta,
    occurredAt: event.occurredAt,
  }));
  const soulProfile = {
    soulId: snapshot.companion.soulId,
    displayName: snapshot.companion.displayName,
    mood: snapshot.companion.mood,
    activityState: snapshot.companion.activityState ?? resolveVisualState(snapshot),
    healthState: snapshot.companion.healthState ?? "attention",
    summary: snapshot.companion.summary ?? "",
  };
  const memoryProfile = {
    workingMemory: recentGrowth.slice(-3).map((event) => ({
      ...event,
      sourceType: sourceTypeZh(event.sourceType),
    })),
    episodicMemory: recentGrowth.map((event) => ({
      ...event,
      sourceType: sourceTypeZh(event.sourceType),
    })),
    semanticMemory: [
      `偏好语言：${snapshot.appSettings.language === "zh" ? "中文" : "English"}`,
      `活跃客户端：${snapshot.appSwitcher.appNames[snapshot.appSwitcher.activeApp] ?? snapshot.appSwitcher.activeApp}`,
      `最近互动次数：${recentGrowth.length}`,
    ],
    lastUpdatedAt: snapshot.companion.lastUpdatedAt ?? "",
  };
  const memoryProfileZh = {
    工作记忆: memoryProfile.workingMemory.map((event) => ({
      描述: event.description,
      来源: event.sourceType,
      经验变化: event.xpDelta,
      发生时间: event.occurredAt,
    })),
    情景记忆: memoryProfile.episodicMemory.map((event) => ({
      描述: event.description,
      来源: event.sourceType,
      经验变化: event.xpDelta,
      发生时间: event.occurredAt,
    })),
    语义记忆: memoryProfile.semanticMemory,
    最后更新时间: memoryProfile.lastUpdatedAt || "-",
  };
  const masterCognition = {
    masterName: "未设置",
    nickname: "未设置",
    preferredLanguage: snapshot.appSettings.language === "zh" ? "中文" : "English",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "未设置",
    interests: memoryProfile.semanticMemory.slice(0, 2),
    hobbies: ["未设置"],
    heightCm: "未设置",
    weightKg: "未设置",
    communicationStyle: "待观察",
    responsePreference: "待观察",
  };
  const soulProfileZh = {
    灵魂ID: soulProfile.soulId,
    伙伴名称: soulProfile.displayName,
    心情: moodZh(String(soulProfile.mood)),
    活动状态: activityZh(String(soulProfile.activityState)),
    健康状态: healthZh(String(soulProfile.healthState)),
    状态摘要: soulProfile.summary || "-",
  };
  const autonomy = snapshot.companion.autonomy ?? {
    userPresence: "PRESENT",
    companionMode: "AUTONOMOUS",
    lastEventPriority: "LOW",
    lastOutputStrategy: "silent",
    queuedOutputCount: 0,
    lastAction: "reflect-and-update-affect",
  };
  const autonomyZh = {
    用户存在: presenceZh(autonomy.userPresence),
    伴侣模式: companionModeZh(autonomy.companionMode),
    最近事件优先级: priorityZh(autonomy.lastEventPriority ?? "LOW"),
    输出策略: outputStrategyZh(autonomy.lastOutputStrategy ?? "silent"),
    队列数量: autonomy.queuedOutputCount,
    最近行动: autonomy.lastAction ?? "-",
  };
  return `
    <section id="control-center-companion" class="control-center-area control-center-companion-area" data-control-area="companion" aria-label="Control Center Companion Area">
      <div class="control-area-header">
        <p class="eyebrow">${t("common.controlCenter", "Control Center")}</p>
        <h2>${t("companion.title", "Companion Area")}</h2>
        <p>${t("companion.mood", "Mood")}: ${escapeHtml(moodZh(String(snapshot.companion.mood)))} . ${escapeHtml(vm.appearanceLabel)}</p>
      </div>
      <dl class="control-vitals">
        ${vm.vitals.map((vital) => `
          <div class="control-vital">
            <dt>${escapeHtml(vital.label)}</dt>
            <dd>${escapeHtml(vital.value)}</dd>
          </div>
        `).join("")}
      </dl>
      <div class="control-interactions" aria-label="Companion interactions">
        <button type="button" data-interaction="feed">${t("common.feed", "Feed")}</button>
        <button type="button" data-interaction="play">${t("common.play", "Play")}</button>
        <button type="button" data-interaction="pet">${t("common.pet", "Pet")}</button>
        <button type="button" data-interaction="sleep">${t("common.sleep", "Sleep")}</button>
      </div>

      <div class="companion-customization" aria-label="Companion Customization">
        <h3>${t("companion.appearance", "Appearance")}</h3>
        <div class="customization-form">
          <div class="form-group">
            <label class="modal-label" for="companion-display-name">${t("companion.displayName", "Display Name")}</label>
            <input type="text" id="companion-display-name" class="modal-input" data-companion-field="displayName" value="${escapeHtml(cust.displayName)}" />
          </div>
          <div class="form-group">
            <label class="modal-label">${t("companion.kind", "Appearance Kind")}</label>
            <select class="modal-select" data-companion-field="kind">
              ${cust.availableKinds.map((k) => '<option value="' + k.kind + '"' + (k.kind === cust.currentKind ? " selected" : "") + '>' + escapeHtml(k.labelZh) + ' / ' + escapeHtml(k.label) + '</option>').join("")}
            </select>
          </div>
          <div class="form-group">
            <label class="modal-label">${t("companion.skin", "Skin")}</label>
            <div class="skin-preview">
              ${cust.availableSkins.filter((s) => s.kind === cust.currentKind).map((s) => '<button type="button" class="skin-option' + (s.skin === cust.currentSkin ? " skin-option--active" : "") + '" data-skin-select="' + s.skin + '">' + escapeHtml(s.labelZh) + '</button>').join("")}
            </div>
          </div>
          <div class="form-group">
            <label class="modal-label">${t("companion.assetPackPath", "形象资源包路径")}</label>
            <input type="text" class="modal-input" data-companion-asset-pack-path value="${escapeHtml(snapshot.companion.petAppearance.assetPackPath || "")}" readonly />
            <div class="settings-actions" style="margin-top:8px;">
              <button type="button" class="modal-btn modal-btn--ghost" data-companion-pick-pack>
                ${t("companion.pickAssetPack", "选择文件夹")}
              </button>
              <button type="button" class="modal-btn modal-btn--primary" data-companion-apply-pack>
                ${t("companion.applyAssetPack", "更换形象")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <section class="growth-history" aria-label="Growth Events">
        <h3>${t("companion.growthHistory", "Growth Events")}</h3>
        ${vm.growthHistory.slice(-5).map((event) => `
          <article class="growth-event">
            <p>${escapeHtml(event.description)}</p>
            <span>${escapeHtml(t("companion.sourceType." + event.sourceType, event.sourceType))} . XP ${event.xpDelta >= 0 ? "+" : ""}${event.xpDelta} . ${escapeHtml(event.occurredAt)}</span>
          </article>
        `).join("")}
      </section>

      <section class="companion-profile-panel" aria-label="Companion Soul Memory Cognition">
        <h3>${t("companion.profilePanel", "伴侣档案（可直看）")}</h3>
        <p class="companion-profile-note">${t("companion.profilePanelDesc", "直接暴露当前运行时中的灵魂、三层记忆、对 Master 的认知。")}</p>

        <div class="companion-profile-grid">
          <article class="companion-profile-card">
            <h4>${t("companion.soulFile", "灵魂")}</h4>
            <table class="companion-knowledge-table">
              <tbody>
                <tr><th>灵魂ID</th><td>${escapeHtml(soulProfile.soulId)}</td></tr>
                <tr><th>伙伴名称</th><td>${escapeHtml(soulProfile.displayName)}</td></tr>
                <tr><th>心情</th><td>${escapeHtml(moodZh(String(soulProfile.mood)))}</td></tr>
                <tr><th>活动状态</th><td>${escapeHtml(activityZh(String(soulProfile.activityState)))}</td></tr>
                <tr><th>健康状态</th><td>${escapeHtml(healthZh(String(soulProfile.healthState)))}</td></tr>
                <tr><th>状态摘要</th><td>${escapeHtml(String(soulProfile.summary || "-"))}</td></tr>
              </tbody>
            </table>
            <pre class="companion-raw-json">${escapeHtml(JSON.stringify(soulProfileZh, null, 2))}</pre>
          </article>

          <article class="companion-profile-card">
            <h4>${t("companion.memoryFile", "记忆")}</h4>
            <table class="companion-knowledge-table">
              <tbody>
                <tr><th>工作记忆</th><td>${memoryProfile.workingMemory.length}</td></tr>
                <tr><th>情景记忆</th><td>${memoryProfile.episodicMemory.length}</td></tr>
                <tr><th>语义记忆</th><td>${memoryProfile.semanticMemory.length}</td></tr>
                <tr><th>${t("companion.memoryLastUpdatedAt", "最后更新时间")}</th><td>${escapeHtml(memoryProfile.lastUpdatedAt || "-")}</td></tr>
              </tbody>
            </table>
            <pre class="companion-raw-json">${escapeHtml(JSON.stringify(memoryProfileZh, null, 2))}</pre>
          </article>

          <article class="companion-profile-card">
            <h4>${t("companion.masterCognition", "对 Master 的认知")}</h4>
            <table class="companion-knowledge-table">
              <tbody>
                <tr><th>Master 名称</th><td>${escapeHtml(masterCognition.masterName)}</td></tr>
                <tr><th>称呼</th><td>${escapeHtml(masterCognition.nickname)}</td></tr>
                <tr><th>偏好语言</th><td>${escapeHtml(masterCognition.preferredLanguage)}</td></tr>
                <tr><th>时区</th><td>${escapeHtml(masterCognition.timezone)}</td></tr>
                <tr><th>兴趣</th><td>${escapeHtml(masterCognition.interests.join("、"))}</td></tr>
                <tr><th>爱好</th><td>${escapeHtml(masterCognition.hobbies.join("、"))}</td></tr>
                <tr><th>身高</th><td>${escapeHtml(masterCognition.heightCm)}</td></tr>
                <tr><th>体重</th><td>${escapeHtml(masterCognition.weightKg)}</td></tr>
                <tr><th>沟通风格</th><td>${escapeHtml(masterCognition.communicationStyle)}</td></tr>
                <tr><th>响应偏好</th><td>${escapeHtml(masterCognition.responsePreference)}</td></tr>
              </tbody>
            </table>
            <pre class="companion-raw-json">${escapeHtml(JSON.stringify({
              Master名称: masterCognition.masterName,
              称呼: masterCognition.nickname,
              偏好语言: masterCognition.preferredLanguage,
              时区: masterCognition.timezone,
              兴趣: masterCognition.interests,
              爱好: masterCognition.hobbies,
              身高: masterCognition.heightCm,
              体重: masterCognition.weightKg,
              沟通风格: masterCognition.communicationStyle,
              响应偏好: masterCognition.responsePreference,
            }, null, 2))}</pre>
          </article>

          <article class="companion-profile-card">
            <h4>${t("companion.autonomousLoop", "自主循环")}</h4>
            <table class="companion-knowledge-table">
              <tbody>
                <tr><th>用户存在</th><td>${escapeHtml(autonomyZh.用户存在)}</td></tr>
                <tr><th>伴侣模式</th><td>${escapeHtml(autonomyZh.伴侣模式)}</td></tr>
                <tr><th>最近事件优先级</th><td>${escapeHtml(autonomyZh.最近事件优先级)}</td></tr>
                <tr><th>输出策略</th><td>${escapeHtml(autonomyZh.输出策略)}</td></tr>
                <tr><th>队列数量</th><td>${escapeHtml(String(autonomyZh.队列数量))}</td></tr>
                <tr><th>最近行动</th><td>${escapeHtml(autonomyZh.最近行动)}</td></tr>
              </tbody>
            </table>
            <pre class="companion-raw-json">${escapeHtml(JSON.stringify(autonomyZh, null, 2))}</pre>
          </article>
        </div>

        <details class="companion-profile-raw">
          <summary>${t("companion.rawRuntime", "查看完整运行时原文（JSON）")}</summary>
          <pre class="companion-raw-json">${escapeHtml(JSON.stringify({
            灵魂: soulProfileZh,
            记忆: memoryProfileZh,
            对Master认知: {
              Master名称: masterCognition.masterName,
              称呼: masterCognition.nickname,
              偏好语言: masterCognition.preferredLanguage,
              时区: masterCognition.timezone,
              兴趣: masterCognition.interests,
              爱好: masterCognition.hobbies,
              身高: masterCognition.heightCm,
              体重: masterCognition.weightKg,
              沟通风格: masterCognition.communicationStyle,
              响应偏好: masterCognition.responsePreference,
            },
            自主循环: autonomyZh,
          }, null, 2))}</pre>
        </details>
      </section>
    </section>
  `;
}
