export type CompanionVisualState = "idle" | "positive" | "fatigue" | "sleep" | "attention";
export type CompanionInteractionKind = "feed" | "play" | "pet" | "sleep";
export type CompanionInteractionOutcome = "applied" | "blocked-low-energy";
export type DesktopApprovalDecisionKind = "allowed" | "denied";

export interface PetAppearanceSnapshot {
  kind: "slime" | "cat" | "custom";
  skin: string;
  outfit?: string;
  animationStyle?: string;
  assetPackId?: string;
  assetPackPath?: string;
  displayName?: string;
  spritesheetPath?: string;
  assetPackVersion?: string;
  assetValidation?: AssetValidationSnapshot;
  assetManifest?: PetAssetPackManifest;
}

export type CompanionActivityState =
  | "idle"
  | "blink"
  | "attention"
  | "happy"
  | "sleep"
  | "degraded";

export type CompanionQuickAction =
  | "open-control-center"
  | "refresh-runtime"
  | "hide-companion"
  | "show-status";

export type PetStateName = "idle" | "blink" | "happy" | "attention" | "sleep" | "degraded";

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FrameSequence {
  frames?: number[];
  rects?: FrameRect[];
  loop: boolean;
  fps?: number;
}

export interface PetAssetPackManifest {
  id: string;
  displayName: string;
  description?: string;
  spritesheetPath: string;
  kind: string;
  version?: string;
  frame?: {
    width: number;
    height: number;
    count?: number;
  };
  states?: Partial<Record<PetStateName, FrameSequence>>;
  fps?: number;
  chromaKey?: string;
  anchor?: {
    x: number;
    y: number;
  };
}

export interface AssetValidationSnapshot {
  level: "ok" | "warning" | "error";
  messages: string[];
}

export interface CompanionRuntimeSnapshot {
  companion: {
    id: string;
    displayName: string;
    soulId: string;
    petAppearance: PetAppearanceSnapshot;
    mood: "positive" | "neutral" | "negative" | "fatigued" | "sleeping";
    vitals: {
      level: number;
      xp: number;
      companionEnergy: number;
      hunger: number;
      intimacy: number;
    };
    activityState?: CompanionActivityState;
    healthState?: "healthy" | "attention" | "degraded";
    summary?: string;
    availableQuickActions?: CompanionQuickAction[];
    lastUpdatedAt?: string;
  };
  providerProfile: {
    id: string;
    name: string;
  };
  gateway: GatewayAreaSnapshot;
  costs: CostsAreaSnapshot;
  skills: SkillsAreaSnapshot;
  sessions: SessionsAreaSnapshot;
  safety: SafetyAreaSnapshot;
  settings: SettingsAreaSnapshot;
  growthHistory: GrowthHistoryItem[];
  channels: ChannelListItemViewModel[];
  dashboardStats: DashboardStatsSnapshot;
  keyTrend: KeyTrendSnapshot;
  modelStats: ModelStatsSnapshot;
  appSwitcher: AppSwitcherSnapshot;
  usageFooter: UsageFooterSnapshot;
  backupList: BackupListSnapshot;
  webdavSync: WebdavSyncSnapshot;
  deepLinkImport: DeepLinkImportSnapshot;
  companionCustomization: CompanionCustomizationSnapshot;
  personaTemplates: PersonaTemplateSnapshot[];
  localSessions: SessionListItemViewModel[];
  conversationDashboard: ConversationDashboardSnapshot;
  mcpServers: McpServerViewModel[];
  prompts: PromptTemplateViewModel[];
  appSettings: AppSettingsSnapshot;
}

export interface CompanionViewModel {
  viewModelKind: "Companion appearance view model";
  identity: string;
  name: string;
  appearanceLabel: string;
  visualState: CompanionVisualState;
  providerRouteLabel: string;
  lastInteractionStatus?: string;
  pendingApproval?: DesktopApprovalRequest;
  riskNotices: DesktopRiskNotice[];
  vitals: Array<{ label: string; value: string }>;
  controlCenterCompanionArea: ControlCenterCompanionAreaViewModel;
  controlCenterGatewayArea: ControlCenterGatewayAreaViewModel;
  controlCenterCostsArea: ControlCenterCostsAreaViewModel;
  controlCenterSkillsArea: ControlCenterSkillsAreaViewModel;
  controlCenterSessionsArea: ControlCenterSessionsAreaViewModel;
  controlCenterSafetyArea: ControlCenterSafetyAreaViewModel;
  controlCenterSettingsArea: ControlCenterSettingsAreaViewModel;
}

