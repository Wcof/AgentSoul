// 快速输入解析器 — 从 CCX 移植，适配 AgentSoul vanilla TS 架构
// 功能：从粘贴的文本中自动识别 API Key 和 URL

// ─── API Key 格式匹配 ───

/** 各平台 API Key 格式的专用正则 */
const PLATFORM_KEY_PATTERNS: RegExp[] = [
  /^sk-proj-[a-zA-Z0-9_-]{50,}$/,       // OpenAI Project Key
  /^sk-ant-api03-[a-zA-Z0-9_-]{50,}$/,   // Anthropic Claude
  /^sk-or-v1-[a-zA-Z0-9]{50,}$/,         // OpenRouter
  /^sk-[a-zA-Z0-9]{20,}$/,               // OpenAI Legacy / DeepSeek / Moonshot
  /^AIza[0-9A-Za-z_-]{30,}$/,            // Google Gemini
  /^hf_[a-zA-Z0-9]{30,}$/,               // Hugging Face
  /^gsk_[a-zA-Z0-9]{40,}$/,              // Groq
  /^pplx-[a-zA-Z0-9]{40,}$/,             // Perplexity
  /^tp-[a-zA-Z0-9_-]{20,}$/,             // TokenPlan / third-party prefixed key
  /^r8_[a-zA-Z0-9]{20,}$/,               // Replicate
  /^[a-zA-Z0-9]{20,}\.[a-zA-Z0-9]{10,}$/, // 智谱 AI (id.secret)
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // 火山引擎 Ark (UUID)
  /^AK[A-Z]{2,4}[a-zA-Z0-9]{20,}$/,     // 火山引擎 IAM AK
];

/** 检测是否为配置键名（非真实 Key） */
function looksLikeConfigKey(token: string): boolean {
  if (/^[A-Z][A-Z0-9]*(_[A-Z][A-Z0-9]*)+$/.test(token)) return true;
  const CONFIG_KEYS = new Set([
    "api_key", "apikey", "api_secret", "access_key", "access_token",
    "auth_token", "auth_key", "secret_key", "secret", "token", "auth",
    "base_url", "baseurl", "base", "url", "endpoint", "host",
    "name", "model", "model_name", "type", "service_type", "provider", "env",
  ]);
  return CONFIG_KEYS.has(token.toLowerCase());
}

/** 检测是否为有效的 API Key */
export function isValidApiKey(token: string): boolean {
  if (looksLikeConfigKey(token)) return false;
  for (const pattern of PLATFORM_KEY_PATTERNS) {
    if (pattern.test(token)) return true;
  }
  // 通用前缀格式
  if (/^[a-zA-Z]{2,6}[-_][a-zA-Z0-9_-]{10,}$/.test(token)) {
    const suffix = token.replace(/^[a-zA-Z]{2,6}[-_]/, "");
    if (/\d/.test(suffix) || (/[a-z]/.test(suffix) && /[A-Z]/.test(suffix))) return true;
  }
  // JWT 格式
  if (/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\./.test(token) && token.length >= 20) return true;
  // 长随机字符串
  if (token.length >= 32 && /^[a-zA-Z0-9_-]+$/.test(token) && /[a-zA-Z]/.test(token) && /\d/.test(token)) return true;
  // 宽松前缀兜底
  if (/^(sk|api|key|ut|hf|gsk|cr|ms|r8|pplx|tp)[-_].+$/i.test(token)) return true;
  return false;
}

/** 检测是否为有效的 URL */
export function isValidUrl(token: string): boolean {
  return /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*(:\d+)?(\/|#|$)/i.test(token);
}

// ─── URL 服务类型检测 ───

export type DetectedServiceType = "openai" | "claude" | "gemini" | "responses" | null;

/** 根据 URL 路径检测服务类型，并返回清理后的 baseUrl */
function detectServiceTypeAndCleanUrl(url: string): { serviceType: DetectedServiceType; cleanedUrl: string } {
  try {
    const cleanUrl = url.replace(/#$/, "");
    const parsed = new URL(cleanUrl);
    const path = parsed.pathname.toLowerCase();
    const endpoints: Array<[string, DetectedServiceType]> = [
      ["/messages", "claude"],
      ["/anthropic", "claude"],
      ["/chat/completions", "openai"],
      ["/responses", "responses"],
      ["/generatecontent", "gemini"],
    ];
    for (const [ep, svc] of endpoints) {
      if (path.includes(ep)) {
        const idx = path.indexOf(ep);
        parsed.pathname = path.slice(0, idx) || "/";
        let result = parsed.toString().replace(/\/$/, "");
        if (url.endsWith("#")) result += "#";
        return { serviceType: svc, cleanedUrl: result };
      }
    }
  } catch { /* 忽略解析错误 */ }
  return { serviceType: null, cleanedUrl: url };
}

// ─── Token 提取 ───

function extractTokens(input: string): string[] {
  const COLON_PLACEHOLDER = "__URLCOLON__";
  const protectedInput = input
    .replace(/%20/g, " ")
    .replace(/https?:\/\/[^\s,;，；：=""''\n]+/gi, (m) => m.replace(/:/g, COLON_PLACEHOLDER));
  return protectedInput
    .split(/[\n\s,;，；：:=""''\s]+/)
    .map((t) => t.split(COLON_PLACEHOLDER).join(":"))
    .filter((t) => t.length > 0);
}

// ─── 解析结果类型 ───

export interface QuickInputParseResult {
  detectedBaseUrl: string;
  detectedBaseUrls: string[];
  detectedApiKeys: string[];
  detectedServiceType: DetectedServiceType;
  generatedChannelName: string;
}

/** 解析快速输入内容，提取 URL 和 API Keys */
export function parseQuickInput(input: string): QuickInputParseResult {
  const rawUrls: string[] = [];
  let detectedServiceType: DetectedServiceType = null;
  const detectedApiKeys: string[] = [];
  const tokens = extractTokens(input);

  for (const token of tokens) {
    if (isValidUrl(token)) {
      const endsWithHash = token.endsWith("#");
      let url = endsWithHash ? token.slice(0, -1) : token;
      url = url.replace(/\/$/, "");
      const fullUrl = endsWithHash ? url + "#" : url;
      const { serviceType, cleanedUrl } = detectServiceTypeAndCleanUrl(fullUrl);
      rawUrls.push(cleanedUrl);
      if (!detectedServiceType) detectedServiceType = serviceType;
      continue;
    }
    if (isValidApiKey(token) && !detectedApiKeys.includes(token)) {
      detectedApiKeys.push(token);
    }
  }

  const deduplicatedUrls = Array.from(new Set(rawUrls)).slice(0, 10);
  const baseUrl = deduplicatedUrls[0] || "";

  // 自动生成渠道名
  const generatedChannelName = generateChannelName(baseUrl, detectedServiceType);

  return {
    detectedBaseUrl: baseUrl,
    detectedBaseUrls: deduplicatedUrls,
    detectedApiKeys,
    detectedServiceType,
    generatedChannelName,
  };
}

/** 根据 baseUrl 和服务类型自动生成渠道名 */
function generateChannelName(baseUrl: string, serviceType: DetectedServiceType): string {
  if (!baseUrl) return "New Channel";
  try {
    const hostname = new URL(baseUrl).hostname;
    const parts = hostname.split(".");
    // 提取主域名（如 api.openai.com → openai）
    const mainPart = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    const prefix = mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
    const typeSuffix = serviceType ? ` (${serviceType})` : "";
    return `${prefix}${typeSuffix}`;
  } catch {
    return "New Channel";
  }
}
