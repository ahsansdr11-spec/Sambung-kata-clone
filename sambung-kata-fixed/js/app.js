/* SAMBUNG KATA — Full Features + Announcements (NO COPY for sale) */
(function () {
  'use strict';

  const LIMIT = 2500;
  const $ = (s, r = document) => r.querySelector(s);
  const fmt = n => (n||0).toLocaleString('id-ID');

  const Toast = { show(m){const el=$('#toast');if(!el)return;el.textContent=m;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2100);} };

  const State = {
    mode:'fast', status:localStorage.getItem('sk_status')||'all',
    trap:true, brutal:false, fullWidth:false, sort:localStorage.getItem('sk_sort')||'none',
    history:JSON.parse(localStorage.getItem('sk_hist')||'[]')
  };

  function save(){ localStorage.setItem('sk_status',State.status); localStorage.setItem('sk_sort',State.sort); localStorage.setItem('sk_hist',JSON.stringify(State.history)); }

  function makeCard(w){
    const b=document.createElement('div');
    b.className='wcard';
    b.textContent=w;
    // NO copy on click — disabled for sale
    b.style.userSelect = 'none';
    b.style.webkitUserSelect = 'none';
    return b;
  }

  const Search = {
    run(){
      const q=($('#prefixInput')?.value||'').trim().toLowerCase();
      const out=$('#resultsArea');
      if(!q){ out.innerHTML='<div class=\"empty\">Ketik untuk mulai mencari</div>'; return; }
      let res=DataLayer.searchPrefix(q,State.status,LIMIT);
      if(State.sort==='asc') res.sort((a,b)=>a.w.length-b.w.length);
      out.innerHTML='';
      const grid=document.createElement('div');
      grid.className='wgrid'+(State.fullWidth?' wgrid-full':'');
      grid.style.userSelect = 'none';
      grid.style.webkitUserSelect = 'none';
      res.slice(0,State.brutal?400:160).forEach(e=>grid.appendChild(makeCard(e.w)));
      out.appendChild(grid);
      $('#resultsSummary').textContent=fmt(res.length)+' hasil';
    }
  };

  function initMagic(){
    const bar=$('#magicBar'); if(!bar) return;
    let t=DataLayer.getTactical().slice(0,16); if(!t.length) t=['oa','ez','ks','tt','x','z','q'].map(s=>({s}));
    bar.innerHTML='';
    t.forEach(x=>{ const b=document.createElement('button'); b.className='magic-chip'; b.textContent=x.s.toUpperCase(); b.onclick=()=>{ $('#prefixInput').value=x.s; Search.run(); }; bar.appendChild(b); });
  }

  function loadAnnouncements(){
    fetch('/api/announcements').then(r=>r.json()).then(d=>{
      const area=$('#announcementsArea'); if(!area) return;
      area.innerHTML='';
      if(!d.announcements?.length) return;
      d.announcements.forEach(a=>{
        const div=document.createElement('div');
        div.className=`announcement ${a.color||'emerald'}`;
        div.innerHTML=`<div class=\"ann-title\">${a.title}</div><div>${a.content}</div>`;
        area.appendChild(div);
      });
    }).catch(()=>{});
  }

  function initControls(){
    const p=$('#prefixInput');
    if(p){ p.oninput=()=>Search.run(); p.onkeydown=e=>e.key==='Enter'&&Search.run(); }
    $('#clearBtn')?.onclick=()=>{if(p)p.value='';Search.run();};

    $('#modeToggle')?.onclick=()=>{State.mode=State.mode==='fast'?'normal':'fast';syncUI();Search.run();};
    $('#statusToggle')?.onclick=()=>{State.status=State.status==='all'?'verified':State.status==='verified'?'unverified':'all';save();syncUI();Search.run();};
    $('#trapToggle')?.onclick=()=>{State.trap=!State.trap;syncUI();Search.run();};
    $('#hideToggle')?.onclick=()=>{State.hide=!State.hide;syncUI();Search.run();};
    $('#brutalToggle')?.onclick=()=>{State.brutal=!State.brutal;syncUI();Search.run();};
    $('#fullToggle')?.onclick=()=>{State.fullWidth=!State.fullWidth;syncUI();Search.run();};
    $('#sortToggle')?.onclick=()=>{State.sort=State.sort==='none'?'asc':'none';save();syncUI();Search.run();};
    $('#randomBtn')?.onclick=()=>{const w=DataLayer.getRandomWord();if(w&&p){p.value=w;Search.run();}};
    $('#showHiddenBtn')?.onclick=()=>{};
  }

  function syncUI(){
    const mt=$('#modeToggle'); if(mt) mt.textContent=State.mode==='fast'?'Fast':'Normal';
    const st=$('#statusToggle'); if(st) st.textContent=State.status;
  }

  const Auth = {
    KEY:'sk_user_token',
    async check(){ const t=localStorage.getItem(this.KEY);if(!t)return false; try{return (await fetch('/api/me',{headers:{Authorization:'Bearer '+t}})).ok}catch{return false} },
    showGate(){
      const g=$('#authGate'); if(g)g.classList.remove('hidden');
      $('#authBtn').onclick=async()=>{const u=$('#authUser').value.trim(),p=$('#authPass').value; try{ const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})}); const data=await res.json(); if(!res.ok)throw new Error(data.error); localStorage.setItem(this.KEY,data.token);location.reload();}catch(e){$('#authErr').textContent=e.message;}};
    },
    logout(){localStorage.removeItem(this.KEY);location.reload();}
  };

  async function init(){
    const logged=await Auth.check();
    if(!logged){Auth.showGate();return;}

    const lo=$('#logoutBtn'); if(lo){lo.classList.remove('hidden');lo.onclick=()=>Auth.logout();}

    try{await DataLayer.load('data/words.json');}catch{ return document.body.innerHTML='<div style=\"padding:40px;text-align:center\">Gagal memuat data</div>'; }

    $('#statTotal').textContent=fmt(DataLayer.getTotal());
    $('#statVerified').textContent=fmt(DataLayer.getVerifiedCount());

    loadAnnouncements();
    initMagic();
    initControls();
    syncUI();

    // Keyboard shortcut: press / to focus search (kept, it's not copy)
    document.addEventListener('keydown', e => {
      if (e.key === '/' && document.activeElement.tagName === 'BODY') {
        e.preventDefault();
        $('#prefixInput')?.focus();
      }
    });

    // === DISABLE RIGHT CLICK + ANTI-SEBAR (for paid content) ===
    function protectContent() {
      // Block right-click everywhere
      document.addEventListener('contextmenu', e => {
        e.preventDefault();
        return false;
      }, { capture: true });

      // Block text selection on sensitive areas
      document.addEventListener('selectstart', e => {
        const target = e.target;
        if (target.closest('#resultsArea') || target.closest('.wgrid') || target.closest('.panel')) {
          e.preventDefault();
        }
      });

      // Block drag (text/images)
      document.addEventListener('dragstart', e => e.preventDefault(), { capture: true });

      // Block common dev tool shortcuts (F12, Ctrl+Shift+I, Ctrl+U, etc.)
      document.addEventListener('keydown', function(e) {
        const k = e.key.toLowerCase();
        if (k === 'f12' ||
            (e.ctrlKey && e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) ||
            (e.ctrlKey && k === 'u') ||
            (e.ctrlKey && k === 's')) {
          e.preventDefault();
          return false;
        }
      }, { capture: true });
    }

    protectContent();

    Search.run();
    $('#prefixInput')?.focus();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
