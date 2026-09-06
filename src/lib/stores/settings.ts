import { writable } from 'svelte/store';

export interface ProjectSettings {
  units: 'metric' | 'imperial';         // m,cm vs ft,inch
  showDimensions: boolean;               // wall length labels
  showExternalDimensions: boolean;       // outside-wall dimensions
  showInternalDimensions: boolean;       // inside-room dimensions
  showExtensionLines: boolean;           // perpendicular tick marks on dimension lines
  showObjectDistance: boolean;            // distance from objects to walls
  dimensionLineColor: string;            // color for dimension lines/text
  wallMeasureMode: 'centerline' | 'edge'; // measure walls center-to-center or edge-to-edge (clear span)
  snapToGrid: boolean;                   // snap elements to grid when dragging
  gridSize: number;                      // grid spacing in cm, always — see GRID_STEPS
  showGrid: boolean;                     // draw the grid on the plan canvas
}

type Units = ProjectSettings['units'];

// ── Grid spacing ─────────────────────────────────────────────────────
// Geometry is centimetres throughout the app, so gridSize is centimetres in
// both unit systems. The ladders below are the rungs the stepper climbs, so
// that every stop is a round number in the units on screen.

const METRIC_GRID_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200];
const IMPERIAL_GRID_STEPS = [2.54, 7.62, 15.24, 30.48, 60.96, 152.4, 304.8]; // 1" 3" 6" 1' 2' 5' 10'

export function gridSteps(units: Units): number[] {
  return units === 'imperial' ? IMPERIAL_GRID_STEPS : METRIC_GRID_STEPS;
}

/** The spacing 'Reset grid' returns to: 25 cm, or 1 ft for imperial. */
export function defaultGridSize(units: Units): number {
  return units === 'imperial' ? 30.48 : 25;
}

function nearestGridIndex(size: number, units: Units): number {
  const steps = gridSteps(units);
  let best = 0;
  for (let i = 1; i < steps.length; i++) {
    if (Math.abs(steps[i] - size) < Math.abs(steps[best] - size)) best = i;
  }
  return best;
}

/**
 * The rung one step from `size` in direction `dir`, clamped at both ends of the
 * ladder. A size that sits between rungs — which is what switching unit systems
 * leaves behind — lands on the rung it is stepping towards rather than skipping
 * past it.
 */
export function stepGridSize(size: number, units: Units, dir: 1 | -1): number {
  const steps = gridSteps(units);
  const i = nearestGridIndex(size, units);
  if (dir > 0) return steps[steps[i] > size ? i : Math.min(i + 1, steps.length - 1)];
  return steps[steps[i] < size ? i : Math.max(i - 1, 0)];
}

/**
 * Spacing of the heavier grid lines: the fewest whole grid cells spanning at
 * least a metre (a foot in imperial), and never fewer than two. Being a whole
 * multiple keeps them on grid intersections at any grid size.
 */
export function majorGridSpacing(gridSize: number, units: Units): number {
  const unit = units === 'imperial' ? 30.48 : 100;
  return Math.max(2, Math.ceil(unit / gridSize)) * gridSize;
}

const defaultSettings: ProjectSettings = {
  units: 'metric',
  showDimensions: true,
  showExternalDimensions: true,
  showInternalDimensions: false,
  showExtensionLines: true,
  showObjectDistance: true,
  dimensionLineColor: '#1e293b',
  wallMeasureMode: 'centerline',
  snapToGrid: true,
  gridSize: 25,
  showGrid: true,
};

// Load from localStorage if available
function loadSettings(): ProjectSettings {
  if (typeof window === 'undefined') return { ...defaultSettings };
  try {
    const saved = localStorage.getItem('o3d_settings');
    if (saved) {
      const merged: ProjectSettings = { ...defaultSettings, ...JSON.parse(saved) };
      // Every snap divides by gridSize, so a corrupt one would wedge the canvas
      if (!(merged.gridSize > 0)) merged.gridSize = defaultSettings.gridSize;
      return merged;
    }
  } catch {}
  return { ...defaultSettings };
}

