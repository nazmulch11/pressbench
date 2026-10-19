import type { Preferences } from '@/lib/storage';

export type PanelName = 'sidebar' | 'preview' | 'bottom';

export interface LayoutSizes {
  readonly sidebar: number;
  readonly preview: number;
  readonly bottom: number;
}

export interface LayoutVisibility {
  readonly sidebar: boolean;
  readonly preview: boolean;
  readonly bottom: boolean;
}

export interface LayoutState {
  readonly sizes: LayoutSizes;
  readonly visible: LayoutVisibility;
}

interface PanelLimits {
  readonly min: number;
  readonly max: number;
  readonly default: number;
  /** Pixels per arrow-key press on the splitter. */
  readonly step: number;
}

/** Pixel limits per panel. Sizes outside the range are clamped, never rejected. */
export const LAYOUT_LIMITS: Readonly<Record<PanelName, PanelLimits>> = {
  sidebar: { min: 160, max: 640, default: 260, step: 16 },
  preview: { min: 240, max: 1200, default: 480, step: 16 },
  bottom: { min: 80, max: 600, default: 180, step: 16 },
};

export const LAYOUT_PREFERENCE_KEY = 'layout';

export const DEFAULT_LAYOUT: LayoutState = {
  sizes: {
    sidebar: LAYOUT_LIMITS.sidebar.default,
    preview: LAYOUT_LIMITS.preview.default,
    bottom: LAYOUT_LIMITS.bottom.default,
  },
  visible: { sidebar: true, preview: true, bottom: true },
};

export const PANEL_NAMES: readonly PanelName[] = ['sidebar', 'preview', 'bottom'];

/** Keeps a size inside the panel's limits. */
export function clampPanelSize(panel: PanelName, size: number): number {
  const limits = LAYOUT_LIMITS[panel];
  if (!Number.isFinite(size)) {
    return limits.default;
  }
  return Math.min(limits.max, Math.max(limits.min, Math.round(size)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Reads the stored layout, taking only well-typed values and defaults for the rest. */
export function readLayout(preferences: Preferences): LayoutState {
  const stored: unknown = preferences.get(LAYOUT_PREFERENCE_KEY, null);
  if (!isRecord(stored)) {
    return DEFAULT_LAYOUT;
  }
  const sizes = isRecord(stored.sizes) ? stored.sizes : {};
  const visible = isRecord(stored.visible) ? stored.visible : {};
  const pick = <T>(value: unknown, fallback: T, guard: (v: unknown) => v is T): T =>
    guard(value) ? value : fallback;
  const isNumber = (value: unknown): value is number => typeof value === 'number';
  const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
  const result = { sizes: { ...DEFAULT_LAYOUT.sizes }, visible: { ...DEFAULT_LAYOUT.visible } };
  for (const panel of PANEL_NAMES) {
    result.sizes[panel] = clampPanelSize(
      panel,
      pick(sizes[panel], DEFAULT_LAYOUT.sizes[panel], isNumber),
    );
    result.visible[panel] = pick(visible[panel], DEFAULT_LAYOUT.visible[panel], isBoolean);
  }
  return result;
}

/** Stores the layout for the next visit. */
export function writeLayout(preferences: Preferences, layout: LayoutState): void {
  preferences.set(LAYOUT_PREFERENCE_KEY, layout);
}
