/* ====================================================================
   myvisits.js — T43 (الجزء 1 من المرحلة 5): صفحة "زياراتي" للفني.
   - المستخدم بيرتبط بفني (user.workerId) وبعلامة "يشوف زياراته فقط" (user.ownVisitsOnly).
   - لوحة الزيارات والتقويم (visitsBoard / visitsInMonth) بتتقيّد مركزياً بـ core.js (permForcedTech).
   - هاي حماية على مستوى التطبيق (بالمتصفح). العزل الحقيقي على مستوى قاعدة البيانات (RLS لكل مستخدم)
     بيحتاج حساب Supabase Auth لكل فني وتقسيم البيانات بجداول — مو متضمّن هون.
   ==================================================================== */
function myVisitsData(todayIso){
  const u=getCurrentUser(),wid=u?u.workerId:'';
  if(!wid)return {linked:false,board:{today:[],overdue:[],week:[]},done:[]};
  const t=todayIso||localToday(),board=visitsBoard(db,t,wid),done=[];
  (db.contracts||[]).forEach(function(c){contractVisits(c).forEach(function(v){
    if(v.status==='done'&&v.performedBy===wid)done.push({contract:c,visit:v,date:visitDate(v),area:visitArea(c)});});});
  done.sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:0;});
  return {linked:true,board:board,done:done.slice(0,15)};
}
function _myFind(cid,vid){
  const c=(db.contracts||[]).find(function(x){return x.id===cid;});
  return {c:c,v:c&&contractVisits(c).find(function(x){return x.id===vid;})};
}
function fieldRefreshBanner(){
  const el=document.getElementById('my-field-banner');if(!el||typeof fieldStatus!=='function')return;
  fieldStatus().then(function(s){el.textContent=fieldStatusText(s);el.style.color=s.online?'var(--text2)':'var(--danger)';});
}
function myVisitSheet(cid,vid){
  const f=_myFind(cid,vid);if(!f.v)return;
  if(!permOwnsVisit(f.v)){alert('هاي الزيارة مو مسندة إلك.');return;}
  ensureBundle('contracts').then(function(){openVisitSheet(cid,vid);});
}
function _myRefresh(){renderMyVisits(document.getElementById('main-content'),document.getElementById('topbar-actions'));}
function myVisitStart(cid,vid){
  const f=_myFind(cid,vid);if(!f.v)return;
  if(!permOwnsVisit(f.v)){alert('هاي الزيارة مو مسندة إلك.');return;}
  const r=visitStart(f.c,f.v);if(r&&r.ok===false){alert(r.error);return;}
  saveDB(db);_myRefresh();
}
function myVisitDone(cid,vid){
  const f=_myFind(cid,vid);if(!f.v)return;
  if(!permOwnsVisit(f.v)){alert('هاي الزيارة مو مسندة إلك.');return;}
  if(!confirm('تأكيد إنهاء الزيارة؟ بينعمل كرت عمل تلقائي.'))return;
  const r=visitComplete(f.c,f.v,{doneDate:localToday()});if(r&&r.ok===false){alert(r.error);return;}
  saveDB(db);_myRefresh();
}
function renderMyVisits(el,acts){
  if(acts)acts.innerHTML='';
  const d=myVisitsData();
  if(!d.linked){el.innerHTML='<div class="empty-state"><i class="ti ti-user-off"></i>حسابك غير مرتبط بفني. اطلب من المدير ربطه من إدارة المستخدمين.</div>';return;}
  const ST={scheduled:'مجدولة',inprogress:'جارية',postponed:'مؤجلة',done:'منتهية'};
  const row=function(it,act){const v=it.visit,c=it.contract;
    return '<tr><td>'+esc(fmtDate(it.date))+'</td><td><b>'+esc(c.number||'')+'</b></td><td>'+esc(it.area||'—')+'</td><td>'+esc(ST[v.status]||v.status)+'</td><td>'
     +'<button class="btn btn-sm" onclick="myVisitSheet(\''+c.id+'\',\''+v.id+'\')">ورقة'+((v.photos||[]).length?' 📷'+v.photos.length:'')+'</button> '
     +(act?(v.status!=='inprogress'?'<button class="btn btn-sm" onclick="myVisitStart(\''+c.id+'\',\''+v.id+'\')">ابدأ</button> ':'')+'<button class="btn btn-sm btn-primary" onclick="myVisitDone(\''+c.id+'\',\''+v.id+'\')">تم</button>':'')+'</td></tr>';};
  const sec=function(title,list,act,color){return '<div class="card" style="margin-bottom:14px"><div style="font-weight:700;margin-bottom:8px;color:'+color+'">'+title+' ('+list.length+')</div>'
    +(list.length?'<div style="overflow-x:auto"><table><thead><tr><th>التاريخ</th><th>العقد</th><th>المنطقة</th><th>الحالة</th><th></th></tr></thead><tbody>'+list.map(function(i){return row(i,act);}).join('')+'</tbody></table></div>':'<div style="color:var(--text2);font-size:12px">لا يوجد</div>')+'</div>';};
  el.innerHTML='<div id="my-field-banner" style="font-size:12px;margin-bottom:10px"></div>'+sec('اليوم / الجارية',d.board.today,true,'var(--accent)')+sec('متأخرة',d.board.overdue,true,'var(--danger)')+sec('هالأسبوع',d.board.week,true,'var(--text)')+sec('آخر المنتهية',d.done,false,'var(--text2)');
  fieldRefreshBanner();
}
