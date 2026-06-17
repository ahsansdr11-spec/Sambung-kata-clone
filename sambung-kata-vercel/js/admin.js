/* ============================================================
   ADMIN PANEL — Sambung Kata
   ============================================================ */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const TOKEN_KEY = 'sk_admin_token';
  let me = null;

  const Toast = {
    el: null,
    show(m) { this.el = this.el || $('#toast'); if (!this.el) return; this.el.textContent = m; this.el.classList.add('show'); clearTimeout(this._t); this._t = setTimeout(() => this.el.classList.remove('show'), 2200); }
  };

  function token() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }

  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    const t = token();
    if (t) headers.Authorization = 'Bearer ' + t;
    const res = await fetch(path, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  }

  // ---------- AUTH ----------
  async function doLogin() {
    const username = $('#luser').value.trim();
    const password = $('#lpass').value;
    $('#loginErr').textContent = '';
    try {
      const r = await api('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      setToken(r.token);
      await boot();
    } catch (e) {
      $('#loginErr').textContent = e.message;
    }
  }

  function logout() { setToken(null); location.reload(); }

  async function boot() {
    try {
      me = await api('/api/me');
    } catch {
      $('#loginView').classList.remove('hidden');
      $('#dashView').classList.add('hidden');
      return;
    }
    $('#loginView').classList.add('hidden');
    $('#dashView').classList.remove('hidden');
    $('#whoami').textContent = `· ${me.username}${me.isSuper ? ' (superadmin)' : ''}`;
    if (!me.isSuper) $('#usersTab').style.display = 'none';
    loadManage();
    loadTodayStats();
    if (me.isSuper) loadUsers();
  }

  // ---------- TODAY STATS ----------
  async function loadTodayStats() {
    try {
      const res = await fetch('/api/stats-today', { cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();
      $('#adminTodayVerified').textContent = d.verified || 0;
      $('#adminTodayRejected').textContent = d.rejected || 0;
      $('#adminTodayAdded').textContent = d.added || 0;
    } catch (e) { /* ignore */ }
  }

  // ---------- TABS ----------
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tabpane').forEach(p => p.classList.add('hidden'));
      $('#tab-' + tab.dataset.tab).classList.remove('hidden');
      if (tab.dataset.tab === 'manage') loadManage();
      if (tab.dataset.tab === 'users') loadUsers();
      if (tab.dataset.tab === 'tactical') loadTactical();
    });
  });

  // ---------- TACTICAL ----------
  async function loadTactical() {
    try {
      const d = await api('/api/admin/tactical');
      const list = $('#tacList');
      list.innerHTML = d.tactical.length ? '' : '<div class="muted">Belum ada tactical suffix</div>';
      d.tactical.forEach(t => {
        const el = document.createElement('div'); el.className = 'item';
        el.innerHTML = `<span>${t.suffix.toUpperCase()} <span class="badge">tier ${t.tier}</span></span>`;
        const del = document.createElement('button'); del.className = 'a-btn ghost sm'; del.textContent = 'Hapus';
        del.onclick = async () => { await api('/api/admin/tactical', { method: 'POST', body: JSON.stringify({ action: 'delete', suffix: t.suffix }) }); loadTactical(); };
        el.appendChild(del); list.appendChild(el);
      });
    } catch (e) { Toast.show(e.message); }
  }

  // ---------- WORD ACTIONS ----------
  async function wordAction(action, word, verified, msgEl) {
    msgEl && (msgEl.textContent = '');
    try {
      const r = await api('/api/admin/words', { method: 'POST', body: JSON.stringify({ action, word, verified }) });
      Toast.show(r.message || 'OK');
      loadManage();
      loadTodayStats();
      return true;
    } catch (e) { if (msgEl) msgEl.textContent = e.message; else Toast.show(e.message); return false; }
  }

  async function loadManage() {
    try {
      const d = await api('/api/admin/words');
      const added = $('#addedList');
      added.innerHTML = d.added.length ? '' : '<div class="muted">Belum ada kata tambahan</div>';
      d.added.forEach(r => {
        const el = document.createElement('div'); el.className = 'item';
        el.innerHTML = `<span>${r.word} <span class="badge ${r.verified ? 'v' : 'u'}">${r.verified ? 'verified' : 'unverified'}</span></span>`;
        const del = document.createElement('button'); del.className = 'a-btn ghost sm'; del.textContent = 'Hapus';
        del.onclick = () => wordAction('delete_added', r.word, false);
        el.appendChild(del); added.appendChild(el);
      });
      const rej = $('#rejectedList');
      rej.innerHTML = d.rejected.length ? '' : '<div class="muted">Belum ada kata di-reject</div>';
      d.rejected.forEach(r => {
        const el = document.createElement('div'); el.className = 'item';
        el.innerHTML = `<span>${r.word}</span>`;
        const un = document.createElement('button'); un.className = 'a-btn ghost sm'; un.textContent = 'Batalkan';
        un.onclick = () => wordAction('unreject', r.word, false);
        el.appendChild(un); rej.appendChild(el);
      });
    } catch (e) { Toast.show(e.message); }
  }

  // ---------- USER ACTIONS ----------
  async function loadUsers() {
    if (!me?.isSuper) return;
    try {
      const d = await api('/api/admin/users');
      const list = $('#usersList'); list.innerHTML = '';
      d.users.forEach(u => {
        const el = document.createElement('div'); el.className = 'item';
        el.innerHTML = `<span>${u.username} ${u.is_super ? '<span class="badge v">superadmin</span>' : ''}</span>`;
        const box = document.createElement('div'); box.style.display = 'flex'; box.style.gap = '6px';
        if (!u.is_super) { const p = btn('Jadikan Super', 'ghost', () => userAction('promote', u.username)); box.appendChild(p); }
        else { const p = btn('Cabut Super', 'ghost', () => userAction('demote', u.username)); box.appendChild(p); }
        box.appendChild(btn('Hapus', 'danger', () => { if (confirm('Hapus user ' + u.username + '?')) userAction('delete', u.username); }));
        el.appendChild(box); list.appendChild(el);
      });
    } catch (e) { Toast.show(e.message); }
  }
  function btn(txt, cls, fn) { const b = document.createElement('button'); b.className = 'a-btn sm ' + cls; b.textContent = txt; b.onclick = fn; return b; }
  async function userAction(action, username, password, isSuper) {
    try { const r = await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ action, username, password, isSuper }) }); Toast.show(r.message); loadUsers(); }
    catch (e) { Toast.show(e.message); }
  }

  // ---------- BIND ----------
  $('#loginBtn').onclick = doLogin;
  $('#lpass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  $('#logoutBtn').onclick = logout;

  $('#addBtn').onclick = () => wordAction('add', $('#addWord').value, $('#addVerified').checked, $('#addMsg')).then(ok => { if (ok) $('#addWord').value = ''; });
  $('#rejBtn').onclick = () => wordAction('reject', $('#rejWord').value, false, $('#rejMsg')).then(ok => { if (ok) $('#rejWord').value = ''; });
  $('#verBtn').onclick = () => wordAction('verify', $('#verWord').value, $('#verVal').checked, $('#verMsg'));

  $('#tacBtn').onclick = async () => {
    $('#tacMsg').textContent = '';
    try {
      const r = await api('/api/admin/tactical', { method: 'POST', body: JSON.stringify({ action: 'add', suffix: $('#tacWord').value, tier: parseInt($('#tacTier').value) || 1 }) });
      Toast.show(r.message); $('#tacWord').value = ''; loadTactical();
    } catch (e) { $('#tacMsg').textContent = e.message; }
  };

  $('#cpBtn').onclick = async () => {
    $('#cpMsg').textContent = '';
    try {
      const r = await api('/api/admin/change-password', { method: 'POST', body: JSON.stringify({ current: $('#cpCur').value, newPassword: $('#cpNew').value, confirm: $('#cpConf').value }) });
      Toast.show(r.message); $('#cpCur').value = $('#cpNew').value = $('#cpConf').value = '';
    } catch (e) { $('#cpMsg').textContent = e.message; }
  };

  $('#nuBtn').onclick = async () => {
    $('#nuMsg').textContent = '';
    try {
      const r = await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ action: 'create', username: $('#nuUser').value.trim(), password: $('#nuPass').value, isSuper: $('#nuSuper').checked }) });
      Toast.show(r.message); $('#nuUser').value = ''; $('#nuPass').value = ''; $('#nuSuper').checked = false; loadUsers();
    } catch (e) { $('#nuMsg').textContent = e.message; }
  };

  boot();
})();
