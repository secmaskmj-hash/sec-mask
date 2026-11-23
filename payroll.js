/* ====================================================================
   payroll.js — المرحلة 5 / T40: حضور وإنتاجية الفنيين وكشف الراتب الشهري
   بيتحمّل مع صفحة "العمال والرواتب" (bundle: people → payroll).

   القواعد (كلها بالسنت = أعداد صحيحة، فما في فروقات كسور):
   • الحضور: حاضر (1) · نصف يوم (0.5) · غائب (0) · إجازة (مدفوعة، ما بتنخصم). سجل واحد لكل عامل بكل يوم.
   • الإنتاجية للشهر: زيارات منجزة (بتاريخ الإنجاز) + ساعاتها = مجموع ساعات هالزيارات + أيام الورش من بطاقات العمل.
   • كشف الراتب = الراتب الأساسي − خصم الغياب + أجور الأعمال والزيارات + المكافآت − السلف
       خصم الغياب = الراتب ÷ أيام الدوام × (غائب + ½ نصف يوم)، وبس إذا في حضور مسجّل بهالشهر.
       الأجور = سطور أجور العامل ببطاقات العمل بتاريخ الشهر (زيارات الصيانة بتولّد بطاقة بأجر الفني).
   • مدفوع فعلياً = دفعات/مكافآت مسدّدة (غير السلف) بالشهر؛ المتبقي = الصافي − المدفوع.
   ==================================================================== */