export interface GrowthHistoryItem {
  id: string;
  sourceType: "interaction" | "gateway" | "work-session";
  description: string;
  xpDelta: number;
  occurredAt: string;
}

export interface ControlCenterCompanionAreaViewModel {
  areaKind: "Control Center Companion Area";
  name: string;
  moodLabel: string;
  appearanceLabel: string;
  vitals: Array<{ label: string; value: string }>;
  interactions: Array<{ kind: CompanionInteractionKind; label: string }>;
  growthHistory: GrowthHistoryItem[];
  customization: CompanionCustomizationSnapshot;
}

export interface GatewayAreaSnapshot {
  routeHealth: "ready" | "not-ready" | "unsupported-route";
  activeProviderName: string;
  activationMode: "gateway-route" | "direct-client-config";
  clientProtocol: string;
  providerProtocol: string;
  targetModel: string;
  adapterSupport: "supported" | "unsupported";
  fallbackStatus: "not-needed" | "available" | "active";
}

export interface CostsAreaSnapshot {
  estimatedCostUsd: number;
  providerUsageUsd?: number;
  inputTokens: number;
  outputTokens: number;
  averageLatencyMs: number;
  providerMix: Array<{ provider: string; percent: number }>;
  modelMix: Array<{ model: string; percent: number }>;
}

export interface ControlCenterGatewayAreaViewModel extends GatewayAreaSnapshot {
  areaKind: "Control Center Gateway Area";
  channels: ChannelListItemViewModel[];
  dashboardStats: DashboardStatsSnapshot;
}

export interface ControlCenterCostsAreaViewModel extends CostsAreaSnapshot {
  areaKind: "Control Center Costs Area";
  estimatedCostLabel: string;
  providerUsageLabel: string;
  tokenUsageLabel: string;
  latencyLabel: string;
  channels: ChannelListItemViewModel[];
  dashboardStats: DashboardStatsSnapshot;
}

export interface SkillsAreaSnapshot {
  projectPath: string;
  installedSkillPacks: Array<{
    id: string;
    name: string;
    source: string;
    installedAt: string;
  }>;
  projectActivations: Array<{
    skillPackId: string;
    enabled: boolean;
    source: "project" | "global-default";
  }>;
  workspaceRuleDeployments: Array<{
    skillPackId: string;
    status: "not-deployed" | "deployed" | "approval-required";
    managedRuleFiles: Array<{
      targetPath: string;
      method: "symlink" | "copy";
    }>;
  }>;
}

export interface ControlCenterSkillsAreaViewModel extends SkillsAreaSnapshot {
  areaKind: "Control Center Skills Area";
  deploymentSafetyAction: "deploy-workspace-rules";
}

export interface SessionsAreaSnapshot {
  query: {
    keyword: string;
    projectPath?: string;
    source?: string;
    client?: string;
  };
  workSessions: Array<{
    id: string;
    source: string;
    client: string;
    projectPath: string;
    lastActiveAt: string;
    evidenceSummary: string;
    searchable: boolean;
    resumable: boolean;
    resumeCommand?: string;
  }>;
}

export interface ControlCenterSessionsAreaViewModel extends SessionsAreaSnapshot {
  areaKind: "Control Center Sessions Area";
  searchLabel: "Work Session search";
  launcherLabel: "safety-gated Session Launcher";
  launchSafetyAction: "launch-session";
}

export interface SafetyAreaSnapshot {
  clientAuthorizationMode: "normal" | "elevated" | "fully-authorized";
  approvalRequests: Array<DesktopApprovalRequest & { status: "Approval Required" | "allowed" | "denied" | "timeout-denied" }>;
  riskNotices: DesktopRiskNotice[];
  scopedTrustGrants: Array<{
    id: string;
    actionKinds: string[];
    projectPath?: string;
    clientId?: string;
    maxRiskClass: "high-risk" | "critical";
    expiresAt: string;
    revokedAt?: string;
  }>;
  actionRiskClasses: Array<{
    actionKind: string;
    riskClass: "safe" | "sensitive" | "high-risk" | "critical";
  }>;
}

export interface ControlCenterSafetyAreaViewModel extends SafetyAreaSnapshot {
  areaKind: "Control Center Safety Area";
}

