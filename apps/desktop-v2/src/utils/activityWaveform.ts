// 活动波形图 — 仿照 CCX 的 SVG activity bar chart
// 每个渠道卡片背景显示请求活跃度波形

/** 单个 bar 的配置 */
interface ActivityBar {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}

/** 成功率色带索引（7档，从绿到红） */
function successRateGrade(rate: number): number {
  if (rate >= 99) return 0;
  if (rate >= 95) return 1;
  if (rate >= 90) return 2;
  if (rate >= 80) return 3;
  if (rate >= 70) return 4;
  if (rate >= 50) return 5;
  return 6;
}

const GRADIENT_COLORS = [
  ["rgb(34, 197, 94)", "rgb(34, 197, 94)"],     // 绿
  ["rgb(132, 204, 22)", "rgb(132, 204, 22)"],     // 黄绿
  ["rgb(250, 204, 21)", "rgb(250, 204, 21)"],     // 黄
  ["rgb(251, 146, 60)", "rgb(251, 146, 60)"],     // 橙
  ["rgb(249, 115, 22)", "rgb(249, 115, 22)"],     // 深橙
  ["rgb(239, 68, 68)", "rgb(239, 68, 68)"],       // 红
  ["rgb(220, 38, 38)", "rgb(220, 38, 38)"],       // 深红
];

/**
 * 生成活动波形 SVG
 * @param requestCount 请求数（决定波形高度基础值）
 * @param successRate 成功率（决定颜色）
 * @param barCount bar 数量（默认 30）
 * @returns SVG HTML 字符串
 */
export function renderActivityWaveform(
  requestCount: number,
  successRate: number,
  barCount = 30,
): string {
  const grade = successRateGrade(successRate);
  const [color] = GRADIENT_COLORS[grade];
  const bars: ActivityBar[] = [];

  // 用伪随机（基于 requestCount）生成波形
  const seed = requestCount % 1000;
  for (let i = 0; i < barCount; i++) {
    const pseudoRandom = Math.abs(Math.sin(seed + i * 7.3) * 100) % 100;
    const heightPct = Math.max(5, Math.min(100, pseudoRandom * (requestCount > 0 ? 1 : 0.1)));
    const barWidth = 100 / barCount - 1;
    const x = (100 / barCount) * i;
    const height = heightPct * 0.4; // 最大 40px (viewBox=100)

    bars.push({
      x,
      y: 100 - height,
      width: barWidth * 0.8,
      height,
      fill: color,
    });
  }

  return `
    <svg class="activity-waveform" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
      ${bars.map((bar) => `<rect x="${bar.x.toFixed(1)}" y="${bar.y.toFixed(1)}" width="${bar.width.toFixed(1)}" height="${bar.height.toFixed(1)}" fill="${bar.fill}" opacity="0.4" rx="1" ry="1"/>`).join("")}
    </svg>
  `;
}

/**
 * 生成全局 stats bar 的 SVG 小图表（用于 Dashboard）
 * @param dataPoints 数据点数组
 * @param color 颜色
 * @returns SVG HTML
 */
export function renderMiniSparkline(dataPoints: number[], color: string): string {
  if (dataPoints.length < 2) return "";
  const max = Math.max(...dataPoints);
  const min = Math.min(...dataPoints);
  const range = max - min || 1;
  const width = 100;
  const height = 30;
  const step = width / (dataPoints.length - 1);

  const points = dataPoints.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `
    <svg class="mini-sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" stroke="${color}" stroke-width="1.5" points="${points.join(" ")}" />
    </svg>
  `;
}
