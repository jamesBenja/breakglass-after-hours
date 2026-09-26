export const KOMBAT_FIGHTERS = [
  {
    id: 'promoter',
    name: 'THE PROMOTER',
    tagline: 'Double holds, guest lists and impossible routing.',
    style: 'promoter',
    palette: ['#5a2d64', '#f0b8df', '#151318'],
    moves: {
      light: 'BOOK THROW',
      heavy: 'DOUBLE HOLD',
      special: 'DJ DISAPPEAR',
    },
    buttons: { light: 'BOOK', heavy: 'HOLD', special: 'DISAPPEAR' },
    specialEffect: 'vanish',
  },
  {
    id: 'vinyl-dj',
    name: 'THE VINYL DJ',
    tagline: 'Two bags, no sync button, very specific opinions about needles.',
    style: 'vinyl',
    palette: ['#33445d', '#e7d49b', '#15191e'],
    moves: {
      light: 'RECORD SLAP',
      heavy: 'CRATE DROP',
      special: 'DUBPLATE SPIN',
    },
    buttons: { light: 'RECORD', heavy: 'CRATE', special: 'DUBPLATE' },
  },
  {
    id: 'tiktok-dj',
    name: 'THE TIK TOK DJ',
    tagline: 'The drop is already vertical, captioned and scheduled.',
    style: 'phone',
    palette: ['#2b213d', '#5ef2db', '#ff5ca8'],
    moves: {
      light: 'PHONE FLASH',
      heavy: 'TREND DROP',
      special: 'ALGORITHM BOOST',
    },
    buttons: { light: 'FLASH', heavy: 'TREND', special: 'ALGORITHM' },
  },
  {
    id: 'k-kids',
    name: 'THE K KIDS',
    tagline: 'Two adult party kids, one health bar, absolutely no plan to go home.',
    style: 'duo',
    palette: ['#f06d91', '#8be4ff', '#302039'],
    moves: {
      light: 'WRISTBAND WHIP',
      heavy: 'GROUP CHAT',
      special: 'AFTERPARTY SWARM',
    },
    buttons: { light: 'WRISTBAND', heavy: 'GROUP CHAT', special: 'AFTERPARTY' },
  },
  {
    id: 'heads',
    name: 'THE HEADS',
    tagline: 'They heard it first. They will explain why your version is the wrong pressing.',
    style: 'heads',
    palette: ['#292a2e', '#d3c4a2', '#6d675c'],
    moves: {
      light: 'EYEBROW',
      heavy: 'RARE PRESSING',
      special: 'YOU WOULDNT KNOW IT',
    },
    buttons: { light: 'EYEBROW', heavy: 'PRESSING', special: 'WOULDNT KNOW' },
  },
  {
    id: 'producer',
    name: 'THE PRODUCER',
    tagline: 'There are seventeen versions of the kick. This is final_final_v7.',
    style: 'producer',
    palette: ['#3c4750', '#f0a95c', '#16191d'],
    moves: {
      light: 'STEM CUT',
      heavy: 'SIDECHAIN',
      special: 'FINAL FINAL V7',
    },
    buttons: { light: 'STEM', heavy: 'SIDECHAIN', special: 'FINAL V7' },
  },
  {
    id: 'lighting',
    name: 'THE LIGHTING PERSON',
    tagline: 'Nobody notices until the room goes black.',
    style: 'lighting',
    palette: ['#20283d', '#f4e75f', '#5df0ff'],
    moves: {
      light: 'BLACKOUT',
      heavy: 'STROBE HIT',
      special: 'LASER CAGE',
    },
    buttons: { light: 'BLACKOUT', heavy: 'STROBE', special: 'LASERS' },
  },
  {
    id: 'nonbinary',
    name: 'NON BINARY',
    tagline: 'Fluid footwork, sharp timing, impossible to box in.',
    style: 'prism',
    palette: ['#6652a3', '#efe35a', '#d5d5d5'],
    moves: {
      light: 'SHIFT',
      heavy: 'MIRROR',
      special: 'PRISM BREAK',
    },
    buttons: { light: 'SHIFT', heavy: 'MIRROR', special: 'PRISM' },
  },
  {
    id: 'muscle-gay',
    name: 'MUSCLE GAY',
    tagline: 'Built for the dance floor and apparently also for this.',
    style: 'muscle',
    palette: ['#8f4f76', '#f0b38e', '#202126'],
    moves: {
      light: 'SHOULDER CHECK',
      heavy: 'FLEX',
      special: 'SWEATBOX SUPERNOVA',
    },
    buttons: { light: 'SHOULDER', heavy: 'FLEX', special: 'SUPERNOVA' },
  },
  {
    id: 'older-raver',
    name: 'OLDER RAVER',
    tagline: 'Has seen this cycle before, brought earplugs and can still go all night.',
    style: 'veteran',
    palette: ['#3d3b45', '#c6b29c', '#6fa68a'],
    moves: {
      light: 'EARPLUG CHECK',
      heavy: 'WAREHOUSE MEMORY',
      special: 'STILL HERE',
    },
    buttons: { light: 'EARPLUG', heavy: 'WAREHOUSE', special: 'STILL HERE' },
  },
];

export function fighterById(id) {
  return KOMBAT_FIGHTERS.find((fighter) => fighter.id === id) ?? KOMBAT_FIGHTERS[0];
}

export function chooseCpuFighter(playerId, random = Math.random) {
  const choices = KOMBAT_FIGHTERS.filter((fighter) => fighter.id !== playerId);
  const index = Math.min(choices.length - 1, Math.floor(Math.max(0, random()) * choices.length));
  return choices[Math.max(0, index)] ?? KOMBAT_FIGHTERS[1];
}

export function specialVisualForHit(fighter, event, now = 0) {
  if (
    !fighter ||
    event?.type !== 'hit' ||
    event.attack !== 'special' ||
    event.guarded ||
    fighter.specialEffect !== 'vanish'
  )
    return null;
  return {
    side: event.target,
    label: 'DJ REMOVED FROM LINEUP',
    until: now + 780,
  };
}
