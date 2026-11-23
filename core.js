/* ====================================================================
   core.js — يحمّل دائماً مع كل صفحة
   يحوي: المصادقة، المزامنة السحابية، قاعدة البيانات المحلية،
   الراوتر (navigate/render)، لوحة القفل، Dashboard،
   + كل الدوال المشتركة بين الصفحات (حسابات مالية، نظام الطباعة،
   modal/bulk helpers) بعد نقلها من أماكنها الأصلية المتفرقة.
   ==================================================================== */
/* ====================================================================
   Lazy bundle loader — يحمّل ملفات الصفحات عند الحاجة فقط، ومرة وحدة.
   ==================================================================== */
// APP_VERSION: غيّرها (زيدها) مع كل نشر/تحديث جديد للكود.
// هيك أي ملف JS (static أو lazy-loaded) بينحمّل بلينك فيه ?v=رقم النسخة،
// فالمتصفح (والـ Service Worker) بيعتبروه ملف مختلف عن القديم المخزّن بالكاش،
// وبالتالي التحديثات بتوصل فوراً لكل المستخدمين بدل ما تضل عالقة بالكاش القديم.
const APP_VERSION='4.9.2';
// مجموع الرصيد/الفائض الحي (credit) لعامل معيّن: أي مبلغ من دفعة أو سلفة "مسددة فعلياً"
// ولسا ما انغطى فيه أجرة ورشة كاملة بعد. هاد المبلغ فعلياً مدفوع للعامل، فلازم ينخصم
// فوراً من "المستحق غير المحسوب" (بالداشبورد وصفحة العمال معاً) — مو نستنى لحد ما
// تنسجل أجرة ورشة جديدة تساويه بالضبط. معرّفة هون بـ core.js (يتحمّل دايماً أول شي)
// حتى تكون متوفرة للداشبورد حتى لو المستخدم لسا ما فتح صفحة العمال (people.js).
function getWorkerCreditUSD(workerId){
  return (db.workerPayments||[]).filter(p=>p.workerId===workerId&&!p.isBonus&&p.paid&&p.remainingSurplus>0.005).reduce((s,p)=>s+p.remainingSurplus,0);
}
/* ====================================================================
   loadLib — تحميل المكتبات الخارجية التقيلة عند أول استعمال فقط.
   قبل: xlsx + html2pdf + chart.js (~1.6 ميغا) كانت تتحمّل بكل فتحة
   للتطبيق وتوقّف رسم الصفحة، حتى لو المستخدم ما صدّر ولا ملف.
   هلق: بتتحمّل أول ما يضغط "تصدير Excel" أو "PDF" أو يفتح الداشبورد.
   ==================================================================== */
const _LIB_URLS={
  xlsx:'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  html2pdf:'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js',
  chart:'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js'
};
const _LIB_GLOBALS={xlsx:'XLSX',html2pdf:'html2pdf',chart:'Chart'};
const _libPromises={};
function loadLib(name){
  if(window[_LIB_GLOBALS[name]])return Promise.resolve();
  if(_libPromises[name])return _libPromises[name];
  _libPromises[name]=new Promise(function(resolve,reject){
    const s=document.createElement('script');
    s.src=_LIB_URLS[name];
    s.onload=function(){resolve();};
    s.onerror=function(){_libPromises[name]=null;reject(new Error('lib load failed: '+name));};
    document.head.appendChild(s);
  });
  return _libPromises[name];
}
// نسخة بتعرض رسالة عربية واضحة لو فشل التحميل (لأنو بيلزم إنترنت أول مرة بس)
function loadLibOrWarn(name,what){
  return loadLib(name).catch(function(e){
    console.error(e);
    alert('تعذّر تحميل مكتبة '+what+'. بتلزم اتصال إنترنت أول مرة بس، بعدها بتشتغل من دون نت.');
    throw e;
  });
}
const _bundleFiles={ops:'ops.js',people:'people.js',assets:'assets.js',settings:'settings.js',wallet:'wallet.js',docs:'docs.js',contracts:'contracts.js',inventory:'inventory.js',pipeline:'pipeline.js',payroll:'payroll.js',analytics:'analytics.js',myvisits:'myvisits.js',field:'field.js'};
const _bundleDeps={people:['payroll'],ops:['pipeline'],settings:['ops'],wallet:['ops'],contracts:['ops','field'],myvisits:['contracts','field']}; // إعدادات->فروع العميل بتحتاج ops محمّل؛ المحفظة بتحتاج ops لرقم أرباح الشركة (سحب يدوي فقط)
const _loadedBundles={};
function _loadScriptOnce(src){
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=src+'?v='+APP_VERSION;
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error('فشل تحميل الملف: '+src));
    document.body.appendChild(s);
  });
}
function ensureBundle(name){
  if(!name||name==='core')return Promise.resolve();
  if(_loadedBundles[name])return _loadedBundles[name];
  const deps=_bundleDeps[name]||[];
  const p=(async()=>{
    for(const d of deps)await ensureBundle(d);
    await _loadScriptOnce(_bundleFiles[name]);
  })();
  _loadedBundles[name]=p;
  return p;
}
const PAGE_BUNDLE={
  dashboard:'core',
  maintenance:'ops',sales:'ops',quotes:'ops',projects:'ops',reports:'ops',clients:'ops',contracts:'contracts',myvisits:'myvisits',inventory:'inventory',analytics:'analytics',
  workers:'people',suppliers:'people',
  tools:'assets',generalExpenses:'assets',cars:'assets',loans:'assets',
  settings:'settings',
  docs:'docs',
  wallet:'wallet'
};

const DB_KEY='security_mask_v4';

// ==== Supabase Cloud Sync ====
const SUPABASE_URL="https://mogujnztekojdupttcoo.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_gWe7TtyEeM6XhhoL_HBHWg_f8WBEEd5";
const _sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);

// ==== Authentication (replaces the old anonymous tenant-code system) ====
// TENANT_CODE starts as a harmless placeholder so the rest of the app (which
// reads/writes localStorage keyed by it, synchronously, at boot) never
// breaks during the brief window before we know who's logged in. Nothing on
// screen is usable during that window — a full-screen auth gate (added near
// the end of this script) covers everything until a real user is resolved,
// at which point TENANT_CODE is reassigned to the real value and the local
// DB is reloaded from the correctly-scoped key. See resolveCompanyForUser().
let TENANT_CODE='pending';
let _authUser=null;
let _lastPushedAt=0;
let _cloudApplying=false;
// Hard safety gate: until we've confirmed at least once what's already on the
// cloud for THIS tenant code, we must never push local data — a fresh device
// or a just-switched code could otherwise overwrite real data with stale/empty
// local cache. Nothing is pushed to the cloud until this flips to true.
let _initialSyncReady=false;
function openSyncGate(){
  _initialSyncReady=true;
  const el=document.getElementById('sync-gate');
  if(el)el.remove();
}
// Optimistic-concurrency tracking: the last updatedAt value we KNOW is on the
// cloud (from our own last successful push or from a remote update we just
// applied). A push is only allowed to succeed if the cloud still has exactly
// this value at write time — otherwise someone else wrote in between and we
// must not silently overwrite them.
let _knownRemoteUpdatedAt=null;
// Once a real conflict is detected we stop attempting further pushes and stay
// locked until the person reloads — prevents a storm of repeated conflict
// popups from every subsequent keystroke/save.
let _conflictDetected=false;
const SESSION_ID='s'+Math.random().toString(36).slice(2)+Date.now().toString(36);
// اسم قابل للتمييز لهاد الجهاز/المتصفح، محفوظ محلياً حتى يضل ثابت بين الجلسات (بدل ما يكون بس رمز عشوائي
// ما بيقول شي). المستخدم بيقدر يبدّله من مودال "الأجهزة المفتوحة الآن" لو حاب اسم أوضح (زي "لابتوب المكتب").
function getDeviceLabel(){
  let label=localStorage.getItem('device_label_'+TENANT_CODE);
  if(!label){
    const ua=navigator.userAgent||'';
    const osGuess=/Android/i.test(ua)?'أندرويد':/iPhone|iPad/i.test(ua)?'آيفون/آيباد':/Windows/i.test(ua)?'ويندوز':/Macintosh/i.test(ua)?'ماك':'جهاز';
    const browserGuess=/Edg\//i.test(ua)?'إيدج':/Chrome/i.test(ua)?'كروم':/Firefox/i.test(ua)?'فايرفوكس':/Safari/i.test(ua)&&!/Chrome/i.test(ua)?'سفاري':'متصفح';
    label=osGuess+' - '+browserGuess+' #'+Math.floor(Math.random()*900+100);
    localStorage.setItem('device_label_'+TENANT_CODE,label);
  }
  return label;
}
function setDeviceLabel(newLabel){
  if(!newLabel||!newLabel.trim())return;
  localStorage.setItem('device_label_'+TENANT_CODE,newLabel.trim());
  // نفس السبب: ‎.then(ok, err)‎ بدل ‎.catch()‎ (شوف releaseUserPresence)
  _sb.from('presence').upsert({session_id:SESSION_ID,tenant_code:TENANT_CODE,last_seen:Date.now(),device_label:newLabel.trim()}).then(function(){},function(){});
}

// Local cache must be scoped per tenant code, otherwise switching codes on the
// same device/browser leaks one company's cached data into another company's
// cloud document. Every read/write of the local DB goes through this key.
function scopedDbKey(){return DB_KEY+'::'+TENANT_CODE;}

function renderSyncBanner(status,message){
  // status: 'ok' | 'error' | 'warn' | 'syncing'
  let el=document.getElementById('sync-banner');
  if(!el){
    el=document.createElement('div');
    el.id='sync-banner';
    el.style.cssText='position:fixed;bottom:8px;left:50%;transform:translateX(-50%);max-width:92%;padding:8px 16px;border-radius:8px;font-size:13px;z-index:10000;font-family:inherit;box-shadow:0 2px 8px rgba(0,0,0,.25);display:none;text-align:center';
    document.body.appendChild(el);
  }
  const colors={ok:'#16a34a',error:'#dc2626',warn:'#d97706',syncing:'#334155'};
  el.style.background=colors[status]||'#334155';
  el.style.color='#fff';
  el.textContent=message;
  el.style.display='block';
  clearTimeout(el._hideTimer);
  if(status==='ok'||status==='syncing'){
    el._hideTimer=setTimeout(function(){el.style.display='none';},status==='ok'?2500:4000);
  }
}

// Fetches the single row for this tenant from the 'companies' table.
// Returns a promise resolving to {data,updated_at} or null (row not found,
// or a network/permission error — logged but treated as "nothing to adopt"
// so the app never gets stuck on a failed read).
function fetchCloudRow(){
  return _sb.from('companies').select('data,updated_at').eq('tenant_code',TENANT_CODE).maybeSingle().then(function(res){
    if(res.error){console.error('fetchCloudRow failed:',res.error);return null;}
    return hydrateRow(res.data||null);
  });
}
/* T18: لو البلوب خفيف (الجداول الكبيرة بجداول السحابة) منرجّعه كامل قبل ما يوصل لأي مستهلك.
   لو الصفوف لسا ما وصلت (بصمة ما بتطابق) منعيد المحاولة، وإلا منرجّع null (ما منطبّق بيانات ناقصة). */
function hydrateRow(row,tries){
  tries=tries||0;
  if(!row||!row.data)return Promise.resolve(row);
  let d;
  try{d=safeParseCloudData(row.data);}catch(e){return Promise.resolve(row);}
  if(!(d&&d._sm&&d._sm.v))return Promise.resolve(row);
  if(!window.SM){console.error('T18: البيانات على جداول السحابة بس store.js مش محمّل');return Promise.resolve(null);}
  return SM.pull(_sb,TENANT_CODE,d,SM.state).then(function(full){
    return Object.assign({},row,{data:JSON.stringify(full)});
  }).catch(function(e){
    if(e&&e.smNotReady&&tries<3)return new Promise(function(r){setTimeout(r,1500);}).then(function(){return hydrateRow(row,tries+1);});
    console.error('T18 hydrateRow failed:',e);return null;
  });
}

/* قراءة رخيصة: بتجيب رقم آخر تعديل بس (بايتات قليلة) بدون عمود data كله.
   الفحص الدوري كان يسحب نسخة كاملة من قاعدة البيانات كل 20 ثانية لكل جهاز
   مفتوح — يعني ميغابايتات بالساعة من دون أي فايدة لأنو غالباً ما في جديد.
   هلق منسحب البيانات الكاملة بس لما يكون فعلاً في تعديل أحدث عالسحابة. */
function fetchCloudUpdatedAt(){
  return _sb.from('companies').select('updated_at').eq('tenant_code',TENANT_CODE).maybeSingle().then(function(res){
    if(res.error){console.error('fetchCloudUpdatedAt failed:',res.error);return null;}
    return res.data?res.data.updated_at:null;
  });
}
// بتفحص بالرخيص، وبتنزّل النسخة الكاملة بس إذا في شي جديد فعلاً
function syncIfRemoteChanged(){
  return fetchCloudUpdatedAt().then(function(remoteAt){
    if(remoteAt===null)return;
    if(remoteAt===_knownRemoteUpdatedAt&&remoteAt===_lastAppliedAt)return;
    if(remoteAt===_lastPushedAt){_knownRemoteUpdatedAt=remoteAt;return;}
    if(remoteAt===_lastAppliedAt){_knownRemoteUpdatedAt=remoteAt;return;}
    return fetchCloudRow().then(applyRemoteIfNewer);
  });
}

// Serialize pushes: if a push is already in flight and another save happens
// before it returns, the old naive version fired a second concurrent request
// carrying a stale _knownRemoteUpdatedAt — which the server would then reject
// as "zero rows matched", making the app wrongly report a conflict with
// "another device" even though it was the very same tab, just two quick saves
// racing each other. Instead we now queue: only the LATEST pending db state
// is remembered, and it's pushed automatically the moment the in-flight
// request finishes, always using the freshest _knownRemoteUpdatedAt.
let _pushInFlight=false;
let _pushQueuedDb=null;
function pushToCloud(dbObj){
  if(!_initialSyncReady){
    // We haven't confirmed the real cloud state for this tenant code yet —
    // refuse to push. The change is already safe on disk via saveLocalOnly/
    // localStorage, and will be pushed automatically once the gate opens.
    return;
  }
  if(_conflictDetected){
    // We already told the person someone else changed the data first — don't
    // keep trying to push (and don't keep popping the conflict dialog) until
    // they reload and start fresh from the real latest version.
    return;
  }
  if(_pushInFlight){
    _pushQueuedDb=dbObj; // remember only the most recent state; runs right after the current push settles
    return;
  }
  _pushInFlight=true;
  doPushToCloud(dbObj);
}
function doPushToCloud(dbObj){
  const ts=Date.now();
  const fullPayload=JSON.stringify(dbObj);
  let payload=fullPayload,_smEx=null;
  // T18: لو الميزة مفعّلة منرفع بلوب خفيف + الصفوف بالجداول (النسخة الكاملة بتضل للدمج والنسخ الاحتياطية)
  if(window.SM&&dbObj&&dbObj.settings&&dbObj.settings.cloudTables){_smEx=SM.extract(dbObj,ts,TENANT_CODE);payload=JSON.stringify(_smEx.slim);}
  // Postgres jsonb columns comfortably hold far more than Firestore's old 1MB
  // document cap, but we still keep a sane upper bound so a runaway payload
  // (e.g. a huge embedded image) fails loudly instead of silently.
  const sizeBytes=new Blob([payload]).size;
  const MAX_SAFE_BYTES=8*1024*1024;
  if(sizeBytes>MAX_SAFE_BYTES){
    renderSyncBanner('warn','⚠️ حجم البيانات كبير جداً ('+(sizeBytes/1024/1024).toFixed(2)+' MB) — المزامنة السحابية متوقفة! قلّل حجم الصور/الشعار أو صدّر نسخة احتياطية فوراً.');
    console.error('Cloud save skipped: payload too large ('+sizeBytes+' bytes)');
    _pushInFlight=false;
    return;
  }
  renderSyncBanner('syncing','⏳ جاري رفع التعديلات للسحابة...');
  // Optimistic-concurrency write: on first-ever push for this tenant code we
  // INSERT (fails loudly if the row already exists — meaning someone beat us
  // to creating it). On every push after that we UPDATE only WHERE the row's
  // updated_at still matches what we last knew; if another device wrote in
  // between, zero rows match and the update affects nothing on purpose,
  // instead of silently overwriting their change.
  const attempt=(_knownRemoteUpdatedAt===null)
    ? _sb.from('companies').insert({tenant_code:TENANT_CODE,data:payload,updated_at:ts}).select()
    : _sb.from('companies').update({data:payload,updated_at:ts}).eq('tenant_code',TENANT_CODE).eq('updated_at',_knownRemoteUpdatedAt).select();
  attempt.then(function(res){
    if(res.error){
      if(res.error.code==='23505'){ // unique_violation: row already existed on first insert
        return fetchCloudRow().then(handleSaveConflict);
      }
      if(res.error.code==='42501'&&_knownRemoteUpdatedAt===null){ // v4.6.2: INSERT مرفوض بالـRLS وما عرفنا ختم السحابة ← غالباً السجل موجود
        return fetchCloudRow().then(function(row){if(row)return handleSaveConflict(row);throw res.error;});
      }
      throw res.error;
    }
    if(!res.data||res.data.length===0){
      // UPDATE matched zero rows: someone else's updated_at won the race.
      return fetchCloudRow().then(handleSaveConflict);
    }
    _lastPushedAt=ts;
    _syncBaseJson=fullPayload; // T11: هاي صارت نسخة السحابة المعروفة (أساس الدمج الجاي)
    _knownRemoteUpdatedAt=ts;
    _unsyncedChangeCount=0; // النسخة الأخيرة الكاملة وصلت للسحابة بنجاح، ما في شي معلّق
    renderSyncBanner('ok','✅ تمت المزامنة مع السحابة');
    maybeSaveSnapshot(fullPayload,ts);
    if(_smEx){
      // الصفوف بتنكتب بعد البوابة؛ إذا فشلت منعيد المحاولة (القارئ الثاني بيستنى لحد ما البصمة تطابق)
      SM.pushRows(_sb,TENANT_CODE,_smEx,SM.state).catch(function(e){
        console.error('T18 pushRows failed:',e);
        renderSyncBanner('warn','⚠️ وصل الملخص للسحابة بس لسا في جداول ما انرفعت — منعيد المحاولة تلقائياً');
        setTimeout(function(){if(!_pushInFlight)scheduleCloudPush();},15000);
      });
    }
  }).catch(function(e){
    console.error('Cloud save failed:',e);
    renderSyncBanner('error','❌ فشلت مزامنة البيانات مع السحابة! تحقق من الاتصال بالإنترنت وصلاحيات Supabase (RLS). (البيانات محفوظة محلياً بس مش مرفوعة)');
  }).finally(function(){
    _pushInFlight=false;
    if(_conflictDetected){_pushQueuedDb=null;return;} // don't keep firing once a real conflict locked us
    if(_pushQueuedDb){
      const next=_pushQueuedDb;
      _pushQueuedDb=null;
      pushToCloud(next);
    }
  });
}

/* ---- Presence: warn when another device has this same tenant code open ----
   Each open tab/device upserts a heartbeat row into 'presence' keyed by
   session_id, scoped to this tenant_code. Everyone subscribes to realtime
   changes on that table (filtered to this tenant) and shows a banner if
   another session's heartbeat is recent. This does not prevent conflicts by
   itself — the optimistic-concurrency check in pushToCloud does that — but
   it lets people coordinate ("wait, don't save yet") before a conflict even
   happens. */
// Heartbeat interval widened from 8s to 20s (and stale window from 20s to
// 50s to match): still catches "another device has this open" within a
// reasonable time, but cuts this constant background network chatter by
// more than half, which was adding up alongside every save.
const PRESENCE_HEARTBEAT_MS=20000;
const PRESENCE_STALE_MS=50000;
let _presenceInterval=null;
let _presenceSchemaReady=true; // بيصير false لو الأعمدة الجداد (device_label/force_logout) مش موجودة عالسحابة بعد
window._presenceSessions=[]; // آخر قائمة جلسات فعّالة (لعرضها بمودال "الأجهزة المفتوحة الآن")
function isMissingColumnError(err){
  const msg=((err&&err.message)||'').toLowerCase();
  return msg.includes('column')&&(msg.includes('device_label')||msg.includes('force_logout')||msg.includes('username')||msg.includes('does not exist'));
}
// اسم المستخدم (تسجيل الدخول الداخلي بشاشة القفل) المرتبط بهاد التبويب هلق، أو null
// إذا الجهاز غير مقفول بهيك ميزة أو لسا ما سجّل حدا دخول.
function getSessionUsername(){
  const u=getCurrentUser();
  return u?u.username:null;
}
function initPresence(){
  function beat(){
    const payload={session_id:SESSION_ID,tenant_code:TENANT_CODE,last_seen:Date.now()};
    if(_presenceSchemaReady){
      payload.device_label=getDeviceLabel();
      payload.username=getSessionUsername();
    }
    _sb.from('presence').upsert(payload).then(function(res){
      if(res.error){
        if(isMissingColumnError(res.error)){
          // تجنّب تكرار نفس الخطأ كل 8 ثواني — نرجع لوضع بسيط (session_id + last_seen بس) لحد ما تتضاف الأعمدة
          if(_presenceSchemaReady){_presenceSchemaReady=false;console.warn('عمود device_label/force_logout/username مش موجود بجدول presence بعد. شغّل showPresenceSetupHelp() بالكونسول لتشوف كود SQL الإضافة.');}
        } else console.error('Presence heartbeat failed:',res.error);
      }
    }).catch(function(){});
  }
  function refreshPresence(){
    _sb.from('presence').select('session_id,last_seen,device_label,force_logout,username').eq('tenant_code',TENANT_CODE).then(function(res){
      if(res.error){
        if(isMissingColumnError(res.error))_presenceSchemaReady=false;
        else console.error('Presence fetch failed:',res.error);
        return;
      }
      const now=Date.now();
      let othersActive=0;
      const sessions=[];
      let iAmKicked=false;
      (res.data||[]).forEach(function(d){
        const active=d.last_seen&&(now-d.last_seen)<PRESENCE_STALE_MS;
        if(d.session_id===SESSION_ID){
          if(d.force_logout)iAmKicked=true;
          return;
        }
        if(active){
          othersActive++;
          sessions.push({session_id:d.session_id,device_label:d.device_label||'جهاز غير معروف',last_seen:d.last_seen,username:d.username||null});
        }
      });
      window._presenceSessions=sessions;
      renderPresenceBanner(othersActive);
      if(document.getElementById('open-devices-modal-body'))refreshOpenDevicesModalBody();
      if(iAmKicked)handleForcedLogout();
    });
  }
  beat();
  refreshPresence();
  _presenceInterval=setInterval(beat,PRESENCE_HEARTBEAT_MS);
  _sb.channel('presence-'+TENANT_CODE)
    .on('postgres_changes',{event:'*',schema:'public',table:'presence',filter:'tenant_code=eq.'+TENANT_CODE},refreshPresence)
    .subscribe();
  window.addEventListener('beforeunload',function(){
    _sb.from('presence').delete().eq('session_id',SESSION_ID).then(function(){}).catch(function(){});
  });
  // 'pagehide' fires more reliably than 'beforeunload' on mobile browsers
  // (tab switching, app backgrounding, iOS Safari) — belt-and-suspenders so a
  // closed session doesn't linger and show up as a "phantom" open device
  // until its heartbeat naturally times out.
  window.addEventListener('pagehide',function(){
    _sb.from('presence').delete().eq('session_id',SESSION_ID).then(function(){}).catch(function(){});
  });
}
// لما مستخدم (باسمه بالضبط) يسجّل دخول من تبويب/جهاز، منسكّر تلقائياً أي جلسة تانية
// فاتحة بنفس اسم المستخدم هذا (بغض النظر عن الجهاز) — لكن ما منلمس جلسات مستخدمين
// تانيين (زي admin وaccountant ممكن يكونوا الاثنين فاتحين بنفس الوقت، هيك طبيعي).
function claimUserPresence(username){
  if(!username||!_sb)return;
  const payload={session_id:SESSION_ID,tenant_code:TENANT_CODE,last_seen:Date.now(),device_label:getDeviceLabel(),username:username};
  _sb.from('presence').upsert(payload).then(function(res){
    if(res.error){
      if(isMissingColumnError(res.error)){_presenceSchemaReady=false;return;}
      console.error('claimUserPresence failed:',res.error);
      return;
    }
    return _sb.from('presence').update({force_logout:true}).eq('tenant_code',TENANT_CODE).eq('username',username).neq('session_id',SESSION_ID);
  }).then(function(res){
    if(res&&res.error)console.error('Auto-kick same-username sessions failed:',res.error);
  }).catch(function(e){console.error('claimUserPresence failed:',e);});
}
// لما هالتبويب يقفل نفسه يدوياً (lockApp)، منسحب اسم المستخدم من جلسته — هيك ما ضلت
// "تشغل" هالاسم عالفاضي، وبيقدر نفس المستخدم يفتح جلسة تانية بمكان آخر بدون ما ينكسر شي.
function releaseUserPresence(){
  if(!_sb||!_presenceSchemaReady)return;
  // ‎.then(ok, err)‎ بدل ‎.catch()‎ — البنّاء تبع supabase عندو then() بس.
  // كان ‎.catch()‎ يرمي TypeError هون ويوقف lockApp() قبل ما تظهر شاشة القفل.
  _sb.from('presence').update({username:null}).eq('session_id',SESSION_ID).eq('tenant_code',TENANT_CODE).then(function(){},function(){});
}

// لما جهاز تاني يطلب إنهاء جلستنا (زر "إنهاء هالجلسة" من مودال الأجهزة، أو تسجيل دخول
// بنفس اسم المستخدم من مكان تاني)، منوقف المزامنة فوراً
// ومنبيّن شاشة قفل حتى ما يضل الجهاز عم يشتغل ويعدّل بيانات بصمت وهو "مسكّر" من ناحية باقي الفريق.
function handleForcedLogout(){
  if(window._forceLoggedOut)return;
  window._forceLoggedOut=true;
  if(_presenceInterval)clearInterval(_presenceInterval);
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;direction:rtl;color:#fff;text-align:center';
  overlay.innerHTML=`<div style="max-width:380px">
    <div style="font-size:40px;margin-bottom:12px">🔒</div>
    <div style="font-size:16px;font-weight:800;margin-bottom:8px">تم إنهاء هالجلسة من جهاز آخر</div>
    <div style="font-size:13px;color:#cbd5e1;margin-bottom:18px">حدا من فريقك سكّر هالجلسة (${esc(getDeviceLabel())}) من مودال "الأجهزة المفتوحة". لو هاد أنت بالغلط، اضغط تحديث الصفحة فتفتح جلسة جديدة.</div>
    <button onclick="location.reload()" style="background:linear-gradient(135deg,#3E6FA6,#28455F);color:#fff;border:none;border-radius:8px;padding:10px 24px;font-size:14px;cursor:pointer;font-weight:700">🔄 تحديث الصفحة</button>
  </div>`;
  document.body.appendChild(overlay);
}
function showPresenceSetupHelp(){
  const sql=`alter table presence add column if not exists device_label text;\nalter table presence add column if not exists force_logout boolean default false;\nalter table presence add column if not exists username text;`;
  console.log('%cشغّل هالكود مرة وحدة بـ SQL Editor بلوحة Supabase:\n\n'+sql,'color:#2563eb;font-weight:bold');
  return sql;
}
function kickPresenceSession(sessionId,deviceLabel){
  if(!confirm('متأكد بدك تسكّر جلسة "'+deviceLabel+'"؟ الجهاز هيك رح ينقفل وأي تعديل ما محفوظ فيه ممكن يضيع.'))return;
  _sb.from('presence').update({force_logout:true}).eq('session_id',sessionId).eq('tenant_code',TENANT_CODE).then(function(res){
    if(res.error){
      if(isMissingColumnError(res.error)){showPresenceSetupSqlModal();return;}
      alert('تعذّر إنهاء الجلسة.');console.error(res.error);return;
    }
    alert('تم إرسال طلب إنهاء الجلسة، رح تنقفل عند الجهاز الآخر خلال ثوان.');
  }).catch(function(e){console.error(e);alert('تعذّر إنهاء الجلسة (مشكلة اتصال).');});
}
function kickAllOtherSessions(){
  const sessions=window._presenceSessions||[];
  if(!sessions.length){alert('لا يوجد أجهزة تانية فاتحة هلق.');return;}
  if(!confirm('متأكد بدك تسكّر كل الأجهزة التانية ('+sessions.length+')؟'))return;
  const ids=sessions.map(s=>s.session_id);
  _sb.from('presence').update({force_logout:true}).in('session_id',ids).eq('tenant_code',TENANT_CODE).then(function(res){
    if(res.error){
      if(isMissingColumnError(res.error)){showPresenceSetupSqlModal();return;}
      alert('تعذّر إنهاء الجلسات.');console.error(res.error);return;
    }
    alert('تم إرسال طلب إنهاء لكل الأجهزة التانية.');
  }).catch(function(e){console.error(e);alert('تعذّر إنهاء الجلسات (مشكلة اتصال).');});
}
function showPresenceSetupSqlModal(){
  const sql=showPresenceSetupHelp();
  showModal(`
    <div class="modal-title">لازم إعداد بسيط بقاعدة البيانات أولاً</div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:12px">إعداد لمرة وحدة بـ Supabase:</div>
    <textarea readonly style="width:100%;height:80px;font-family:monospace;font-size:12px;padding:8px;border-radius:6px;border:1px solid var(--border)">${esc(sql)}</textarea>
    <div class="modal-actions"><button class="btn btn-primary" onclick="closeModal()">فهمت، إغلاق</button></div>
  `);
}
function refreshOpenDevicesModalBody(){
  const body=document.getElementById('open-devices-modal-body');
  if(!body)return;
  const sessions=window._presenceSessions||[];
  const now=Date.now();
  body.innerHTML=sessions.length?sessions.map(s=>{
    const secAgo=Math.round((now-s.last_seen)/1000);
    return `<tr>
      <td>${esc(s.device_label)}${s.username?' <span style="color:var(--text2);font-size:11px">('+esc(s.username)+')</span>':''}</td>
      <td style="color:var(--text2);font-size:11px">قبل ${secAgo} ث</td>
      <td><button class="btn btn-sm btn-danger" onclick='kickPresenceSession("${s.session_id}",${esc(JSON.stringify(s.device_label))})'>🔴 إنهاء الجلسة</button></td>
    </tr>`;
  }).join(''):'<tr><td colspan="3" style="text-align:center;color:var(--text2)">لا يوجد أجهزة تانية فاتحة هلق</td></tr>';
}
function showOpenDevicesModal(){
  showModal(`
    <div class="modal-title">الأجهزة المفتوحة الآن على نفس الرمز</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px">أجهزة متصلة الآن.</div>
    ${!_presenceSchemaReady?`<div style="font-size:11.5px;margin-bottom:12px;padding:9px 10px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412">⚠️ الإغلاق عن بعد معطّل — <span style="cursor:pointer;text-decoration:underline" onclick="closeModal();showPresenceSetupSqlModal()">التفاصيل</span></div>`:''}
    <table style="width:100%;font-size:12px;margin-bottom:14px">
      <thead><tr><th>الجهاز</th><th>آخر نشاط</th><th></th></tr></thead>
      <tbody id="open-devices-modal-body"></tbody>
    </table>
    <div style="background:var(--bg2);border-radius:8px;padding:10px;margin-bottom:14px">
      <div style="font-size:11px;color:var(--text2);margin-bottom:6px">اسم الجهاز:</div>
      <div style="display:flex;gap:6px">
        <input type="text" class="form-control" id="device-label-input" value="${esc(getDeviceLabel())}" style="flex:1">
        <button class="btn btn-sm" onclick="setDeviceLabel(document.getElementById('device-label-input').value)">حفظ</button>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-danger" onclick="kickAllOtherSessions()">🔴 سكّر كل الأجهزة التانية</button>
      <button class="btn btn-primary" onclick="closeModal()">إغلاق</button>
    </div>
  `);
  refreshOpenDevicesModalBody();
}
function renderPresenceBanner(othersActive){
  let el=document.getElementById('presence-banner');
  if(othersActive<=0){
    if(el)el.remove();
    return;
  }
  if(!el){
    el=document.createElement('div');
    el.id='presence-banner';
    el.style.cssText='position:fixed;top:8px;left:50%;transform:translateX(-50%);max-width:92%;padding:7px 16px;border-radius:20px;font-size:12px;z-index:9998;font-family:inherit;box-shadow:0 2px 8px rgba(0,0,0,.2);text-align:center;background:#1e293b;color:#fff;display:flex;align-items:center;gap:6px;cursor:pointer';
    el.onclick=function(){showOpenDevicesModal();};
    el.title='اضغط لتشوف الأجهزة وتسكّر أي وحدة ما بتعرفها';
    document.body.appendChild(el);
  }
  el.innerHTML='🟢 '+(othersActive===1?'في جهاز آخر فاتح نفس الرمز هلق':'في '+othersActive+' أجهزة تانية فاتحة نفس الرمز هلق')+' — اضغط هون لتشوفهن ⚙️';
}

function handleSaveConflict(remoteRow){
  if(_conflictDetected)return;
  _conflictDetected=true;
  renderSyncBanner('error','⚠️ تعارض! في تعديل وصل من جهاز آخر قبل تعديلك');
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:7000;display:flex;align-items:center;justify-content:center;padding:20px;direction:rtl';
  overlay.innerHTML=`<div style="background:#fff;border-radius:12px;padding:24px;max-width:440px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3)">
    <div style="width:48px;height:48px;border-radius:14px;background:#fef2f2;color:#dc2626;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:24px">⚠️</div>
    <div style="font-weight:700;font-size:16px;margin-bottom:8px;color:#1a1a2e">في تعارض بالتعديلات</div>
    <div style="font-size:13px;color:#4b5563;line-height:1.8;margin-bottom:18px">
      حد تاني (جهاز أو متصفح تاني) حفظ تعديل على نفس الرمز بعد ما فتحت أنت الصفحة، قبل ما تعديلك يوصل للسحابة.<br><br>
      منشان ما يضيع تعديل حدا بالغلط، ما رفعنا تعديلك الأخير تلقائياً. تعديلك محفوظ محلياً عندك بالمتصفح — بس لازم تراجعه وتعيد إدخاله يدوياً بعد ما تحدّث الصفحة وتاخد آخر نسخة.
    </div>
    <button style="width:100%;justify-content:center;display:flex;align-items:center;gap:7px;padding:11px;border-radius:9px;cursor:pointer;font-family:inherit;font-weight:700;font-size:13px;background:linear-gradient(135deg,#B06A3F,#8A4F2C);border:1px solid #8A4F2C;color:#fff;box-shadow:0 4px 14px rgba(138,79,44,.35)" onclick="location.reload()">تحديث الصفحة الآن وجلب آخر نسخة</button>
  </div>`;
  document.body.appendChild(overlay);
}

/* ---- Automatic versioned cloud backups (disaster recovery safety net) ----
   Every push to the cloud is a full overwrite of the single company row,
   so two people editing at the exact same moment could clobber each other.
   To make sure nothing is ever truly lost, we keep a rolling history of
   snapshots in the 'backups' table, throttled so we don't write one on every
   keystroke. */
let _lastSnapshotAt=0;
const SNAPSHOT_INTERVAL_MS=5*60*1000; // one snapshot every 5 minutes at most
const SNAPSHOT_KEEP=30; // keep the last 30 snapshots (~2.5 hours of history at worst case)
function maybeSaveSnapshot(payload,ts){
  if(ts-_lastSnapshotAt<SNAPSHOT_INTERVAL_MS)return;
  _lastSnapshotAt=ts;
  _sb.from('backups').insert({tenant_code:TENANT_CODE,data:payload,updated_at:ts}).then(function(res){
    if(res.error){console.error('Snapshot save failed:',res.error);return;}
    trimOldSnapshots();
  }).catch(function(e){console.error('Snapshot save failed:',e);});
}
function trimOldSnapshots(){
  _sb.from('backups').select('id,updated_at').eq('tenant_code',TENANT_CODE).order('updated_at',{ascending:false}).then(function(res){
    if(res.error){console.error('Snapshot trim failed:',res.error);return;}
    const rows=res.data||[];
    if(rows.length<=SNAPSHOT_KEEP)return;
    const idsToDelete=rows.slice(SNAPSHOT_KEEP).map(function(r){return r.id;});
    _sb.from('backups').delete().in('id',idsToDelete).then(function(res2){
      if(res2.error)console.error('Snapshot trim delete failed:',res2.error);
    }).catch(function(){});
  }).catch(function(e){console.error('Snapshot trim failed:',e);});
}
function forceSnapshotNow(){
  const payload=JSON.stringify(db);
  const ts=Date.now();
  _lastSnapshotAt=ts;
  return _sb.from('backups').insert({tenant_code:TENANT_CODE,data:payload,updated_at:ts}).then(function(res){
    if(res.error)throw res.error;
    return trimOldSnapshots();
  });
}
function loadSnapshotsList(){
  const el=document.getElementById('snapshots-list');
  if(!el)return;
  el.innerHTML='<div style="font-size:12px;color:var(--text2);padding:10px">⏳ جاري التحميل...</div>';
  _sb.from('backups').select('id,updated_at').eq('tenant_code',TENANT_CODE).order('updated_at',{ascending:false}).limit(SNAPSHOT_KEEP).then(function(res){
    if(res.error){
      console.error('Load snapshots failed:',res.error);
      el.innerHTML='<div style="font-size:12px;color:var(--danger);padding:10px">تعذّر تحميل النسخ السحابية.</div>';
      return;
    }
    const rows=res.data||[];
    if(rows.length===0){el.innerHTML='<div style="font-size:12px;color:var(--text2);padding:10px">ولا نسخة بعد</div>';return;}
    el.innerHTML=rows.map(function(r){
      const dt=new Date(r.updated_at);
      const label=dt.toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'});
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;border:1px solid var(--border);border-radius:10px;margin-bottom:6px;background:var(--bg2)">
        <div style="font-size:12px;font-weight:600">${label}</div>
        <button class="btn btn-sm" style="color:var(--accent);border-color:var(--accent)" onclick="restoreSnapshot(${r.id})"><i class="ti ti-history"></i> استعادة</button>
      </div>`;
    }).join('');
  }).catch(function(e){
    console.error('Load snapshots failed:',e);
    el.innerHTML='<div style="font-size:12px;color:var(--danger);padding:10px">تعذّر تحميل النسخ السحابية.</div>';
  });
}
async function restoreSnapshot(id){
  if(!confirm('استعادة هذه النسخة رح تستبدل كل البيانات الحالية بها.\nرح نحفظ نسخة من وضعك الحالي أولاً قبل الاستعادة احتياطاً.\nمتابعة؟'))return;
  if(!(await confirmPasswordFor('استعادة نسخة سحابية')))return;
  try{
    await forceSnapshotNow();
    const res=await _sb.from('backups').select('data').eq('id',id).maybeSingle();
    if(res.error||!res.data){alert('هذه النسخة لم تعد موجودة.');return;}
    const remoteDb=safeParseCloudData(res.data.data);
    db=remoteDb;
    normalizeDB();
    saveDB(db);
    render();
    alert('تمت الاستعادة بنجاح.');
  }catch(e){
    console.error('Restore failed:',e);
    alert('فشلت عملية الاستعادة، راجع الكونسول.');
  }
}

function saveLocalOnly(dbObj){
  try{localStorage.setItem(scopedDbKey(),JSON.stringify(dbObj));return true;}catch(e){console.error('saveLocalOnly failed:',e);return false;}
}

// بيانات عمود data ممكن توصل من Supabase بشكلين حسب نوع العمود بقاعدة البيانات:
// - لو العمود نوعه text  → بترجع نص (string) لازم نعمله JSON.parse.
// - لو العمود نوعه jsonb → مكتبة supabase-js بتفكّه أوتوماتيكياً وبترجع كائن
//   (object) جاهز، فعمل JSON.parse عليه بيفشل دايماً (لأنو مش نص أصلاً).
// هاي الدالة بتتعامل مع الحالتين بأمان بدل ما تنكسر.
function safeParseCloudData(raw){
  if(raw==null)return null;
  if(typeof raw==='object')return raw; // jsonb: supabase فكّها لحالها، منرجعها متل ما هي
  if(typeof raw==='string'){
    try{return JSON.parse(raw);}
    catch(e){console.error('safeParseCloudData: JSON.parse failed on string:',e,raw);throw e;}
  }
  throw new Error('نوع بيانات غير متوقع من السحابة: '+typeof raw);
}

// ==== T11: دمج ثلاثي لتحديثات السحابة مع تعديلات محلية لسا ما انرفعت ====
// _syncBaseJson = آخر نسخة منعرف إنها على السحابة (أساس المقارنة). لما يوصل تحديث من جهاز تاني
// وعندنا تعديل محلي معلّق، منقارن: الأساس مقابل تعديلك مقابل تحديثهم، وبنحافظ على الاتنين.
let _syncBaseJson=null;
function _hasPendingLocalChanges(){return _unsyncedChangeCount>0||!!_cloudPushTimer||_pushInFlight||!!_pushQueuedDb;}
function _eq3(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function _isIdList(a){return Array.isArray(a)&&a.every(function(x){return x&&typeof x==='object'&&!Array.isArray(x)&&x.id!==undefined;});}
function _isPlainObj(x){return x&&typeof x==='object'&&!Array.isArray(x);}
function _merge3(b,l,r){
  if(_eq3(l,b))return r;      // أنت ما لمست هالجزء → خود نسخة الجهاز التاني
  if(_eq3(r,b))return l;      // الجهاز التاني ما لمسه → خود نسختك
  if(_eq3(l,r))return l;
  if(Array.isArray(l)&&Array.isArray(r)){
    const ba=Array.isArray(b)?b:[];
    if(_isIdList(l)&&_isIdList(r)&&_isIdList(ba)){
      const bm=new Map(ba.map(function(x){return [x.id,x];}));
      const lm=new Map(l.map(function(x){return [x.id,x];}));
      const out=[],seen=new Set();
      r.forEach(function(rx){
        seen.add(rx.id);
        const bx=bm.get(rx.id),lx=lm.get(rx.id);
        if(lx===undefined){
          if(bx!==undefined&&_eq3(rx,bx))return;   // حذفته أنت والتاني ما عدّله → بيتحذف
          out.push(rx);return;                      // التاني عدّله أو أضافه → منحافظ عليه
        }
        out.push(bx===undefined?_merge3({},lx,rx):_merge3(bx,lx,rx));
      });
      l.forEach(function(lx){
        if(seen.has(lx.id))return;
        const bx=bm.get(lx.id);
        if(bx===undefined||!_eq3(lx,bx))out.push(lx); // أضفته أنت، أو عدّلته وهو انحذف عند التاني
      });
      return out;
    }
    return l;
  }
  if(_isPlainObj(l)&&_isPlainObj(r)){
    const bb=_isPlainObj(b)?b:{};
    const out={};
    Object.keys(Object.assign({},l,r)).forEach(function(k){
      const inL=Object.prototype.hasOwnProperty.call(l,k),inR=Object.prototype.hasOwnProperty.call(r,k);
      if(!inL){if(!_eq3(r[k],bb[k]))out[k]=r[k];return;}
      if(!inR){if(!(k in bb)||!_eq3(l[k],bb[k]))out[k]=l[k];return;}
      out[k]=_merge3(bb[k],l[k],r[k]);
    });
    return out;
  }
  return l; // قيم بسيطة اتعدّلت من الطرفين → تعديلك الأحدث هو يلي بيضل
}

function applyRemoteIfNewer(row){
  if(!row||!row.data)return;
  // Always keep track of the latest updated_at we've SEEN on the cloud, even
  // if we don't re-render from it (e.g. it's an echo of our own write) — this
  // is what pushToCloud's conflict check compares against.
  const _prevKnownRemoteAt=_knownRemoteUpdatedAt;
  _knownRemoteUpdatedAt=row.updated_at;
  if(row.updated_at!==_lastPushedAt && row.updated_at!==_lastAppliedAt){
    let _mergedPending=false;
    try{
      const remoteDb=safeParseCloudData(row.data);
      const localBefore=db;
      // v4.6.2: أول سحب بالجلسة = ما في "أساس دمج" بعد (_syncBaseJson فاضي)، فما منقدر نعمل دمج ثلاثي.
      // حسب تصميم initCloudSync السحابة هي المرجع عند الفتح، وأي saveDB بالإقلاع (تهيئة/ترحيل) مو تعديل حقيقي.
      // قبل هيك كان هاد بيفشّل الدمج، بيرجّع ختم السحابة null، فكل رفع بيصير INSERT بدون owner_uid ← 403 / 42501.
      const _firstAdopt=!_syncBaseJson;
      if(_firstAdopt&&_hasPendingLocalChanges()){
        try{localStorage.setItem(scopedDbKey()+'_preadopt',JSON.stringify(localBefore));}catch(_e){} // نسخة أمان من حالتك المحلية قبل تبنّي السحابة
      }
      const hadPending=_hasPendingLocalChanges()&&!_firstAdopt;
      db=remoteDb;
      normalizeDB();
      const remoteJson=JSON.stringify(db);
      if(hadPending){
        // T11: عندك تعديل ما انرفع → ما منطمسه. منعمل دمج ثلاثي ومنرفع النتيجة.
        try{
          if(!_syncBaseJson)throw new Error('no sync base');
          db=_merge3(JSON.parse(_syncBaseJson),localBefore,db);
          normalizeDB();
          _mergedPending=JSON.stringify(db)!==remoteJson;
        }catch(me){
          // فشل الدمج: منرجّع تعديلك، ومنرجّع ختم السحابة القديم حتى يطلع تحذير التعارض بدل ما نكتب فوقهم
          console.error('Remote merge failed, keeping local edits:',me);
          db=localBefore;
          _knownRemoteUpdatedAt=_prevKnownRemoteAt;
          renderSyncBanner('warn','⚠️ وصل تحديث من جهاز آخر وما قدرنا ندمجه مع تعديلك — تعديلك محفوظ، وبيطلعلك تنبيه التعارض عند الرفع');
          return;
        }
      }
      _syncBaseJson=remoteJson;
      if(window._lockMode==='setup'&&db.security&&db.security.users&&db.security.users.length&&!isUnlocked())showLock();
      _cloudApplying=true;
      saveLocalOnly(db);
      _cloudApplying=false;
      _lastAppliedAt=row.updated_at;
      if(_mergedPending){scheduleCloudPush();renderSyncBanner('ok','🔀 انضمّت تحديثات من جهاز آخر لتعديلاتك اللي لسا ما انرفعت');}
      // لو في نافذة (modal) مفتوحة، ما منعيد رسم الصفحة فوراً — كان هيك
      // بيمسح كل شي المستخدم كاتبه بالنموذج من دون أي تحذير. منأجّل الرسم
      // لحد ما يسكّر النافذة (شوف closeModal بآخر الملف).
      const _mc=document.getElementById('modal-container');
      if(_mc&&_mc.innerHTML.trim()!==''){
        window._pendingRemoteRender=true;
        renderSyncBanner('warn','🔄 وصلت تحديثات من جهاز آخر — رح تنعرض بعد ما تسكّر النافذة المفتوحة');
      }else{
        render();
        if(!_mergedPending)renderSyncBanner('ok','🔄 تم استلام تحديثات جديدة من جهاز آخر');
      }
    }catch(e){
      console.error('Cloud parse failed:',e);
      renderSyncBanner('error','❌ فشل قراءة البيانات القادمة من السحابة! راجع الكونسول للتفاصيل.');
    }
  }
}
let _lastAppliedAt=0;

function initCloudSync(){
  // Step 1: one authoritative server read for THIS tenant code before we do
  // anything that could write. If the row exists, adopt it (it's always the
  // source of truth over whatever happens to be cached locally). Only then
  // do we open the gate that allows local edits to be pushed.
  function subscribeRealtime(){
    // Step 2: live listener for ongoing sync from other devices (INSERT on
    // first-ever write for a tenant, UPDATE on every write after that).
    _sb.channel('company-'+TENANT_CODE)
      .on('postgres_changes',{event:'*',schema:'public',table:'companies',filter:'tenant_code=eq.'+TENANT_CODE},function(payload){
        if(payload.new&&payload.new.data){
          if(payload.new.updated_at===_lastPushedAt)return; // صدى كتابتنا
          hydrateRow(payload.new).then(function(r){if(r)applyRemoteIfNewer(r);});
        } else if(_initialSyncReady){
          pushToCloud(db);
        }
      })
      .subscribe();
  }
  fetchCloudRow().then(function(row){
    if(row)applyRemoteIfNewer(row);
    // If it doesn't exist yet, this is genuinely a brand-new code — nothing
    // to adopt, local (default/empty) data is correct.
    openSyncGate();
    seedSupplierAhmadBakour();
    initPresence();
    subscribeRealtime();
  }).catch(function(err){
    console.error('Initial cloud check failed:',err);
    renderSyncBanner('error','❌ تعذّر التحقق من السحابة عند الفتح (تحقق من الإنترنت). البيانات المحلية قد لا تكون الأحدث.');
    // Even on failure we must open the gate eventually, or the app is stuck
    // forever offline. We allow editing, but pushToCloud will keep failing
    // safely (and loudly, via the banner) until connectivity returns — it
    // will NOT silently clobber cloud data, and any real remote changes made
    // elsewhere in the meantime will still win via applyRemoteIfNewer's
    // timestamp check once the realtime channel reconnects.
    openSyncGate();
    seedSupplierAhmadBakour();
    initPresence();
    subscribeRealtime();
  });

  // Safety net: the realtime channel above can silently go stale on mobile
  // browsers when the screen locks or the tab is backgrounded for a while.
  // These two mechanisms make sure the app re-syncs fully automatically —
  // never depending on the person tapping anything.
  setInterval(function(){
    if(document.visibilityState==='visible'){
      syncIfRemoteChanged().catch(function(e){console.error('Periodic sync check failed:',e);});
    }
  },20000);

  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='visible'){
      syncIfRemoteChanged().catch(function(e){console.error('Focus sync check failed:',e);});
    }
  });
  window.addEventListener('online',function(){
    if(_unsyncedChangeCount>0&&!_conflictDetected&&_initialSyncReady)pushToCloud(db); // T42: رجع النت → ارفع التعديلات المعلّقة فوراً
    syncIfRemoteChanged().catch(function(e){console.error('Reconnect sync check failed:',e);});
  });
}
// ==== End Supabase Cloud Sync ====

// ==== Authentication ====
function renderAuthGateHTML(mode,errorMsg){
  const isLogin=mode!=='signup';
  return `<div style="background:#fff;border-radius:14px;padding:28px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.35);text-align:center">
    <div style="width:78px;height:78px;border-radius:22px;background:#fff;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;box-shadow:0 6px 20px rgba(22,35,47,.16);border:1px solid rgba(176,106,63,.28)"><img src="images/image1.png" alt="Security Mask" style="width:60px;height:60px;object-fit:contain"></div>
    <div style="font-weight:800;font-size:18px;margin-bottom:4px;color:#16232F">Security Mask</div>
    <div style="font-size:12px;color:#57606B;margin-bottom:18px">${isLogin?'سجّل دخول لحساب شركتك':'أنشئ حساب جديد لشركتك'}</div>
    ${errorMsg?`<div style="background:#FDECEA;color:#B3261E;font-size:12px;padding:8px 10px;border-radius:8px;margin-bottom:12px;text-align:right">${errorMsg}</div>`:''}
    <input id="auth-email" type="email" placeholder="البريد الإلكتروني" style="width:100%;padding:10px 12px;border:1px solid #C7D1DB;border-radius:8px;font-size:14px;margin-bottom:10px;text-align:right;font-family:inherit;color:#1B222B;background:#fff" autocomplete="email">
    <input id="auth-pass" type="password" placeholder="كلمة المرور" style="width:100%;padding:10px 12px;border:1px solid #C7D1DB;border-radius:8px;font-size:14px;margin-bottom:14px;text-align:right;font-family:inherit;color:#1B222B;background:#fff" autocomplete="${isLogin?'current-password':'new-password'}">
    <button id="auth-submit" style="width:100%;justify-content:center;padding:11px;margin-bottom:10px;display:flex;align-items:center;gap:7px;border-radius:9px;cursor:pointer;font-family:inherit;font-weight:700;font-size:13px;background:linear-gradient(135deg,#B06A3F,#8A4F2C);border:1px solid #8A4F2C;color:#fff;box-shadow:0 4px 14px rgba(138,79,44,.35)">${isLogin?'دخول':'إنشاء الحساب'}</button>
    <div style="font-size:12px;color:#57606B">
      ${isLogin?'ما عندك حساب؟':'عندك حساب أصلاً؟'}
      <a href="#" id="auth-switch" style="color:#28455F;font-weight:700">${isLogin?'أنشئ حساب جديد':'سجّل دخول'}</a>
    </div>
  </div>`;
}
function translateAuthError(err){
  const msg=(err&&err.message)||'';
  if(/Invalid login credentials/i.test(msg))return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if(/User already registered/i.test(msg))return 'هذا البريد مسجّل مسبقاً — جرّب "سجّل دخول" بدل إنشاء حساب.';
  if(/Password should be/i.test(msg))return 'كلمة المرور قصيرة جداً — لازم 6 أحرف على الأقل.';
  return msg||'حدث خطأ، حاول مرة أخرى.';
}
// Blocking full-screen login/signup gate. Resolves with the authenticated
// Supabase user once sign-in or sign-up succeeds. Sits above everything else
// in the app (including the app's own PIN lock-screen) since nothing is
// usable — and no cloud data may be touched — until we know who this is.
function showAuthGate(){
  return new Promise(function(resolve){
    let mode='login';
    const overlay=document.createElement('div');
    overlay.id='auth-gate-overlay';
    overlay.style.cssText='position:fixed;inset:0;background:linear-gradient(135deg,#0f172a,#334155);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;direction:rtl;font-family:inherit';
    function paint(errorMsg){
      overlay.innerHTML=renderAuthGateHTML(mode,errorMsg);
      overlay.querySelector('#auth-switch').addEventListener('click',function(e){
        e.preventDefault();
        mode=mode==='login'?'signup':'login';
        paint();
      });
      const submitBtn=overlay.querySelector('#auth-submit');
      const emailInput=overlay.querySelector('#auth-email');
      const passInput=overlay.querySelector('#auth-pass');
      function submit(){
        const email=emailInput.value.trim();
        const password=passInput.value;
        if(!email||!password){paint('يرجى إدخال البريد الإلكتروني وكلمة المرور');return;}
        submitBtn.disabled=true;
        submitBtn.textContent='...جاري المعالجة';
        const op=(mode==='login')
          ? _sb.auth.signInWithPassword({email:email,password:password})
          : _sb.auth.signUp({email:email,password:password});
        op.then(function(res){
          if(res.error){paint(translateAuthError(res.error));return;}
          if(mode==='signup' && (!res.data||!res.data.session)){
            // Email confirmation is required by the project's Auth settings.
            paint('تم إنشاء الحساب! تحقق من بريدك الإلكتروني لتأكيد الحساب، وبعدها سجّل دخول.');
            mode='login';
            return;
          }
          overlay.remove();
          resolve(res.data.user);
        }).catch(function(e){
          paint('خطأ غير متوقع: '+(e&&e.message?e.message:e));
        });
      }
      submitBtn.addEventListener('click',submit);
      passInput.addEventListener('keydown',function(e){if(e.key==='Enter')submit();});
    }
    paint();
    document.body.appendChild(overlay);
  });
}
// Resolves which tenant_code (company row) belongs to this logged-in user:
//  1) an existing company row already owned by them, else
//  2) an unclaimed ("orphan") row left over from before Auth existed —
//     claimed once, first-come-first-served, so old trial data isn't lost,
//     else
//  3) a brand-new company row created just for them.
// حطّها false بعد ما تتأكد إنو كل سجلات الشركات إلها owner_uid (شوف الشرح تحت)
const ALLOW_ORPHAN_ADOPTION=false; // T1: مقفل — أي حساب جديد بياخد شركة جديدة فاضية، ما بيتبنّى بيانات حدا
async function resolveCompanyForUser(user){
  const existing=await _sb.from('companies').select('tenant_code').eq('owner_uid',user.id).maybeSingle();
  if(existing.error)throw existing.error;
  if(existing.data)return existing.data.tenant_code;

  /* ⚠️ تنبيه أمان مهم:
     السطر الجاي بيخلي أي حساب جديد "يتبنّى" أول سجل شركة ما إله مالك
     (owner_uid = null). هاد كان مفيد وقت الترحيل من النظام القديم، بس طالما
     ضل مفعّل: أي حدا بيسجّل حساب جديد ممكن ياخد بيانات شركة تانية بالغلط.
     بعد ما تتأكد إنو كل السجلات بجدول companies صار إلها owner_uid،
     حوّل هالقيمة لـ false وخلص. */
  if(ALLOW_ORPHAN_ADOPTION){
  const orphan=await _sb.from('companies').select('tenant_code').is('owner_uid',null).limit(1).maybeSingle();
  if(!orphan.error&&orphan.data){
    const claim=await _sb.from('companies').update({owner_uid:user.id}).eq('tenant_code',orphan.data.tenant_code).is('owner_uid',null).select();
    if(!claim.error&&claim.data&&claim.data.length>0){
      return orphan.data.tenant_code;
    }
    // Someone else claimed it a split-second earlier — fall through and make a new one.
  }
  }

  const newCode='sm-'+Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4);
  const created=await _sb.from('companies').insert({tenant_code:newCode,owner_uid:user.id,data:JSON.stringify(defaultData),updated_at:Date.now()});
  if(created.error)throw created.error;
  return newCode;
}
function signOutOfCompany(){
  if(!confirm('تسجيل الخروج من حساب الشركة؟'))return;
  _sb.auth.signOut().then(function(){location.reload();});
}
// ==== End Authentication ====

const defaultData={
  clients:[],
  workers:[],
  suppliers:[],
  maintenance:[],sales:[],quotes:[],contracts:[],attendance:[],workerPayments:[],tools:[],cars:[],loans:[],generalExpenses:[],generalExpenseTypes:['أدوات','بضاعة','إيجار','فواتير','أخرى'],
  deviceTypes:["Camera","IPC","NVR","DVR","Switch","Access Point","Adapter","Battery","Power Supply","BNC","DC","BOX","Toub","Flix","Cabinet","Co-Axial","Extender HD","HDMI","Hard","Cat6","Cable Power","UPS","Router","Fingerprint","Accessories","Star Link","Cable"],
  modelNumbers:[],
  workTypes:["صيانة","تركيب","برمجة","معايرة","كشف","تبديل","فك"],
  expenseTypes:["قطع غيار","أكل","مواصلات / تكسي","مواد استهلاكية","أدوات","أخرى"],
  toolTypes:["سلم","دريل","مثقاب","مفك","كاميرا تست","جهاز برمجة","كابل تست","حقيبة عدة","مولد","لاسلكي","حبل أمان","خوذة","أخرى"],
  carExpenseTypes:["بنزين","ديزل","غيار زيت","صيانة","إطارات","بطارية","رسوم سير","تأمين","غسيل","قطع غيار","أخرى"],
  projects:[],
  docs:[],docTemplates:[]
};

function loadDB(){
  try{
    const d=localStorage.getItem(scopedDbKey());
    if(d)return JSON.parse(d);
    // One-time migration: if this browser has old unscoped data (from before
    // the per-tenant fix) and nothing yet saved for this specific tenant code,
    // adopt it once so the current session doesn't start empty.
    const legacy=localStorage.getItem(DB_KEY);
    if(legacy){
      localStorage.setItem(scopedDbKey(),legacy);
      localStorage.removeItem(DB_KEY);
      return JSON.parse(legacy);
    }
  }catch(e){}
  return JSON.parse(JSON.stringify(defaultData));
}
// بيتزاد كل ما نعمل تعديل محلي، وبينزل لما نتأكد إنو نفس التعديل وصل فعلاً للسحابة —
// طالما فيه فرق، معناها في تعديلات محفوظة بالجهاز بس لسا ما انرفعت (خطر ضياع لو انسكرت الصفحة أو الجهاز)
let _unsyncedChangeCount=0;
// Cloud pushes are debounced by a short window: if several saves happen in
// quick succession (e.g. the user clicking through a few actions back to
// back), we wait a moment and send just one push carrying the latest state,
// instead of firing a network request after every single save. Nothing about
// what gets saved changes — localStorage still writes immediately below, so
// no data is ever at risk — this only reduces how often we talk to the
// network, which is what was making rapid interactions feel sluggish.
let _cloudPushTimer=null;
const CLOUD_PUSH_DEBOUNCE_MS=600;
function scheduleCloudPush(){
  if(_cloudPushTimer)clearTimeout(_cloudPushTimer);
  _cloudPushTimer=setTimeout(function(){
    _cloudPushTimer=null;
    pushToCloud(db);
  },CLOUD_PUSH_DEBOUNCE_MS);
}
function saveDB(db){
  try{walletStampRates(db);}catch(e){console.error('walletStampRates failed:',e);}
  let localOk=true;
  try{
    localStorage.setItem(scopedDbKey(),JSON.stringify(db));
  }catch(e){
    // غالباً مساحة التخزين بالمتصفح امتلت (QuotaExceededError). قبل هيك كانت
    // الدالة ترجّع false بصمت وما حدا يفحصها، فالتعديل يضيع من دون ما المستخدم
    // يعرف. هلق منحذّره بوضوح، ومنكمّل رفعه عالسحابة لأنها نسخة أوثق.
    localOk=false;
    console.error('saveDB failed (local):',e);
    renderSyncBanner('error','⚠️ مساحة التخزين بالمتصفح ممتلئة! التعديل انرفع عالسحابة بس ما انحفظ محلياً. صدّر نسخة احتياطية وامسح صور/شعارات كبيرة من الإعدادات.');
  }
  if(!_cloudApplying){
    _unsyncedChangeCount++;
    scheduleCloudPush();
  }
  return localOk;
}
// تحذير قبل إغلاق الصفحة/التبويب إذا في تعديلات محفوظة محلياً بس لسا ما وصلت للسحابة —
// هاد بيمنع بالضبط سيناريو "سجّلت دفعة وسكّرت الصفحة قبل ما توصل للسحابة فضاعت"
window.addEventListener('beforeunload',function(e){
  if(_unsyncedChangeCount>0){
    e.preventDefault();
    e.returnValue='في تعديلات (دفعات/بيانات) لسا ما وصلت للسحابة بشكل مؤكد. إذا سكّرت الصفحة هلق ممكن تضيع. متأكد بدك تكمل؟';
    return e.returnValue;
  }
});
// إعادة محاولة تلقائية كل 15 ثانية لأي تعديل فشل يوصل للسحابة بسبب مشكلة شبكة مؤقتة
// (ما بتشتغل لو صار تعارض حقيقي مع جهاز تاني — هناك لازم المستخدم يحدّث الصفحة يدوياً عمداً)
setInterval(function(){
  if(_unsyncedChangeCount>0 && !_conflictDetected && _initialSyncReady){
    pushToCloud(db);
  }
},15000);
async function exportData(){
  if(!(await confirmPasswordFor('تصدير نسخة احتياطية (JSON)')))return;
  if(!db.meta)db.meta={};
  db.meta.lastBackupDate=localToday();
  saveDB(db);
  const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='security-mask-backup-'+localToday()+'.json';a.click();
  const banner=document.getElementById('backup-banner');if(banner)banner.remove();
}
/* ===== تصدير شامل لكل قاعدة البيانات بملف Excel واحد (كل جدول بشيت منفصل) — للأرشفة الدورية ===== */
async function exportFullExcel(){
  if(!(await confirmPasswordFor('تصدير شامل (Excel)')))return;
  try{await loadLibOrWarn('xlsx','تصدير Excel');}catch(e){return;}
  const wb=XLSX.utils.book_new();
  function addSheet(name,rows){
    if(!rows||!rows.length)return;
    const keys=[...new Set(rows.flatMap(r=>Object.keys(r||{})))];
    const data=[keys,...rows.map(r=>keys.map(k=>{
      const v=r?r[k]:undefined;
      if(v===undefined||v===null)return '';
      if(typeof v==='object')return JSON.stringify(v);
      return v;
    }))];
    const ws=XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb,ws,name.slice(0,31));
  }
  addSheet('العملاء',db.clients);
  addSheet('العمال',db.workers);
  addSheet('الموردين',db.suppliers);
  addSheet('المبيعات',db.sales);
  addSheet('الأعمال',db.maintenance);
  addSheet('عروض الأسعار',db.quotes);
  addSheet('دفعات العمال',db.workerPayments);
  addSheet('العدد',db.tools);
  addSheet('مصاريف عامة',db.generalExpenses);
  addSheet('السيارات',db.cars);
  addSheet('الإعارات',db.loans);
  addSheet('المشاريع',db.projects);
  if(!wb.SheetNames.length){alert('لا يوجد بيانات لتصديرها');return;}
  const stamp=localToday();
  XLSX.writeFile(wb,`نسخة-شاملة-Excel-${stamp}.xlsx`);
}
/* T3: فحص هيكل ملف الاستيراد قبل ما نلمس البيانات الحالية.
   بيرجع نص الخطأ أو null لو الملف سليم. */
const IMPORT_ARRAY_KEYS=['clients','workers','suppliers','maintenance','sales','quotes','workerPayments','tools','cars','loans','generalExpenses','projects','attendance','docs','docTemplates','contracts','devices','stockItems','stockMoves'];
function validateImportedDB(x){
  if(!x||typeof x!=='object'||Array.isArray(x))return 'الملف مو كائن بيانات';
  if(!Array.isArray(x.clients)||!Array.isArray(x.workers))return 'قائمتا العملاء والعمال ناقصتين';
  for(const k of IMPORT_ARRAY_KEYS){
    if(x[k]!==undefined&&!Array.isArray(x[k]))return 'الحقل "'+k+'" لازم يكون قائمة';
    if(Array.isArray(x[k])&&x[k].some(function(it){return it===null||typeof it!=='object'||Array.isArray(it);}))return 'الحقل "'+k+'" فيه عناصر تالفة';
  }
  if(x.company!==undefined&&(x.company===null||typeof x.company!=='object'||Array.isArray(x.company)))return 'حقل بيانات الشركة تالف';
  return null;
}
async function importData(e){
  const file=e.target.files[0];if(!file)return;
  const inputEl=e.target;
  if(!(await confirmPasswordFor('استيراد / استرداد نسخة احتياطية'))){inputEl.value='';return;}
  const reader=new FileReader();
  reader.onerror=function(){alert('تعذّرت قراءة الملف. بياناتك الحالية ما تغيّرت.');};
  reader.onload=async function(ev){
    let imported;
    try{imported=JSON.parse(ev.target.result);}
    catch(err){alert('الملف مو JSON صالح. بياناتك الحالية ما تغيّرت.');return;}
    const bad=validateImportedDB(imported);
    if(bad){alert('الملف غير صالح: '+bad+'.\nبياناتك الحالية ما تغيّرت.');return;}
    // نسخة احتياطية تلقائية من الوضع الحالي قبل أي استبدال
    try{await forceSnapshotNow();}
    catch(err){
      console.error('Pre-import snapshot failed:',err);
      if(!confirm('تعذّر أخذ نسخة احتياطية سحابية قبل الاستيراد.\nالاستيراد رح يستبدل كل بياناتك الحالية.\nتصدّر نسخة بملف أول؟ اضغط "إلغاء" لإيقاف الاستيراد، أو "موافق" للمتابعة بدون نسخة.'))return;
    }
    const prev=db;
    try{
      db=imported;
      if(db.company&&typeof db.company==='object')db.company.logo=safeLogoSrc(db.company.logo)===db.company.logo?db.company.logo:'';
      normalizeDB();
      if(!db.deviceTypes)db.deviceTypes=defaultData.deviceTypes;
      if(!db.modelNumbers)db.modelNumbers=defaultData.modelNumbers;
      if(!db.workTypes)db.workTypes=defaultData.workTypes;
      if(!db.expenseTypes)db.expenseTypes=defaultData.expenseTypes;
      if(!db.toolTypes)db.toolTypes=defaultData.toolTypes;
      if(!db.carExpenseTypes)db.carExpenseTypes=defaultData.carExpenseTypes;
      if(!db.generalExpenses)db.generalExpenses=[];
      db.suppliers=db.suppliers||[];
      db.suppliers.forEach(s=>{if(!s.purchases)s.purchases=[];});
      saveDB(db);alert('تم الاستيراد بنجاح! (انحفظت نسخة من وضعك السابق على السحابة)');render();
    }catch(err){
      console.error('Import failed, rolled back:',err);
      db=prev;saveLocalOnly(db);
      alert('فشل الاستيراد وتم الرجوع لبياناتك السابقة كاملة.');render();
    }
  };
  reader.readAsText(file);
  inputEl.value='';
}

/* بيانات المورد "أحمد بكور" كانت مكتوبة يدوياً جوّا هالملف (~24 كيلوبايت)،
   وكانت تتحقن بقاعدة بيانات *كل* شركة بتفتح التطبيق — يعني أي شركة جديدة
   بتشوف مورد وفواتير مش إلها. انشالت من الكود، والدالة ضلّت موجودة فاضية
   حتى ما ينكسر أي استدعاء قديم إلها. */
function seedSupplierAhmadBakour(){ /* انشالت — شوف الشرح فوق */ }

let db=loadDB();
normalizeDB();saveLocalOnly(db);
let currentPage='dashboard';

/* T38: خانة ربط بند (مشتريات/مبيعات) بصنف مخزون — بتختفي إذا ما في أصناف */
function invLinkSelect(arr,i,cur){
  const L=(db.stockItems||[]).filter(x=>x.active!==false||x.id===cur);
  if(!L.length)return '';
  return `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;color:var(--text2)"><span>صنف المخزون:</span><select class="form-control" style="width:auto;min-width:170px;padding:3px 8px;font-size:11px" onchange="window.${arr}[${i}].itemId=this.value||undefined"><option value="">— بدون ربط —</option>${L.map(x=>`<option value="${x.id}" ${cur===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>`;
}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
/* ===== الرسوم والضرائب (رسوم جمركية، رسوم إنفاق، ضريبة مالية...) =====
   كل رسم اختياري: بتفعّل خانته وبتختار نسبة % أو مبلغ ثابت. إذا ما تفعّل ما بينحفظ ولا بيظهر.
   بتنحفظ على السجل كـ charges:[{name,mode:'percent'|'fixed',value,amount}] و chargesTotal.
   مقصود: ما بتدخل بإجمالي الفاتورة/الإيراد/الربح (totalPrice/workAmount/totalValue) — بتظهر بالنافذة وبالطباعة بس. */
var CHARGE_DEFAULT_NAMES=['رسوم جمركية','رسوم إنفاق','ضريبة مالية'];
function chargeNames(){
  var names=((db.chargeTypes&&db.chargeTypes.length)?db.chargeTypes:CHARGE_DEFAULT_NAMES).slice();
  ((window._chg&&window._chg.list)||[]).forEach(function(c){if(names.indexOf(c.name)<0)names.push(c.name);});
  return names;
}
function chargeAmount(c,net){var v=+c.value||0;return round2(c.mode==='fixed'?v:(+net||0)*v/100);}
function chargesCompute(list,net){
  var items=(list||[]).filter(function(c){return (+c.value||0)>0;}).map(function(c){
    return {name:c.name,mode:c.mode==='fixed'?'fixed':'percent',value:+c.value,amount:chargeAmount(c,net)};
  });
  return {items:items,total:round2(items.reduce(function(s,c){return s+c.amount;},0))};
}
function chargesInit(rec,kind){
  window._chg={kind:kind,list:((rec&&rec.charges)||[]).map(function(c){return {name:c.name,mode:c.mode==='fixed'?'fixed':'percent',value:c.value};})};
}
function chargesCollect(net){return chargesCompute(window._chg&&window._chg.list,net);}
function chargesChanged(){
  var k=window._chg&&window._chg.kind;
  if(k==='q'&&typeof refreshQuoteTotal==='function')refreshQuoteTotal();
  else if(k==='s'&&typeof refreshSaleTotals==='function')refreshSaleTotals();
  else if(k==='m'&&typeof refreshMaintenanceTotals==='function')refreshMaintenanceTotals();
}
function chargesRowsHTML(){
  var cur=(window._chg&&window._chg.list)||[];
  return chargeNames().map(function(n,i){
    var c=cur.find(function(x){return x.name===n;});
    return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:5px 0">'
      +'<label class="checkbox-label" style="min-width:150px;font-weight:600"><input type="checkbox" '+(c?'checked':'')+' onchange="chargesToggle('+i+',this.checked)"> <span>'+esc(n)+'</span></label>'
      +(c?'<select class="form-control" style="width:120px" onchange="chargesSetMode('+i+',this.value)"><option value="percent" '+(c.mode!=='fixed'?'selected':'')+'>نسبة %</option><option value="fixed" '+(c.mode==='fixed'?'selected':'')+'>مبلغ ثابت</option></select>'
        +'<input type="number" min="0" step="any" class="form-control" style="width:130px" placeholder="'+(c.mode==='fixed'?'المبلغ':'النسبة %')+'" value="'+esc(c.value===undefined||c.value===null?'':c.value)+'" oninput="chargesSetVal('+i+',this.value)">':'')
      +'</div>';
  }).join('');
}
function chargesBlockHTML(){
  return '<div style="margin:0 0 12px;padding:10px 12px;border:1px solid var(--border);border-radius:10px">'
    +'<div style="font-weight:700;font-size:13px;margin-bottom:4px">رسوم وضرائب <span style="font-size:11px;color:var(--text2);font-weight:400">(اختياري — فعّل يلي بدك ياه)</span></div>'
    +'<div id="chg-wrap">'+chargesRowsHTML()+'</div>'
    +'<button type="button" class="btn btn-sm" style="margin-top:4px" onclick="chargesAdd()"><i class="ti ti-plus"></i> رسم آخر</button></div>';
}
function chargesRerender(){var w=document.getElementById('chg-wrap');if(w)w.innerHTML=chargesRowsHTML();}
function chargesToggle(i,on){
  var n=chargeNames()[i];if(n===undefined||!window._chg)return;
  var l=window._chg.list,k=l.findIndex(function(x){return x.name===n;});
  if(on&&k<0)l.push({name:n,mode:'percent',value:''});
  if(!on&&k>=0)l.splice(k,1);
  chargesRerender();chargesChanged();
}
function chargesSetMode(i,mode){
  var n=chargeNames()[i];var c=window._chg&&window._chg.list.find(function(x){return x.name===n;});
  if(c){c.mode=mode==='fixed'?'fixed':'percent';chargesRerender();chargesChanged();}
}
function chargesSetVal(i,v){
  var n=chargeNames()[i];var c=window._chg&&window._chg.list.find(function(x){return x.name===n;});
  if(c){c.value=v;chargesChanged();}
}
function chargesAdd(){
  var n=(prompt('اسم الرسم الجديد (مثال: رسوم بلدية):')||'').trim();
  if(!n)return;
  if(chargeNames().indexOf(n)>=0){alert('هالرسم موجود بالقائمة');return;}
  if(!db.chargeTypes||!db.chargeTypes.length)db.chargeTypes=CHARGE_DEFAULT_NAMES.slice();
  db.chargeTypes.push(n);saveDB(db);
  window._chg.list.push({name:n,mode:'percent',value:''});
  chargesRerender();chargesChanged();
}
/* أسطر الرسوم داخل الملخّص بالنافذة (spans) */
function chargesTotalsHTML(net,curLbl){
  var r=chargesCompute(window._chg&&window._chg.list,net);
  if(!r.items.length)return '';
  return r.items.map(function(c){return '<span>'+esc(c.name)+(c.mode==='percent'?' ('+c.value+'%)':'')+': <b>'+fmt(c.amount)+'</b></span>';}).join('')
    +'<span>الإجمالي مع الرسوم: <b style="color:var(--accent)">'+fmt((+net||0)+r.total)+(curLbl?' '+curLbl:'')+'</b></span>';
}
/* أسطر الرسوم داخل جدول الطباعة (tfoot). base = الرقم يلي منجمّع عليه الرسوم للإجمالي النهائي (الافتراضي = net) */
function chargesPrintRows(rec,net,colCount,conv,tag,base){
  conv=conv||function(x){return x;};tag=tag||'';
  var r=chargesCompute(rec&&rec.charges,net);
  if(!r.items.length)return '';
  var rows=r.items.map(function(c){
    return '<tr style="background:#fff; border-top:1px solid #eee;"><td colspan="'+(colCount-1)+'" style="font-weight:600; font-size:8.5px; text-align:right; padding:4px 6px;">'+esc(c.name)+(c.mode==='percent'?' ('+c.value+'%)':'')+'</td>'
      +'<td style="font-weight:700; font-size:10px; text-align:right; padding:4px 6px;">+'+fmt(conv(c.amount))+tag+'</td></tr>';
  }).join('');
  var b=(base===undefined||base===null)?(+net||0):+base;
  rows+='<tr style="background:#f8f9fa; border-top:1.5px solid #e0e0e0;"><td colspan="'+(colCount-1)+'" style="font-weight:700; font-size:9px; text-align:right; padding:5px 6px;">الإجمالي مع الرسوم</td>'
    +'<td style="font-weight:900; font-size:11px; color:#334155; text-align:right; padding:5px 6px;">'+fmt(conv(b+r.total))+tag+'</td></tr>';
  return rows;
}

function genInvoiceNo(prefix,list){
  let max=0;
  (list||[]).forEach(x=>{
    const n=String(x.invoiceNo||'').match(new RegExp('^'+prefix+'-(\\d+)$'));
    if(n)max=Math.max(max,+n[1]);
  });
  return prefix+'-'+String(max+1).padStart(4,'0');
}

/* T2: تعقيم مصدر الشعار — بنقبل بس صورة raster (png/jpeg/gif/webp) كـ data URL
   أو مسار نسبي داخل images/. أي شي تاني (svg، javascript:، رابط خارجي، علامات تنصيص) بيرجع للشعار الافتراضي. */
function safeLogoSrc(v){
  const def='images/image1.png';
  if(typeof v!=='string'||!v)return def;
  if(/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+\/=]+$/.test(v)&&v.length<=2*1024*1024)return v;
  if(/^images\/[A-Za-z0-9._-]+$/.test(v))return v;
  return def;
}
/* ===== المرحلة 1: أدوات موحّدة للتاريخ المحلي والتقريب والخصم ===== */
// T9: تاريخ محلي بصيغة YYYY-MM-DD. toISOString() بيرجع تاريخ UTC، يعني بين 12 و3 الفجر
// (توقيت الرياض/دمشق) كان بياخد تاريخ مبارح، وأول الشهر كان بيصير آخر يوم بالشهر اللي قبله.
function localISODate(d){
  const dt=(d instanceof Date)?d:new Date(d);
  if(isNaN(dt))return '';
  return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
}
function localToday(){return localISODate(new Date());}
// T19: تقريب مالي لخانتين عشريتين (بيمنع 0.1+0.2=0.30000000000000004 وبيرجع 0 بدل -0)
function round2(x){const n=+x;if(!isFinite(n))return 0;return Math.round((n+(n<0?-Number.EPSILON:Number.EPSILON))*100)/100+0;}
// T6: نسبة الحسم لازم تكون بين 0 و100
function clampDiscountPct(v){const n=+v;if(!isFinite(n))return 0;return Math.min(100,Math.max(0,n));}
// T21: قيمة حركة المحفظة بالدولار بسعر الصرف المحفوظ معها (لو موجود)، وإلا بالسعر الحالي
function walletEntryUSD(e){
  const a=+e.amount||0;
  if((e.currency||'USD')==='USD')return a;
  const r=+e.rate>0?+e.rate:getExchangeRate();
  return a/r;
}
// T21: أي حركة ليرة بدون سعر محفوظ بتاخد سعر الصرف الحالي وقت أول حفظ، وبتتجمّد فيه
function walletStampRates(d){
  const list=(d&&d.wallet&&d.wallet.entries)||[];
  const r=getExchangeRate();
  list.forEach(function(e){if((e.currency||'USD')!=='USD'&&!(+e.rate>0))e.rate=r;});
}
// T23: قيمة الحركة بالدولار بالسنت (عدد صحيح) — كل أرصدة المحفظة وكشف الحساب بتتجمّع منها
// حتى ما يصير فرق سنت بين الرصيد الحالي ونهاية آخر فترة.
function walletEntryCents(e){return Math.round(round2(walletEntryUSD(e))*100);}
function walletSignedCents(e){const c=walletEntryCents(e);return e.type==='income'?c:-c;}

/* ===== T22: مكوّن الفترة الموحّد =====
   نفس المكوّن (شهر سابق/تالي + من–إلى + اختصارات) وبنفس منطق الحدود لكل الصفحات:
   الحدود نصوص تاريخ محلي YYYY-MM-DD ومقارنتها نصّية وشاملة الطرفين (T9)،
   فأول ثانية وآخر ثانية بالشهر و29 شباط بيدخلوا بالفترة الصحيحة بدون أي تحويل UTC.
   الحالة محفوظة بـ window._periods[key] وكل صفحة بتاخد مفتاحها (wallet, dashboard...). */
const PERIOD_MONTHS_AR=['كانون الثاني','شباط','آذار','نيسان','أيار','حزيران','تموز','آب','أيلول','تشرين الأول','تشرين الثاني','كانون الأول'];
const PERIOD_PRESETS=[
  {id:'thisMonth',label:'هالشهر'},
  {id:'lastMonth',label:'الشهر الماضي'},
  {id:'last30',label:'آخر 30 يوم'},
  {id:'last90',label:'آخر 3 شهور'},
  {id:'thisYear',label:'هالسنة'},
  {id:'all',label:'الكل'}
];
function periodParse(s){const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||''));return m?new Date(+m[1],+m[2]-1,+m[3]):null;}
function periodAddDays(iso,n){const d=periodParse(iso);if(!d)return '';d.setDate(d.getDate()+n);return localISODate(d);}
function periodMonthBounds(y,m){
  const a=new Date(y,m,1),b=new Date(y,m+1,0);
  return {from:localISODate(a),to:localISODate(b),y:a.getFullYear(),m:a.getMonth()};
}
function periodMonthLabel(y,m){const d=new Date(y,m,1);return PERIOD_MONTHS_AR[d.getMonth()]+' '+d.getFullYear();}
function periodMonthKey(y,m){const d=new Date(y,m,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
// بيرجع {y,m} لو الفترة بالضبط شهر كامل (من 1 لآخر يوم)، وإلا null
function periodAsFullMonth(from,to){
  const a=periodParse(from),b=periodParse(to);
  if(!a||!b||a.getDate()!==1)return null;
  const mb=periodMonthBounds(a.getFullYear(),a.getMonth());
  return (mb.from===from&&mb.to===to)?{y:mb.y,m:mb.m}:null;
}
function periodInRange(dateVal,from,to){
  if(!from&&!to)return true;
  if(!dateVal)return false;
  const d=String(dateVal).slice(0,10);
  if(from&&d<from)return false;
  if(to&&d>to)return false;
  return true;
}
function periodPresetBounds(id,now){
  now=now||new Date();
  const y=now.getFullYear(),m=now.getMonth(),today=localISODate(now);
  if(id==='thisMonth'){const b=periodMonthBounds(y,m);return {from:b.from,to:b.to};}
  if(id==='lastMonth'){const b=periodMonthBounds(y,m-1);return {from:b.from,to:b.to};}
  if(id==='last30')return {from:periodAddDays(today,-29),to:today};
  if(id==='last90')return {from:periodAddDays(today,-89),to:today};
  if(id==='thisYear')return {from:y+'-01-01',to:y+'-12-31'};
  return {from:null,to:null};
}
// الفترة اللي قبلها بنفس الطول: شهر كامل ← الشهر اللي قبله، سنة ← السنة اللي قبلها، غير هيك ← نفس عدد الأيام
function periodShift(from,to,dir){
  if(!from||!to)return null;
  const fm=periodAsFullMonth(from,to);
  if(fm){const b=periodMonthBounds(fm.y,fm.m+dir);return {from:b.from,to:b.to};}
  const a=periodParse(from),b=periodParse(to);
  if(a.getMonth()===0&&a.getDate()===1&&b.getMonth()===11&&b.getDate()===31&&a.getFullYear()===b.getFullYear()){
    const y=a.getFullYear()+dir;return {from:y+'-01-01',to:y+'-12-31'};
  }
  const n=Math.round((b-a)/86400000)+1;
  return {from:periodAddDays(from,dir*n),to:periodAddDays(to,dir*n)};
}
// تقسيم فترة لأشهر (الأطراف مقصوصة): بيستعملها كشف حساب المحفظة والداشبورد
function periodMonthBuckets(from,to){
  const out=[];
  const a=periodParse(from);
  if(!a||!periodParse(to)||from>to)return out;
  let y=a.getFullYear(),m=a.getMonth();
  while(out.length<600){
    const mb=periodMonthBounds(y,m);
    if(mb.from>to)break;
    const f=mb.from<from?from:mb.from,t=mb.to>to?to:mb.to;
    out.push({key:periodMonthKey(y,m),from:f,to:t,full:(f===mb.from&&t===mb.to),y,m});
    m++;if(m>11){m=0;y++;}
  }
  return out;
}
function periodGet(key,def){
  if(!window._periods)window._periods={};
  if(!window._periods[key]){
    const now=new Date();
    window._periods[key]=Object.assign({mode:'month',y:now.getFullYear(),m:now.getMonth(),preset:'',from:'',to:''},def||{});
  }
  return window._periods[key];
}
function periodResolve(key,def){
  const st=periodGet(key,def);
  let from=null,to=null,label='كل الفترات';
  if(st.mode==='month'){
    const b=periodMonthBounds(st.y,st.m);from=b.from;to=b.to;label=periodMonthLabel(st.y,st.m);
  }else if(st.mode==='preset'&&st.preset!=='all'){
    const b=periodPresetBounds(st.preset);from=b.from;to=b.to;
    const p=PERIOD_PRESETS.find(x=>x.id===st.preset);label=p?p.label:'';
    if(from&&to)label+=' ('+fmtDate(from)+' – '+fmtDate(to)+')';
  }else if(st.mode==='custom'){
    from=st.from||null;to=st.to||null;
    if(from&&to&&from>to){const t=from;from=to;to=t;}
    label=(from?'من '+fmtDate(from):'من البداية')+' '+(to?'إلى '+fmtDate(to):'إلى اليوم');
    if(!from&&!to)label='كل الفترات';
  }
  const fm=(from&&to)?periodAsFullMonth(from,to):null;
  const prev=(from&&to)?periodShift(from,to,-1):null;
  return {mode:st.mode,from,to,label,isAll:!from&&!to,fullMonth:fm,monthKey:fm?periodMonthKey(fm.y,fm.m):'',prev};
}
function periodSetPreset(key,id){
  const st=periodGet(key);
  if(id==='thisMonth'||id==='lastMonth'){
    const b=periodPresetBounds(id);const fm=periodAsFullMonth(b.from,b.to);
    st.mode='month';st.y=fm.y;st.m=fm.m;st.preset='';
  }else{st.mode='preset';st.preset=id;}
}
function periodAct(key,action){
  const st=periodGet(key);
  if(action==='prev'||action==='next'){
    const dir=action==='prev'?-1:1;
    if(st.mode==='month'){const b=periodMonthBounds(st.y,st.m+dir);st.y=b.y;st.m=b.m;}
    else{
      const r=periodResolve(key);
      if(r.from&&r.to){const sh=periodShift(r.from,r.to,dir);st.mode='custom';st.from=sh.from;st.to=sh.to;st.preset='';}
      else{const n=new Date();st.mode='month';st.y=n.getFullYear();st.m=n.getMonth();}
    }
  }
  const cb=window._periodCb&&window._periodCb[key];
  if(typeof cb==='function')cb();
}
function periodPick(key,id){periodSetPreset(key,id);const cb=window._periodCb&&window._periodCb[key];if(typeof cb==='function')cb();}
function periodCustom(key){
  const st=periodGet(key);
  const f=document.getElementById('period-from-'+key),t=document.getElementById('period-to-'+key);
  st.mode='custom';st.preset='';st.from=f?f.value:'';st.to=t?t.value:'';
  const cb=window._periodCb&&window._periodCb[key];
  if(typeof cb==='function')cb();
}
function periodBarHTML(key,onChange,def){
  if(!window._periodCb)window._periodCb={};
  window._periodCb[key]=onChange;
  const r=periodResolve(key,def);
  const st=periodGet(key);
  const shortcuts=PERIOD_PRESETS.map(p=>{
    let on=false;
    if(p.id==='all')on=(r.isAll);
    else if(p.id==='thisMonth'||p.id==='lastMonth'){const b=periodPresetBounds(p.id);on=(r.from===b.from&&r.to===b.to);}
    else on=(st.mode==='preset'&&st.preset===p.id);
    return `<button type="button" class="period-chip ${on?'on':''}" onclick="periodPick('${key}','${p.id}')">${p.label}</button>`;
  }).join('');
  return `<div class="period-bar">
    <div class="period-nav">
      <button type="button" class="btn btn-sm" onclick="periodAct('${key}','prev')" title="الفترة السابقة" aria-label="الفترة السابقة"><i class="ti ti-chevron-right"></i></button>
      <span class="period-label" aria-live="polite">${esc(r.label)}</span>
      <button type="button" class="btn btn-sm" onclick="periodAct('${key}','next')" title="الفترة التالية" aria-label="الفترة التالية"><i class="ti ti-chevron-left"></i></button>
    </div>
    <div class="period-range">
      <label>من <input type="date" class="form-control" id="period-from-${key}" value="${esc(r.from||'')}" onchange="periodCustom('${key}')"></label>
      <label>إلى <input type="date" class="form-control" id="period-to-${key}" value="${esc(r.to||'')}" onchange="periodCustom('${key}')"></label>
    </div>
    <div class="period-chips">${shortcuts}</div>
  </div>`;
}
function esc(v){return String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}

// بيحوّل نص الملاحظات (كل سطر = ملاحظة) لعرض مرقّم تلقائياً (1. 2. 3. ...) بالطباعة.
// - سطر وحدة بس؟ بيرجع كنص عادي بدون ترقيم (ملاحظة وحدة ما بتحتاج رقم).
// - أكتر من سطر؟ بيرجع قائمة مرقّمة، وأي سطر فاضي بينشال.
function formatNotesHTML(raw){
  const lines=String(raw??'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!lines.length)return '';
  if(lines.length===1)return esc(lines[0]);
  return `<ol style="margin:2px 0 0;padding-inline-start:18px;">${lines.map(l=>`<li style="margin-bottom:3px">${esc(l)}</li>`).join('')}</ol>`;
}
function infoTip(text){return `<span class="info-tip" tabindex="0" title="${esc(text)}"><i class="ti ti-info-circle"></i></span>`;}
function projectOptions(selected){
  const list=db.projects||[];
  let extra='';
  if(selected&&!list.some(p=>p.name===selected))extra=`<option value="${esc(selected)}" selected>${esc(selected)} (غير موجود بالقائمة)</option>`;
  return `<option value="">— بدون مشروع —</option>`+extra+list.map(p=>`<option value="${esc(p.name)}" ${p.name===selected?'selected':''}>${esc(p.name)}</option>`).join('');
}
// حقل مشروع قابل للكتابة الحرة (متل حقل اسم العميل بالضبط): بتقدر تختار مشروع موجود أو تكتب اسم جديد وبينضاف تلقائياً عند الحفظ — ما في داعي لتسجيله مسبقاً بلائحة القوائم
function projectInputHTML(id,selected){
  return `<input type="text" class="form-control" id="${id}" list="${id}-list" value="${esc(selected||'')}" placeholder="اكتب اسم المشروع أو اختر من القائمة (اختياري)" autocomplete="off">
  <datalist id="${id}-list">${(db.projects||[]).map(p=>`<option value="${esc(p.name)}"></option>`).join('')}</datalist>`;
}
function findOrCreateProject(name,extra){
  if(!name||!name.trim())return null;
  if(!db.projects)db.projects=[];
  let p=db.projects.find(x=>x.name===name);
  if(!p){
    p={id:uid(),name,status:'جارية',createdDate:localToday(),notes:'',quoteId:'',saleId:'',maintId:'',clientId:'',projectCommissionType:'percent',projectCommissionPercent:0,projectCommissionAmount:0,projectCommissionReferrer:'',projectCommissionPaid:false,projectCommissionPaidDate:''};
    db.projects.push(p);
  }
  Object.keys(extra||{}).forEach(k=>{if(extra[k]!==undefined&&extra[k]!==null&&extra[k]!=='')p[k]=extra[k];});
  return p;
}
function syncItemsToQuote(quoteId,kind,items){
  if(!quoteId)return;
  const q=db.quotes.find(x=>x.id===quoteId);
  if(!q||!q.items)return;
  let changed=false;
  (items||[]).forEach(it=>{
    if(it.qIdx===undefined||it.qIdx===null)return;
    const qi=q.items[it.qIdx];
    if(!qi)return;
    if(kind==='sale'){
      qi.qty=it.qty;qi.price=it.salePrice;qi.cost=it.costPrice;if(it.type)qi.desc=it.type;
    }else{
      qi.qty=it.qty;qi.price=it.price;if(it.type)qi.desc=it.type;
    }
    changed=true;
  });
  if(changed)q._syncedFromExecution=true;
}
/* ===== تشفير كلمات المرور (SHA-256 + salt عشوائي لكل مستخدم) ===== */
async function sha256Hex(str){
  const enc=new TextEncoder().encode(str);
  const buf=await crypto.subtle.digest('SHA-256',enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function genSalt(){return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,'0')).join('');}
async function hashPassword(plain,salt){return sha256Hex(salt+':'+plain);}
async function setUserPassword(u,plain){u.passwordSalt=genSalt();u.passwordHash=await hashPassword(plain,u.passwordSalt);delete u.password;}
async function verifyUserPassword(u,plain){
  if(!u)return false;
  if(u.password!==undefined){
    // ترحيل تلقائي: مستخدم قديم كلمة مروره نص صريح — نتحقق ثم نشفّرها فوراً
    if(u.password===plain){await setUserPassword(u,plain);return true;}
    return false;
  }
  if(!u.passwordSalt||!u.passwordHash)return false;
  const h=await hashPassword(plain,u.passwordSalt);
  return h===u.passwordHash;
}
/* ===== صلاحية عمليات النسخ الاحتياطي/التصدير/الاستيراد/الاستعادة: للمدير دائماً، ولأي مستخدم آخر يفعّلها له المدير من إدارة المستخدمين ===== */
function canDoBackupOps(){
  const u=getCurrentUser();
  return !!(u&&(u.role==='admin'||u.canBackupRestore));
}
/* ===== تأكيد كلمة المرور قبل عمليات حساسة (تصدير / استيراد / استرداد) ===== */
async function confirmPasswordFor(actionLabel){
  const me=getCurrentUser();
  if(!me){alert('يجب تسجيل الدخول أولاً');return false;}
  if(!canDoBackupOps()){alert('ليس لديك صلاحية لتنفيذ هذا الإجراء. راجع المدير لتفعيل هذه الصلاحية من إدارة المستخدمين.');return false;}
  const pass=prompt('لتأكيد "'+actionLabel+'"، أدخل كلمة مرورك (كلمة مرور المستخدم المسجّل دخوله):');
  if(pass===null)return false;
  const ok=await verifyUserPassword(me,pass);
  if(!ok){alert('كلمة المرور غير صحيحة، تم إلغاء العملية.');return false;}
  saveDB(db); // لحفظ أي ترحيل تلقائي لكلمة مرور مشفّرة حديثاً
  return true;
}
/* ===== T28 / T36 / T48: محرّك العقود والعملاء (دوال صرفة بدون واجهة — الواجهة بـ contracts.js و ops.js) ===== */
const CONTRACT_FREQ=[{id:1,label:'شهري'},{id:3,label:'ربع سنوي'},{id:6,label:'نصف سنوي'},{id:12,label:'سنوي'}];
const LEGACY_CONTRACT_TYPES={'شهري':1,'ربع سنوي':3,'نصف سنوي':6,'سنوي':12};
const CONTRACT_STATUS_LABELS={active:'نشط',expired:'منتهي',cancelled:'ملغي'};
const CONTRACT_DEPT_LABELS={'':'غير محدد',security:'سيستم سيكيورتي',network:'سيستم نتورك'};
function _pad2(n){return String(n).padStart(2,'0');}
function _isoParts(iso){const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso||''));return m?{y:+m[1],m:+m[2],d:+m[3]}:null;}
function daysInMonthOf(y,m){return new Date(y,m,0).getDate();}
// إضافة k شهر مع تقصير اليوم لآخر يوم بالشهر (31 كانون2 + شهر = 28 شباط). anchorDay = اليوم الأصلي المطلوب (حتى ما يزحف 31 → 28 → 28)
function addMonthsClamped(iso,k,anchorDay){
  const p=_isoParts(iso);if(!p)return '';
  const day=+anchorDay>0?+anchorDay:p.d;
  const idx=p.y*12+(p.m-1)+(+k||0);
  const y=Math.floor(idx/12),m=idx-y*12+1;
  return y+'-'+_pad2(m)+'-'+_pad2(Math.min(day,daysInMonthOf(y,m)));
}
function addDaysISO(iso,n){
  const p=_isoParts(iso);if(!p)return '';
  return localISODate(new Date(p.y,p.m-1,p.d+(+n||0)));
}
// عدد الأيام من اليوم (بتوقيت الجهاز) لتاريخ معيّن — بدون مشكلة UTC (T9)
function daysUntilISO(iso,todayIso){
  const a=_isoParts(todayIso||localToday()),b=_isoParts(iso);
  if(!a||!b)return null;
  return Math.round((new Date(b.y,b.m-1,b.d)-new Date(a.y,a.m-1,a.d))/86400000);
}
function contractIntervalMonths(c){return +c.intervalMonths>0?+c.intervalMonths:12;}
// موعد الزيارة رقم n = تاريخ بدء العقد + (n × الفترة)، مو تاريخ الإنجاز الفعلي
function contractVisitDate(c,n){return addMonthsClamped(c.startDate,(+n||0)*contractIntervalMonths(c),c.anchorDay);}
// أول موعد زيارة بتاريخ ≥ اليوم (ضمن مدة العقد إن كانت معروفة)
function contractNextVisitAfter(c,todayIso){
  const t=todayIso||localToday(),end=contractEndDate(c);
  for(let n=1;n<=720;n++){const d=contractVisitDate(c,n);if(!d)return '';if(end&&d>end)return '';if(d>=t)return d;}
  return '';
}
// آخر يوم بالعقد؛ مدة 0 = مفتوح (عقد مرحّل مدته غير معروفة)
function contractEndDate(c){
  if(!(+c.durationMonths>0)||!c.startDate)return '';
  return addDaysISO(addMonthsClamped(c.startDate,+c.durationMonths,c.anchorDay),-1);
}
function contractEffectiveStatus(c,todayIso){
  if(c.status==='cancelled')return 'cancelled';
  const e=contractEndDate(c);
  if(c.status==='expired'||(e&&e<(todayIso||localToday())))return 'expired';
  return 'active';
}
function contractNextNumber(d){
  let mx=0;(d.contracts||[]).forEach(function(c){const m=/(\d+)\s*$/.exec(c.number||'');if(m)mx=Math.max(mx,+m[1]);});
  return 'CT-'+String(mx+1).padStart(4,'0');
}
function contractPayments(c){return Array.isArray(c.payments)?c.payments:[];}
function contractScheduledTotal(c){return round2(contractPayments(c).reduce(function(s,p){return s+(+p.amount||0);},0));}
// الفرق بين قيمة العقد ومجموع الدفعات المجدولة (0 = متطابق). غير صفر → تحذير والمستخدم بيقرر
function contractScheduleDiff(c){return round2((+c.value||0)-contractScheduledTotal(c));}
function newContractPayment(c,dueDate,amount,note){
  return {id:uid(),dueDate:dueDate||'',amount:round2(amount),currency:c.currency==='SYP'?'SYP':'USD',paidAmount:0,paidDate:'',rate:null,note:note||''};
}
// mode 'single' = مبلغ سنوي ثابت بدفعة وحدة بتاريخ البدء، 'equal' = n دفعات متساوية كل stepMonths والأخيرة بتمتص الكسور (المجموع = قيمة العقد بالضبط)
function contractGenerateSchedule(c,mode,opts){
  const v=round2(+c.value||0);
  if(mode==='single')return [newContractPayment(c,c.startDate,v)];
  const n=Math.max(1,Math.floor(+(opts&&opts.count)||1)),step=Math.max(1,Math.floor(+(opts&&opts.stepMonths)||1));
  const base=Math.floor(v/n*100)/100,out=[];
  for(let i=0;i<n;i++){
    const amt=i===n-1?round2(v-base*(n-1)):base;
    out.push(newContractPayment(c,addMonthsClamped(c.startDate,i*step,c.anchorDay),amt));
  }
  return out;
}
function contractPaymentRemaining(p){return Math.max(0,round2((+p.amount||0)-(+p.paidAmount||0)));}
function contractPaymentState(p,todayIso){
  const t=todayIso||localToday();
  if(contractPaymentRemaining(p)<=0.004&&(+p.amount||0)>0)return 'paid';
  if(!p.dueDate)return 'upcoming';
  if(p.dueDate<t)return 'overdue';
  if(p.dueDate===t)return 'due';
  return 'upcoming';
}
// المستحق اليوم = الدفعات يلي تاريخها ≤ اليوم · المتأخر = مستحق وغير مسدد (تاريخ قبل اليوم) · المتبقي على العميل = المستحق − المسدد
function contractFinancials(c,todayIso){
  const t=todayIso||localToday();
  let scheduled=0,dueSoFar=0,paid=0,remainingDue=0,overdue=0,overdueCount=0;
  contractPayments(c).forEach(function(p){
    const a=+p.amount||0,r=contractPaymentRemaining(p);
    scheduled+=a;paid+=(+p.paidAmount||0);
    if(p.dueDate&&p.dueDate<=t){dueSoFar+=a;remainingDue+=r;}
    if(p.dueDate&&p.dueDate<t&&r>0.004){overdue+=r;overdueCount++;}
  });
  return {value:round2(+c.value||0),scheduled:round2(scheduled),diff:contractScheduleDiff(c),dueSoFar:round2(dueSoFar),paid:round2(paid),remainingDue:round2(remainingDue),overdue:round2(overdue),overdueCount:overdueCount,
    collectedPct:scheduled>0?Math.round(paid/scheduled*100):0};
}
// مكافئ الدولار: بسعر الصرف المحفوظ وقت الدفع، وإلا بالسعر الحالي (T21)
function contractPaymentUSD(p,amount){
  const a=amount===undefined?(+p.amount||0):(+amount||0);
  if((p.currency||'USD')==='USD')return a;
  const r=+p.rate>0?+p.rate:getExchangeRate();
  return a/r;
}
// تسجيل دفعة: بيرفض المبلغ يلي بيتجاوز المتبقي (نفس مبدأ T5) وبيحفظ سعر الصرف وقتها
function contractRegisterPayment(p,amount,dateIso,rate){
  const a=round2(amount),rem=contractPaymentRemaining(p);
  if(!(a>0))return {ok:false,error:'المبلغ لازم يكون أكبر من صفر'};
  if(a>rem+0.005)return {ok:false,error:'المبلغ أكبر من المتبقي ('+rem+')'};
  p.paidAmount=round2((+p.paidAmount||0)+a);
  p.paidDate=dateIso||localToday();
  p.rate=(+rate>0)?+rate:getExchangeRate();
  return {ok:true};
}
// ترحيل العقود القديمة (حقلا نوع العقد وتاريخ الزيارة القادمة على بطاقة العميل) لكيان عقد حقيقي بنفس الموعد.
// القيمة والعملة والمدة مو معروفة من البيانات القديمة → needsReview=true لحد ما يراجعها المستخدم.
function migrateClientContracts(d){
  d.contracts=d.contracts||[];
  d.migrations=d.migrations||{};
  if(!d.migrations.contractsFromClients){
    (d.clients||[]).forEach(function(c){
      const months=LEGACY_CONTRACT_TYPES[c.contractType];
      if(!months)return;
      if(d.contracts.some(function(x){return x.legacyClientId===c.id;}))return;
      const next=_isoParts(c.nextVisitDate)?String(c.nextVisitDate).slice(0,10):'';
      const ct={id:uid(),number:contractNextNumber(d),clientId:c.id,branchId:'',title:'عقد صيانة '+c.contractType+' (مرحّل)',
        startDate:next?addMonthsClamped(next,-months):localToday(),anchorDay:next?_isoParts(next).d:0,
        durationMonths:0,intervalMonths:months,value:0,currency:'USD',department:'',status:'active',
        nextVisitDate:next,payments:[],notes:'مرحّل تلقائياً من بطاقة العميل. القيمة والعملة والمدة بحاجة لمراجعتك.',
        legacyClientId:c.id,legacyMigrated:true,needsReview:true,createdAt:new Date().toISOString()};
      d.contracts.push(ct);
    });
    d.migrations.contractsFromClients=true;
  }
  // لو جهازين رحّلوا بنفس الوقت: منحتفظ بعقد وحد لكل عميل (الأكتر اكتمالاً، ثم أصغر id حتى يختار الجهازين نفس العقد)
  const by={};
  d.contracts.forEach(function(c){if(c.legacyClientId&&c.legacyMigrated)(by[c.legacyClientId]=by[c.legacyClientId]||[]).push(c);});
  const drop=new Set();
  Object.keys(by).forEach(function(k){
    const g=by[k];if(g.length<2)return;
    const score=function(c){return (c.payments||[]).length*10+(+c.value>0?5:0)+(c.needsReview?0:3);};
    g.sort(function(a,b){return score(b)-score(a)||(a.id<b.id?-1:1);});
    g.slice(1).forEach(function(c){drop.add(c.id);});
  });
  if(drop.size)d.contracts=d.contracts.filter(function(c){return !drop.has(c.id);});
}

/* ===== T29 / T30 / T49 / T31: محرّك الزيارات الدورية (دوال صرفة؛ الواجهة بـ contracts.js) =====
   كل عقد عنده contract.visits. الموعد = تاريخ بدء العقد + (رقم الزيارة × الفترة) (slotDate) — مو تاريخ الإنجاز الفعلي،
   فتأخير زيارة ما بيزحّف الجدول. بنحافظ دايماً على 3 زيارات قادمة (مجدولة/جارية/مؤجلة) ضمن مدة العقد؛ لما وحدة بتنجز بتتولّد التالية.
   حقلين منفصلين بالزيارة: performedBy (مين نفّذ — الفني) و recordedBy (مين دخّلها بالنظام) — ليدعم "أنت بتسجّل بالنيابة" (T49). */
const VISIT_STATUS_LABELS={scheduled:'مجدولة',inprogress:'جارية',done:'منجزة',cancelled:'ملغاة',postponed:'مؤجلة',missed:'فائتة'};
const VISIT_OPEN=['scheduled','inprogress','postponed'];
const VISIT_KEEP_AHEAD=3;
const DEFAULT_VISIT_CHECKLIST=['فحص الكاميرات وزوايا الرؤية','تنظيف العدسات والأغطية','فحص جهاز التسجيل (DVR/NVR) والأقراص','مراجعة التسجيلات والتاريخ والوقت','فحص مصادر الطاقة والبطاريات','فحص الكابلات والتوصيلات','فحص الشبكة والسويتش والراوتر'];
function contractVisits(c){return Array.isArray(c&&c.visits)?c.visits:[];}
function visitDate(v){return (v&&(v.date||v.slotDate))||'';}
// الحالة الفعلية: مجدولة/مؤجلة فات موعدها = «فائتة» (بدون ما نخزّنها — بتتحسب بتاريخ الجهاز المحلي، مو UTC)
function visitEffectiveStatus(v,todayIso){
  const t=todayIso||localToday();
  if((v.status==='scheduled'||v.status==='postponed')&&visitDate(v)&&visitDate(v)<t)return 'missed';
  return v.status;
}
function _visitRank(v){return v.status==='done'?3:v.status==='inprogress'?2:v.status==='cancelled'?0:1;}
function newVisit(c,n){
  const sd=contractVisitDate(c,n);
  return {id:uid(),n:n,slotDate:sd,date:sd,status:'scheduled',performedBy:'',performedByName:'',recordedBy:'',recordedByName:'',
    wage:0,wageCurrency:c.currency==='SYP'?'SYP':'USD',hours:0,startedAt:'',completedAt:'',checklist:null,notes:'',expenses:[],doneDate:'',maintenanceId:'',signature:'',signedBy:'',createdAt:new Date().toISOString()};
}
// يضمن 3 زيارات قادمة. بيرجّع عدد المضاف. آمن للتكرار (ما بيكرر رقم زيارة موجود).
function contractEnsureVisits(c,todayIso){
  if(!c)return 0;
  const t=todayIso||localToday();
  c.visits=Array.isArray(c.visits)?c.visits:[];
  // دمج مكرر (جهازين ولّدوا نفس الرقم): منحتفظ بالأكثر تقدماً (منجزة > جارية > غيرها)، وعند التعادل أصغر id
  const byN={};
  c.visits.forEach(function(v){(byN[v.n]=byN[v.n]||[]).push(v);});
  const drop=new Set();
  Object.keys(byN).forEach(function(k){
    const g=byN[k];if(g.length<2)return;
    g.sort(function(a,b){return _visitRank(b)-_visitRank(a)||(a.id<b.id?-1:1);});
    g.slice(1).forEach(function(v){drop.add(v);});
  });
  if(drop.size)c.visits=c.visits.filter(function(v){return !drop.has(v);});
  let added=0;
  if(contractEffectiveStatus(c,t)==='active'){
    const end=contractEndDate(c);
    let n=c.visits.reduce(function(m,v){return Math.max(m,+v.n||0);},0);
    if(!n){
      // أول توليد: أول رقم موعده ≥ nextVisitDate المحفوظ (أو ≥ اليوم) — ما منرجع نبني زيارات قديمة ما منعرف إذا انعملت
      const base=c.nextVisitDate||t;let k=1;
      while(k<720&&contractVisitDate(c,k)<base)k++;
      n=k-1;
    }
    const open=function(){return c.visits.filter(function(v){return VISIT_OPEN.indexOf(v.status)>=0;}).length;};
    while(open()<VISIT_KEEP_AHEAD&&n<720){
      n++;const d=contractVisitDate(c,n);
      if(!d)break;if(end&&d>end)break;
      c.visits.push(newVisit(c,n));added++;
    }
  }
  c.visits.sort(function(a,b){return (+a.n||0)-(+b.n||0);});
  const nx=c.visits.filter(function(v){return VISIT_OPEN.indexOf(v.status)>=0;}).map(visitDate).filter(Boolean).sort()[0];
  c.nextVisitDate=nx||'';
  return added;
}
function ensureAllContractVisits(d){(d.contracts||[]).forEach(function(c){try{contractEnsureVisits(c);}catch(e){console.error('visit generation failed',e);}});}
// لما تتغيّر تواريخ العقد: بنحذف الزيارات المجدولة «النظيفة» (بدون فني/تقدم) وبنعيد توليدها على الجدول الجديد؛ الباقي بيضل
function contractResyncVisits(c){
  c.visits=contractVisits(c).filter(function(v){
    const touched=v.status!=='scheduled'||v.performedBy||(v.checklist&&v.checklist.some(function(x){return x.done;}))||v.notes||(v.expenses||[]).length||v.signature||v.date!==v.slotDate;
    return touched;
  });
  c.nextVisitDate='';
  contractEnsureVisits(c);
}
function visitChecklistTemplate(){
  const s=(db.settings&&Array.isArray(db.settings.visitChecklist)&&db.settings.visitChecklist.length)?db.settings.visitChecklist:DEFAULT_VISIT_CHECKLIST;
  return s.map(function(t){return {t:String(t),done:false};});
}
function visitEnsureChecklist(v){if(!Array.isArray(v.checklist))v.checklist=visitChecklistTemplate();return v.checklist;}
function lastWorkerWage(workerId){
  const ms=(db.maintenance||[]);
  for(let i=ms.length-1;i>=0;i--){
    const w=(ms[i].workers||[]).slice().reverse().find(function(x){return x.workerId===workerId&&+x.wage>0;});
    if(w)return {wage:+w.wage,currency:w.currency||ms[i].workersCurrency||'SYP'};
  }
  return null;
}
function _curUserRef(){const u=getCurrentUser();return u?{id:u.id,name:u.username||u.name||''}:{id:'',name:''};}
function visitSetTechnician(v,workerId){
  v.performedBy=workerId||'';
  const w=workerId?(db.workers||[]).find(function(x){return x.id===workerId;}):null;
  v.performedByName=w?w.name:'';
  if(w&&!(+v.wage>0)){const l=lastWorkerWage(workerId);if(l){v.wage=l.wage;v.wageCurrency=l.currency;}}
}
// تقدير الساعات من وقت البدء للإنجاز: فقط لو بنفس اليوم المحلي وأقل من 14 ساعة، مقرّبة لربع ساعة (حد أدنى ربع ساعة)
function visitAutoHours(startIso,endIso){
  const a=new Date(startIso),b=new Date(endIso);
  if(isNaN(a)||isNaN(b)||b<=a)return 0;
  if(localISODate(a)!==localISODate(b))return 0;
  const h=(b-a)/3600000;
  if(h>14)return 0;
  return Math.max(0.25,Math.round(h*4)/4);
}
function visitStart(c,v){
  if(VISIT_OPEN.indexOf(v.status)<0)return {ok:false,error:'ما بتنفع البدء من هالحالة'};
  v.status='inprogress';v.date=localToday();if(!v.startedAt)v.startedAt=new Date().toISOString();
  const u=_curUserRef();v.recordedBy=u.id;v.recordedByName=u.name;
  contractEnsureVisits(c);
  return {ok:true};
}
// تأجيل: الموعد الفعلي بيتغيّر، بس slotDate (موعد الجدول) بيضل → باقي الجدول ما بيتحرك
function visitPostpone(c,v,newDate){
  if(VISIT_OPEN.indexOf(v.status)<0)return {ok:false,error:'ما بتنفع التأجيل من هالحالة'};
  if(!_isoParts(newDate))return {ok:false,error:'تاريخ غير صحيح'};
  v.status='postponed';v.date=String(newDate).slice(0,10);
  contractEnsureVisits(c);return {ok:true};
}
function visitBackToScheduled(c,v){
  if(v.status!=='postponed'&&v.status!=='inprogress')return {ok:false,error:'ما بتنفع'};
  v.status='scheduled';v.date=v.slotDate;contractEnsureVisits(c);return {ok:true};
}
function visitCancel(c,v){
  if(v.status==='done')return {ok:false,error:'الزيارة المنجزة ما بتنلغي (أعد فتحها أول)'};
  v.status='cancelled';contractEnsureVisits(c);return {ok:true};
}
// بطاقة العمل (سجل الصيانة الحالي) الناتجة عن زيارة: أجور الفني + مصاريف الزيارة. الدخل 0 هون — إيراد العقد بيجي من دفعاته (T34).
function visitBuildWorkCard(c,v){
  const doneDate=v.doneDate||localToday();
  const cl=(db.clients||[]).find(function(x){return x.id===c.clientId;});
  const br=cl&&(cl.branchDetails||[]).find(function(b){return b.id===c.branchId;});
  const cur=v.wageCurrency==='USD'?'USD':'SYP';
  const workers=[];
  if(v.performedBy&&+v.wage>0)workers.push({workerId:v.performedBy,workerName:v.performedByName||getWorkerNameRaw(v.performedBy),date:doneDate,wage:round2(+v.wage),currency:cur,days:1,paid:false,paidDate:''});
  const expenses=(v.expenses||[]).filter(function(e){return +e.amount>0;}).map(function(e){return {type:e.type||'مصاريف زيارة صيانة',amount:round2(+e.amount),currency:e.currency==='USD'?'USD':'SYP',date:doneDate,note:e.note||''};});
  const done=(v.checklist||[]).filter(function(x){return x.done;}).map(function(x){return x.t;});
  const notes='زيارة دورية رقم '+v.n+' — عقد '+(c.number||'')+(v.notes?'\n'+v.notes:'')+(v.recordedByName&&v.recordedBy!==v.performedBy?'\n(سجّلها: '+v.recordedByName+')':'');
  return {id:uid(),clientId:c.clientId,clientNameFree:'',branch:br?br.name:'',projectName:'',startDate:doneDate,endDate:doneDate,status:'مكتملة',workKind:'periodic',
    paidAmount:0,payments:[],notes:notes,invoiceNo:'',workDesc:done.length?done.join('\n'):'زيارة صيانة دورية',workTypes:['صيانة دورية'],workItems:[],workAmount:0,
    currency:c.currency==='SYP'?'SYP':'USD',workers:workers,expenses:expenses,cars:[],advances:[],workersCurrency:cur,expensesCurrency:expenses.length?expenses[0].currency:'SYP',carsCurrency:'SYP',
    discount:0,commissionType:'percent',commissionPercent:0,commissionAmount:0,commissionSettlement:false,deliveryStatus:'معلقة',deliveryDate:'',quoteId:'',
    exchangeRateAtEntry:getExchangeRate(),contractId:c.id,visitId:v.id};
}
// إنجاز: بينشئ بطاقة عمل واحدة (ما بتتكرر لو انضغط مرتين)، وبيولّد الزيارة التالية
function visitComplete(c,v,opts){
  opts=opts||{};
  if(v.status==='done')return {ok:false,error:'الزيارة منجزة مسبقاً'};
  if(v.status==='cancelled')return {ok:false,error:'الزيارة ملغاة'};
  const doneDate=opts.doneDate||localToday();
  if(!_isoParts(doneDate))return {ok:false,error:'تاريخ الإنجاز غير صحيح'};
  if(opts.performedBy!==undefined)visitSetTechnician(v,opts.performedBy);
  if(opts.wage!==undefined)v.wage=Math.max(0,round2(+opts.wage||0));
  if(opts.wageCurrency)v.wageCurrency=opts.wageCurrency==='USD'?'USD':'SYP';
  v.doneDate=String(doneDate).slice(0,10);
  v.completedAt=new Date().toISOString();
  // T40: ساعات الزيارة — بتنكتب يدوياً بورقة الزيارة (أو opts.hours)؛ ولو فاضية وفي وقت بدء بنفس اليوم بتتقدّر تلقائياً
  if(opts.hours!==undefined)v.hours=Math.max(0,round2(+opts.hours||0));
  else if(!(+v.hours>0)&&v.startedAt){const ah=visitAutoHours(v.startedAt,v.completedAt);if(ah>0){v.hours=ah;v.hoursAuto=true;}}
  const u=_curUserRef();v.recordedBy=u.id;v.recordedByName=u.name;
  db.maintenance=db.maintenance||[];
  let card=v.maintenanceId?db.maintenance.find(function(m){return m.id===v.maintenanceId;}):null;
  if(!card){card=visitBuildWorkCard(c,v);db.maintenance.push(card);v.maintenanceId=card.id;}
  v.status='done';
  contractEnsureVisits(c);
  return {ok:true,card:card};
}
// إعادة فتح زيارة منجزة: بيحذف بطاقة العمل المولّدة إذا ما عليها دفعات
function visitReopen(c,v){
  if(v.status!=='done')return {ok:false,error:'الزيارة مو منجزة'};
  const card=v.maintenanceId?(db.maintenance||[]).find(function(m){return m.id===v.maintenanceId;}):null;
  if(card&&((+card.paidAmount||0)>0||(card.payments||[]).length||(card.workers||[]).some(function(w){return w.paid;})))return {ok:false,error:'بطاقة العمل عليها دفعات/أجور مسددة — عدّلها من صفحة الأعمال'};
  if(card)db.maintenance=db.maintenance.filter(function(m){return m.id!==card.id;});
  v.status='scheduled';v.date=v.slotDate;v.doneDate='';v.maintenanceId='';
  contractEnsureVisits(c);return {ok:true};
}
// لوحة «اليوم» (T30): بتوزّع الزيارات المفتوحة: اليوم (وأي زيارة جارية) / متأخرة / هالأسبوع (٦ أيام جاية)، مرتبة حسب الفني ثم المنطقة
function visitArea(c){
  const cl=(db.clients||[]).find(function(x){return x.id===c.clientId;})||{};
  const b=(cl.branchDetails||[]).find(function(x){return x.id===c.branchId;});
  return String((b&&b.address)||cl.address||'').trim();
}
/* T43: الفني المقيّد (ownVisitsOnly) ما بيشوف إلا زياراته — بيتطبّق مركزياً على كل من يستدعي لوحة/تقويم الزيارات */
function permEnforced(){return !!(db&&db.security&&db.security.enabled&&Array.isArray(db.security.users)&&db.security.users.length>0);}
function permForcedTech(){
  if(!permEnforced())return '';
  const u=getCurrentUser();
  if(!u||u.role==='admin'||!u.ownVisitsOnly)return '';
  return u.workerId||'__none__'; // مقيّد بدون ربط بفني = ما بيشوف شي
}
function permOwnsVisit(v){const f=permForcedTech();return !f||(!!v&&v.performedBy===f);}
function visitsBoard(d,todayIso,techId){
  { const _f=permForcedTech(); if(_f)techId=_f; }
  const t=todayIso||localToday(),weekEnd=addDaysISO(t,6);
  const out={today:[],overdue:[],week:[]};
  (d.contracts||[]).forEach(function(c){
    if(c.status==='cancelled')return;
    contractVisits(c).forEach(function(v){
      if(VISIT_OPEN.indexOf(v.status)<0)return;
      if(techId&&v.performedBy!==techId)return;
      const dt=visitDate(v);if(!dt)return;
      const item={contract:c,visit:v,date:dt,tech:v.performedByName||'',area:visitArea(c)};
      if(v.status==='inprogress'||dt===t)out.today.push(item);
      else if(dt<t)out.overdue.push(item);
      else if(dt<=weekEnd)out.week.push(item);
    });
  });
  const cmp=function(a,b){
    if(!a.tech!==!b.tech)return a.tech?-1:1;               // اللي ما إله فني بالآخر
    return a.tech.localeCompare(b.tech,'ar')||a.area.localeCompare(b.area,'ar')||(a.date<b.date?-1:a.date>b.date?1:0);
  };
  out.today.sort(cmp);out.overdue.sort(cmp);out.week.sort(cmp);
  return out;
}

/* ===== T33 / T34 / T35: الأجهزة والضمان · الفوترة الدورية وربحية العقد وتنبيه التجديد · التقويم وحمل الفنيين وتذكير واتساب =====
   دوال صرفة (بدون واجهة) — الواجهة بـ contracts.js وعليها الاختبارات بـ tests/contracts-part3.test.js. كل التواريخ محلية (بدون UTC). */

/* ----- T33: الأجهزة والضمان — db.devices = [{id,clientId,branchId,type,model,serial,location,installDate,warrantyMonths,warrantyEnd,notes}]
   مصفوفة مستقلة بمعرّفات (جاهزة للنقل لجدول بقاعدة البيانات لاحقاً T18). نهاية الضمان: إن انكتبت يدوياً بتفوز، وإلا = تاريخ التركيب + أشهر الضمان − يوم. ----- */
const WARRANTY_SOON_DAYS=30;
// تاريخ حقيقي بالتقويم (شهر 1-12 واليوم ضمن الشهر) — _isoParts لحاله بيقبل 2027-13-45 لأنو بيفحص الشكل بس
function isValidISODate(x){const p=_isoParts(x);return !!p&&p.m>=1&&p.m<=12&&p.d>=1&&p.d<=daysInMonthOf(p.y,p.m);}
function devicesAll(d){d.devices=Array.isArray(d.devices)?d.devices:[];return d.devices;}
function deviceWarrantyEnd(dv){
  if(!dv)return '';
  if(isValidISODate(dv.warrantyEnd))return String(dv.warrantyEnd).slice(0,10);
  if(isValidISODate(dv.installDate)&&+dv.warrantyMonths>0)return addDaysISO(addMonthsClamped(String(dv.installDate).slice(0,10),Math.floor(+dv.warrantyMonths)),-1);
  return '';
}
// state: none (ما في معلومات ضمان) | active | expiring (≤30 يوم) | expired
function deviceWarrantyStatus(dv,todayIso){
  const end=deviceWarrantyEnd(dv);
  if(!end)return {state:'none',end:'',days:null};
  const days=daysUntilISO(end,todayIso||localToday());
  return {state:days<0?'expired':days<=WARRANTY_SOON_DAYS?'expiring':'active',end:end,days:days};
}
function newDevice(f){
  f=f||{};
  const iso=function(x){return isValidISODate(x)?String(x).slice(0,10):'';};
  return {id:f.id||uid(),clientId:String(f.clientId||''),branchId:String(f.branchId||''),type:String(f.type||'').trim(),model:String(f.model||'').trim(),
    serial:String(f.serial||'').trim(),location:String(f.location||'').trim(),installDate:iso(f.installDate),
    warrantyMonths:Math.max(0,Math.floor(+f.warrantyMonths||0)),warrantyEnd:iso(f.warrantyEnd),notes:String(f.notes||''),createdAt:f.createdAt||new Date().toISOString()};
}
function devicesOfBranch(d,clientId,branchId){
  return devicesAll(d).filter(function(x){return x.clientId===clientId&&(!branchId||x.branchId===branchId);});
}
// أجهزة ضمانها بينتهي خلال n يوم (أو انتهى) مرتبة بالأقرب
function devicesWarrantyAlerts(d,todayIso,soonDays){
  const t=todayIso||localToday(),lim=soonDays===undefined?WARRANTY_SOON_DAYS:soonDays;
  return devicesAll(d).map(function(dv){return {device:dv,w:deviceWarrantyStatus(dv,t)};})
    .filter(function(x){return x.w.state!=='none'&&x.w.days<=lim;}).sort(function(a,b){return a.w.days-b.w.days;});
}

/* ----- T34-أ: الفوترة الدورية — فاتورة لكل دفعة مجدولة. الفاتورة بتنحفظ على الدفعة نفسها (invoiceNo/invoiceDate)، مو بسجل المبيعات،
   حتى ما يتعد الإيراد مرتين (إيراد العقد بيجي من دفعاته). الضغط مرتين = نفس الفاتورة. ----- */
function contractNextInvoiceNo(d){
  let mx=0;
  (d.contracts||[]).forEach(function(c){contractPayments(c).forEach(function(p){const m=/^CTI-(\d+)$/.exec(String(p.invoiceNo||''));if(m)mx=Math.max(mx,+m[1]);});});
  return 'CTI-'+String(mx+1).padStart(4,'0');
}
function contractBillPayment(d,c,p,todayIso){
  if(!c||!p)return {ok:false,error:'دفعة غير موجودة'};
  if(p.invoiceNo)return {ok:true,existing:true,invoiceNo:p.invoiceNo};      // ضغطتين = فاتورة وحدة
  if(c.status==='cancelled')return {ok:false,error:'العقد ملغي'};
  if(!(+p.amount>0))return {ok:false,error:'مبلغ الدفعة لازم يكون أكبر من صفر'};
  p.invoiceNo=contractNextInvoiceNo(d);
  p.invoiceDate=todayIso||localToday();
  return {ok:true,existing:false,invoiceNo:p.invoiceNo};
}
// دفعات مستحقة (تاريخها ≤ اليوم) وما انفوترت، بترتيب الاستحقاق
function contractPaymentsToBill(c,todayIso){
  const t=todayIso||localToday();
  return contractPayments(c).filter(function(p){return !p.invoiceNo&&p.dueDate&&p.dueDate<=t&&(+p.amount||0)>0;}).sort(function(a,b){return String(a.dueDate).localeCompare(String(b.dueDate));});
}
function contractBillDue(d,c,todayIso){
  if(c&&c.status==='cancelled')return {ok:false,error:'العقد ملغي',count:0,invoices:[]};
  const out=[];
  contractPaymentsToBill(c,todayIso).forEach(function(p){const r=contractBillPayment(d,c,p,todayIso);if(r.ok&&!r.existing)out.push(r.invoiceNo);});
  return {ok:true,count:out.length,invoices:out};
}

/* ----- T34-ب: ربحية العقد (بالدولار).
   الإيراد المعترف = ما انجمع فعلياً (قرار مفتوح #1: افتراضياً حسب التحصيل مثل التطبيق اليوم) · التكلفة = أجور + مصاريف + سيارات بطاقات عمل الزيارات المنجزة
   · العمولة = نسبة (c.commissionPercent) من الإيراد المعترف · الربح = الإيراد المعترف − التكلفة − العمولة.
   fullProfit = الربح لو انجمعت كل القيمة (نفس تكلفة الزيارات المنجزة) — بنعرضه جنب «نسبة التحصيل» حتى ما يتفسّر الرقم غلط. ----- */
function contractVisitCostUSD(c,v){
  const card=(v.maintenanceId&&(db.maintenance||[]).find(function(m){return m.id===v.maintenanceId;}))||visitBuildWorkCard(c,v);
  const cur=card.currency==='SYP'?'SYP':'USD';
  return toUSDHist(getMaintenanceWages(card)+getMaintenanceExpenses(card),cur,card);
}
function contractProfit(c,todayIso){
  let paidUSD=0,scheduledUSD=0;
  contractPayments(c).forEach(function(p){paidUSD+=contractPaymentUSD(p,+p.paidAmount||0);scheduledUSD+=contractPaymentUSD(p);});
  const valueUSD=toUSD(+c.value||0,c.currency==='SYP'?'SYP':'USD');
  let costUSD=0,done=0;
  contractVisits(c).forEach(function(v){if(v.status==='done'){done++;costUSD+=contractVisitCostUSD(c,v);}});
  const pct=Math.max(0,+c.commissionPercent||0);
  const commission=paidUSD*pct/100;
  const profit=paidUSD-costUSD-commission;
  const fullProfit=valueUSD-costUSD-valueUSD*pct/100;
  return {revenueUSD:round2(paidUSD),scheduledUSD:round2(scheduledUSD),valueUSD:round2(valueUSD),costUSD:round2(costUSD),commissionUSD:round2(commission),
    profitUSD:round2(profit),fullProfitUSD:round2(fullProfit),marginPct:valueUSD>0?round2(fullProfit/valueUSD*100):null,
    collectedPct:scheduledUSD>0?Math.round(paidUSD/scheduledUSD*100):0,visitsDone:done};
}

/* ----- T34-ج: تنبيه التجديد 60 / 30 / 7 يوم + تجديد العقد (مرة وحدة) ----- */
const CONTRACT_RENEW_STAGES=[7,30,60];
function contractRenewalInfo(c,todayIso){
  if(!c||c.status==='cancelled')return null;
  const end=contractEndDate(c);
  if(!end)return null;                                  // مدة مفتوحة (مرحّل) — ما في تاريخ انتهاء
  const days=daysUntilISO(end,todayIso||localToday());
  if(days<0)return {end:end,days:days,stage:'expired'};
  const st=CONTRACT_RENEW_STAGES.find(function(x){return days<=x;});
  return st?{end:end,days:days,stage:st}:null;
}
function contractRenewalAlerts(d,todayIso){
  return (d.contracts||[]).filter(function(c){return !c.renewedToId;}).map(function(c){return {contract:c,info:contractRenewalInfo(c,todayIso)};})
    .filter(function(x){return x.info&&(x.info.stage!=='expired'||x.info.days>=-30);}).sort(function(a,b){return a.info.days-b.info.days;});
}
// عقد جديد يبدأ باليوم التالي لنهاية العقد، بنفس الشروط (بدون دفعات — الجدول بيتحدد من جديد). مرة وحدة: الضغط التاني بيرجّع نفس العقد.
function contractRenew(d,c){
  if(!c)return {ok:false,error:'عقد غير موجود'};
  if(c.renewedToId){const ex=(d.contracts||[]).find(function(x){return x.id===c.renewedToId;});if(ex)return {ok:true,existing:true,contract:ex};}
  const end=contractEndDate(c);
  if(!end)return {ok:false,error:'العقد مدته مفتوحة — حدّد مدة وتاريخ انتهاء أول'};
  const start=addDaysISO(end,1);
  const anchor=+c.anchorDay>0?+c.anchorDay:_isoParts(c.startDate).d;
  const nc={id:uid(),number:contractNextNumber(d),clientId:c.clientId,branchId:c.branchId||'',title:c.title||'',startDate:start,anchorDay:anchor,
    durationMonths:+c.durationMonths||0,intervalMonths:contractIntervalMonths(c),value:+c.value||0,currency:c.currency==='SYP'?'SYP':'USD',department:c.department||'',
    commissionPercent:+c.commissionPercent||0,status:'active',nextVisitDate:'',payments:[],visits:[],notes:'تجديد للعقد '+(c.number||''),renewedFromId:c.id,createdAt:new Date().toISOString()};
  d.contracts.push(nc);
  c.renewedToId=nc.id;
  contractEnsureVisits(nc,start);
  return {ok:true,existing:false,contract:nc};
}

/* ----- T35: تقويم الزيارات · حمل الفنيين · تذكير واتساب ----- */
const CAL_WEEK_START=6;   // السبت
const TECH_BUSY_PER_DAY=4; // أكتر من هالعدد زيارات باليوم لنفس الفني = تنبيه حمل
// كل زيارات الشهر (ym='YYYY-MM') غير الملغاة — نفس مصدر جدول الزيارات (visitDate)، فالتقويم بيطابقه بالضبط
function visitsInMonth(d,ym,techId){
  { const _f=permForcedTech(); if(_f)techId=_f; }
  const out=[];
  (d.contracts||[]).forEach(function(c){
    if(c.status==='cancelled')return;
    contractVisits(c).forEach(function(v){
      if(v.status==='cancelled')return;
      if(techId&&(techId==='__none'?v.performedBy:v.performedBy!==techId))return;
      const dt=visitDate(v);
      if(dt&&dt.slice(0,7)===ym)out.push({contract:c,visit:v,date:dt});
    });
  });
  return out.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:(+a.visit.n||0)-(+b.visit.n||0);});
}
// شبكة الشهر: أسابيع كاملة تبدأ من CAL_WEEK_START، الخلايا خارج الشهر date=''
function calendarMonthGrid(d,ym,techId){
  const m=/^(\d{4})-(\d{2})$/.exec(String(ym||''));if(!m)return null;
  const y=+m[1],mo=+m[2],dim=daysInMonthOf(y,mo);
  const items=visitsInMonth(d,ym,techId),by={};
  items.forEach(function(it){(by[it.date]=by[it.date]||[]).push(it);});
  const lead=(new Date(y,mo-1,1).getDay()-CAL_WEEK_START+7)%7;
  const cells=[];
  for(let i=0;i<lead;i++)cells.push({date:'',items:[]});
  for(let day=1;day<=dim;day++){const dt=y+'-'+_pad2(mo)+'-'+_pad2(day);cells.push({date:dt,items:by[dt]||[]});}
  while(cells.length%7)cells.push({date:'',items:[]});
  const weeks=[];for(let i=0;i<cells.length;i+=7)weeks.push(cells.slice(i,i+7));
  return {ym:ym,weeks:weeks,total:items.length,items:items};
}
function calendarShiftMonth(ym,k){const p=_isoParts(ym+'-01');if(!p)return ym;return addMonthsClamped(ym+'-01',k,1).slice(0,7);}
// حمل كل فني خلال شهر: زيارات (مفتوحة/منجزة/متأخرة) وأكتر يوم ازدحاماً. «غير مسند» = بدون فني
function techLoad(d,ym,todayIso){
  const t=todayIso||localToday(),rows={};
  const key=function(v){return v.performedBy||'__none';};
  visitsInMonth(d,ym).forEach(function(it){
    const v=it.visit,k=key(v);
    const r=rows[k]=rows[k]||{techId:v.performedBy||'',name:v.performedByName||(v.performedBy?getWorkerName(v.performedBy):'غير مسند'),total:0,open:0,done:0,overdue:0,byDate:{},busiestDay:'',busiestCount:0};
    r.total++;
    if(v.status==='done')r.done++;else{r.open++;if(visitEffectiveStatus(v,t)==='missed')r.overdue++;}
    r.byDate[it.date]=(r.byDate[it.date]||0)+1;
    if(r.byDate[it.date]>r.busiestCount){r.busiestCount=r.byDate[it.date];r.busiestDay=it.date;}
  });
  return Object.keys(rows).map(function(k){const r=rows[k];r.busy=r.busiestCount>TECH_BUSY_PER_DAY;return r;})
    .sort(function(a,b){return (a.techId?0:1)-(b.techId?0:1)||b.total-a.total||a.name.localeCompare(b.name,'ar');});
}
// رقم واتساب دولي (أرقام فقط). 00xx → xx · 09xxxxxxxx → 963 9xxxxxxxx · رقم محلي قصير → كود الدولة + الرقم · غير هيك كما هو
function waNormalizePhone(raw,cc){
  const code=String(cc||(db.settings&&db.settings.waCountryCode)||'963').replace(/\D/g,'')||'963';
  let n=String(raw||'').replace(/[٠-٩]/g,function(ch){return String(ch.charCodeAt(0)-1632);}).replace(/\D/g,'');
  if(!n)return '';
  if(n.indexOf('00')===0)n=n.slice(2);
  else if(n.charAt(0)==='0')n=code+n.slice(1);
  else if(n.length<=9)n=code+n;
  return n.length>=8&&n.length<=15?n:'';
}
function waLink(phone,text){
  const n=waNormalizePhone(phone);
  return n?'https://wa.me/'+n+'?text='+encodeURIComponent(String(text||'')):'';
}
// رقم العميل للتذكير: مسؤول الفرع أول، وإلا هاتف الفرع/العميل
function visitReminderPhone(c){
  const cl=(db.clients||[]).find(function(x){return x.id===c.clientId;})||{};
  const b=(cl.branchDetails||[]).find(function(x){return x.id===c.branchId;});
  return (b&&b.contactPhone)||cl.phone||'';
}
function visitReminderText(c,v){
  const co=(db.company&&db.company.name)||'Security Mask';
  const cl=(db.clients||[]).find(function(x){return x.id===c.clientId;})||{};
  const b=(cl.branchDetails||[]).find(function(x){return x.id===c.branchId;});
  const dt=visitDate(v),days=daysUntilISO(dt);
  const when=days===0?'اليوم':days===1?'بكرا':'بتاريخ';
  return 'مرحباً'+(cl.name?' '+cl.name:'')+'،\nتذكير من '+co+': عندنا زيارة صيانة دورية '+when+' '+fmtDate(dt)+(b?' بفرع '+b.name:'')+(v.performedByName?'، الفني: '+v.performedByName:'')+'.\nرقم العقد: '+(c.number||'')+'. إذا بدك تغيّر الموعد خبّرنا. شكراً لتعاملكم.';
}
function visitReminderLink(c,v){return waLink(visitReminderPhone(c),visitReminderText(c,v));}

/* ----- فروع العميل المنظّمة (T36): branchDetails = [{id,name,address,contactName,contactPhone,mapUrl}] ، و branches = أسماء فقط (للكود القديم) ----- */
function _hash36(str){let h=0;for(let i=0;i<str.length;i++)h=(h*31+str.charCodeAt(i))|0;return (h>>>0).toString(36);}
function normalizeClientBranches(d){
  (d.clients||[]).forEach(function(c){
    if(!Array.isArray(c.branches))c.branches=[];
    const old=Array.isArray(c.branchDetails)?c.branchDetails:[];
    const byName={};old.forEach(function(b){if(b&&b.name)byName[String(b.name).trim().toLowerCase()]=b;});
    c.branchDetails=c.branches.map(function(n){
      const nm=String(n).trim(),ex=byName[nm.toLowerCase()];
      return ex?Object.assign({address:'',contactName:'',contactPhone:'',mapUrl:''},ex,{name:nm}):{id:'br_'+_hash36(String(c.id)+'|'+nm),name:nm,address:'',contactName:'',contactPhone:'',mapUrl:''};
    });
  });
}
// رابط خارجي آمن (http/https فقط) — الباقي بيرجع فاضي
function safeExternalUrl(u){
  const s=String(u||'').trim();
  return /^https?:\/\/[^\s<>"']+$/i.test(s)?s:'';
}
/* ----- كشف العملاء المكررين ودمجهم (T36) ----- */
function clientNameKey(n){
  return String(n||'').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
function clientPhoneKey(p){const dg=String(p||'').replace(/\D/g,'');return dg.length>=7?dg.slice(-9):'';}
function findDuplicateClientGroups(d){
  const cl=d.clients||[],parent=cl.map(function(_,i){return i;});
  const find=function(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const seen={};
  cl.forEach(function(c,i){
    [['n',clientNameKey(c.name)],['p',clientPhoneKey(c.phone)]].forEach(function(k){
      if(!k[1])return;const key=k[0]+':'+k[1];
      if(seen[key]!==undefined)parent[find(i)]=find(seen[key]);else seen[key]=i;
    });
  });
  const groups={};
  cl.forEach(function(c,i){(groups[find(i)]=groups[find(i)]||[]).push(c);});
  return Object.keys(groups).map(function(k){return groups[k];}).filter(function(g){return g.length>1;});
}
function clientRecordCount(d,id){
  return ['sales','maintenance','quotes','projects','contracts','docs','devices'].reduce(function(s,k){return s+(d[k]||[]).filter(function(x){return x.clientId===id;}).length;},0);
}
// بيدمج dupIds داخل primaryId: بيعبّي الحقول الفاضية، بيوحّد الفروع بالاسم، بيحوّل كل السجلات المرتبطة، وبيحذف المكرر
function mergeClientsIn(d,primaryId,dupIds){
  const P=(d.clients||[]).find(function(c){return c.id===primaryId;});
  if(!P)return {ok:false,error:'العميل الأساسي غير موجود'};
  dupIds=(dupIds||[]).filter(function(id){return id!==primaryId;});
  normalizeClientBranches(d);
  const moved={};
  dupIds.forEach(function(id){
    const D=(d.clients||[]).find(function(c){return c.id===id;});
    if(!D)return;
    ['phone','contact','address','referrerName','type'].forEach(function(f){if(!P[f]&&D[f])P[f]=D[f];});
    const branchMap={};
    D.branchDetails.forEach(function(b){
      const ex=P.branchDetails.find(function(x){return x.name.trim().toLowerCase()===b.name.trim().toLowerCase();});
      if(ex){['address','contactName','contactPhone','mapUrl'].forEach(function(f){if(!ex[f]&&b[f])ex[f]=b[f];});branchMap[b.id]=ex.id;}
      else{P.branchDetails.push(b);P.branches.push(b.name);branchMap[b.id]=b.id;}
    });
    ['sales','maintenance','quotes','projects','contracts','docs','devices'].forEach(function(k){
      (d[k]||[]).forEach(function(x){
        if(x.clientId!==id)return;
        x.clientId=primaryId;moved[k]=(moved[k]||0)+1;
        if(x.branchId&&branchMap[x.branchId])x.branchId=branchMap[x.branchId];
      });
    });
    if(!P.notes&&D.notes)P.notes=D.notes;
    d.clients=d.clients.filter(function(c){return c.id!==id;});
  });
  return {ok:true,moved:moved,merged:dupIds.length};
}

function normalizeDB(){
  db.clients=db.clients||[];db.workers=db.workers||[];db.suppliers=db.suppliers||[];
  db.clients.forEach(c=>{if(c.phone===undefined)c.phone='';if(c.contact===undefined)c.contact='';if(!c.branches)c.branches=[];});
  normalizeClientBranches(db);if(!Array.isArray(db.stockItems))db.stockItems=[];if(!Array.isArray(db.stockMoves))db.stockMoves=[];if(!Array.isArray(db.contracts))db.contracts=[];if(!Array.isArray(db.devices))db.devices=[];
  if(!db.deviceDepts||typeof db.deviceDepts!=='object'||Array.isArray(db.deviceDepts))db.deviceDepts={}; // T46: تعديلات تصنيف أنواع الأجهزة بالأقسام (الافتراضي من DEFAULT_DEVICE_DEPT)
  db.workers.forEach(w=>{if(w.phone===undefined)w.phone='';});
  db.suppliers.forEach(s=>{
    if(s.phone===undefined)s.phone='';if(!s.purchases)s.purchases=[];if(!s.accountPayments)s.accountPayments=[];
    s.purchases.forEach(p=>{
      if(!p.payments){
        p.payments=[];
        if((+p.paid||0)>0)p.payments.push({id:uid(),amount:+p.paid||0,currency:p.currency||'SYP',date:p.date||'',note:'ترحيل رصيد سابق'});
      }
      if(!p.items)p.items=[];
      // ترحيل: كل صنف قديم بيلزمو id وسعر خاص فيه (مبني على توزيع الإجمالي القديم بالتساوي كبداية، قابل للتعديل)
      const needsPriceMigration=p.items.some(i=>i.price===undefined);
      if(needsPriceMigration&&p.items.length){
        const share=(+p.total||0)/p.items.length;
        p.items.forEach(i=>{if(i.price===undefined)i.price=share;});
      }
      p.items.forEach(i=>{if(!i.id)i.id=uid();});
    });
  });
  db.maintenance=db.maintenance||[];db.sales=db.sales||[];db.quotes=db.quotes||[];db.workerPayments=db.workerPayments||[];db.attendance=Array.isArray(db.attendance)?db.attendance:[];
  db.docs=db.docs||[];db.docTemplates=db.docTemplates||[];
  // ترحيل: قبل هالتحديث، دفعة عادية "مسددة" ما كانت بتنطبق بالكامل على أجرة ورشة كانت
  // تضيع (تختفي) بدون أثر — ما كانت بتتحسب كرصيد للعامل، فتظل "المستحق" بالملخص أعلى من
  // الصحيح. هون منرجّع أي دفعة قديمة متل هيك (مدفوعة، مش سلفة، مافيها settledRefs ولا
  // remainingSurplus محفوظين) ونعتبر كامل مبلغها رصيد حي، حتى ينخصم فوراً من المستحق.
  db.workerPayments.forEach(p=>{
    if(p.type==='payment'&&!p.isBonus&&p.paid&&p.remainingSurplus===undefined&&(!p.settledRefs||!p.settledRefs.length)){
      p.remainingSurplus=toUSD(+p.amount||0,p.currency);
    }
  });
  db.sales.forEach(s=>{
    if(s.paidAmount===undefined)s.paidAmount=0;
    if(s.quoteId===undefined)s.quoteId='';
    if(s.payments)s.payments.forEach(p=>{if(p.convertedAmount===undefined)p.convertedAmount=convertCurrency(+p.amount||0,p.currency||s.currency||'SYP',s.currency||'SYP');});
  });
  db.maintenance.forEach(m=>{
    if(!m.payments)m.payments=[];
    if(m.deliveryStatus===undefined)m.deliveryStatus='معلقة';
    if(m.deliveryDate===undefined)m.deliveryDate='';
    // تجميد قيمة كل دفعة قديمة بسعر الصرف وقت الترحيل، حتى ما تعاد تسعيرها لاحقاً كل ما تغيّر سعر الصرف الحي
    m.payments.forEach(p=>{if(p.convertedAmount===undefined)p.convertedAmount=convertCurrency(+p.amount||0,p.currency||m.currency||'SYP',m.currency||'SYP');});
    if(m.paidAmount===undefined){
      // ترحيل السجلات القديمة: الحالة المالية "مسددة" تعني مدفوع بالكامل
      m.paidAmount=m.paymentStatus==='مسددة'?getMaintenanceIncome(m):0;
    }
  });
  if(!db.meta)db.meta={lastBackupDate:''};
  if(db.meta.lastBackupDate===undefined)db.meta.lastBackupDate='';
  db.tools=db.tools||[];db.cars=db.cars||[];db.loans=db.loans||[];db.generalExpenses=db.generalExpenses||[];
  // المحفظة الشخصية (خاصة بالأدمن فقط) — منفصلة كلياً عن حسابات الشركة، ما إلها
  // أي علاقة بحسابات الأرباح/التقارير أعلاه. مضافة دفاعياً حتى ما تكسر قواعد
  // بيانات قديمة ما كانت تعرفها أصلاً.
  if(!db.wallet)db.wallet={openingBalance:0,lowBalanceAlert:0,categories:[
    {id:uid(),name:'منزل',kind:'expense',subs:[{id:uid(),name:'أكل'},{id:uid(),name:'إيجار'},{id:uid(),name:'ترفيه'},{id:uid(),name:'مصروف'},{id:uid(),name:'شوار'}]},
    {id:uid(),name:'سيارة',kind:'expense',subs:[{id:uid(),name:'وقود'},{id:uid(),name:'صيانة'},{id:uid(),name:'مصروف'}]},
    {id:uid(),name:'شخصي',kind:'expense',subs:[{id:uid(),name:'مشوار'}]},
    {id:uid(),name:'رواتب',kind:'income',subs:[{id:uid(),name:'راتب أساسي'},{id:uid(),name:'بدل/مكافأة'}]},
    {id:uid(),name:'دخل إضافي',kind:'income',subs:[{id:uid(),name:'عمل تاني'},{id:uid(),name:'مشروع جانبي'}]},
    {id:uid(),name:'من أشخاص',kind:'income',subs:[{id:uid(),name:'مبلغ من شخص'},{id:uid(),name:'دين مسترجع'},{id:uid(),name:'هدية'}]}
  ],entries:[]};
  if(db.wallet.openingBalance===undefined)db.wallet.openingBalance=0;
  if(db.wallet.lowBalanceAlert===undefined)db.wallet.lowBalanceAlert=0;
  if(!db.wallet.budgets)db.wallet.budgets={};
  if(!db.wallet.categories)db.wallet.categories=[];
  if(!db.wallet.entries)db.wallet.entries=[];
  db.wallet.categories.forEach(c=>{if(!c.subs)c.subs=[];if(!c.kind)c.kind='expense';}); // ترحيل: فئات قديمة بدون "kind" تُعتبر فئات مصروف (كانت هيك أصلاً)
  // ترحيل: إضافة فئات إيراد افتراضية لأول مرة فقط، لمين استخدم المحفظة قبل ما تنضاف فئات الإيراد
  if(!db.wallet.categories.some(c=>c.kind==='income')){
    db.wallet.categories.push(
      {id:uid(),name:'رواتب',kind:'income',subs:[{id:uid(),name:'راتب أساسي'},{id:uid(),name:'بدل/مكافأة'}]},
      {id:uid(),name:'دخل إضافي',kind:'income',subs:[{id:uid(),name:'عمل تاني'},{id:uid(),name:'مشروع جانبي'}]},
      {id:uid(),name:'من أشخاص',kind:'income',subs:[{id:uid(),name:'مبلغ من شخص'},{id:uid(),name:'دين مسترجع'},{id:uid(),name:'هدية'}]}
    );
  }
  if(!db.generalExpenseTypes)db.generalExpenseTypes=defaultData.generalExpenseTypes;
  db.tools.forEach(t=>{if(!t.assignments)t.assignments=[];if(t.qty===undefined)t.qty=1;if(t.status===undefined)t.status='متوفرة';if(t.purchasePrice===undefined)t.purchasePrice=0;if(t.purchaseCurrency===undefined)t.purchaseCurrency='SYP';});
  db.cars.forEach(c=>{if(!c.expenses)c.expenses=[];if(c.status===undefined)c.status='متوفرة';});
  db.loans.forEach(l=>{if(l.returned===undefined)l.returned=false;if(l.type===undefined)l.type='عدة';});
  if(!db.deviceTypes)db.deviceTypes=defaultData.deviceTypes;
  if(!db.modelNumbers)db.modelNumbers=defaultData.modelNumbers;
  if(!db.workTypes)db.workTypes=defaultData.workTypes;
  if(!db.workTypes.includes('مبلغ ثابت / مشاركة عمل'))db.workTypes.push('مبلغ ثابت / مشاركة عمل');
  if(!db.toolTypes)db.toolTypes=defaultData.toolTypes;
  if(!db.carExpenseTypes)db.carExpenseTypes=defaultData.carExpenseTypes;
  if(!db.projects)db.projects=[];
  db.projects=db.projects.map(p=>typeof p==='string'?{id:uid(),name:p,status:'جارية',createdDate:'',notes:'',quoteId:'',saleId:'',maintId:'',clientId:''}:p);
  db.projects.forEach(p=>{
    if(p.id===undefined)p.id=uid();
    if(p.status===undefined)p.status='جارية';
    if(p.createdDate===undefined)p.createdDate='';
    if(p.notes===undefined)p.notes='';
    if(p.quoteId===undefined)p.quoteId='';
    if(p.saleId===undefined)p.saleId='';
    if(p.maintId===undefined)p.maintId='';
    if(p.clientId===undefined)p.clientId='';
  });
  db.maintenance.forEach(m=>{if(m.projectName===undefined)m.projectName='';if(m.quoteId===undefined)m.quoteId='';});
  // ما في كلمة مرور افتراضية مكتوبة بالكود: أول تشغيل (بدون أي مستخدم) بتظهر شاشة "إنشاء حساب المدير"
  if(!db.security)db.security={enabled:true};
  if(!Array.isArray(db.security.users))db.security.users=[];
  if(db.security.users&&db.security.users.length){
    db.security.users.forEach(u=>{
      if(u.canViewProfits===undefined||u.canViewTotals===undefined||u.canViewWorkerSalaries===undefined||u.canViewWorkerNames===undefined){
        const legacy=!!u.canViewFinance;
        if(u.canViewProfits===undefined)u.canViewProfits=legacy;
        if(u.canViewTotals===undefined)u.canViewTotals=legacy;
        if(u.canViewWorkerSalaries===undefined)u.canViewWorkerSalaries=legacy;
        if(u.canViewWorkerNames===undefined)u.canViewWorkerNames=legacy;
      }
      // ترحيل تلقائي مرة واحدة: صفحة "المشاريع" أُضيفت بعد صفحة "التقارير"،
      // فأي مستخدم كان عندو صلاحية التقارير قبلاً بياخد صلاحية المشاريع تلقائياً
      // (لأنهم نفس مستوى الحساسية المالية)، بدل ما نفعّلها يدوياً لكل مستخدم.
      if(u.sections&&u.sections.reports&&u.sections.projects===undefined){
        u.sections.projects=true;
      }
    });
  }
  if(!db.activityLog)db.activityLog=[];
  if(!db.company)db.company={name:'Security Mask',address:'دمشق، سوريا',phone:'',mobile:'',email:'',taxNo:'',logo:'',printNote:'شكراً لتعاملكم معنا'};
  if(db.security.enabled===undefined)db.security.enabled=true;
  try{migrateClientContracts(db);}catch(e){console.error('contract migration failed',e);}
  try{ensureAllContractVisits(db);}catch(e){console.error('visit generation failed',e);}
}
function isUnlocked(){return sessionStorage.getItem('security_mask_unlocked')==='1';}
function getCurrentUser(){
  const uidCur=sessionStorage.getItem('security_mask_user');
  if(!uidCur||!db.security||!db.security.users)return null;
  return db.security.users.find(u=>u.id===uidCur)||null;
}
function isAdmin(){const u=getCurrentUser();return !!(u&&u.role==='admin');}
function canDelete(){const u=getCurrentUser();return !!(u&&(u.role==='admin'||u.canDelete));}
function canViewProfits(){const u=getCurrentUser();return !!(u&&(u.role==='admin'||u.canViewProfits));}
function canViewTotals(){const u=getCurrentUser();return !!(u&&(u.role==='admin'||u.canViewTotals));}
function canViewWorkerSalaries(){const u=getCurrentUser();return !!(u&&(u.role==='admin'||u.canViewWorkerSalaries));}
function canViewWorkerNames(){const u=getCurrentUser();return !!(u&&(u.role==='admin'||u.canViewWorkerNames));}
function canViewFinance(){return canViewProfits()||canViewTotals()||canViewWorkerSalaries();}
/* ===== PAGES & ROLE PRESETS ===== */
const PAGE_LIST=[
  {id:'dashboard',label:'الرئيسية'},
  {id:'maintenance',label:'الأعمال'},
  {id:'sales',label:'المبيعات'},
  {id:'quotes',label:'عروض الأسعار'},
  {id:'workers',label:'العمال والرواتب'},
  {id:'suppliers',label:'الموردون'},
  {id:'inventory',label:'المخزون'},
  {id:'tools',label:'لائحة العدة'},
  {id:'generalExpenses',label:'المصاريف العامة'},
  {id:'cars',label:'لائحة السيارات'},
  {id:'loans',label:'الإعارة والاستلام'},
  {id:'clients',label:'العملاء'},
  {id:'contracts',label:'العقود'},
  {id:'reports',label:'التقارير والأرباح'},
  {id:'analytics',label:'التحليلات'},
  {id:'projects',label:'المشاريع'},
  {id:'myvisits',label:'زياراتي'},
  {id:'docs',label:'المستندات والقوالب'},
  {id:'settings',label:'إدارة القوائم'},
];
const ROLE_PRESETS={
  accountant:{label:'محاسب',sections:['dashboard','sales','quotes','clients','reports','workers','projects'],canDelete:false,canViewProfits:true,canViewTotals:true,canViewWorkerSalaries:true,canViewWorkerNames:true},
  sales:{label:'مندوب مبيعات',sections:['dashboard','sales','quotes','clients'],canDelete:false,canViewProfits:false,canViewTotals:false,canViewWorkerSalaries:false,canViewWorkerNames:true},
  technician:{label:'فني ميداني',sections:['dashboard','maintenance','tools','generalExpenses','cars','loans','myvisits'],ownVisitsOnly:true,canDelete:false,canViewProfits:false,canViewTotals:false,canViewWorkerSalaries:false,canViewWorkerNames:true},
  manager:{label:'مدير مشروع',sections:['dashboard','maintenance','sales','quotes','workers','suppliers','tools','generalExpenses','cars','loans','clients','contracts','reports','projects','docs'],canDelete:true,canViewProfits:true,canViewTotals:true,canViewWorkerSalaries:true,canViewWorkerNames:true},
  viewer:{label:'مراقب (قراءة فقط)',sections:['dashboard','reports','projects'],canDelete:false,canViewProfits:true,canViewTotals:true,canViewWorkerSalaries:false,canViewWorkerNames:true},
  custom:{label:'مخصص (تحديد يدوي)'}
};
function canAccessPage(page){
  const u=getCurrentUser();
  if(!u)return false;
  if(u.role==='admin')return true;
  if(!u.sections)return true; // مستخدم قديم بدون تقييد أقسام = صلاحية كاملة كالسابق
  return !!u.sections[page];
}
function finVal(n,cat){cat=cat||'total';const ok=cat==='profit'?canViewProfits():cat==='salary'?canViewWorkerSalaries():canViewTotals();return ok?fmt(n):'••••';}
// نفس منطق finVal لكن للعرض بالدولار (تُستخدم في لوحة التحكم الرئيسية بعد تحويل كل المبالغ عبر toUSD)
function finValUSD(n,cat){cat=cat||'total';const ok=cat==='profit'?canViewProfits():cat==='salary'?canViewWorkerSalaries():canViewTotals();return ok?fmtUSD(n):'••••';}
function maskWorkerName(name){return canViewWorkerNames()?name:'•••';}
function logAction(action,entity,details){
  if(!db.activityLog)db.activityLog=[];
  const u=getCurrentUser();
  db.activityLog.unshift({id:uid(),date:new Date().toISOString(),user:u?u.username:'—',action,entity,details:details||''});
  if(db.activityLog.length>2000)db.activityLog.length=2000;
  saveDB(db);
}
function guardDelete(){
  if(!canDelete()){alert('لا تملك صلاحية الحذف. تواصل مع المدير لمنحك هذه الصلاحية.');return false;}
  return true;
}
/* ===== T14: فحص الصلاحية جوّا الدوال نفسها (مو بس إخفاء الأزرار) =====
   أي استدعاء مباشر (كونسول، زر قديم، رابط محفوظ) بدون الصلاحية بيترفض قبل ما يلمس أي بيانات.
   kind: delete | salary | names | finance | profit | totals | admin — نوع غير معروف = رفض (الأمان أولاً). */
const PERM_RULES={
  delete:{fn:'canDelete',label:'الحذف'},
  salary:{fn:'canViewWorkerSalaries',label:'رواتب وأجور العمال'},
  names:{fn:'canViewWorkerNames',label:'أسماء العمال'},
  finance:{fn:'canViewFinance',label:'الأرباح والمبالغ'},
  profit:{fn:'canViewProfits',label:'الأرباح'},
  totals:{fn:'canViewTotals',label:'الإجماليات'},
  admin:{fn:'isAdmin',label:'هذا الإجراء (للمدير فقط)'}
};
function requirePerm(kind,opts){
  const rule=PERM_RULES[kind];
  if(rule){
    let ok=false;
    try{ok=!!window[rule.fn]();}catch(e){ok=false;}
    if(ok)return true;
  }
  if(!(opts&&opts.silent))alert('لا تملك صلاحية '+(rule?rule.label:'هذا الإجراء')+'. تواصل مع المدير لمنحك هذه الصلاحية.');
  try{console.warn('T14: استدعاء مرفوض بدون صلاحية ('+kind+')');}catch(e){}
  return false;
}
function salaryLockedHTML(label){return '<div class="empty-state"><i class="ti ti-lock"></i>'+esc(label||'هذا القسم')+' متاح فقط لمن لديه الصلاحية. تواصل مع المدير.</div>';}
function checkLock(){
  normalizeDB();saveDB(db);
  if(!db.security||!db.security.enabled||isUnlocked()){hideLock();return;}
  showLock();
}
// شاشة أول تشغيل: إنشاء حساب المدير (بدل كلمة مرور افتراضية ثابتة بالكود)
function showAdminSetup(){
  const el=document.getElementById('lock-container');if(!el)return;
  window._lockMode='setup';
  el.innerHTML=`<div class="lock-screen">
    <div class="lock-card">
      <div class="lock-logo"><img src="${esc(safeLogoSrc(db.company&&db.company.logo))}" alt="Security Mask"></div>
      <h2>Security Mask</h2>
      <p>أول تشغيل: أنشئ حساب المدير للمتابعة.</p>
      <input type="text" class="form-control" id="setup-user" placeholder="اسم المستخدم" value="admin" style="text-align:center;font-size:15px;margin-bottom:8px">
      <input type="password" class="form-control" id="setup-pass" placeholder="كلمة المرور (6 أحرف على الأقل)" style="text-align:center;font-size:16px;margin-bottom:8px">
      <input type="password" class="form-control" id="setup-pass2" placeholder="أعد كتابة كلمة المرور" style="text-align:center;font-size:16px" onkeydown="if(event.key==='Enter')createFirstAdmin()">
      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:12px" onclick="createFirstAdmin()"><i class="ti ti-user-plus"></i> إنشاء الحساب</button>
      <div class="lock-error" id="setup-error"></div>
    </div>
  </div>`;
  setTimeout(()=>{const p=document.getElementById('setup-pass');if(p)p.focus();},80);
}
async function createFirstAdmin(){
  const err=document.getElementById('setup-error');
  const showErr=m=>{if(err){err.textContent=m;err.style.display='block';}};
  // لو وصلت بيانات من السحابة بهالأثناء وفيها مستخدمين، ما منضيف مدير جديد فوقها — منرجع لشاشة الدخول العادية
  if(db.security&&db.security.users&&db.security.users.length){showLock();return;}
  const username=(document.getElementById('setup-user').value||'').trim();
  const p1=document.getElementById('setup-pass').value||'';
  const p2=document.getElementById('setup-pass2').value||'';
  if(!username){showErr('أدخل اسم المستخدم');return;}
  if(p1.length<6){showErr('كلمة المرور لازم تكون 6 أحرف على الأقل');return;}
  if(p1!==p2){showErr('كلمتا المرور غير متطابقتين');return;}
  const u={id:uid(),username,role:'admin',canDelete:true,canViewProfits:true,canViewTotals:true,canViewWorkerSalaries:true,canViewWorkerNames:true};
  await setUserPassword(u,p1);
  if(!db.security)db.security={enabled:true};
  db.security.users=[u];db.security.enabled=true;
  saveDB(db);
  sessionStorage.setItem('security_mask_unlocked','1');
  sessionStorage.setItem('security_mask_user',u.id);
  window._lockMode='';
  hideLock();render();
}
function showLock(){
  const el=document.getElementById('lock-container');if(!el)return;
  if(!(db.security&&db.security.users&&db.security.users.length)){showAdminSetup();return;}
  window._lockMode='login';
  el.innerHTML=`<div class="lock-screen">
    <div class="lock-card">
      <div class="lock-logo"><img src="${esc(safeLogoSrc(db.company&&db.company.logo))}" alt="Security Mask"></div>
      <h2>Security Mask</h2>
      <p>النظام مقفول. أدخل اسم المستخدم وكلمة المرور للمتابعة.</p>
      <input type="text" class="form-control" id="login-user" placeholder="اسم المستخدم" style="text-align:center;font-size:15px;margin-bottom:8px" onkeydown="if(event.key==='Enter')document.getElementById('login-pass').focus()">
      <input type="password" class="form-control" id="login-pass" placeholder="كلمة المرور" style="text-align:center;font-size:16px" onkeydown="if(event.key==='Enter')unlockApp()">
      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:12px" onclick="unlockApp()"><i class="ti ti-key"></i> دخول</button>
      <div class="lock-error" id="lock-error">اسم المستخدم أو كلمة المرور غير صحيحة</div>
    </div>
  </div>`;
  setTimeout(()=>{const u=document.getElementById('login-user');if(u)u.focus();},80);
}
function hideLock(){window._lockMode='';const el=document.getElementById('lock-container');if(el)el.innerHTML='';}
async function unlockApp(){
  const uEl=document.getElementById('login-user');
  const pass=document.getElementById('login-pass');
  const username=(uEl&&uEl.value||'').trim();
  const users=(db.security&&db.security.users)||[];
  const found=users.find(u=>u.username===username);
  const ok=await verifyUserPassword(found,pass?pass.value:'');
  if(ok){
    saveDB(db); // يحفظ أي ترحيل تلقائي لكلمة مرور مشفّرة حديثاً
    sessionStorage.setItem('security_mask_unlocked','1');
    sessionStorage.setItem('security_mask_user',found.id);
    hideLock();render();
    claimUserPresence(found.username); // يسكّر تلقائياً أي جلسة تانية فاتحة بنفس اسم المستخدم هذا
  }else{
    const e=document.getElementById('lock-error');if(e)e.style.display='block';
    if(pass)pass.value='';
    if(uEl)uEl.focus();
  }
}
function lockApp(){
  sessionStorage.removeItem('security_mask_unlocked');
  sessionStorage.removeItem('security_mask_user');
  // تحرير الحضور عالسحابة شي ثانوي — لو فشل (نت مقطوع، عمود ناقص، أي شي)
  // ما بينفع يمنع قفل التطبيق. القفل ميزة أمان، لازم تشتغل بكل الحالات.
  try{ releaseUserPresence(); }catch(e){ console.error('releaseUserPresence failed:',e); }
  showLock();
}
/* ===== القفل التلقائي بعد عدم النشاط ===== */
function getAutoLockMinutes(){normalizeDB();const v=+((db.settings&&db.settings.autoLockMinutes)||0);return v>0?v:0;}
function setAutoLockMinutes(v){normalizeDB();if(!db.settings)db.settings={};db.settings.autoLockMinutes=+v||0;saveDB(db);resetIdleTimer();}
let _idleLastActivity=Date.now();
function resetIdleTimer(){_idleLastActivity=Date.now();}
function initIdleAutoLock(){
  ['mousemove','mousedown','keydown','touchstart','scroll'].forEach(ev=>document.addEventListener(ev,resetIdleTimer,{passive:true}));
  setInterval(()=>{
    const mins=getAutoLockMinutes();
    if(!mins||!isUnlocked())return;
    if(Date.now()-_idleLastActivity>=mins*60*1000)lockApp();
  },20000);
}
async function changePassword(){
  normalizeDB();
  const me=getCurrentUser();
  if(!me){alert('يجب تسجيل الدخول أولاً');return;}
  const current=prompt('أدخل كلمة المرور الحالية:');
  if(current===null)return;
  const ok=await verifyUserPassword(me,current);
  if(!ok){alert('كلمة المرور الحالية غير صحيحة');return;}
  const next=prompt('أدخل كلمة المرور الجديدة:');
  if(next===null)return;
  if(!next.trim()){alert('لا يمكن ترك كلمة المرور فارغة');return;}
  const confirmPass=prompt('أعد كتابة كلمة المرور الجديدة:');
  if(confirmPass!==next){alert('كلمتا المرور غير متطابقتين');return;}
  await setUserPassword(me,next);
  db.security.enabled=true;saveDB(db);alert('تم تغيير كلمة المرور بنجاح');
}
function addLockButton(){
  const acts=document.getElementById('topbar-actions');if(!acts)return;
  if(!acts.querySelector('[data-lock-btn]'))acts.insertAdjacentHTML('afterbegin','<button data-lock-btn class="btn btn-sm" onclick="lockApp()"><i class="ti ti-lock"></i> قفل</button>');
  if(!acts.querySelector('[data-logout-btn]'))acts.insertAdjacentHTML('afterbegin','<button data-logout-btn class="btn btn-sm" onclick="signOutOfCompany()"><i class="ti ti-logout"></i> خروج</button>');
}

/* ===== USER MANAGEMENT (admin only) ===== */
function renderSettingsUsers(){
  if(!isAdmin()){return '<div class="empty-state"><i class="ti ti-lock"></i>هذا القسم متاح للمدير فقط</div>';}
  const users=db.security.users||[];
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div class="section-title" style="margin:0">إدارة المستخدمين</div>
      <button class="btn btn-sm btn-primary" onclick="openUserModal()"><i class="ti ti-plus"></i> إضافة مستخدم</button>
    </div>
    <table><thead><tr><th>اسم المستخدم</th><th>الدور</th><th>الأقسام المتاحة</th><th>الحذف</th><th>الأرباح</th><th>التوتال</th><th>رواتب العمال</th><th>أسماء العمال</th><th>النسخ الاحتياطي</th><th></th></tr></thead><tbody>
    ${users.map(u=>{
      const yn=v=>u.role==='admin'?'دائماً':(v?'<span class="badge badge-green">نعم</span>':'<span class="badge badge-red">لا</span>');
      const roleLabel=u.role==='admin'?'مدير':(u.preset&&ROLE_PRESETS[u.preset]?ROLE_PRESETS[u.preset].label:'مخصص');
      const sectionsSummary=u.role==='admin'?'كل الأقسام':(u.sections?PAGE_LIST.filter(p=>u.sections[p.id]).map(p=>p.label).join('، ')||'—':'كل الأقسام');
      return `<tr><td style="font-weight:700">${esc(u.username)}</td><td><span class="badge ${u.role==='admin'?'badge-blue':'badge-gray'}">${esc(roleLabel)}</span></td><td style="font-size:11px;color:var(--text2);max-width:220px">${esc(sectionsSummary)}</td><td>${yn(u.canDelete)}</td><td>${yn(u.canViewProfits)}</td><td>${yn(u.canViewTotals)}</td><td>${yn(u.canViewWorkerSalaries)}</td><td>${yn(u.canViewWorkerNames)}</td><td>${yn(u.canBackupRestore)}</td>
    <td><div class="action-btns">
      <button class="btn btn-sm" onclick="openUserModal('${u.id}')">تعديل</button>
      ${u.role!=='admin'?`<button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}')">حذف</button>`:''}
    </div></td></tr>`;}).join('')}
    </tbody></table>
    <div class="section-title" style="margin-top:24px">سجل النشاط (آخر العمليات)</div>
    <table><thead><tr><th>التاريخ</th><th>المستخدم</th><th>الإجراء</th><th>التفاصيل</th></tr></thead><tbody>
    ${(db.activityLog||[]).slice(0,window._logPageSize||100).map(l=>`<tr><td>${fmtDate(l.date)}</td><td>${esc(l.user)}</td><td>${esc(l.action)} — ${esc(l.entity||'')}</td><td>${esc(l.details||'')}</td></tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--text2)">لا يوجد نشاط مسجل بعد</td></tr>'}
    </tbody></table>
    ${(db.activityLog||[]).length>(window._logPageSize||100)?`<div style="text-align:center;padding:14px"><button class="btn" onclick="window._logPageSize=(window._logPageSize||100)+100;refreshSettingsTabContent()"><i class="ti ti-chevron-down"></i> تحميل المزيد (${(db.activityLog||[]).length-(window._logPageSize||100)} متبقي)</button></div>`:''}`;
}

function refreshSettingsTabContent(){
  const wrap=document.getElementById('settings-tab-content');
  if(wrap)wrap.innerHTML=renderSettingsTab(window._stab||'workTypes');
}
function openUserModal(id){
  const u=id?db.security.users.find(x=>x.id===id):null;
  const isAdminUser=u&&u.role==='admin';
  const curPreset=u?(u.preset||'custom'):'custom';
  const curSections=u&&u.sections?u.sections:(u?PAGE_LIST.reduce((a,p)=>{a[p.id]=true;return a;},{}):{});
  showModal(`
      <div class="modal-title">${u?'تعديل مستخدم':'إضافة مستخدم جديد'}</div>
      <div class="form-row"><div class="form-group"><label class="form-label">اسم المستخدم</label><input class="form-control" id="user-username" value="${u?esc(u.username):''}" ${isAdminUser?'disabled':''}></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">كلمة المرور${u?' (اتركها فارغة لعدم التغيير)':''}</label><input class="form-control" id="user-password" type="text"></div></div>
      ${isAdminUser?'':`
      <div class="form-row"><div class="form-group">
        <label class="form-label">الدور الوظيفي</label>
        <select class="form-control" id="user-preset" onchange="applyRolePreset(this.value)">
          ${Object.keys(ROLE_PRESETS).map(k=>`<option value="${k}" ${curPreset===k?'selected':''}>${esc(ROLE_PRESETS[k].label)}</option>`).join('')}
        </select>
        <div style="font-size:11px;color:var(--text2);margin-top:4px">يعبّي الصلاحيات تلقائياً.</div>
      </div></div>
      <div class="section-title" style="margin-top:14px;margin-bottom:8px;font-size:13px">الأقسام المتاحة له</div>
      <div id="user-sections-box" style="display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;margin-bottom:10px">
        ${PAGE_LIST.map(p=>`<label class="checkbox-label"><input type="checkbox" class="user-section-cb" data-page="${p.id}" ${curSections[p.id]?'checked':''} onchange="document.getElementById('user-preset').value='custom'"> <span>${esc(p.label)}</span></label>`).join('')}
      </div>
      <div class="section-title" style="margin-top:14px;margin-bottom:8px;font-size:13px">صلاحيات عامة وعرض التفاصيل</div>
      <div class="form-row"><div class="form-group"><label class="checkbox-label"><input type="checkbox" id="user-candelete" ${u&&u.canDelete?'checked':''} onchange="document.getElementById('user-preset').value='custom'"> <span>يسمح له بالحذف</span></label></div></div>
      <div class="form-row"><div class="form-group"><label class="checkbox-label"><input type="checkbox" id="user-canprofits" ${u&&u.canViewProfits?'checked':''} onchange="document.getElementById('user-preset').value='custom'"> <span>يرى الأرباح</span></label></div></div>
      <div class="form-row"><div class="form-group"><label class="checkbox-label"><input type="checkbox" id="user-cantotals" ${u&&u.canViewTotals?'checked':''} onchange="document.getElementById('user-preset').value='custom'"> <span>يرى التوتال/المجاميع</span></label></div></div>
      <div class="form-row"><div class="form-group"><label class="checkbox-label"><input type="checkbox" id="user-cansalaries" ${u&&u.canViewWorkerSalaries?'checked':''} onchange="document.getElementById('user-preset').value='custom'"> <span>يرى رواتب العمال</span></label></div></div>
      <div class="form-row"><div class="form-group"><label class="checkbox-label"><input type="checkbox" id="user-canworkernames" ${u&&u.canViewWorkerNames?'checked':''} onchange="document.getElementById('user-preset').value='custom'"> <span>يرى أسماء العمال المرتبطين بالمشاريع</span></label></div></div>
      <div class="form-row"><div class="form-group"><label class="checkbox-label"><input type="checkbox" id="user-canbackup" ${u&&u.canBackupRestore?'checked':''} onchange="document.getElementById('user-preset').value='custom'"> <span>يسمح له بالنسخ الاحتياطي والاستعادة</span></label></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">مرتبط بالفني (لصفحة "زياراتي")</label>
        <select class="form-control" id="user-worker"><option value="">— بدون ربط —</option>${(db.workers||[]).map((w,i)=>`<option value="${w.id}" ${u&&u.workerId===w.id?'selected':''}>${esc(getWorkerNameRaw(w.id)||('فني '+(i+1)))}</option>`).join('')}</select></div></div>
      <div class="form-row"><div class="form-group"><label class="checkbox-label"><input type="checkbox" id="user-ownvisits" ${u&&u.ownVisitsOnly?'checked':''}> يشوف زياراته فقط (حسب الفني المربوط)</label></div></div>
      <div style="font-size:11px;color:var(--text2);margin-top:2px;margin-bottom:10px">غير المفعّل مخفي.</div>
      `}
      <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveUser('${u?u.id:''}')">حفظ</button></div>`);
}
function applyRolePreset(key){
  const preset=ROLE_PRESETS[key];
  if(!preset||key==='custom')return;
  PAGE_LIST.forEach(p=>{
    const cb=document.querySelector(`.user-section-cb[data-page="${p.id}"]`);
    if(cb)cb.checked=preset.sections.includes(p.id);
  });
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.checked=val;};
  set('user-candelete',!!preset.canDelete);
  set('user-canprofits',!!preset.canViewProfits);
  set('user-cantotals',!!preset.canViewTotals);
  set('user-cansalaries',!!preset.canViewWorkerSalaries);
  set('user-canworkernames',!!preset.canViewWorkerNames);
  set('user-canbackup',!!preset.canBackupRestore);
  set('user-ownvisits',!!preset.ownVisitsOnly);
}
async function saveUser(id){
  const username=(document.getElementById('user-username').value||'').trim();
  const password=(document.getElementById('user-password').value||'').trim();
  if(!username){alert('يرجى إدخال اسم المستخدم');return;}
  if(!id&&db.security.users.some(u=>u.username===username)){alert('اسم المستخدم مستخدم مسبقاً');return;}
  const presetEl=document.getElementById('user-preset');
  const isEditingAdmin=id&&db.security.users.find(x=>x.id===id&&x.role==='admin');
  if(isEditingAdmin){
    const u=db.security.users.find(x=>x.id===id);
    if(password)await setUserPassword(u,password);
    logAction('تعديل مستخدم','users',username);
    saveDB(db);closeModal();window._stab='users';renderSettings(document.getElementById('main-content'),document.getElementById('topbar-actions'));
    return;
  }
  const preset=presetEl?presetEl.value:'custom';
  const canDel=document.getElementById('user-candelete').checked;
  const canProfits=document.getElementById('user-canprofits').checked;
  const canTotals=document.getElementById('user-cantotals').checked;
  const canSalaries=document.getElementById('user-cansalaries').checked;
  const canWorkerNames=document.getElementById('user-canworkernames').checked;
  const canBackup=document.getElementById('user-canbackup').checked;
  const _wEl=document.getElementById('user-worker'),_ovEl=document.getElementById('user-ownvisits');
  const workerId=_wEl?_wEl.value:'',ownVisitsOnly=_ovEl?_ovEl.checked:false;
  const sections={};
  document.querySelectorAll('.user-section-cb').forEach(cb=>{sections[cb.getAttribute('data-page')]=cb.checked;});
  if(id){
    const u=db.security.users.find(x=>x.id===id);
    if(!u)return;
    if(password)await setUserPassword(u,password);
    u.preset=preset;u.sections=sections;u.canDelete=canDel;u.canViewProfits=canProfits;u.canViewTotals=canTotals;u.canViewWorkerSalaries=canSalaries;u.canViewWorkerNames=canWorkerNames;u.canBackupRestore=canBackup;u.workerId=workerId;u.ownVisitsOnly=ownVisitsOnly;
    logAction('تعديل مستخدم','users',username+' — الدور: '+(ROLE_PRESETS[preset]?ROLE_PRESETS[preset].label:preset));
  }else{
    if(!password){alert('يرجى إدخال كلمة مرور للمستخدم الجديد');return;}
    const newUser={id:uid(),username,role:'user',preset,sections,canDelete:canDel,canViewProfits:canProfits,canViewTotals:canTotals,canViewWorkerSalaries:canSalaries,canViewWorkerNames:canWorkerNames,canBackupRestore:canBackup,workerId,ownVisitsOnly};
    await setUserPassword(newUser,password);
    db.security.users.push(newUser);
    logAction('إضافة مستخدم','users',username+' — الدور: '+(ROLE_PRESETS[preset]?ROLE_PRESETS[preset].label:preset));
  }
  saveDB(db);closeModal();window._stab='users';renderSettings(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}
function deleteUser(id){
  if(!isAdmin()){alert('هذا الإجراء متاح للمدير فقط');return;}
  const u=db.security.users.find(x=>x.id===id);
  if(!u)return;
  if(u.role==='admin'){alert('لا يمكن حذف حساب المدير');return;}
  if(!confirm('حذف المستخدم "'+u.username+'"؟'))return;
  db.security.users=db.security.users.filter(x=>x.id!==id);
  logAction('حذف مستخدم','users',u.username);
  saveDB(db);window._stab='users';renderSettings(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}
function fmt(n){return (+n||0).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 2});}
// ===== دعم العملتين (ليرة سورية / دولار) =====
// سعر الصرف: كم ليرة سورية يساوي دولار واحد. يُدار من إعدادات الشركة ويمكن تعديله في أي وقت
// بدون التأثير على الأرقام المُدخلة أصلاً (كل مبلغ يُخزَّن بعملته كما أُدخل).
function getExchangeRate(){if(!db.settings)db.settings={};const r=+db.settings.exchangeRate;return r>0?r:15000;}
// يحوّل أي مبلغ (بعملته الأصلية) إلى المكافئ بالدولار باستخدام سعر الصرف الحالي
function toUSD(amount,currency){const a=+amount||0;return (currency==='USD')?a:(a/getExchangeRate());}
function getUseEntryRate(){if(!db.settings)db.settings={};return !!db.settings.useEntryRate;}
// تحويل مبلغ لسجل مالي (فاتورة/عمل) للدولار — يستخدم سعر الصرف المحفوظ وقت العملية نفسها
// (بدل السعر الحي دائماً) لو الخيار مفعّل بالإعدادات والسجل عنده سعر محفوظ، وإلا يرجع للسعر الحالي كما كان
function toUSDHist(amount,currency,record){
  const a=+amount||0;
  if(currency==='USD')return a;
  const useHist=getUseEntryRate();
  const rate=(useHist&&record&&+record.exchangeRateAtEntry>0)?+record.exchangeRateAtEntry:getExchangeRate();
  return a/rate;
}
// يحوّل مبلغ من عملته الأصلية إلى أي عملة هدف (تلقائياً حسب سعر الصرف الحالي)
function convertCurrency(amount,fromCurrency,toCurrency){
  const usd=toUSD(amount,fromCurrency);
  return round2(toCurrency==='USD'?usd:usd*getExchangeRate());
}
// نفس التحويل، بس بسعر صرف محدد يدوياً (مش بالضرورة السعر الحي الحالي) — يُستخدم لتجميد
// قيمة الدفعات القديمة بسعرها الأصلي وقت تسجيلها، حتى لو تعدّلت لاحقاً (تاريخ/ملاحظة...)
// بعد ما يكون سعر الصرف الحي تغيّر من ساعتها.
function convertCurrencyAtRate(amount,fromCurrency,toCurrency,rate){
  const a=+amount||0;
  const usd=fromCurrency==='USD'?a:(a/rate);
  return round2(toCurrency==='USD'?usd:usd*rate);
}
// عنصر HTML مصغّر لاختيار عملة بند فردي (أجر عامل / مصروف) — يستخدم بجانب حقل المبلغ
function miniCurrencySelectHTML(value,onchange){
  const v=value==='USD'?'USD':'SYP';
  return `<select class="form-control" style="max-width:78px;padding:9px 4px;font-size:12px" onchange="${onchange}">
    <option value="SYP" ${v==='SYP'?'selected':''}>ل.س</option>
    <option value="USD" ${v==='USD'?'selected':''}>$</option>
  </select>`;
}
// تنسيق مبلغ بالدولار (للوحة التحكم وأي عرض إجمالي موحّد بالدولار)
function fmtUSD(n){return '$'+(+n||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2});}
// رمز/تسمية العملة لعرضها بجانب مبلغ مسجل بعملته الأصلية
function curLabel(currency){return currency==='USD'?'$':'ل.س';}
// عنصر HTML لاختيار عملة سجل (مبيعة/عملية صيانة) — value: 'SYP' أو 'USD'
function currencySelectHTML(id,value){
  const v=value==='USD'?'USD':'SYP';
  return `<select class="form-control" id="${id}" style="max-width:120px;display:inline-block;width:auto">
    <option value="SYP" ${v==='SYP'?'selected':''}>ل.س (سوري)</option>
    <option value="USD" ${v==='USD'?'selected':''}>$ (دولار)</option>
  </select>`;
}
function unformatNum(str){return +String(str===undefined||str===null?'':str).replace(/,/g,'')||0;}
function formatMoneyInput(el){
  if(!el)return;
  const start=el.selectionStart,oldLen=el.value.length;
  let raw=el.value.replace(/[^\d.]/g,'');
  const firstDot=raw.indexOf('.');
  if(firstDot!==-1)raw=raw.slice(0,firstDot+1)+raw.slice(firstDot+1).replace(/\./g,'');
  let [intPart,decPart]=raw.split('.');
  intPart=(intPart||'').replace(/^0+(?=\d)/,'');
  let out=intPart?Number(intPart).toLocaleString('en-US'):'';
  if(decPart!==undefined)out+='.'+decPart;
  el.value=out;
  const diff=out.length-oldLen;
  const pos=Math.max(0,(start||0)+diff);
  try{el.setSelectionRange(pos,pos);}catch(e){}
}
function fmtDate(d){if(!d)return'—';try{const _m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d));if(_m)return`${_m[3]}/${_m[2]}/${_m[1]}`;const dt=new Date(d);const dd=String(dt.getDate()).padStart(2,'0');const mm=String(dt.getMonth()+1).padStart(2,'0');const yy=dt.getFullYear();return`${dd}/${mm}/${yy}`;}catch(e){return d;}}
function getClientName(id){const c=db.clients.find(x=>x.id===id);return c?c.name:'—';}

/* ===== EXCEL EXPORT HELPER ===== */
async function exportRowsToExcel(filenameBase,sheetName,headers,rows){
  if(!rows||!rows.length){alert('لا يوجد بيانات لتصديرها');return;}
  try{await loadLibOrWarn('xlsx','تصدير Excel');}catch(e){return;}
  const data=[headers,...rows];
  const ws=XLSX.utils.aoa_to_sheet(data);
  ws['!cols']=headers.map((h,i)=>{const maxLen=Math.max(String(h).length,...rows.map(r=>String(r[i]??'').length));return{wch:Math.min(Math.max(maxLen+2,10),45)};});
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,sheetName);
  const stamp=localToday();
  XLSX.writeFile(wb,`${filenameBase}-${stamp}.xlsx`);
}

function navigate(page){
  // المحفظة صفحة خاصة بالأدمن حصراً — لا تتبع نظام صلاحيات الأقسام العادي
  // (canAccessPage) لأنها مش جوا PAGE_LIST أصلاً ومش مفروض أي مستخدم تاني يوصلها.
  if(page==='wallet'&&!isAdmin()){alert('هذا القسم متاح للمدير فقط.');return;}
  if(page!=='wallet'&&!canAccessPage(page)){alert('لا تملك صلاحية الوصول لهذا القسم. تواصل مع المدير لمنحك هذه الصلاحية.');return;}
  if(currentPage==='docs'&&window._docDirty){
    if(!confirm('عندك تعديلات بالمستند ما انحفظت. بدك تطلع بدون حفظ؟'))return;
    window._docDirty=false;
  }
  if(page==='docs')window._docView=null;
  if(page==='projects')window._projView=null;
  currentPage=page;
  document.querySelectorAll('.nav-item').forEach(el=>{
    el.classList.toggle('active',el.getAttribute('onclick')===`navigate('${page}')`);
  });
  closeSidebar();
  render();
}
function toggleSidebar(){
  const sb=document.getElementById('sidebar');const bd=document.getElementById('sidebar-backdrop');
  if(!sb||!bd)return;
  const opening=!sb.classList.contains('open');
  sb.classList.toggle('open',opening);
  bd.classList.toggle('show',opening);
}
function closeSidebar(){
  const sb=document.getElementById('sidebar');const bd=document.getElementById('sidebar-backdrop');
  if(sb)sb.classList.remove('open');
  if(bd)bd.classList.remove('show');
}

let _renderToken=0;
async function render(){
  const titles={dashboard:'الرئيسية (بالدولار $)',maintenance:'الأعمال',sales:'المبيعات',quotes:'عروض الأسعار',workers:'العمال والرواتب',suppliers:'الموردون',inventory:'المخزون',myvisits:'زياراتي',analytics:'التحليلات',tools:'لائحة العدة',generalExpenses:'المصاريف العامة',cars:'لائحة السيارات',loans:'الإعارة والاستلام',clients:'العملاء',contracts:'عقود الصيانة',reports:'التقارير والأرباح',projects:'المشاريع',docs:'المستندات والقوالب',settings:'إدارة القوائم',wallet:'المحفظة الشخصية'};
  document.getElementById('page-title').textContent=titles[currentPage]||'';
  PAGE_LIST.forEach(p=>{
    const navEl=document.querySelector(`.nav-item[onclick="navigate('${p.id}')"]`);
    if(navEl)navEl.style.display=canAccessPage(p.id)?'':'none';
  });
  const reportsNav=document.querySelector(".nav-item[onclick=\"navigate('reports')\"]");
  if(reportsNav&&canAccessPage('reports'))reportsNav.style.display=canViewFinance()?'':'none';
  const analyticsNav=document.querySelector(".nav-item[onclick=\"navigate('analytics')\"]");
  if(analyticsNav)analyticsNav.style.display=(canAccessPage('analytics')&&canViewFinance())?'':'none';
  // المحفظة: عنصر قائمة خاص غير مرتبط بـ PAGE_LIST، يظهر فقط للأدمن.
  const walletNav=document.querySelector(".nav-item[onclick=\"navigate('wallet')\"]");
  if(walletNav)walletNav.style.display=isAdmin()?'':'none';
  if(currentPage==='reports'&&!canViewFinance())currentPage='dashboard';
  if(currentPage==='wallet'&&!isAdmin())currentPage='dashboard';
  if(currentPage!=='wallet'&&!canAccessPage(currentPage))currentPage='dashboard';
  const acts=document.getElementById('topbar-actions');acts.innerHTML='';
  const content=document.getElementById('main-content');

  const bundle=PAGE_BUNDLE[currentPage];
  const myToken=++_renderToken;
  if(bundle&&bundle!=='core'&&!_loadedBundles[bundle]){
    content.innerHTML='<div class="sg-loading" style="padding:40px;text-align:center;color:var(--text2)"><i class="ti ti-loader-2" style="font-size:22px"></i><div style="margin-top:8px">جاري تحميل القسم…</div></div>';
    try{
      await ensureBundle(bundle);
    }catch(e){
      console.error('bundle load failed:',e);
      content.innerHTML='<div style="padding:40px;text-align:center;color:var(--danger)">تعذّر تحميل هذا القسم. تحقق من الاتصال بالإنترنت وأعد المحاولة.<br><button class="btn btn-sm" style="margin-top:12px" onclick="render()">إعادة المحاولة</button></div>';
      return;
    }
    // إذا المستخدم انتقل لصفحة تانية أثناء التحميل، لا تكمل رسم هاي الصفحة القديمة
    if(myToken!==_renderToken)return;
  }

  if(currentPage==='dashboard')renderDashboard(content,acts);
  else if(currentPage==='maintenance')renderMaintenance(content,acts);
  else if(currentPage==='sales')renderSales(content,acts);
  else if(currentPage==='quotes')renderQuotes(content,acts);
  else if(currentPage==='workers')renderWorkers(content,acts);
  else if(currentPage==='suppliers')renderSuppliers(content,acts);
  else if(currentPage==='tools')renderTools(content,acts);
  else if(currentPage==='generalExpenses')renderGeneralExpenses(content,acts);
  else if(currentPage==='cars')renderCars(content,acts);
  else if(currentPage==='loans')renderLoans(content,acts);
  else if(currentPage==='clients')renderClients(content,acts);
  else if(currentPage==='contracts')renderContracts(content,acts);
  else if(currentPage==='myvisits')renderMyVisits(content,acts);
  else if(currentPage==='inventory')renderInventory(content,acts);
  else if(currentPage==='analytics')renderAnalytics(content,acts);
  else if(currentPage==='reports')renderReports(content,acts);
  else if(currentPage==='projects')renderProjects(content,acts);
  else if(currentPage==='settings')renderSettings(content,acts);
  else if(currentPage==='docs')renderDocs(content,acts);
  else if(currentPage==='wallet')renderWallet(content,acts);

  // زر القفل والخروج لازم يضلوا ظاهرين بكل صفحة — منضيفهم هون (بعد ما
  // دالة الصفحة عملت acts.innerHTML الخاص فيها) منشان ما ينمسحوا.
  addLockButton();

  // إشارة صغيرة على الداشبورد الرئيسي (للأدمن فقط) لرصيد المحفظة الشخصية —
  // مجرد تذكير سريع، محسوبة هون بشكل مستقل (بدون الاعتماد على wallet.js
  // لأنه ممكن يكون لسا ما تحمّل)، وواضح إنه رقم شخصي منفصل عن أرقام الشركة.
  if(currentPage==='dashboard'&&isAdmin()&&db.wallet){
    const openingBal=(+db.wallet.openingBalance)||0;
    const sv=e=>walletSignedCents(e)/100; // T23: نفس حساب السنت المستعمل بالمحفظة
    const net=(db.wallet.entries||[]).reduce((s,e)=>s+sv(e),0);
    // جيب الشركة مفصول عن الرصيد الشخصي
    const companyPk=(db.wallet.entries||[]).filter(e=>e.pocket==='company').reduce((s,e)=>s+sv(e),0);
    const hasCompanyPk=(db.wallet.entries||[]).some(e=>e.pocket==='company');
    const personalBal=openingBal+net-companyPk;
    content.insertAdjacentHTML('afterbegin',`<div style="display:flex;align-items:center;gap:8px;justify-content:space-between;background:var(--bg2);border:1px dashed var(--border2);border-radius:10px;padding:8px 14px;margin-bottom:14px;font-size:12.5px">
      <span><i class="ti ti-wallet"></i> محفظتك الشخصية (منفصلة عن حسابات الشركة): <b style="color:${personalBal>=0?'var(--accent)':'var(--danger)'}">${fmtUSD(personalBal)}</b>${hasCompanyPk?` <span style="color:var(--text2)">| معك للشركة: <b style="color:${companyPk>=0?'var(--gold,#B8862E)':'var(--danger)'}">${fmtUSD(companyPk)}</b></span>`:''}</span>
      <span style="cursor:pointer;color:var(--accent);font-weight:700" onclick="navigate('wallet')">فتح المحفظة ›</span>
    </div>`);
  }
}

/* ====================================================================
   🐞 إصلاح خلل حقيقي: لوحة التحكم (الصفحة الافتراضية) كانت تنادي
   projectStats() و projectCommissionsInRange() وهنّي معرّفين بـ ops.js —
   وحسب PAGE_BUNDLE اللوحة تابعة لـ 'core'، يعني ops.js ما بيكون محمّل
   لما تفتح التطبيق. النتيجة: ReferenceError وتوقف رسم اللوحة كلياً قبل
   ما توصل لسطر el.innerHTML — يعني صفحة بيضا بأول فتحة، ولحد ما
   المستخدم يفوت على قسم تاني ويرجع.
   الحل: منرجّع أصفار مؤقتاً، ومنحمّل ops.js بالخلفية، وأول ما يجهز
   منعيد رسم اللوحة بالأرقام الصحيحة — من دون ما نأخّر أول ظهور للصفحة.
   ==================================================================== */
let _opsBgLoading=false;
function _ensureOpsForDashboard(){
  if(typeof projectStats==='function'&&typeof projectCommissionsInRange==='function')return true;
  if(!_opsBgLoading){
    _opsBgLoading=true;
    ensureBundle('ops').then(function(){
      _opsBgLoading=false;
      if(currentPage==='dashboard')render();
    }).catch(function(e){_opsBgLoading=false;console.error('ops bundle load failed:',e);});
  }
  return false;
}

/* ===== التنبيهات الذكية (لوحة التحكم) ===== */
function renderSmartAlerts(){
  const now=new Date();
  const alertGroups=[];

  // 1) تذكير عقود الصيانة الدورية — عملاء لديهم موعد زيارة قادم خلال 7 أيام أو فائت
  const upcomingVisits=(db.contracts||[]).filter(c=>contractEffectiveStatus(c)==='active'&&c.nextVisitDate).map(c=>{
    const cl=(db.clients||[]).find(x=>x.id===c.clientId)||{name:'—'};
    return {client:cl,label:(CONTRACT_FREQ.find(f=>f.id===contractIntervalMonths(c))||{label:''}).label,days:daysUntilISO(c.nextVisitDate)};
  }).filter(v=>v.days!==null&&v.days<=7).sort((a,b)=>a.days-b.days);
  if(upcomingVisits.length){
    alertGroups.push({icon:'ti-calendar-event',color:'blue',title:`عقود صيانة مستحقة زيارة (${upcomingVisits.length})`,items:upcomingVisits.map(v=>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
        <span><b>${esc(v.client.name)}</b> <span style="color:var(--text2);font-size:11px">(${esc(v.label)})</span></span>
        <span style="color:${v.days<0?'var(--danger)':'var(--info)'};font-weight:700">${v.days<0?`متأخرة ${Math.abs(v.days)} يوم`:v.days===0?'اليوم':`خلال ${v.days} يوم`}</span>
      </div>`).join('')});
  }

  // 1-ب) تنبيه التجديد 60/30/7 + ضمان الأجهزة اللي قارب ينتهي (T34/T33)
  const renewals=contractRenewalAlerts(db).filter(x=>x.info.stage!=='expired');
  if(renewals.length){
    alertGroups.push({icon:'ti-refresh',color:'amber',title:`عقود قربت تنتهي (${renewals.length})`,items:renewals.map(x=>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
        <span><b>${esc(getClientName(x.contract.clientId))}</b> <span style="color:var(--text2);font-size:11px">${esc(x.contract.number||'')}</span></span>
        <span style="color:${x.info.stage===7?'var(--danger)':'var(--gold-dark)'};font-weight:700">${x.info.days===0?'ينتهي اليوم':`بعد ${x.info.days} يوم`}</span>
      </div>`).join('')});
  }
  const warr=devicesWarrantyAlerts(db).filter(x=>x.w.state==='expiring');
  if(warr.length){
    alertGroups.push({icon:'ti-shield-check',color:'blue',title:`ضمان أجهزة بينتهي قريباً (${warr.length})`,items:warr.slice(0,8).map(x=>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
        <span><b>${esc(x.device.type||'جهاز')}</b> <span style="color:var(--text2);font-size:11px">${esc(getClientName(x.device.clientId))}</span></span>
        <span style="color:var(--info);font-weight:700">${x.w.days===0?'اليوم':`بعد ${x.w.days} يوم`}</span>
      </div>`).join('')});
  }

  // 2) متابعة عروض الأسعار المعلقة لأكثر من X أيام
  const followupDays=getQuoteFollowupDays();
  const staleQuotes=(db.quotes||[]).filter(q=>q.status==='معلق'&&q.date).map(q=>({q,days:Math.floor((now-new Date(q.date))/86400000)})).filter(x=>x.days>=followupDays).sort((a,b)=>b.days-a.days);
  if(staleQuotes.length){
    alertGroups.push({icon:'ti-file-alert',color:'amber',title:`عروض أسعار محتاجة متابعة (${staleQuotes.length})`,items:staleQuotes.map(x=>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
        <span><b>${x.q.clientId?esc(getClientName(x.q.clientId)):esc(x.q.clientNameFree||'—')}</b> ${x.q.projectName?'— '+esc(x.q.projectName):''}</span>
        <span style="color:var(--gold-dark);font-weight:700">منذ ${x.days} يوم</span>
      </div>`).join('')});
  }

  // 3) تنبيه نقص المخزون بالعدة
  const lowStock=(db.tools||[]).filter(t=>t.minQty!==undefined&&t.minQty!==''&&(+t.qty||0)<=(+t.minQty||0));
  if(lowStock.length){
    alertGroups.push({icon:'ti-package-off',color:'red',title:`نقص مخزون بالعدة (${lowStock.length})`,items:lowStock.map(t=>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
        <span><b>${esc(t.name)}</b></span>
        <span style="color:var(--danger);font-weight:700">الكمية: ${esc(t.qty||0)} (الحد الأدنى: ${esc(t.minQty)})</span>
      </div>`).join('')});
  }

  // 6) تذكير دفعات الموردين المستحقة
  const dueDays=getSupplierDueDays();
  const dueSuppliers=[];
  (db.suppliers||[]).forEach(sup=>{
    const purchases=sup.purchases||[];
    // موحّد بالدولار (toUSD) حتى تكون قابلة للمقارنة/الجمع بين الموردين بغض النظر عن عملة كل عملية سحب
    // ولازم ياخد بعين الاعتبار دفعات "على كامل الحساب" (مو مرتبطة بفاتورة معينة) وإلا ممكن يظهر تنبيه
    // مورد سدد رصيده كامل بدفعة عامة بس الفواتير الفردية لسا شكلها غير مسددة.
    const totalDebt=getSupplierDebtUSD(sup);
    if(totalDebt<=0)return;
    const oldestUnpaid=purchases.filter(p=>((+p.total||0)-(+p.paid||0))>0&&p.date).sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
    const days=oldestUnpaid?Math.floor((now-new Date(oldestUnpaid.date))/86400000):0;
    if(days>=dueDays)dueSuppliers.push({sup,debt:totalDebt,days});
  });
  dueSuppliers.sort((a,b)=>b.days-a.days);
  if(dueSuppliers.length){
    alertGroups.push({icon:'ti-truck-delivery',color:'red',title:`دفعات موردين مستحقة (${dueSuppliers.length})`,items:dueSuppliers.map(x=>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
        <span><b>${esc(x.sup.name)}</b></span>
        <span style="color:var(--danger);font-weight:700">${fmtUSD(x.debt)} — منذ ${x.days} يوم</span>
      </div>`).join('')});
  }

  if(!alertGroups.length)return '';
  const colorMap={blue:'var(--info)',amber:'var(--gold-dark)',red:'var(--danger)'};
  return `<div class="card" style="margin-bottom:18px;border-inline-start:3px solid var(--gold)">
    <div class="section-title" style="display:flex;align-items:center;gap:8px"><i class="ti ti-bell-ringing" style="color:var(--gold-dark)"></i> التنبيهات الذكية</div>
    <div class="grid-2" style="gap:14px">
      ${alertGroups.map(g=>`<div style="background:var(--bg2);border-radius:10px;padding:12px 14px">
        <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:${colorMap[g.color]}"><i class="ti ${g.icon}"></i> ${esc(g.title)}</div>
        <div style="max-height:180px;overflow-y:auto">${g.items}</div>
      </div>`).join('')}
    </div>
  </div>`;
}

/* ===== DASHBOARD ===== */
// بطاقة مصغّرة بلوحة التحكم: توزيع العمولات حسب كل موصي، مع حالة الدفع (المزيد من التفاصيل بصفحة التقارير)
function renderReferrerBreakdownCard(){
  const map={};
  db.clients.forEach(c=>{
    if(!c.referrerName)return;
    if(!map[c.referrerName])map[c.referrerName]={paid:0,unpaid:0,settlementPaid:0,settlementUnpaid:0};
    db.sales.filter(s=>s.clientId===c.id).forEach(s=>{
      // موحّد بالدولار (toUSD) لأن العمولات ممكن تكون مسجّلة بعملات مختلفة (ل.س / $)
      const com=toUSDHist(saleReferralCommission(s),s.currency,s);
      if(com>0){
        if(s.commissionSettlement)map[c.referrerName][s.commissionPaid?'settlementPaid':'settlementUnpaid']+=com;
        else map[c.referrerName][s.commissionPaid?'paid':'unpaid']+=com;
      }
    });
    db.maintenance.filter(m=>m.clientId===c.id).forEach(m=>{
      const com=toUSDHist(maintReferralCommission(m),m.currency,m);
      if(com>0){
        if(m.commissionSettlement)map[c.referrerName][m.commissionPaid?'settlementPaid':'settlementUnpaid']+=com;
        else map[c.referrerName][m.commissionPaid?'paid':'unpaid']+=com;
      }
    });
  });
  // عمولات المشاريع الكاملة (مسجّلة مرة وحدة على المشروع ككل) — بتنضاف لنفس اللائحة تحت اسم الموصي يلي تحدد بالمشروع (أو اسم المشروع نفسه لو ما تحدد أحد)
  const _opsReady=_ensureOpsForDashboard();
  if(_opsReady)(db.projects||[]).forEach(p=>{
    const stats=projectStats(p.name,true);
    if(stats.projectCommission<=0)return;
    const key=p.projectCommissionReferrer||`مشروع: ${esc(p.name)}`;
    if(!map[key])map[key]={paid:0,unpaid:0,settlementPaid:0,settlementUnpaid:0};
    map[key][p.projectCommissionPaid?'paid':'unpaid']+=stats.projectCommission;
  });
  const rows=Object.entries(map).filter(([,v])=>v.paid+v.unpaid+v.settlementPaid+v.settlementUnpaid>0).sort((a,b)=>(b[1].paid+b[1].unpaid+b[1].settlementPaid+b[1].settlementUnpaid)-(a[1].paid+a[1].unpaid+a[1].settlementPaid+a[1].settlementUnpaid));
  if(!rows.length)return '';
  return `<div class="card" style="margin-bottom:18px">
    <div class="section-title" style="display:flex;align-items:center;gap:8px"><i class="ti ti-user-check" style="color:var(--gold-dark)"></i> العمولات حسب كل موصي ($) <span style="font-size:11px;color:var(--text2);font-weight:400">(تفاصيل كل فاتورة بصفحة التقارير)</span></div>
    <div style="display:flex;flex-wrap:wrap;gap:10px">
      ${rows.map(([name,v])=>{
        const realTotal=v.paid+v.unpaid;
        const settlementTotal=v.settlementPaid+v.settlementUnpaid;
        return `<div style="background:var(--gold-light);border-radius:10px;padding:10px 14px;min-width:170px">
        <div style="font-size:12px;color:var(--gold-dark);font-weight:600">${esc(name)}</div>
        <div style="font-size:17px;font-weight:700;color:var(--gold-dark)">${fmtUSD(realTotal)}</div>
        <div style="font-size:11px;margin-top:3px;display:flex;gap:8px">
          <span style="color:var(--success)">مدفوع: ${fmtUSD(v.paid)}</span>
          <span style="color:var(--danger)">معلق: ${fmtUSD(v.unpaid)}</span>
        </div>
        ${settlementTotal>0?`<div style="font-size:11px;margin-top:6px;padding-top:6px;border-top:1px dashed var(--border2);color:var(--text2)">+ تسويات يدوية: <b>${fmtUSD(settlementTotal)}</b> <span style="font-size:10px">(مو عمولة فعلية)</span></div>`:''}
      </div>`;
      }).join('')}
    </div>
  </div>`;
}

// T26: الفترة من مكوّن الفترة الموحّد (الافتراضي: "الكل" = نظرة شاملة)
const DASH_PERIOD_DEF={mode:'preset',preset:'all'};
function dashPeriodBounds(){const r=periodResolve('dash',DASH_PERIOD_DEF);return {from:r.from,to:r.to};}
function dashRerender(){renderDashboard(document.getElementById('main-content'),document.getElementById('topbar-actions'));}
function dashInRange(dateVal,from,to){return periodInRange(dateVal,from,to);} // T22: نفس دالة الحدود المشتركة مع المحفظة

/* ===== T26: مجاميع الداشبورد من مصدر واحد =====
   كل رقم (بطاقات، مقارنة الفترة، جدول ومخطط الأشهر) بيطلع من dashTotalsOf على نفس السجلات
   المفلترة بنفس دالة الحدود، فمجموع الأشهر = إجمالي الفترة = مجموع السجلات. */
function dashTotalsOf(salesArr,maintArr,projComm){
  const S=(a,f)=>a.reduce((t,x)=>t+f(x),0);
  const salesRev=S(salesArr,x=>toUSDHist(x.totalPrice,x.currency,x));
  const maintRev=S(maintArr,m=>toUSDHist(getMaintenanceIncome(m),m.currency,m));
  const saleProfit=S(salesArr,x=>toUSDHist(saleRecognizedRevenue(x),x.currency,x)-toUSDHist(saleRecognizedCost(x),x.currency,x));
  const maintProfit=S(maintArr,m=>toUSDHist(maintRecognizedIncome(m),m.currency,m)-toUSDHist(maintRecognizedWages(m),m.currency,m)-toUSDHist(maintRecognizedExpenses(m),m.currency,m));
  const comm=S(salesArr,x=>toUSDHist(saleReferralCommission(x),x.currency,x))+S(maintArr,m=>toUSDHist(maintReferralCommission(m),m.currency,m));
  const pc=+projComm||0;
  return {salesRev,maintRev,revenue:salesRev+maintRev,profit:saleProfit+maintProfit-comm-pc,projComm:pc,nSales:salesArr.length,nMaint:maintArr.length};
}
function dashRangeTotals(from,to,opsReady){
  const pc=(opsReady&&typeof projectCommissionsInRange==='function')?projectCommissionsInRange(from,to,true).total:0;
  return dashTotalsOf(db.sales.filter(x=>dashInRange(x.date,from,to)),db.maintenance.filter(m=>dashInRange(m.startDate,from,to)),pc);
}
// سجلات بدون تاريخ: ما بتنزل بأي شهر، بس بتدخل بـ "الكل" — منعرضها بسطر لحالها حتى يضبط المجموع
function dashUndatedTotals(opsReady){
  let pc=0;
  if(opsReady&&typeof projectStats==='function'){
    (db.projects||[]).forEach(p=>{if(p.createdDate)return;const st=projectStats(p.name,true);if(st.projectCommission>0)pc+=st.projectCommission;});
  }
  return dashTotalsOf(db.sales.filter(x=>!x.date),db.maintenance.filter(m=>!m.startDate),pc);
}
function dashDataSpan(){
  let min='',max='';
  const f=function(d){d=d?String(d).slice(0,10):'';if(!d)return;if(!min||d<min)min=d;if(!max||d>max)max=d;};
  db.sales.forEach(x=>f(x.date));db.maintenance.forEach(m=>f(m.startDate));(db.projects||[]).forEach(p=>f(p.createdDate));
  return min?{min,max}:null;
}
function dashMonthRows(from,to,opsReady,cap){
  cap=cap||12;
  const sp=dashDataSpan(),today=localISODate(new Date());
  const f=from||(sp?sp.min:null),t=to||(sp?(sp.max>today?sp.max:today):null);
  const out={rows:[],truncated:false,undated:null,from:f,to:t};
  if(!f||!t)return out;
  let bs=periodMonthBuckets(f,t);
  if(bs.length>cap){bs=bs.slice(-cap);out.truncated=true;out.from=bs[0].from;}
  const thisY=new Date().getFullYear();
  out.rows=bs.map(b=>Object.assign({key:b.key,y:b.y,m:b.m,full:b.full,from:b.from,to:b.to,label:periodMonthLabel(b.y,b.m),short:PERIOD_MONTHS_AR[b.m]+(b.y!==thisY?' '+b.y:'')},dashRangeTotals(b.from,b.to,opsReady)));
  if(!from&&!to&&!out.truncated){
    const U=dashUndatedTotals(opsReady);
    if(U.nSales||U.nMaint||U.projComm)out.undated=U;
  }
  return out;
}
function renderDashMonthsCard(ser){
  if(!ser.rows.length)return '';
  const all=ser.rows.concat(ser.undated?[ser.undated]:[]);
  const sum=k=>all.reduce((t,r)=>t+r[k],0);
  const trs=ser.rows.map((r,i)=>{
    const prev=i>0?ser.rows[i-1].revenue:null;
    const d=(prev!==null&&prev>0)?Math.round((r.revenue-prev)/prev*100):null;
    return `<tr><td>${esc(r.label)}${r.full?'':' <span style="font-size:10px;color:var(--text2)">(جزئي)</span>'}</td>
      <td>${finValUSD(r.salesRev)}</td><td>${finValUSD(r.maintRev)}</td><td style="font-weight:700">${finValUSD(r.revenue)}</td>
      <td>${finValUSD(r.profit,'profit')}</td>
      <td style="font-weight:700;color:${d===null||d===0?'var(--text2)':(d>0?'var(--success)':'var(--danger)')}">${d===null?'—':(d>0?'+':'')+d+'%'}</td></tr>`;
  }).join('');
  const und=ser.undated?`<tr><td>بدون تاريخ</td><td>${finValUSD(ser.undated.salesRev)}</td><td>${finValUSD(ser.undated.maintRev)}</td><td style="font-weight:700">${finValUSD(ser.undated.revenue)}</td><td>${finValUSD(ser.undated.profit,'profit')}</td><td>—</td></tr>`:'';
  return `<div class="card" style="margin-bottom:18px">
    <div class="section-title"><i class="ti ti-calendar-stats"></i> المقارنة الشهرية <span style="font-size:10px;color:var(--text2);font-weight:400">(بالدولار)</span>${infoTip('مجموع الأشهر = إجمالي الفترة بالبطاقات. الربح هون محقّق (حسب التحصيل) وبعد العمولات، متل بطاقة صافي الربح. النسبة = تغيّر الإيراد عن الشهر اللي قبله.')}</div>
    ${ser.truncated?'<div style="font-size:11px;color:var(--text2);margin-bottom:6px">معروض آخر 12 شهر بس.</div>':''}
    <div style="overflow-x:auto"><table class="wallet-st"><thead><tr><th>الشهر</th><th>مبيعات</th><th>أعمال</th><th>الإيراد</th><th>الربح</th><th>عن الشهر السابق</th></tr></thead><tbody>${trs}${und}</tbody>
    <tfoot><tr class="summary-row"><td>${ser.truncated?'مجموع الأشهر المعروضة':'المجموع'}</td><td>${finValUSD(sum('salesRev'))}</td><td>${finValUSD(sum('maintRev'))}</td><td>${finValUSD(sum('revenue'))}</td><td>${finValUSD(sum('profit'),'profit')}</td><td></td></tr></tfoot></table></div>
  </div>`;
}
/* T46: بطاقة الداشبورد "المبيعات حسب القسم" — نفس فترة البطاقات (salesF). كل المبالغ بالدولار بسعر كل فاتورة (toUSDHist).
   مجموع صافي الأقسام = إجمالي المبيعات بالبطاقات (بفرق سنت لكل فاتورة كحد أقصى). الربح المحقق = حسب التحصيل بعد العمولة، متل بطاقة صافي الربح. */
function dashDeptRows(salesList){
  const rows={};DEPT_ALL_KEYS.forEach(k=>{rows[k]={dept:k,count:0,gross:0,discount:0,net:0,cost:0,profit:0,recognizedProfit:0};});
  (salesList||[]).forEach(s=>{
    const bd=saleSectionBreakdown(s);
    bd.activeKeys.forEach(k=>{
      const x=bd.sections[k],r=rows[k];
      r.count++;r.gross+=toUSDHist(x.gross,s.currency,s);r.discount+=toUSDHist(x.discount,s.currency,s);r.net+=toUSDHist(x.net,s.currency,s);r.cost+=toUSDHist(x.cost,s.currency,s);
      const sl=saleSectionSlice(s,k);if(sl)r.recognizedProfit+=toUSDHist(saleRecognizedProfit(sl),s.currency,s);
    });
  });
  DEPT_ALL_KEYS.forEach(k=>{rows[k].profit=rows[k].net-rows[k].cost;});
  return rows;
}
function renderDashDeptCard(salesList){
  if(!salesList||!salesList.length)return '';
  const rows=dashDeptRows(salesList),keys=DEPT_ALL_KEYS.filter(k=>rows[k].count>0);
  if(!keys.length)return '';
  const tot=keys.reduce((a,k)=>({net:a.net+rows[k].net,cost:a.cost+rows[k].cost,discount:a.discount+rows[k].discount,gross:a.gross+rows[k].gross,rp:a.rp+rows[k].recognizedProfit}),{net:0,cost:0,discount:0,gross:0,rp:0});
  const m=(p,n)=>n>0?(p/n*100).toFixed(1)+'%':'—';
  return `<div class="card" style="margin-bottom:18px">
    <div class="section-title"><i class="ti ti-layout-grid"></i> المبيعات حسب القسم <span style="font-size:10px;color:var(--text2);font-weight:400">(الفترة الحالية، بالدولار)</span>${infoTip('القسم بيتحدد لكل بند (الافتراضي من نوع الجهاز). الخصم بيتوزع على الأقسام بنسبة مبيعات كل قسم. مجموع الأقسام = إجمالي المبيعات بالبطاقات. الربح المحقق حسب التحصيل بعد العمولة.')}</div>
    <div style="overflow-x:auto"><table>
      <thead><tr><th>القسم</th><th>فواتير</th><th>المبيع</th><th>حصته من الخصم</th><th>الصافي</th><th>التكلفة</th><th>الربح</th><th>الهامش</th><th>الربح المحقق</th></tr></thead>
      <tbody>${keys.map(k=>{const r=rows[k];return `<tr><td>${deptBadgeHTML(k)}</td><td>${r.count}</td><td>${finValUSD(r.gross,'total')}</td><td>${finValUSD(r.discount,'total')}</td><td style="font-weight:700">${finValUSD(r.net,'total')}</td><td style="color:var(--danger)">${finValUSD(r.cost,'total')}</td><td style="color:var(--accent);font-weight:700">${finValUSD(r.profit,'profit')}</td><td>${canViewProfits()?m(r.profit,r.net):'••••'}</td><td>${finValUSD(r.recognizedProfit,'profit')}</td></tr>`;}).join('')}</tbody>
      <tfoot><tr class="summary-row"><td>المجموع</td><td></td><td>${finValUSD(tot.gross,'total')}</td><td>${finValUSD(tot.discount,'total')}</td><td>${finValUSD(tot.net,'total')}</td><td style="color:var(--danger)">${finValUSD(tot.cost,'total')}</td><td style="color:var(--accent)">${finValUSD(tot.net-tot.cost,'profit')}</td><td>${canViewProfits()?m(tot.net-tot.cost,tot.net):'••••'}</td><td>${finValUSD(tot.rp,'profit')}</td></tr></tfoot>
    </table></div></div>`;
}

function renderDashboard(el,acts){
  const {from,to}=dashPeriodBounds();
  const opsReady=_ensureOpsForDashboard();
  const T=dashRangeTotals(from,to,opsReady); // T26: مصدر واحد للبطاقات والمقارنة والأشهر
  const isFiltered=!!(from||to);
  const salesF=db.sales.filter(x=>dashInRange(x.date,from,to));
  const maintF=db.maintenance.filter(m=>dashInRange(m.startDate,from,to));
  const quotesF=db.quotes.filter(q=>dashInRange(q.date,from,to));
  const workerPaymentsF=db.workerPayments.filter(p=>dashInRange(p.date,from,to));

  // ملاحظة: كل المبالغ أدناه تُحوَّل فوراً إلى الدولار (toUSD) حسب عملة كل سجل (SYP افتراضياً أو USD إن
  // كانت الفاتورة/العملية مسجّلة بالدولار)، حتى تظهر لوحة التحكم موحّدة بالدولار بغض النظر عن عملة الإدخال.
  const totalSales=T.salesRev;
  const totalCost=salesF.reduce((s,x)=>s+toUSDHist(x.totalCost,x.currency,x),0);
  // الربح من المبيعات يُحسب فقط للفواتير المسددة بالكامل
  // ربح المبيعات يتحقق تدريجياً حسب نسبة المبلغ المسدد فعلياً من كل فاتورة
  const paidSalesRevenue=salesF.reduce((s,x)=>s+toUSDHist(saleRecognizedRevenue(x),x.currency,x),0);
  const paidSalesCost=salesF.reduce((s,x)=>s+toUSDHist(saleRecognizedCost(x),x.currency,x),0);
  // حساب الأرباح من الأعمال المسددة فقط (حالة الشغل لا تدخل بالحسابات)
  const totalMaintenanceIncome=maintF.reduce((s,m)=>s+toUSDHist(maintRecognizedIncome(m),m.currency,m),0);
  const totalMaintenanceWages=maintF.reduce((s,m)=>s+toUSDHist(maintRecognizedWages(m),m.currency,m),0);
  const totalMaintenanceExpenses=maintF.reduce((s,m)=>s+toUSDHist(maintRecognizedExpenses(m),m.currency,m),0);
  // إجمالي العمولات المستحقة على الأرباح المحققة (مبيعات + أعمال) — مقسّمة مدفوعة/معلقة
  const totalReferralCommissions=salesF.reduce((s,x)=>s+toUSDHist(saleReferralCommission(x),x.currency,x),0)+maintF.reduce((s,m)=>s+toUSDHist(maintReferralCommission(m),m.currency,m),0);
  const unpaidReferralCommissions=salesF.filter(x=>!x.commissionPaid).reduce((s,x)=>s+toUSDHist(saleReferralCommission(x),x.currency,x),0)+maintF.filter(m=>!m.commissionPaid).reduce((s,m)=>s+toUSDHist(maintReferralCommission(m),m.currency,m),0);
  // عمولات المشاريع الكاملة (مسجّلة مرة وحدة على المشروع، مو على كل فاتورة/عمل لحاله) — لازم تنضاف لنفس إجمالي العمولات حتى ما تضيع من لوحة التحكم
  const {total:totalProjectCommissions,unpaid:unpaidProjectCommissions}=
    opsReady?projectCommissionsInRange(from,to,true):{total:0,unpaid:0};
  const totalReferralAndProjectCommissions=totalReferralCommissions+totalProjectCommissions;
  const unpaidReferralAndProjectCommissions=unpaidReferralCommissions+unpaidProjectCommissions;
  // جزء من الإجمالي أعلاه هو "تسويات يدوية" (مش عمولة فعلية) — بنعرضه لحاله بالتلميح حتى ما يضلل بمتوسط العمولة الحقيقي
  const settlementReferralCommissions=salesF.filter(x=>x.commissionSettlement).reduce((s,x)=>s+toUSDHist(saleReferralCommission(x),x.currency,x),0)+maintF.filter(m=>m.commissionSettlement).reduce((s,m)=>s+toUSDHist(maintReferralCommission(m),m.currency,m),0);
  const totalProfit=T.profit; // = (محقق المبيعات + محقق الأعمال) − العمولات (T26: نفس الدالة بالبطاقات وبالأشهر)
  // "رواتب معلقة" لازم تشمل مصدرين: دفعات العمال المسجلة يدوياً (workerPayments)
  // + أجور الأعمال (maintenance) غير المسددة بعد — نفس المنطق المستخدم بالضبط
  // ببطاقة "رصيد العمال المعلق" تحت وبصفحة ملخص العمال، حتى ما يختلف الرقمين.
  // دفعات العمال اليدوية تُدخل حالياً بالليرة السورية دائماً (toUSD تحوّلها تلقائياً حسب سعر الصرف)
  const unpaidWorkerPayments=workerPaymentsF.filter(p=>!p.paid).reduce((s,p)=>s+toUSD(p.amount,p.currency),0);
  const unpaidMaintenanceWages=maintF.reduce((s,m)=>{
    const we=m.workers?m.workers.filter(mw=>!mw.paid):[];
    return s+we.reduce((a,mw)=>a+toUSD(+mw.wage||0,mw.currency||m.workersCurrency||m.currency),0);
  },0);
  // مهم جداً: الفائض/الرصيد بيخص عامل معيّن بس، فما يجوز نجمع فوائض كل العمال ونطرحها مرة وحدة
  // من إجمالي المستحق لكل العمال (هيك فائض عامل ممكن "يغطي" ديون عامل تاني بالغلط بلوحة التحكم).
  // لازم نحسب لكل عامل على حدة: المستحق عليه ناقص فائضه هو بس (وما ينزل تحت صفر)، وبعدين نجمع
  // النتائج — بالضبط متل صفحة "ملخص العمال" (renderWorkerSummary بـ people.js).
  const unpaidWorkers=(db.workers||[]).reduce((total,w)=>{
    const unpaidP=workerPaymentsF.filter(p=>p.workerId===w.id&&!p.paid).reduce((s,p)=>s+toUSD(p.amount,p.currency),0);
    const unpaidW=maintF.reduce((s,m)=>{
      const we=m.workers?m.workers.filter(mw=>mw.workerId===w.id&&!mw.paid):[];
      return s+we.reduce((a,mw)=>a+toUSD(+mw.wage||0,mw.currency||m.workersCurrency||m.currency),0);
    },0);
    const creditW=getWorkerCreditUSD(w.id); // رصيد/فائض مدفوع فعلياً لهاد العامل بالذات ولسا ما انطبق على أجرة محددة
    return total+Math.max(0,unpaidP+unpaidW-creditW);
  },0);
  const pendingMaint=maintF.filter(m=>m.status!=='مكتملة'&&m.status!=='ملغاة').length;
  // ديون الموردين هي رصيد قائم حتى اليوم (غير مرتبطة بفترة زمنية) لذلك تبقى إجمالية دائماً
  // (كل عملية سحب بضاعة لها عملتها الخاصة، وتُحوَّل تلقائياً للدولار)
  const totalSupplierDebt=db.suppliers.reduce((s,sup)=>s+getSupplierDebtUSD(sup),0);
  // مستحق من فواتير/أعمال الفترة المحددة
  const salesDebt=salesF.reduce((s,x)=>s+toUSDHist(saleRemaining(x),x.currency,x),0);
  const maintenanceDebt=maintF.reduce((s,m)=>s+toUSDHist(maintRemaining(m),m.currency,m),0);
  const totalClientDebt=salesDebt+maintenanceDebt;

  // ===== ملخص تراكمي شامل للمصاريف (كل الفترات، بغض النظر عن فلتر الداشبورد) =====
  // كل رقم هون منحسب مباشرة من مصدره الأصلي (قائمة مستقلة بالنظام)، ما في أي كتابة/تسجيل جديد هون —
  // فقط عرض/تجميع للقراءة، حتى ما يصير أي تكرار أو تداخل مع الحسابات الموجودة أصلاً بكل صفحة.
  const ovGeneralExpenses=generalExpensesTotalUSD(); // شراء عدة + مصاريف عامة يدوية (لائحة العدة)
  const ovWorkerPaymentsPaid=(db.workerPayments||[]).filter(p=>p.paid).reduce((s,p)=>s+toUSD(+p.amount||0,p.currency),0); // دفعات عمال مسجّلة يدوياً ومسددة فعلياً
  const ovMaintWagesPaid=(db.maintenance||[]).reduce((s,m)=>s+(m.workers||[]).filter(w=>w.paid).reduce((a,w)=>a+toUSD(+w.wage||0,w.currency||m.workersCurrency||m.currency),0),0); // أجور عمال ضمن الأشغال، المسددة فقط
  const ovCarExpenses=(db.cars||[]).reduce((s,c)=>s+(c.expenses||[]).reduce((a,e)=>a+toUSD(+e.amount||0,e.currency),0),0)
    +(db.maintenance||[]).reduce((s,m)=>s+(m.cars||[]).reduce((a,mc)=>a+toUSDHist(+mc.amount||0,mc.currency||m.carsCurrency||m.currency,m),0),0); // مصاريف السيارات (المسجّلة من صفحة السيارات + المرتبطة بأشغال)
  const ovJobExpenses=(db.maintenance||[]).reduce((s,m)=>s+(m.expenses||[]).reduce((a,e)=>a+toUSDHist(+e.amount||0,e.currency||m.expensesCurrency||m.currency,m),0),0); // مصاريف مسجّلة داخل الأشغال نفسها (غير مصاريف السيارات)
  const ovGrandTotal=ovGeneralExpenses+ovWorkerPaymentsPaid+ovMaintWagesPaid+ovCarExpenses+ovJobExpenses;

  // أفضل عميل حسب إجمالي التعامل بالفترة المحددة (مبيعات + أعمال صيانة) — موحّد بالدولار
  const clientRevenue={};
  salesF.forEach(x=>{clientRevenue[x.clientId]=(clientRevenue[x.clientId]||0)+toUSDHist(x.totalPrice,x.currency,x);});
  maintF.forEach(m=>{clientRevenue[m.clientId]=(clientRevenue[m.clientId]||0)+toUSDHist(getMaintenanceIncome(m),m.currency,m);});
  let topClientId=null,topClientRevenue=0;
  Object.entries(clientRevenue).forEach(([cid,rev])=>{if(rev>topClientRevenue){topClientRevenue=rev;topClientId=cid;}});

  // مقارنة الفترة بالفترة السابقة (periodShift: شهر←شهر، سنة←سنة، غير هيك بنفس عدد الأيام). بدون فلتر: الشهر الحالي مقابل الماضي.
  const now=new Date();
  const dashPr=periodResolve('dash',DASH_PERIOD_DEF);
  let curPeriodRev=0,prevPeriodRev=0,periodLabel='إيراد هذا الشهر',deltaLabel='مقارنة بالشهر الماضي',hasPrev=true;
  if(!isFiltered){
    const cm=periodMonthBounds(now.getFullYear(),now.getMonth()),pm=periodMonthBounds(now.getFullYear(),now.getMonth()-1);
    curPeriodRev=dashRangeTotals(cm.from,cm.to,opsReady).revenue;
    prevPeriodRev=dashRangeTotals(pm.from,pm.to,opsReady).revenue;
  }else{
    curPeriodRev=T.revenue;
    periodLabel='إيراد الفترة المحددة';
    if(dashPr.prev){
      prevPeriodRev=dashRangeTotals(dashPr.prev.from,dashPr.prev.to,opsReady).revenue;
      deltaLabel='مقارنة بالفترة السابقة ('+fmtDate(dashPr.prev.from)+' – '+fmtDate(dashPr.prev.to)+')';
    }else{hasPrev=false;deltaLabel='مقارنة بالفترة السابقة (غير متاحة لفترة مفتوحة)';}
  }
  const monthDelta=prevPeriodRev>0?Math.round(((curPeriodRev-prevPeriodRev)/prevPeriodRev)*100):(curPeriodRev>0?100:0);

  // ===== بيانات الرسوم: أشهر الفترة المختارة (آخر 12 شهر بحد أقصى) — نفس مصدر بطاقات الأرقام =====
  const monthSer=dashMonthRows(from,to,opsReady,12);
  const chartLabels=monthSer.rows.map(r=>r.short);
  const chartRevData=monthSer.rows.map(r=>Math.round(r.revenue));
  const chartProfitData=monthSer.rows.map(r=>Math.round(r.profit));
  // توزيع مصدر الإيراد بالفترة المحددة: مبيعات مقابل أعمال صيانة
  const revSalesSlice=Math.round(totalSales);
  const revMaintSlice=Math.round(maintF.reduce((s,m)=>s+toUSDHist(getMaintenanceIncome(m),m.currency,m),0));

  // تنبيه النسخة الاحتياطية
  const lastBackup=db.meta&&db.meta.lastBackupDate?db.meta.lastBackupDate:'';
  const daysSinceBackup=lastBackup?Math.floor((now-new Date(lastBackup))/86400000):Infinity;
  const showBackupBanner=daysSinceBackup>7||!lastBackup;

  el.innerHTML=`
  ${showBackupBanner?`<div id="backup-banner" style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--warning-bg);border:1px solid #fde68a;border-radius:12px;padding:12px 16px;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--warning)"><i class="ti ti-alert-triangle" style="font-size:18px"></i>
      <span>${lastBackup?`آخر نسخة احتياطية كانت منذ ${daysSinceBackup} يوم — يُفضّل أخذ نسخة جديدة.`:'لم يتم أخذ أي نسخة احتياطية بعد — بياناتك محفوظة فقط على هذا المتصفح.'}</span>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0"><button class="btn btn-sm btn-primary" onclick="exportData()"><i class="ti ti-download"></i> نسخ احتياطي الآن</button><button class="btn btn-sm" onclick="document.getElementById('backup-banner').remove()">إغلاق</button></div>
  </div>`:''}
  ${renderSmartAlerts()}
  <div class="card" style="margin-bottom:18px">
    ${periodBarHTML('dash',dashRerender,DASH_PERIOD_DEF)}
    <div style="font-size:12px;color:var(--text2);margin-top:10px">${isFiltered?`القيم المالية أدناه محسوبة ${from?`من ${fmtDate(from)} `:''}${to?`إلى ${fmtDate(to)}`:''}`:'القيم المالية أدناه لكامل الفترة منذ البداية (نظرة شاملة)'}</div>
  </div>
  <div class="dash-group-title">الأداء المالي</div>
  <div class="grid-4" style="margin-bottom:22px">
    <div class="metric-card"><div class="metric-label">إجمالي المبيعات <span style="font-size:9px;color:var(--text2);font-weight:400">(بالدولار)</span></div><div class="metric-value blue">${finValUSD(totalSales)}</div></div>
    <div class="metric-card"><div class="metric-label">صافي الربح <span style="font-size:9px;color:var(--text2);font-weight:400">(بالدولار)</span>${infoTip('من المحصّل فعلياً بس.')}</div><div class="metric-value ${totalProfit>=0?'green':'red'}">${finValUSD(totalProfit,'profit')}</div></div>
    <div class="metric-card"><div class="metric-label">رواتب معلقة <span style="font-size:9px;color:var(--text2);font-weight:400">(بالدولار)</span></div><div class="metric-value amber">${finValUSD(unpaidWorkers,'salary')}</div></div>
    <div class="metric-card"><div class="metric-label">ديون الموردين <span style="font-size:9px;color:var(--text2);font-weight:400">(رصيد حالي، بالدولار)</span></div><div class="metric-value red">${finValUSD(totalSupplierDebt)}</div></div>
  </div>
  <div class="dash-group-title">العملاء والفترة الحالية</div>
  <div class="grid-4" style="margin-bottom:22px">
    <div class="metric-card"><div class="metric-label">مستحق من العملاء <span style="font-size:9px;color:var(--text2);font-weight:400">(بالدولار)</span></div><div class="metric-value red">${finValUSD(totalClientDebt)}</div></div>
    <div class="metric-card"><div class="metric-label">أفضل عميل</div><div class="metric-value" style="font-size:15px">${topClientId?esc(getClientName(topClientId)):'—'}</div>${topClientId?`<div style="font-size:11px;color:var(--text2);margin-top:2px">${finValUSD(topClientRevenue)}</div>`:''}</div>
    <div class="metric-card"><div class="metric-label">${periodLabel} <span style="font-size:9px;color:var(--text2);font-weight:400">($)</span></div><div class="metric-value blue">${finValUSD(curPeriodRev)}</div></div>
    <div class="metric-card"><div class="metric-label">${deltaLabel}</div><div class="metric-value ${hasPrev?(monthDelta>=0?'green':'red'):''}">${hasPrev?(monthDelta>=0?'+':'')+monthDelta+'%':'—'}</div></div>
  </div>
  <div class="dash-group-title">العمليات والنشاط</div>
  <div class="grid-4" style="margin-bottom:22px">
    <div class="metric-card"><div class="metric-label">ورش <span style="font-size:9px;color:var(--text2);font-weight:400">(قيد التنفيذ / إجمالي)</span></div><div class="metric-value">${pendingMaint} <span style="font-size:13px;color:var(--text2);font-weight:400">/ ${maintF.length}</span></div></div>
    <div class="metric-card"><div class="metric-label">عروض أسعار <span style="font-size:9px;color:var(--text2);font-weight:400">(معلق / إجمالي)</span></div><div class="metric-value">${quotesF.filter(q=>q.status==='معلق').length} <span style="font-size:13px;color:var(--text2);font-weight:400">/ ${quotesF.length}</span></div></div>
    <div class="metric-card"><div class="metric-label">إجمالي العملاء</div><div class="metric-value">${db.clients.length}</div></div>
    <div class="metric-card" title="عمولات مدفوعة: ${fmtUSD(totalReferralAndProjectCommissions-unpaidReferralAndProjectCommissions)}${totalProjectCommissions>0?` — منها عمولات مشاريع كاملة: ${fmtUSD(totalProjectCommissions)}`:''}${settlementReferralCommissions>0?` — يشمل تسويات يدوية (مش عمولة فعلية): ${fmtUSD(settlementReferralCommissions)}`:''}"><div class="metric-label">عمولات <span style="font-size:9px;color:var(--text2);font-weight:400">(معلق / إجمالي، بالدولار)</span></div><div class="metric-value ${unpaidReferralAndProjectCommissions>0?'red':'green'}">${finValUSD(unpaidReferralAndProjectCommissions)} <span style="font-size:12px;color:var(--text2);font-weight:400">/ ${finValUSD(totalReferralAndProjectCommissions)}</span></div>${settlementReferralCommissions>0?`<div style="font-size:9px;color:var(--text2);margin-top:2px">منها تسويات يدوية: ${fmtUSD(settlementReferralCommissions)}</div>`:''}${totalProjectCommissions>0?`<div style="font-size:9px;color:var(--text2);margin-top:2px">منها عمولات مشاريع كاملة: ${fmtUSD(totalProjectCommissions)}</div>`:''}</div>
  </div>
  <div class="card" style="margin-bottom:18px">
    <div class="section-title"><i class="ti ti-report-money"></i> ملخص تراكمي شامل للمصاريف <span style="font-size:10px;color:var(--text2);font-weight:400">(منذ البداية، بالدولار)</span></div>
    <div style="overflow-x:auto"><table><thead><tr><th>البند</th><th>المصدر</th><th>الإجمالي ($)</th></tr></thead><tbody>
      <tr><td>شراء عدة + مصاريف عامة أخرى</td><td class="muted" style="font-size:12px">صفحة المصاريف العامة</td><td style="font-weight:700">${finValUSD(ovGeneralExpenses)}</td></tr>
      <tr><td>أجور عمال مدفوعة (دفعات يدوية)</td><td class="muted" style="font-size:12px">صفحة العمال</td><td style="font-weight:700">${finValUSD(ovWorkerPaymentsPaid,'salary')}</td></tr>
      <tr><td>أجور عمال مدفوعة (ضمن الأشغال)</td><td class="muted" style="font-size:12px">صفحة الأشغال</td><td style="font-weight:700">${finValUSD(ovMaintWagesPaid,'salary')}</td></tr>
      <tr><td>مصاريف سيارات (بنزين، صيانة...)</td><td class="muted" style="font-size:12px">صفحة السيارات + المرتبط بأشغال</td><td style="font-weight:700">${finValUSD(ovCarExpenses)}</td></tr>
      <tr><td>مصاريف مسجّلة داخل الأشغال</td><td class="muted" style="font-size:12px">صفحة الأشغال</td><td style="font-weight:700">${finValUSD(ovJobExpenses)}</td></tr>
      <tr class="summary-row"><td colspan="2">الإجمالي الكلي التراكمي</td><td style="font-weight:800">${finValUSD(ovGrandTotal)}</td></tr>
    </tbody></table></div>
  </div>
  ${renderReferrerBreakdownCard()}
  ${renderDashDeptCard(salesF)}
  ${renderDashMonthsCard(monthSer)}
  <div class="grid-2" style="margin-bottom:18px">
    <div class="card">
      <div class="section-title">الإيراد والربح بالأشهر <span style="font-size:10px;color:var(--text2);font-weight:400">(بالدولار)</span></div>
      <div style="position:relative;height:260px"><canvas id="dashChartTrend"></canvas></div>
    </div>
    <div class="card">
      <div class="section-title">مصدر الإيراد <span style="font-size:10px;color:var(--text2);font-weight:400">(الفترة الحالية، بالدولار)</span></div>
      <div style="position:relative;height:260px;display:flex;align-items:center;justify-content:center">
        ${(revSalesSlice+revMaintSlice)>0?'<canvas id="dashChartSource"></canvas>':'<div class="empty-state"><i class="ti ti-chart-pie"></i><p>لا يوجد بيانات لهذه الفترة</p></div>'}
      </div>
    </div>
  </div>
  <div class="card" style="margin-bottom:18px">
    <div class="section-title">صافي الربح بالأشهر <span style="font-size:10px;color:var(--text2);font-weight:400">(بالدولار)</span></div>
    <div style="position:relative;height:220px"><canvas id="dashChartProfitBar"></canvas></div>
  </div>
  <div class="grid-2">
    <div class="card">
      <div class="section-title">آخر الأعمال</div>
      ${maintF.slice(-6).reverse().map(m=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-weight:600;font-size:13px">${esc(getClientName(m.clientId))}${m.branch?' — <span style="color:var(--text2)">'+esc(m.branch)+'</span>':''}</div>
            <div style="font-size:11px;color:var(--text2);margin-top:2px">${m.workers&&m.workers.length?m.workers.map(w=>maskWorkerName(w.workerName)).join('، '):''} · ${fmtDate(m.startDate)}</div>
          </div>
          <span class="badge ${m.status==='مكتملة'?'badge-green':m.status==='ملغاة'?'badge-red':'badge-amber'}">${m.status||'جارية'}</span>
        </div>
      `).join('')||`<div class="empty-state" style="padding:30px"><i class="ti ti-tool"></i><p>لا يوجد أعمال ${isFiltered?'بهذه الفترة':''}</p></div>`}
    </div>
    <div class="card">
      <div class="section-title">رصيد العمال المعلق <span style="font-size:10px;color:var(--text2);font-weight:400">(بالدولار)</span></div>
      ${(()=>{
        const rows=db.workers.map(w=>{
          const pending=workerPaymentsF.filter(p=>p.workerId===w.id&&!p.paid).reduce((s,p)=>s+toUSD(+p.amount||0,p.currency),0);
          const maintPending=maintF.reduce((s,m)=>{const we=m.workers?m.workers.filter(mw=>mw.workerId===w.id&&!mw.paid):[];return s+we.reduce((a,mw)=>a+toUSD(+mw.wage||0,mw.currency||m.workersCurrency||m.currency),0);},0);
          return {name:w.name,total:Math.max(0,pending+maintPending-getWorkerCreditUSD(w.id))};
        }).filter(r=>r.total>0.005).sort((a,b)=>b.total-a.total);
        if(!rows.length)return '<div class="empty-state" style="padding:30px"><i class="ti ti-check"></i><p>كل الرواتب مسددة</p></div>';
        const max=Math.max(...rows.map(r=>r.total));
        return rows.map(r=>`<div style="padding:9px 0">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
            <span style="font-size:13px;font-weight:600">${esc(r.name)}</span>
            <span style="color:var(--salary);font-weight:700;font-size:13px">${finValUSD(r.total,'salary')}</span>
          </div>
          <div style="height:6px;border-radius:4px;background:var(--bg3);overflow:hidden"><div style="height:100%;width:${max?(r.total/max*100):0}%;border-radius:4px;background:var(--salary)"></div></div>
        </div>`).join('');
      })()}
    </div>
  </div>`;

  // ===== تهيئة الرسوم البيانية =====
  // chart.js صار يتحمّل هون عند الحاجة بدل ما يتحمّل بكل فتحة للتطبيق.
  // الصفحة بتظهر وبتشتغل فوراً، والرسوم بتنرسم أول ما توصل المكتبة.
  if(typeof Chart==='undefined'){
    loadLib('chart').then(function(){
      if(currentPage==='dashboard')render();
    }).catch(function(e){console.error('chart.js load failed:',e);});
  }
  if(typeof Chart!=='undefined'){
    Chart.defaults.font.family="'IBM Plex Sans Arabic',Segoe UI,Tahoma,Arial,sans-serif";
    [window._dashChartTrend,window._dashChartSource,window._dashChartProfitBar].forEach(c=>{if(c)c.destroy();});
    window._dashChartTrend=window._dashChartSource=window._dashChartProfitBar=null;

    const cv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const hexA=(hex,a)=>{hex=(hex||'#000000').replace('#','');if(hex.length===3)hex=hex.split('').map(c=>c+c).join('');const r=parseInt(hex.substr(0,2),16)||0,g=parseInt(hex.substr(2,2),16)||0,b=parseInt(hex.substr(4,2),16)||0;return `rgba(${r},${g},${b},${a})`;};
    const cAccent=cv('--accent'),cAccentDark=cv('--accent-dark'),cGold=cv('--gold'),cGoldDark=cv('--gold-dark'),
          cSuccess=cv('--success'),cDanger=cv('--danger'),cText2=cv('--text2'),cGrid=cv('--border'),cSurface=cv('--surface');
    const tooltipCommon={backgroundColor:cAccentDark,titleColor:'#fff',bodyColor:'#fff',padding:11,cornerRadius:10,titleFont:{size:12,weight:'700'},bodyFont:{size:12},boxPadding:5};

    const trendEl=document.getElementById('dashChartTrend');
    if(trendEl){
      const ctx=trendEl.getContext('2d');
      const revGrad=ctx.createLinearGradient(0,0,0,260);
      revGrad.addColorStop(0,hexA(cAccent,.9));
      revGrad.addColorStop(1,hexA(cAccent,.35));
      const profitGrad=ctx.createLinearGradient(0,0,0,260);
      profitGrad.addColorStop(0,hexA(cGold,.32));
      profitGrad.addColorStop(1,hexA(cGold,0));
      window._dashChartTrend=new Chart(trendEl,{
        data:{labels:chartLabels,datasets:[
          {type:'bar',label:'الإيراد',data:chartRevData,backgroundColor:revGrad,borderRadius:8,maxBarThickness:34,order:2},
          {type:'line',label:'الربح',data:chartProfitData,borderColor:cGold,backgroundColor:profitGrad,fill:true,tension:.4,borderWidth:2.5,pointRadius:4,pointHoverRadius:6,pointBackgroundColor:cSurface,pointBorderColor:cGold,pointBorderWidth:2,order:1}
        ]},
        options:{
          responsive:true,maintainAspectRatio:false,
          interaction:{mode:'index',intersect:false},
          plugins:{
            legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'circle',boxWidth:8,padding:16,font:{size:11},color:cText2}},
            tooltip:{...tooltipCommon,displayColors:true,callbacks:{label:c=>' '+c.dataset.label+': $'+c.raw.toLocaleString()}}
          },
          scales:{
            y:{ticks:{callback:v=>'$'+(v>=1000?(v/1000)+'k':v),font:{size:10},color:cText2},grid:{color:cGrid,drawBorder:false},border:{display:false}},
            x:{ticks:{font:{size:11},color:cText2},grid:{display:false},border:{display:false}}
          }
        }
      });
    }

    const sourceEl=document.getElementById('dashChartSource');
    if(sourceEl){
      window._dashChartSource=new Chart(sourceEl,{
        type:'doughnut',
        data:{labels:['مبيعات','أعمال صيانة'],datasets:[{data:[revSalesSlice,revMaintSlice],backgroundColor:[cAccent,cGold],hoverBackgroundColor:[cAccentDark,cGoldDark],borderWidth:3,borderColor:cSurface,hoverOffset:6}]},
        options:{
          responsive:true,maintainAspectRatio:false,cutout:'68%',
          plugins:{
            legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'circle',boxWidth:8,padding:16,font:{size:11},color:cText2}},
            tooltip:{...tooltipCommon,callbacks:{label:c=>{const tot=c.dataset.data.reduce((a,b)=>a+b,0);const pct=tot?Math.round(c.raw/tot*100):0;return ' '+c.label+': $'+c.raw.toLocaleString()+' ('+pct+'%)';}}}
          }
        }
      });
    }


    const profitBarEl=document.getElementById('dashChartProfitBar');
    if(profitBarEl){
      const barColors=chartProfitData.map(v=>v>=0?cSuccess:cDanger);
      window._dashChartProfitBar=new Chart(profitBarEl,{
        type:'bar',
        data:{labels:chartLabels,datasets:[{label:'صافي الربح',data:chartProfitData,backgroundColor:barColors,borderRadius:8,maxBarThickness:34}]},
        options:{
          responsive:true,maintainAspectRatio:false,
          plugins:{
            legend:{display:false},
            tooltip:{...tooltipCommon,callbacks:{label:c=>' $'+c.raw.toLocaleString()}}
          },
          scales:{
            y:{ticks:{callback:v=>'$'+(Math.abs(v)>=1000?(v/1000)+'k':v),font:{size:10},color:cText2},grid:{color:cGrid,drawBorder:false},border:{display:false}},
            x:{ticks:{font:{size:11},color:cText2},grid:{display:false},border:{display:false}}
          }
        }
      });
    }
  }
}

/* ===== MAINTENANCE ===== */
function getClientDebt(clientId){
  if(!clientId)return 0;
  let debt=0;
  // موحّد بالليرة السورية (نفس عملة عتبة الدين المحفوظة بالإعدادات) لأن أعمال/فواتير العميل ممكن تكون بعملات مختلفة
  (db.maintenance||[]).forEach(m=>{
    if(m.clientId===clientId){
      const rem=maintRemaining(m);
      if(rem>0)debt+=convertCurrency(rem,m.currency||'SYP','SYP');
    }
  });
  (db.sales||[]).forEach(s=>{
    if(s.clientId===clientId){
      const rem=saleRemaining(s);
      if(rem>0)debt+=convertCurrency(rem,s.currency||'SYP','SYP');
    }
  });
  return debt;
}
function getDebtThreshold(){
  if(!db.settings)db.settings={};
  return +db.settings.debtThreshold||5000000;
}
function getVipThreshold(){
  if(!db.settings)db.settings={};
  return +db.settings.vipThreshold||10000000;
}
// T37: أساس هامش واحد لكل الشاشات: (الإيراد − التكلفة) ÷ الإيراد × 100 — null لو الإيراد صفر أو أقل
function marginPctOf(revenue,cost){const r=+revenue||0;return r>0?((r-(+cost||0))/r)*100:null;}
function getLowMarginPercent(){
  if(!db.settings)db.settings={};
  return db.settings.lowMarginPercent===undefined||db.settings.lowMarginPercent===''?15:+db.settings.lowMarginPercent;
}
function getQuoteFollowupDays(){
  if(!db.settings)db.settings={};
  return +db.settings.quoteFollowupDays||7;
}
function getSupplierDueDays(){
  if(!db.settings)db.settings={};
  return +db.settings.supplierDueDays||15;
}
function getBonusEfficiencyThreshold(){
  if(!db.settings)db.settings={};
  return db.settings.bonusEfficiencyThreshold===undefined||db.settings.bonusEfficiencyThreshold===''?1.2:+db.settings.bonusEfficiencyThreshold;
}
function getBonusMinDays(){
  if(!db.settings)db.settings={};
  return +db.settings.bonusMinDays||5;
}
// إجمالي حجم تعامل العميل (مبيعات + أعمال) — يُستخدم لتصنيف VIP وغيره
// موحّد بالليرة السورية (نفس وحدة عتبة VIP) عبر convertCurrency، لأن سجلات العميل قد تكون بعملات مختلفة
function getClientTotalRevenue(clientId){
  const salesRev=db.sales.filter(s=>s.clientId===clientId).reduce((s,x)=>s+convertCurrency(x.totalPrice||0,x.currency,'SYP'),0);
  const maintRev=db.maintenance.filter(m=>m.clientId===clientId).reduce((s,m)=>s+convertCurrency(getMaintenanceTotal(m),m.currency,'SYP'),0);
  return salesRev+maintRev;
}
function isVipClient(clientId){
  return getClientTotalRevenue(clientId)>=getVipThreshold();
}
// اقتراح سعر تلقائي بالاعتماد على آخر سعر بيع لنفس الصنف (من المبيعات أو عروض الأسعار)
// موحّد بعملة الفاتورة/العرض الحالي (targetCurrency) لأن الأسعار التاريخية ممكن تكون مسجّلة بعملات مختلفة
function getSuggestedPrice(deviceType,targetCurrency){
  if(!deviceType)return null;
  const tCur=targetCurrency==='USD'?'USD':'SYP';
  const candidates=[];
  (db.sales||[]).forEach(s=>{
    (s.items||[]).forEach(it=>{
      if(it.type===deviceType&&(+it.salePrice>0))candidates.push({price:convertCurrency(+it.salePrice,s.currency||'SYP',tCur),date:s.date||''});
    });
  });
  (db.quotes||[]).forEach(q=>{
    (q.items||[]).forEach(it=>{
      if(it.desc===deviceType&&(+it.price>0))candidates.push({price:convertCurrency(+it.price,q.currency||'SYP',tCur),date:q.date||''});
    });
  });
  if(!candidates.length)return null;
  candidates.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  const last=candidates[0].price;
  const avg=candidates.reduce((s,c)=>s+c.price,0)/candidates.length;
  return {last,avg,count:candidates.length};
}
function checkClientDebtWarning(clientId){
  const threshold=getDebtThreshold();
  const debt=getClientDebt(clientId);
  if(debt>threshold){
    const name=getClientName(clientId);
    return confirm(`تنبيه: هاد العميل (${name}) عليه دين حالي قدره ${fmt(debt)} ل.س، وهو أكبر من الحد المسموح (${fmt(threshold)} ل.س).\nمتأكد بدك تضيف فاتورة جديدة؟`);
  }
  return true;
}
function getMaintenanceIncome(m){
  const total = +(m.workAmount||m.totalAmount||m.amount||0)||0;
  return round2(total - getMaintenanceAdvances(m));
}
function getMaintenanceTotal(m){return +(m.workAmount||m.totalAmount||m.amount||0)||0;}
/* ===== دوال عامة موحّدة (تُستخدم من المبيعات والصيانة معاً) =====
   المبيعات والصيانة عندهن نفس "شكل" حساب الدين والتحصيل بالضبط (فاتورة/عمل له قيمة إجمالية،
   مبلغ مسدد paidAmount، ودفعات payments ممكن يكون فيها خصم عند التحصيل discountConverted).
   الفرق الوحيد هو "الإجمالي": بالمبيعات هو totalPrice مباشرة، وبالصيانة هو getMaintenanceIncome(m)
   (يلي بيطرح السلف). فبدل ما نكرر نفس المنطق بدالتين لكل حالة (sale.../maint...)، منحطه هون مرة
   وحدة وكل الدوال المخصصة (تحت) بتنادي عليه — هيك أي تعديل مستقبلي على المنطق (مثلاً تغيير طريقة
   حساب الخصم) بصير بمكان واحد بس، وما بيصير فرق بين المبيعات والصيانة بالغلط. */
// مجموع "خصم عند التحصيل" لكل دفعات السجل (بعملة السجل)
function genDiscountTotal(record){return round2((+record.discAmount||0)||(record.payments||[]).reduce((sum,p)=>sum+(+p.discountConverted||0),0));}
// المتبقي الفعلي = الإجمالي - المدفوع كاش - الخصم عند التحصيل
function genRemaining(total,record){return Math.max(round2(round2(total)-round2(+record.paidAmount||0)-genDiscountTotal(record)),0);}
// نسبة ما تم تحصيله من قيمة السجل (0 إلى 1)
function genProgress(total,record){if(total<=0)return 0;return Math.min((+record.paidAmount||0)/total,1);}
// الإيراد المحقق فعلياً = المبلغ المسدد فقط (لا يتجاوز الإجمالي)
function genRecognizedAmount(total,record){return Math.min(+record.paidAmount||0,total);}
// هل السجل مسدد بالكامل؟
function genIsPaid(total,record){return total>0&&round2(+record.paidAmount||0)>=round2(total);}
function isSalePaid(s){return genIsPaid(+s.totalPrice||0,s);}
function saleDiscountTotal(s){return genDiscountTotal(s);}
function saleRemaining(s){return genRemaining(+s.totalPrice||0,s);}
// شارة حالة الدفع (مدفوعة/جزئي/غير مدفوعة) — نفس منطق العرض للمبيعات والصيانة، الفرق فقط بتسمية "مدفوعة" مقابل "مسددة"
function genStatusBadge(total,rem,paid,discountTotal,paidLabel){
  if(rem<=0&&total>0)return `<span class="badge badge-green">${paidLabel}</span>`;
  if(paid>0||discountTotal>0)return `<span class="badge badge-amber">جزئي — متبقي ${fmt(rem)}</span>`;
  return `<span class="badge badge-red">غير مدفوعة${total>0?' — '+fmt(rem):''}</span>`;
}
function saleStatusBadge(s){
  return genStatusBadge(+s.totalPrice||0,saleRemaining(s),+s.paidAmount||0,saleDiscountTotal(s),'مدفوعة');
}
// عرض مختصر لدفعات الفاتورة (تاريخ ومبلغ كل دفعة) داخل لائحة المبيعات، مع إمكانية التوسيع لعرض كل الدفعات
function renderSalePaymentsCell(s){
  const pays=(s.payments||[]).slice().sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
  if(pays.length===0)return `<span style="font-size:11px;color:var(--text3)">لا يوجد دفعات</span>`;
  const last=pays[pays.length-1];
  const rows=pays.map((p,i)=>`<tr>
      <td style="padding:4px 8px;font-size:11px;color:var(--text2)">${i+1}</td>
      <td style="padding:4px 8px;font-size:11px;white-space:nowrap">${fmtDate(p.date)}</td>
      <td style="padding:4px 8px;font-size:12px;font-weight:600">${fmt(p.amount)} <span style="font-size:9px;color:var(--text2)">${curLabel(p.currency||s.currency)}</span></td>
      <td style="padding:4px 8px;font-size:11px;color:var(--text2)">${esc(p.note||'')}</td>
    </tr>`).join('');
  return `<details class="opt-details" style="min-width:150px">
    <summary><span class="opt-badge">${pays.length} دفعة</span><span style="font-size:11px;color:var(--text2)">آخرها ${fmtDate(last.date)}</span></summary>
    <div class="opt-body"><table style="width:100%;border-collapse:collapse">${rows}</table></div>
  </details>`;
}
// نسبة ما تم تحصيله من قيمة الفاتورة (0 إلى 1)
function saleProgress(s){return genProgress(+s.totalPrice||0,s);}
// الإيراد المحقق فعلياً = المبلغ المسدد فقط (لا يتجاوز قيمة الفاتورة)
function saleRecognizedRevenue(s){return genRecognizedAmount(+s.totalPrice||0,s);}
// التكلفة/الأجر تُحتسب بنفس نسبة التحصيل، وبالتالي الربح يتحقق تدريجياً مع كل دفعة —
// نفس المنطق مستخدم لتكلفة المبيعات ولأجور/مصاريف الصيانة (تحت)، فموحّد بدالة وحدة.
function genRecognizedCost(costTotal,progress){return (+costTotal||0)*progress;}
// التكلفة تُحتسب بنفس نسبة التحصيل، وبالتالي الربح يتحقق تدريجياً مع كل دفعة
function saleRecognizedCost(s){return genRecognizedCost(s.totalCost,saleProgress(s));}
// عمولة: يا نسبة من الربح (فقط إذا كان الربح موجب)، يا مبلغ ثابت (بيُحسب دايماً بغض النظر عن الربح) — تُدفع لمن أوصى بالعميل
// commissionType: 'amount' = مبلغ ثابت، أي شي تاني (أو غير موجود، لتوافق السجلات القديمة) = نسبة %
// progress: نسبة التحصيل (0 إلى 1) لتوزيع "المبلغ الثابت" تدريجياً مع كل دفعة متل باقي التكاليف — مرّر null/undefined لأخذ المبلغ الكامل فوراً (نسخة "الربح الكلي")
function referralCommissionOnProfit(record,profit,progress){
  if(!record)return 0;
  const c=db.clients.find(x=>x.id===record.clientId);
  if(!c||!c.referrerName)return 0;
  if(record.commissionType==='amount'){
    const amt=+record.commissionAmount||0;
    if(amt<=0)return 0;
    return progress==null?amt:amt*progress;
  }
  if(!(+record.commissionPercent>0))return 0;
  return profit>0?profit*(+record.commissionPercent/100):0;
}
function saleReferralCommission(s){
  return referralCommissionOnProfit(s,saleRecognizedRevenue(s)-saleRecognizedCost(s),saleProgress(s));
}
// صيغة الربح موحّدة (إيراد - تكلفة - عمولة توصية) تُستخدم لكل من النسخة "المحققة" و"الكلية"، لكل من المبيعات والصيانة
function genProfit(revenue,cost,commission){return revenue-cost-commission;}
function saleRecognizedProfit(s){return genProfit(saleRecognizedRevenue(s),saleRecognizedCost(s),saleReferralCommission(s));}

/* ===== T46 / T47: قسما المبيعات — سيستم سيكيورتي / سيستم نتورك (دوال صرفة؛ الواجهة بـ ops.js و settings.js) =====
   القسم بيتحدد على مستوى البند (مو الفاتورة): الافتراضي من نوع الجهاز (db.deviceDepts، وإلا القائمة المقترحة تحت)،
   وبيتغيّر لأي بند بحقل item.department. النوع المشترك (Adapter, Battery...) بلا افتراضي: لو ما انختار قسم = "غير مصنّف".
   الخصم بيتوزع على الأقسام بنسبة مبيعات كل قسم، بطريقة "أكبر باقي" بالسنت: مجموع الحصص = الخصم الكلي بالضبط،
   ومجموع صافي الأقسام = إجمالي الفاتورة المخزّن بالضبط. فاتورة بقسم واحد بتعطي نفس أرقامها اليوم تماماً. */
const DEPT_KEYS=['security','network'];
const DEPT_ALL_KEYS=['security','network','unclassified'];
const DEPT_LABELS={security:'سيستم سيكيورتي',network:'سيستم نتورك',unclassified:'غير مصنّف',mixed:'مختلطة'};
const DEPT_SHORT={security:'سيكيورتي',network:'نتورك',unclassified:'غير مصنّف',mixed:'مختلطة'};
const DEFAULT_DEVICE_DEPT={Camera:'security',IPC:'security',NVR:'security',DVR:'security',BNC:'security','Co-Axial':'security','Extender HD':'security',Hard:'security',Fingerprint:'security',Switch:'network','Access Point':'network',Cat6:'network',Router:'network',Cabinet:'network','Star Link':'network'};
// قسم نوع جهاز: التعديل من الإعدادات (db.deviceDepts) بيفوز على القائمة المقترحة. 'shared' أو غير معروف = بلا قسم افتراضي
function deviceTypeDept(type){
  const m=(db&&db.deviceDepts)||{};
  const v=Object.prototype.hasOwnProperty.call(m,type)?m[type]:DEFAULT_DEVICE_DEPT[type];
  return DEPT_KEYS.indexOf(v)>=0?v:'';
}
// قسم بند: يدوي (item.department) ← افتراضي نوع الجهاز ← غير مصنّف. بند البيع نوعه type، وبند العرض نوعه desc (للمواد فقط، الأعمال/العمالة غير مصنّفة إلا باختيار يدوي)
function itemDept(it){
  if(it&&DEPT_KEYS.indexOf(it.department)>=0)return it.department;
  const t=it?(it.type!==undefined?it.type:(it.kind==='عمل'?'':it.desc)):'';
  return deviceTypeDept(t)||'unclassified';
}
// توزيع مبلغ (سنتات صحيحة) على أوزان بطريقة أكبر باقي: مجموع الناتج = المبلغ بالضبط
function _deptAllocate(total,weights){
  const n=weights.length,out=new Array(n).fill(0);
  if(!n||!total)return out;
  const sign=total<0?-1:1,T=Math.abs(total),sum=weights.reduce((a,b)=>a+b,0);
  if(!(sum>0)){out[0]=total;return out;}
  const raw=weights.map(w=>T*w/sum),base=raw.map(Math.floor);
  let rem=T-base.reduce((a,b)=>a+b,0);
  const order=raw.map((r,i)=>[r-base[i],i]).sort((a,b)=>b[0]-a[0]||a[1]-b[1]);
  for(let k=0;k<rem;k++)base[order[k%n][1]]++;
  return base.map(v=>v*sign);
}
// rows: [{dept,gross,cost}] بعملة السجل — netTotal: الصافي المخزّن بالسجل (بعد الخصم)
function _deptBreakdown(rows,netTotal){
  const acc={};DEPT_ALL_KEYS.forEach(k=>{acc[k]={grossC:0,costC:0,n:0};});
  rows.forEach(r=>{const a=acc[DEPT_ALL_KEYS.indexOf(r.dept)>=0?r.dept:'unclassified'];a.grossC+=Math.round((+r.gross||0)*100);a.costC+=Math.round((+r.cost||0)*100);a.n++;});
  const grossTotC=DEPT_ALL_KEYS.reduce((s,k)=>s+acc[k].grossC,0);
  let netC=(netTotal===undefined||netTotal===null||!isFinite(+netTotal))?grossTotC:Math.round(+netTotal*100);
  if(netC>grossTotC)netC=grossTotC;
  if(netC<0)netC=0;
  const discC=grossTotC-netC;
  const active=DEPT_ALL_KEYS.filter(k=>acc[k].n>0);
  const shares=_deptAllocate(discC,active.map(k=>acc[k].grossC));
  const sections={};
  DEPT_ALL_KEYS.forEach(k=>{sections[k]={dept:k,count:acc[k].n,gross:0,discount:0,net:0,cost:0,profit:0,margin:0};});
  active.forEach((k,i)=>{
    const g=acc[k].grossC,d=shares[i],n=g-d,co=acc[k].costC;
    sections[k]={dept:k,count:acc[k].n,gross:g/100,discount:d/100,net:n/100,cost:co/100,profit:(n-co)/100,margin:n>0?(n-co)/n*100:0};
  });
  const costTotC=DEPT_ALL_KEYS.reduce((s,k)=>s+acc[k].costC,0);
  const total={gross:grossTotC/100,discount:discC/100,net:netC/100,cost:costTotC/100,profit:(netC-costTotC)/100,margin:netC>0?(netC-costTotC)/netC*100:0};
  return {sections,total,activeKeys:active};
}
function saleSectionBreakdown(s){
  const rows=(s&&s.items||[]).map(it=>({dept:itemDept(it),gross:(+it.salePrice||0)*(+it.qty||1),cost:(+it.costPrice||0)*(+it.qty||1)}));
  return _deptBreakdown(rows,s?s.totalPrice:0);
}
function quoteSectionBreakdown(q){
  const rows=(q&&q.items||[]).map(it=>{const e=quoteItemEffective(it);return {dept:itemDept(it),gross:e.price*e.qty,cost:e.cost*e.qty};});
  return _deptBreakdown(rows,q?q.totalValue:0);
}
// وسم الفاتورة: قسم واحد (security/network/unclassified) أو mixed لو فيها أكثر من قسم
function _deptTag(bd){return bd.activeKeys.length===0?'unclassified':(bd.activeKeys.length===1?bd.activeKeys[0]:'mixed');}
function saleDeptTag(s){return _deptTag(saleSectionBreakdown(s));}
function quoteDeptTag(q){return _deptTag(quoteSectionBreakdown(q));}
// "شريحة" فاتورة لقسم واحد: نسخة من الفاتورة بنفس الـ id (فالأزرار بتشتغل على الفاتورة الأصلية) بأرقام القسم بس.
// الدفعات والخصم عند التحصيل والعمولة الثابتة بتتوزع بنسبة صافي القسم، فكل دوال الربح/المتبقي الحالية بتشتغل عالشريحة بدون تعديل.
function saleSectionSlice(s,dept){
  const bd=saleSectionBreakdown(s),sec=bd.sections[dept];
  if(!sec||!sec.count)return null;
  const ratio=bd.total.net>0?sec.net/bd.total.net:(bd.total.gross>0?sec.gross/bd.total.gross:0);
  const scalePay=p=>Object.assign({},p,{amount:round2((+p.amount||0)*ratio),convertedAmount:round2((+p.convertedAmount||0)*ratio),discountConverted:round2((+p.discountConverted||0)*ratio),discount:round2((+p.discount||0)*ratio)});
  return Object.assign({},s,{
    items:(s.items||[]).filter(it=>itemDept(it)===dept),
    totalPrice:sec.net,totalCost:sec.cost,
    paidAmount:round2((+s.paidAmount||0)*ratio),
    discAmount:round2(genDiscountTotal(s)*ratio),
    payments:(s.payments||[]).map(scalePay),
    commissionAmount:round2((+s.commissionAmount||0)*ratio),
    _sliceDept:dept,_sliceRatio:ratio
  });
}
function quoteSectionSlice(q,dept){
  const bd=quoteSectionBreakdown(q),sec=bd.sections[dept];
  if(!sec||!sec.count)return null;
  return Object.assign({},q,{items:(q.items||[]).filter(it=>itemDept(it)===dept),totalValue:sec.net,_sliceDept:dept});
}
function salesForDept(dept,list){
  list=list||db.sales;
  if(!dept||dept==='all')return list;
  return list.map(s=>saleSectionSlice(s,dept)).filter(Boolean);
}
function quotesForDept(dept,list){
  list=list||db.quotes;
  if(!dept||dept==='all')return list;
  return list.map(q=>quoteSectionSlice(q,dept)).filter(Boolean);
}
// شارة قسم صغيرة (ألوان: سيكيورتي برتقالي، نتورك أزرق مخضّر، مختلطة رمادي)
function deptBadgeHTML(key){
  const st={security:'color:#B45309;border-color:#B45309;background:#FEF3E2',network:'color:#0F6E85;border-color:#0F6E85;background:#E6F4F8',mixed:'color:var(--text2);border-color:var(--border2);background:var(--bg2)',unclassified:'color:var(--text2);border-color:var(--border2);background:transparent'}[key]||'';
  return `<span style="display:inline-block;font-size:10px;font-weight:700;padding:1px 8px;border:1px solid;border-radius:10px;white-space:nowrap;${st}">${esc(DEPT_SHORT[key]||key)}</span>`;
}
// تبويبات "الكل / سيكيورتي / نتورك" — onSelectJs: كود JS بيستقبل المتغير d ('all' | 'security' | 'network')
function deptTabsHTML(current,onSelectJs){
  const tabs=[['all','الكل'],['security','سيستم سيكيورتي'],['network','سيستم نتورك']];
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${tabs.map(t=>`<button type="button" class="btn btn-sm" style="${(current||'all')===t[0]?'background:var(--accent);color:#fff;border-color:var(--accent)':''}" onclick="var d='${t[0]}';${onSelectJs}">${esc(t[1])}</button>`).join('')}</div>`;
}
// جدول توزيع الأقسام (الصيغة المشتركة للشاشة والطباعة): withCost=true بيضيف التكلفة والربح والهامش (للي معه صلاحية الأرباح).
// conv: دالة تحويل عملة اختيارية (لطباعة الفاتورة بعملة عرض مختلفة)
function deptBreakdownTableHTML(bd,cur,withCost,conv){
  const keys=bd.activeKeys;if(!keys.length)return '';
  const f=n=>fmt(conv?conv(n):n);
  const th='style="border:1px solid #e5e7eb;padding:3px 6px;text-align:right;background:#f8f9fa;font-size:8.5px"';
  const td='style="border:1px solid #e5e7eb;padding:3px 6px;text-align:right;font-size:9px"';
  const head=`<tr><th ${th}>القسم</th><th ${th}>المبيع</th><th ${th}>حصته من الخصم</th><th ${th}>الصافي</th>${withCost?`<th ${th}>التكلفة</th><th ${th}>الربح</th><th ${th}>الهامش</th>`:''}</tr>`;
  const row=k=>{const x=bd.sections[k];return `<tr><td ${td}>${esc(DEPT_LABELS[k])}</td><td ${td}>${f(x.gross)}</td><td ${td}>${f(x.discount)}</td><td ${td}>${f(x.net)}</td>${withCost?`<td ${td}>${f(x.cost)}</td><td ${td}>${f(x.profit)}</td><td ${td}>${x.margin.toFixed(1)}%</td>`:''}</tr>`;};
  const t=bd.total;
  return `<table class="dept-breakdown" style="width:100%;border-collapse:collapse"><thead>${head}</thead><tbody>${keys.map(row).join('')}</tbody><tfoot><tr style="font-weight:700"><td ${td}>المجموع ${cur?`<span style="font-size:9px;font-weight:400">(${esc(cur)})</span>`:''}</td><td ${td}>${f(t.gross)}</td><td ${td}>${f(t.discount)}</td><td ${td}>${f(t.net)}</td>${withCost?`<td ${td}>${f(t.cost)}</td><td ${td}>${f(t.profit)}</td><td ${td}>${t.margin.toFixed(1)}%</td>`:''}</tr></tfoot></table>`;
}
function getMaintenanceAdvances(m){return m&&m.advances?m.advances.reduce((s,a)=>s+convertCurrency(+a.amount||0,a.currency||m.currency||'SYP',m.currency||'SYP'),0):0;}
// ديون المورد بالدولار: كل عملية سحب بضاعة (purchase) لها عملتها الخاصة (كانت مفقودة سابقاً وتُعامل كأنها ل.س دايماً)، فلازم نحوّل كل واحدة على حدة قبل الجمع
function getSupplierDebtUSD(sup){
  // ما منقص كل عملية لحالها عالصفر — عملية "مردودات" (رصيدها سالب) لازم تنخصم من إجمالي الدين
  // مش تنتجاهل، وإلا رصيد المرتجعات ما بينعكس عالدين الكلي للمورد.
  const net=(sup.purchases||[]).reduce((s,p)=>s+toUSD((+p.total||0)-(+p.paid||0),p.currency||'SYP'),0);
  // + الدفعات العامة على كامل الحساب (مو مرتبطة بفاتورة معينة) لازم تنخصم كمان من إجمالي الدين
  const accPaid=(sup.accountPayments||[]).reduce((s,p)=>s+toUSD(+p.amount||0,p.currency||'SYP'),0);
  return Math.max(net-accPaid,0);
}
function getMaintenanceWages(m){return m&&m.workers?m.workers.reduce((s,w)=>s+convertCurrency(+w.wage||0,w.currency||m.workersCurrency||m.currency||'SYP',m.currency||'SYP'),0):0;}
// تكلفة السيارات المستخدمة بهذا العمل تحديداً (بنزين، نقل، أجرة سيارة...) — محوّلة لعملة الفاتورة
function getMaintenanceCarCosts(m){return m&&m.cars?m.cars.reduce((s,c)=>s+convertCurrency(+c.amount||0,c.currency||m.carsCurrency||m.currency||'SYP',m.currency||'SYP'),0):0;}
// مصاريف الورشة + تكلفة السيارات المرتبطة بهذا العمل تُحتسب معاً ك"مصاريف" العمل بالكامل
function getMaintenanceExpenses(m){
  const workshop=m&&m.expenses?m.expenses.reduce((s,e)=>s+convertCurrency(+e.amount||0,e.currency||m.expensesCurrency||m.currency||'SYP',m.currency||'SYP'),0):0;
  return workshop+getMaintenanceCarCosts(m);
}
function getMaintenanceProfit(m){return genProfit(getMaintenanceIncome(m),getMaintenanceWages(m)+getMaintenanceExpenses(m),maintReferralCommissionFull(m));}
// نسبة ما تم تحصيله من قيمة العمل (0 إلى 1)
function maintProgress(m){return genProgress(getMaintenanceIncome(m),m);}
// الإيراد المحقق فعلياً = المبلغ المسدد فقط
function maintRecognizedIncome(m){return genRecognizedAmount(getMaintenanceIncome(m),m);}
// الأجور والمصاريف تُحتسب بنفس نسبة التحصيل، فيتحقق الربح تدريجياً مع كل دفعة
function maintRecognizedWages(m){return genRecognizedCost(getMaintenanceWages(m),maintProgress(m));}
function maintRecognizedExpenses(m){return genRecognizedCost(getMaintenanceExpenses(m),maintProgress(m));}
// عمولة محقّقة تدريجياً مع كل دفعة (نسبة من الربح، أو مبلغ ثابت موزّع حسب نسبة التحصيل)
function maintReferralCommission(m){
  return referralCommissionOnProfit(m,maintRecognizedIncome(m)-maintRecognizedWages(m)-maintRecognizedExpenses(m),maintProgress(m));
}
function maintRecognizedProfit(m){return genProfit(maintRecognizedIncome(m),maintRecognizedWages(m)+maintRecognizedExpenses(m),maintReferralCommission(m));}
function payMaintCommission(id){
  const m=db.maintenance.find(x=>x.id===id);
  if(!m)return;
  m.commissionPaid=true;m.commissionPaidDate=localToday();
  logAction('تسديد عمولة','maintenance',id);
  saveDB(db);renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}
function unpayMaintCommission(id){
  const m=db.maintenance.find(x=>x.id===id);
  if(!m)return;
  m.commissionPaid=false;m.commissionPaidDate='';
  saveDB(db);renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}
function paySaleCommission(id){
  const s=db.sales.find(x=>x.id===id);
  if(!s)return;
  s.commissionPaid=true;s.commissionPaidDate=localToday();
  logAction('تسديد عمولة','sales',id);
  saveDB(db);renderSales(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}
function unpaySaleCommission(id){
  const s=db.sales.find(x=>x.id===id);
  if(!s)return;
  s.commissionPaid=false;s.commissionPaidDate='';
  saveDB(db);renderSales(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}
// نافذة سريعة لتعديل عمولة فاتورة/عمل موجود مسبقاً بدون فتح كامل فورم التعديل — kind: 'sales' أو 'maintenance'
function openEditCommissionModal(kind,id){
  const list=kind==='sales'?db.sales:db.maintenance;
  const rec=list.find(x=>x.id===id);
  if(!rec)return;
  const client=db.clients.find(c=>c.id===rec.clientId);
  const isAmount=rec.commissionType==='amount';
  showModal(`
    <div class="modal-title">تعديل العمولة</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">موصى من "${esc(client&&client.referrerName||'—')}"</div>
    <div class="form-group">
      <div style="display:flex;gap:10px;margin-bottom:6px">
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="radio" name="ec-type" value="percent" ${!isAmount?'checked':''}> نسبة %</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="radio" name="ec-type" value="amount" ${isAmount?'checked':''}> مبلغ ثابت</label>
      </div>
      <input type="number" class="form-control" id="ec-value" value="${isAmount?(rec.commissionAmount||''):(rec.commissionPercent||'')}" min="0" step="0.5" placeholder="مثال: 15">
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--gold-dark);cursor:pointer">
        <input type="checkbox" id="ec-settlement" ${rec.commissionSettlement?'checked':''}>
        تسوية يدوية (مش عمولة حقيقية — بتُخصم من الربح متل العادة، بس ما بتُحتسب ضمن تقارير/متوسطات العمولة)
      </label>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveEditedCommission('${kind}','${id}')">حفظ</button>
    </div>
  `);
}
function saveEditedCommission(kind,id){
  const list=kind==='sales'?db.sales:db.maintenance;
  const rec=list.find(x=>x.id===id);
  if(!rec)return;
  const typeEl=document.querySelector('input[name="ec-type"]:checked');
  const commissionType=typeEl?typeEl.value:'percent';
  const val=+(document.getElementById('ec-value').value)||0;
  rec.commissionType=commissionType;
  rec.commissionPercent=commissionType==='amount'?0:val;
  rec.commissionAmount=commissionType==='amount'?val:0;
  rec.commissionSettlement=document.getElementById('ec-settlement').checked;
  saveDB(db);closeModal();
  if(kind==='sales')renderSales(document.getElementById('main-content'),document.getElementById('topbar-actions'));
  else renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}
function isMaintPaid(m){return genIsPaid(getMaintenanceIncome(m),m);}
function maintDiscountTotal(m){return genDiscountTotal(m);}
function maintRemaining(m){return genRemaining(getMaintenanceIncome(m),m);}
function maintStatusBadge(m){
  return genStatusBadge(getMaintenanceIncome(m),maintRemaining(m),+m.paidAmount||0,maintDiscountTotal(m),'مسددة');

}
// نسخة "الربح الكلي" (بغض النظر عن نسبة التحصيل، والمبلغ الثابت يُؤخذ كاملاً) — تُستخدم بجداول العرض العامة
function maintReferralCommissionFull(m){
  return referralCommissionOnProfit(m,getMaintenanceIncome(m)-getMaintenanceWages(m)-getMaintenanceExpenses(m));
}
function saleReferralCommissionFull(s){
  return referralCommissionOnProfit(s,(+s.totalPrice||0)-(+s.totalCost||0));
}
function saleFullProfit(s){return genProfit(+s.totalPrice||0,+s.totalCost||0,saleReferralCommissionFull(s));}

function exportMaintenanceExcel(){
  const filter=window._mF||'all';
  const cFilter=window._mC||'';
  const bFilter=window._mB||'';
  const wFilter=window._mW2||'';
  const filtered=db.maintenance.filter(m=>{
    if(filter!=='all'&&m.status!==filter)return false;
    if(cFilter&&m.clientId!==cFilter)return false;
    if(bFilter&&m.branch!==bFilter)return false;
    if(wFilter&&(!m.workers||!m.workers.some(w=>w.workerId===wFilter)))return false;
    return true;
  }).sort((a,b)=>new Date(b.startDate||0)-new Date(a.startDate||0));
  const showTotals=canViewTotals(),showSalaries=canViewWorkerSalaries(),showProfits=canViewProfits();
  const headers=['العميل','الفرع','نوع العمل','وصف العمل','تاريخ البدء','تاريخ الانتهاء','العمال',
    ...(showTotals?['الأجر الكلي']:[]),
    ...(showSalaries?['أجور العمال']:[]),
    ...(showTotals?['مصاريف']:[]),
    ...(showProfits?['الربح']:[]),
    'الحالة','رقم الفاتورة','ملاحظات'];
  const rows=filtered.map(m=>[
    getClientName(m.clientId),
    m.branch||'',
    m.workTypes?m.workTypes.join('، '):'',
    m.workDesc||'',
    m.startDate||'',
    m.endDate||'',
    m.workers&&m.workers.length?m.workers.map(w=>`${esc(maskWorkerName(w.workerName||getWorkerName(w.workerId)))} (${w.days||1} يوم)`).join('، '):'',
    ...(showTotals?[getMaintenanceIncome(m)]:[]),
    ...(showSalaries?[getMaintenanceWages(m)]:[]),
    ...(showTotals?[getMaintenanceExpenses(m)]:[]),
    ...(showProfits?[getMaintenanceProfit(m)]:[]),
    m.status||'',
    m.invoiceNo||'',
    m.notes||''
  ]);
  exportRowsToExcel('الأعمال','الأعمال',headers,rows);
}










// قسم "السيارات المستخدمة بهذا العمل" — يربط كل عمل بالسيارة/السيارات التي استُخدمت فيه وتكلفتها الخاصة بهذا العمل تحديداً




/* ===== MAINTENANCE PAYMENTS (نفس نظام دفعات المبيعات) ===== */

/* ===== GROUPED CLIENT INVOICE ===== */



/* ===== SALES ===== */


function toggleRowMenu(btn,ev){
  if(ev)ev.stopPropagation();
  const wrap=btn.closest('.row-menu-wrap');
  const list=wrap.querySelector('.row-menu-list');
  const wasOpen=list&&list.classList.contains('open');
  closeAllRowMenus();
  if(list&&!wasOpen){
    // بعض العناصر الأب (متل شريط الأعلى) عندها backdrop-filter، وهاد بيعمل
    // "containing block" جديد بيكسر موضع position:fixed للقوائم المنسدلة
    // (بتنحصر جوا صندوق الأب الصغير بدل الشاشة كلها). الحل: ننقل القائمة
    // مؤقتاً لآخر body وقت ما تنفتح، ونرجعها لمكانها الأصلي وقت ما تسكر.
    if(!list._rmHome){list._rmHome={parent:list.parentNode,next:list.nextSibling};}
    document.body.appendChild(list);
    list.classList.add('open');
    const r=btn.getBoundingClientRect();
    const listW=list.offsetWidth||200;
    let left=r.left;
    if(left+listW>window.innerWidth-8)left=window.innerWidth-listW-8;
    if(left<8)left=8;
    let top=r.bottom+4;
    const listH=list.offsetHeight||200;
    if(top+listH>window.innerHeight-8)top=r.top-listH-4;
    list.style.position='fixed';
    list.style.top=top+'px';
    list.style.left=left+'px';
  }
}
function closeAllRowMenus(){
  document.querySelectorAll('.row-menu-list.open').forEach(l=>{
    l.classList.remove('open');
    l.style.position='';l.style.top='';l.style.left='';l.style.right='';
    if(l._rmHome){
      const {parent,next}=l._rmHome;
      if(parent&&parent.isConnected){
        if(next&&next.parentNode===parent)parent.insertBefore(l,next);
        else parent.appendChild(l);
      }
    }
  });
}
document.addEventListener('click',closeAllRowMenus);
window.addEventListener('scroll',()=>{closeAllRowMenus();},true);







/* ===== QUOTES ===== */




/* ===== WORKERS ===== */







// اقتراح القيم المتكررة سابقاً (موديل/بارت نمبر/وصف) لتسريع الإدخال بدل كتابتها من جديد كل مرة
function _freqSort(map){return [...map.entries()].sort((a,b)=>b[1]-a[1]).map(e=>e[0]);}
function getItemNoteSuggestions(type){
  const map=new Map();
  db.sales.forEach(s=>(s.items||[]).forEach(it=>{if(it.note&&(!type||it.type===type))map.set(it.note,(map.get(it.note)||0)+1);}));
  db.quotes.forEach(q=>(q.items||[]).forEach(it=>{if(it.note&&(!type||it.desc===type))map.set(it.note,(map.get(it.note)||0)+1);}));
  (db.suppliers||[]).forEach(sup=>(sup.purchases||[]).forEach(p=>(p.items||[]).forEach(it=>{if(it.itemDesc&&(!type||it.type===type))map.set(it.itemDesc,(map.get(it.itemDesc)||0)+1);})));
  return _freqSort(map).slice(0,25);
}
function getWorkDescSuggestions(type){
  const map=new Map();
  db.maintenance.forEach(m=>(m.workItems||[]).forEach(it=>{if(it.desc&&it.desc.trim()&&(!type||it.type===type))map.set(it.desc.trim(),(map.get(it.desc.trim())||0)+1);}));
  return _freqSort(map).slice(0,8);
}
function getDestinationSuggestions(){
  const map=new Map();
  db.sales.forEach(s=>(s.items||[]).forEach(it=>{if(it.destination)map.set(it.destination,(map.get(it.destination)||0)+1);}));
  return _freqSort(map).slice(0,25);
}

/* ===== تحليل أداء العمال واقتراح الحوافز ===== */
// نصيب العامل من قيمة العمل (الإيراد) بالتناسب مع نصيبه من أجور هذا العمل تحديداً

/* ===== SUPPLIERS ===== */



// عرض مختصر لدفعات عملية الشراء من المورد (تاريخ ومبلغ كل دفعة)، على نفس نمط لائحة المبيعات
// المدفوع/المتبقي لكل صنف لحاله ضمن عملية الشراء (كل دفعة مربوطة بصنف عبر itemId)
// ===== دفعة على كامل حساب المورد (مو مرتبطة بفاتورة معينة، ولا بتتوزع على الفواتير) =====
// هاي دفعة مستقلة بتُسجّل بسجل خاص بالمورد (sup.accountPayments) وبتُخصم من "إجمالي الرصيد المستحق"
// مباشرة كرقم واحد، بدون ما تمس أي فاتورة أو تحدد أي فاتورة بالذات — تماماً متل ما طلب المستخدم:
// "دفعت 600 من أصل 2400 المستحقة عالحساب، بغض النظر شو توزيعها عالفواتير".
// دفعة عامة على كامل الفاتورة (بدون ربطها بصنف معيّن) — لمين بدو يدفع مبلغ إجمالي دفعة وحدة بدل ما يفرّقه على الأصناف


/* -------- تسجيل مرتجع (بضاعة رجعت للمورد) — بينسحب من دين المورد تلقائياً -------- */


/* ===== TOOLS / CARS / LOANS ===== */
function workerOptions(selected){const seeNames=canViewWorkerNames();return db.workers.map((w,i)=>`<option value="${w.id}" ${selected===w.id?'selected':''}>${esc(seeNames?w.name:'عامل '+(i+1))}</option>`).join('');}
// T14: الاسم الخام (للتخزين الداخلي بالسجلات فقط) — العرض والتصدير دايماً بـ getWorkerName يلي بيخفي الاسم عن اللي ما عنده صلاحية
function getWorkerNameRaw(id){const w=db.workers.find(x=>x.id===id);return w?w.name:'—';}
function getWorkerName(id){return maskWorkerName(getWorkerNameRaw(id));}



/* ===== المصاريف العامة (صفحة رئيسية مستقلة) ===== */
// قسم "نظرة عامة" — للعرض فقط، ما بينضاف لأي حساب ربح.
function generalExpensesTotalUSD(){
  return (db.generalExpenses||[]).reduce((s,e)=>s+toUSD(+e.amount||0,e.currency||'SYP'),0);
}
// ==== عرض معلوماتي فقط: مجموع ما تم صرفه فعلياً عبر الأعمال (أجور + مصاريف ورشة + سيارات) ====
// تنبيه مهم: هاي الأرقام "للاطّلاع فقط" — هي أصلاً مخصومة من ربح كل شغلة بصفحة الأعمال،
// وما بينضافوا أبداً لـ generalExpensesTotalUSD() ولا لأي حساب ربح تاني، تفاديًا لتكرار الخصم.





/* ===== CLIENTS ===== */


/* ===== REPORTS ===== */


// تكلفة كل مشروع: مجموع مصاريف السيارات + أجور العمال + مصاريف الأعمال المسجّلة على المشروع

/* ===== صفحة المشاريع (تفاصيل الأرباح والمبيعات لكل مشروع) ===== */
// يفحص كل فواتير المبيعات والأعمال المرتبطة بمشروع معيّن (حسب الاسم)، وإذا كلها مسددة بالكامل (كاش+خصم) يقفل المشروع تلقائياً،
// وإذا رجع صار في متبقي على أي فاتورة وكان الإقفال تلقائي، يعيد فتح المشروع لحاله. لا يلمس أبداً مشروع مقفول/معدّل يدوياً.
function refreshProjectAutoStatus(projectName){
  if(!projectName)return;
  if(!db.projects)db.projects=[];
  const p=db.projects.find(x=>x.name===projectName);
  if(!p)return;
  const sales=db.sales.filter(s=>(s.projectName||'')===projectName);
  const maints=db.maintenance.filter(m=>(m.projectName||'')===projectName);
  if(!sales.length && !maints.length)return;
  const allSettled=sales.every(s=>saleRemaining(s)<=0) && maints.every(m=>maintRemaining(m)<=0);
  if(allSettled && p.status!=='منتهية'){
    p.status='منتهية';
    p.autoClosedNote=true;
    saveDB(db);
  }else if(!allSettled && p.status==='منتهية' && p.autoClosedNote){
    p.status='جارية';
    p.autoClosedNote=false;
    saveDB(db);
  }
}
/* ===== تسديد دفعة موحّدة للمشروع (توزيع كامل التحكم بين المبيعات والأعمال) ===== */

/* ===== كشف حساب شامل للمشروع (مبيعات + أعمال معاً) ===== */

// لوحة أفضل الموصين — من جاب أكتر عملاء وأكتر أرباح

/* ===== SETTINGS ===== */


/* -------- helpers for list items -------- */



/* -------- WORK TYPES tab -------- */

/* -------- DEVICE TYPES tab -------- */

/* -------- MODEL NUMBERS tab -------- */

/* -------- EXPENSE TYPES tab -------- */

/* -------- GENERAL EXPENSE TYPES tab -------- */

/* -------- TOOL TYPES tab -------- */

/* -------- CAR EXPENSE TYPES tab -------- */

/* -------- PROJECTS tab -------- */
// حذف مشروع بالاسم مباشرة من صفحة "المشاريع" نفسها (بدل صفحة الإعدادات، بما إنه المشروع صار ينضاف تلقائياً بالكتابة وما عاد داعي لصفحة إعدادات مخصّصة له)
function deleteProjectByName(name){
  if(!guardDelete())return;
  if(!db.projects)return;
  const idx=db.projects.findIndex(p=>p.name===name);
  if(idx<0)return;
  if(!confirm(`حذف مشروع "${name}" من اللائحة؟ (هذا لا يحذف فواتير المبيع أو الأعمال المرتبطة فيه، فقط اسم المشروع من اللائحة)`))return;
  db.projects.splice(idx,1);
  logAction('حذف','مشروع',name);saveDB(db);
  window._projView=null;
  renderProjects(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

/* -------- WORKERS tab -------- */


/* -------- SUPPLIERS tab -------- */





/* -------- CARS tab -------- */





/* -------- BRANCHES / CLIENTS tab -------- */

/* -------- DANGER tab -------- */

/* -------- shared refresh -------- */
function refreshSettingsTab(){
  const el=document.getElementById('settings-tab-content');
  if(el)el.innerHTML=renderSettingsTab(window._stab||'workTypes');
  if((window._stab||'workTypes')==='danger')setTimeout(loadSnapshotsList,30);
}

/* --- Worker CRUD --- */



/* --- Model Numbers CRUD --- */
// يضيف الـ Part Number تلقائياً للائحة القوائم (بدون تكرار) لو كان جديد — يُستدعى من نماذج الموردين/المبيعات/العروض
function ensureModelNumberInList(val){
  val=(val||'').trim();
  if(!val)return;
  if(!db.modelNumbers)db.modelNumbers=[];
  if(!db.modelNumbers.includes(val)){db.modelNumbers.push(val);saveDB(db);}
}

/* ===== Part Number: تعبئة الوصف تلقائياً من آخر/أكثر وصف انكتب لنفس الموديل ===== */
// بنفضّل أوصاف الفواتير والعروض (اللي بتظهر للزبون)، وإذا ما في منرجع لوصف المورّدين
function getPartNumberDescription(model){
  const key=String(model||'').trim().toLowerCase();
  if(!key)return '';
  const cust=[],supp=[];
  const push=(arr,m,d,date)=>{
    if(!m||!d)return;
    if(String(m).trim().toLowerCase()!==key)return;
    const t=String(d).trim();
    if(t)arr.push({d:t,date:String(date||''),i:arr.length});
  };
  (db.sales||[]).forEach(s=>(s.items||[]).forEach(it=>push(cust,it.modelNumber,it.note,s.date)));
  (db.quotes||[]).forEach(q=>(q.items||[]).forEach(it=>{
    push(cust,it.modelNumber,it.note,q.date);
    (it.alts||[]).forEach(a=>push(cust,a.modelNumber,a.note,q.date));
  }));
  (db.suppliers||[]).forEach(sup=>(sup.purchases||[]).forEach(p=>(p.items||[]).forEach(it=>push(supp,it.modelNumber,it.itemDesc,p.date))));
  const hits=cust.length?cust:supp;
  if(!hits.length)return '';
  hits.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.i-b.i); // الأقدم → الأحدث
  const stat=new Map();
  hits.forEach((h,idx)=>{const s=stat.get(h.d)||{c:0,last:0};s.c++;s.last=idx;stat.set(h.d,s);});
  let best='',bc=-1,bl=-1;
  stat.forEach((s,d)=>{if(s.c>bc||(s.c===bc&&s.last>bl)){best=d;bc=s.c;bl=s.last;}});
  return best;
}
// لحتى ما نكتب فوق وصف المستخدم: منعبّي بس إذا الخانة فاضية، أو إذا كان الوصف الحالي هو نفسه
// اللي عبّيناه تلقائياً قبل (يعني المستخدم ما عدّل عليه) — مثلاً لما يغيّر الموديل لموديل تاني.
const _autoDescMap=new WeakMap();
function autofillPartDesc(model,list,idx,field,inputId){
  const it=list&&list[idx];
  if(!it)return;
  const cur=String(it[field]||'').trim();
  if(cur&&cur!==_autoDescMap.get(it))return;
  const d=getPartNumberDescription(model);
  if(!d)return;
  it[field]=d;
  _autoDescMap.set(it,d);
  const el=document.getElementById(inputId);
  if(el)el.value=d;
}

/* ===== بحث نصي بقوائم الفواتير وعروض الأسعار (يشمل Part Number) ===== */
function saleSearchText(s){
  const c=(db.clients||[]).find(x=>x.id===s.clientId);
  const parts=[s.invoiceNo,c&&c.name,s.branch,s.projectName,s.notes];
  (s.items||[]).forEach(it=>parts.push(it.type,it.modelNumber,it.note,it.note2,it.destination));
  return parts.filter(Boolean).join(' ').toLowerCase();
}
function quoteSearchText(q){
  const name=q.clientId?getClientName(q.clientId):(q.clientNameFree||'');
  const parts=[q.invoiceNo,name,q.projectName,q.status,q.notes];
  (q.items||[]).forEach(it=>{
    parts.push(it.desc,it.modelNumber,it.note,it.note2);
    (it.alts||[]).forEach(a=>parts.push(a.desc,a.modelNumber,a.note));
  });
  return parts.filter(Boolean).join(' ').toLowerCase();
}
function matchesListSearch(text,q){
  return String(q||'').split(/\s+/).filter(Boolean).every(t=>text.includes(t));
}
function listSearchInput(varName,placeholder,page){
  return `<div class="form-group">
        <label class="form-label">بحث</label>
        <input type="text" id="list-search-${page}" class="form-control" style="width:230px" placeholder="${esc(placeholder)}" value="${esc(window[varName]||'')}" oninput="applyListSearch('${varName}','${page}',this)">
      </div>`;
}
function applyListSearch(varName,page,inp){
  window[varName]=inp.value;
  const pos=inp.selectionStart;
  if(page==='sales')window._salesPageSize=50;
  rerenderPage(page);
  const n=document.getElementById('list-search-'+page);
  if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(e){}}
}

/* --- Device Types CRUD --- */


/* --- Work Types CRUD --- */


/* --- Danger Zone --- */


/* ===== CLIENT BRANCH FUNCTIONS (FIX) ===== */
// T36: محرّر فروع العميل المنظّم (اسم، عنوان، مسؤول وهاتفه، رابط الموقع). بيشتغل على window._cBD
function _brSync(){window._cB=(window._cBD||[]).map(function(b){return b.name;});}
function renderBranchTags(){
  const L=window._cBD||[];
  if(!L.length)return '<span style="color:var(--text3);font-size:12px">لا يوجد فروع بعد</span>';
  return L.map(function(b,i){
    const link=safeExternalUrl(b.mapUrl);
    return '<div class="card" style="padding:10px;margin-bottom:8px">'
      +'<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">'
      +'<input class="form-control" style="flex:1;font-weight:700" value="'+esc(b.name)+'" placeholder="اسم الفرع" aria-label="اسم الفرع" onchange="setBranchField('+i+',\'name\',this.value)">'
      +'<button type="button" class="btn btn-sm" aria-label="حذف الفرع" title="حذف الفرع" onclick="removeClientBranch('+i+')">✕</button></div>'
      +'<div class="form-row cols-2" style="margin-bottom:6px">'
      +'<input class="form-control" value="'+esc(b.address||'')+'" placeholder="العنوان" aria-label="عنوان الفرع" onchange="setBranchField('+i+',\'address\',this.value)">'
      +'<input class="form-control" value="'+esc(b.contactName||'')+'" placeholder="اسم المسؤول" aria-label="مسؤول الفرع" onchange="setBranchField('+i+',\'contactName\',this.value)"></div>'
      +'<div class="form-row cols-2">'
      +'<input class="form-control" dir="ltr" style="text-align:left" value="'+esc(b.contactPhone||'')+'" placeholder="هاتف المسؤول" aria-label="هاتف مسؤول الفرع" onchange="setBranchField('+i+',\'contactPhone\',this.value)">'
      +'<div style="display:flex;gap:6px"><input class="form-control" dir="ltr" style="text-align:left;flex:1" value="'+esc(b.mapUrl||'')+'" placeholder="رابط الموقع (https://...)" aria-label="رابط موقع الفرع" onchange="setBranchField('+i+',\'mapUrl\',this.value);document.getElementById(\'branch-tags\').innerHTML=renderBranchTags()">'
      +(link?'<a class="btn btn-sm" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer" aria-label="فتح الموقع"><i class="ti ti-map-pin"></i></a>':'')+'</div></div>'
      +'</div>';
  }).join('');
}
function setBranchField(i,f,v){
  if(!window._cBD||!window._cBD[i])return;
  window._cBD[i][f]=String(v||'').trim();_brSync();
}
function addClientBranch(){
  const inp=document.getElementById('branch-inp');
  if(!inp)return;
  const val=inp.value.trim();
  if(!val){alert('يرجى إدخال اسم الفرع');return;}
  if(!window._cBD)window._cBD=[];
  if(window._cBD.some(function(b){return String(b.name).trim().toLowerCase()===val.toLowerCase();})){alert('هذا الفرع موجود مسبقاً');return;}
  window._cBD.push({id:uid(),name:val,address:'',contactName:'',contactPhone:'',mapUrl:''});
  _brSync();
  inp.value='';inp.focus();
  const tagsEl=document.getElementById('branch-tags');
  if(tagsEl)tagsEl.innerHTML=renderBranchTags();
}
function removeClientBranch(idx){
  if(!window._cBD)return;
  window._cBD.splice(idx,1);_brSync();
  const tagsEl=document.getElementById('branch-tags');
  if(tagsEl)tagsEl.innerHTML=renderBranchTags();
}

/* ===== SETTINGS: COMPANY ===== */

/* resizes/compresses an image file to a small JPEG/PNG data URL so it reliably
   fits in localStorage (large phone-camera photos were silently failing to save,
   which is why the logo would disappear after refresh/print) */



/* ===== PRINT SYSTEM ===== */
/* ===== بيانات الشركة بالطباعة: كلها بتنقرأ من الإعدادات (بيانات الشركة للطباعة) =====
   القيم القديمة (اللي كانت مكتوبة بالقوالب) بتنزرع مرة وحدة كقيم افتراضية بالإعدادات
   حتى ما يتغيّر شي على المستخدم، وبعدها بيعدّلها من الإعدادات متل ما بدو. */
function ensureCompanyPrintDefaults(){
  if(!db.company)db.company={};
  const co=db.company;
  if(co.printDefaultsApplied)return co;
  if(!co.phone&&!co.mobile){co.phone='0930211119';co.mobile='0965158090';}
  if(co.signatory===undefined)co.signatory='ENG. Mahmoud Jouhar';
  co.printDefaultsApplied=true;
  return co;
}
function getCompanySignatory(){return String(ensureCompanyPrintDefaults().signatory||'');}
/* ===== T27: علامة مائية جديدة =====
   SVG مكرّر عمودياً بخلفية .print-doc (بدل عنصر واحد بأول الصفحة):
   - ارتفاع البلاطة = ثلث ارتفاع الصفحة المطبوعة، فكل صفحة (حتى فاتورة 3 صفحات) فيها 3 علامات بنفس التوزيع.
   - رمادية بشفافية خفيفة وبخلفية النص (مو فوقه)، فما بتغطي الأرقام.
   - 3 أوضاع: نص (افتراضي: اسم الشركة) / شعار الشركة / بدون.
   - الصفحات: A4 بهامش 10mm = 277mm ← بلاطة 92.333mm؛ مستندات الصفحة المرقّمة (270mm) ← 90mm؛ تصدير PDF (285mm) ← 95mm. */
const WM_TILE_W=760,WM_TILE_H=370,WM_GRAY='#6b7280',WM_OPACITY=0.10;
function getWatermarkMode(){
  const co=ensureCompanyPrintDefaults();
  if(co.watermarkOff)return 'none';
  return (co.watermarkMode==='logo'||co.watermarkMode==='none')?co.watermarkMode:'text';
}
function wmCleanText(t){return String(t==null?'':t).replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().toUpperCase().slice(0,40);}
function wmXmlEsc(t){return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function getCompanyWatermark(){
  const co=ensureCompanyPrintDefaults();
  if(getWatermarkMode()==='none')return '';
  return wmCleanText(co.watermark||co.name||'Security Mask');
}
function wmLogoCache(){
  const c=window._wmLogo,src=safeLogoSrc(ensureCompanyPrintDefaults().logo);
  return (c&&c.src===src&&c.data)?c:null;
}
// الشعار لازم يتحوّل لـ data URI (الـ SVG كخلفية ما بيحمّل ملفات خارجية). بيتحمّل مرة وبيتخزّن.
function warmWatermarkLogo(){
  return new Promise(function(res){
    try{
      const src=safeLogoSrc(ensureCompanyPrintDefaults().logo);
      if(window._wmLogo&&window._wmLogo.src===src){res();return;}
      const done=function(data,w,h){window._wmLogo={src:src,data:data,w:w,h:h};res();};
      const img=new Image();
      img.onload=function(){
        try{
          const k=Math.min(1,400/Math.max(img.naturalWidth,1));
          const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*k));c.height=Math.max(1,Math.round(img.naturalHeight*k));
          c.getContext('2d').drawImage(img,0,0,c.width,c.height);
          done(c.toDataURL('image/png'),c.width,c.height);
        }catch(e){done('',0,0);}
      };
      img.onerror=function(){done('',0,0);};
      img.src=src;
    }catch(e){res();}
  });
}
function watermarkSVG(opts){
  opts=opts||{};
  const co=ensureCompanyPrintDefaults();
  const mode=opts.mode||getWatermarkMode();
  if(mode==='none')return '';
  const W=WM_TILE_W,H=WM_TILE_H;
  const head='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">';
  if(mode==='logo'){
    const lg=opts.logo||wmLogoCache();
    if(lg&&lg.data&&lg.w>0&&lg.h>0){
      const k=Math.min(300/lg.w,230/lg.h),w=Math.round(lg.w*k),h=Math.round(lg.h*k);
      return head+'<defs><filter id="g"><feColorMatrix type="saturate" values="0"/></filter></defs>'+
        '<image href="'+lg.data+'" xlink:href="'+lg.data+'" x="'+Math.round((W-w)/2)+'" y="'+Math.round((H-h)/2)+'" width="'+w+'" height="'+h+'" opacity="'+WM_OPACITY+'" filter="url(#g)"/></svg>';
    }
    if(!opts.logo)warmWatermarkLogo().then(function(){if(typeof injectWatermarkCSS==='function')injectWatermarkCSS();}); // لسا ما جهز: مؤقتاً نص
  }
  const text=wmCleanText(opts.text!==undefined?opts.text:(co.watermark||co.name||'Security Mask'));
  if(!text)return '';
  const len=Array.from(text).length;
  const fs=Math.max(22,Math.min(64,Math.floor(560/(len*0.66))));
  const arabic=/[\u0600-\u06FF]/.test(text); // التباعد بين الحروف بيفكّ وصل الحروف العربية
  return head+'<text x="'+(W/2)+'" y="'+(H/2)+'" text-anchor="middle" dominant-baseline="central" transform="rotate(-30 '+(W/2)+' '+(H/2)+')" '+
    'font-family="Segoe UI,Tahoma,Arial,sans-serif" font-weight="900" font-size="'+fs+'"'+(arabic?'':' letter-spacing="3"')+' fill="'+WM_GRAY+'" fill-opacity="'+WM_OPACITY+'">'+wmXmlEsc(text)+'</text></svg>';
}
function watermarkDataURI(opts){const svg=watermarkSVG(opts);return svg?'data:image/svg+xml,'+encodeURIComponent(svg):'';}
function watermarkCSS(){
  const uri=watermarkDataURI();
  if(!uri)return '.print-doc{background-image:none}';
  return '.print-doc{background-image:url("'+uri+'");background-repeat:repeat-y;background-position:center top;background-size:100% 92.333mm}'+
    '.print-doc.is-doc{background-size:100% 90mm}'+
    '.print-table tbody tr:nth-child(even) td{background:rgba(251,248,240,.55)}'; /* صفوف الجدول شبه شفافة: العلامة ما بتختفي ولا بتغطي الأرقام */
}
function injectWatermarkCSS(){
  let st=document.getElementById('wm-css');
  if(!st){st=document.createElement('style');st.id='wm-css';document.head.appendChild(st);}
  st.textContent=watermarkCSS();
}
function companyPhonesHTML(sep){
  const co=ensureCompanyPrintDefaults();
  return [co.phone,co.mobile].map(x=>String(x||'').trim()).filter(Boolean).map(x=>'📞 '+esc(x)).join(sep);
}
function companyFooterPhonesHTML(){
  const p=companyPhonesHTML(' &nbsp;|&nbsp; ');
  return p?`<div style="font-weight:600; color:#374151; margin-bottom:2px;">${p}</div>`:'';
}
function getCompanyHeader(){
  const co=ensureCompanyPrintDefaults();
  const accentDark=getComputedStyle(document.documentElement).getPropertyValue('--accent-dark').trim()||'#334155';
  const defaultLogo='images/image1.png';
  const logoSrc=safeLogoSrc(co.logo);
  const logoHtml=`<img src="${esc(logoSrc)}" class="print-logo" alt="logo">`;
  return `<div class="print-header-left">
    ${logoHtml}
    <div style="display:flex; flex-direction:column; gap:2px;">
      <div class="print-company-name">${esc(co.name||'Security Mask')}</div>
      <div class="print-company-details">
        ${co.address?esc(co.address)+'<br>':''}
        ${companyPhonesHTML(' | ')}
        ${co.email?'<br>✉️ '+esc(co.email):''}
      </div>
    </div>
  </div>`;
}

/* ===== لغة مستندات الطباعة (عربي / English) — للفواتير وعروض الأسعار ===== */
// القوالب تنبني بالعربي، وعند اختيار English منترجم عناوين القالب (النصوص الثابتة فقط) ومنقلب اتجاه المستند LTR.
// بيانات المستخدم (أسماء العملاء والمواد والملاحظات) بتضل متل ما انكتبت.
function getPrintLang(){
  if(window._printLang==='ar'||window._printLang==='en')return window._printLang;
  let v='ar';try{const x=localStorage.getItem('sm-print-lang');if(x==='en')v='en';}catch(e){}
  window._printLang=v;return v;
}
const PRINT_EN_EXACT={
  'فاتورة مبيع':'Sales Invoice','فاتورة عمل':'Work Invoice','وصف الأعمال':'Work Description','عرض سعر':'Quotation',
  'فاتورة أعمال مجمّعة':'Consolidated Work Invoice','وصف أعمال مجمّع':'Consolidated Work Description',
  'رقم الفاتورة':'Invoice No.','رقم العرض':'Quotation No.',
  'التاريخ:':'Date:','المشروع:':'Project:','الفرع:':'Branch:','الحالة:':'Status:','تاريخ البدء:':'Start Date:','تاريخ الانتهاء:':'End Date:','الفترة:':'Period:','عدد الأعمال:':'Number of works:',
  'فاتورة إلى':'Invoice To','مقدم إلى':'Presented To','بيانات العميل':'Client Details','معلومات المستند':'Document Info',
  'صافي الفاتورة':'Invoice Net Total','صافي العرض':'Quotation Net Total','صافي الأعمال':'Net Works Total',
  '#':'#','المادة':'Item','وصف المادة':'Description','إفرادي':'Unit Price','الكمية':'Qty','الإجمالي':'Total',
  'نوع العمل':'Work Type','وصف العمل':'Work Description','التاريخ':'Date','الفرع':'Branch','عدد':'Qty',
  'لا يوجد أصناف':'No items','لا يوجد بنود':'No items',
  'الإجمالي قبل الحسم':'Subtotal before discount','الصافي النهائي':'Net Total','الإجمالي الصافي':'Net Total','الصافي بعد الحسم':'Net after discount',
  'الإجمالي بعد الدفعات المقدمة':'Total after advance payments','إجمالي الدفعات المسددة':'Total Payments Received','خصم عند التحصيل':'Discount on Collection',
  'صافي المبلغ المتبقي':'Remaining Balance','إجمالي الحسومات على الأعمال':'Total discounts on works',
  '📝 ملاحظات:':'📝 Notes:','📝 ملاحظات وشروط العرض:':'📝 Notes & Terms:',
  'توقيع العميل':'Customer Signature','التاريخ: ___________':'Date: ___________',
  'معلق':'Pending','متفق':'Agreed','مرفوض':'Rejected',
  /* كشف حساب المشروع */
  'كشف حساب شامل ومفصّل — المشروع':'Comprehensive Project Statement','وصف أعمال المشروع':'Project Work Description',
  'المشروع':'Project','الصافي المتبقي':'Remaining Balance','عدد السجلات:':'Number of records:',
  'إجمالي المبيعات':'Total Sales','إجمالي الأعمال':'Total Works','الإجمالي الشامل (مبيع+أعمال)':'Grand Total (Sales + Works)','المسدد':'Paid',
  'الصنف':'Item','السعر':'Price','إجمالي قسم المبيعات':'Sales Section Total','إجمالي قسم الأعمال':'Works Section Total',
  'الإجمالي الكلي الشامل (مبيعات + أعمال)':'Grand Total (Sales + Works)','إجمالي الفاتورة':'Invoice Total',
  'إجمالي الفاتورة (بعد خصم الدفعات المقدَّمة إن وجدت)':'Invoice Total (after advance payments, if any)',
  /* مقارنة العرض بالتنفيذ الفعلي */
  'مقارنة العرض بالتنفيذ الفعلي':'Quotation vs. Actual Execution','مرجع العرض':'Quotation Ref.','ملخّص المقارنة':'Comparison Summary',
  'البند':'Item','التفاصيل':'Details','كمية العرض':'Quoted Qty','قيمة العرض':'Quoted Value','كمية الفعلي':'Actual Qty','القيمة الفعلية':'Actual Value','الحالة':'Status',
  'محذوف':'Removed','بند جديد':'New item','تغيّر':'Changed','مطابق':'Matches'
};
const PRINT_EN_PATTERNS=[
  [/(\d+) فاتورة مبيع \+ (\d+) فاتورة عمل/g,'$1 sales invoice(s) + $2 work invoice(s)'],
  [/فاتورة مبيع(?![ء-ي])/g,'Sales Invoice'],[/فاتورة عمل(?![ء-ي])/g,'Work Invoice'],
  [/تفصيل المبيعات/g,'Sales Details'],[/تفصيل الأعمال/g,'Works Details'],
  [/(^|[^ء-ي])العميل:/g,'$1Client:'],
  [/التنفيذ الفعلي مطابق تماماً للعرض المقدَّم\./g,'The actual execution exactly matches the submitted quotation.'],
  [/التنفيذ الفعلي زاد عن العرض المقدَّم بمقدار/g,'The actual execution exceeds the submitted quotation by'],
  [/التنفيذ الفعلي أقل من العرض المقدَّم بمقدار/g,'The actual execution is below the submitted quotation by'],
  [/العرض الأساسي:/g,'Original quotation:'],[/التنفيذ الفعلي:/g,'Actual execution:'],
  [/(\d+)\s*صنف/g,'$1 item(s)'],[/(\d+)\s*بند/g,'$1 item(s)'],[/(\d+)\s*عمل مجمّع/g,'$1 work(s)'],
  [/\(بعد حسم ([\d.]+)%\)/g,'(after $1% discount)'],[/\(بعد الحسميات\)/g,'(after discounts)'],
  [/قيمة الحسم \(/g,'Discount ('],
  [/هاتف:/g,'Phone:'],[/العنوان:/g,'Address:'],
  [/الخيار الأساسي/g,'Main option'],[/خيار بديل/g,'Alternative option'],[/\(بديل — غير مدرج بالإجمالي\)/g,'(alternative — not included in total)'],
  [/^(\s*[\d\/\-—.]+) إلى ([\d\/\-—.]+\s*)$/,'$1 to $2'],
  [/جميع الحقوق محفوظة ©/g,'All rights reserved ©'],
  [/ل\.س/g,'SYP']
];
function printTranslateText(t){
  const core=t.trim();
  if(!core)return t;
  if(Object.prototype.hasOwnProperty.call(PRINT_EN_EXACT,core))return t.replace(core,PRINT_EN_EXACT[core]);
  let r=t;PRINT_EN_PATTERNS.forEach(p=>{r=r.replace(p[0],p[1]);});return r;
}
function printLangSelectHTML(){
  const l=getPrintLang();
  return `<span style="display:inline-flex;align-items:center;gap:6px;margin-inline-end:8px;font-size:12px;color:#374151"><i class="ti ti-language"></i> لغة المستند:
      <select onchange="switchPrintLang(this.value)" style="padding:4px 8px;border-radius:6px;border:1px solid #d1d5db;font-size:12px">
        <option value="ar" ${l==='ar'?'selected':''}>العربية</option>
        <option value="en" ${l==='en'?'selected':''}>English</option>
      </select></span>`;
}
// html = المستند + شريط الأزرار (اختياري). الترجمة بتنطبق على المستند فقط، مش على شريط الأزرار.
function printLangWrap(html){
  const marker='<div class="print-actions-bar">';
  const idx=html.indexOf(marker);
  let doc=idx>=0?html.slice(0,idx):html;
  let bar=idx>=0?html.slice(idx):'';
  if(getPrintLang()==='en'){
    doc=doc.replace(/>([^<>]+)</g,(m,t)=>'>'+printTranslateText(t)+'<');
    doc=doc.replace(/<div class="print-doc"/g,'<div class="print-doc" dir="ltr" lang="en"');
  }
  bar=bar.replace('<!--LANGSEL-->',printLangSelectHTML());
  return doc+bar;
}
// يعرض مستند مبني بالعربي (مع الاحتفاظ بنسخته الأصلية لإعادة الترجمة عند تبديل اللغة)
function showPrintDoc(rawHtml){
  window._printRaw=rawHtml;
  showPrintArea(printLangWrap(rawHtml));
}
function switchPrintLang(lang){
  window._printLang=lang==='en'?'en':'ar';
  try{localStorage.setItem('sm-print-lang',window._printLang);}catch(e){}
  if(window._printRaw)showPrintArea(printLangWrap(window._printRaw));
}

function showPrintArea(html){
  injectWatermarkCSS(); // T27
  const el=document.getElementById('print-area');
  el.style.display='block';
  el.innerHTML=html;
  window.scrollTo(0,0);
}

function closePrintArea(){
  const el=document.getElementById('print-area');
  el.style.display='none';
  el.innerHTML='';
}

/* ===== تنزيل PDF مباشر باسم ملف جاهز (اسم العميل + رقم الفاتورة) =====
   كل قالب طباعة بيسجّل (نوع المستند + العميل + الرقم) بـ setPrintFile، وزر "حفظ PDF" بيركّب منها اسم الملف
   بلغة المستند المختارة (عربي/English) وبينزّل الملف مباشرة بدل ما يفتح نافذة الطباعة. */
const PDF_NAME_PREFIX={
  ar:{sale:'فاتورة_مبيع',maint:'فاتورة_عمل',grouped:'فاتورة_أعمال_مجمّعة',quote:'عرض_سعر',compare:'مقارنة_عرض',project:'كشف_مشروع',bulkSales:'فواتير_مبيع',bulkMaint:'فواتير_أعمال',noPrices:'بدون_أسعار',visit:'تقرير_زيارة',def:'مستند'},
  en:{sale:'Sales_Invoice',maint:'Work_Invoice',grouped:'Consolidated_Work_Invoice',quote:'Quotation',compare:'Quote_vs_Actual',project:'Project_Statement',bulkSales:'Sales_Invoices',bulkMaint:'Work_Invoices',noPrices:'no_prices',visit:'Visit_Report',def:'Document'}
};
function setPrintFile(kind,client,no,noPrices,count){
  window._printFile={kind:kind,client:String(client||''),no:String(no||''),noPrices:!!noPrices,count:count||0};
}
function buildPdfFileName(){
  const m=window._printFile||{};
  const P=PDF_NAME_PREFIX[getPrintLang()]||PDF_NAME_PREFIX.ar;
  const parts=[];
  if(m.kind!=='doc')parts.push(P[m.kind]||P.def);   // المستندات الحرّة اسمها عنوانها بدون بادئة
  if(m.count)parts.push(m.count);
  if(m.client&&m.client!=='—')parts.push(m.client);
  if(m.no)parts.push(m.no);
  if(m.kind==='bulkSales'||m.kind==='bulkMaint')parts.push(localToday());
  if(m.noPrices)parts.push(P.noPrices);
  const name=parts.join('_').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'').replace(/\s+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'').slice(0,110);
  return name||P.def;
}
async function doSavePDF(btn){
  const docs=document.querySelectorAll('#print-area .print-doc');
  if(!docs.length){alert('لا يوجد مستند لتصديره');return;}
  const label=btn?btn.innerHTML:null;
  let pdfWmStyle=null;
  const idle=function(){if(pdfWmStyle&&pdfWmStyle.parentNode)pdfWmStyle.parentNode.removeChild(pdfWmStyle);if(btn){btn.disabled=false;btn.style.opacity='';if(label!==null)btn.innerHTML=label;}};
  if(btn){btn.disabled=true;btn.style.opacity='.6';btn.innerHTML='⏳ جاري التصدير...';}
  // html2pdf (~700 كيلوبايت) بتتحمّل عند أول تصدير بس
  try{await loadLib('html2pdf');}
  catch(e){idle();alert('تعذّر تحميل مكتبة تصدير PDF (يلزم اتصال بالإنترنت أول مرة). استخدم زر "طباعة" واختر "حفظ كـ PDF".');return;}
  try{
    // منجمّع كل المستندات المعروضة (بالطباعة المجمّعة بيكون أكتر من مستند) بحاوية وحدة، وكل مستند بيبدأ صفحة جديدة
    const wrap=document.createElement('div');
    wrap.className='wm-pdf';
    wrap.style.cssText='background:#fff;width:210mm';
    injectWatermarkCSS();
    pdfWmStyle=document.createElement('style');
    pdfWmStyle.textContent='.wm-pdf .print-doc,.wm-pdf .print-doc.is-doc{background-size:100% 95mm!important}'; /* صفحة PDF = 285mm ← 3 علامات */
    document.head.appendChild(pdfWmStyle);
    docs.forEach(function(d,i){
      const c=d.cloneNode(true);
      c.style.maxWidth='none';c.style.margin='0';
      if(i<docs.length-1)c.style.pageBreakAfter='always';
      wrap.appendChild(c);
    });
    await html2pdf().set({
      margin:[6,0,6,0],
      filename:buildPdfFileName()+'.pdf',
      image:{type:'jpeg',quality:0.98},
      html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff',scrollX:0,scrollY:0},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
      pagebreak:{mode:['css','legacy'],avoid:['tr','.print-sign-row','.print-footer','.print-header','.print-to-section']}
    }).from(wrap).save();
  }catch(err){
    console.error('doSavePDF error:',err);
    alert('حدث خطأ أثناء تصدير PDF. استخدم زر "طباعة" واختر "حفظ كـ PDF" كبديل.');
  }finally{idle();}
}

function doPrint(){
  const content=document.getElementById('print-area').innerHTML;
  const w=window.open('','_blank','width=650,height=900');
  if(!w){alert('المتصفح حجب نافذة الطباعة. اسمح بالنوافذ المنبثقة (Pop-ups) لهذا الموقع من شريط العنوان ثم اضغط طباعة مرة ثانية.');return;}
  w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>طباعة</title><style>
    *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;color:#1a1a2e;background:#ffffff;padding:0;margin:0;font-size:13px;overflow-x:hidden;}
    .print-actions-bar{display:none!important}
    #print-scale-wrap{width:100%}
    .print-doc{width:100%;max-width:210mm;min-height:277mm;margin:0 auto;padding:6mm 4mm;display:block;background:#fff;overflow:visible;box-sizing:border-box;position:relative;transform-origin:top center;}
    .print-doc *{overflow-wrap:break-word;word-wrap:break-word}
    ${watermarkCSS()}
    .print-doc>*{position:relative;z-index:1}
    /* ===== HEADER: الشعار وبيانات الشركة ===== */
    .print-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px double #9C7A2E;padding-bottom:12px;margin-bottom:16px;width:100%;gap:12px}
    .print-header-left{display:flex;align-items:center;gap:12px}
    .print-logo{max-width:70px;max-height:64px;object-fit:contain;flex-shrink:0}
    .print-company-name{font-size:19px;font-weight:800;color:#12151C;margin-bottom:2px}
    .print-company-details{font-size:11.5px;color:#6b6552;line-height:1.6}
    .print-doc-type{font-size:22px;font-weight:900;color:#9C7A2E;text-align:left;line-height:1.15}
    .print-doc-meta{font-size:11.5px;color:#6b6552;text-align:left;margin-top:4px;line-height:1.5}
    /* ===== بيانات العميل ===== */
    .print-to-section{display:grid;grid-template-columns:1.2fr 1fr;gap:12px;margin-bottom:14px;width:100%}
    .print-to-box{background:#FBF9F4;border-radius:8px;padding:10px 13px;border:1px solid #EADFC0;border-inline-start:3px solid #C9A24B}
    .print-to-box label{font-size:10.5px;color:#9c916f;font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;display:block}
    .print-to-box .val{font-size:14px;font-weight:700;color:#1a1a2e}
    .print-to-box .val-sub{font-size:11.5px;color:#6b6552;margin-top:2px}
    /* ===== الجدول ===== */
    .print-table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12.5px}
    .print-table thead{display:table-header-group}
    .print-table tfoot{display:table-row-group}
    .print-table thead tr{background:#F3ECD8}
    .print-table th{padding:6px 6px;text-align:right;font-weight:700;color:#5C4715;background:#F3ECD8;border:1px solid #E3D6AE;border-bottom:2px solid #C9A24B;font-size:10px;letter-spacing:.1px;line-height:1.3}
    .print-table tbody tr{page-break-inside:avoid;break-inside:avoid}
    .print-table td{padding:8px 8px;border:1px solid #EADFC0;text-align:right;vertical-align:top;font-size:12.5px}
    .print-table tr:nth-child(even) td{background:#FBF8F0}
    /* ===== الإجماليات ===== */
    .print-totals{display:flex;justify-content:flex-end;margin-bottom:10px;page-break-inside:avoid;break-inside:avoid}
    .print-totals-box{width:220px;background:#FBF9F4;border-radius:8px;padding:9px 12px;border:1px solid #EADFC0}
    .print-totals-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12.5px;border-bottom:1px dashed #EADFC0}
    .print-totals-row:last-child{border-bottom:none;font-weight:800;font-size:14.5px;color:#12151C;padding-top:6px}
    /* ===== ملاحظات / فوتر / توقيع ===== */
    .print-note-box{border-inline-start:3px solid #C9A24B;border:1px solid #EADFC0;border-inline-start-width:3px;border-radius:6px;padding:10px 13px;font-size:12px;color:#4b4736;margin-bottom:14px;line-height:1.7;page-break-inside:avoid;break-inside:avoid}
    .print-footer{border-top:2px solid #9C7A2E;padding-top:11px;text-align:center;font-size:11px;color:#8a836a;line-height:1.7;margin-top:14px;page-break-inside:avoid;break-inside:avoid;break-before:avoid;page-break-before:avoid}
    .print-sign-row{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px;page-break-inside:avoid;break-inside:avoid;break-before:avoid;page-break-before:avoid}
    .print-sign-box{border-top:1px solid #9C7A2E;padding-top:9px;font-size:12.5px;color:#3a3626;text-align:center;font-weight:600}
    .badge-status{display:inline-block;padding:3px 9px;border-radius:14px;font-size:11px;font-weight:700;background:#E9F6EE;color:#1A6B44}
    .badge-status.pending{background:#FBF3E1;color:#9C7A2E}
    /* ملاحظة: ما في هون أي قاعدة بتلزّق آخر صف/صفين بالجدول مع التوقيع —
       هيك الجدول بيمتلئ الصفحة طبيعي وبيكمل تلقائياً لصفحة تانية فقط لما فعلاً يخلص المجال،
       بدون ما يترك صفحة شبه فاضية فيها بس التوقيع. */
    .print-header,.print-to-section{page-break-inside:avoid;break-inside:avoid}
    /* ===== مستند إنكليزي (LTR) ===== */
    .print-doc[dir="ltr"]{direction:ltr;text-align:left}
    .print-doc[dir="ltr"] .print-table th,.print-doc[dir="ltr"] .print-table td{text-align:left}
    .print-doc[dir="ltr"] .print-doc-type,.print-doc[dir="ltr"] .print-doc-meta,.print-doc[dir="ltr"] .print-header>div:last-child{text-align:right!important}
    ${window.DOC_BODY_CSS||''}
    @page{size:A4;margin:10mm}
    @media print{body{padding:0}.print-doc{padding:4px 6px}}
    .print-doc{page-break-after:always;break-after:page}
    .print-doc:last-of-type{page-break-after:auto;break-after:auto}
  </style></head><body><div id="print-scale-wrap">${content}</div></body></html>`);
  w.document.close();
  // تصغير تلقائي وخفيف لكل مستند حتى نتفادى صفحة أخيرة شبه فاضية (متل صفحة فيها بس
  // التوقيع والملاحظات). المنطق:
  // 1) نقيس الارتفاع الحقيقي (scrollHeight) عالحجم الطبيعي ونحسب كم صفحة فعلياً محتاجة.
  // 2) إذا هي صفحة وحدة تقريباً (طفح بسيط سطر/سطرين): نفس المنطق القديم — تصغير خفيف
  //    لغاية 0.74 حتى تصير صفحة وحدة كاملة.
  // 3) إذا المستند فعلاً أطول من صفحة (جدولين، كشف حساب، إلخ): منجرب تصغير تدريجي وخفيف
  //    جداً (لغاية 0.82 فقط، حتى يضل الخط مقروء) بحثاً عن أصغر تصغير كافي لإلغاء صفحة
  //    أخيرة زايدة. أول تصغير بيوصل لعدد صفحات أقل منقفه عليه فوراً (أقل تصغير ممكن).
  //    إذا حتى 0.82 ما كفت، منرجّع 100% ومنخلي المستند يتوزع طبيعي على عدد الصفحات
  //    الحقيقي اللي يحتاجه (أفضل من نص صغير وبيضل ناقص صفحة).
  const fitDocsToPage=()=>{
    try{
      const pxPerMm=96/25.4;
      const pageHeightPx=277*pxPerMm; // ارتفاع A4 ناقص الهوامش (10مم فوق وتحت)
      const docs=w.document.querySelectorAll('.print-doc');
      docs.forEach(function(d){
        if(d.hasAttribute('data-nofit'))return;
        d.style.zoom='1';
        const baseHeight=d.scrollHeight;
        const basePages=Math.ceil(baseHeight/pageHeightPx);
        if(basePages<=1){
          let scale=1,guard=0;
          while(d.scrollHeight>pageHeightPx+2 && scale>0.74 && guard<10){
            scale=Math.round((scale-0.04)*100)/100;
            d.style.zoom=scale;
            guard++;
          }
          return;
        }
        let bestScale=1;
        for(let s=0.98;s>=0.82;s-=0.02){
          d.style.zoom=s;
          const pages=Math.ceil(d.scrollHeight/pageHeightPx);
          if(pages<basePages){
            bestScale=Math.round(s*100)/100;
            break;
          }
        }
        d.style.zoom=bestScale;
      });
    }catch(e){/* تحسين اختياري فقط — لو المتصفح ما بيدعم zoom، بتطبع عادي عالحجم الطبيعي */}
  };
  const triggerPrint=()=>{fitDocsToPage();w.focus();w.print();};
  const imgs=w.document.images;
  if(!imgs||!imgs.length){
    setTimeout(triggerPrint,300);
  } else {
    let remaining=imgs.length;
    let printed=false;
    const done=()=>{remaining--;if(remaining<=0&&!printed){printed=true;triggerPrint();}};
    for(let i=0;i<imgs.length;i++){
      if(imgs[i].complete)done();
      else{imgs[i].addEventListener('load',done);imgs[i].addEventListener('error',done);}
    }
    // safety fallback in case an image never fires load/error
    setTimeout(()=>{if(!printed){printed=true;triggerPrint();}},2500);
  }
}

/* ===== PDF EXPORT (direct download, no print dialog) ===== */

function buildSaleInvoiceHTML(saleId,withPrices,displayCurrency){
  if(withPrices===undefined)withPrices=true;
  const s=db.sales.find(x=>x.id===saleId);
  if(!s)return '';
  const co=db.company||{};
  const client=db.clients.find(c=>c.id===s.clientId)||{name:'—'};
  const totalCost=s.totalCost||0;
  const discount=s.discount||0;
  const rawPrice=s.items?s.items.reduce((sum,item)=>sum+(+item.salePrice||0)*(+item.qty||1),0):s.totalPrice;
  const totalPrice=s.totalPrice||0;
  const discVal=rawPrice-totalPrice;
  const invoiceNo=s.invoiceNo||('INV-'+saleId.slice(-6).toUpperCase());
  setPrintFile('sale',client.name,invoiceNo,!withPrices);
  const todayStr=fmtDate(new Date());
  // خيار عرض الإجمالي فقط بعملة مختلفة عن عملة تسجيل الفاتورة الأصلية (بسعر الصرف الحالي من الإعدادات)
  // بدون أي تأثير على البيانات المخزّنة أو تفاصيل الأصناف — التحويل يشمل أسطر الإجمالي فقط
  const dispCur=(displayCurrency==='USD'||displayCurrency==='SYP')?displayCurrency:s.currency;
  const showConverted=dispCur!==s.currency;
  const conv=amt=>showConverted?convertCurrency(amt,s.currency,dispCur):(+amt||0);
  const curTag=cur=>` <span style="font-size:0.75em;opacity:.75">${curLabel(cur)}</span>`;

  const colCount=withPrices?7:5;
  const itemsRows=(s.items||[]).map((item,i)=>{
    const lineTotal=(+item.salePrice||0)*(+item.qty||1);
    return `<tr>
      <td style="text-align:center;color:#9ca3af;font-size:8px">${i+1}</td>
      <td style="font-weight:600;color:#1a1a2e">${esc(item.type||'—')}</td>
      <td style="color:#374151; font-size: 8.5px; text-align:right; unicode-bidi:plaintext;">${esc(item.modelNumber||'—')}</td>
      <td style="color:#374151; font-size: 8.5px;">${esc(item.note||'—')}</td>
      ${withPrices?`<td style="text-align:right;color:#2F6B4E">${fmt(item.salePrice)}</td>`:''}
      <td style="text-align:center;font-weight:600">${item.qty||1}</td>
      ${withPrices?`<td style="text-align:right;font-weight:700;color:#2F6B4E">${fmt(lineTotal)}</td>`:''}
    </tr>`;
  }).join('');

  return `
  <div class="print-doc">
    <div class="print-header">
      ${getCompanyHeader()}
      <div style="text-align:left; flex-shrink:0;">
        <div class="print-doc-type">${withPrices?'فاتورة مبيع':'وصف الأعمال'}</div>
        ${withPrices?`<div style="display:inline-block; background:#334155; color:#fff; border-radius:4px; padding:2px 6px; margin:3px 0;">
	          <div style="font-size:7px; opacity:.9; font-weight:600;">رقم الفاتورة</div>
	          <div style="font-size:10px; font-weight:800;">#${esc(invoiceNo)}</div>
	        </div>`:''}
        <div class="print-doc-meta">
          <b>التاريخ:</b> <b style="color:#1a1a2e">${fmtDate(s.date)||todayStr}</b>
          ${s.projectName?`<br><b>المشروع:</b> <span style="color:#334155">${esc(s.projectName)}</span>`:''}
          ${withPrices?(()=>{const bdT=saleSectionBreakdown(s);return bdT.activeKeys.length?`<br><b>القسم:</b> <span style="color:#334155">${bdT.activeKeys.length>1?esc(DEPT_LABELS.mixed+' ('+bdT.activeKeys.map(k=>DEPT_SHORT[k]).join(' + ')+')'):esc(DEPT_LABELS[bdT.activeKeys[0]])}</span>`:'';})():''}
        </div>
      </div>
    </div>

    <div class="print-to-section">
      <div class="print-to-box">
        <label>${withPrices?'فاتورة إلى':'مقدم إلى'}</label>
        <div class="val">${esc(client.name)}${s.branch?` — <span style="color:#1e293b; font-size:9px;">${esc(s.branch)}</span>`:''}</div>
        <div style="margin-top:4px; display:flex; flex-direction:column; gap:2px;">
          ${client.phone?`<div class="val-sub" style="display:flex; align-items:center; gap:4px;"><span style="color:#1e293b;">●</span> هاتف: ${esc(client.phone)}</div>`:''}
          ${client.address?`<div class="val-sub" style="display:flex; align-items:center; gap:4px;"><span style="color:#1e293b;">●</span> العنوان: ${esc(client.address)}</div>`:''}
        </div>
      </div>
		      <div class="print-to-box" style="${withPrices?'background:#ffffff; border-color:#93C5FD;':''}">
		        ${withPrices?`<label style="color:#1D4ED8;">صافي الفاتورة</label>
		        <div style="font-size:15px; font-weight:900; color:#1E3A8A; line-height:1.1;">${fmt(conv(totalPrice))}${curTag(dispCur)}</div>
		        <div style="font-size:7.5px; color:#5B7DB1; margin-top:1px;">${(s.items||[]).length} صنف ${discount?` (بعد حسم ${discount}%)`:''}</div>`:
        `<label>معلومات المستند</label>
        <div class="val-sub" style="line-height:1.9;">
          <b>التاريخ:</b> ${fmtDate(s.date)||todayStr}<br>
          ${s.branch?`<b>الفرع:</b> ${esc(s.branch)}<br>`:''}
          ${s.projectName?`<b>المشروع:</b> ${esc(s.projectName)}`:''}
        </div>`}
      </div>
    </div>

    <table class="print-table" style="table-layout:fixed; width:100%;">
      <thead>
        <tr>
          <th style="width:22px; text-align:center;">#</th>
          <th style="width:13%;">المادة</th>
          <th style="width:12%;">Part Number</th>
          <th>وصف المادة</th>
          ${withPrices?'<th style="width:10%; text-align:right;">إفرادي</th>':''}
          <th style="width:8%; text-align:center;">الكمية</th>
          ${withPrices?'<th style="width:13%; text-align:right;">الإجمالي</th>':''}
        </tr>
      </thead>
      <tbody>
        ${itemsRows||`<tr><td colspan="${colCount}" style="text-align:center; color:#9ca3af; padding:18px;">لا يوجد أصناف</td></tr>`}
      </tbody>
		      ${withPrices?`<tfoot>
		        ${discount?`
		        <tr style="background:#f8f9fa; border-top:1.5px solid #e0e0e0;">
		          <td colspan="${colCount-1}" style="font-weight:700; font-size:9px; text-align:right; padding:5px 6px;">الإجمالي قبل الحسم</td>
		          <td style="font-weight:900; font-size:11px; color:#334155; text-align:right; padding:5px 6px;">${fmt(conv(rawPrice))}${curTag(dispCur)}</td>
		        </tr>
		        <tr style="background:#fff; border-top:1px solid #eee;">
		          <td colspan="${colCount-1}" style="font-weight:600; font-size:8.5px; text-align:right; padding:4px 6px; color:var(--salary);">قيمة الحسم (${discount}%)</td>
		          <td style="font-weight:700; font-size:10px; color:var(--salary); text-align:right; padding:4px 6px;">-${fmt(conv(discVal))}${curTag(dispCur)}</td>
		        </tr>
		        <tr style="background:#f8f9fa; border-top:1px solid #e0e0e0;">
		          <td colspan="${colCount-1}" style="font-weight:700; font-size:9px; text-align:right; padding:5px 6px;">الصافي النهائي</td>
		          <td style="font-weight:900; font-size:11px; color:#334155; text-align:right; padding:5px 6px;">${fmt(conv(totalPrice))}${curTag(dispCur)}</td>
		        </tr>` : `
		        <tr style="background:#f8f9fa; border-top:1.5px solid #e0e0e0;">
		          <td colspan="${colCount-1}" style="font-weight:700; font-size:9px; text-align:right; padding:5px 6px;">الإجمالي الصافي</td>
		          <td style="font-weight:900; font-size:11px; color:#334155; text-align:right; padding:5px 6px;">${fmt(conv(totalPrice))}${curTag(dispCur)}</td>
		        </tr>`}
        ${chargesPrintRows(s,totalPrice,colCount,conv,curTag(dispCur))}
        ${(s.paidAmount||0)>0 ? `
        <tr style="background:#fff; border-top:1px solid #eee;">
          <td colspan="${colCount-1}" style="font-weight:600; font-size:8.5px; text-align:right; padding:4px 6px; color:#6b7280;">إجمالي الدفعات المسددة</td>
          <td style="font-weight:700; font-size:10px; color:#059669; text-align:right; padding:4px 6px;">${fmt(conv(s.paidAmount))}${curTag(dispCur)}</td>
        </tr>
        ${saleDiscountTotal(s)>0?`<tr style="background:#fff; border-top:1px solid #eee;">
          <td colspan="${colCount-1}" style="font-weight:600; font-size:8.5px; text-align:right; padding:4px 6px; color:var(--salary);">خصم عند التحصيل</td>
          <td style="font-weight:700; font-size:10px; color:var(--salary); text-align:right; padding:4px 6px;">-${fmt(conv(saleDiscountTotal(s)))}${curTag(dispCur)}</td>
        </tr>`:''}
        <tr style="background:#fef2f2; border-top:1px solid #fee2e2;">
          <td colspan="${colCount-1}" style="font-weight:700; font-size:9px; text-align:right; padding:5px 6px; color:#991b1b;">صافي المبلغ المتبقي</td>
          <td style="font-weight:900; font-size:11px; color:#dc2626; text-align:right; padding:5px 6px;">${fmt(conv(saleRemaining(s)))}${curTag(dispCur)}</td>
        </tr>` : ''}
      </tfoot>`:''}
    </table>

    ${withPrices?(()=>{const bdP=saleSectionBreakdown(s);return bdP.activeKeys.length>1?`<div style="margin:6px 0 8px;page-break-inside:avoid;break-inside:avoid"><div style="font-weight:700;font-size:9px;margin-bottom:3px;color:#334155">توزيع الفاتورة على الأقسام</div>${deptBreakdownTableHTML(bdP,curLabel(dispCur),false,conv)}</div>`:'';})():''}
    ${s.notes?`<div class="print-note-box"><b style="color:#1a1a2e;">📝 ملاحظات:</b><br>${formatNotesHTML(s.notes)}</div>`:''}
    ${co.printNote?`<div style="text-align:center; padding:5px; background:#fffaf0; border-radius:5px; font-weight:600; font-size:9px; color:#334155; margin-bottom:7px;">${esc(co.printNote)}</div>`:''}

    <div class="print-sign-row">
      <div class="print-sign-box">

        <div style="height:20px;"></div>
        <div style="font-weight:700;">توقيع العميل</div>
        <div style="font-size:7px; color:#9ca3af; margin-top:1px;">التاريخ: ___________</div>
      </div>
      <div class="print-sign-box">

        <div style="height:20px;"></div>
        <div style="font-weight:700;">${esc(getCompanySignatory())}</div>
        <div style="font-size:7px; color:#9ca3af; margin-top:1px;">التاريخ: ___________</div>
      </div>
    </div>

    <div class="print-footer">
      ${companyFooterPhonesHTML()}
      ${co.email?`<div>${esc(co.email)}</div>`:''}
      <div>جميع الحقوق محفوظة © ${new Date().getFullYear()} ${esc(co.name||'Security Mask')}</div>
    </div>
  </div>`;
}
const PRINT_ACTIONS_BAR=`<div class="print-actions-bar">
    <button onclick="doPrint()" style="background:#334155;color:white;border:none;border-radius:8px;padding:10px 22px;font-size:14px;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:6px">🖨️ طباعة</button>
    <button onclick="doSavePDF(this)" style="background:#2563eb;color:white;border:none;border-radius:8px;padding:10px 22px;font-size:14px;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:6px">📄 حفظ PDF</button>
    <button onclick="closePrintArea()" style="background:#f3f4f6;color:#374151;border:1px solid #ccc;border-radius:8px;padding:10px 22px;font-size:14px;cursor:pointer;font-weight:600">✕ إغلاق</button>
  </div>`;
const PRINT_ACTIONS_BAR_LANG=PRINT_ACTIONS_BAR.replace('<div class="print-actions-bar">','<div class="print-actions-bar"><!--LANGSEL-->');
function buildMaintInvoiceHTML(maintId,withPrices,displayCurrency){
  if(withPrices===undefined)withPrices=true;
  const m=db.maintenance.find(x=>x.id===maintId);
  if(!m)return '';
  const co=db.company||{};
  const client=db.clients.find(c=>c.id===m.clientId)||{name:'—'};
  // نفس منطق تحويل الإجمالي فقط، بدون التأثير على تفاصيل بنود العمل (انظر buildSaleInvoiceHTML)
  const dispCur=(displayCurrency==='USD'||displayCurrency==='SYP')?displayCurrency:m.currency;
  const showConverted=dispCur!==m.currency;
  const conv=amt=>showConverted?convertCurrency(amt,m.currency,dispCur):(+amt||0);
  const curTag=cur=>` <span style="font-size:0.75em;opacity:.75">${curLabel(cur)}</span>`;
  const items=(m.workItems&&m.workItems.length)?m.workItems:[{type:(m.workTypes&&m.workTypes[0])||'',desc:m.workDesc||'',qty:1,price:getMaintenanceTotal(m)}];
  const rawAmount=items.reduce((s,it)=>s+((+it.qty||1)*(+it.price||0)),0);
  const discount=m.discount||0;
  const totalIncome=getMaintenanceIncome(m);
  const workAmount=getMaintenanceTotal(m);
  const discVal=rawAmount-workAmount;
  const advancesTotal=getMaintenanceAdvances(m);
  const invoiceNo=m.invoiceNo||('WRK-'+maintId.slice(-6).toUpperCase());
  setPrintFile('maint',client.name,invoiceNo,!withPrices);
  const todayStr=fmtDate(new Date());
  const colCount=withPrices?5:3;
  const itemsRows=items.map((it,i)=>{
    const lineTotal=(+it.price||0)*(+it.qty||1);
    return `<tr>
      <td style="text-align:center;color:#9ca3af;font-size:8px">${i+1}</td>
      <td style="font-weight:600;color:#1a1a2e">${esc(it.type||'—')}</td>
      <td style="color:#374151; font-size: 8.5px;">${esc(it.desc||'—')}</td>
      <td style="text-align:center;font-weight:600">${it.qty||1}</td>
      ${withPrices?`<td style="text-align:right;font-weight:700;color:#2F6B4E">${fmt(lineTotal)}</td>`:''}
    </tr>`;
  }).join('');

  return `
  <div class="print-doc">
    <div class="print-header">
      ${getCompanyHeader()}
      <div style="text-align:left; flex-shrink:0;">
        <div class="print-doc-type">${withPrices?'فاتورة عمل':'وصف الأعمال'}</div>
        ${withPrices?`<div style="display:inline-block; background:#334155; color:#fff; border-radius:4px; padding:2px 6px; margin:3px 0;">
	          <div style="font-size:7px; opacity:.9; font-weight:600;">رقم الفاتورة</div>
	          <div style="font-size:10px; font-weight:800;">#${esc(invoiceNo)}</div>
	        </div>`:''}
        <div class="print-doc-meta">
          <b>تاريخ البدء:</b> <b style="color:#1a1a2e">${fmtDate(m.startDate)||todayStr}</b>
          ${m.endDate?`<br><b>تاريخ الانتهاء:</b> ${fmtDate(m.endDate)}`:''}
          ${m.projectName?`<br><b>المشروع:</b> <span style="color:#334155">${esc(m.projectName)}</span>`:''}
        </div>
      </div>
    </div>

    <div class="print-to-section">
      <div class="print-to-box">
        <label>${withPrices?'فاتورة إلى':'مقدم إلى'}</label>
        <div class="val">${esc(client.name)}${m.branch?` — <span style="color:#1e293b; font-size:9px;">${esc(m.branch)}</span>`:''}</div>
        <div style="margin-top:4px; display:flex; flex-direction:column; gap:2px;">
          ${client.phone?`<div class="val-sub" style="display:flex; align-items:center; gap:4px;"><span style="color:#1e293b;">●</span> هاتف: ${esc(client.phone)}</div>`:''}
          ${client.address?`<div class="val-sub" style="display:flex; align-items:center; gap:4px;"><span style="color:#1e293b;">●</span> العنوان: ${esc(client.address)}</div>`:''}
        </div>
      </div>
      <div class="print-to-box" style="${withPrices?'background:#ffffff; border-color:#93C5FD;':''}">
        ${withPrices?`<label style="color:#1D4ED8;">صافي الفاتورة</label>
        <div style="font-size:15px; font-weight:900; color:#1E3A8A; line-height:1.1;">${fmt(conv(totalIncome))}${curTag(dispCur)}</div>
        <div style="font-size:7.5px; color:#5B7DB1; margin-top:1px;">${items.length} بند ${discount?` (بعد حسم ${discount}%)`:''}</div>`:
        `<label>معلومات المستند</label>
        <div class="val-sub" style="line-height:1.9;">
          <b>التاريخ:</b> ${fmtDate(m.startDate)||todayStr}<br>
          ${m.branch?`<b>الفرع:</b> ${esc(m.branch)}<br>`:''}
          ${m.projectName?`<b>المشروع:</b> ${esc(m.projectName)}`:''}
        </div>`}
      </div>
    </div>

    <table class="print-table" style="table-layout:fixed; width:100%;">
      <thead>
        <tr>
          <th style="width:22px; text-align:center;">#</th>
          <th style="width:20%;">نوع العمل</th>
          <th>وصف العمل</th>
          <th style="width:10%; text-align:center;">الكمية</th>
          ${withPrices?'<th style="width:16%; text-align:right;">الإجمالي</th>':''}
        </tr>
      </thead>
      <tbody>
        ${itemsRows||`<tr><td colspan="${colCount}" style="text-align:center; color:#9ca3af; padding:18px;">لا يوجد بنود</td></tr>`}
      </tbody>
      ${withPrices?`<tfoot>
        ${discount?`
        <tr style="background:#f8f9fa; border-top:1.5px solid #e0e0e0;">
          <td colspan="${colCount-1}" style="font-weight:700; font-size:9px; text-align:right; padding:5px 6px;">الإجمالي قبل الحسم</td>
          <td style="font-weight:900; font-size:11px; color:#334155; text-align:right; padding:5px 6px;">${fmt(conv(rawAmount))}${curTag(dispCur)}</td>
        </tr>
        <tr style="background:#fff; border-top:1px solid #eee;">
          <td colspan="${colCount-1}" style="font-weight:600; font-size:8.5px; text-align:right; padding:4px 6px; color:var(--salary);">قيمة الحسم (${discount}%)</td>
          <td style="font-weight:700; font-size:10px; color:var(--salary); text-align:right; padding:4px 6px;">-${fmt(conv(discVal))}${curTag(dispCur)}</td>
        </tr>` : ''}
        <tr style="background:#f8f9fa; border-top:1px solid #e0e0e0;">
          <td colspan="${colCount-1}" style="font-weight:700; font-size:9px; text-align:right; padding:5px 6px;">${advancesTotal?'الإجمالي بعد الدفعات المقدمة':'الصافي النهائي'}</td>
          <td style="font-weight:900; font-size:11px; color:#334155; text-align:right; padding:5px 6px;">${fmt(conv(totalIncome))}${curTag(dispCur)}</td>
        </tr>
        ${chargesPrintRows(m,workAmount,colCount,conv,curTag(dispCur),totalIncome)}
        ${(m.paidAmount||0)>0 ? `
        <tr style="background:#fff; border-top:1px solid #eee;">
          <td colspan="${colCount-1}" style="font-weight:600; font-size:8.5px; text-align:right; padding:4px 6px; color:#6b7280;">إجمالي الدفعات المسددة</td>
          <td style="font-weight:700; font-size:10px; color:#059669; text-align:right; padding:4px 6px;">${fmt(conv(m.paidAmount))}${curTag(dispCur)}</td>
        </tr>
        ${maintDiscountTotal(m)>0?`<tr style="background:#fff; border-top:1px solid #eee;">
          <td colspan="${colCount-1}" style="font-weight:600; font-size:8.5px; text-align:right; padding:4px 6px; color:var(--salary);">خصم عند التحصيل</td>
          <td style="font-weight:700; font-size:10px; color:var(--salary); text-align:right; padding:4px 6px;">-${fmt(conv(maintDiscountTotal(m)))}${curTag(dispCur)}</td>
        </tr>`:''}
        <tr style="background:#fef2f2; border-top:1px solid #fee2e2;">
          <td colspan="${colCount-1}" style="font-weight:700; font-size:9px; text-align:right; padding:5px 6px; color:#991b1b;">صافي المبلغ المتبقي</td>
          <td style="font-weight:900; font-size:11px; color:#dc2626; text-align:right; padding:5px 6px;">${fmt(conv(maintRemaining(m)))}${curTag(dispCur)}</td>
        </tr>` : ''}
      </tfoot>`:''}
    </table>

    ${m.notes?`<div class="print-note-box"><b style="color:#1a1a2e;">📝 ملاحظات:</b><br>${formatNotesHTML(m.notes)}</div>`:''}
    ${co.printNote?`<div style="text-align:center; padding:5px; background:#fffaf0; border-radius:5px; font-weight:600; font-size:9px; color:#334155; margin-bottom:7px;">${esc(co.printNote)}</div>`:''}

    <div class="print-sign-row">
      <div class="print-sign-box">

        <div style="height:20px;"></div>
        <div style="font-weight:700;">توقيع العميل</div>
        <div style="font-size:7px; color:#9ca3af; margin-top:1px;">التاريخ: ___________</div>
      </div>
      <div class="print-sign-box">

        <div style="height:20px;"></div>
        <div style="font-weight:700;">${esc(getCompanySignatory())}</div>
        <div style="font-size:7px; color:#9ca3af; margin-top:1px;">التاريخ: ___________</div>
      </div>
    </div>

    <div class="print-footer">
      ${companyFooterPhonesHTML()}
      ${co.email?`<div>${esc(co.email)}</div>`:''}
      <div>جميع الحقوق محفوظة © ${new Date().getFullYear()} ${esc(co.name||'Security Mask')}</div>
    </div>
  </div>`;
}
// شريط أزرار الطباعة مع خيار تبديل عملة عرض الإجمالي النهائي (دولار/سوري) حسب آخر سعر صرف
// محفوظ بالإعدادات — تبديل عرضي فقط للطباعة الحالية، بدون أي تعديل على السجل المخزّن
function printActionsBarWithCurrency(kind,recId,withPrices,curSel){
  return `<div class="print-actions-bar"><!--LANGSEL-->
    <span style="display:inline-flex;align-items:center;gap:6px;margin-inline-end:8px;font-size:12px;color:#374151">
      <i class="ti ti-currency-dollar"></i> عرض الإجمالي بعملة:
      <select onchange="switchPrintInvoiceCurrency('${kind}','${recId}',${!!withPrices},this.value)" style="padding:4px 8px;border-radius:6px;border:1px solid #d1d5db;font-size:12px">
        <option value="SYP" ${curSel==='SYP'?'selected':''}>ل.س (سوري)</option>
        <option value="USD" ${curSel==='USD'?'selected':''}>$ (دولار)</option>
      </select>
    </span>
    <button onclick="doPrint()" style="background:#334155;color:white;border:none;border-radius:8px;padding:10px 22px;font-size:14px;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:6px">🖨️ طباعة</button>
    <button onclick="doSavePDF(this)" style="background:#2563eb;color:white;border:none;border-radius:8px;padding:10px 22px;font-size:14px;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:6px">📄 حفظ PDF</button>
    <button onclick="closePrintArea()" style="background:#f3f4f6;color:#374151;border:1px solid #ccc;border-radius:8px;padding:10px 22px;font-size:14px;cursor:pointer;font-weight:600">✕ إغلاق</button>
  </div>`;
}
function switchPrintInvoiceCurrency(kind,recId,withPrices,cur){
  const html=kind==='maint'?buildMaintInvoiceHTML(recId,withPrices,cur):buildSaleInvoiceHTML(recId,withPrices,cur);
  if(!html)return;
  showPrintDoc(html+printActionsBarWithCurrency(kind,recId,withPrices,cur));
}
function printMaintInvoice(maintId,withPrices){
  const html=buildMaintInvoiceHTML(maintId,withPrices);
  if(!html)return;
  closeModal();
  const m=db.maintenance.find(x=>x.id===maintId);
  const bar=withPrices?printActionsBarWithCurrency('maint',maintId,withPrices,(m&&m.currency)||'SYP'):PRINT_ACTIONS_BAR_LANG;
  showPrintDoc(html+bar);
}
function bulkPrintMaint(withPrices){
  window._mSel=window._mSel||new Set();
  if(window._mSel.size===0)return;
  const ids=db.maintenance.filter(x=>window._mSel.has(x.id)).map(x=>x.id);
  const combined=ids.map(id=>buildMaintInvoiceHTML(id,withPrices)).join('');
  if(!combined)return;
  setPrintFile('bulkMaint','','',!withPrices,ids.length);
  closeModal();
  showPrintDoc(combined+PRINT_ACTIONS_BAR_LANG);
}
function printInvoice(saleId,withPrices){
  const html=buildSaleInvoiceHTML(saleId,withPrices);
  if(!html)return;
  closeModal();
  const s=db.sales.find(x=>x.id===saleId);
  const bar=withPrices?printActionsBarWithCurrency('sale',saleId,withPrices,(s&&s.currency)||'SYP'):PRINT_ACTIONS_BAR_LANG;
  showPrintDoc(html+bar);
}
function bulkPrintSales(withPrices){
  const s=bSel('sales');
  if(s.size===0)return;
  const ids=db.sales.filter(x=>s.has(x.id)).map(x=>x.id);
  const combined=ids.map(id=>buildSaleInvoiceHTML(id,withPrices)).join('');
  if(!combined)return;
  setPrintFile('bulkSales','','',!withPrices,ids.length);
  closeModal();
  showPrintDoc(combined+PRINT_ACTIONS_BAR_LANG);
}

function printQuote(quoteId){
  const q=db.quotes.find(x=>x.id===quoteId);
  if(!q)return;
  const co=db.company||{};
  const client=db.clients.find(c=>c.id===q.clientId)||{name:q.clientNameFree||'—'};
  const discount=q.discount||0;
  const rawTotal=q.items&&q.items.length?q.items.reduce((s,i)=>{const e=quoteItemEffective(i);return s+e.price*e.qty;},0):(q.totalValue||0);
  // totalValue قد يكون 0 فعلاً (حسم 100%) — لا نعتبره "فاضي" ونرجع للإجمالي قبل الحسم
  const total=(q.totalValue!==undefined&&q.totalValue!==null&&q.totalValue!=='')?(+q.totalValue||0):rawTotal;
  const discVal=rawTotal-total;
  const quoteNo=q.invoiceNo||('QT-'+quoteId.slice(-6).toUpperCase());
  const pdfFileName='عرض_سعر_'+client.name+'_'+quoteNo;
  setPrintFile('quote',client.name,quoteNo);
  const statusLabel=q.status||'معلق';
  const todayStr=fmtDate(new Date());

  const itemsRows=(q.items||[]).map((item,idx)=>{
    const eff=quoteItemEffective(item);
    const price=eff.price;
    const qty=eff.qty;
    // الخيارات الأخرى (البدائل) تظهر للزبون بسعرها، بدون ما تدخل بالإجمالي إلا إذا اختارها بدل الخيار الحالي
    const otherOptions=[];
    if(item.selectedIdx&&item.alts&&item.alts.length){
      otherOptions.push({desc:item.desc,model:item.modelNumber||'',qty:+item.qty||1,price:+item.price||0,label:'الخيار الأساسي'});
    }
    (item.alts||[]).forEach((alt,ai)=>{
      if((item.selectedIdx||0)!==ai+1)otherOptions.push({desc:alt.desc||item.desc,model:alt.modelNumber||'',qty:+alt.qty||1,price:+alt.price||0,label:'خيار بديل'});
    });
    const altsHtml=otherOptions.length?`<div style="margin-top:4px;font-size:7.5px;color:#8a8f98;line-height:1.6">
      ${otherOptions.map(o=>`<div>↳ ${esc(o.label)}: ${esc(o.desc||'—')}${o.model?' ['+esc(o.model)+']':''} × ${o.qty} = ${fmt(o.price*o.qty)} <span style="color:var(--salary)">(بديل — غير مدرج بالإجمالي)</span></div>`).join('')}
    </div>`:'';
    return `<tr>
      <td style="text-align:center;color:#9ca3af;font-size:8px">${idx+1}</td>
      <td style="font-weight:600;color:#1a1a2e">${esc(eff.desc||'—')}${altsHtml}</td>
      <td style="color:#374151; font-size: 8.5px; text-align:right; unicode-bidi:plaintext;">${esc(eff.modelNumber||'—')}</td>
      <td style="color:#374151; font-size: 8.5px;">${esc(eff.note||'—')}</td>
      <td style="text-align:right;color:#2F6B4E">${fmt(price)}</td>
      <td style="text-align:center;font-weight:700">${qty}</td>
      <td style="text-align:right;font-weight:700;color:#2F6B4E">${fmt(price*qty)}</td>
    </tr>`;
  }).join('');

  const notesHtml=(q.notes||'').split('\n').filter(l=>l.trim()).map(l=>`<li>${esc(l)}</li>`).join('');

  const colCount=7;
  const html=`
  <div class="print-doc">
    <div class="print-header">
      ${getCompanyHeader()}
      <div style="text-align:left; flex-shrink:0;">
        <div class="print-doc-type">عرض سعر</div>
	        <div style="display:inline-block; background:#334155; color:#fff; border-radius:4px; padding:2px 6px; margin:3px 0;">
	          <div style="font-size:7px; opacity:.9; font-weight:600;">رقم العرض</div>
	          <div style="font-size:10px; font-weight:800;">#${esc(quoteNo)}</div>
	        </div>
        <div class="print-doc-meta">
          <b>التاريخ:</b> <b style="color:#1a1a2e">${fmtDate(q.date)||todayStr}</b><br>
          <b>الحالة:</b> <span style="color:#334155">${esc(statusLabel)}</span>
          ${q.projectName?`<br><b>المشروع:</b> ${esc(q.projectName)}`:''}
        </div>
      </div>
    </div>

    <div class="print-to-section">
      <div class="print-to-box">
        <label>بيانات العميل</label>
        <div class="val">${esc(client.name)}</div>
        <div style="margin-top:4px; display:flex; flex-direction:column; gap:2px;">
          ${client.phone?`<div class="val-sub" style="display:flex; align-items:center; gap:4px;"><span style="color:#1e293b;">●</span> هاتف: ${esc(client.phone)}</div>`:''}
          ${client.address?`<div class="val-sub" style="display:flex; align-items:center; gap:4px;"><span style="color:#1e293b;">●</span> العنوان: ${esc(client.address)}</div>`:''}
        </div>
      </div>
		      <div class="print-to-box" style="background:#ffffff; border-color:#93C5FD;">
		        <label style="color:#1D4ED8;">صافي العرض</label>
		        <div style="font-size:15px; font-weight:900; color:#1E3A8A; line-height:1.1;">${fmt(total)} ${curLabel(q.currency)}</div>
		        <div style="font-size:7.5px; color:#5B7DB1; margin-top:1px;">${(q.items||[]).length} صنف ${discount?` (بعد حسم ${discount}%)`:''}</div>
		      </div>
    </div>

    <table class="print-table" style="table-layout:fixed; width:100%;">
      <thead>
        <tr>
          <th style="width:22px; text-align:center;">#</th>
          <th style="width:13%;">المادة</th>
          <th style="width:12%;">Part Number</th>
          <th>وصف المادة</th>
          <th style="width:12%; text-align:right;">إفرادي</th>
          <th style="width:8%; text-align:center;">الكمية</th>
          <th style="width:13%; text-align:right;">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows||`<tr><td colspan="${colCount}" style="text-align:center; color:#9ca3af; padding:18px;">لا يوجد أصناف</td></tr>`}
      </tbody>
		      <tfoot>
		        ${discount?`
		        <tr style="background:#f8f9fa; border-top:1.5px solid #e0e0e0;">
		          <td colspan="${colCount-1}" style="font-weight:700; font-size:9px; text-align:right; padding:5px 6px;">الإجمالي قبل الحسم</td>
		          <td style="font-weight:900; font-size:11px; color:#334155; text-align:right; padding:5px 6px;">${fmt(rawTotal)}</td>
		        </tr>
		        <tr style="background:#fff; border-top:1px solid #eee;">
		          <td colspan="${colCount-1}" style="font-weight:600; font-size:8.5px; text-align:right; padding:4px 6px; color:var(--salary);">قيمة الحسم (${discount}%)</td>
		          <td style="font-weight:700; font-size:10px; color:var(--salary); text-align:right; padding:4px 6px;">-${fmt(discVal)}</td>
		        </tr>
		        <tr style="background:#f8f9fa; border-top:1px solid #e0e0e0;">
		          <td colspan="${colCount-1}" style="font-weight:700; font-size:9px; text-align:right; padding:5px 6px;">الصافي النهائي</td>
		          <td style="font-weight:900; font-size:11px; color:#334155; text-align:right; padding:5px 6px;">${fmt(total)}</td>
		        </tr>` : `
		        <tr style="background:#f8f9fa; border-top:1.5px solid #e0e0e0;">
		          <td colspan="${colCount-1}" style="font-weight:700; font-size:9px; text-align:right; padding:5px 6px;">الإجمالي الصافي</td>
		          <td style="font-weight:900; font-size:11px; color:#334155; text-align:right; padding:5px 6px;">${fmt(total)}</td>
		        </tr>`}
		      ${chargesPrintRows(q,total,colCount,null,'')}
		      </tfoot>
    </table>

    ${q.notes?`<div class="print-note-box">
      <b style="color:#1a1a2e;">📝 ملاحظات وشروط العرض:</b>
      <ul style="margin-right:12px; font-size:8.5px; color:#6b7280; line-height:1.6; margin-top:4px;">
        ${notesHtml}
      </ul>
    </div>`:''}

    ${co.printNote?`<div style="text-align:center; padding:5px; background:#fffaf0; border-radius:5px; font-weight:600; font-size:9px; color:#334155; margin-bottom:7px;">${esc(co.printNote)}</div>`:''}

    <div class="print-sign-row">
      <div class="print-sign-box">

        <div style="height:20px;"></div>
        <div style="font-weight:700;">توقيع العميل</div>
        <div style="font-size:7px; color:#9ca3af; margin-top:1px;">التاريخ: ___________</div>
      </div>
      <div class="print-sign-box">

        <div style="height:20px;"></div>
        <div style="font-weight:700;">${esc(getCompanySignatory())}</div>
        <div style="font-size:7px; color:#9ca3af; margin-top:1px;">التاريخ: ___________</div>
      </div>
    </div>

    <div class="print-footer">
      ${companyFooterPhonesHTML()}
      ${co.email?`<div>${esc(co.email)}</div>`:''}
      <div>جميع الحقوق محفوظة © ${new Date().getFullYear()} ${esc(co.name||'Security Mask')}</div>
    </div>
  </div>
  <div class="print-actions-bar"><!--LANGSEL-->
    <button onclick="doPrint()" style="background:#334155; color:white; border:none; border-radius:8px; padding:10px 22px; font-size:14px; cursor:pointer; font-weight:600; display:flex; align-items:center; gap:6px;">🖨️ طباعة</button>
    <button onclick="doSavePDF(this)" style="background:#2563eb; color:white; border:none; border-radius:8px; padding:10px 22px; font-size:14px; cursor:pointer; font-weight:600; display:flex; align-items:center; gap:6px;">📄 حفظ PDF</button>
    <button onclick="closePrintArea()" style="background:#f3f4f6; color:#374151; border:1px solid #ccc; border-radius:8px; padding:10px 22px; font-size:14px; cursor:pointer; font-weight:600;">✕ إغلاق</button>
  </div>`;
  closeModal();
  showPrintDoc(html);
}

/* ===== طباعة/تصدير مقارنة العرض بالتنفيذ الفعلي — مستند للزبون ===== */
function printQuoteComparison(quoteId){
  const q=db.quotes.find(x=>x.id===quoteId);
  if(!q)return;
  const co=db.company||{};
  const client=db.clients.find(c=>c.id===q.clientId)||{name:q.clientNameFree||'—'};
  const projSales=q.projectName?db.sales.filter(s=>(s.projectName||'')===q.projectName):[];
  const projMaints=q.projectName?db.maintenance.filter(m=>(m.projectName||'')===q.projectName):[];
  const sales=projSales.length?projSales:(q.convertedSaleId?db.sales.filter(s=>s.id===q.convertedSaleId):[]);
  const maints=projMaints.length?projMaints:(q.convertedMaintenanceId?db.maintenance.filter(m=>m.id===q.convertedMaintenanceId):[]);
  if(!sales.length&&!maints.length){alert('هاد العرض ما تحول لفاتورة مبيعات أو عمل بعد.');return;}

  const hasSnapshot=!!q.baselineSnapshot;
  const baseItems=hasSnapshot?q.baselineSnapshot.items:(q.items||[]);
  const originalTotal=hasSnapshot?q.baselineSnapshot.totalValue:((+q.totalValue||0)||(q.items||[]).reduce((s,i)=>{const e=quoteItemEffective(i);return s+e.price*e.qty;},0)*(1-((+q.discount||0)/100)));
  const currentSaleTotal=sales.reduce((s,x)=>s+(+x.totalPrice||0),0);
  const currentMaintTotal=maints.reduce((s,m)=>s+(+m.workAmount||0),0);
  const currentTotal=currentSaleTotal+currentMaintTotal;
  const diff=currentTotal-originalTotal;
  const pctOfOriginal=originalTotal?(currentTotal/originalTotal*100):(currentTotal>0?100:0);

  // التجميع صار بيعتمد على Part Number كمان: نفس المادة بموديلين مختلفين = بندين منفصلين
  function groupItems(list){
    const map=new Map();
    list.forEach(it=>{
      const desc=(it.desc||'—').trim()||'—';
      const note=(it.note||'').trim();
      const model=(it.model||'').trim();
      const key=desc+'||'+model+'||'+note;
      if(!map.has(key))map.set(key,{desc,note,model,qty:0,total:0});
      const g=map.get(key);
      g.qty+=(+it.qty||1);
      g.total+=(+it.total||0);
    });
    return map;
  }
  const origItems=groupItems((baseItems||[]).map(it=>{const e=quoteItemEffective(it);return {desc:e.desc,qty:e.qty,total:e.price*e.qty,note:e.note,model:e.modelNumber};}));
  const curItems=groupItems([
    ...sales.flatMap(s=>(s.items||[]).map(it=>({desc:it.type,qty:it.qty||1,total:(+it.salePrice||0)*(+it.qty||1),note:(it.note||''),model:it.modelNumber||''}))),
    ...maints.flatMap(m=>(m.workItems||[]).map(it=>({desc:it.type,qty:it.qty||1,total:(+it.price||0)*(+it.qty||1),note:it.desc||'',model:''})))
  ]);
  // حماية من فروقات وهمية: إذا بند بالعرض بدون Part Number وقابلو بالتنفيذ نفس المادة+الوصف لكن بـ Part Number
  // (أو العكس) منعتبرهم نفس البند ومنوحّد الـ Part Number، بدل ما يطلعوا "محذوف" + "بند جديد".
  (function reconcileModels(){
    const sig=g=>g.desc+'||'+g.note;
    [[origItems,curItems],[curItems,origItems]].forEach(([A,B])=>{
      [...A.entries()].forEach(([k,g])=>{
        if(B.has(k)||g.model)return;                    // مطابق أصلاً، أو الجانب هذا فيه Part Number
        const m=[...B.entries()].find(([kb,gb])=>gb.model&&!A.has(kb)&&sig(gb)===sig(g));
        if(m){
          const newKey=m[0];
          g.model=m[1].model;
          A.delete(k);A.set(newKey,g);
        }
      });
    });
  })();
  const allDescs=[...new Set([...origItems.keys(),...curItems.keys()])];
  const itemsRows=allDescs.map((key,idx)=>{
    const o=origItems.get(key);
    const c=curItems.get(key);
    const oTotal=o?o.total:0, cTotal=c?c.total:0;
    const itemDiff=cTotal-oTotal;
    const label=(o&&o.desc)||(c&&c.desc)||'—';
    const detail=esc((o&&o.note)||(c&&c.note)||'—');
    const modelTxt=esc((o&&o.model)||(c&&c.model)||'—');
    let statusTxt,statusColor;
    if(o&&!c){statusTxt='محذوف';statusColor='#dc2626';}
    else if(!o&&c){statusTxt='بند جديد';statusColor='#dc2626';}
    else if(Math.abs(itemDiff)>0.01){statusTxt='تغيّر';statusColor='var(--salary)';}
    else {statusTxt='مطابق';statusColor='#6b7280';}
    return `<tr>
      <td style="text-align:center;color:#9ca3af;font-size:8px">${idx+1}</td>
      <td style="font-weight:600;color:#1a1a2e">${esc(label)}</td>
      <td style="color:#374151; font-size: 8.5px; text-align:right; unicode-bidi:plaintext;">${modelTxt}</td>
      <td style="color:#374151;font-size:8.5px">${detail}</td>
      <td style="text-align:center">${o?o.qty:'—'}</td>
      <td style="text-align:right">${o?fmt(oTotal):'—'}</td>
      <td style="text-align:center">${c?c.qty:'—'}</td>
      <td style="text-align:right">${c?fmt(cTotal):'—'}</td>
      <td style="text-align:center;font-weight:700;color:${statusColor}">${statusTxt}</td>
    </tr>`;
  }).join('');

  const quoteNo=q.invoiceNo||('QT-'+quoteId.slice(-6).toUpperCase());
  setPrintFile('compare',client.name,quoteNo);
  const todayStr=fmtDate(new Date());
  const statusColor=diff===0?'#334155':diff>0?'var(--salary)':'#1B7A43';
  const statusMsg=diff===0?'التنفيذ الفعلي مطابق تماماً للعرض المقدَّم.'
    :diff>0?`التنفيذ الفعلي زاد عن العرض المقدَّم بمقدار ${fmt(Math.abs(diff))} ${curLabel(q.currency)}.`
    :`التنفيذ الفعلي أقل من العرض المقدَّم بمقدار ${fmt(Math.abs(diff))} ${curLabel(q.currency)}.`;

  const html=`
  <div class="print-doc">
    <div class="print-header">
      ${getCompanyHeader()}
      <div style="text-align:left; flex-shrink:0;">
        <div class="print-doc-type">مقارنة العرض بالتنفيذ الفعلي</div>
        <div style="display:inline-block; background:#334155; color:#fff; border-radius:4px; padding:2px 6px; margin:3px 0;">
          <div style="font-size:7px; opacity:.9; font-weight:600;">مرجع العرض</div>
          <div style="font-size:10px; font-weight:800;">#${esc(quoteNo)}</div>
        </div>
        <div class="print-doc-meta">
          <b>التاريخ:</b> <b style="color:#1a1a2e">${todayStr}</b>
          ${q.projectName?`<br><b>المشروع:</b> ${esc(q.projectName)}`:''}
        </div>
      </div>
    </div>

    <div class="print-to-section">
      <div class="print-to-box">
        <label>بيانات العميل</label>
        <div class="val">${esc(client.name)}</div>
        ${client.phone?`<div class="val-sub">هاتف: ${esc(client.phone)}</div>`:''}
      </div>
      <div class="print-to-box" style="background:#ffffff; border-color:#93C5FD;">
        <label style="color:#1D4ED8;">ملخّص المقارنة</label>
        <div style="font-size:8.5px;line-height:1.8;color:#1E3A8A">
          العرض الأساسي: <b>${fmt(originalTotal)} ${curLabel(q.currency)}</b><br>
          التنفيذ الفعلي: <b style="color:${statusColor}">${fmt(currentTotal)} ${curLabel(q.currency)}</b> (${pctOfOriginal.toFixed(1)}%)
        </div>
      </div>
    </div>

    <div style="font-size:9px;margin-bottom:8px;padding:6px 8px;border-radius:6px;background:#f8fafc;color:${statusColor};font-weight:700">${statusMsg}</div>

    <table class="print-table" style="table-layout:fixed; width:100%;">
      <thead>
        <tr>
          <th style="width:20px; text-align:center;">#</th>
          <th style="width:15%;">البند</th>
          <th style="width:12%;">Part Number</th>
          <th>التفاصيل</th>
          <th style="width:8%; text-align:center;">كمية العرض</th>
          <th style="width:12%; text-align:right;">قيمة العرض</th>
          <th style="width:8%; text-align:center;">كمية الفعلي</th>
          <th style="width:12%; text-align:right;">القيمة الفعلية</th>
          <th style="width:10%; text-align:center;">الحالة</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows||'<tr><td colspan="9" style="text-align:center;color:#9ca3af;padding:18px;">لا يوجد بنود</td></tr>'}
      </tbody>
      <tfoot>
        <tr style="background:#f8f9fa; border-top:1.5px solid #e0e0e0;">
          <td colspan="5" style="font-weight:700; font-size:9px; text-align:right; padding:5px 6px;">الإجمالي</td>
          <td style="font-weight:900; font-size:10px; color:#334155; text-align:right; padding:5px 6px;">${fmt(originalTotal)}</td>
          <td></td>
          <td style="font-weight:900; font-size:10px; color:${statusColor}; text-align:right; padding:5px 6px;">${fmt(currentTotal)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    ${co.printNote?`<div style="text-align:center; padding:5px; background:#fffaf0; border-radius:5px; font-weight:600; font-size:9px; color:#334155; margin-bottom:7px;">${esc(co.printNote)}</div>`:''}

    <div class="print-sign-row">
      <div class="print-sign-box">
        <div style="height:20px;"></div>
        <div style="font-weight:700;">توقيع العميل</div>
        <div style="font-size:7px; color:#9ca3af; margin-top:1px;">التاريخ: ___________</div>
      </div>
      <div class="print-sign-box">
        <div style="height:20px;"></div>
        <div style="font-weight:700;">${esc(getCompanySignatory())}</div>
        <div style="font-size:7px; color:#9ca3af; margin-top:1px;">التاريخ: ___________</div>
      </div>
    </div>

    <div class="print-footer">
      ${companyFooterPhonesHTML()}
      ${co.email?`<div>${esc(co.email)}</div>`:''}
      <div>جميع الحقوق محفوظة © ${new Date().getFullYear()} ${esc(co.name||'Security Mask')}</div>
    </div>
  </div>
  <div class="print-actions-bar"><!--LANGSEL-->
    <button onclick="doPrint()" style="background:#334155; color:white; border:none; border-radius:8px; padding:10px 22px; font-size:14px; cursor:pointer; font-weight:600; display:flex; align-items:center; gap:6px;">🖨️ طباعة</button>
    <button onclick="doSavePDF(this)" style="background:#2563eb; color:white; border:none; border-radius:8px; padding:10px 22px; font-size:14px; cursor:pointer; font-weight:600; display:flex; align-items:center; gap:6px;">📄 حفظ PDF</button>
    <button onclick="closePrintArea()" style="background:#f3f4f6; color:#374151; border:1px solid #ccc; border-radius:8px; padding:10px 22px; font-size:14px; cursor:pointer; font-weight:600;">✕ إغلاق</button>
  </div>`;
  closeModal();
  showPrintDoc(html);
}

/* ===== HELPERS ===== */
/* ===== منع فقدان البيانات: تحقق من ارتباط عميل/عامل بسجلات مالية قبل الحذف ===== */
function clientLinkCount(id){
  return (db.sales||[]).filter(s=>s.clientId===id).length
    +(db.maintenance||[]).filter(m=>m.clientId===id).length
    +(db.quotes||[]).filter(q=>q.clientId===id).length
    +(db.contracts||[]).filter(c=>c.clientId===id).length   // عقود وأجهزة العميل ما بتصير يتيمة لما ينحذف
    +(db.devices||[]).filter(x=>x.clientId===id).length;
}
function deleteItem(col,id){
  if(!guardDelete())return;
  if(col==='clients'){
    const n=clientLinkCount(id);
    if(n>0){
      if(!confirm(`⚠️ هذا العميل مرتبط بـ ${n} سجل مالي (فواتير/أعمال/عروض أسعار). حذفه سيفقد اسمه من هذه السجلات نهائياً (ستظهر كـ \"—\"). هل تريد المتابعة فعلاً؟`))return;
    }else{
      if(!confirm('حذف هذا العنصر نهائياً؟'))return;
    }
  }else{
    if(!confirm('حذف هذا العنصر نهائياً؟'))return;
  }
  const affectedProject=(col==='sales'||col==='maintenance')?(db[col].find(x=>x.id===id)||{}).projectName:null;
  db[col]=db[col].filter(x=>x.id!==id);
  logAction('حذف',col,id);
  if(affectedProject)refreshProjectAutoStatus(affectedProject);
  saveDB(db);render();
}
/* ===== BULK SELECTION (تحديد متعدد لكل القوائم) ===== */
window._bulkSel=window._bulkSel||{};
function bSel(key){window._bulkSel[key]=window._bulkSel[key]||new Set();return window._bulkSel[key];}
function bulkToggleAll(key,cb,ids){const s=bSel(key);if(cb.checked)ids.forEach(id=>s.add(id));else ids.forEach(id=>s.delete(id));rerenderPage(key);}
function bulkToggleRow(key,id,cb){const s=bSel(key);if(cb.checked)s.add(id);else s.delete(id);rerenderPage(key);}
function bulkClearSel(key){bSel(key).clear();rerenderPage(key);}
function rerenderPage(page){
  const content=document.getElementById('main-content'),acts=document.getElementById('topbar-actions');
  if(page==='sales')renderSales(content,acts);
  else if(page==='quotes')renderQuotes(content,acts);
  else if(page==='tools')renderTools(content,acts);
  else if(page==='cars')renderCars(content,acts);
  else if(page==='loans')renderLoans(content,acts);
  else if(page==='clients')renderClients(content,acts);
  else if(page==='docs')renderDocs(content,acts);
  else if(page==='maintenance')renderMaintenance(content,acts);
}
function bulkDeleteGeneric(key,col){
  const s=bSel(key);
  if(s.size===0)return;
  if(!guardDelete())return;
  if(!confirm(`حذف ${s.size} عنصر نهائياً؟ هذا الإجراء لا يمكن التراجع عنه ولا يمكن استرجاع البيانات المحذوفة.`))return;
  db[col]=db[col].filter(x=>!s.has(x.id));
  logAction('حذف جماعي',col,[...s].join(','));
  s.clear();
  saveDB(db);
  rerenderPage(key);
}
function bulkToolbar(key,extraButtonsHTML){
  const s=bSel(key);
  if(s.size===0)return '';
  return `<div class="card" style="margin-bottom:16px;background:var(--accent-light);border-color:var(--accent)">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <div style="font-weight:700;font-size:13px;color:var(--accent-dark)"><i class="ti ti-checkbox"></i> محدد: ${s.size}</div>
      ${extraButtonsHTML||''}
      <button class="btn btn-sm" style="background:var(--surface);color:var(--danger);border-color:var(--danger)" onclick="bulkDeleteGeneric('${key}','${key}')"><i class="ti ti-trash"></i> حذف المحدد</button>
      <button class="btn btn-sm" style="background:var(--surface);margin-inline-start:auto" onclick="bulkClearSel('${key}')"><i class="ti ti-x"></i> إلغاء التحديد</button>
    </div>
  </div>`;
}
function showModal(html){document.getElementById('modal-container').innerHTML=`<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`;}
function closeModal(){
  document.getElementById('modal-container').innerHTML='';
  // في تحديث إجا من جهاز تاني وانتظر لحد ما تسكّر النافذة — هلق منعرضه
  if(window._pendingRemoteRender){
    window._pendingRemoteRender=false;
    render();
    renderSyncBanner('ok','🔄 تم عرض التحديثات اللي وصلت من الجهاز التاني');
  }
}

render();
checkLock();
initIdleAutoLock();
try{if(typeof Image!=='undefined')setTimeout(function(){warmWatermarkLogo();},1500);}catch(e){}
