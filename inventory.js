/* ====================================================================
   inventory.js — T38 (الجزء 2: المحرك): أصناف المخزون، الرصيد، متوسط التكلفة، الجرد، ربح الصنف.
   المبدأ: الرصيد "بيتحسب" ما بينخزّن — من 3 مصادر:
     1) المشتريات: db.suppliers[].purchases[].items[] اللي عليها itemId  (داخل +) — ملاحظة: price بالمشتريات = إجمالي السطر، فتكلفة الوحدة = price ÷ qty
     2) المبيعات:  db.sales[].items[] اللي عليها itemId                  (طالع −)
     3) حركات يدوية db.stockMoves: consume (استهلاك) · adjust (تسوية ±) · count (جرد = الرصيد الفعلي)
   وبالتالي ما في قيد مزدوج ولا انحراف: تعديل أو حذف فاتورة بيغيّر الرصيد لحاله.
   المخزون مشترك بين الأقسام (قرار افتراضي من الخطة)؛ item.dept اختياري للتصفية فقط.
   كل القيم المالية بالدولار (toUSDHist) والتكلفة بمتوسط متحرك مرجّح.
   لا يعدّل أي ملف قائم: بيتحمّل كـ bundle ('inventory') بـ ensureBundle.
   ==================================================================== */
function invEnsure(){
  if(!Array.isArray(db.stockItems))db.stockItems=[];
  if(!Array.isArray(db.stockMoves))db.stockMoves=[];
  db.stockItems.forEach(function(i){if(!i.id)i.id=uid();});
  db.stockMoves.forEach(function(m){if(!m.id)m.id=uid();});
}
var INV_RANK={opening:-1,purchase:0,adjust:1,sale:2,consume:2,count:3};
function invRound(n,d){var f=Math.pow(10,d==null?4:d);return Math.round((+n||0)*f)/f;}

function invAddItem(o){
  invEnsure();
  var name=String(o&&o.name||'').trim();if(!name)throw new Error('اسم الصنف مطلوب');
  var it={id:uid(),name:name,sku:String(o.sku||'').trim(),unit:o.unit||'قطعة',minQty:o.minQty===undefined||o.minQty===''?'':+o.minQty,
    openQty:+o.openQty||0,openCost:+o.openCost||0,dept:o.dept||'',active:true};
  db.stockItems.push(it);return it;
}
function invAddMove(o){
  invEnsure();
  if(['consume','adjust','count'].indexOf(o.type)<0)throw new Error('نوع حركة غير معروف');
  if(!db.stockItems.some(function(i){return i.id===o.itemId;}))throw new Error('الصنف غير موجود');
  var q=+o.qty;if(!isFinite(q))throw new Error('الكمية غير صحيحة');
  if(o.type==='consume'&&q<=0)throw new Error('كمية الاستهلاك لازم تكون موجبة');
  if(o.type==='count'&&q<0)throw new Error('كمية الجرد ما بتكون سالبة');
  var m={id:uid(),itemId:o.itemId,type:o.type,qty:q,date:o.date||invToday(),note:o.note||'',ref:o.ref||null};
  db.stockMoves.push(m);return m;
}
function invToday(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');} // تاريخ محلي مش UTC

/* مصادر الصنف الخام (غير مرتّبة) */
function invSources(itemId){
  var out=[],n=0;
  (db.suppliers||[]).forEach(function(s){(s.purchases||[]).forEach(function(p){(p.items||[]).forEach(function(i){
    if(i.itemId===itemId){var q=+i.qty||1;out.push({kind:'purchase',date:p.date||'',qty:q,costUSD:toUSDHist((+i.price||0)/q,p.currency||'SYP',p),ref:p.id,n:n++});}
  });});});
  (db.sales||[]).forEach(function(s){(s.items||[]).forEach(function(i){
    if(i.itemId===itemId){var q=+i.qty||1;out.push({kind:'sale',date:s.date||'',qty:q,revUSD:toUSDHist((+i.salePrice||0)*q,s.currency||'SYP',s),ref:s.id,n:n++});}
  });});
  (db.stockMoves||[]).forEach(function(m){
    if(m.itemId===itemId)out.push({kind:m.type,date:m.date||'',qty:+m.qty||0,ref:m.id,note:m.note,n:n++});
  });
  return out;
}

/* دفتر الصنف: كل حركة مع الرصيد ومتوسط التكلفة بعدها */
function invLedger(itemId,asOf){
  invEnsure();
  var item=db.stockItems.find(function(i){return i.id===itemId;});if(!item)return [];
  var src=invSources(itemId).filter(function(e){return !asOf||!e.date||e.date<=asOf;});
  src.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:(INV_RANK[a.kind]-INV_RANK[b.kind])||(a.n-b.n);});
  var qty=+item.openQty||0,avg=+item.openCost||0,rows=[];
  if(qty||avg)rows.push({kind:'opening',date:'',delta:qty,costUSD:avg,cogs:0,revUSD:0,balance:qty,avg:avg});
  src.forEach(function(e){
    var delta=0,cogs=0,rev=0,cost=0;
    if(e.kind==='purchase'){
      delta=e.qty;cost=e.costUSD;
      avg=qty<=0?e.costUSD:(qty*avg+e.qty*e.costUSD)/(qty+e.qty);
    }else if(e.kind==='sale'){delta=-e.qty;cogs=e.qty*avg;rev=e.revUSD;cost=avg;}
    else if(e.kind==='consume'){delta=-e.qty;cogs=e.qty*avg;cost=avg;}
    else if(e.kind==='adjust'){delta=e.qty;cost=avg;if(delta>0&&qty<=0&&!avg)avg=0;}
    else if(e.kind==='count'){delta=e.qty-qty;cost=avg;}
    qty+=delta;
    rows.push({kind:e.kind,date:e.date,ref:e.ref,note:e.note,delta:invRound(delta),costUSD:invRound(cost),cogs:invRound(cogs),revUSD:invRound(rev),balance:invRound(qty),avg:invRound(avg)});
  });
  return rows;
}
function invBalance(itemId,asOf){var l=invLedger(itemId,asOf);return l.length?l[l.length-1].balance:0;}
function invAvgCost(itemId){var l=invLedger(itemId);return l.length?l[l.length-1].avg:0;}

