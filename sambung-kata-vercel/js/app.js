/* ============================================================
   SAMBUNG KATA — Word Cheat Sheet (Full Feature Clone)
   Persis sambung-kata-ten: Fast/Normal, Trap/Hide/Brutal/FullWidth,
   Sort by length, status filter, recent history, magic suffixes.
   ============================================================ */
(function () {
  'use strict';

  const LIMIT = 2500;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmt = (n) => n.toLocaleString('id-ID');

  const Toast = {
    el: null,
    show(m) { this.el = this.el || $('#toast'); if (!this.el) return; this.el.textContent = m; this.el.classList.add('show'); clearTimeout(this._t); this._t = setTimeout(() => this.el.classList.remove('show'), 2200); }
  };

  const LS = {
    g(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    s(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
    raw(k, d) { return localStorage.getItem(k) ?? d; },
    sraw(k, v) { localStorage.setItem(k, v); }
  };

  // ---------- State (mirrors sambung-kata-ten localStorage keys) ----------
  const State = {
    mode: 'fast',                               // ALWAYS default to fast on load (per-session)
    status: (function () { const v = localStorage.getItem('sk_testing_filter'); return (v === 'verified' || v === 'unverified') ? v : 'all'; })(),
    trap: true,                                 // ALWAYS default to trap ON on load (per-session)
    hide: false,
    brutal: false,
    fullWidth: false,
    sort: (function () { const v = localStorage.getItem('sk_sort_by_length'); return (v === 'asc' || v === 'desc') ? v : 'none'; })(),
    hiddenGroups: new Set(LS.g('sk_hidden_groups', [])),
    priority: new Set(LS.g('sk_priority_suffixes', [])),   // tactical suffixes pinned to top
    blocked: new Set(LS.g('sk_blocked_suffixes', [])),     // suffixes flagged as dangerous
    history: LS.g('sk_search_history', [])
  };
  function persist() {
    // NOTE: mode & trap are intentionally NOT persisted — they reset to Fast+Trap on every load.
    localStorage.setItem('sk_testing_filter', State.status);
    localStorage.setItem('sk_sort_by_length', State.sort);
    LS.s('sk_hidden_groups', Array.from(State.hiddenGroups));
    LS.s('sk_priority_suffixes', Array.from(State.priority));
    LS.s('sk_blocked_suffixes', Array.from(State.blocked));
    LS.s('sk_search_history', State.history);
  }

  // Check if a word ends with any blocked suffix (last 2-3 letters give opponent an opening)
  function isRisky(word) {
    if (!State.blocked.size) return false;
    for (const s of State.blocked) if (word.endsWith(s)) return true;
    return false;
  }

  // ---------- Word card ----------
  function makeCard(entry) {
    const v = entry.v === 1;
    const risky = isRisky(entry.w);
    const card = document.createElement('button');
    card.className = 'wcard ' + (v ? 'wcard-verified' : 'wcard-unverified') + (risky ? ' wcard-risky' : '');
    card.type = 'button';
    card.innerHTML = `<span class="wcard-word">${entry.w}</span><span class="wcard-badge">${risky ? '⚠' : (v ? '✓' : '•')}</span>`;
    if (risky) card.title = 'Risky — akhirannya cocok dengan blocked suffix';
    return card;
  }

  function pushHistory(w) {
    State.history = [w, ...State.history.filter(x => x !== w)].slice(0, 10);
    persist(); renderHistory();
  }
  function renderHistory() {
    const box = $('#recentBox'), list = $('#recentList');
    if (!box || !list) return;
    if (!State.history.length) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    list.innerHTML = '';
    State.history.forEach(w => {
      const c = document.createElement('button'); c.className = 'chip chip-ghost'; c.textContent = w;
      c.onclick = () => { $('#prefixInput').value = w; $('#suffixInput').value = ''; Search.run(); };
      list.appendChild(c);
    });
    const clr = document.createElement('button'); clr.className = 'recent-clear'; clr.textContent = 'Clear';
    clr.onclick = () => { State.history = []; persist(); renderHistory(); };
    list.appendChild(clr);
  }

  // ---------- Sorting ----------
  function applySort(arr) {
    if (State.sort === 'none') return arr;
    const copy = [...arr];
    copy.sort((a, b) => State.sort === 'asc' ? a.w.length - b.w.length || a.w.localeCompare(b.w) : b.w.length - a.w.length || a.w.localeCompare(b.w));
    return copy;
  }

  // ---------- Render groups ----------
  function renderTrapGroups(results) {
    // group by tactical suffix (-SUFFIX). Brutal includes long traps (4-5 letters).
    const groups = {};
    results.forEach(e => {
      const t = DataLayer.matchTactical(e.w, State.brutal);
      const key = t ? '-' + t.s.toUpperCase() : 'Other';
      if (!groups[key]) groups[key] = { words: [], tier: key === 'Other' ? 2 : (t ? t.t : 2) };
      groups[key].words.push(e);
    });
    const isPri = (key) => State.priority.has(key.replace(/^-/, '').toLowerCase());
    const keys = Object.keys(groups).sort((a, b) => {
      if (a === 'Other') return 1; if (b === 'Other') return -1;
      // pinned (priority) groups float to the very top
      const pa = isPri(a), pb = isPri(b);
      if (pa !== pb) return pa ? -1 : 1;
      const ga = groups[a], gb = groups[b];
      if (ga.tier !== gb.tier) return ga.tier - gb.tier;
      if (a.length !== b.length) return b.length - a.length;
      return a.localeCompare(b);
    });
    return keys.map(k => [k + (isPri(k) ? ' ★' : ''), applySort(groups[k].words), k === 'Other' ? 'acc-zinc' : (isPri(k) ? 'acc-emerald' : 'acc-rose'), k]);
  }

  // ---------- Search controller ----------
  const Search = {
    init() {
      this.prefix = $('#prefixInput');
      this.suffix = $('#suffixInput');
      this.out = $('#resultsArea');
      const deb = debounce(() => this.run(), 160);
      this.prefix.addEventListener('input', deb);
      this.suffix.addEventListener('input', deb);
      this.prefix.addEventListener('keydown', e => { if (e.key === 'Enter') this.run(); });
      this.suffix.addEventListener('keydown', e => { if (e.key === 'Enter') this.run(); });
      $('#clearBtn')?.addEventListener('click', () => this.clear());
    },
    clear() { this.prefix.value = ''; this.suffix.value = ''; this.render([]); },
    run() {
      const p = this.prefix.value.trim().toLowerCase();
      const s = this.suffix.value.trim().toLowerCase();
      if (!p && !s) { this.render([]); return; }
      const groups = [];

      if (State.mode === 'fast') {
        // single bar (prefix input) drives both prefix + suffix
        const q = p || s;
        const pre = DataLayer.searchPrefix(q, State.status, LIMIT);
        const suf = DataLayer.searchSuffix(q, State.status, LIMIT);
        if (State.trap) {
          // Trap mode: words starting with q, grouped by their TRAP ENDING.
          // Priority traps first, then other traps, then "Other" (no trap) at the bottom.
          renderTrapGroups(pre).forEach(g => groups.push(g));
        } else {
          groups.push(['PREFIX  ' + q + '…', applySort(pre), 'acc-emerald', '__prefix']);
          groups.push(['SUFFIX  …' + q, applySort(suf), 'acc-rose', '__suffix']);
        }
      } else {
        // normal: separate prefix + suffix
        if (p && s) groups.push(['COMBO  ' + p + '…' + s, applySort(DataLayer.searchCombo(p, s, State.status, LIMIT)), 'acc-emerald', '__combo']);
        else if (p) groups.push(['PREFIX  ' + p + '…', applySort(DataLayer.searchPrefix(p, State.status, LIMIT)), 'acc-emerald', '__prefix']);
        else if (s) groups.push(['SUFFIX  …' + s, applySort(DataLayer.searchSuffix(s, State.status, LIMIT)), 'acc-rose', '__suffix']);
      }
      this.render(groups);
    },
    render(groups) {
      this.out.innerHTML = '';
      if (!groups || groups.length === 0) {
        this.out.innerHTML = `<div class="empty"><div class="empty-icon">⌨</div><div class="empty-title">Type prefix, suffix, or both</div><div class="empty-sub">Try the Magic Suffixes above</div></div>`;
        $('#resultsSummary').textContent = '';
        return;
      }
      let total = 0;
      groups.forEach(([title, res, acc, key]) => {
        if (State.hide && State.hiddenGroups.has(key)) return;
        total += res.length;
        this.out.appendChild(this.group(title, res, acc, key));
      });
      $('#resultsSummary').textContent = `${fmt(total)} RESULTS`;
    },
    group(title, results, acc, key) {
      const g = document.createElement('div'); g.className = 'rgroup';
      const head = document.createElement('div'); head.className = 'rgroup-head';
      head.innerHTML = `<span class="rgroup-title ${acc}">${title}</span><span class="rgroup-count">${fmt(results.length)}${results.length >= LIMIT ? '+' : ''}</span>`;
      if (State.hide && State.mode === 'fast') {
        head.style.cursor = 'pointer';
        head.title = 'Klik untuk sembunyikan grup ini';
        head.addEventListener('click', () => { State.hiddenGroups.add(key); persist(); Search.run(); });
      }
      g.appendChild(head);
      if (results.length === 0) {
        const e = document.createElement('div'); e.className = 'rgroup-empty'; e.textContent = 'No results — Try a different combination';
        g.appendChild(e); return g;
      }
      const grid = document.createElement('div'); grid.className = 'wgrid' + (State.fullWidth ? ' wgrid-full' : '');
      const cap = State.brutal ? results.length : Math.min(results.length, 200);
      for (let i = 0; i < cap; i++) grid.appendChild(makeCard(results[i]));
      g.appendChild(grid);
      if (results.length > cap) {
        const more = document.createElement('div'); more.className = 'rgroup-more'; more.textContent = `+ ${fmt(results.length - cap)} MORE (Reach Limit)`;
        g.appendChild(more);
      }
      return g;
    }
  };
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  // ---------- Magic suffixes (ALL traps shown) ----------
  // pinMode: when 'priority' or 'block', clicking a chip pins/blocks it instead of searching
  let pinMode = 'off'; // off | priority | block

  function initMagic() {
    const bar = $('#magicBar'); if (!bar) return;
    let tac = DataLayer.getTactical();
    if (!tac.length) tac = ['oa', 'ez', 'ks', 'tt', 'x', 'z', 'q'].map(s => ({ s }));
    // Show ALL traps, sorted shortest-first (strongest traps)
    const all = [...tac].sort((a, b) => a.s.length - b.s.length || a.s.localeCompare(b.s));
    bar.innerHTML = '';
    all.forEach(t => {
      const sfx = t.s;
      const count = DataLayer.searchSuffix(sfx, 'all', LIMIT).length;
      const tier = count === 0 ? 'tier-dead' : count < 30 ? 'tier-hard' : count < 200 ? 'tier-mid' : 'tier-easy';
      const chip = document.createElement('button');
      chip.className = `magic-chip ${tier}`;
      chip.dataset.sfx = sfx;
      updateChipState(chip, sfx);
      chip.innerHTML = `<span class="magic-sfx">${sfx.toUpperCase()}</span><span class="magic-num">${count >= LIMIT ? LIMIT + '+' : count}</span>`;
      chip.onclick = () => {
        if (pinMode === 'priority') {
          toggleSet(State.priority, sfx); persist(); updateChipState(chip, sfx); Search.run();
          Toast.show(State.priority.has(sfx) ? `★ "${sfx.toUpperCase()}" diprioritaskan` : `Prioritas "${sfx.toUpperCase()}" dilepas`);
        } else if (pinMode === 'block') {
          toggleSet(State.blocked, sfx); persist(); updateChipState(chip, sfx); Search.run();
          Toast.show(State.blocked.has(sfx) ? `🛡 "${sfx.toUpperCase()}" diblokir` : `Block "${sfx.toUpperCase()}" dilepas`);
        } else {
          if (State.mode === 'fast') { Search.prefix.value = sfx; Search.suffix.value = ''; }
          else { Search.prefix.value = ''; Search.suffix.value = sfx; }
          Search.run(); $('#resultsArea')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };
      bar.appendChild(chip);
    });
  }
  function toggleSet(set, val) { set.has(val) ? set.delete(val) : set.add(val); }
  function updateChipState(chip, sfx) {
    chip.classList.toggle('is-priority', State.priority.has(sfx));
    chip.classList.toggle('is-blocked', State.blocked.has(sfx));
  }
  function refreshMagicStates() {
    $$('#magicBar .magic-chip').forEach(c => updateChipState(c, c.dataset.sfx));
  }

  // ---------- Toggles & controls ----------
  function syncUI() {
    $('#modeToggle').textContent = State.mode === 'fast' ? 'Fast' : 'Normal';
    $('#modeToggle').classList.toggle('on', State.mode === 'fast');
    $('#suffixField').style.display = State.mode === 'fast' ? 'none' : '';
    $('#prefixInput').placeholder = State.mode === 'fast' ? 'Search...' : 'Starts with...';
    $('#trapToggle').classList.toggle('on', State.trap);
    $('#hideToggle').classList.toggle('on', State.hide);
    $('#brutalToggle').classList.toggle('on', State.brutal);
    $('#fullToggle').classList.toggle('on', State.fullWidth);
    $('#sortToggle').textContent = State.sort === 'none' ? 'Sort A–Z' : State.sort === 'asc' ? 'Pendek→Panjang' : 'Panjang→Pendek';
    // status cycle button
    const stLabel = { all: 'All', verified: 'Verified', unverified: 'Unverified' }[State.status];
    $('#statusToggle').textContent = stLabel;
    $('#statusToggle').classList.toggle('on', State.status !== 'all');
    // priority / block pin modes
    $('#priorityToggle').classList.toggle('on', pinMode === 'priority');
    $('#blockToggle').classList.toggle('on', pinMode === 'block');
    // fast-only toggles disabled in normal mode
    const fastOnly = State.mode === 'fast';
    ['#trapToggle', '#hideToggle', '#brutalToggle'].forEach(id => { const b = $(id); b.disabled = !fastOnly; b.classList.toggle('disabled', !fastOnly); });
  }

  function initControls() {
    $('#modeToggle').onclick = () => { State.mode = State.mode === 'fast' ? 'normal' : 'fast'; persist(); syncUI(); Search.run(); Toast.show(State.mode === 'fast' ? 'Fast Mode — single search bar' : 'Normal Mode — separate prefix + suffix'); };
    $('#trapToggle').onclick = () => { if (State.mode !== 'fast') return Toast.show('Trap Mode — Fast mode only'); State.trap = !State.trap; persist(); syncUI(); Search.run(); Toast.show(State.trap ? 'Trap Mode: ON — tactical grouping' : 'Trap Mode: OFF'); };
    $('#hideToggle').onclick = () => { if (State.mode !== 'fast') return Toast.show('Hide Mode — Fast mode only'); State.hide = !State.hide; if (!State.hide) State.hiddenGroups.clear(); persist(); syncUI(); Search.run(); Toast.show(State.hide ? 'Hide Mode: ON — klik judul grup' : 'Hide Mode: OFF'); };
    $('#brutalToggle').onclick = () => { if (State.mode !== 'fast') return Toast.show('Brutal Mode — Fast mode only'); State.brutal = !State.brutal; syncUI(); Search.run(); Toast.show(State.brutal ? 'Brutal Mode: ON — showing all' : 'Brutal Mode: OFF'); };
    $('#fullToggle').onclick = () => { State.fullWidth = !State.fullWidth; syncUI(); Search.run(); };
    $('#sortToggle').onclick = () => { State.sort = State.sort === 'none' ? 'asc' : State.sort === 'asc' ? 'desc' : 'none'; persist(); syncUI(); Search.run(); };
    $('#showHiddenBtn').onclick = () => { State.hiddenGroups.clear(); persist(); Search.run(); Toast.show('Semua grup ditampilkan lagi'); };
    $('#randomBtn').onclick = () => { const w = DataLayer.getRandomWord(); if (w) { $('#prefixInput').value = State.mode === 'fast' ? w : w[0]; $('#suffixInput').value = ''; Search.run(); Toast.show('Random: ' + w); } };
    // status cycle button (All -> Verified -> Unverified -> All)
    $('#statusToggle').onclick = () => {
      State.status = State.status === 'all' ? 'verified' : State.status === 'verified' ? 'unverified' : 'all';
      persist(); syncUI(); Search.run();
    };
    // Priority pin mode
    $('#priorityToggle').onclick = () => {
      pinMode = pinMode === 'priority' ? 'off' : 'priority';
      syncUI();
      Toast.show(pinMode === 'priority' ? '★ Priority: klik chip suffix di atas buat pin' : 'Priority mode off');
    };
    // Block pin mode
    $('#blockToggle').onclick = () => {
      pinMode = pinMode === 'block' ? 'off' : 'block';
      syncUI();
      Toast.show(pinMode === 'block' ? '🛡 Block: klik chip suffix buat tandai bahaya' : 'Block mode off');
    };
  }

  // ---------- Change password (link to admin if backend; else info) ----------
  function initMisc() {
    const cp = $('#changePassLink');
    if (cp) cp.onclick = (e) => { e.preventDefault(); Toast.show('Ganti password via Admin Panel (/admin)'); };
  }

  // ---------- Today stats (reset midnight WITA) ----------
  async function loadTodayStats() {
    try {
      const res = await fetch('/api/stats-today', { cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();
      $('#todayVerified') && ($('#todayVerified').textContent = fmt(d.verified || 0));
      $('#todayRejected') && ($('#todayRejected').textContent = fmt(d.rejected || 0));
      $('#todayAdded') && ($('#todayAdded').textContent = fmt(d.added || 0));
    } catch (e) { /* static mode — leave at 0 */ }
  }

  // ---------- Auth (login gate) ----------
  const Auth = {
    KEY: 'sk_user_token',
    token() { return localStorage.getItem(this.KEY); },
    setToken(t) { t ? localStorage.setItem(this.KEY, t) : localStorage.removeItem(this.KEY); },

    // Returns true if a valid session exists
    async check() {
      const t = this.token();
      if (!t) return false;
      try {
        const res = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + t } });
        return res.ok;
      } catch { return false; }
    },

    showGate() {
      $('#authGate')?.classList.remove('hidden');
      $('#loader')?.remove();
      const btn = $('#authBtn'), err = $('#authErr');
      const doLogin = async () => {
        const username = $('#authUser').value.trim();
        const password = $('#authPass').value;
        err.textContent = '';
        if (!username || !password) { err.textContent = 'Isi username & password'; return; }
        btn.disabled = true; btn.textContent = 'Logging in…';
        try {
          const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
          this.setToken(data.token);
          location.reload();
        } catch (e) {
          err.textContent = e.message || 'Login gagal';
          btn.disabled = false; btn.textContent = 'LOGIN';
        }
      };
      btn.onclick = doLogin;
      $('#authPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
      $('#authUser').focus();
    },

    logout() { this.setToken(null); location.reload(); }
  };

  // ---------- Init ----------
  async function init() {
    const loader = $('#loader');

    // GATE: require login before showing the app
    const loggedIn = await Auth.check();
    if (!loggedIn) { Auth.showGate(); return; }

    // show logout button
    const lo = $('#logoutBtn');
    if (lo) { lo.classList.remove('hidden'); lo.onclick = () => Auth.logout(); }

    try { await DataLayer.load('data/words.json'); }
    catch (err) { if (loader) loader.innerHTML = `<div class="loader-err">⚠ Gagal memuat database.<br><small>Buka via server (localhost), bukan file://</small></div>`; console.error(err); return; }
    loader?.remove();

    $('#statTotal').textContent = fmt(DataLayer.getTotal());
    $('#statVerified').textContent = fmt(DataLayer.getVerifiedCount());
    $('#statTactical') && ($('#statTactical').textContent = fmt(DataLayer.getTactical().length));

    Search.init();
    initMagic();
    initControls();
    initMisc();
    loadTodayStats();
    syncUI();
    renderHistory();
    Search.render([]);
    $('#prefixInput')?.focus();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
