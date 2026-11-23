/* ====================================================================
   field.js — T42: الوضع الميداني (بدون إنترنت + صور). التوقيع وقائمة الفحص والملاحظات موجودين بورقة الزيارة (T31/T32).
   اللي بيضيفه هاد الملف:
   1) صور الزيارة: بتنضغط (حد أقصى 1280px / JPEG)، وبتتخزّن كـ Blob بـ IndexedDB على الجهاز — مش جوّا بيانات الشركة
      (عشان ما يكبر البلوب ويوصل سقف 8MB). بالبيانات بس معلومات صغيرة: visit.photos=[{id,name,w,h,bytes,at,uploaded,path}].
   2) طابور رفع: لما يتوفر إنترنت الصور بتنرفع لـ Supabase Storage (bucket: visit-photos، خاص + RLS)، وإذا فشل الرفع
      بتضل بالطابور وبنعيد المحاولة. حذف صورة مرفوعة بيتحوّل لطلب حذف بالطابور.
   3) مؤشر الحالة: متصل/غير متصل + عدد التعديلات والصور المعلّقة، ورفع فوري لما يرجع الاتصال.
   تعديلات الزيارة نفسها (بدء، إنجاز، ملاحظات…) كانت أصلاً بتنحفظ محلياً وبتنرفع تلقائياً (saveDB + إعادة محاولة كل 15 ثانية).
   ==================================================================== */
var FIELD_BUCKET='visit-photos';
var FIELD_MAX_PHOTOS=12,FIELD_MAX_DIM=1280,FIELD_MAX_BYTES=350*1024;

/* ---------- تخزين محلي (IndexedDB، وبديل بالذاكرة إذا ما توفر) ---------- */
function fieldMemoryStore(){
  var m={};
  return {kind:'memory',
    put:function(rec){m[rec.id]=rec;return Promise.resolve();},
    get:function(id){return Promise.resolve(m[id]||null);},
    del:function(id){delete m[id];return Promise.resolve();},
    all:function(){return Promise.resolve(Object.keys(m).map(function(k){return m[k];}));}};
}
function fieldIdbStore(){
  var dbp=null;
  function open(){
    if(dbp)return dbp;
    dbp=new Promise(function(res,rej){
      var r=indexedDB.open('sm_field',1);
      r.onupgradeneeded=function(){r.result.createObjectStore('q',{keyPath:'id'});};
      r.onsuccess=function(){res(r.result);};r.onerror=function(){rej(r.error);};
    });
    return dbp;
  }
  function tx(mode,fn){return open().then(function(d){return new Promise(function(res,rej){
    var t=d.transaction('q',mode),s=t.objectStore('q'),rq=fn(s);
    t.oncomplete=function(){res(rq&&rq.result);};t.onerror=function(){rej(t.error);};t.onabort=function(){rej(t.error);};});});}
  return {kind:'idb',
    put:function(rec){return tx('readwrite',function(s){return s.put(rec);}).then(function(){});},
    get:function(id){return tx('readonly',function(s){return s.get(id);}).then(function(r){return r||null;});},
    del:function(id){return tx('readwrite',function(s){return s.delete(id);}).then(function(){});},
    all:function(){return tx('readonly',function(s){return s.getAll();}).then(function(r){return r||[];});}};
}
var FIELD={store:null,compress:null,client:null,syncing:false};
function fieldStore(){
  if(!FIELD.store){
    try{FIELD.store=(typeof indexedDB!=='undefined'&&indexedDB)?fieldIdbStore():fieldMemoryStore();}catch(e){FIELD.store=fieldMemoryStore();}
  }
  return FIELD.store;
}
function fieldClient(){return FIELD.client||(typeof _sb!=='undefined'?_sb:null);}

