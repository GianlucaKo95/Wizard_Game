// Preloads every card image the game can ever show, so a card that's never
// been rendered before doesn't trigger a fresh network request mid-game.
// Call preloadCardImages() once, as early as possible (e.g. in main.tsx or
// right after login) — it's idempotent and safe to call multiple times.

const SPECIAL_IMAGES = [
  "Special_Dragon", "Special_Fairy", "Special_Witch", "Special_Werewolf",
  "Special_Vampire", "Special_Bomb", "Special_George", "Special_Platform9",
  "Special_Ron",
];

const HOUSE_FOLDERS = ["Gryffindor", "Ravenclaw", "Slytherin", "Hufflepuff"];

function buildCardImageList(): string[] {
  const paths: string[] = [];
  for (const name of SPECIAL_IMAGES) paths.push(`/cards/${name}.webp`);
  for (let i = 1; i <= 4; i++) paths.push(`/cards/Wizard_${i}.webp`);
  for (let i = 1; i <= 4; i++) paths.push(`/cards/Fool_${i}.webp`);
  for (const folder of HOUSE_FOLDERS)
    for (let v = 1; v <= 13; v++) paths.push(`/cards/${folder}_${v}.webp`);
  return paths;
}

let preloadStarted = false;
let preloadPromise: Promise<void> | null = null;

export function preloadCardImages(): Promise<void> {
  if (preloadStarted) return preloadPromise ?? Promise.resolve();
  preloadStarted = true;

  const paths = buildCardImageList();
  preloadPromise = new Promise<void>((resolve) => {
    let remaining = paths.length;
    if (remaining === 0) { resolve(); return; }
    const done = () => { remaining--; if (remaining <= 0) resolve(); };
    for (const src of paths) {
      const img = new Image();
      img.onload = done;
      img.onerror = done; // don't block on a missing file
      img.src = src;
    }
  });
  return preloadPromise;
}
