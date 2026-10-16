import type { Cents } from "./money";

/** What the pocket says. Pools by context, dealt like a shuffled deck so lines don't repeat until it runs out. */
const POOLS: Record<string, string[]> = {
  in: ["Yum!", "Ooh, shiny!", "Thank you!", "Mmm, coins", "More, please", "Cha-ching!", "Feeling richer", "Into the pocket!", "Coin acquired", "Jingle jingle"],
  inBig: ["Payday!", "Big money!", "Whoa, nice!", "We're rich! (ish)", "Look at all these coins", "So heavy now"],
  gift: ["A gift? How lovely", "Someone likes you", "Free money!", "Say thank you!"],
  refund: ["Money back!", "Refund secured", "It came back home"],
  out: ["Oof", "Bye-bye, coin", "There it goes", "Spent!", "Hope it was worth it", "See you, coin", "Lighter pocket", "And it's gone"],
  outBig: ["Whoa, big one", "That was a lot of coins", "Ouch", "My pocket felt that"],
  outSmall: ["Just a tiny one", "Pocket change", "Barely felt it"],
  games: ["Another game? Have fun", "Game on!", "GG", "Add it to the backlog", "Player one ready", "Just one more game…"],
  subscriptions: ["Another subscription…", "Monthly friend added", "Subscribed!", "Renewing, renewing"],
  bills: ["Adulting", "Bills, bills, bills", "Responsible!", "Lights stay on"],
  apps: ["New app, new me", "Installed!", "Shiny new app"],
  food: ["Bon appétit", "Snack time", "Was it tasty?"],
  shopping: ["Ooh, what did you get?", "Retail therapy", "Show me later"],
  fun: ["Have fun!", "Treat yourself", "Enjoy it!"],
  transport: ["Safe travels", "Vroom", "Off you go"],
  waiting: ["Can't wait!", "Counting the days", "Soon…", "I'll keep an eye out"],
  planned: ["I'll remember it", "Noted", "On the calendar"],
  poke: ["Hehe", "That tickles!", "Still here!", "Hi there", "Boop", "Careful, I'm full of coins", "Need something?", "*jingle*", "Again!", "You found me"],
  morning: ["Morning!", "Good morning", "Rise and shine"],
  night: ["Up late?", "Night owl!", "Sleep soon"],
  skip: ["Skipped!", "Maybe next time", "Okay, not this one"],
  paused: ["Taking a nap", "Paused!"],
  resumed: ["Back at it!", "Awake again"],
  deleted: ["Poof!", "Gone", "Never happened"],
  undo: ["Never mind!", "Undone", "Back where it was"],
  welcome: ["Hi! I'm your Pocket", "Nice to meet you!", "Let's keep an eye on your coins"],
  paired: ["New friend!", "We're connected", "Hi, new device!"],
};

const decks = new Map<string, string[]>();

function shuffled<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function line(pool: string): string {
  let deck = decks.get(pool);
  if (!deck?.length) {
    deck = shuffled(POOLS[pool] ?? ["Hi"]);
    decks.set(pool, deck);
  }
  return deck.pop()!;
}

/** The right line for a change in the balance. */
export function lineForChange(diff: Cents, category?: string): string {
  if (diff > 0) {
    if (category === "gift" || category === "refund") return line(category);
    return line(diff >= 20_000 ? "inBig" : "in");
  }
  if (category && POOLS[category] && Math.random() < 0.6) return line(category);
  return line(-diff >= 5_000 ? "outBig" : -diff < 200 ? "outSmall" : "out");
}
