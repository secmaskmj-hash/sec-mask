/* ===== طبقة تحسينات السلاسة — لا تعدّل أي دالة أصلية، فقط تضيف تفاعلات فوقها ===== */
(function(){

  /* ---------- 1) لوحة أوامر / بحث سريع (Ctrl+K) ---------- */
  var SETTINGS_TABS=[
    {tab:'workTypes',label:'أنواع الأعمال'},
    {tab:'deviceTypes',label:'أنواع الأجهزة'},
    {tab:'modelNumbers',label:'Part Numbers'},
    {tab:'expenseTypes',label:'أنواع المصاريف'},
    {tab:'generalExpenseTypes',label:'أنواع المصاريف العامة'},
    {tab:'toolTypes',label:'أنواع العدة'},
    {tab:'carExpenseTypes',label:'أنواع مصاريف السيارات'},
    {tab:'workers',label:'إعدادات العمال'},
    {tab:'suppliers',label:'إعدادات الموردين'},
    {tab:'cars',label:'إعدادات السيارات'},
    {tab:'users',label:'المستخدمون والصلاحيات'}
  ];

  function uxPages(){
    return (window.PAGE_LIST||[]).filter(function(p){
      return typeof canAccessPage!=='function'||canAccessPage(p.id);
    });
  }

  function buildPalette(){
    if(document.getElementById('ux-palette-backdrop'))return;
    var bd=document.createElement('div');
    bd.id='ux-palette-backdrop';
    bd.className='ux-palette-backdrop';
    bd.innerHTML='<div class="ux-palette">'+
      '<div class="ux-palette-input-wrap"><i class="ti ti-search"></i>'+
      '<input class="ux-palette-input" id="ux-palette-input" placeholder="ابحث عن قسم أو صفحة… (اسم القسم يكفي)">'+
      '<span class="ux-palette-esc">Esc</span></div>'+
      '<div class="ux-palette-list" id="ux-palette-list"></div>'+
      '</div>';
    bd.addEventListener('click',function(e){if(e.target===bd)closePalette();});
    document.body.appendChild(bd);
    renderPaletteList('');
    var inp=document.getElementById('ux-palette-input');
    inp.addEventListener('input',function(){renderPaletteList(this.value.trim().toLowerCase());});
    inp.addEventListener('keydown',paletteKeyNav);
    setTimeout(function(){inp.focus();},10);
  }

  function paletteItems(q){
    var items=[];
    uxPages().forEach(function(p){
      if(!q||p.label.toLowerCase().includes(q)||p.id.toLowerCase().includes(q)){
        items.push({group:'الأقسام',icon:'ti-corner-down-left-double',label:p.label,action:function(){navigate(p.id);}});
      }
    });
    if((typeof canAccessPage!=='function'||canAccessPage('settings'))){
      SETTINGS_TABS.forEach(function(s){
        if(!q||s.label.toLowerCase().includes(q)){
          items.push({group:'إعدادات القوائم',icon:'ti-settings',label:s.label,action:function(){
            navigate('settings');window._stab=s.tab;
            setTimeout(function(){if(typeof renderSettings==='function')renderSettings(document.getElementById('main-content'),document.getElementById('topbar-actions'));},30);
          }});
        }
      });
    }
    var quick=[
      {key:'lock',label:'قفل التطبيق الآن',icon:'ti-lock',action:function(){if(typeof lockApp==='function')lockApp();}},
      {key:'export',label:'تصدير نسخة JSON',icon:'ti-download',action:function(){if(typeof exportData==='function')exportData();}}
    ];
    quick.forEach(function(k){
      if(!q||k.label.toLowerCase().includes(q))items.push({group:'إجراءات سريعة',icon:k.icon,label:k.label,action:k.action});
    });
    return items;
  }

  function renderPaletteList(q){
    var list=document.getElementById('ux-palette-list');
    if(!list)return;
    var items=paletteItems(q);
    if(!items.length){list.innerHTML='<div class="ux-palette-empty">ما في نتائج مطابقة</div>';return;}
    var groups={};var order=[];
    items.forEach(function(it){if(!groups[it.group]){groups[it.group]=[];order.push(it.group);}groups[it.group].push(it);});
    var html='';var idx=0;
    order.forEach(function(g){
      html+='<div class="ux-palette-group">'+g+'</div>';
      groups[g].forEach(function(it){
        html+='<div class="ux-palette-item'+(idx===0?' ux-sel':'')+'" data-idx="'+idx+'"><i class="ti '+it.icon+'"></i><span>'+it.label+'</span></div>';
        idx++;
      });
    });
    list.innerHTML=html;
    window._uxPaletteItems=items;
    Array.prototype.forEach.call(list.querySelectorAll('.ux-palette-item'),function(el){
      el.addEventListener('click',function(){
        var it=window._uxPaletteItems[parseInt(el.getAttribute('data-idx'),10)];
        closePalette();
        if(it)it.action();
      });
    });
  }

  function paletteKeyNav(e){
    var list=document.getElementById('ux-palette-list');
    if(!list)return;
    var els=Array.prototype.slice.call(list.querySelectorAll('.ux-palette-item'));
    if(!els.length)return;
    var cur=els.findIndex(function(el){return el.classList.contains('ux-sel');});
    if(e.key==='ArrowDown'){e.preventDefault();cur=(cur+1)%els.length;}
    else if(e.key==='ArrowUp'){e.preventDefault();cur=(cur-1+els.length)%els.length;}
    else if(e.key==='Enter'){e.preventDefault();els[cur<0?0:cur].click();return;}
    else return;
    els.forEach(function(el){el.classList.remove('ux-sel');});
    els[cur].classList.add('ux-sel');
    els[cur].scrollIntoView({block:'nearest'});
  }

  function closePalette(){
    var bd=document.getElementById('ux-palette-backdrop');
    if(bd)bd.remove();
  }

  document.addEventListener('keydown',function(e){
    var lockScreen=document.querySelector('.lock-screen');
    if(lockScreen)return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){
      e.preventDefault();
      if(document.getElementById('ux-palette-backdrop'))closePalette();else buildPalette();
      return;
    }
    if(e.key==='Escape'){
      var pal=document.getElementById('ux-palette-backdrop');
      if(pal){closePalette();return;}
    }
  });

  function insertQuickNavButton(){
    var acts=document.getElementById('topbar-actions');
    if(!acts||document.getElementById('ux-quicknav-btn'))return;
    var btn=document.createElement('button');
    btn.id='ux-quicknav-btn';
    btn.className='ux-quicknav-btn';
    btn.type='button';
    btn.innerHTML='<i class="ti ti-search"></i><span>بحث سريع</span><kbd>Ctrl K</kbd>';
    btn.addEventListener('click',buildPalette);
    acts.insertBefore(btn,acts.firstChild);
  }

  /* ---------- 2) طي القائمة الجانبية ---------- */
  function applyCollapsedState(){
    var sb=document.getElementById('sidebar');
    if(!sb)return;
    var collapsed=localStorage.getItem('ux_sidebar_collapsed')==='1';
    sb.classList.toggle('ux-collapsed',collapsed);
    var t=document.getElementById('ux-collapse-toggle');
    if(t)t.querySelector('span').textContent=collapsed?'توسيع القائمة':'طي القائمة';
  }

  function insertCollapseToggle(){
    var nav=document.querySelector('.nav');
    if(!nav||document.getElementById('ux-collapse-toggle'))return;
    var t=document.createElement('div');
    t.id='ux-collapse-toggle';
    t.className='ux-collapse-toggle';
    t.innerHTML='<i class="ti ti-chevrons-right"></i><span>طي القائمة</span>';
    t.addEventListener('click',function(){
      var cur=localStorage.getItem('ux_sidebar_collapsed')==='1';
      localStorage.setItem('ux_sidebar_collapsed',cur?'0':'1');
      applyCollapsedState();
    });
    nav.parentNode.insertBefore(t,nav.nextSibling);
    applyCollapsedState();
  }

  function labelCollapsedItems(){
    Array.prototype.forEach.call(document.querySelectorAll('.nav-item'),function(el){
      if(!el.hasAttribute('data-ux-label')){
        var span=el.querySelector('span');
        if(span)el.setAttribute('data-ux-label',span.textContent.trim());
      }
    });
  }

  /* ---------- 3) تحسين النوافذ المنبثقة: زر إغلاق واضح + Esc ---------- */
  function enhanceModal(){
    var modal=document.querySelector('.modal-backdrop .modal');
    if(!modal||modal.querySelector('.ux-modal-close'))return;
    var x=document.createElement('div');
    x.className='ux-modal-close';
    x.innerHTML='<i class="ti ti-x"></i>';
    x.title='إغلاق';
    x.addEventListener('click',function(){if(typeof closeModal==='function')closeModal();});
    modal.appendChild(x);
  }

  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){
      var mb=document.querySelector('.modal-backdrop');
      if(mb&&typeof closeModal==='function')closeModal();
    }
  });

  /* ---------- 4) ظل خفيف على الشريط العلوي عند التمرير ---------- */
  function bindScrollShadow(){
    var content=document.getElementById('main-content');
    var topbar=document.querySelector('.topbar');
    if(!content||!topbar||content.dataset.uxBound)return;
    content.dataset.uxBound='1';
    content.addEventListener('scroll',function(){
      topbar.classList.toggle('ux-shadow',content.scrollTop>4);
    });
  }

  /* ---------- 6) عرض مختصر/كامل لبطاقات الجداول: الضيق بيبيّن بس أهم 3 حقول، الموسّع بيبيّن كل التفاصيل ---------- */
  /* أولاً: أي جدول ما محدد فيه data-label يدوياً بالكود، منولّدها تلقائياً من نص رأس العمود (th) —
     هيك ولا جدول بالتطبيق (حتى لو ما انتبهنا لتعديله بالكود) بيضل بدون عناوين بوضع البطاقات. */
  function autoLabelTable(table){
    // كل جدول منعالجه مرة وحدة بس. قبل هيك كانت هالدالة تمشي على كل خلية
    // بكل جدول بعد *كل* عملية رسم (وكل مرة بتفتح نافذة كمان) — يعني آلاف
    // التعديلات على الـDOM بلا داعي، وهاد كان من أكبر أسباب التقطيع بالجداول الكبيرة.
    if(table.dataset.uxLabeled==='1')return;
    table.dataset.uxLabeled='1';
    var headRow=table.querySelector(':scope>thead>tr');
    if(!headRow)return;
    var headers=Array.prototype.map.call(headRow.children,function(th){return th.textContent.trim();});
    var rows=table.querySelectorAll(':scope>tbody>tr');
    Array.prototype.forEach.call(rows,function(tr){
      var tds=Array.prototype.filter.call(tr.children,function(td){return td.tagName==='TD';});
      tds.forEach(function(td,i){
        if(!td.hasAttribute('data-label'))td.setAttribute('data-label',headers[i]||'');
      });
    });
  }
  var KEY_FIELDS_BY_TABLE={
    'maint-table':['العميل / الفرع','وصف العمل','الأجر الكلي']
  };
  function markKeyFields(table){
    var cfgClass=Object.keys(KEY_FIELDS_BY_TABLE).filter(function(c){return table.classList.contains(c);})[0];
    var keepLabels=cfgClass?KEY_FIELDS_BY_TABLE[cfgClass]:null;
    var rows=table.querySelectorAll(':scope>tbody>tr');
    Array.prototype.forEach.call(rows,function(tr){
      var tds=Array.prototype.filter.call(tr.children,function(td){return td.tagName==='TD';});
      var labeled=tds.filter(function(td){return td.hasAttribute('data-label')&&td.getAttribute('data-label')!=='';});
      var keep=keepLabels?labeled.filter(function(td){return keepLabels.indexOf(td.getAttribute('data-label'))!==-1;}):labeled.slice(0,3);
      if(keepLabels&&keep.length===0)keep=labeled.slice(0,3);
      labeled.forEach(function(td){td.classList.remove('ux-key');});
      keep.forEach(function(td){td.classList.add('ux-key');});
    });
  }
  function markAllTables(){
    Array.prototype.forEach.call(document.querySelectorAll('table:not(.print-table)'),function(table){
      autoLabelTable(table);
      if(table.dataset.uxKeyed!=='1'){
        table.dataset.uxKeyed='1';
        markKeyFields(table);
      }
    });
  }
  function applyCardsExpandState(){
    var expanded=localStorage.getItem('ux_cards_expanded')==='1';
    document.body.classList.toggle('ux-cards-expanded',expanded);
    var btn=document.getElementById('ux-cards-toggle-btn');
    if(btn)btn.innerHTML=expanded?'<i class="ti ti-arrows-minimize"></i><span>عرض مختصر</span>':'<i class="ti ti-arrows-maximize"></i><span>عرض كامل</span>';
  }
  function insertCardsToggleBtn(){
    var acts=document.getElementById('topbar-actions');
    if(!acts||document.getElementById('ux-cards-toggle-btn'))return;
    var btn=document.createElement('button');
    btn.id='ux-cards-toggle-btn';
    btn.type='button';
    btn.className='btn btn-sm ux-cards-toggle-btn';
    btn.title='بدّل بين عرض مختصر لبطاقات الجداول (3 حقول أساسية) وعرض كامل (كل التفاصيل)';
    btn.addEventListener('click',function(){
      var expanded=localStorage.getItem('ux_cards_expanded')==='1';
      localStorage.setItem('ux_cards_expanded',expanded?'0':'1');
      applyCardsExpandState();
    });
    acts.appendChild(btn);
    applyCardsExpandState();
  }
  applyCardsExpandState();

  function bindCardRowToggle(){
    if(document.body.dataset.uxRowToggleBound)return;
    document.body.dataset.uxRowToggleBound='1';
    document.addEventListener('click',function(e){
      var tr=e.target.closest('table:not(.print-table) tbody tr');
      if(!tr)return;
      if(e.target.closest('button,a,input,select,textarea,label,.row-menu-wrap,.row-menu-list,[onclick]'))return;
      tr.classList.toggle('ux-row-expanded');
    });
  }

  /* ---------- مراقبة التغييرات لإعادة ربط كل شي بعد كل render() ---------- */
  // كل استدعاءات boot() المتتالية (بتصير كتير لأنو MutationObserver بيطلق
  // مع كل تعديل بالصفحة) بتنلم بإطار رسم واحد بدل ما تنفّذ وحدة وحدة.
  var _bootQueued=false;
  function bootSoon(){
    if(_bootQueued)return;
    _bootQueued=true;
    requestAnimationFrame(function(){_bootQueued=false;boot();});
  }
  function boot(){
    insertQuickNavButton();
    insertCollapseToggle();
    labelCollapsedItems();
    bindScrollShadow();
    enhanceModal();
    markAllTables();
    insertCardsToggleBtn();
    bindCardRowToggle();
  }

  document.addEventListener('DOMContentLoaded',function(){
    boot();
    var mc=document.getElementById('main-content');
    if(mc)new MutationObserver(bootSoon).observe(mc,{childList:true,subtree:false});
    var mcont=document.getElementById('modal-container');
    if(mcont)new MutationObserver(enhanceModal).observe(mcont,{childList:true,subtree:true});
    var tb=document.getElementById('topbar-actions');
    if(tb)new MutationObserver(insertQuickNavButton).observe(tb,{childList:true});
  });

  /* في حال كانت الصفحة محمّلة أصلاً (بعد render() الأول) */
  boot();

  /* ---------- الوضع الليلي/النهاري ---------- */
  function updateThemeToggleUI(){
    var isDark=document.documentElement.getAttribute('data-theme')==='dark';
    var icon=document.getElementById('theme-toggle-icon');
    var label=document.getElementById('theme-toggle-label');
    if(icon)icon.className='ti '+(isDark?'ti-sun':'ti-moon');
    if(label)label.textContent=isDark?'نهاري':'ليلي';
    var meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',isDark?'#141A22':'#EEF2F6');
  }
  window.toggleAppTheme=function(){
    var html=document.documentElement;
    var next=html.getAttribute('data-theme')==='dark'?'':'dark';
    if(next)html.setAttribute('data-theme','dark');else html.removeAttribute('data-theme');
    try{localStorage.setItem('sm_theme',next||'light');}catch(e){}
    updateThemeToggleUI();
    // ألوان الواجهة كلها متغيّرات CSS، فبتتبدّل لحالها من دون إعادة رسم.
    // الشي الوحيد اللي بيلزمه إعادة رسم هو رسوم chart.js (ألوانها محسوبة
    // وقت الإنشاء)، فمنعيد الرسم بس لما يكون في رسم بياني معروض فعلاً.
    var hasCharts=!!document.querySelector('canvas');
    if(hasCharts&&typeof render==='function')render();
  };
  updateThemeToggleUI();
})();


