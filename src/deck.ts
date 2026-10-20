// Game types plus the filter, random-draw, player-count and share-link logic for deck-app.html.
// The data lives in games.ts. This file has no DOM code so it can be unit-tested.

export type Category = 'word' | 'dinner' | 'active';

export interface Rules {
  goal: string;
  steps: string[];
  ends: string;
  example?: string;
}

export interface Game {
  id: string;
  cat: Category;
  title: string;
  /** As written on the card: "Any", "2", "4+", "6+ (even)". */
  players: string;
  /** Full equipment text. "None" means no equipment (shown as "No equipment needed"). */
  setup: string;
  /** Shorter equipment text for the list view, only where the full text is long. */
  setupShort?: string;
  /** Rules are hidden behind a tap so only one player sees them. */
  spoiler?: boolean;
  free?: boolean;
  rules: Rules;
}

export const CATEGORY_ORDER: readonly Category[] = ['word', 'dinner', 'active'];

export interface PlayerRange {
  min: number;
  max: number;
  /** Needs an even number of players. */
  even: boolean;
}

/** Parses "Any", "2", "4+", "6+ (even)" and "6+ (teams)". Other notes in brackets are ignored. */
export function parsePlayers(text: string): PlayerRange {
  const t = text.trim();
  if (/^any$/i.test(t)) return { min: 1, max: Infinity, even: false };
  const m = /^(\d+)(\+)?(?:\s*\(([^)]*)\))?$/.exec(t);
  if (!m) throw new Error(`Unrecognised player count: "${text}"`);
  const min = Number(m[1]);
  return { min, max: m[2] ? Infinity : min, even: /\beven\b/i.test(m[3] ?? '') };
}

export function canPlay(game: Game, players: number): boolean {
  if (!Number.isInteger(players) || players < 1) return false;
  const range = parsePlayers(game.players);
  if (players < range.min || players > range.max) return false;
  return !range.even || players % 2 === 0;
}

export const NO_EQUIPMENT_LABEL = 'No equipment needed';

export function needsNoEquipment(game: Game): boolean {
  return game.setup.trim().toLowerCase() === 'none';
}

/** Equipment text for the card. Games that need nothing say so in plain words. */
export function equipmentLabel(game: Game): string {
  return needsNoEquipment(game) ? NO_EQUIPMENT_LABEL : game.setup;
}

/** Equipment text for the list view: the short version where there is one. */
export function listSetup(game: Game): string {
  return needsNoEquipment(game) ? NO_EQUIPMENT_LABEL : (game.setupShort ?? game.setup);
}

export interface Filters {
  cat: Category | 'all';
  /** How many people are playing. null means any number. */
  players: number | null;
  noEquipment: boolean;
}

export const NO_FILTERS: Filters = { cat: 'all', players: null, noEquipment: false };

export function filterGames(games: readonly Game[], f: Filters): Game[] {
  return games.filter(
    (g) =>
      (f.cat === 'all' || g.cat === f.cat) &&
      (f.players === null || canPlay(g, f.players)) &&
      (!f.noEquipment || needsNoEquipment(g)),
  );
}

/** Word, Dinner, Active in that order when showing all. Free games first, then A-Z. */
export function sortGames(games: readonly Game[], cat: Category | 'all'): Game[] {
  return games.slice().sort((a, b) => {
    if (cat === 'all') {
      const diff = CATEGORY_ORDER.indexOf(a.cat) - CATEGORY_ORDER.indexOf(b.cat);
      if (diff !== 0) return diff;
    }
    const free = Number(!a.free) - Number(!b.free);
    return free !== 0 ? free : a.title.localeCompare(b.title);
  });
}

export function visibleGames(games: readonly Game[], f: Filters): Game[] {
  return sortGames(filterGames(games, f), f.cat);
}

/**
 * Random draws that never repeat until every item has been drawn once. After that
 * the deck is reshuffled, and the first card of the new round is never the one
 * that was just drawn.
 */
export class Deck<T> {
  private pile: T[] = [];
  private last: T | undefined;

  constructor(
    private readonly items: readonly T[],
    private readonly rng: () => number = Math.random,
  ) {
    this.reshuffle();
  }

  /** Cards not yet drawn in the current round. */
  get remaining(): number {
    return this.pile.length;
  }

  get size(): number {
    return this.items.length;
  }

  draw(): T | undefined {
    if (this.items.length === 0) return undefined;
    if (this.pile.length === 0) this.reshuffle();
    const card = this.pile.pop() as T;
    this.last = card;
    return card;
  }

  private reshuffle(): void {
    const pile = this.items.slice();
    for (let i = pile.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [pile[i], pile[j]] = [pile[j] as T, pile[i] as T];
    }
    // draw() pops from the end, so keep the last card out of that spot.
    if (pile.length > 1 && pile[pile.length - 1] === this.last) {
      [pile[0], pile[pile.length - 1]] = [pile[pile.length - 1] as T, pile[0] as T];
    }
    this.pile = pile;
  }
}

const ID_PATTERN = /^[a-z0-9-]+$/;

export function shareHash(game: Game): string {
  return `#g=${game.id}`;
}

/** "#g=charades" gives "charades". Anything else gives null. */
export function parseShareHash(hash: string): string | null {
  const id = new URLSearchParams(hash.replace(/^#/, '')).get('g');
  return id !== null && ID_PATTERN.test(id) ? id : null;
}

export function findGameById(games: readonly Game[], id: string | null): Game | undefined {
  return id === null ? undefined : games.find((g) => g.id === id);
}

/** A direct link to one game on the given page. Drops any old query string and hash. */
export function shareUrl(pageUrl: string, game: Game): string {
  const url = new URL(pageUrl);
  url.search = '';
  url.hash = shareHash(game);
  return url.toString();
}

const escapeHTML = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The card's rules block: Goal, numbered How to play, Ends, optional Example. */
export function rulesHTML(r: Rules): string {
  return (
    `<p class="r-line"><span class="r-label">Goal</span>${escapeHTML(r.goal)}</p>` +
    `<div class="r-line"><span class="r-label">How to play</span></div>` +
    `<ol>${r.steps.map((s) => `<li>${escapeHTML(s)}</li>`).join('')}</ol>` +
    `<p class="r-line"><span class="r-label">Ends</span>${escapeHTML(r.ends)}</p>` +
    (r.example ? `<p class="r-line"><span class="r-label">Example</span>${escapeHTML(r.example)}</p>` : '')
  );
}

export type SwipeDirection = 'left' | 'right';

/**
 * Decides whether a drag of (dx, dy) pixels is a horizontal swipe. It must travel at least
 * `minDistance` sideways and be clearly more sideways than vertical, so vertical scrolling
 * and small or diagonal drags are ignored.
 */
export function swipeDirection(dx: number, dy: number, minDistance = 60, ratio = 1.5): SwipeDirection | null {
  if (Math.abs(dx) < minDistance || Math.abs(dx) < Math.abs(dy) * ratio) return null;
  return dx < 0 ? 'left' : 'right';
}
