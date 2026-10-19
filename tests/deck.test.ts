import { describe, expect, it } from 'vitest';
import {
  Deck, type Game, NO_FILTERS, canPlay, filterGames, findGameById, listSetup, needsNoEquipment,
  parsePlayers, parseShareHash, rulesHTML, shareHash, shareUrl, sortGames, visibleGames,
} from '../src/deck';
import { GAMES } from '../src/games';

const game = (over: Partial<Game> = {}): Game => ({
  id: 'x', cat: 'word', title: 'X', players: 'Any', setup: 'None',
  rules: { goal: 'g', steps: ['s'], ends: 'e' }, ...over,
});
const byId = (id: string): Game => GAMES.find((g) => g.id === id) as Game;

describe('parsePlayers', () => {
  it.each([
    ['Any', 1, Infinity, false],
    ['any', 1, Infinity, false],
    ['2', 2, 2, false],
    ['2+', 2, Infinity, false],
    ['4+', 4, Infinity, false],
    ['6+ (even)', 6, Infinity, true],
    ['6+ (teams)', 6, Infinity, false],
    [' 3+ ', 3, Infinity, false],
  ])('%j', (text, min, max, even) => expect(parsePlayers(text)).toEqual({ min, max, even }));

  it.each(['', 'lots', '+4', '4-6', '4++', '2 (even'])('rejects %j', (text) => expect(() => parsePlayers(text)).toThrow());
});

describe('canPlay', () => {
  it('"Any" works for every sensible number', () => {
    for (const n of [1, 2, 7, 20]) expect(canPlay(game(), n)).toBe(true);
  });
  it('"2" means exactly two', () => {
    const g = game({ players: '2' });
    expect([1, 2, 3].map((n) => canPlay(g, n))).toEqual([false, true, false]);
  });
  it('"4+" needs at least four', () => {
    const g = game({ players: '4+' });
    expect([3, 4, 5, 12].map((n) => canPlay(g, n))).toEqual([false, true, true, true]);
  });
  it('"6+ (even)" needs six or more and an even number', () => {
    const g = game({ players: '6+ (even)' });
    expect([4, 6, 7, 8, 9].map((n) => canPlay(g, n))).toEqual([false, true, false, true, false]);
  });
  it('rejects non-positive and fractional counts', () => {
    for (const n of [0, -2, 2.5, NaN]) expect(canPlay(game(), n)).toBe(false);
  });
});

describe('equipment', () => {
  it('treats "None" as no equipment, whatever the case', () => {
    expect(needsNoEquipment(game({ setup: 'None' }))).toBe(true);
    expect(needsNoEquipment(game({ setup: ' none ' }))).toBe(true);
    expect(needsNoEquipment(game({ setup: 'A spoon' }))).toBe(false);
  });
  it('uses the short text in lists when there is one', () => {
    expect(listSetup(game({ setup: 'A very long list of things', setupShort: 'Things' }))).toBe('Things');
    expect(listSetup(game({ setup: 'A spoon' }))).toBe('A spoon');
  });
});

