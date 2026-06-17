/* ============================
   SAMBUNG KATA - Data Layer
   Offline word engine + admin changes merge + tactical suffixes
   ============================ */

const DataLayer = (function () {
  let wordsData = null;
  let wordArray = [];
  let wordSet = new Set();
  let meta = null;
  let tactical = [];           // [{s, t}]
  let tacticalByLen = [];      // sorted by suffix length desc for matching

  function buildIndices(words) {
    wordSet = new Set(words.map(e => e.w));
    words.sort((a, b) => a.w < b.w ? -1 : a.w > b.w ? 1 : 0);
    wordArray = words;
  }

  function applyChanges(ch) {
    if (!ch) return;
    const byWord = new Map(wordsData.map(e => [e.w, e]));
    (ch.added || []).forEach(a => {
      const w = (a.w || '').toLowerCase();
      if (!w) return;
      if (byWord.has(w)) byWord.get(w).v = a.v;
      else { const e = { w, s: w[0], e: w[w.length - 1], l: w.length, v: a.v }; byWord.set(w, e); wordsData.push(e); }
    });
    (ch.verifications || []).forEach(v => { const e = byWord.get((v.w || '').toLowerCase()); if (e) e.v = v.v; });
    const rejected = new Set((ch.rejected || []).map(w => w.toLowerCase()));
    if (rejected.size) wordsData = wordsData.filter(e => !rejected.has(e.w));
    if (meta) meta.total = wordsData.length;
  }

  function lowerBound(p) {
    let lo = 0, hi = wordArray.length;
    while (lo < hi) { const m = (lo + hi) >>> 1; if (wordArray[m].w < p) lo = m + 1; else hi = m; }
    return lo;
  }

  function passStatus(e, status) {
    if (status === 'verified') return e.v === 1;
    if (status === 'unverified') return e.v === 0;
    return true;
  }

  return {
    async load(url = 'data/words.json') {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      wordsData = data.words;
      meta = data.meta;

      // tactical suffixes (offline file) — fallback to API later
      try {
        const tr = await fetch('data/tactical-suffixes.json');
        if (tr.ok) tactical = await tr.json();
      } catch (e) { tactical = []; }

      // admin changes from backend (if deployed)
      try {
        const cr = await fetch('/api/changes', { cache: 'no-store' });
        if (cr.ok) applyChanges(await cr.json());
        const tr2 = await fetch('/api/tactical', { cache: 'no-store' });
        if (tr2.ok) { const t = await tr2.json(); if (Array.isArray(t) && t.length) tactical = t; }
      } catch (e) { /* static mode */ }

      tacticalByLen = [...tactical].sort((a, b) => b.s.length - a.s.length);
      buildIndices(wordsData);
      console.log(`Loaded ${meta.total.toLocaleString()} words, ${tactical.length} tactical suffixes`);
      return meta;
    },

    getMeta() { return meta; },
    getTotal() { return meta ? meta.total : 0; },
    getVerifiedCount() { return meta ? (meta.verified_count || 0) : 0; },
    getTactical() { return tactical; },
    isLoaded() { return wordsData !== null; },
    hasWord(w) { return wordSet.has((w || '').toLowerCase()); },

    // Match a word against tactical suffix list -> returns {s,t} or null.
    // brutal=false → only short traps (len<=3); brutal=true → include long traps (4-5 letters)
    matchTactical(word, brutal = false) {
      const w = word.toLowerCase();
      for (const t of tacticalByLen) {
        if (!brutal && t.s.length > 3) continue;
        if (w.endsWith(t.s)) return t;
      }
      return null;
    },

    searchPrefix(prefix, status = 'all', limit = 2500) {
      const p = (prefix || '').trim().toLowerCase();
      if (!p) return [];
      const out = [];
      for (let i = lowerBound(p); i < wordArray.length && out.length < limit; i++) {
        const e = wordArray[i];
        if (!e.w.startsWith(p)) break;
        if (passStatus(e, status)) out.push(e);
      }
      return out;
    },

    searchSuffix(suffix, status = 'all', limit = 2500) {
      const s = (suffix || '').trim().toLowerCase();
      if (!s) return [];
      const out = [];
      for (let i = 0; i < wordArray.length && out.length < limit; i++) {
        const e = wordArray[i];
        if (e.w.endsWith(s) && passStatus(e, status)) out.push(e);
      }
      return out;
    },

    searchCombo(prefix, suffix, status = 'all', limit = 2500) {
      const p = (prefix || '').trim().toLowerCase();
      const s = (suffix || '').trim().toLowerCase();
      if (!p && !s) return [];
      if (!p) return this.searchSuffix(s, status, limit);
      const out = [];
      for (let i = lowerBound(p); i < wordArray.length && out.length < limit; i++) {
        const e = wordArray[i];
        if (!e.w.startsWith(p)) break;
        if ((!s || e.w.endsWith(s)) && passStatus(e, status)) out.push(e);
      }
      return out;
    },

    getRandomWord() { return wordArray.length ? wordArray[Math.floor(Math.random() * wordArray.length)].w : null; },
    getStartStats() { return meta ? meta.starts_with : {}; },
    getEndStats() { return meta ? meta.ends_with : {}; }
  };
})();