export interface SettingsAreaSnapshot {
  localFirstStatus: "enabled";
  cloudLoginRequired: false;
  portableExportStatus: "available";
  sensitiveExportSafetyAction: "export-secret";
  remoteSyncStatus: "out-of-core-scope" | "disabled";
  growthProfile: {
    name: string;
    xpMultiplier: number;
    energyCostMultiplier: number;
    fatigueThreshold: number;
    maxXpPerEvent: number;
    maxEnergyCostPerEvent: number;
  };
}

export interface ControlCenterSettingsAreaViewModel extends SettingsAreaSnapshot {
  areaKind: "Control Center Settings Area";
  personaTemplates: PersonaTemplateSnapshot[];
  customization: CompanionCustomizationSnapshot;
}

export interface DesktopApprovalRequest {
  id: string;
  title: string;
  message: string;
  actionRiskClass: "safe" | "sensitive" | "high-risk" | "critical";
  createdAt: string;
}

export interface DesktopRiskNotice {
  id: string;
  message: string;
  observedAt: string;
  clientAuthorizationMode: "normal" | "elevated" | "fully-authorized";
}

export interface CompanionInteractionResult {
  outcome: CompanionInteractionOutcome;
  state: CompanionRuntimeSnapshot;
}

export interface DesktopCompanionController {
  render(snapshot?: CompanionRuntimeSnapshot, status?: string): void;
  performInteraction(kind: CompanionInteractionKind): Promise<void>;
  decideApproval(kind: DesktopApprovalDecisionKind): Promise<void>;
}

export interface LocalControlClientLike {
  setAccessKey(accessKey?: string): void;
  loadSnapshot(): Promise<CompanionRuntimeSnapshot>;
  createChannel(input: {
    name: string;
    type: string;
    baseUrl: string;
    apiKeys?: string[];
    description?: string;
    priority?: number;
    supportedModels?: string[];
  }): Promise<ChannelListItemViewModel>;
  updateChannel(id: string, input: Partial<{
    name: string;
    type: string;
    baseUrl: string;
    apiKeys?: string[];
    description?: string;
    priority?: number;
    supportedModels?: string[];
    status?: ChannelStatus;
  }>): Promise<ChannelListItemViewModel>;
  deleteChannel(id: string): Promise<void>;
  pingChannel(id: string): Promise<{ reachable: boolean; statusCode: number; latencyMs: number; error?: string }>;
  fetchDashboardStats(): Promise<DashboardStatsSnapshot>;
  createMcpServer(input: { name: string; command: string; args?: string[]; env?: Record<string, string> }): Promise<McpServerViewModel | null>;
  toggleMcpServer(id: string): Promise<McpServerViewModel | null>;
  deleteMcpServer(id: string): Promise<void>;
  listSessions(): Promise<SessionListItemViewModel[]>;
  resumeSession(id: string): Promise<{ success: boolean; message: string }>;
  deleteSession(id: string): Promise<void>;
  listBackups(): Promise<BackupEntry[]>;
  createBackup(name?: string, description?: string): Promise<BackupEntry | null>;
  deleteBackup(id: string): Promise<void>;
  restoreBackup(id: string): Promise<boolean>;
  listApprovalRequests(): Promise<Array<{ id: string; title: string; message: string; actionRiskClass: string; createdAt: string; status: string }>>;
  approveRequest(id: string): Promise<boolean>;
  denyRequest(id: string): Promise<boolean>;
  listRiskNotices(): Promise<Array<{ id: string; message: string; observedAt: string; clientAuthorizationMode: string }>>;
  listTrustGrants(): Promise<Array<{ id: string; actionKinds: string[]; projectPath?: string; clientId?: string; maxRiskClass: string; expiresAt: string; revokedAt?: string }>>;
  revokeTrustGrant(id: string): Promise<boolean>;
  listPrompts(): Promise<PromptTemplateViewModel[]>;
  createPrompt(input: { name: string; nameZh?: string; content: string; category?: string; tags?: string[] }): Promise<PromptTemplateViewModel | null>;
  togglePromptFavorite(id: string, isFavorite?: boolean): Promise<PromptTemplateViewModel | null>;
  deletePrompt(id: string): Promise<void>;
  getSkillsState(): Promise<SkillsAreaSnapshot | null>;
  saveSkillsState(skills: SkillsAreaSnapshot): Promise<boolean>;
  saveAppSettings(settings: AppSettingsSnapshot): Promise<boolean>;
}

