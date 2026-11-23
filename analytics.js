/* ====================================================================
   analytics.js — T41: تحليلات الربحية (عميل / مشروع / فني / قسم)، أعمار الديون، والتدفق النقدي المتوقع.
   المبدأ: كل الأرقام بتنبني من "حقائق" لكل فاتورة/عمل (بالدولار وبالسنتات الصحيحة) بنفس دوال الحساب الموجودة
   (saleReferralCommissionFull, getMaintenanceWages…) — وأي تقسيم (على أقسام أو فنيين) بيتوزّع بطريقة أكبر باقي
   فمجموع كل بُعد = مجموع السجلات بالضبط (بوابة المرحلة 4: إجماليات التحليل = إجماليات السجلات).
   الربحية هون "كاملة" (قيمة الفاتورة كلها مش المحقّق بس)؛ والمحصّل والمتبقي معروضين جنبها.
   ==================================================================== */
function anC(x){return Math.round((+x||0)*100);}
function anIn(date,from,to){if(!from&&!to)return true;if(!date)return false;return (!from||date>=from)&&(!to||date<=to);}
function anAlloc(total,weights){ // سنتات صحيحة، مجموع الناتج = total بالضبط
  var w=weights.map(function(x){return Math.max(0,x);});
  if(!w.some(function(x){return x>0;}))w=weights.map(function(){return 1;});
  return _deptAllocate(total,w);
}
function anDays(a,b){ // b - a بالأيام، بدون تأثير المنطقة الزمنية
  var pa=String(a).split('-'),pb=String(b).split('-');
  return Math.round((Date.UTC(+pb[0],+pb[1]-1,+pb[2])-Date.UTC(+pa[0],+pa[1]-1,+pa[2]))/86400000);
}
function anClientOf(r){
  if(r.clientId){return {key:'c:'+r.clientId,name:getClientName(r.clientId)};}
  var n=(r.clientNameFree||'').trim();return n?{key:'n:'+n,name:n}:{key:'-',name:'بدون عميل'};
}
function anProjOf(r){var p=(r.projectName||'').trim();return p?{key:'p:'+p,name:p}:{key:'-',name:'بدون مشروع'};}