/* ---------- ضغط الصورة ---------- */
function fieldScale(w,h,max){
  max=max||FIELD_MAX_DIM;
  if(!(w>0)||!(h>0))return {w:0,h:0};
  var k=Math.min(1,max/Math.max(w,h));
  return {w:Math.max(1,Math.round(w*k)),h:Math.max(1,Math.round(h*k))};
}
function fieldDefaultCompress(file){
  return new Promise(function(res,rej){
    var url=URL.createObjectURL(file),img=new Image();
    img.onload=function(){
      var q=0.72,dim=FIELD_MAX_DIM;
      function attempt(){
        var s=fieldScale(img.naturalWidth,img.naturalHeight,dim),cv=document.createElement('canvas');
        cv.width=s.w;cv.height=s.h;cv.getContext('2d').drawImage(img,0,0,s.w,s.h);
        cv.toBlob(function(b){
          if(!b){URL.revokeObjectURL(url);return rej(new Error('تعذّر ضغط الصورة'));}
          if(b.size>FIELD_MAX_BYTES&&(q>0.45||dim>800)){if(q>0.45)q-=0.15;else dim=800;return attempt();}
          URL.revokeObjectURL(url);res({blob:b,w:s.w,h:s.h});
        },'image/jpeg',q);
      }
      attempt();
    };
    img.onerror=function(){URL.revokeObjectURL(url);rej(new Error('الملف مو صورة صالحة'));};
    img.src=url;
  });
}
function fieldCompress(file){return (FIELD.compress||fieldDefaultCompress)(file);}

/* ---------- زيارة ↔ صور ---------- */
function fieldFindVisit(cid,vid){
  var c=(db.contracts||[]).find(function(x){return x.id===cid;});
  return {c:c,v:c&&contractVisits(c).find(function(x){return x.id===vid;})};
}
function fieldPhotoPath(cid,vid,pid){return (typeof TENANT_CODE!=='undefined'?TENANT_CODE:'t')+'/'+cid+'/'+vid+'/'+pid+'.jpg';}
function fieldAddPhotos(cid,vid,files){
  var F=fieldFindVisit(cid,vid);
  if(!F.v)return Promise.reject(new Error('الزيارة غير موجودة'));
  if(typeof permOwnsVisit==='function'&&!permOwnsVisit(F.v))return Promise.reject(new Error('هاي الزيارة مو مسندة إلك'));
  if(F.v.status==='cancelled')return Promise.reject(new Error('الزيارة ملغاة'));
  var list=Array.prototype.slice.call(files||[]);
  F.v.photos=Array.isArray(F.v.photos)?F.v.photos:[];
  var added=[],skipped=0;
  return list.reduce(function(p,f){return p.then(function(){
    if(F.v.photos.length>=FIELD_MAX_PHOTOS){skipped++;return;}
    return fieldCompress(f).then(function(r){
      var pid=uid(),path=fieldPhotoPath(cid,vid,pid);
      return fieldStore().put({id:pid,op:'upload',cid:cid,vid:vid,path:path,blob:r.blob,tries:0,at:Date.now()}).then(function(){
        var meta={id:pid,name:String(f.name||'photo').slice(0,60),w:r.w,h:r.h,bytes:r.blob.size,at:Date.now(),uploaded:false,path:path};
        F.v.photos.push(meta);added.push(meta);
      });
    });
  });},Promise.resolve()).then(function(){
    if(added.length)saveDB(db);
    fieldSync().catch(function(){});
    return {added:added.length,skipped:skipped};
  });
}
function fieldRemovePhoto(cid,vid,pid){
  var F=fieldFindVisit(cid,vid);if(!F.v)return Promise.resolve(false);
  if(typeof permOwnsVisit==='function'&&!permOwnsVisit(F.v))return Promise.resolve(false);
  var arr=Array.isArray(F.v.photos)?F.v.photos:[],i=arr.findIndex(function(p){return p.id===pid;});
  if(i<0)return Promise.resolve(false);
  var meta=arr[i];arr.splice(i,1);saveDB(db);
  return fieldStore().get(pid).then(function(rec){
    if(rec&&rec.op==='upload'&&!meta.uploaded)return fieldStore().del(pid); // ما انرفعت أصلاً: بس نمسحها محلياً
    return fieldStore().put({id:pid,op:'delete',path:meta.path,tries:0,at:Date.now()});
  }).then(function(){fieldSync().catch(function(){});return true;});
}