function createSettingsStore() {
  const { subscribe, set, update } = writable<ProjectSettings>(loadSettings());

  return {
    subscribe,
    set(value: ProjectSettings) {
      set(value);
      if (typeof window !== 'undefined') {
        localStorage.setItem('o3d_settings', JSON.stringify(value));
      }
    },
    update(fn: (s: ProjectSettings) => ProjectSettings) {
      update((current) => {
        const next = fn(current);
        if (typeof window !== 'undefined') {
          localStorage.setItem('o3d_settings', JSON.stringify(next));
        }
        return next;
      });
    },
    reset() {
      this.set({ ...defaultSettings });
    },
    // Grid controls. Routed through the store so the keyboard shortcuts, the
    // status bar, the settings dialog and the command palette all step the
    // same ladder.
    increaseGrid() {
      this.update((s) => ({ ...s, gridSize: stepGridSize(s.gridSize, s.units, 1) }));
    },
    decreaseGrid() {
      this.update((s) => ({ ...s, gridSize: stepGridSize(s.gridSize, s.units, -1) }));
    },
    resetGrid() {
      this.update((s) => ({ ...s, gridSize: defaultGridSize(s.units) }));
    },
    setGridSize(size: number) {
      if (!(size > 0)) return;
      this.update((s) => ({ ...s, gridSize: size }));
    },
    toggleGrid() {
      this.update((s) => ({ ...s, showGrid: !s.showGrid }));
    },
    toggleSnapToGrid() {
      this.update((s) => ({ ...s, snapToGrid: !s.snapToGrid }));
    },
  };
}

export const projectSettings = createSettingsStore();

/** Convert cm to display string based on current units */
export function formatLength(cm: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    if (feet === 0) return `${inches}"`;
    if (inches === 0) return `${feet}'`;
    return `${feet}'${inches}"`;
  }
  // Metric
  if (cm >= 100) {
    const m = cm / 100;
    if (m % 1 === 0) return `${m} m`;
    return `${parseFloat(m.toFixed(2))} m`;
  }
  return `${Math.round(cm)} cm`;
}

/** Convert cm to display with full precision */
export function formatLengthPrecise(cm: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    if (feet === 0) return `${inches.toFixed(1)}"`;
    return `${feet}'${inches.toFixed(1)}"`;
  }
  if (cm >= 100) {
    return `${(cm / 100).toFixed(2)} m`;
  }
  return `${cm.toFixed(1)} cm`;
}

/** Format area (m²) to display string based on units */
export function formatArea(m2: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    const ft2 = m2 * 10.7639;
    return `${ft2.toFixed(1)} ft²`;
  }
  return `${m2.toFixed(1)} m²`;
}

/** Parse user input back to cm */
export function parseLengthInput(input: string, units: 'metric' | 'imperial'): number | null {
  if (units === 'imperial') {
    // Try ft'in" format
    const match = input.match(/^(\d+(?:\.\d+)?)'?\s*(\d+(?:\.\d+)?)?"?$/);
    if (match) {
      const feet = parseFloat(match[1]) || 0;
      const inches = parseFloat(match[2]) || 0;
      return (feet * 12 + inches) * 2.54;
    }
    // Try just inches
    const inMatch = input.match(/^(\d+(?:\.\d+)?)"?$/);
    if (inMatch) return parseFloat(inMatch[1]) * 2.54;
    // Try just feet
    const ftMatch = input.match(/^(\d+(?:\.\d+)?)'$/);
    if (ftMatch) return parseFloat(ftMatch[1]) * 12 * 2.54;
  }
  // Metric — try m then cm
  const mMatch = input.match(/^(\d+(?:\.\d+)?)\s*m$/);
  if (mMatch) return parseFloat(mMatch[1]) * 100;
  const num = parseFloat(input);
  return isNaN(num) ? null : num;
}
