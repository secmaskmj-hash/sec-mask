/* ====================================================================
   pipeline.js — T39: خط عروض الأسعار (نسخ، صلاحية، سبب الرفض، نسبة التحويل).
   بيتحمّل قبل ops.js (bundle 'pipeline') وما بيعدّل منطق التحويل الحالي (doConvertQuote).
   حقول جديدة على العرض (كلها اختيارية، العروض القديمة بتضل شغّالة):
     version (رقم)، versions[] (لقطات النسخ السابقة)، validUntil، rejectReason، statusHistory[]
   ==================================================================== */
var QP_DEFAULT_VALID_DAYS=30;
function qpValidDays(){var d=db.settings&&+db.settings.quoteValidDays;return d>0?d:QP_DEFAULT_VALID_DAYS;}
function qpAddDays(iso,n){ // تاريخ محلي (مش UTC)
  var p=String(iso||'').split('-');if(p.length<3)return '';
  var d=new Date(+p[0],+p[1]-1,+p[2]+n);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function qpValidUntil(q){return q.validUntil||(q.date?qpAddDays(q.date,qpValidDays()):'');}
function qpIsExpired(q,today){
  today=today||localToday();var v=qpValidUntil(q);
  return q.status==='معلق'&&!!v&&today>v;
}
function qpExpiredBadge(q){return qpIsExpired(q)?' <span class="badge badge-red" style="font-size:10px">منتهي الصلاحية</span>':'';}
function qpContentSig(q){return JSON.stringify([q.items||[],+q.discount||0,q.currency||'USD']);}
/* بيتنادى من saveQuote: existing = السجل القديم (أو null)، entry = الجديد، reason = سبب الرفض (اختياري) */
function qpOnSave(existing,entry,extra){
  extra=extra||{};
  var today=localToday();
  entry.version=existing?(existing.version||1):1;
  entry.versions=existing&&Array.isArray(existing.versions)?existing.versions.slice():[];
  if(existing&&qpContentSig(existing)!==qpContentSig(entry)){
    entry.versions.push({v:existing.version||1,date:existing.versionDate||existing.date||today,totalValue:existing.totalValue,discount:existing.discount||0,currency:existing.currency||'USD',items:JSON.parse(JSON.stringify(existing.items||[]))});
    entry.version=(existing.version||1)+1;entry.versionDate=today;
  }
  if(extra.validUntil!==undefined)entry.validUntil=extra.validUntil||'';
  entry.statusHistory=existing&&Array.isArray(existing.statusHistory)?existing.statusHistory.slice():[];
  if(!existing||existing.status!==entry.status)entry.statusHistory.push({status:entry.status,date:today});
  if(entry.status==='مرفوض'){if(extra.rejectReason!==undefined)entry.rejectReason=extra.rejectReason;}
  else entry.rejectReason='';
  return entry;
}
function qpSetStatus(q,status,reason){
  var today=localToday();
  if(q.status===status&&!(status==='مرفوض'&&reason))return;
  q.statusHistory=Array.isArray(q.statusHistory)?q.statusHistory:[];
  if(q.status!==status)q.statusHistory.push({status:status,date:today});
  q.status=status;
  q.rejectReason=status==='مرفوض'?(reason||q.rejectReason||''):'';
}
/* إحصائيات الخط. القرارات = متفق + مرفوض + منتهي. نسبة التحويل = متفق / القرارات (العروض المعلّقة الحية ما بتدخل بالمقام). */
function qpStats(quotes,today){
  today=today||localToday();
  var s={total:quotes.length,accepted:0,rejected:0,pending:0,expired:0,valueAccepted:0,valueRejected:0,valuePending:0,valueExpired:0,reasons:{},avgDaysToDecision:0,avgVersionsAccepted:0};
  var days=[],vers=[];
  quotes.forEach(function(q){
    var v=+q.totalValue||0;
    if(q.status==='متفق'){s.accepted++;s.valueAccepted+=v;vers.push(q.version||1);
      var h=(q.statusHistory||[]).filter(function(x){return x.status==='متفق';})[0];
      if(h&&q.date){var d=Math.round((new Date(h.date)-new Date(q.date))/86400000);if(isFinite(d)&&d>=0)days.push(d);}
    }else if(q.status==='مرفوض'){s.rejected++;s.valueRejected+=v;var r=(q.rejectReason||'').trim()||'بدون سبب';s.reasons[r]=(s.reasons[r]||0)+1;}
    else if(qpIsExpired(q,today)){s.expired++;s.valueExpired+=v;}
    else{s.pending++;s.valuePending+=v;}
  });
  var dec=s.accepted+s.rejected+s.expired;
  s.decided=dec;s.conversionRate=dec?Math.round(s.accepted/dec*1000)/10:0;
  s.avgDaysToDecision=days.length?Math.round(days.reduce(function(a,b){return a+b;},0)/days.length*10)/10:0;
  s.avgVersionsAccepted=vers.length?Math.round(vers.reduce(function(a,b){return a+b;},0)/vers.length*10)/10:0;
  ['valueAccepted','valueRejected','valuePending','valueExpired'].forEach(function(k){s[k]=Math.round(s[k]*100)/100;});
  return s;
}
/* بوابة المرحلة: العرض المتفق عليه تحوّل لمشروع بنفس البنود */
function qpConversionCheck(q){
  var issues=[],r2=function(n){return Math.round(n*100)/100;};
  var eff=function(it){return quoteItemEffective(it);};
  var items=q.items||[];
  var mats=items.filter(function(i){return (i.kind||'مادة')==='مادة';}).map(eff);
  var labs=items.filter(function(i){return i.kind==='عمل';}).map(eff);
  var disc=+q.discount||0;
  var sale=q.convertedSaleId?(db.sales||[]).find(function(s){return s.id===q.convertedSaleId;}):null;
  var maint=q.convertedMaintenanceId?(db.maintenance||[]).find(function(m){return m.id===q.convertedMaintenanceId;}):null;
  if(mats.length){
    if(!sale)issues.push('فاتورة المبيعات مفقودة');
    else{
      var si=sale.items||[];
      if(si.length!==mats.length)issues.push('عدد بنود المواد مختلف');
      var qs=si.reduce(function(a,i){return a+(+i.qty||1);},0),qq=mats.reduce(function(a,e){return a+e.qty;},0);
      if(qs!==qq)issues.push('مجموع كميات المواد مختلف');
      var ps=si.reduce(function(a,i){return a+(+i.salePrice||0)*(+i.qty||1);},0),pq=mats.reduce(function(a,e){return a+e.price*e.qty;},0);
      if(Math.abs(ps-pq)>0.01)issues.push('قيمة المواد مختلفة');
      if(Math.abs((+sale.totalPrice||0)-r2(pq*(1-disc/100)))>0.01)issues.push('إجمالي فاتورة المبيعات بعد الحسم مختلف');
    }
  }
  if(labs.length){
    if(!maint)issues.push('فاتورة العمل مفقودة');
    else{
      var wi=maint.workItems||[];
      if(wi.length!==labs.length)issues.push('عدد بنود العمل مختلف');
      var pw=wi.reduce(function(a,i){return a+(+i.price||0)*(+i.qty||1);},0),pl=labs.reduce(function(a,e){return a+e.price*e.qty;},0);
      if(Math.abs(pw-pl)>0.01)issues.push('قيمة العمل مختلفة');
    }
  }
  var proj=q.projectName?(db.projects||[]).find(function(p){return p.name===q.projectName;}):null;
  if(!proj)issues.push('المشروع غير موجود');
  else{
    if(proj.quoteId!==q.id)issues.push('المشروع مش مربوط بالعرض');
    if(sale&&proj.saleId!==sale.id)issues.push('المشروع مش مربوط بفاتورة المبيعات');
    if(maint&&proj.maintId!==maint.id)issues.push('المشروع مش مربوط بفاتورة العمل');
  }
  return {ok:issues.length===0,issues:issues};
}
/* ===== واجهة ===== */
function qpModalFields(q){
  var vu=q?(q.validUntil||''):'';
  return '<div class="form-row cols-2"><div class="form-group"><label class="form-label">صالح حتى <span style="font-size:11px;color:var(--text2);font-weight:400">(فاضي = '+qpValidDays()+' يوم من تاريخ العرض)</span></label><input type="date" class="form-control" id="q-valid" value="'+esc(vu)+'"></div>'
   +'<div class="form-group"><label class="form-label">سبب الرفض <span style="font-size:11px;color:var(--text2);font-weight:400">(إذا الحالة مرفوض)</span></label><input class="form-control" id="q-reject" list="q-reject-list" value="'+esc(q&&q.rejectReason||'')+'"><datalist id="q-reject-list"><option value="السعر عالي"><option value="اختار منافس"><option value="تأجل المشروع"><option value="ما في ميزانية"><option value="انتهت الصلاحية"></datalist></div></div>'
   +(q&&q.version>1?'<div style="font-size:11px;color:var(--text2);margin-bottom:8px">نسخة رقم '+q.version+' — النسخ السابقة ('+(q.versions||[]).length+') محفوظة بتاريخ العرض.</div>':'');
}
function qpReadFields(){
  var v=document.getElementById('q-valid'),r=document.getElementById('q-reject');
  return {validUntil:v?v.value:undefined,rejectReason:r?r.value.trim():undefined};
}
function qpStripHtml(quotes){
  var s=qpStats(quotes);
  var top=Object.keys(s.reasons).sort(function(a,b){return s.reasons[b]-s.reasons[a];}).slice(0,3).map(function(k){return esc(k)+' ('+s.reasons[k]+')';}).join('، ')||'—';
  return '<div class="card" style="margin-bottom:16px"><div style="font-weight:700;font-size:14px;margin-bottom:10px">خط العروض</div>'
   +'<div class="grid-4"><div class="metric-card"><div class="metric-label">نسبة التحويل</div><div class="metric-value blue">'+s.conversionRate+'%</div><div style="font-size:10px;color:var(--text2)">'+s.accepted+' من '+s.decided+' قرار</div></div>'
   +'<div class="metric-card"><div class="metric-label">قيمة المعلّق الحي</div><div class="metric-value amber">'+fmt(s.valuePending)+'</div><div style="font-size:10px;color:var(--text2)">'+s.pending+' عرض</div></div>'
   +'<div class="metric-card"><div class="metric-label">منتهية الصلاحية</div><div class="metric-value '+(s.expired?'red':'green')+'">'+s.expired+'</div>'+(s.expired?'<button class="btn btn-sm" style="margin-top:4px" onclick="qpMarkExpired()">اعتبارها مرفوضة (انتهت الصلاحية)</button>':'')+'</div>'
   +'<div class="metric-card"><div class="metric-label">متوسط أيام القرار</div><div class="metric-value">'+s.avgDaysToDecision+'</div><div style="font-size:10px;color:var(--text2)">نسخ/عرض مقبول: '+s.avgVersionsAccepted+'</div></div></div>'
   +'<div style="font-size:12px;color:var(--text2);margin-top:8px">أكثر أسباب الرفض: '+top+'</div></div>';
}
function qpMarkExpired(){
  var list=(db.quotes||[]).filter(function(q){return qpIsExpired(q);});
  if(!list.length)return;
  if(!confirm('اعتبار '+list.length+' عرض منتهي الصلاحية كـ "مرفوض" بسبب "انتهت الصلاحية"؟'))return;
  list.forEach(function(q){qpSetStatus(q,'مرفوض','انتهت الصلاحية');});
  saveDB(db);rerenderPage('quotes');
}