/* الحقائق: مصفوفة موحّدة (مبيعات + أعمال) — كل المبالغ سنتات بالدولار */
function anFacts(opts){
  opts=opts||{};var out=[];
  (db.sales||[]).forEach(function(s){
    if(!anIn(s.date,opts.from,opts.to))return;
    var cur=s.currency||'SYP',u=function(v){return anC(toUSDHist(v,cur,s));};
    var rev=u(+s.totalPrice||0),cost=u(+s.totalCost||0),com=u(saleReferralCommissionFull(s));
    var bd=saleSectionBreakdown(s),ks=bd.activeKeys.length?bd.activeKeys:['unclassified'];
    var wn=ks.map(function(k){return anC(bd.sections[k].net);}),wc=ks.map(function(k){return anC(bd.sections[k].cost);});
    var dr=anAlloc(rev,wn),dc=anAlloc(cost,wc.some(function(x){return x>0;})?wc:wn),dm=anAlloc(com,wn);
    var depts={};ks.forEach(function(k,i){depts[k]={rev:dr[i],cost:dc[i],com:dm[i]};});
    out.push({kind:'sale',id:s.id,date:s.date||'',client:anClientOf(s),project:anProjOf(s),rev:rev,cost:cost,com:com,
      collected:u(+s.paidAmount||0),remaining:u(saleRemaining(s)),depts:depts,techs:[{key:'sale',name:'مبيعات (بدون فني)',rev:rev,cost:cost,com:com}]});
  });
  (db.maintenance||[]).forEach(function(m){
    var d=m.startDate||m.date||m.endDate||'';
    if(!anIn(d,opts.from,opts.to))return;
    var cur=m.currency||'SYP',u=function(v){return anC(toUSDHist(v,cur,m));};
    var rev=u(getMaintenanceIncome(m)),exp=u(getMaintenanceExpenses(m)),com=u(maintReferralCommissionFull(m));
    var ws=(m.workers||[]).map(function(w){return {key:w.workerId?'w:'+w.workerId:'n:'+(w.workerName||'؟'),name:w.workerId?getWorkerName(w.workerId):(w.workerName||'؟'),
      wage:anC(toUSDHist(+w.wage||0,w.currency||m.workersCurrency||cur,m))};});
    var wages=ws.reduce(function(a,w){return a+w.wage;},0),cost=wages+exp;
    var wi=(m.workItems||[]).filter(function(i){return i;});
    var ks=[],wt=[];
    wi.forEach(function(it){var k=itemDept({type:it.type||''}),i=ks.indexOf(k);var v=anC((+it.price||0)*(+it.qty||1));if(i<0){ks.push(k);wt.push(v);}else wt[i]+=v;});
    if(!ks.length){ks=['unclassified'];wt=[1];}
    var dr=anAlloc(rev,wt),dc=anAlloc(cost,wt),dm=anAlloc(com,wt),depts={};
    ks.forEach(function(k,i){depts[k]={rev:dr[i],cost:dc[i],com:dm[i]};});
    var techs;
    if(ws.length){
      var wts=ws.map(function(w){return w.wage;});
      var tr=anAlloc(rev,wts),te=anAlloc(exp,wts),tm=anAlloc(com,wts);
      techs=ws.map(function(w,i){return {key:w.key,name:w.name,rev:tr[i],cost:w.wage+te[i],com:tm[i]};});
    }else techs=[{key:'-',name:'بدون فني',rev:rev,cost:cost,com:com}];
    out.push({kind:'maint',id:m.id,date:d,client:anClientOf(m),project:anProjOf(m),rev:rev,cost:cost,com:com,
      collected:u(+m.paidAmount||0),remaining:u(maintRemaining(m)),depts:depts,techs:techs});
  });
  return out;
}
function anAgg(rows){
  var t={count:0,rev:0,cost:0,com:0,collected:0,remaining:0};
  rows.forEach(function(r){t.count+=r.count;t.rev+=r.rev;t.cost+=r.cost;t.com+=r.com;t.collected+=r.collected;t.remaining+=r.remaining;});
  return t;
}
function anFin(o){ // سنتات → دولارات + ربح وهامش
  var profit=o.rev-o.cost-o.com;
  return {key:o.key,name:o.name,count:o.count,revenue:o.rev/100,cost:o.cost/100,commission:o.com/100,profit:profit/100,
    margin:o.rev>0?Math.round(profit/o.rev*1000)/10:0,collected:o.collected/100,remaining:o.remaining/100};
}
/* dim: client | project | tech | dept */
function anProfitBy(dim,opts){
  var facts=anFacts(opts),map={},order=[];
  function add(key,name,f,rev,cost,com,share){
    if(!map[key]){map[key]={key:key,name:name,count:0,rev:0,cost:0,com:0,collected:0,remaining:0};order.push(key);}
    var a=map[key];a.count++;a.rev+=rev;a.cost+=cost;a.com+=com;
    a.collected+=share(f.collected);a.remaining+=share(f.remaining);
  }
  facts.forEach(function(f){
    if(dim==='client')add(f.client.key,f.client.name,f,f.rev,f.cost,f.com,function(x){return x;});
    else if(dim==='project')add(f.project.key,f.project.name,f,f.rev,f.cost,f.com,function(x){return x;});
    else if(dim==='dept'){
      var ks=Object.keys(f.depts),tot=ks.reduce(function(a,k){return a+f.depts[k].rev;},0);
      var cs=anAlloc(f.collected,ks.map(function(k){return f.depts[k].rev;})),rs=anAlloc(f.remaining,ks.map(function(k){return f.depts[k].rev;}));
      ks.forEach(function(k,i){add('d:'+k,DEPT_LABELS[k]||k,f,f.depts[k].rev,f.depts[k].cost,f.depts[k].com,function(x){return x===f.collected?cs[i]:rs[i];});});
    }else{
      var cs2=anAlloc(f.collected,f.techs.map(function(t){return t.rev;})),rs2=anAlloc(f.remaining,f.techs.map(function(t){return t.rev;}));
      f.techs.forEach(function(t,i){add(t.key,t.name,f,t.rev,t.cost,t.com,function(x){return x===f.collected?cs2[i]:rs2[i];});});
    }
  });
  var rows=order.map(function(k){return map[k];});
  var total=anAgg(rows);total.count=facts.length;
  return {rows:rows.map(anFin).sort(function(a,b){return b.profit-a.profit;}),total:anFin(Object.assign({key:'*',name:'الإجمالي'},total))};
}
/* إجماليات السجلات مباشرة من الحقائق (مرجع البوابة) */
function anRecordTotals(opts){
  var f=anFacts(opts),t={count:f.length,rev:0,cost:0,com:0,collected:0,remaining:0};
  f.forEach(function(r){t.rev+=r.rev;t.cost+=r.cost;t.com+=r.com;t.collected+=r.collected;t.remaining+=r.remaining;});
  return anFin(Object.assign({key:'*',name:'الإجمالي'},t));
}
/* مقارنة مع دوال الحساب القديمة بدون توزيع (فرق التقريب ≤ سنت لكل سجل) */
function anLegacyTotals(opts){
  opts=opts||{};var rev=0,profit=0,n=0;
  (db.sales||[]).forEach(function(s){if(!anIn(s.date,opts.from,opts.to))return;n++;rev+=toUSDHist(+s.totalPrice||0,s.currency||'SYP',s);profit+=toUSDHist(saleFullProfit(s),s.currency||'SYP',s);});
  (db.maintenance||[]).forEach(function(m){if(!anIn(m.startDate||m.date||m.endDate||'',opts.from,opts.to))return;n++;rev+=toUSDHist(getMaintenanceIncome(m),m.currency||'SYP',m);profit+=toUSDHist(getMaintenanceProfit(m),m.currency||'SYP',m);});
  return {count:n,revenue:rev,profit:profit};
}
/* بوابة المرحلة: كل الأبعاد بتطلع نفس الإجماليات ونفس إجماليات السجلات */
function anCheck(opts){
  var ref=anRecordTotals(opts),leg=anLegacyTotals(opts),issues=[];
  ['client','project','tech','dept'].forEach(function(d){
    var t=anProfitBy(d,opts).total;
    ['revenue','cost','commission','profit','collected','remaining'].forEach(function(k){
      if(Math.abs(t[k]-ref[k])>0.0001)issues.push(d+':'+k);
    });
  });
  var tol=0.01*Math.max(1,ref.count)+0.0001;
  if(Math.abs(ref.revenue-leg.revenue)>tol)issues.push('legacy:revenue');
  if(Math.abs(ref.profit-leg.profit)>tol)issues.push('legacy:profit');
  return {ok:issues.length===0,issues:issues,ref:ref,legacy:leg};
}

