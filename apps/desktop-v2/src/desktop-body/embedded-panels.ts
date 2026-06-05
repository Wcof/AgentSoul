/**
 * Embedded Panels — future Desktop Body panel/drawer entry points.
 *
 * Panels surface inline within the Desktop Body window (not as separate
 * Control Center pages). Examples: memory inspector, extension settings,
 * developer tools.
 */

export interface EmbeddedPanelDescriptor {
  id: string;
  title: string;
  surface: "drawer" | "inline";
}

export function listEmbeddedPanels(): EmbeddedPanelDescriptor[] {
  // No built-in panels yet. Extensions may register panels via Extension Runtime.
  return [];
}