/* تفصيل الرصيد + بوابة المرحلة: الرصيد = افتتاحي + مشتريات − مبيعات − استهلاك ± تسويات ± جرد
   (المشتريات/المبيعات/الاستهلاك/التسويات بتنحسب هون من جديد مباشرة من المصادر، مش من الدفتر) */
function invBreakdown(itemId){
  invEnsure();
  var item=db.stockItems.find(function(i){return i.id===itemId;});
  var raw=invSources(itemId),sum=function(k){return raw.filter(function(e){return e.kind===k;}).reduce(function(a,e){return a+e.qty;},0);};
  var ledger=invLedger(itemId);
  var countAdj=ledger.filter(function(r){return r.kind==='count';}).reduce(function(a,r){return a+r.delta;},0);
  var b={opening:+item.openQty||0,purchases:sum('purchase'),sales:sum('sale'),consumption:sum('consume'),adjust:sum('adjust'),countAdj:invRound(countAdj),balance:invBalance(itemId)};
  b.expected=invRound(b.opening+b.purchases-b.sales-b.consumption+b.adjust+b.countAdj);
  b.ok=Math.abs(b.expected-b.balance)<0.0001;
  return b;
}

/* ربح الصنف: إيراد المبيعات − تكلفة البضاعة المباعة (متوسط وقت البيع) */
function invItemProfit(itemId){
  var l=invLedger(itemId).filter(function(r){return r.kind==='sale';});
  var rev=l.reduce(function(a,r){return a+r.revUSD;},0),cogs=l.reduce(function(a,r){return a+r.cogs;},0),q=l.reduce(function(a,r){return a-r.delta;},0);
  return {qtySold:invRound(q),revenue:invRound(rev,2),cogs:invRound(cogs,2),profit:invRound(rev-cogs,2),margin:rev>0?invRound((rev-cogs)/rev*100,1):0};
}
function invLowStock(){
  invEnsure();
  return db.stockItems.filter(function(i){return i.active!==false&&i.minQty!==''&&i.minQty!=null&&invBalance(i.id)<=+i.minQty;});
}
/* تقرير كل الأصناف (للواجهة بالجزء 3 وللتحليلات T41) */
function invReport(){
  invEnsure();
  return db.stockItems.map(function(i){
    var b=invBreakdown(i.id),p=invItemProfit(i.id),avg=invAvgCost(i.id);
    return {id:i.id,name:i.name,sku:i.sku,unit:i.unit,dept:i.dept,balance:b.balance,avg:avg,value:invRound(Math.max(b.balance,0)*avg,2),
      purchased:b.purchases,sold:b.sales,consumed:b.consumption,adjust:b.adjust,countAdj:b.countAdj,
      revenue:p.revenue,cogs:p.cogs,profit:p.profit,margin:p.margin,low:i.minQty!==''&&i.minQty!=null&&b.balance<=+i.minQty,negative:b.balance<0,gateOk:b.ok};
  });
}
function invValuation(){return invRound(invReport().reduce(function(a,r){return a+r.value;},0),2);}

