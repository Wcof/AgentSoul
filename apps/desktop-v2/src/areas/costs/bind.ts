/**
 * Costs Area — bind functions
 * Binds event listeners for chart controls (duration, view, refresh).
 */
import type { AreaContext } from "../../types";
import { t } from "../../shared/utils";
import { showToast } from "../../utils/modal";

export function bindCostsArea(ctx: AreaContext): void {
  bindChartControls(ctx.target, ctx.snapshot, ctx.controller, ctx.controlClient);
}

export function bindChartControls(
  target: HTMLElement,
  snapshot: import("../../types").CompanionRuntimeSnapshot,
  controller?: import("../../types").DesktopCompanionController,
  controlClient?: import("../../types").LocalControlClientLike,
): void {
  // Duration selector
  target.querySelectorAll<HTMLButtonElement>("[data-duration]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const duration = btn.dataset.duration!;
      const chart = btn.closest(".key-trend-chart, .model-stats-chart");
      if (chart) {
        chart.querySelectorAll("[data-duration]").forEach((b) => b.classList.remove("duration-btn--active"));
        btn.classList.add("duration-btn--active");
      }
      const isKeyTrend = !!btn.closest(".key-trend-chart");
      if (isKeyTrend) {
        snapshot.keyTrend.duration = duration as typeof snapshot.keyTrend.duration;
      } else {
        snapshot.modelStats.duration = duration as typeof snapshot.modelStats.duration;
      }
      controller?.render(snapshot);
      showToast(t("chart.durationChanged", "Duration changed") + ": " + duration, "info");
    });
  });

  // View selector
  target.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view!;
      const chart = btn.closest(".key-trend-chart, .model-stats-chart");
      if (chart) {
        chart.querySelectorAll("[data-view]").forEach((b) => b.classList.remove("view-btn--active"));
        btn.classList.add("view-btn--active");
      }
      const isKeyTrend = !!btn.closest(".key-trend-chart");
      if (isKeyTrend) {
        snapshot.keyTrend.view = view as typeof snapshot.keyTrend.view;
      } else {
        snapshot.modelStats.view = view as typeof snapshot.modelStats.view;
      }
      controller?.render(snapshot);
      showToast(t("chart.viewChanged", "View changed") + ": " + view, "info");
    });
  });

  // Refresh button
  target.querySelectorAll<HTMLButtonElement>("[data-chart-refresh]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      showToast(t("chart.refreshing", "Refreshing data..."), "info");
      if (!controlClient) return;
      try {
        const fresh = await controlClient.loadSnapshot();
        snapshot.dashboardStats = fresh.dashboardStats;
        snapshot.channels = fresh.channels;
        snapshot.keyTrend = { ...snapshot.keyTrend, ...fresh.keyTrend, duration: snapshot.keyTrend.duration, view: snapshot.keyTrend.view };
        snapshot.modelStats = { ...snapshot.modelStats, ...fresh.modelStats, duration: snapshot.modelStats.duration, view: snapshot.modelStats.view };
        controller?.render(snapshot);
      } catch {
        showToast(t("chart.refreshFailed", "刷新失败"), "error");
      }
    });
  });
}
