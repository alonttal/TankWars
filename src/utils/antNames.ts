const FIRST_NAMES = [
  'Rex', 'Blitz', 'Fang', 'Ace', 'Buzz', 'Claw', 'Duke', 'Edge',
  'Fury', 'Grit', 'Hawk', 'Iron', 'Jolt', 'Knox', 'Lynx', 'Mace',
  'Nova', 'Onyx', 'Pike', 'Raid', 'Scar', 'Tank', 'Vex', 'Wren',
  'Zap', 'Bolt', 'Dash', 'Flak', 'Grip', 'Hex', 'Jinx', 'Kite',
  'Lash', 'Mink', 'Nix', 'Orca', 'Puck', 'Rust', 'Sage', 'Tusk',
];

const RANKS = [
  'Pvt.', 'Pvt.', 'Pvt.', 'Pvt.',   // Most common
  'Cpl.', 'Cpl.', 'Cpl.',
  'Sgt.', 'Sgt.',
  'Lt.',
];

export function generateUniqueNames(count: number): string[] {
  // Shuffle names using Fisher-Yates
  const pool = [...FIRST_NAMES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const firstName = pool[i % pool.length];
    const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
    names.push(`${rank} ${firstName}`);
  }

  return names;
}