export interface DesktopCompanionControllerOptions {
  target: HTMLElement;
  shellMode?: "desktop-companion" | "control-center";
  initialSnapshot?: CompanionRuntimeSnapshot;
  initialPendingApproval?: DesktopApprovalRequest;
  initialRiskNotices?: DesktopRiskNotice[];
  controlClient?: LocalControlClientLike;
  gatewayAvailable?: boolean;
  performInteraction: (kind: CompanionInteractionKind) => Promise<CompanionInteractionResult>;
  decideApproval?: (
    requestId: string,
    kind: DesktopApprovalDecisionKind,
  ) => Promise<{ decidedAt: string }>;
}

export interface NativeCompanionRuntimeState {
  companion?: Partial<CompanionRuntimeSnapshot["companion"]>;
  providerProfile?: Partial<CompanionRuntimeSnapshot["providerProfile"]>;
  approvalSurface?: {
    approvalRequiredPlaceholder?: string;
    riskNoticePlaceholder?: string;
  };
}

// ─── 渠道管理类型 (仿照 CCX Channel Orchestration) ───

export type ChannelApiType = "claude" | "codex" | "openai-chat" | "gemini";
export type ChannelStatus = "active" | "suspended" | "disabled" | "healthy" | "error";
export type CircuitState = "closed" | "open" | "half_open";

export interface ChannelListItemViewModel {
  id: string;
  name: string;
  apiType: ChannelApiType;
  baseUrl: string;
  priority: number;
  status: ChannelStatus;
  circuitState: CircuitState;
  requestCount: number;
  successRate: number;
  averageLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  description?: string;
  supportedModels?: string[];
  consecutiveFailures: number;
  lastRequestAt?: string;
}

export interface ChannelAddFormData {
  name: string;
  apiType: ChannelApiType;
  baseUrl: string;
  apiKeys: string[];
  description?: string;
  priority?: number;
  supportedModels?: string[];
  modelMapping?: Record<string, string>;
  customHeaders?: Record<string, string>;
  proxyUrl?: string;
}

export interface DashboardStatsSnapshot {
  totalChannels: number;
  activeChannels: number;
  totalRequests: number;
  totalEstimatedCost: number;
  overallSuccessRate: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

// ─── Companion 自定义类型 ───

export type PetKind = "slime" | "cat" | "custom";
export type PetSkin = "default" | "tabby" | "black" | "calico" | "night" | "sakura";

export interface CompanionCustomizationSnapshot {
  availableKinds: Array<{ kind: PetKind; label: string; labelZh: string }>;
  availableSkins: Array<{ skin: PetSkin; label: string; labelZh: string; kind: PetKind }>;
  currentKind: PetKind;
  currentSkin: PetSkin;
  currentOutfit?: string;
  displayName: string;
}

export interface PersonaTemplateSnapshot {
  id: string;
  name: string;
  nameZh: string;
  role: string;
  personality: string[];
  description: string;
  descriptionZh: string;
}

// ═══════════════════════════════════════════════════════════════════════
// cc-switch 功能类型 — Provider 健康、Session 管理、MCP、Prompt、Settings
// ═══════════════════════════════════════════════════════════════════════

// ─── Session 管理 (仿照 cc-switch SessionManagerPage) ───

export type SessionProvider = "claude-code" | "codex" | "gemini-cli" | "agentsoul";

export interface SessionListItemViewModel {
  id: string;
  provider: SessionProvider;
  projectDir: string;
  summary?: string;
  lastActiveAt: string;
  messageCount: number;
  isResumable: boolean;
  resumeCommand?: string;
  filePath?: string;
  tags?: string[];
}

export interface SessionDetailViewModel extends SessionListItemViewModel {
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
  }>;
  metadata?: Record<string, string>;
}

// ─── MCP Server 管理 (仿照 cc-switch UnifiedMcpPanel) ───

export type McpServerStatus = "running" | "stopped" | "error" | "unknown";

export interface McpServerViewModel {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  status: McpServerStatus;
  toolCount?: number;
  lastStartedAt?: string;
  errorMessage?: string;
}

// ─── Prompt 管理 (仿照 cc-switch PromptPanel) ───

