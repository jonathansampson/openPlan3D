/**
 * Leaf positions offered for double-leaf doors, shared by the properties
 * panel, the plan renderer and the 3D viewer.
 */

export const DOOR_LEAF_STATES = [
  { id: 'closed', label: 'Closed', angles: [0, 0] },
  { id: 'left', label: 'Left open', angles: [90, 0] },
  { id: 'right', label: 'Right open', angles: [0, 90] },
  { id: 'ajar', label: 'Both 45°', angles: [45, 45] },
  { id: 'open', label: 'Both open', angles: [90, 90] },
] as const;

/** The subset that makes sense for a door with only one leaf */
export const SINGLE_LEAF_STATES = [
  { id: 'closed', label: 'Closed' },
  { id: 'ajar', label: '45°' },
  { id: 'open', label: 'Open' },
] as const;

/** Degrees each leaf stands open, as [left, right]. Anything unknown reads as closed. */
export function doorLeafAngles(state: string | undefined): [number, number] {
  const found = DOOR_LEAF_STATES.find((s) => s.id === state) ?? DOOR_LEAF_STATES[0];
  return [found.angles[0], found.angles[1]];
}