describe('filterGames', () => {
  it('returns everything with no filters', () => expect(filterGames(GAMES, NO_FILTERS)).toHaveLength(GAMES.length));

  it('filters by category', () => {
    const word = filterGames(GAMES, { ...NO_FILTERS, cat: 'word' });
    expect(word.length).toBeGreaterThan(0);
    expect(word.every((g) => g.cat === 'word')).toBe(true);
  });

  it('hides games you cannot play with that many people', () => {
    const three = filterGames(GAMES, { ...NO_FILTERS, players: 3 }).map((g) => g.id);
    expect(three).toContain('charades');
    expect(three).toContain('wavelength');
    expect(three).not.toContain('sock-wrestling'); // exactly 2
    expect(three).not.toContain('toast'); // 4+
    expect(three).not.toContain('oxford-vs-cambridge'); // 6+ (even)
  });

  it('keeps 2-player games for two and drops them for three', () => {
    const two = filterGames(GAMES, { ...NO_FILTERS, players: 2 }).map((g) => g.id);
    expect(two).toContain('moo-off');
    expect(two).toContain('charades');
  });

  it('applies the even rule', () => {
    expect(filterGames(GAMES, { ...NO_FILTERS, players: 7 }).map((g) => g.id)).not.toContain('oxford-vs-cambridge');
    expect(filterGames(GAMES, { ...NO_FILTERS, players: 8 }).map((g) => g.id)).toContain('oxford-vs-cambridge');
  });

  it('keeps only games that need nothing', () => {
    const none = filterGames(GAMES, { ...NO_FILTERS, noEquipment: true });
    expect(none.length).toBeGreaterThan(0);
    expect(none.every((g) => g.setup === 'None')).toBe(true);
    expect(none.map((g) => g.id)).not.toContain('musical-chairs');
  });

  it('combines the filters', () => {
    const r = filterGames(GAMES, { cat: 'dinner', players: 5, noEquipment: true });
    expect(r.map((g) => g.id).sort()).toEqual(['paranoia', 'psychiatrist', 'toast']);
  });

  it('can return nothing', () => {
    expect(filterGames(GAMES, { cat: 'dinner', players: 3, noEquipment: true })).toEqual([]);
  });
});

describe('sortGames', () => {
  it('groups Word, Dinner, Active, with free games first then A-Z', () => {
    const sorted = sortGames(GAMES, 'all');
    const cats = sorted.map((g) => g.cat);
    expect(cats).toEqual([...cats].sort((a, b) => ['word', 'dinner', 'active'].indexOf(a) - ['word', 'dinner', 'active'].indexOf(b)));
    const word = sorted.filter((g) => g.cat === 'word');
    const firstPaid = word.findIndex((g) => !g.free);
    expect(word.slice(0, firstPaid).every((g) => g.free)).toBe(true);
    expect(word.slice(firstPaid).every((g) => !g.free)).toBe(true);
  });
  it('does not change the input', () => {
    const copy = GAMES.map((g) => g.id);
    sortGames(GAMES, 'all');
    expect(GAMES.map((g) => g.id)).toEqual(copy);
  });
  it('visibleGames filters then sorts', () => {
    const r = visibleGames(GAMES, { cat: 'active', players: null, noEquipment: false });
    expect(r.every((g) => g.cat === 'active')).toBe(true);
    expect(r[0]?.free).toBe(true);
  });
});

describe('Deck', () => {
  // A seeded generator so the tests are repeatable.
  const seeded = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  it('never repeats until the deck is used up', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const deck = new Deck(GAMES, seeded(seed));
      const drawn = GAMES.map(() => (deck.draw() as Game).id);
      expect(new Set(drawn).size).toBe(GAMES.length);
    }
  });

  it('counts down the cards left', () => {
    const deck = new Deck([1, 2, 3], seeded(7));
    expect(deck.remaining).toBe(3);
    deck.draw();
    expect(deck.remaining).toBe(2);
    deck.draw();
    deck.draw();
    expect(deck.remaining).toBe(0);
  });

  it('reshuffles when used up, covers everything again, and never repeats across the join', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const deck = new Deck([1, 2, 3, 4], seeded(seed));
      const seq = Array.from({ length: 12 }, () => deck.draw() as number);
      for (let round = 0; round < 3; round++) {
        expect(new Set(seq.slice(round * 4, round * 4 + 4)).size).toBe(4);
      }
      for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
    }
  });

  it('handles a single card and an empty deck', () => {
    const one = new Deck(['a']);
    expect([one.draw(), one.draw(), one.draw()]).toEqual(['a', 'a', 'a']);
    expect(new Deck([]).draw()).toBeUndefined();
  });

  it('actually shuffles', () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const deck = new Deck([1, 2, 3, 4, 5], seeded(seed));
      orders.add(Array.from({ length: 5 }, () => deck.draw()).join());
    }
    expect(orders.size).toBeGreaterThan(5);
  });

  it('does not change the list it was given', () => {
    const items = [1, 2, 3];
    const deck = new Deck(items, seeded(3));
    deck.draw();
    expect(items).toEqual([1, 2, 3]);
  });
});

