/* Admin Panel — Full with Announcements (NO COPY) */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const TOKEN_KEY = 'sk_admin_token';
  let me = null;

  const Toast = { el: null, show(m) { this.el = this.el || $('#toast'); if (!this.el) return; this.el.textContent = m; this.el.classList.add('show'); clearTimeout(this._t); this._t = setTimeout(() => this.el.classList.remove('show'), 2200); } };

  function token() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }

  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    const t = token(); if (t) headers.Authorization = 'Bearer ' + t;
    const res = await fetch(path, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
    return data;
  }

  async function boot() {
    const mainTok = localStorage.getItem('sk_user_token');
    if (mainTok && !token()) setToken(mainTok);

    try { me = await api('/api/me'); } catch { return; }

    const who = $('#whoami'); if (who) who.textContent = `${me.username}${me.isSuper ? ' • super' : ''}`;

    if (!me.isSuper) {
      ['contribTab','subTab','annTab'].forEach(id => { const el = $('#'+id); if(el) el.style.display='none'; });
    }

    loadTodayStats();
    loadMyStats();
    loadManage();
    loadTactical();
    if (me.isSuper) {
      loadContributions();
      loadSubscriptionUsers();
      loadAnnouncements();
    }

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
        const target = document.getElementById('tab-' + tab.dataset.tab);
        if (target) target.classList.remove('hidden');

        if (tab.dataset.tab === 'mystats') loadMyStats();
        if (tab.dataset.tab === 'contributions') loadContributions();
        if (tab.dataset.tab === 'subscription') loadSubscriptionUsers();
        if (tab.dataset.tab === 'announcements') loadAnnouncements();
        if (tab.dataset.tab === 'manage') loadManage();
        if (tab.dataset.tab === 'activitylog') loadActivityLog();
      });
    });

    bindAll();
  }

  function bindAll() {
    const addBtn = $('#addBtn'); if(addBtn) addBtn.onclick = async () => {
      const w=$('#addWord').value.trim();if(!w)return;
      try{
        if(me.isSuper) await api('/api/admin/words',{method:'POST',body:JSON.stringify({action:'add',word:w})});
        else await api('/api/contribute',{method:'POST',body:JSON.stringify({type:'add',word:w})});
        Toast.show(me.isSuper?'Ditambahkan':'Request dikirim');
        $('#addWord').value=''; loadManage();
      }catch(e){Toast.show(e.message);}
    };

    const rejBtn = $('#rejBtn'); if(rejBtn) rejBtn.onclick = async () => {
      const w=$('#rejWord').value.trim();if(!w)return;
      try{
        if(me.isSuper)await api('/api/admin/words',{method:'POST',body:JSON.stringify({action:'reject',word:w})});
        else await api('/api/contribute',{method:'POST',body:JSON.stringify({type:'reject',word:w})});
        Toast.show('Request dikirim'); $('#rejWord').value=''; loadManage();
      }catch(e){Toast.show(e.message);}
    };

    const tacBtn = $('#tacBtn'); if(tacBtn) tacBtn.onclick = async () => {
      const s=$('#tacWord').value.trim(); const t=parseInt($('#tacTier').value)||1;
      if(!s)return;
      try{
        await api('/api/admin/tactical',{method:'POST',body:JSON.stringify({action:'add',suffix:s,tier:t})});
        Toast.show('Tactical ditambah'); loadTactical(); $('#tacWord').value='';
      }catch(e){Toast.show(e.message);}
    };

    // === ANNOUNCEMENTS CREATE ===
    const annBtn = $('#annBtn');
    if (annBtn) annBtn.onclick = async () => {
      const title = $('#annTitle').value.trim();
      const content = $('#annContent').value.trim();
      const color = $('#annColor').value;
      const noExpiry = $('#annNoExpiry').checked;
      const value = $('#annValue').value;
      const unit = $('#annUnit').value;

      if (!title || !content) return Toast.show('Judul & isi wajib');

      try {
        await api('/api/admin/announcements', {
          method: 'POST',
          body: JSON.stringify({ title, content, color, value, unit, noExpiry })
        });
        Toast.show('Announcement dibuat!');
        $('#annTitle').value = '';
        $('#annContent').value = '';
        loadAnnouncements();
      } catch (e) { Toast.show(e.message); }
    };

    const lo = $('#logoutBtn'); if (lo) lo.onclick = logout;

    const sa = $('#searchAdded'); const sr = $('#searchRej');
    if (sa) sa.oninput = () => filterList('#addedList', sa.value);
    if (sr) sr.oninput = () => filterList('#rejectedList', sr.value);

    // === BULK IMPORT ===
    const bulkBtn = $('#bulkBtn');
    if (bulkBtn) bulkBtn.onclick = async () => {
      const words = $('#bulkWords').value.trim();
      const verified = $('#bulkVerified').checked;
      if (!words) return Toast.show('Tempel daftar kata dulu');
      const res = $('#bulkResult');
      if (res) res.textContent = 'Mengimport...';
      try {
        const d = await api('/api/admin/bulk-import', { method: 'POST', body: JSON.stringify({ words, verified }) });
        if (res) res.textContent = `${d.message}` + (d.bad && d.bad.length ? ` — contoh dilewati: ${d.bad.slice(0,8).join(', ')}` : '');
        Toast.show(d.message);
        $('#bulkWords').value = '';
        loadManage();
      } catch (e) {
        if (res) res.textContent = 'Gagal: ' + e.message;
        Toast.show(e.message);
      }
    };

    // === CSV EXPORT ===
    const exportBtn = $('#exportCsvBtn');
    if (exportBtn) exportBtn.onclick = async () => {
      try {
        Toast.show('Menyiapkan CSV...');
        const res = await fetch('/api/admin/export-csv', { headers: { Authorization: 'Bearer ' + token() } });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || 'Export gagal');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sambung-kata-export-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        Toast.show('CSV diunduh');
      } catch (e) { Toast.show(e.message); }
    };
  }

  async function loadTodayStats() {
    try{
      const d=await fetch('/api/stats-today').then(r=>r.json());
      $('#adminTodayVerified').textContent=d.verified||0;
      $('#adminTodayRejected').textContent=d.rejected||0;
      $('#adminTodayAdded').textContent=d.added||0;
    }catch{}
  }

  async function loadMyStats() {
    const box=$('#myStatsContent');if(!box)return; box.innerHTML='Loading...';
    try{
      const d=await api('/api/admin/my-stats');
      box.innerHTML=`
        <div style="margin-bottom:14px"><strong>Hari ini:</strong> ${d.today.added} added • ${d.today.verified} verified • ${d.today.rejected} rejected</div>
        <div style="margin-bottom:14px"><strong>Total sepanjang waktu:</strong> ${d.totals.added} added • ${d.totals.verified} verified • ${d.totals.rejected} rejected</div>
        <div><strong>Contribution requests saya:</strong> ${d.contributions.pending} pending • ${d.contributions.approved} approved • ${d.contributions.rejected} rejected</div>
      `;
    }catch{box.innerHTML='Gagal';}
  }

  async function loadManage() {
    try{
      const d=await api('/api/admin/words');
      const added=$('#addedList');added.innerHTML='';
      d.added.forEach(r=>{
        const el=document.createElement('div');el.className='list-item';
        el.innerHTML=`<span>${r.word}</span>`;
        const del=document.createElement('button');del.className='btn ghost sm';del.textContent='Hapus';
        del.onclick=()=>wordAction('delete_added',r.word);
        el.appendChild(del);added.appendChild(el);
      });
      const rej=$('#rejectedList');rej.innerHTML='<div class=\"section-title\" style=\"margin-top:10px\">REJECTED</div>';
      d.rejected.forEach(r=>{
        const el=document.createElement('div');el.className='list-item';
        el.innerHTML=`<span>${r.word}</span>`;
        const un=document.createElement('button');un.className='btn ghost sm';un.textContent='Batalkan';
        un.onclick=()=>wordAction('unreject',r.word);
        el.appendChild(un);rej.appendChild(el);
      });
    }catch{}
  }

  async function wordAction(action, word) {
    try{ await api('/api/admin/words',{method:'POST',body:JSON.stringify({action,word})}); Toast.show('OK'); loadManage(); }catch(e){Toast.show(e.message);}
  }

  function filterList(sel,q){ const list=$(sel); if(!list)return; q=q.toLowerCase(); Array.from(list.children).forEach(el=>el.style.display=el.textContent.toLowerCase().includes(q)?'':'none'); }

  async function loadTactical() {
    try{
      const d=await api('/api/admin/tactical'); const list=$('#tacList');list.innerHTML='';
      d.tactical.forEach(t=>{
        const el=document.createElement('div');el.className='list-item';
        el.innerHTML=`<span>${t.suffix}</span>`;
        const del=document.createElement('button');del.className='btn ghost sm';del.textContent='Hapus';
        del.onclick=async()=>{await api('/api/admin/tactical',{method:'POST',body:JSON.stringify({action:'delete',suffix:t.suffix})});loadTactical();};
        el.appendChild(del);list.appendChild(el);
      });
    }catch{}
  }

  async function loadContributions(){
    const box=$('#contribList');if(!box)return;box.innerHTML='Loading...';
    try{
      const d=await api('/api/admin/contributions');
      if(!d.requests.length){box.innerHTML='<div class=\"muted\">Tidak ada request</div>';return;}
      box.innerHTML='';
      d.requests.forEach(r=>{
        const el=document.createElement('div');el.className='list-item';
        el.innerHTML=`<span><b>${r.type}</b> ${r.word}</span>`;
        const ap=document.createElement('button');ap.className='btn sm';ap.textContent='Approve';
        ap.onclick=()=>handleContrib(r.id,'approve');
        const dn=document.createElement('button');dn.className='btn ghost sm';dn.textContent='Tolak';
        dn.onclick=()=>handleContrib(r.id,'reject');
        const w=document.createElement('div');w.style.display='flex';w.style.gap='4px';w.append(ap,dn);
        el.appendChild(w);box.appendChild(el);
      });
    }catch{box.innerHTML='Gagal';}
  }

  async function handleContrib(id,action){
    try{ await api('/api/admin/contributions',{method:'POST',body:JSON.stringify({id,action})}); Toast.show('Done'); loadContributions(); loadManage(); }catch(e){Toast.show(e.message);}
  }

  async function loadSubscriptionUsers(){
    const box=$('#subList');if(!box)return;box.innerHTML='Loading...';
    try{
      const d=await api('/api/admin/subscription'); box.innerHTML='';
      d.users.forEach(u=>{
        const el=document.createElement('div');el.className='list-item';
        let exp = u.is_permanent?'PERMANEN':(u.subscription_expires_at?new Date(u.subscription_expires_at).toLocaleDateString():'—');
        el.innerHTML=`<span><strong>${u.username}</strong> <small>${exp}</small></span>`;
        const act=document.createElement('div');act.style.display='flex';act.style.gap='4px';
        const ext=document.createElement('button');ext.className='btn ghost sm';ext.textContent='Extend';
        ext.onclick=()=>extend(u.username);
        const perm=document.createElement('button');perm.className='btn sm';perm.textContent=u.is_permanent?'Batal Permanen':'Permanen';
        perm.onclick=()=>u.is_permanent?unsetPerm(u.username):setPerm(u.username);
        act.append(ext,perm);el.appendChild(act);box.appendChild(el);
      });
    }catch{box.innerHTML='Gagal';}
  }

  async function extend(u){
    const value = $('#subExtVal')?.value || 30;
    const unit = $('#subExtUnit')?.value || 'day';
    try{
      const d = await api('/api/admin/subscription',{method:'POST',body:JSON.stringify({username:u,action:'extend',value,unit})});
      Toast.show(d.message || 'Extended');
      loadSubscriptionUsers();
    }catch(e){Toast.show(e.message);}
  }
  async function setPerm(u){ await api('/api/admin/subscription',{method:'POST',body:JSON.stringify({username:u,action:'set_permanent'})}); Toast.show('Permanen'); loadSubscriptionUsers(); }
  async function unsetPerm(u){ await api('/api/admin/subscription',{method:'POST',body:JSON.stringify({username:u,action:'unset_permanent'})}); Toast.show('Batal permanen'); loadSubscriptionUsers(); }

  // === ANNOUNCEMENTS ===
  async function loadAnnouncements() {
    const box = $('#annList'); if (!box) return;
    box.innerHTML = 'Loading...';
    try {
      const d = await api('/api/admin/announcements');
      if (!d.announcements.length) { box.innerHTML = '<div class=\"muted\">Belum ada announcement</div>'; return; }
      box.innerHTML = '';
      d.announcements.forEach(a => {
        const el = document.createElement('div'); el.className = 'list-item';
        const exp = a.expires_at ? new Date(a.expires_at).toLocaleDateString() : 'Permanent';
        el.innerHTML = `
          <div style=\"flex:1\">
            <strong>${a.title}</strong> 
            <span class=\"badge\" style=\"background:#333\">${a.color}</span>
            <div style=\"font-size:12px;margin-top:4px;color:#aaa\">${a.content.substring(0,70)}...</div>
            <div style=\"font-size:10px;color:#666\">Berlaku: ${exp}</div>
          </div>
        `;
        const del = document.createElement('button'); del.className = 'btn danger sm'; del.textContent = 'Hapus';
        del.onclick = async () => {
          if (confirm('Hapus announcement ini?')) {
            await api('/api/admin/announcements', { method: 'DELETE', body: JSON.stringify({ id: a.id }) });
            loadAnnouncements();
          }
        };
        const btns = document.createElement('div'); btns.style.display='flex'; btns.style.gap='4px';
        btns.appendChild(del);
        el.appendChild(btns);
        box.appendChild(el);
      });
    } catch { box.innerHTML = 'Gagal memuat'; }
  }

  // === ACTIVITY LOG ===
  async function loadActivityLog() {
    const box = $('#activityLogList'); if (!box) return;
    box.innerHTML = 'Loading...';
    try {
      const d = await api('/api/admin/activity-log');
      if (!d.logs.length) { box.innerHTML = '<div class=\"muted\">Belum ada activity</div>'; return; }
      box.innerHTML = '';
      d.logs.forEach(l => {
        const el = document.createElement('div'); el.className = 'list-item';
        const t = new Date(l.created_at).toLocaleString();
        const actionLabel = l.action === 'add' ? '➕ add' : l.action === 'reject' ? '🚫 reject' : l.action === 'verify' ? '✅ verify' : l.action;
        el.innerHTML = `<span>${actionLabel} <strong>${l.word || ''}</strong> <small class=\"muted\">oleh ${l.by_user || '—'}</small></span><small class=\"muted\">${t}</small>`;
        box.appendChild(el);
      });
    } catch { box.innerHTML = 'Gagal memuat'; }
  }

  // Boot
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
