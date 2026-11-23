/* =================================================================
   Security Mask — طبقة الموبايل (mobile.js)  v4.3.22
   طبقة إضافية فوق الكود الأصلي: ما بتعدّل ولا دالة موجودة،
   وكل شي جواها بيشتغل بس لما يكون عرض الشاشة ≤768px.
   على الكمبيوتر هالملف عملياً بيقعد ساكت (ما بيضيف ولا عنصر).
   ================================================================= */
(function(){
  'use strict';

  var MOBILE_MAX = 768;
  function isMobile(){ return window.matchMedia('(max-width:'+MOBILE_MAX+'px)').matches; }

  /* -----------------------------------------------------------------
     1) تصليح أزرار الشريط العلوي
     المشكلة الأصلية: أغلب الأزرار مكتوب نصها مباشرة جوا الزر
     (<button><i></i> تصدير Excel</button>) بدون <span>، فالقاعدة القديمة
     يلي كانت بتخفي الـspan وتصغّر الزر لـ33px خلّت النص يطلع برّا حدود
     الزر ويتراكب فوق باقي الأزرار وفوق المحتوى — متل ما بينّ بالصورة.
     الحل: منلفّ كل نص حرّ جوا الزر بـ<span> (مرة وحدة لكل زر)، وهيك
     بيصير عنّا تحكّم كامل فيه من CSS، ومنضيف title للوصولية.
     ----------------------------------------------------------------- */
  function wrapLooseText(btn){
    if(btn.dataset.smWrapped==='1') return;
    btn.dataset.smWrapped='1';
    var nodes = Array.prototype.slice.call(btn.childNodes);
    nodes.forEach(function(n){
      if(n.nodeType===3){ // نص حرّ
        var txt=n.nodeValue;
        if(!txt || !txt.trim()) return;
        var sp=document.createElement('span');
        sp.textContent=txt.trim();
        btn.replaceChild(sp,n);
      }
    });
    var label=(btn.textContent||'').trim();
    if(label && !btn.getAttribute('title')) btn.setAttribute('title',label);
    if(label && !btn.getAttribute('aria-label')) btn.setAttribute('aria-label',label);
  }

  /* ترتيب منطقي لشريط الإجراءات على الموبايل:
     الزر الأساسي أول شي (أهم إجراء بالصفحة ولازم يكون بمتناول الإبهام
     من غير تمرير)، وبعدين باقي الأزرار، وبالآخر "خروج/قفل/بحث سريع".
     منستعمل أصناف فقط — قواعد الـorder نفسها محصورة بـmobile.css،
     فشكل الكمبيوتر ما بيتأثر أبداً. */
  function orderTopbar(acts){
    Array.prototype.forEach.call(acts.children,function(el){
      el.classList.remove('sm-first','sm-last');
      if(el.classList && el.classList.contains('btn-primary')) el.classList.add('sm-first');
      else if(el.hasAttribute('data-lock-btn')||el.hasAttribute('data-logout-btn')||el.id==='ux-quicknav-btn') el.classList.add('sm-last');
    });
  }

  /* الأزرار يلي دايماً بتنزاح لقائمة "المزيد" على الموبايل (ثانوية أو عامة) */
  function isSecondary(el){
    return el.hasAttribute('data-lock-btn') ||
           el.hasAttribute('data-logout-btn') ||
           el.id==='ux-quicknav-btn' ||
           el.id==='ux-cards-toggle-btn';
  }

  /* -----------------------------------------------------------------
     طيّ الإجراءات الزيادة داخل قائمة "المزيد"
     صفحات متل العمال والمحفظة والمبيعات والموردين فيها 6–9 أزرار
     بالترويسة. حتى لو صاروا بشريط بينمرّر، تسعة أزرار بشريط واحد
     مرهقة عالموبايل. فمنترك ظاهر: الزر الأساسي + قائمة "المزيد"
     تبع الصفحة (إذا عندها) + أول زرّين، والباقي بينزاح لقائمة "المزيد".

     مهم: ما منحرّك ولا زر من مكانه بالـDOM — منخفّيه بصنف
     (.sm-overflowed، مخفي جوا media query الموبايل فقط) ومنعمل له
     "بديل" بالقائمة بيضغط الزر الأصلي (orig.click()). يعني:
     • كل onclick الأصلي بيشتغل متل ما هو، صفر خطر على الفيتشرات.
     • لما تفتح نفس الصفحة عالكمبيوتر أو تدوّر الموبايل لوضع عريض،
       كل الأزرار بترجع تبيّن لحالها بدون أي إعادة بناء.
     ----------------------------------------------------------------- */
  function clearPacking(acts){
    Array.prototype.forEach.call(acts.querySelectorAll('.sm-overflowed'),function(el){
      el.classList.remove('sm-overflowed');
    });
    var own=acts.querySelector('.sm-overflow-wrap');
    if(own) own.remove();
    // القائمة يلي جوا الـwrap ممكن تكون مو موجودة جوّاه لحظة الحذف —
    // لو كانت مفتوحة، toggleRowMenu كان نقلها لـdocument.body مباشرة
    // (منشان position:fixed يشتغل صح). لو حذفنا الـwrap بس وتركناها هونيك،
    // بتضل "يتيمة" للأبد وبتتراكم نسخ منها كل ما تنعاد صفحة. فمنلاقيها
    // بعلامتها المميزة (data-sm-overflow-list) وين ما كانت ومنشيلها.
    Array.prototype.forEach.call(document.querySelectorAll('.row-menu-list[data-sm-overflow-list="1"]'),function(el){
      el.remove();
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-sm-proxy]'),function(el){
      el.remove();
    });
  }

  function proxyItem(orig){
    var b=document.createElement('button');
    b.type='button';
    b.className='row-menu-item';
    b.setAttribute('data-sm-proxy','1');
    var i=orig.querySelector('i');
    var label=(orig.textContent||'').trim()||orig.getAttribute('title')||'إجراء';
    b.innerHTML='<i class="'+(i?i.className:'ti ti-point')+'"></i> '+label;
    if(orig.classList.contains('btn-danger')||orig.hasAttribute('data-logout-btn')) b.classList.add('danger');
    b.addEventListener('click',function(e){
      e.stopPropagation();
      if(typeof closeAllRowMenus==='function') closeAllRowMenus();
      orig.click();
    });
    return b;
  }

  /* بيتحقق إذا في قائمة "المزيد" *تبع هالشريط بالذات* مفتوحة حالياً.
     هاد بديل عن acts.querySelector('.row-menu-list.open') يلي كان مكتوب هون
     قبل: تلك الطريقة كانت عمياء عن أي قائمة فعلياً مفتوحة، لأنو toggleRowMenu()
     (بـcore.js) بينقل القائمة لآخر <body> أول ما تنفتح (منشان position:fixed
     يشتغل صح فوق كل شي) — فبعد النقل هي فيزيائياً برّا acts، وquerySelector
     جوا acts ما بيلاقيها إطلاقاً. النتيجة كانت: أول ما المستخدم يفتح قائمة
     "المزيد" التلقائية (يلي منولّدها إحنا هون لصفحات ما إلها قائمة "أكتر"
     خاصة فيها بالكود الأصلي، متل الأعمال والعمال)، الحارس ما كان يمنع شي،
     فـpackTopbar كان يكمل وينفّذ clearPacking() يلي بتمسح أي قائمة معلّمة
     data-sm-overflow-list="1" أينما كانت — يعني نفس القائمة المفتوحة قدام
     عين المستخدم كانت تنمسح فوراً، وكأنها انفتحت وانسكرت لحالها بلمح البصر
     (الزر يبين وكأنو "مو شغال"). صفحات متل المحفظة والمبيعات إلها قائمة
     "أكتر" مبنية جاهزة بالكود الأصلي (بدون data-sm-overflow-list ولا صنف
     sm-overflow-wrap) فما كانت تتأثر بهالمسح أبداً — من هون جا اختلاف
     السلوك بين صفحة وصفحة.
     الحل: نستخدم _rmHome يلي toggleRowMenu نفسها بتسجّله (مطرح القائمة
     الأصلي قبل ما تنتقل لـbody) لنعرف هل القائمة المفتوحة أصلها من جوا
     هالشريط بالذات، بغض النظر وين هي فيزيائياً بالـDOM هلق. */
  function ourMenuIsOpen(acts){
    var lists=document.querySelectorAll('.row-menu-list.open');
    for(var i=0;i<lists.length;i++){
      var l=lists[i];
      if(acts.contains(l)) return true;
      var home=l._rmHome&&l._rmHome.parent;
      if(home&&acts.contains(home)) return true;
    }
    return false;
  }

  function packTopbar(acts){
    if(ourMenuIsOpen(acts)) return;

    clearPacking(acts);
    if(!isMobile()) return;

    var kids=Array.prototype.filter.call(acts.children,function(el){
      return !el.classList.contains('sm-overflow-wrap');
    });
    if(kids.length<=4) return;   // قليلة أصلاً، خليها كلها ظاهرة

    var pageMenu=acts.querySelector('.row-menu-wrap');   // قائمة "المزيد" تبع الصفحة نفسها
    var keep=[], overflow=[], slots=2;

    kids.forEach(function(el){
      if(el===pageMenu){ keep.push(el); return; }
      if(el.classList.contains('btn-primary')){ keep.push(el); return; }
      if(isSecondary(el)){ overflow.push(el); return; }
      if(slots>0){ slots--; keep.push(el); return; }
      overflow.push(el);
    });

    if(!overflow.length) return;

    var list;
    if(pageMenu){
      list=pageMenu.querySelector('.row-menu-list');
    }else{
      var wrap=document.createElement('div');
      wrap.className='row-menu-wrap sm-overflow-wrap';
      wrap.innerHTML='<button type="button" class="btn" onclick="toggleRowMenu(this,event)" title="إجراءات إضافية"><i class="ti ti-dots"></i><span>المزيد</span></button><div class="row-menu-list" data-sm-overflow-list="1"></div>';
      acts.appendChild(wrap);
      list=wrap.querySelector('.row-menu-list');
    }
    if(!list) return;

    overflow.forEach(function(el){
      el.classList.add('sm-overflowed');
      list.appendChild(proxyItem(el));
    });
  }

  var actsObserver=null;   // مرجع لمراقب شريط الإجراءات، لازم نوقفه وقت ما نكتب فيه إحنا

  function normalizeTopbar(resetScroll){
    var acts=document.getElementById('topbar-actions');
    if(!acts) return;
    // منوقف المراقبة قبل ما نعدّل acts بأيدينا، ونشيل أي "سجل تغييرات"
    // اتسجّل أثناء هالفترة (takeRecords) قبل ما نرجّع نوصلها — هيك
    // تعديلاتنا إحنا (لفّ النص بـspan، بناء قائمة "المزيد"...) ما بترجع
    // تشغّل نفس المراقب وتعمل حلقة، بدون أي حاجة لتخمين "هل تغيّر شي
    // فعلياً" (الطريقة القديمة كانت تقارن بصمة نصية، وهاد عرضة لأخطاء
    // توقيت دقيقة بين صفحة وصفحة — هاي الطريقة أضمن 100% لأنها الأسلوب
    // القياسي المعتمد لمراقب بيعدّل نفس العنصر يلي عم يراقبه).
    if(actsObserver) actsObserver.disconnect();
    try{
      Array.prototype.forEach.call(acts.querySelectorAll('button'),wrapLooseText);
      orderTopbar(acts);
      packTopbar(acts);
      // بعد كل رسم *فعلي لصفحة جديدة*، رجّع الشريط لبدايته حتى يبيّن الزر
      // الأساسي. مهم: resetScroll لازم يجي true بس لما يكون التغيير فعلاً
      // صفحة جديدة (main-content اتغيّر) — مش لأي تعديل داخلي بشريط
      // الإجراءات نفسه (متل فتح/سكر قائمة "المزيد"). قبل هالتفريق، كل
      // فتح لقائمة "المزيد" (يلي بينقل عنصرها لـbody، وهاد تعديل جوا acts)
      // كان يعتبر "تغيير" ويرجّع الشريط لبدايته فوراً — فلو كان المستخدم
      // زاح الشريط لليمين حتى يشوف زر "المزيد" أصلاً، الشريط كان يرجع
      // يسكّر عليه لحظة ما يضغط، وكأنو الزر ما عم يستجيب.
      if(resetScroll && isMobile()) acts.scrollLeft = 0;
    } finally {
      if(actsObserver){
        actsObserver.takeRecords();   // تجاهل أي تسجيل تراكم أثناء الفصل
        actsObserver.observe(acts,{childList:true,subtree:true});
      }
    }
  }

  /* -----------------------------------------------------------------
     2) شريط التنقّل السفلي (Bottom Nav)
     منبنيه من عناصر القائمة الجانبية نفسها، مش من لائحة ثابتة —
     هيك الصلاحيات (canAccessPage / المحفظة للأدمن فقط) بتنطبق تلقائياً،
     وأي قسم بينخفي بالسايدبار بينخفي من الشريط السفلي كمان.
     ----------------------------------------------------------------- */
  var PREFERRED=['wallet','dashboard','maintenance','sales','clients','workers','reports','projects','quotes'];

  function sidebarItem(page){
    return document.querySelector('.sidebar .nav-item[onclick="navigate(\''+page+'\')"]');
  }
  function itemVisible(el){
    return !!el && el.style.display!=='none';
  }

  function buildBottomNav(){
    if(!isMobile()){ removeBottomNav(); return; }
    var picks=[];
    PREFERRED.forEach(function(p){
      if(picks.length>=4) return;
      var el=sidebarItem(p);
      if(itemVisible(el)){
        var i=el.querySelector('i');
        var s=el.querySelector('span');
        picks.push({page:p, icon:(i?i.className:'ti ti-point'), label:(s?s.textContent.trim():p)});
      }
    });
    if(!picks.length){ removeBottomNav(); return; }

    var sig=picks.map(function(p){return p.page;}).join(',');
    var nav=document.getElementById('sm-bottomnav');
    if(nav && nav.dataset.sig===sig){ syncBottomNav(); return; }

    if(!nav){
      nav=document.createElement('nav');
      nav.id='sm-bottomnav';
      nav.className='sm-bottomnav';
      nav.setAttribute('role','navigation');
      document.body.appendChild(nav);
    }
    nav.dataset.sig=sig;
    var html='';
    picks.forEach(function(p){
      html+='<button type="button" data-page="'+p.page+'"><i class="'+p.icon+'"></i><span>'+p.label+'</span></button>';
    });
    html+='<button type="button" data-more="1"><i class="ti ti-dots"></i><span>المزيد</span></button>';
    nav.innerHTML=html;

    Array.prototype.forEach.call(nav.querySelectorAll('button'),function(b){
      b.addEventListener('click',function(){
        if(b.dataset.more){
          if(typeof toggleSidebar==='function') toggleSidebar();
          return;
        }
        var el=sidebarItem(b.dataset.page);
        if(el) el.click();           // منستعمل نفس مسار التنقّل الأصلي حرفياً
        else if(typeof navigate==='function') navigate(b.dataset.page);
      });
    });
    document.body.classList.add('has-bottomnav');
    syncBottomNav();
  }

  function removeBottomNav(){
    var nav=document.getElementById('sm-bottomnav');
    if(nav) nav.remove();
    document.body.classList.remove('has-bottomnav');
  }

  function syncBottomNav(){
    var nav=document.getElementById('sm-bottomnav');
    if(!nav) return;
    Array.prototype.forEach.call(nav.querySelectorAll('button[data-page]'),function(b){
      var el=sidebarItem(b.dataset.page);
      b.classList.toggle('active', !!el && el.classList.contains('active'));
    });
  }

  /* إخفاء الشريط السفلي وقت ما يكون في شي فوقه:
     شاشة القفل، شاشة المزامنة، نافذة منبثقة، أو القائمة الجانبية مفتوحة. */
  function updateOverlayState(){
    var gate=document.getElementById('sync-gate');
    var printArea=document.getElementById('print-area');
    var hide =
      !!document.getElementById('auth-gate-overlay') ||
      (printArea && printArea.offsetParent!==null) ||
      !!document.querySelector('.modal-backdrop') ||
      !!document.querySelector('.lock-screen') ||
      (gate && gate.offsetParent!==null) ||
      !!document.querySelector('.sidebar.open') ||
      !!document.getElementById('ux-palette-backdrop');
    document.body.classList.toggle('sm-hide-bottomnav', !!hide);
  }

  /* -----------------------------------------------------------------
     3) سحب من حافة الشاشة لفتح/سكّر القائمة الجانبية
     (RTL: القائمة بتطلع من اليمين، فالسحب من الحافة اليمنى بيفتحها)
     محروسة منيح: ما بتشتغل إلا إذا السحب أفقي واضح، ومش فوق شي بينمرّر
     أفقياً (متل شريط الإجراءات أو جدول)، ومش وقت نافذة منبثقة مفتوحة.
     ----------------------------------------------------------------- */
  function bindEdgeSwipe(){
    var sx=0, sy=0, tracking=false, mode='';
    document.addEventListener('touchstart',function(e){
      if(!isMobile()||e.touches.length!==1) return;
      if(document.querySelector('.modal-backdrop')||document.querySelector('.lock-screen')) return;
      var t=e.touches[0];
      sx=t.clientX; sy=t.clientY; mode=''; tracking=false;
      var open=!!document.querySelector('.sidebar.open');
      if(open){ tracking=true; mode='close'; return; }
      // منطقة الحافة اليمنى فقط (24px) حتى ما نزعج التمرير العادي
      if(sx > window.innerWidth-24){ tracking=true; mode='open'; }
    },{passive:true});

    document.addEventListener('touchmove',function(e){
      if(!tracking||e.touches.length!==1) return;
      var t=e.touches[0];
      var dx=t.clientX-sx, dy=t.clientY-sy;
      if(Math.abs(dy)>Math.abs(dx)) { tracking=false; return; }   // سحب عمودي = تمرير عادي
      if(mode==='open' && dx<-55){ tracking=false; if(typeof toggleSidebar==='function') toggleSidebar(); }
      if(mode==='close' && dx>55){ tracking=false; if(typeof closeSidebar==='function') closeSidebar(); }
    },{passive:true});

    document.addEventListener('touchend',function(){ tracking=false; },{passive:true});
  }

  /* شبكة أمان عامة: أحياناً جدول بينعاد رسمه بالكامل (فلتر/صفحة تالية)
     بينما قائمة إجراءات صف فيه مفتوحة. القائمة المفتوحة كانت انتقلت لـ
     document.body (لتشتغل position:fixed)، فمسح الجدول القديم ما بيوصلها،
     وبتضل "يتيمة" بصنف open عالق للأبد (لحد أول ضغطة بأي مكان بالصفحة).
     هون منكتشفها: أي .row-menu-list.open يلي أصلها (_rmHome.parent) عاد
     منفصل عن الصفحة (DOM) معناها الصف الأصلي انمسح ومافي داعي نرجّعها له،
     فمنسكّرها فوراً بدل ما تضل عالقة وتعطّل أي منطق تاني بيتحقق من
     ".row-menu-list.open" (متل تجميع "المزيد" فوق). */
  function sweepOrphanRowMenus(){
    Array.prototype.forEach.call(document.querySelectorAll('.row-menu-list.open'),function(l){
      var home=l._rmHome;
      if(home&&home.parent&&!home.parent.isConnected){
        l.classList.remove('open');
        l.style.position='';l.style.top='';l.style.left='';l.style.right='';
        l.remove();
      }
    });
  }

  /* -----------------------------------------------------------------
     4) الربط والمراقبة
     ----------------------------------------------------------------- */
  var queued=false;
  var pendingScrollReset=false;
  /* resetScroll=true بس لما يكون المصدر رسم صفحة فعلي (main-content اتغيّر،
     أو تدوير/تحجيم الشاشة). لما يكون المصدر تعديل داخلي بشريط الإجراءات
     نفسه بس (فتح/سكر قائمة "المزيد")، منمرر false حتى ما نرجّع الشريط
     لبدايته ونخفي الزر يلي المستخدم لسا عم يحاول يضغطه. */
  function refreshSoon(resetScroll){
    if(resetScroll) pendingScrollReset=true;
    if(queued) return;
    queued=true;
    requestAnimationFrame(function(){
      queued=false;
      var doReset=pendingScrollReset;
      pendingScrollReset=false;
      sweepOrphanRowMenus();
      normalizeTopbar(doReset);
      buildBottomNav();
      updateOverlayState();
    });
  }

  function init(){
    refreshSoon(true);
    bindEdgeSwipe();

    var acts=document.getElementById('topbar-actions');
    if(acts){ actsObserver=new MutationObserver(function(){refreshSoon(false);}); actsObserver.observe(acts,{childList:true,subtree:true}); }

    var mc=document.getElementById('main-content');
    if(mc) new MutationObserver(function(){refreshSoon(true);}).observe(mc,{childList:true});

    var modal=document.getElementById('modal-container');
    if(modal) new MutationObserver(updateOverlayState).observe(modal,{childList:true,subtree:true});

    var lock=document.getElementById('lock-container');
    if(lock) new MutationObserver(function(){updateOverlayState();refreshSoon(false);}).observe(lock,{childList:true,subtree:true});

    var sb=document.getElementById('sidebar');
    if(sb){
      new MutationObserver(updateOverlayState).observe(sb,{attributes:true,attributeFilter:['class']});
      // تغيّر حالة الأقسام المسموحة (display) أو القسم النشط → نحدّث الشريط السفلي
      // (هاد بيصير أصلاً مرافق لرسم صفحة جديدة، يلي main-content observer
      // غطّاها، فما في داعي نرجّع الشريط لبدايته هون كمان)
      new MutationObserver(function(){refreshSoon(false);}).observe(sb,{attributes:true,subtree:true,attributeFilter:['class','style']});
    }

    var gate=document.getElementById('sync-gate');
    if(gate) new MutationObserver(updateOverlayState).observe(gate,{attributes:true,attributeFilter:['style','class']});

    // لوحة البحث السريع بتتضاف على body مباشرة
    new MutationObserver(updateOverlayState).observe(document.body,{childList:true});

    window.addEventListener('resize',function(){refreshSoon(true);});
    window.addEventListener('orientationchange',function(){refreshSoon(true);});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();

  // شبكة أمان: إذا صار رسم متأخّر (تحميل bundle مثلاً) منتأكد إنو كل شي متزامن.
  // بدون تصفير سكرول هون (false) حتى ما نقاطع مستخدم عم يتصفّح الشريط
  // بهالثانية بالضبط.
  setTimeout(function(){refreshSoon(false);},1200);
  setTimeout(function(){refreshSoon(false);},3500);
})();