describe('share links', () => {
  it('builds the hash from the game id', () => expect(shareHash(byId('charades'))).toBe('#g=charades'));

  it('parses a hash back to an id', () => {
    expect(parseShareHash('#g=charades')).toBe('charades');
    expect(parseShareHash('g=the-moon-is-in-the-spoon')).toBe('the-moon-is-in-the-spoon');
  });

  it.each(['', '#', '#x=1', '#g=', '#g=<script>', '#g=a b', '#g=Charades', '#g=../x'])('ignores %j', (h) =>
    expect(parseShareHash(h)).toBeNull());

  it('round-trips every game', () => {
    for (const g of GAMES) expect(findGameById(GAMES, parseShareHash(shareHash(g)))).toBe(g);
  });

  it('finds nothing for an unknown or missing id', () => {
    expect(findGameById(GAMES, 'nope')).toBeUndefined();
    expect(findGameById(GAMES, null)).toBeUndefined();
  });

  it('builds a full link, dropping the old query and hash', () => {
    expect(shareUrl('https://thefulldeck.netlify.app/deck-app.html?cat=word#g=picnic', byId('charades'))).toBe(
      'https://thefulldeck.netlify.app/deck-app.html#g=charades',
    );
  });
});

describe('rulesHTML', () => {
  it('writes the goal, numbered steps and ending, and the example only when there is one', () => {
    const html = rulesHTML({ goal: 'Win', steps: ['One', 'Two'], ends: 'Done' });
    expect(html).toContain('Goal</span>Win');
    expect(html.match(/<li>/g)).toHaveLength(2);
    expect(html).toContain('Ends</span>Done');
    expect(html).not.toContain('Example');
    expect(rulesHTML({ goal: 'a', steps: ['b'], ends: 'c', example: 'd' })).toContain('Example</span>d');
  });
  it('escapes HTML in the text', () => {
    expect(rulesHTML({ goal: '<b>&', steps: ['<i>'], ends: 'x' })).toContain('&lt;b&gt;&amp;');
  });
});

describe('game data', () => {
  it('has 27 games across the three live categories', () => {
    expect(GAMES).toHaveLength(27);
    expect(new Set(GAMES.map((g) => g.cat))).toEqual(new Set(['word', 'dinner', 'active']));
  });
  it('has unique, link-safe ids', () => {
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(GAMES.length);
    for (const g of GAMES) expect(g.id).toMatch(/^[a-z0-9-]+$/);
    expect(byId('charades').title).toBe('Charades');
  });
  it('has player counts the parser understands', () => {
    for (const g of GAMES) expect(() => parsePlayers(g.players), g.title).not.toThrow();
  });
  it('gives long equipment text a short version for the list', () => {
    for (const g of GAMES) {
      if (g.setup.length > 24) expect(g.setupShort, g.title).toBeTruthy();
      if (g.setupShort) expect(g.setupShort.length, g.title).toBeLessThanOrEqual(26);
    }
  });
  it('has complete rules in plain English, without P1/P2 notation', () => {
    for (const g of GAMES) {
      expect(g.rules.goal, g.title).toBeTruthy();
      expect(g.rules.ends, g.title).toBeTruthy();
      expect(g.rules.steps.length, g.title).toBeGreaterThanOrEqual(2);
      expect(g.rules.steps.length, g.title).toBeLessThanOrEqual(5);
      expect(JSON.stringify(g.rules), g.title).not.toMatch(/\bP[0-9]\b/);
    }
  });
  it('marks exactly the five secret-rule games', () => {
    expect(GAMES.filter((g) => g.spoiler).map((g) => g.id).sort()).toEqual(
      ['likes', 'note-noti', 'picnic', 'psychiatrist', 'the-moon-is-in-the-spoon'],
    );
  });
});