/* ---------- أعمار الديون ---------- */
var AN_BUCKETS=[['current','غير مستحق بعد'],['d30','1–30 يوم'],['d60','31–60 يوم'],['d90','61–90 يوم'],['d90p','أكثر من 90 يوم']];
function anBucket(age){return age<=0?'current':age<=30?'d30':age<=60?'d60':age<=90?'d90':'d90p';}
function anTermsDays(){var d=db.settings&&+db.settings.paymentTermsDays;return d>=0&&db.settings&&db.settings.paymentTermsDays!==undefined&&db.settings.paymentTermsDays!==''?d:30;}
/* كل المبالغ المستحقة لنا: فواتير مبيعات + أعمال + دفعات عقود. تاريخ الاستحقاق: تاريخ الفاتورة + مهلة السداد (30 افتراضياً) أو dueDate للعقد */
function anReceivables(today){
  today=today||localToday();var out=[],terms=anTermsDays();
  (db.sales||[]).forEach(function(s){var r=anC(toUSDHist(saleRemaining(s),s.currency||'SYP',s));if(r>0&&s.date)out.push({kind:'sale',id:s.id,client:anClientOf(s),amt:r,due:qpAddDaysSafe(s.date,terms)});});
  (db.maintenance||[]).forEach(function(m){var r=anC(toUSDHist(maintRemaining(m),m.currency||'SYP',m)),d=m.endDate||m.startDate||m.date;if(r>0&&d)out.push({kind:'maint',id:m.id,client:anClientOf(m),amt:r,due:qpAddDaysSafe(d,terms)});});
  (db.contracts||[]).forEach(function(c){if(c.status==='cancelled')return;contractPayments(c).forEach(function(p){
    var rem=contractPaymentRemaining(p);if(rem<=0.004||!p.dueDate)return;
    out.push({kind:'contract',id:p.id,client:anClientOf(c),amt:anC(contractPaymentUSD(p,rem)),due:p.dueDate});});});
  out.forEach(function(x){x.age=anDays(x.due,today);});
  return out;
}
function qpAddDaysSafe(iso,n){
  var p=String(iso||'').split('-');if(p.length<3)return iso;
  var d=new Date(+p[0],+p[1]-1,+p[2]+n);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function anAging(today){
  var items=anReceivables(today),b={},byClient={};
  AN_BUCKETS.forEach(function(x){b[x[0]]=0;});
  items.forEach(function(it){
    var k=anBucket(it.age);b[k]+=it.amt;
    var c=byClient[it.client.key]=byClient[it.client.key]||{key:it.client.key,name:it.client.name,total:0,buckets:{}};
    AN_BUCKETS.forEach(function(x){c.buckets[x[0]]=c.buckets[x[0]]||0;});
    c.buckets[k]+=it.amt;c.total+=it.amt;
  });
  var total=items.reduce(function(a,x){return a+x.amt;},0);
  var fix=function(o){var r={};Object.keys(o).forEach(function(k){r[k]=o[k]/100;});return r;};
  return {buckets:fix(b),total:total/100,count:items.length,
    clients:Object.keys(byClient).map(function(k){var c=byClient[k];return {key:c.key,name:c.name,total:c.total/100,buckets:fix(c.buckets)};}).sort(function(a,b){return b.total-a.total;})};
}
/* ---------- التدفق النقدي المتوقع ---------- */
var AN_CF=[['overdue','متأخر (مستحق الآن)'],['w30','خلال 30 يوم'],['w60','31–60 يوم'],['w90','61–90 يوم'],['later','بعد 90 يوم']];
function anCashflow(today){
  today=today||localToday();var items=anReceivables(today),inflow={};
  AN_CF.forEach(function(x){inflow[x[0]]=0;});
  items.forEach(function(it){var a=-it.age;var k=a<0?'overdue':a<=30?'w30':a<=60?'w60':a<=90?'w90':'later';inflow[k]+=it.amt;});
  var supplier=(db.suppliers||[]).reduce(function(s,x){return s+getSupplierDebtUSD(x);},0);
  var wages=(db.workerPayments||[]).filter(function(p){return !p.paid&&!p.isBonus;}).reduce(function(s,p){return s+toUSD(+p.amount||0,p.currency||'SYP');},0)
    +(db.maintenance||[]).reduce(function(s,m){return s+(m.workers||[]).filter(function(w){return !w.paid;}).reduce(function(a,w){return a+toUSD(+w.wage||0,w.currency||m.workersCurrency||m.currency||'SYP');},0);},0);
  var totalIn=items.reduce(function(a,x){return a+x.amt;},0)/100,fix=function(o){var r={};Object.keys(o).forEach(function(k){r[k]=o[k]/100;});return r;};
  var out={supplierDebt:Math.round(supplier*100)/100,unpaidWages:Math.round(wages*100)/100};
  out.totalOut=Math.round((out.supplierDebt+out.unpaidWages)*100)/100;
  return {inflow:fix(inflow),totalIn:totalIn,outflow:out,net:Math.round((totalIn-out.totalOut)*100)/100};
}

/* ===================== واجهة ===================== */
function renderAnalytics(el,acts){
  if(!canViewFinance()){if(acts)acts.innerHTML='';el.innerHTML='<div class="empty-state"><i class="ti ti-lock"></i>هذا القسم متاح فقط لمن لديه صلاحية رؤية الأرباح.</div>';return;}
  if(acts)acts.innerHTML='';
  var dim=window._anDim||'client',opts={from:window._anFrom||'',to:window._anTo||''};
  var P=anProfitBy(dim,opts),A=anAging(),C=anCashflow(),chk=anCheck(opts);
  var rr=function(){renderAnalytics(document.getElementById('main-content'),document.getElementById('topbar-actions'));};
  window._anRerender=rr;
  var DL={client:'العميل',project:'المشروع',tech:'الفني',dept:'القسم'};
  var money=function(n){return fmt(Math.round(n*100)/100);};
  el.innerHTML=`
  <div class="card" style="margin-bottom:16px"><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
    <div class="form-group"><label class="form-label">تحليل الربحية حسب</label><select class="form-control" onchange="window._anDim=this.value;_anRerender()">
      ${Object.keys(DL).map(k=>`<option value="${k}" ${k===dim?'selected':''}>${DL[k]}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">من</label><input type="date" class="form-control" value="${esc(opts.from)}" onchange="window._anFrom=this.value;_anRerender()"></div>
    <div class="form-group"><label class="form-label">إلى</label><input type="date" class="form-control" value="${esc(opts.to)}" onchange="window._anTo=this.value;_anRerender()"></div>
    <div style="font-size:12px;padding-bottom:8px">${chk.ok?'<span style="color:var(--accent)">✅ المجاميع مطابقة لإجماليات السجلات</span>':'<span style="color:var(--danger)">⚠️ في فرق: '+esc(chk.issues.join(', '))+'</span>'}</div>
  </div></div>
  <div class="grid-4" style="margin-bottom:16px">
    <div class="metric-card"><div class="metric-label">الإيراد ($)</div><div class="metric-value blue">${finValUSD(P.total.revenue)}</div></div>
    <div class="metric-card"><div class="metric-label">التكلفة + العمولات ($)</div><div class="metric-value">${finValUSD(P.total.cost+P.total.commission)}</div></div>
    <div class="metric-card"><div class="metric-label">الربح ($)</div><div class="metric-value green">${finValUSD(P.total.profit,'profit')}</div></div>
    <div class="metric-card"><div class="metric-label">الهامش</div><div class="metric-value">${canViewProfits()?P.total.margin+'%':'••••'}</div></div>
  </div>
  <div class="card" style="margin-bottom:16px"><div style="font-weight:700;margin-bottom:8px">ربحية حسب ${DL[dim]}</div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:8px">الربح = قيمة الفاتورة/العمل كاملة − التكلفة − العمولة (مش المحقّق بس). المحصّل والمتبقي جنبها. ${dim==='tech'?'إيراد وأجور العمل بتتوزع على الفنيين حسب أجر كل واحد (بالتساوي إذا ما في أجور)، والمبيعات بسطر مستقل.':''}</div>
    <div style="overflow-x:auto"><table><thead><tr><th>${DL[dim]}</th><th>عدد</th><th>إيراد $</th><th>تكلفة $</th><th>عمولة $</th><th>ربح $</th><th>هامش</th><th>محصّل $</th><th>متبقي $</th></tr></thead><tbody>
    ${P.rows.map(r=>`<tr><td><b>${esc(r.name)}</b></td><td>${r.count}</td><td>${finValUSD(r.revenue)}</td><td>${money(r.cost)}</td><td>${money(r.commission)}</td>
      <td style="font-weight:700;color:${r.profit<0?'var(--danger)':'var(--accent)'}">${finValUSD(r.profit,'profit')}</td><td>${canViewProfits()?r.margin+'%':'••'}</td><td>${money(r.collected)}</td><td>${money(r.remaining)}</td></tr>`).join('')||'<tr><td colspan="9" style="text-align:center;color:var(--text2)">لا بيانات</td></tr>'}
    </tbody><tfoot><tr style="font-weight:700"><td>الإجمالي</td><td>${P.total.count}</td><td>${finValUSD(P.total.revenue)}</td><td>${money(P.total.cost)}</td><td>${money(P.total.commission)}</td><td>${finValUSD(P.total.profit,'profit')}</td><td>${canViewProfits()?P.total.margin+'%':'••'}</td><td>${money(P.total.collected)}</td><td>${money(P.total.remaining)}</td></tr></tfoot></table></div></div>
  <div class="card" style="margin-bottom:16px"><div style="font-weight:700;margin-bottom:8px">أعمار الديون (بالدولار) — الإجمالي ${money(A.total)} على ${A.count} مستحق</div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:8px">الاستحقاق: تاريخ الفاتورة/العمل + ${anTermsDays()} يوم (مهلة السداد)، ودفعات العقود حسب تاريخ استحقاقها.</div>
    <div style="overflow-x:auto"><table><thead><tr><th>العميل</th>${AN_BUCKETS.map(b=>`<th>${b[1]}</th>`).join('')}<th>الإجمالي</th></tr></thead><tbody>
    ${A.clients.map(c=>`<tr><td><b>${esc(c.name)}</b></td>${AN_BUCKETS.map(b=>`<td>${c.buckets[b[0]]?money(c.buckets[b[0]]):'—'}</td>`).join('')}<td style="font-weight:700">${money(c.total)}</td></tr>`).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--text2)">ما في ديون</td></tr>'}
    </tbody><tfoot><tr style="font-weight:700"><td>الإجمالي</td>${AN_BUCKETS.map(b=>`<td>${money(A.buckets[b[0]])}</td>`).join('')}<td>${money(A.total)}</td></tr></tfoot></table></div></div>
  <div class="card"><div style="font-weight:700;margin-bottom:8px">التدفق النقدي المتوقع</div>
    <div style="overflow-x:auto"><table><thead><tr><th></th>${AN_CF.map(b=>`<th>${b[1]}</th>`).join('')}<th>الإجمالي</th></tr></thead><tbody>
      <tr><td><b>مقبوضات متوقعة</b></td>${AN_CF.map(b=>`<td>${money(C.inflow[b[0]])}</td>`).join('')}<td style="font-weight:700">${money(C.totalIn)}</td></tr></tbody></table></div>
    <div style="margin-top:10px;font-size:13px;line-height:2">مدفوعات مستحقة (غير مجدولة بتاريخ): ديون الموردين <b>${money(C.outflow.supplierDebt)}</b> + أجور غير مدفوعة <b>${money(C.outflow.unpaidWages)}</b> = <b>${money(C.outflow.totalOut)}</b><br>
    الصافي المتوقع (مقبوضات − مدفوعات مستحقة): <b style="color:${C.net<0?'var(--danger)':'var(--accent)'}">${money(C.net)} $</b></div></div>`;
}