/* ---------- طابور الرفع ---------- */
function fieldPhotoMeta(cid,vid,pid){
  var F=fieldFindVisit(cid,vid);
  return F.v&&Array.isArray(F.v.photos)?F.v.photos.find(function(p){return p.id===pid;}):null;
}
function fieldOnline(){return typeof navigator==='undefined'||navigator.onLine!==false;}
/* بيرفع/بيحذف كل اللي بالطابور. بيوقف عند أول فشل شبكة (بدون ما يكرر الضغط). بيرجّع {uploaded,deleted,pending,error} */
function fieldSync(){
  if(FIELD.syncing)return FIELD.p.then(function(){return fieldSync();}); // مزامنة شغّالة: منستناها وبعدين دورة تانية (ما بنضيّع طلب)
  var cl=fieldClient();
  if(!cl||!cl.storage||!fieldOnline())return fieldPending().then(function(n){return {uploaded:0,deleted:0,pending:n,offline:true};});
  FIELD.syncing=true;
  var out={uploaded:0,deleted:0,pending:0,error:null},bucket=cl.storage.from(FIELD_BUCKET);
  FIELD.p=fieldStore().all().then(function(recs){
    recs.sort(function(a,b){return a.at-b.at;});
    return recs.reduce(function(p,rec){return p.then(function(){
      if(out.error)return;
      if(rec.op==='delete'){
        return bucket.remove([rec.path]).then(function(r){
          if(r&&r.error){out.error=r.error.message||'remove failed';return;}
          return fieldStore().del(rec.id).then(function(){out.deleted++;});
        });
      }
      var meta=fieldPhotoMeta(rec.cid,rec.vid,rec.id);
      if(!meta){ // انحذفت من الزيارة قبل ما ترتفع
        return fieldStore().del(rec.id);
      }
      return bucket.upload(rec.path,rec.blob,{contentType:'image/jpeg',upsert:true}).then(function(r){
        if(r&&r.error){rec.tries=(rec.tries||0)+1;out.error=r.error.message||'upload failed';return fieldStore().put(rec);}
        meta.uploaded=true;meta.path=rec.path;
        return fieldStore().del(rec.id).then(function(){out.uploaded++;});
      });
    });},Promise.resolve());
  }).catch(function(e){out.error=String(e&&e.message||e);}).then(function(){
    if(out.uploaded)saveDB(db); // علامة "انرفعت" بالبيانات
    return fieldPending();
  }).then(function(n){out.pending=n;FIELD.syncing=false;return out;},function(e){FIELD.syncing=false;throw e;});
  return FIELD.p;
}
function fieldPending(){return fieldStore().all().then(function(r){return r.length;});}
/* رابط عرض الصورة: المحلية أولاً، وإذا انرفعت وانمسحت محلياً → رابط موقّع مؤقت */
function fieldPhotoURL(cid,vid,pid){
  return fieldStore().get(pid).then(function(rec){
    if(rec&&rec.blob&&typeof URL!=='undefined'&&URL.createObjectURL)return URL.createObjectURL(rec.blob);
    var meta=fieldPhotoMeta(cid,vid,pid),cl=fieldClient();
    if(!meta||!meta.uploaded||!cl||!cl.storage||!fieldOnline())return '';
    return cl.storage.from(FIELD_BUCKET).createSignedUrl(meta.path,3600).then(function(r){return (r&&r.data&&r.data.signedUrl)||'';});
  });
}
/* ملخص الحالة */
function fieldStatus(){
  return fieldPending().then(function(n){
    return {online:fieldOnline(),pendingPhotos:n,unsyncedChanges:(typeof _unsyncedChangeCount!=='undefined'?_unsyncedChangeCount:0)};
  });
}
function fieldStatusText(s){
  var parts=[];
  if(!s.online)parts.push('📴 غير متصل — شغلك محفوظ على جهازك وبينرفع لما يرجع النت');
  else if(s.unsyncedChanges>0||s.pendingPhotos>0)parts.push('⏳ جاري الرفع...');
  else parts.push('✅ كل شي مرفوع');
  if(s.unsyncedChanges>0)parts.push(s.unsyncedChanges+' تعديل بانتظار الرفع');
  if(s.pendingPhotos>0)parts.push(s.pendingPhotos+' صورة بانتظار الرفع');
  return parts.join(' · ');
}