const ATT_STATUSES=[
  {id:'present',label:'حاضر',short:'ح',w:1,cls:'att-p'},
  {id:'half',label:'نصف يوم',short:'½',w:0.5,cls:'att-h'},
  {id:'absent',label:'غائب',short:'غ',w:0,cls:'att-a'},
  {id:'leave',label:'إجازة',short:'إ',w:0,cls:'att-l'}
];
const ATT_CYCLE=['','present','half','absent','leave'];
function attInfo(id){return ATT_STATUSES.find(function(s){return s.id===id;})||null;}
function attList(){db.attendance=Array.isArray(db.attendance)?db.attendance:[];return db.attendance;}
function attFind(wid,date){return attList().find(function(a){return a.workerId===wid&&a.date===date;})||null;}
function attNext(status){return ATT_CYCLE[(ATT_CYCLE.indexOf(status||'')+1)%ATT_CYCLE.length];}
// تسجيل/تعديل/مسح (status فاضي = مسح). بترجّع الحالة الجديدة أو null لو مدخل غلط.
function attSet(wid,date,status){
  if(!wid||!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return null;
  if(status&&!attInfo(status))return null;
  const cur=attFind(wid,date);
  if(!status){if(cur)db.attendance=attList().filter(function(a){return a!==cur;});return '';}
  if(cur)cur.status=status;else attList().push({id:uid(),workerId:wid,date:date,status:status});
  return status;
}
function payMonthBounds(ym){const p=String(ym||'').split('-');return periodMonthBounds(+p[0],(+p[1]||1)-1);}
function payMonthLabel(ym){const p=String(ym||'').split('-');return periodMonthLabel(+p[0],(+p[1]||1)-1);}
function payWorkDays(){const v=+(db.settings&&db.settings.payrollWorkDays);return v>0?v:26;}
function payCents(x){return Math.round(round2(+x||0)*100);}
function payC(c){return finValUSD(c/100,'salary');}

/* ---------- الحضور ---------- */
function attMonth(wid,ym){
  const b=payMonthBounds(ym),r={present:0,half:0,absent:0,leave:0,recorded:0,worked:0,absentEq:0};
  attList().forEach(function(a){
    if(a.workerId!==wid||!periodInRange(a.date,b.from,b.to))return;
    if(r[a.status]===undefined)return;
    r[a.status]++;r.recorded++;
  });
  r.worked=r.present+0.5*r.half;
  r.absentEq=r.absent+0.5*r.half;
  return r;
}

/* ---------- الإنتاجية ---------- */
function payVisitsDone(wid,ym){
  const b=payMonthBounds(ym),out=[];
  (db.contracts||[]).forEach(function(c){contractVisits(c).forEach(function(v){
    if(v.status==='done'&&v.performedBy===wid&&periodInRange(v.doneDate||visitDate(v),b.from,b.to))out.push({c:c,v:v});
  });});
  return out;
}
function techProductivity(wid,ym,todayIso){
  const b=payMonthBounds(ym),t=todayIso||localToday();
  const done=payVisitsDone(wid,ym);
  const hoursC=done.reduce(function(s,x){return s+payCents(+x.v.hours||0);},0);
  let open=0,missed=0;
  (db.contracts||[]).forEach(function(c){contractVisits(c).forEach(function(v){
    if(v.performedBy!==wid||v.status==='done'||v.status==='cancelled')return;
    if(!periodInRange(visitDate(v),b.from,b.to))return;
    open++;if(visitEffectiveStatus(v,t)==='missed')missed++;
  });});
  const onTime=done.filter(function(x){return (x.v.doneDate||'')<=visitDate(x.v);}).length;
  let cardDays=0;
  (db.maintenance||[]).forEach(function(m){(m.workers||[]).forEach(function(mw){
    if(mw.workerId!==wid||mw.wageOnly)return;
    if(periodInRange(mw.date||m.startDate,b.from,b.to))cardDays+=(+mw.days||1);
  });});
  const att=attMonth(wid,ym);
  return {workerId:wid,ym:ym,visitsDone:done.length,hoursC:hoursC,hours:hoursC/100,
    hoursPerVisit:done.length?Math.round(hoursC/done.length)/100:null,
    open:open,missed:missed,onTimePct:done.length?Math.round(onTime/done.length*100):null,
    cardDays:cardDays,att:att,
    visitsPerDay:att.worked>0?Math.round(done.length/att.worked*100)/100:null};
}

/* ---------- كشف الراتب ---------- */
function workerSalaryC(w){
  const sal=+(w&&w.monthlySalary)||0;
  return sal>0?payCents(toUSD(sal,w.salaryCurrency==='SYP'?'SYP':'USD')):0;
}
function payrollStatement(wid,ym){
  const w=(db.workers||[]).find(function(x){return x.id===wid;})||{id:wid};
  const b=payMonthBounds(ym),att=attMonth(wid,ym);
  const base=workerSalaryC(w);
  const deduct=(base>0&&att.recorded>0)?Math.min(base,Math.round(base*att.absentEq/payWorkDays())):0;
  let wages=0,wagesPaid=0,wageLines=0;
  (db.maintenance||[]).forEach(function(m){(m.workers||[]).forEach(function(mw){
    if(mw.workerId!==wid||!periodInRange(mw.date||m.startDate,b.from,b.to))return;
    const c=payCents(toUSDHist(+mw.wage||0,mw.currency||m.workersCurrency||m.currency,m));
    wages+=c;wageLines++;if(mw.paid)wagesPaid+=c;
  });});
  let bonuses=0,advances=0,paidOut=0;
  (db.workerPayments||[]).forEach(function(p){
    if(p.workerId!==wid)return;
    const c=payCents(toUSDHist(+p.amount||0,p.currency,p));
    if(p.isBonus&&periodInRange(p.date,b.from,b.to))bonuses+=c;
    if(!p.isBonus&&p.type==='advance'&&periodInRange(p.date,b.from,b.to))advances+=c;
    if(p.type!=='advance'&&p.paid&&periodInRange(p.paidDate||p.date,b.from,b.to))paidOut+=c;
  });
  const net=base-deduct+wages+bonuses-advances;
  return {workerId:wid,ym:ym,name:w.name||'',base:base,absenceDeduction:-deduct,wages:wages,wageLines:wageLines,wagesPaid:wagesPaid,
    bonuses:bonuses,advances:-advances,net:net,paidOut:paidOut,remaining:net-paidOut,att:att,
    credit:payCents(typeof getWorkerCreditUSD==='function'?getWorkerCreditUSD(wid):0)};
}
function payrollTotals(ym){
  const rows=(db.workers||[]).map(function(w){return payrollStatement(w.id,ym);});
  const sum=function(k){return rows.reduce(function(s,r){return s+r[k];},0);};
  return {rows:rows,base:sum('base'),absenceDeduction:sum('absenceDeduction'),wages:sum('wages'),bonuses:sum('bonuses'),advances:sum('advances'),net:sum('net'),paidOut:sum('paidOut'),remaining:sum('remaining')};
}

/* ====================== الواجهة ====================== */
function payYM(){
  const r=periodResolve('payroll',{mode:'month'});
  if(r.fullMonth)return r.monthKey;
  return (r.from||localToday()).slice(0,7);
}
function payRerender(){if(typeof renderWorkers==='function')renderWorkers(document.getElementById('main-content'),document.getElementById('topbar-actions'));}
function attDaysOf(ym){
  const b=payMonthBounds(ym),out=[];
  for(let d=b.from;d<=b.to;d=periodAddDays(d,1))out.push(d);
  return out;
}
function attWeekday(iso){return periodParse(iso).getDay();} // 5 = الجمعة
function attGridHTML(ym){
  const days=attDaysOf(ym),workers=db.workers||[];
  if(!workers.length)return '<div class="empty-state"><p>ما في عمال بعد — أضفهم من إدارة القوائم.</p></div>';
  const wd=['أحد','اثن','ثلا','أرب','خمي','جمع','سبت'];
  const head=days.map(function(d){const g=attWeekday(d);return '<th class="att-day'+(g===5?' att-fri':'')+'" title="تسجيل الكل حاضر ليوم '+d+'" onclick="attDayAll(\''+d+'\')"><div>'+(+d.slice(8))+'</div><div class="att-wd">'+wd[g]+'</div></th>';}).join('');
  const rows=workers.map(function(w){
    const m=attMonth(w.id,ym);
    const cells=days.map(function(d){
      const a=attFind(w.id,d),s=a?attInfo(a.status):null,g=attWeekday(d);
      return '<td class="att-cell'+(g===5?' att-fri':'')+'"><button type="button" class="att-btn '+(s?s.cls:'')+'" title="'+(s?s.label:'غير مسجّل')+'" onclick="attClick(\''+w.id+'\',\''+d+'\')">'+(s?s.short:'·')+'</button></td>';
    }).join('');
    return '<tr><td class="att-name">'+esc(w.name)+'</td>'+cells+'<td class="att-sum"><b>'+m.worked+'</b> <span style="font-size:10px;color:var(--text2)">يوم</span></td></tr>';
  }).join('');
  const legend=ATT_STATUSES.map(function(s){return '<span class="att-legend"><span class="att-btn '+s.cls+'" style="cursor:default">'+s.short+'</span> '+s.label+'</span>';}).join('');
  return '<div class="att-scroll"><table class="att-table"><thead><tr><th class="att-name">العامل</th>'+head+'<th class="att-sum">أيام الحضور</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--text2);margin-top:8px">'+legend+'<span>اضغط الخانة لتبديل الحالة · اضغط رقم اليوم لتسجيل الكل حاضر</span></div>';
}
function attClick(wid,date){
  const cur=attFind(wid,date);
  attSet(wid,date,attNext(cur?cur.status:''));
  saveDB(db);payRefreshCards();
}
function attDayAll(date){
  let n=0;
  (db.workers||[]).forEach(function(w){if(!attFind(w.id,date)){attSet(w.id,date,'present');n++;}});
  if(n){saveDB(db);payRefreshCards();}
}
function productivityHTML(ym){
  const workers=db.workers||[];
  if(!workers.length)return '';
  const rows=workers.map(function(w){return techProductivity(w.id,ym);});
  const T={visits:0,hoursC:0,open:0,missed:0,cardDays:0,worked:0};
  const trs=rows.map(function(r,i){
    T.visits+=r.visitsDone;T.hoursC+=r.hoursC;T.open+=r.open;T.missed+=r.missed;T.cardDays+=r.cardDays;T.worked+=r.att.worked;
    return '<tr><td style="font-weight:700">'+esc(workers[i].name)+'</td><td style="text-align:center">'+r.att.worked+'</td><td style="text-align:center">'+r.visitsDone+'</td>'+
      '<td style="text-align:center;font-weight:700">'+r.hours+'</td><td style="text-align:center">'+(r.hoursPerVisit===null?'—':r.hoursPerVisit)+'</td>'+
      '<td style="text-align:center">'+(r.onTimePct===null?'—':r.onTimePct+'%')+'</td><td style="text-align:center;color:'+(r.missed?'var(--danger)':'inherit')+'">'+r.missed+'</td>'+
      '<td style="text-align:center">'+r.cardDays+'</td><td style="text-align:center">'+(r.visitsPerDay===null?'—':r.visitsPerDay)+'</td></tr>';
  }).join('');
  return '<div style="overflow-x:auto"><table class="wallet-st"><thead><tr><th>العامل</th><th>أيام حضور</th><th>زيارات منجزة</th><th>ساعات الزيارات</th><th>ساعة/زيارة</th><th>بالموعد</th><th>متأخرة</th><th>أيام ورش</th><th>زيارة/يوم حضور</th></tr></thead><tbody>'+trs+
    '</tbody><tfoot><tr class="summary-row"><td>المجموع</td><td style="text-align:center">'+T.worked+'</td><td style="text-align:center">'+T.visits+'</td><td style="text-align:center">'+(T.hoursC/100)+'</td><td></td><td></td><td style="text-align:center">'+T.missed+'</td><td style="text-align:center">'+T.cardDays+'</td><td></td></tr></tfoot></table></div>'+
    '<div style="font-size:11px;color:var(--text2);margin-top:6px">الساعات = مجموع ساعات زيارات الفني المنجزة بالشهر (بتنكتب بورقة الزيارة، أو بتتقدّر من «بدء» لـ«إنجاز» لو بنفس اليوم).</div>';
}
function payrollHTML(ym){
  if(!canViewWorkerSalaries())return '<div class="empty-state"><i class="ti ti-lock"></i><p>ما عندك صلاحية رؤية الرواتب.</p></div>';
  const T=payrollTotals(ym);
  if(!T.rows.length)return '';
  const trs=T.rows.map(function(r){
    const w=(db.workers||[]).find(function(x){return x.id===r.workerId;})||{};
    return '<tr><td style="font-weight:700">'+esc(r.name)+'</td>'+
      '<td style="white-space:nowrap"><input type="number" min="0" step="0.01" class="form-control" style="width:96px;display:inline-block;padding:4px 6px" id="ps-'+r.workerId+'" value="'+esc(+w.monthlySalary||'')+'" placeholder="0" onchange="paySetSalary(\''+r.workerId+'\')"> '+
      '<select class="form-control" style="width:62px;display:inline-block;padding:4px 2px" id="psc-'+r.workerId+'" onchange="paySetSalary(\''+r.workerId+'\')"><option value="USD"'+(w.salaryCurrency!=='SYP'?' selected':'')+'>$</option><option value="SYP"'+(w.salaryCurrency==='SYP'?' selected':'')+'>ل.س</option></select></td>'+
      '<td style="color:var(--danger)">'+(r.absenceDeduction?payC(r.absenceDeduction):'—')+'</td><td>'+payC(r.wages)+'</td><td>'+(r.bonuses?payC(r.bonuses):'—')+'</td><td style="color:var(--danger)">'+(r.advances?payC(r.advances):'—')+'</td>'+
      '<td style="font-weight:800;color:var(--accent)">'+payC(r.net)+'</td><td>'+payC(r.paidOut)+'</td><td style="font-weight:700;color:'+(r.remaining>0?'var(--salary)':'var(--text2)')+'">'+payC(r.remaining)+'</td>'+
      '<td><button class="btn btn-sm" onclick="payOpenStatement(\''+r.workerId+'\',\''+ym+'\')"><i class="ti ti-file-invoice"></i> كشف</button></td></tr>';
  }).join('');
  return '<div style="overflow-x:auto"><table class="wallet-st"><thead><tr><th>العامل</th><th>الراتب الشهري</th><th>خصم الغياب</th><th>أجور الأعمال والزيارات</th><th>مكافآت</th><th>سلف</th><th>الصافي</th><th>مدفوع</th><th>المتبقي</th><th></th></tr></thead><tbody>'+trs+
    '</tbody><tfoot><tr class="summary-row"><td>المجموع</td><td>'+payC(T.base)+'</td><td>'+payC(T.absenceDeduction)+'</td><td>'+payC(T.wages)+'</td><td>'+payC(T.bonuses)+'</td><td>'+payC(T.advances)+'</td><td>'+payC(T.net)+'</td><td>'+payC(T.paidOut)+'</td><td>'+payC(T.remaining)+'</td><td></td></tr></tfoot></table></div>'+
    '<div style="font-size:11px;color:var(--text2);margin-top:6px">أيام الدوام الشهرية لخصم الغياب: '+payWorkDays()+' (بتتغيّر من الإعدادات: payrollWorkDays). الراتب بالليرة بيتحوّل بسعر الصرف الحالي، والأجور بسعر كل بطاقة عمل.</div>';
}
function renderPayrollTab(){
  const ym=payYM(),r=periodResolve('payroll',{mode:'month'});
  return '<div class="card" style="margin-bottom:16px">'+periodBarHTML('payroll',payRerender,{mode:'month'})+
      (r.fullMonth?'':'<div style="font-size:11.5px;color:var(--warning);margin-top:8px">الحضور والرواتب شهرية — معروض شهر '+esc(payMonthLabel(ym))+'. اختر «الشهر السابق/التالي» للتنقل.</div>')+'</div>'+
    '<div class="card" style="margin-bottom:16px"><div class="section-title">الحضور — '+esc(payMonthLabel(ym))+'</div><div id="att-card">'+attGridHTML(ym)+'</div></div>'+
    '<div class="card" style="margin-bottom:16px"><div class="section-title">إنتاجية الفنيين — '+esc(payMonthLabel(ym))+'</div><div id="prod-card">'+productivityHTML(ym)+'</div></div>'+
    '<div class="card"><div class="section-title">كشف الرواتب الشهري — '+esc(payMonthLabel(ym))+'</div><div id="pay-card">'+payrollHTML(ym)+'</div></div>';
}
// تحديث الجداول بدون ما نرجّع تمرير الصفحة/الشبكة لأولها
function payRefreshCards(){
  const ym=payYM(),set=function(id,html){const el=document.getElementById(id);if(el)el.innerHTML=html;};
  set('prod-card',productivityHTML(ym));set('pay-card',payrollHTML(ym));
  const g=document.querySelector('#att-card .att-scroll'),sl=g?g.scrollLeft:0;
  set('att-card',attGridHTML(ym));
  const g2=document.querySelector('#att-card .att-scroll');if(g2)g2.scrollLeft=sl;
}
function paySetSalary(wid){
  if(!requirePerm('salary'))return;
  const w=(db.workers||[]).find(function(x){return x.id===wid;});if(!w)return;
  const v=document.getElementById('ps-'+wid),c=document.getElementById('psc-'+wid);
  w.monthlySalary=Math.max(0,round2(+(v&&v.value)||0));
  w.salaryCurrency=(c&&c.value==='SYP')?'SYP':'USD';
  saveDB(db);payRefreshCards();
}
function payOpenStatement(wid,ym){
  if(!canViewWorkerSalaries())return;
  const s=payrollStatement(wid,ym),a=s.att;
  const row=function(label,c,cls){return '<tr class="'+(cls||'')+'"><td>'+label+'</td><td style="text-align:left;font-weight:'+(cls?800:600)+'">'+payC(c)+'</td></tr>';};
  window._payStmt={wid:wid,ym:ym};
  showModal('<div class="modal-title">كشف راتب — '+esc(s.name)+' · '+esc(payMonthLabel(ym))+'</div>'+
    '<table class="wallet-st" style="margin-bottom:10px"><tbody>'+row('الراتب الأساسي',s.base)+
    row('خصم الغياب <span style="font-size:11px;color:var(--text2)">(غائب '+a.absent+' · نصف يوم '+a.half+')</span>',s.absenceDeduction)+
    row('أجور الأعمال والزيارات <span style="font-size:11px;color:var(--text2)">('+s.wageLines+' سطر)</span>',s.wages)+
    row('مكافآت',s.bonuses)+row('سلف الشهر',s.advances)+row('الصافي المستحق',s.net,'summary-row')+
    row('مدفوع فعلياً بالشهر',s.paidOut)+row('المتبقي',s.remaining,'summary-row')+'</tbody></table>'+
    '<div style="font-size:11.5px;color:var(--text2)">حضور: '+a.present+' يوم كامل + '+a.half+' نصف + '+a.leave+' إجازة.'+(s.credit>0?' · رصيد سلفة غير مستهلك: '+payC(s.credit):'')+'</div>'+
    '<div class="modal-actions"><button class="btn" onclick="closeModal()">إغلاق</button><button class="btn btn-primary" onclick="payPrintStatement()"><i class="ti ti-printer"></i> طباعة / PDF</button></div>');
}
function payrollStatementHTML(s){
  const co=db.company||{};
  const row=function(label,c,b){return '<tr><td'+(b?' style="font-weight:800"':'')+'>'+label+'</td><td style="text-align:right;'+(b?'font-weight:800':'')+'">'+payC(c)+'</td></tr>';};
  return '<div class="print-doc"><div class="print-header">'+getCompanyHeader()+
    '<div style="text-align:left;flex-shrink:0"><div class="print-doc-type">كشف راتب شهري</div><div class="print-doc-meta"><b>الشهر:</b> '+esc(payMonthLabel(s.ym))+'<br><b>العامل:</b> '+esc(s.name)+'</div></div></div>'+
    '<table class="print-table" style="width:100%"><thead><tr><th>البند</th><th style="width:140px;text-align:right">المبلغ ($)</th></tr></thead><tbody>'+
    row('الراتب الأساسي',s.base)+row('خصم الغياب (غائب '+s.att.absent+' · نصف يوم '+s.att.half+')',s.absenceDeduction)+row('أجور الأعمال والزيارات',s.wages)+row('مكافآت',s.bonuses)+row('سلف الشهر',s.advances)+
    row('الصافي المستحق',s.net,true)+row('مدفوع فعلياً بالشهر',s.paidOut)+row('المتبقي',s.remaining,true)+'</tbody></table>'+
    '<div class="print-sign-row"><div class="print-sign-box"><div style="height:40px"></div><div style="font-weight:700">توقيع العامل</div></div><div class="print-sign-box"><div style="height:40px"></div><div style="font-weight:700">'+esc(getCompanySignatory())+'</div></div></div>'+
    '<div class="print-footer">'+companyFooterPhonesHTML()+'<div>جميع الحقوق محفوظة © '+new Date().getFullYear()+' '+esc(co.name||'Security Mask')+'</div></div></div>';
}
function payPrintStatement(){
  const st=window._payStmt;if(!st)return;
  const s=payrollStatement(st.wid,st.ym);
  setPrintFile('payroll',s.name,st.ym);
  closeModal();
  showPrintDoc(payrollStatementHTML(s)+PRINT_ACTIONS_BAR_LANG);
}
