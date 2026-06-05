import type { DesktopBodySnapshot } from "../types";
import { showToast } from "../utils/modal";

export function showDesktopBodyStatus(snapshot: DesktopBodySnapshot): void {
  showToast(snapshot.companion.summary ?? "status unavailable", "info");
}
