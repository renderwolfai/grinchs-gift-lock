// Static stand-in for the kit's local game server (GitHub Pages serves files only).
// Every outcome is a round recorded from the Renderwolf math engine; this file only replays them.
// It answers the same POST /api/session and /api/spin calls that the kit's createApi() makes.
(() => {
  // Open in the stylized art unless the visitor already picked a look (same key as kit/stylized.js).
  const artKey = `artMode:${location.pathname}`;
  if (!localStorage.getItem(artKey)) localStorage.setItem(artKey, "stylized");

  const realFetch = window.fetch.bind(window);
  const roundsUrl = new URL("rounds/", document.baseURI);
  const index = realFetch(new URL("index.json", roundsUrl)).then((r) => r.json());
  const chunks = new Map();
  const cursors = new Map(); // bet → { chain, i }: one engine session per bet level
  let balance = 0, spinning = false, order = [], used = 0;

  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const loadChunk = (chain, k) => {
    const key = `${chain}-${k}`;
    if (!chunks.has(key)) chunks.set(key, realFetch(new URL(`${key}.json`, roundsUrl)).then((r) => r.json()));
    return chunks.get(key);
  };
  // Same rounding as lib/rounds.mjs creditsFor: bet multiple × bet cents, floored to a cent.
  const creditsFor = (amount, betCents) => {
    const [whole, frac = ""] = String(amount).split(".");
    return Number((BigInt(whole + frac) * BigInt(betCents)) / 10n ** BigInt(frac.length));
  };
  const nextChain = (n) => {
    if (used >= order.length) { order = [...Array(n).keys()].sort(() => Math.random() - 0.5); used = 0; }
    return order[used++];
  };

  async function spin({ bet }) {
    const idx = await index;
    if (!idx.config.bets.includes(bet)) return reply(400, { error: "invalid bet" });
    if (spinning) return reply(409, { error: "a spin is in progress" });
    if (balance < bet) return reply(402, { error: "insufficient balance" });
    spinning = true;
    try {
      let cur = cursors.get(bet);
      if (!cur || cur.i >= idx.roundsPerChain) cursors.set(bet, cur = { chain: nextChain(idx.chains), i: 0 });
      const k = Math.floor(cur.i / idx.chunkSize);
      const round = (await loadChunk(cur.chain, k))[cur.i % idx.chunkSize];
      cur.i++;
      if (cur.i % idx.chunkSize === Math.floor(idx.chunkSize / 2) && (k + 1) * idx.chunkSize < idx.roundsPerChain) loadChunk(cur.chain, k + 1);
      const win = creditsFor(round.totalWin, bet);
      balance += win - bet;
      return reply(200, { rounds: round.rounds, totalWin: win, totalWinX: round.totalWin, balance, pendingChoice: null });
    } finally { spinning = false; }
  }

  window.fetch = async (input, init = {}) => {
    const path = new URL(typeof input === "string" ? input : input.url, location.href).pathname;
    if (path.endsWith("/api/session")) {
      const idx = await index;
      balance = idx.startBalance; cursors.clear();
      loadChunk(nextChain(idx.chains), 0).catch(() => {});
      used--; // the prefetched chain is the first one handed out
      return reply(200, { id: "static", balance, config: idx.config });
    }
    if (path.endsWith("/api/spin")) return spin(JSON.parse(init.body ?? "{}"));
    if (path.endsWith("/api/choose")) return reply(409, { error: "no choice pending" });
    return realFetch(input, init);
  };
})();