/* ---------- واجهة ورقة الزيارة (بتتنادى من contracts.js) ---------- */
function fieldPhotosHTML(v,locked){
  var arr=Array.isArray(v.photos)?v.photos:[];
  return '<div class="form-group"><label class="form-label">صور الزيارة ('+arr.length+'/'+FIELD_MAX_PHOTOS+')</label>'
   +'<div id="vs-photos" style="display:flex;flex-wrap:wrap;gap:8px">'+arr.map(function(p){
      return '<div style="position:relative;width:84px;height:84px;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg2)">'
       +'<img data-pid="'+esc(p.id)+'" alt="" style="width:100%;height:100%;object-fit:cover">'
       +'<span title="'+(p.uploaded?'مرفوعة':'بانتظار الرفع')+'" style="position:absolute;bottom:2px;right:3px;font-size:11px">'+(p.uploaded?'☁️':'⏳')+'</span>'
       +(locked?'':'<button class="btn btn-sm btn-danger" style="position:absolute;top:2px;left:2px;padding:0 5px" onclick="fieldUiRemove(\''+esc(p.id)+'\')">×</button>')+'</div>';}).join('')+'</div>'
   +(locked||arr.length>=FIELD_MAX_PHOTOS?'':'<input type="file" id="vs-photo-in" accept="image/*" capture="environment" multiple style="margin-top:8px" onchange="fieldUiAdd(this)">')+'</div>';
}
function fieldPhotosAfterRender(v){
  (Array.isArray(v.photos)?v.photos:[]).forEach(function(p){
    fieldPhotoURL(window._vsCid,window._vsVid,p.id).then(function(u){
      var im=document.querySelector('#vs-photos img[data-pid="'+p.id+'"]');if(im&&u)im.src=u;}).catch(function(){});
  });
}
function fieldUiAdd(inp){
  var files=inp.files;if(!files||!files.length)return;
  if(typeof vsCollect==='function')vsCollect();
  fieldAddPhotos(window._vsCid,window._vsVid,files).then(function(r){
    if(r.skipped)alert('الحد الأقصى '+FIELD_MAX_PHOTOS+' صورة للزيارة — انتجاهل '+r.skipped+'.');
    vsRenderSheet();
  }).catch(function(e){alert(e.message||e);});
}
function fieldUiRemove(pid){
  if(!confirm('حذف الصورة؟'))return;
  if(typeof vsCollect==='function')vsCollect();
  fieldRemovePhoto(window._vsCid,window._vsVid,pid).then(function(){vsRenderSheet();});
}
/* رفع فوري لما يرجع الاتصال + تحديث المؤشر */
if(typeof window!=='undefined'&&window.addEventListener&&!window.__fieldBound){
  window.__fieldBound=true;
  window.addEventListener('online',function(){
    fieldSync().catch(function(){});
    if(typeof _unsyncedChangeCount!=='undefined'&&_unsyncedChangeCount>0&&!_conflictDetected&&_initialSyncReady)pushToCloud(db);
    if(typeof fieldRefreshBanner==='function')fieldRefreshBanner();
  });
  window.addEventListener('offline',function(){if(typeof fieldRefreshBanner==='function')fieldRefreshBanner();});
}