export interface PromptTemplateViewModel {
  id: string;
  name: string;
  nameZh?: string;
  content: string;
  category?: string;
  tags?: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Settings 扩展 (仿照 cc-switch SettingsPage) ───

export interface SettingsSnapshot {
  language: "zh" | "en";
  theme: "dark" | "light" | "system";
  terminalDefault: string;
  proxyEnabled: boolean;
  proxyUrl?: string;
  autoFailover: boolean;
  failoverThreshold: number;
  maxConcurrentSessions: number;
  sessionRetentionDays: number;
  mcpAutoStart: boolean;
  telemetryEnabled: boolean;
}

// ─── CompanionRuntimeSnapshot 扩展 ───

// ─── 完整 Settings 类型 (仿照 cc-switch SettingsPage) ───
// prompts: PromptTemplateViewModel[];
// settings: SettingsSnapshot;

// ─── 完整 Settings 类型 (仿照 cc-switch SettingsPage) ───

export interface AppSettingsSnapshot {
  // 通用
  language: "zh" | "en";
  theme: "dark" | "light" | "system";
  startupBehavior: "restore" | "fresh" | "minimized";
  closeBehavior: "close" | "minimize" | "quit";
  checkUpdates: boolean;
  
  // 终端
  terminalDefault: string;
  terminalShellPath: string;
  terminalFontSize: number;
  
  // 代理
  proxyEnabled: boolean;
  proxyUrl: string;
  gatewayAccessKey: string;
  proxyAuth?: { username: string; password: string };
  
  // 故障转移
  autoFailover: boolean;
  failoverThreshold: number;
  circuitBreakerTimeout: number;
  
  // 会话
  maxConcurrentSessions: number;
  sessionRetentionDays: number;
  sessionAutoSave: boolean;
  
  // MCP
  mcpAutoStart: boolean;
  mcpDefaultTimeout: number;
  
  // 目录
  workspaceDir: string;
  dataDir: string;
  logDir: string;
  
  // 隐私
  telemetryEnabled: boolean;
  crashReporting: boolean;
  
  // 外观
  fontSize: number;
  fontFamily: string;
  accentColor: string;
  glassOpacity: number;
  
  // 导入导出
  lastBackupAt?: string;
  autoBackup: boolean;
  autoBackupInterval: number;
}

// ─── 渠道日志 (仿照 CCX ChannelLogsDialog) ───

export type LogRequestStatus = "pending" | "connecting" | "first_byte" | "streaming" | "completed" | "failed" | "cancelled";

export interface ChannelLogEntry {
  timestamp: string;
  statusCode: number;
  status: LogRequestStatus;
  interfaceType?: string;
  operation?: string;
  model: string;
  originalModel?: string;
  keyMask: string;
  baseUrl?: string;
  durationMs: number;
  connectMs?: number;
  firstByteMs?: number;
  totalMs?: number;
  isRetry?: boolean;
  errorInfo?: string;
  requestSource?: string;
  tokens?: { input: number; output: number };
}

// ─── 能力测试 (仿照 CCX CapabilityTestDialog) ───

export type CapabilityTestStatus = "idle" | "running" | "completed" | "failed" | "cancelled";

export interface CapabilityTestResult {
  protocol: string;
  model: string;
  success: boolean;
  latencyMs: number;
  streamingSupported: boolean;
  error?: string;
  testedAt: string;
}

export interface CapabilityTestJob {
  jobId: string;
  channelName: string;
  status: CapabilityTestStatus;
  results: CapabilityTestResult[];
  totalModels: number;
  completedModels: number;
  startedAt: string;
  finishedAt?: string;
}

// ─── 全局统计图表 (仿照 CCX GlobalStatsChart) ───

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
}

export interface GlobalStatsSnapshot {
  trafficHistory: TimeSeriesDataPoint[];
  tokenHistory: TimeSeriesDataPoint[];
  costHistory: TimeSeriesDataPoint[];
  successRateHistory: TimeSeriesDataPoint[];
  topModels: Array<{ model: string; requestCount: number; percentage: number }>;
  topProviders: Array<{ provider: string; requestCount: number; costUsd: number }>;
  hourlyTraffic: Array<{ hour: string; requests: number; failures: number }>;
}

// ═══════════════════════════════════════════════════════════════════════
// CCX 会话驾驶舱 (仿照 ConversationDashboard)
// ═══════════════════════════════════════════════════════════════════════

export type ConversationKind = "messages" | "chat" | "images" | "responses" | "gemini";
export type ConversationStatus = "active" | "idle" | "completed" | "error";

export interface ConversationInfo {
  id: string;
  kind: ConversationKind;
  title: string;
  channelName?: string;
  status: ConversationStatus;
  messageCount: number;
  lastActivityAt: string;
  startedAt: string;
  model?: string;
  tokensUsed?: number;
  estimatedCost?: number;
}