/* ===================== واجهة المخزون (T38 — الجزء 3) ===================== */
function invCurLabel(){return '$';}
function renderInventory(el,acts){
  invEnsure();
  acts.innerHTML='<button class="btn btn-primary" onclick="openInvItemModal()"><i class="ti ti-plus"></i> صنف جديد</button><button class="btn" onclick="openInvMoveModal()"><i class="ti ti-arrows-exchange"></i> حركة يدوية (استهلاك / تسوية / جرد)</button>';
  const q=(window._invQ||'').trim().toLowerCase(),flt=window._invF||'all';
  let rows=invReport();
  const totalCount=rows.length,low=rows.filter(r=>r.low).length,neg=rows.filter(r=>r.negative).length;
  rows=rows.filter(r=>(!q||(r.name+' '+r.sku).toLowerCase().indexOf(q)>=0)&&(flt==='all'||(flt==='low'&&r.low)||(flt==='neg'&&r.negative)));
  const val=invValuation();
  el.innerHTML=`
  <div class="grid-4" style="margin-bottom:18px">
    <div class="metric-card"><div class="metric-label">عدد الأصناف</div><div class="metric-value">${totalCount}</div></div>
    <div class="metric-card"><div class="metric-label">قيمة المخزون ($)</div><div class="metric-value blue">${fmt(val)}</div></div>
    <div class="metric-card"><div class="metric-label">تحت الحد الأدنى</div><div class="metric-value amber">${low}</div></div>
    <div class="metric-card"><div class="metric-label">رصيد سالب</div><div class="metric-value ${neg?'red':'green'}">${neg}</div></div>
  </div>
  <div class="card" style="margin-bottom:16px"><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
    <div class="form-group"><label class="form-label">بحث</label><input class="form-control" placeholder="اسم أو رمز الصنف" value="${esc(window._invQ||'')}" oninput="window._invQ=this.value;renderInventory(document.getElementById('main-content'),document.getElementById('topbar-actions'))"></div>
    <div class="form-group"><label class="form-label">عرض</label><select class="form-control" onchange="window._invF=this.value;renderInventory(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
      <option value="all" ${flt==='all'?'selected':''}>الكل</option><option value="low" ${flt==='low'?'selected':''}>تحت الحد الأدنى</option><option value="neg" ${flt==='neg'?'selected':''}>رصيد سالب</option></select></div>
  </div></div>
  <div class="card"><div style="font-size:11px;color:var(--text2);margin-bottom:8px">المخزون مشترك بين الأقسام. الرصيد = افتتاحي + مشتريات − مبيعات − استهلاك ± تسويات ± جرد. اربط بند مشتريات/مبيعات بصنف من خانة "صنف المخزون" داخل البند.</div>
  <div style="overflow-x:auto"><table><thead><tr><th>الصنف</th><th>الرصيد</th><th>متوسط التكلفة $</th><th>القيمة $</th><th>مباع</th><th>الإيراد $</th><th>الربح $</th><th>الهامش</th><th>الحالة</th><th></th></tr></thead><tbody>
  ${rows.length?rows.map(r=>`<tr>
    <td><b>${esc(r.name)}</b>${r.sku?`<div style="font-size:11px;color:var(--text2)">${esc(r.sku)}</div>`:''}</td>
    <td style="font-weight:700;color:${r.negative?'var(--danger)':'inherit'}">${fmt(r.balance)} <span style="font-size:10px;color:var(--text2)">${esc(r.unit)}</span></td>
    <td>${fmt(r.avg)}</td><td>${fmt(r.value)}</td><td>${fmt(r.sold)}</td><td>${fmt(r.revenue)}</td>
    <td style="color:${r.profit<0?'var(--danger)':'var(--accent)'};font-weight:600">${fmt(r.profit)}</td><td>${r.margin}%</td>
    <td>${r.negative?'<span class="badge badge-red">سالب</span>':r.low?'<span class="badge badge-amber">نقص</span>':'<span class="badge badge-green">طبيعي</span>'}${r.gateOk?'':' <span class="badge badge-red">خلل حساب</span>'}</td>
    <td><div class="action-btns"><button class="btn btn-sm" onclick="openInvLedgerModal('${r.id}')"><i class="ti ti-list-details"></i></button><button class="btn btn-sm" onclick="openInvItemModal('${r.id}')"><i class="ti ti-edit"></i></button><button class="btn btn-sm btn-danger" onclick="deleteInvItem('${r.id}')"><i class="ti ti-trash"></i></button></div></td>
  </tr>`).join(''):'<tr><td colspan="10" style="text-align:center;color:var(--text2);padding:18px">لا يوجد أصناف</td></tr>'}
  </tbody></table></div></div>`;
}
function openInvItemModal(id){
  invEnsure();const it=id?db.stockItems.find(x=>x.id===id):null;
  showModal(`<div class="modal-title">${it?'تعديل صنف':'صنف مخزون جديد'}</div>
  <div class="form-row cols-2"><div class="form-group"><label class="form-label">الاسم</label><input class="form-control" id="inv-name" value="${esc(it?it.name:'')}"></div>
  <div class="form-group"><label class="form-label">الرمز / Part Number</label><input class="form-control" id="inv-sku" value="${esc(it?it.sku:'')}"></div></div>
  <div class="form-row cols-2"><div class="form-group"><label class="form-label">الوحدة</label><input class="form-control" id="inv-unit" value="${esc(it?it.unit:'قطعة')}"></div>
  <div class="form-group"><label class="form-label">الحد الأدنى (تنبيه نقص)</label><input type="number" class="form-control" id="inv-min" value="${it&&it.minQty!==''?esc(it.minQty):''}"></div></div>
  <div class="form-row cols-2"><div class="form-group"><label class="form-label">رصيد افتتاحي</label><input type="number" step="any" class="form-control" id="inv-oq" value="${it?esc(it.openQty||0):0}"></div>
  <div class="form-group"><label class="form-label">تكلفة الوحدة الافتتاحية ($)</label><input type="number" step="any" class="form-control" id="inv-oc" value="${it?esc(it.openCost||0):0}"></div></div>
  <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveInvItem('${id||''}')">حفظ</button></div>`);
}
function saveInvItem(id){
  const g=k=>document.getElementById(k).value;
  try{
    if(id){const it=db.stockItems.find(x=>x.id===id);const name=g('inv-name').trim();if(!name)throw new Error('اسم الصنف مطلوب');
      Object.assign(it,{name:name,sku:g('inv-sku').trim(),unit:g('inv-unit')||'قطعة',minQty:g('inv-min')===''?'':+g('inv-min'),openQty:+g('inv-oq')||0,openCost:+g('inv-oc')||0});}
    else invAddItem({name:g('inv-name'),sku:g('inv-sku'),unit:g('inv-unit'),minQty:g('inv-min'),openQty:g('inv-oq'),openCost:g('inv-oc')});
  }catch(e){alert(e.message);return;}
  saveDB(db);closeModal();renderInventory(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}
function deleteInvItem(id){
  if(!guardDelete())return;
  const it=db.stockItems.find(x=>x.id===id);if(!it)return;
  if(invSources(id).length){
    if(!confirm('هاد الصنف عليه حركات/فواتير مرتبطة، ما بينحذف. بدك تخفيه (تعطيله) بدل الحذف؟'))return;
    it.active=false;
  }else{if(!confirm('حذف الصنف "'+it.name+'"؟'))return;db.stockItems=db.stockItems.filter(x=>x.id!==id);}
  saveDB(db);renderInventory(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}
function openInvMoveModal(itemId){
  invEnsure();
  showModal(`<div class="modal-title">حركة مخزون يدوية</div>
  <div class="form-group"><label class="form-label">الصنف</label><select class="form-control" id="mv-item">${db.stockItems.filter(i=>i.active!==false).map(i=>`<option value="${i.id}" ${i.id===itemId?'selected':''}>${esc(i.name)}</option>`).join('')}</select></div>
  <div class="form-row cols-2"><div class="form-group"><label class="form-label">النوع</label><select class="form-control" id="mv-type" onchange="document.getElementById('mv-hint').textContent=({consume:'كمية موجبة بتنقص من الرصيد (استهلاك داخلي/تركيب)',adjust:'كمية بإشارة: موجب يزيد، سالب ينقص (تالف/هدية/تصحيح)',count:'الكمية الفعلية الموجودة بالرف — الرصيد بيصير هالرقم والفرق بينسجّل'})[this.value]">
    <option value="consume">استهلاك</option><option value="adjust">تسوية ±</option><option value="count">جرد (الكمية الفعلية)</option></select></div>
  <div class="form-group"><label class="form-label">الكمية</label><input type="number" step="any" class="form-control" id="mv-qty"></div></div>
  <div id="mv-hint" style="font-size:11px;color:var(--text2);margin-bottom:8px">كمية موجبة بتنقص من الرصيد (استهلاك داخلي/تركيب)</div>
  <div class="form-row cols-2"><div class="form-group"><label class="form-label">التاريخ</label><input type="date" class="form-control" id="mv-date" value="${localToday()}"></div>
  <div class="form-group"><label class="form-label">ملاحظة</label><input class="form-control" id="mv-note"></div></div>
  <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveInvMove()">حفظ</button></div>`);
}
function saveInvMove(){
  const g=k=>document.getElementById(k).value;
  if(g('mv-qty')===''){alert('أدخل الكمية');return;}
  try{invAddMove({itemId:g('mv-item'),type:g('mv-type'),qty:g('mv-qty'),date:g('mv-date'),note:g('mv-note')});}catch(e){alert(e.message);return;}
  saveDB(db);closeModal();renderInventory(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}
function deleteInvMove(moveId,itemId){
  if(!guardDelete())return;
  if(!confirm('حذف هالحركة؟'))return;
  db.stockMoves=db.stockMoves.filter(m=>m.id!==moveId);saveDB(db);openInvLedgerModal(itemId);
}
function openInvLedgerModal(id){
  const it=db.stockItems.find(x=>x.id===id);if(!it)return;
  const KL={opening:'افتتاحي',purchase:'شراء',sale:'بيع',consume:'استهلاك',adjust:'تسوية',count:'جرد'};
  const b=invBreakdown(id),p=invItemProfit(id),L=invLedger(id);
  showModal(`<div class="modal-title">دفتر الصنف — ${esc(it.name)}</div>
  <div style="font-size:12px;background:var(--bg2);border-radius:8px;padding:10px;margin-bottom:10px;line-height:1.9">
    افتتاحي ${fmt(b.opening)} + مشتريات ${fmt(b.purchases)} − مبيعات ${fmt(b.sales)} − استهلاك ${fmt(b.consumption)} + تسويات ${fmt(b.adjust)} + فرق جرد ${fmt(b.countAdj)} = <b>${fmt(b.balance)}</b> ${b.ok?'✅':'⚠️'}<br>
    إيراد ${fmt(p.revenue)}$ − تكلفة ${fmt(p.cogs)}$ = ربح <b>${fmt(p.profit)}$</b> (${p.margin}%)</div>
  <div style="max-height:46vh;overflow:auto"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>±</th><th>الرصيد</th><th>متوسط $</th><th>ملاحظة</th><th></th></tr></thead><tbody>
  ${L.map(r=>`<tr><td>${r.date?fmtDate(r.date):'—'}</td><td>${KL[r.kind]}</td><td style="color:${r.delta<0?'var(--danger)':'var(--accent)'}">${r.delta>0?'+':''}${fmt(r.delta)}</td><td>${fmt(r.balance)}</td><td>${fmt(r.avg)}</td><td style="font-size:11px">${esc(r.note||'')}</td>
    <td>${(r.kind==='consume'||r.kind==='adjust'||r.kind==='count')?`<button class="btn btn-sm btn-danger" onclick="deleteInvMove('${r.ref}','${id}')"><i class="ti ti-trash"></i></button>`:''}</td></tr>`).join('')||'<tr><td colspan="7">لا حركات</td></tr>'}
  </tbody></table></div>
  <div class="modal-actions"><button class="btn" onclick="closeModal();renderInventory(document.getElementById('main-content'),document.getElementById('topbar-actions'))">إغلاق</button></div>`);
}