/* ===== T17: إمكانية الوصول — تنقل بلوحة المفاتيح وقارئ الشاشة =====
   العناصر القابلة للضغط اللي مكتوبة <div onclick> ما كانت بتنفتح بـ Tab/Enter.
   هون منعطيها role=button + tabindex + تفعيل بـ Enter/Space بدون ما نغيّر أي دالة أصلية. */
(function(){
  var SEL='.nav-item[onclick],.sidebar-backdrop,[onclick]:not(button):not(a):not(input):not(select):not(textarea):not(label):not(summary):not(tr):not(td):not(th):not(body):not(html)';
  function enhance(root){
    var list;
    try{list=(root.querySelectorAll?root.querySelectorAll(SEL):[]);}catch(e){return;}
    for(var i=0;i<list.length;i++){
      var el=list[i];
      if(el.id==='sidebar-backdrop'||el.classList.contains('modal-backdrop'))continue;
      if(!el.hasAttribute('role'))el.setAttribute('role','button');
      if(!el.hasAttribute('tabindex'))el.setAttribute('tabindex','0');
    }
    var mods=(root.querySelectorAll?root.querySelectorAll('#modal-container .modal'):[]);
    for(var j=0;j<mods.length;j++){
      var md=mods[j];
      if(!md.hasAttribute('role')){md.setAttribute('role','dialog');md.setAttribute('aria-modal','true');}
      var tt=md.querySelector('.modal-title');
      if(tt&&!md.hasAttribute('aria-label'))md.setAttribute('aria-label',tt.textContent.trim());
    }
  }
  function labelIconButtons(root){
    var btns=root.querySelectorAll?root.querySelectorAll('button:not([aria-label])'):[];
    for(var i=0;i<btns.length;i++){
      var b=btns[i];
      if(b.textContent.trim())continue;
      var t=b.getAttribute('title');
      if(t)b.setAttribute('aria-label',t);
    }
  }
  function run(root){enhance(root);labelIconButtons(root);}
  function landmarks(){
    var nav=document.querySelector('.nav');if(nav&&!nav.hasAttribute('aria-label')){nav.setAttribute('aria-label','القائمة الرئيسية');}
    var main=document.getElementById('main-content');if(main&&!main.hasAttribute('role')){main.setAttribute('role','main');}
    var mb=document.getElementById('mobile-menu-btn');if(mb&&!mb.hasAttribute('aria-label'))mb.setAttribute('aria-label','فتح القائمة');
    var tg=document.getElementById('theme-toggle-btn');if(tg&&!tg.hasAttribute('aria-label'))tg.setAttribute('aria-label','تبديل الوضع الليلي أو النهاري');
    var sb=document.getElementById('sync-banner');if(sb){sb.setAttribute('role','status');sb.setAttribute('aria-live','polite');}
  }
  document.addEventListener('keydown',function(e){
    if(e.key!=='Enter'&&e.key!==' ')return;
    var el=e.target;
    if(!el||el.getAttribute('role')!=='button')return;
    var tag=el.tagName;
    if(tag==='BUTTON'||tag==='A'||tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
    e.preventDefault();
    el.click();
  });
  var pending=false;
  function schedule(){
    if(pending)return;pending=true;
    (window.requestAnimationFrame||setTimeout)(function(){pending=false;run(document);landmarks();});
  }
  function start(){
    run(document);landmarks();
    try{new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});}catch(e){}
    // مؤشر تركيز واضح لمستخدمي الكيبورد فقط
    var st=document.createElement('style');
    st.textContent='[role="button"]:focus-visible,.nav-item:focus-visible,button:focus-visible,a:focus-visible{outline:2px solid var(--accent,#B8862E);outline-offset:2px}';
    document.head.appendChild(st);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