export interface ConversationDashboardSnapshot {
  conversations: ConversationInfo[];
  activeFilter: ConversationKind | "";
  searchQuery: string;
  systemStatus: "online" | "degraded" | "offline";
  overrideCount: number;
}

// ═══════════════════════════════════════════════════════════════════════
// CCX Key Trend Chart (仿照 KeyTrendChart)
// ═══════════════════════════════════════════════════════════════════════

export type ChartDuration = "1h" | "6h" | "24h" | "today" | "7d" | "30d";
export type KeyTrendView = "traffic" | "tokens" | "cache";

export interface KeyTrendDataPoint {
  timestamp: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  successRate: number;
}

export interface KeyTrendSnapshot {
  dataPoints: KeyTrendDataPoint[];
  duration: ChartDuration;
  view: KeyTrendView;
  summary: {
    totalRequests: number;
    avgSuccessRate: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheReadTokens: number;
    totalCacheCreationTokens: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════
// CCX Model Stats Chart (仿照 ModelStatsChart)
// ═══════════════════════════════════════════════════════════════════════

export type ModelStatsView = "requests" | "tokens" | "cache";

export interface ModelStatsEntry {
  model: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  successRate: number;
  avgLatencyMs: number;
}

export interface ModelStatsSnapshot {
  models: ModelStatsEntry[];
  duration: ChartDuration;
  view: ModelStatsView;
  topModels: Array<{ name: string; count: number }>;
}

// ═══════════════════════════════════════════════════════════════════════
// CCX Update Dialog (仿照 UpdateDialog)
// ═══════════════════════════════════════════════════════════════════════

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string;
  downloadUrl?: string;
  publishedAt: string;
  isMandatory: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// cc-switch App Switcher (仿照 AppSwitcher)
// ═══════════════════════════════════════════════════════════════════════

export type AppId = "claude" | "claude-desktop" | "codex" | "gemini" | "opencode" | "openclaw" | "hermes" | "agentsoul";

export interface AppSwitcherSnapshot {
  activeApp: AppId;
  visibleApps: Record<AppId, boolean>;
  appNames: Record<AppId, string>;
}

// ═══════════════════════════════════════════════════════════════════════
// cc-switch Usage Footer (仿照 UsageFooter)
// ═══════════════════════════════════════════════════════════════════════

export interface UsageData {
  planName?: string;
  used: number;
  total: number;
  unit: string;
  resetsAt?: string;
  extra?: string;
  success: boolean;
  errorMessage?: string;
}

export interface UsageFooterSnapshot {
  providerId: string;
  providerName: string;
  usage?: UsageData;
  isCurrent: boolean;
  usageEnabled: boolean;
  lastQueriedAt?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// cc-switch Backup List (仿照 BackupListSection)
// ═══════════════════════════════════════════════════════════════════════

export interface BackupEntry {
  id: string;
  name: string;
  createdAt: string;
  sizeBytes: number;
  description?: string;
  isAuto: boolean;
}

export interface BackupListSnapshot {
  backups: BackupEntry[];
  autoBackupEnabled: boolean;
  autoBackupInterval: number; // 小时
  maxBackups: number;
  storagePath: string;
}

// ═══════════════════════════════════════════════════════════════════════
// cc-switch WebDAV Sync (仿照 WebdavSyncSection)
// ═══════════════════════════════════════════════════════════════════════

export type WebdavSyncStatus = "idle" | "syncing" | "error" | "success";

export interface WebdavConfig {
  serverUrl: string;
  username: string;
  remotePath: string;
  autoSync: boolean;
  syncInterval: number; // 分钟
  lastSyncAt?: string;
  lastSyncStatus?: WebdavSyncStatus;
  lastSyncError?: string;
}

export interface WebdavSyncSnapshot {
  config: WebdavConfig;
  status: WebdavSyncStatus;
  isConfigured: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// cc-switch Deep Link Import (仿照 DeepLinkImportDialog)
// ═══════════════════════════════════════════════════════════════════════

export type DeepLinkType = "channel" | "provider" | "config" | "skill";

export interface DeepLinkInfo {
  type: DeepLinkType;
  url: string;
  name?: string;
  description?: string;
  parsedConfig?: Record<string, unknown>;
}

export interface DeepLinkImportSnapshot {
  links: DeepLinkInfo[];
  isImporting: boolean;
  importProgress: number; // 0-100
  lastImportResult?: {
    success: boolean;
    message: string;
    importedCount: number;
  };
}
