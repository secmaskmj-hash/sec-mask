/* contracts.js — يتحمّل عند فتح صفحة «العقود» (T28 + T48).
   المنطق الصرف (تواريخ، جدول الدفعات، الترحيل، الحسابات) موجود بـ core.js وعليه الاختبارات؛ هون الواجهة بس.
   كل نص جاي من البيانات بيتعمله esc()، والـ id داخل onclick بيمرّ من ctq(). */

function ctq(v){return esc(JSON.stringify(String(v)));}
const CT_STATE_BADGE={paid:['badge-green','مسددة'],overdue:['badge-red','متأخرة'],due:['badge-amber','مستحقة اليوم'],upcoming:['','قادمة']};
function ctMoney(v,cur){return fmt(v)+' '+curLabel(cur==='SYP'?'SYP':'USD');}
function ctFind(id){return (db.contracts||[]).find(c=>c.id===id);}
function ctBranchName(c){
  const cl=db.clients.find(x=>x.id===c.clientId);
  const b=cl&&(cl.branchDetails||[]).find(x=>x.id===c.branchId);
  return b?b.name:'';
}
function ctRerender(){if(typeof currentPage!=='undefined'&&currentPage==='myvisits'&&typeof renderMyVisits==='function'){renderMyVisits(document.getElementById('main-content'),document.getElementById('topbar-actions'));return;}renderContracts(document.getElementById('main-content'),document.getElementById('topbar-actions'));}
// متأخرات كل العقود بمكافئ الدولار (عملات مختلطة)
function ctOverdueUSD(today){
  let t=0;
  (db.contracts||[]).forEach(c=>{if(c.status==='cancelled')return;contractPayments(c).forEach(p=>{const r=contractPaymentRemaining(p);if(p.dueDate&&p.dueDate<today&&r>0.004)t+=contractPaymentUSD(p,r);});});
  return t;
}

function renderContractsList(el,acts){
  acts.innerHTML=`<button class="btn btn-primary" onclick="openContractModal()"><i class="ti ti-plus"></i> عقد جديد</button>`;
  const sF=window._ctS||'all',cF=window._ctC||'',q=(window._ctQ||'').trim().toLowerCase();
  const today=localToday();
  const all=db.contracts||[];
  const list=all.filter(c=>{
    const eff=contractEffectiveStatus(c,today);
    if(sF==='review'){if(!c.needsReview)return false;}
    else if(sF!=='all'&&eff!==sF)return false;
    if(cF&&c.clientId!==cF)return false;
    if(q&&![c.number,c.title,getClientName(c.clientId)].join(' ').toLowerCase().includes(q))return false;
    return true;
  }).sort((a,b)=>String(b.number||'').localeCompare(String(a.number||'')));
  const activeN=all.filter(c=>contractEffectiveStatus(c,today)==='active').length;
  const reviewN=all.filter(c=>c.needsReview).length;
  const renewN=contractRenewalAlerts(db,today).filter(x=>x.info.stage!=='expired').length;
  const toBillN=all.reduce((n,c)=>n+(c.status==='cancelled'?0:contractPaymentsToBill(c,today).length),0);
  el.innerHTML=`${ctTabsHTML()}
  <div class="grid-4" style="margin-bottom:18px">
    <div class="metric-card"><div class="metric-label">عقود نشطة</div><div class="metric-value">${activeN}</div></div>
    <div class="metric-card"><div class="metric-label">بحاجة لمراجعة</div><div class="metric-value ${reviewN?'amber':''}">${reviewN}</div>${reviewN?'<div style="font-size:11px;color:var(--text2)">مرحّلة من بطاقات العملاء: القيمة والعملة والمدة غير معروفة</div>':''}</div>
    <div class="metric-card"><div class="metric-label">متأخرات الدفعات (≈ $)</div><div class="metric-value ${ctOverdueUSD(today)>0?'red':''}">${fmtUSD(ctOverdueUSD(today))}</div></div>
    <div class="metric-card"><div class="metric-label">قربت تنتهي (60 يوم)</div><div class="metric-value ${renewN?'amber':''}">${renewN}</div>${toBillN?`<div style="font-size:11px;color:var(--text2)">${toBillN} دفعة مستحقة بلا فاتورة</div>`:''}</div>
  </div>
  <div class="card" style="margin-bottom:16px"><div class="module-tools" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
    <div class="form-group"><label class="form-label">الحالة</label><select class="form-control" style="width:150px" onchange="window._ctS=this.value;ctRerender()">
      ${[['all','الكل'],['active','نشط'],['expired','منتهي'],['cancelled','ملغي'],['review','يحتاج مراجعة']].map(x=>`<option value="${x[0]}" ${sF===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">العميل</label><select class="form-control" style="width:200px" onchange="window._ctC=this.value;ctRerender()"><option value="">الكل</option>
      ${db.clients.map(c=>`<option value="${esc(c.id)}" ${cF===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
    <input class="form-control soft-input" placeholder="بحث برقم العقد أو العميل..." value="${esc(window._ctQ||'')}" oninput="window._ctQ=this.value;ctRerender()">
    <div style="font-size:12px;color:var(--text2);margin-right:auto">${list.length} عقد</div>
  </div></div>
  <div class="card"><div style="overflow-x:auto">${!list.length?`<div class="empty-state"><i class="ti ti-file-certificate"></i><p>ما في عقود${all.length?' بهالفلتر':' بعد'}</p></div>`:`
    <table class="responsive-table"><thead><tr><th>الرقم</th><th>العميل / الفرع</th><th>القسم</th><th>القيمة</th><th>الدفعات</th><th>الزيارة القادمة</th><th>الحالة</th><th></th></tr></thead><tbody>
    ${list.map(c=>{
      const eff=contractEffectiveStatus(c,today),f=contractFinancials(c,today),br=ctBranchName(c);
      const sched=!contractPayments(c).length?'<span class="badge badge-amber">بدون جدول</span>':(Math.abs(f.diff)>0.004?`<span class="badge badge-red" title="مجموع الدفعات ${esc(fmt(f.scheduled))} ≠ قيمة العقد ${esc(fmt(f.value))}">فرق ${esc(fmt(f.diff))}</span>`:`<span class="badge badge-green">✓ ${contractPayments(c).length} دفعة</span>`);
      const nv=c.nextVisitDate?daysUntilISO(c.nextVisitDate,today):null;
      return `<tr>
        <td data-label="الرقم" style="font-weight:700">${esc(c.number||'—')}${c.needsReview?' <span class="badge badge-amber" title="مرحّل من بطاقة العميل">يحتاج مراجعة</span>':''}</td>
        <td data-label="العميل">${esc(getClientName(c.clientId))}${br?` <span style="color:var(--text2);font-size:11px">/ ${esc(br)}</span>`:''}<div style="font-size:11px;color:var(--text2)">${esc(c.title||'')}</div></td>
        <td data-label="القسم">${esc(CONTRACT_DEPT_LABELS[c.department||'']||'—')}</td>
        <td data-label="القيمة" style="font-weight:700">${c.value>0?esc(ctMoney(c.value,c.currency)):'—'}<div style="font-size:11px;color:var(--text2)">${esc((CONTRACT_FREQ.find(x=>x.id===contractIntervalMonths(c))||{label:''}).label)}${f.scheduled>0?' · مسدد '+f.collectedPct+'%':''}</div></td>
        <td data-label="الدفعات">${sched}${f.overdueCount?` <span class="badge badge-red">${f.overdueCount} متأخرة</span>`:''}</td>
        <td data-label="الزيارة القادمة">${c.nextVisitDate?esc(fmtDate(c.nextVisitDate))+(nv!==null&&nv<0?` <span style="color:var(--danger);font-size:11px">متأخرة ${Math.abs(nv)} يوم</span>`:nv===0?' <span style="font-size:11px">اليوم</span>':''):'—'}</td>
        <td data-label="الحالة"><span class="badge ${eff==='active'?'badge-green':eff==='cancelled'?'badge-red':'badge-amber'}">${esc(CONTRACT_STATUS_LABELS[eff]||eff)}</span>${ctRenewalBadge(c,today)}</td>
        <td data-label=""><div class="row-menu-wrap"><button class="row-menu-btn" aria-label="خيارات العقد" onclick="toggleRowMenu(this,event)">⋮</button><div class="row-menu-list">
          <button class="row-menu-item" onclick="openContractVisitsModal(${ctq(c.id)})"><i class="ti ti-calendar-event"></i> الزيارات</button>
          <button class="row-menu-item" onclick="openContractPaymentsModal(${ctq(c.id)})"><i class="ti ti-cash"></i> الدفعات والفواتير</button>
          <button class="row-menu-item" onclick="openContractProfitModal(${ctq(c.id)})"><i class="ti ti-chart-line"></i> ربحية العقد</button>
          ${c.renewedToId?'':`<button class="row-menu-item" onclick="ctRenew(${ctq(c.id)})"><i class="ti ti-refresh"></i> تجديد العقد</button>`}
          <button class="row-menu-item" onclick="openContractModal(${ctq(c.id)})"><i class="ti ti-edit"></i> تعديل</button>
          <button class="row-menu-item danger" onclick="deleteContract(${ctq(c.id)})"><i class="ti ti-trash"></i> حذف</button>
        </div></div></td></tr>`;}).join('')}
    </tbody></table>`}</div></div>`;
}

/* ===== نافذة العقد ===== */
function ctBranchOptions(clientId,sel){
  const cl=db.clients.find(x=>x.id===clientId);
  const bs=cl?(cl.branchDetails||[]):[];
  return '<option value="">كل الفروع / غير محدد</option>'+bs.map(b=>`<option value="${esc(b.id)}" ${b.id===sel?'selected':''}>${esc(b.name)}</option>`).join('');
}
function ctOnClientChange(){
  const cid=document.getElementById('ct-client').value;
  const b=document.getElementById('ct-branch');if(b)b.innerHTML=ctBranchOptions(cid,'');
}
function ctOnBillingChange(){
  const m=(document.querySelector('input[name="ct-bill"]:checked')||{}).value;
  const eq=document.getElementById('ct-equal-opts');if(eq)eq.style.display=m==='equal'?'':'none';
}
function openContractModal(editId){
  const c=editId?ctFind(editId):null;
  if(editId&&!c)return;
  const canGen=!c||!contractPayments(c).length;
  showModal(`
    <div class="modal-title">${c?'تعديل العقد '+esc(c.number||''):'عقد جديد'}</div>
    ${c&&c.needsReview?'<div class="table-note" style="background:var(--warning-bg);border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px">هذا العقد مرحّل تلقائياً من بطاقة العميل. راجع القيمة والعملة والمدة، وبعد الحفظ بيختفي تنبيه المراجعة.</div>':''}
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">العميل</label><select class="form-control" id="ct-client" onchange="ctOnClientChange()"><option value="">— اختر —</option>
        ${db.clients.map(x=>`<option value="${esc(x.id)}" ${c&&c.clientId===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">الفرع</label><select class="form-control" id="ct-branch">${ctBranchOptions(c?c.clientId:'',c?c.branchId:'')}</select></div>
    </div>
    <div class="form-group"><label class="form-label">عنوان العقد (اختياري)</label><input class="form-control" id="ct-title" value="${esc(c?c.title||'':'')}" placeholder="مثال: صيانة كاميرات المبنى الرئيسي"></div>
    <div class="form-row cols-3">
      <div class="form-group"><label class="form-label">تاريخ البدء</label><input type="date" class="form-control" id="ct-start" value="${esc(c?c.startDate||'':localToday())}"></div>
      <div class="form-group"><label class="form-label">المدة (أشهر)</label><input type="number" min="0" step="1" class="form-control" id="ct-duration" value="${c?(+c.durationMonths||0):12}"><div style="font-size:11px;color:var(--text2)">0 = مفتوحة</div></div>
      <div class="form-group"><label class="form-label">تكرار الزيارات</label><select class="form-control" id="ct-freq">
        ${CONTRACT_FREQ.map(f=>`<option value="${f.id}" ${contractIntervalMonths(c||{intervalMonths:3})===f.id?'selected':''}>${f.label}</option>`).join('')}</select></div>
    </div>
    <div class="form-row cols-3">
      <div class="form-group"><label class="form-label">قيمة العقد</label><input type="number" min="0" step="0.01" class="form-control" id="ct-value" value="${c?(+c.value||0):''}"></div>
      <div class="form-group"><label class="form-label">عملة العقد</label><select class="form-control" id="ct-cur"><option value="USD" ${!c||c.currency!=='SYP'?'selected':''}>دولار $</option><option value="SYP" ${c&&c.currency==='SYP'?'selected':''}>ليرة ل.س</option></select></div>
      <div class="form-group"><label class="form-label">القسم</label><select class="form-control" id="ct-dept">
        ${Object.keys(CONTRACT_DEPT_LABELS).map(k=>`<option value="${k}" ${(c&&c.department||'')===k?'selected':''}>${esc(CONTRACT_DEPT_LABELS[k])}</option>`).join('')}</select></div>
    </div>
    <div class="form-group"><label class="form-label">الحالة</label><select class="form-control" id="ct-status">
      ${Object.keys(CONTRACT_STATUS_LABELS).map(k=>`<option value="${k}" ${(c?c.status:'active')===k?'selected':''}>${esc(CONTRACT_STATUS_LABELS[k])}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">عمولة % من الإيراد المحصّل <span style="color:var(--text2);font-weight:400">(اختياري — بتنخصم من ربحية العقد)</span></label><input type="number" min="0" max="100" step="0.1" class="form-control" id="ct-comm" value="${c?(+c.commissionPercent||0):0}"></div>
    ${canGen?`<div class="form-group"><label class="form-label">طريقة الدفع <span style="color:var(--text2);font-weight:400">(بتقدر تعدّل الجدول بعدين من «الدفعات»)</span></label>
      <label style="display:flex;gap:6px;align-items:center"><input type="radio" name="ct-bill" value="single" checked onchange="ctOnBillingChange()"> مبلغ سنوي ثابت: دفعة وحدة بتاريخ البدء</label>
      <label style="display:flex;gap:6px;align-items:center"><input type="radio" name="ct-bill" value="equal" onchange="ctOnBillingChange()"> دفعات متساوية</label>
      <div id="ct-equal-opts" style="display:none;margin:6px 0 0 0" class="form-row cols-2">
        <div class="form-group"><label class="form-label">عدد الدفعات</label><input type="number" min="1" step="1" class="form-control" id="ct-count" value="4"></div>
        <div class="form-group"><label class="form-label">كل كم شهر</label><input type="number" min="1" step="1" class="form-control" id="ct-step" value="3"></div></div>
      <label style="display:flex;gap:6px;align-items:center"><input type="radio" name="ct-bill" value="none" onchange="ctOnBillingChange()"> بدون جدول الآن (دفعات متغيرة أضيفها يدوياً)</label></div>`:''}
    <div class="form-group"><label class="form-label">ملاحظات</label><textarea class="form-control" id="ct-notes" rows="2">${esc(c?c.notes||'':'')}</textarea></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveContract(${ctq(editId||'')})">حفظ</button></div>`);
}
function saveContract(editId){
  const val=id=>{const e=document.getElementById(id);return e?e.value:'';};
  const clientId=val('ct-client');
  if(!clientId||!db.clients.some(x=>x.id===clientId)){alert('اختر العميل');return;}
  const startDate=val('ct-start');
  if(!_isoParts(startDate)){alert('أدخل تاريخ بدء صحيح');return;}
  const durationMonths=Math.max(0,Math.floor(+val('ct-duration')||0));
  const value=round2(+val('ct-value')||0);
  if(value<0){alert('قيمة العقد لا يمكن أن تكون سالبة');return;}
  const intervalMonths=[1,3,6,12].includes(+val('ct-freq'))?+val('ct-freq'):12;
  const currency=val('ct-cur')==='SYP'?'SYP':'USD';
  const department=['security','network'].includes(val('ct-dept'))?val('ct-dept'):'';
  const status=CONTRACT_STATUS_LABELS[val('ct-status')]?val('ct-status'):'active';
  const commissionPercent=Math.min(100,Math.max(0,round2(+val('ct-comm')||0)));
  const fields={commissionPercent,clientId,branchId:val('ct-branch'),title:val('ct-title').trim(),startDate,durationMonths,intervalMonths,value,currency,department,status,notes:val('ct-notes')};
  let c=editId?ctFind(editId):null;
  if(editId&&!c)return;
  const bill=(document.querySelector('input[name="ct-bill"]:checked')||{}).value||'none';
  if(c){
    const timeChanged=c.startDate!==startDate||contractIntervalMonths(c)!==intervalMonths||(+c.durationMonths||0)!==durationMonths;
    if(c.startDate!==startDate)c.anchorDay=0;
    Object.assign(c,fields);c.needsReview=false;
    if(timeChanged){contractResyncVisits(c);}else contractEnsureVisits(c);
    if(!contractPayments(c).length&&value>0&&bill!=='none')c.payments=ctBuildSchedule(c,bill);
  }else{
    c=Object.assign({id:uid(),number:contractNextNumber(db),anchorDay:0,payments:[],nextVisitDate:'',createdAt:new Date().toISOString()},fields);
    contractEnsureVisits(c);
    if(value>0&&bill!=='none')c.payments=ctBuildSchedule(c,bill);
    db.contracts.push(c);
  }
  saveDB(db);closeModal();ctRerender();
}
function ctBuildSchedule(c,mode){
  if(mode==='single')return contractGenerateSchedule(c,'single');
  const count=Math.max(1,Math.floor(+(document.getElementById('ct-count')||{}).value||1));
  const step=Math.max(1,Math.floor(+(document.getElementById('ct-step')||{}).value||1));
  return contractGenerateSchedule(c,'equal',{count,stepMonths:step});
}
function deleteContract(id){
  if(!guardDelete())return;
  const c=ctFind(id);if(!c)return;
  const paid=contractPayments(c).reduce((s,p)=>s+(+p.paidAmount||0),0);
  if(!confirm(paid>0?`⚠️ العقد ${c.number||''} فيه دفعات مسددة (${fmt(paid)}). حذفه بيمحي جدول الدفعات وسجل التسديد نهائياً. متابعة؟`:'حذف هذا العقد نهائياً؟'))return;
  db.contracts=db.contracts.filter(x=>x.id!==id);
  if(typeof logAction==='function')logAction('حذف','عقد',c.number||id);
  saveDB(db);ctRerender();
}

/* ===== جدول الدفعات (T48) ===== */
function openContractPaymentsModal(id){
  const c=ctFind(id);if(!c)return;
  const today=localToday(),f=contractFinancials(c,today),cur=c.currency==='SYP'?'SYP':'USD';
  const pays=contractPayments(c).slice().sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)));
  const anyPaid=pays.some(p=>(+p.paidAmount||0)>0||p.invoiceNo);
  const warn=Math.abs(f.diff)>0.004?`<div style="background:var(--danger-bg,#fee2e2);color:var(--danger);border:1px solid var(--danger);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12.5px">
    <b>مجموع الدفعات ${esc(ctMoney(f.scheduled,cur))} ≠ قيمة العقد ${esc(ctMoney(f.value,cur))}</b> (الفرق ${esc(ctMoney(f.diff,cur))}). لازم تقرر:
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
      <button class="btn btn-sm" onclick="ctSetValueToSchedule(${ctq(id)})">خلّي قيمة العقد = مجموع الدفعات</button>
      ${f.diff>0?`<button class="btn btn-sm" onclick="ctAddPayment(${ctq(id)},true)">أضف دفعة بالفرق (${esc(fmt(f.diff))})</button>`:''}
    </div></div>`:'';
  showModal(`
    <div class="modal-title">دفعات العقد ${esc(c.number||'')} — ${esc(getClientName(c.clientId))}</div>
    <div class="kpi-strip" style="margin-bottom:12px">
      <div class="kpi-mini"><div class="label">قيمة العقد</div><div class="value">${esc(ctMoney(f.value,cur))}</div></div>
      <div class="kpi-mini"><div class="label">مجموع الجدول</div><div class="value">${esc(ctMoney(f.scheduled,cur))}</div></div>
      <div class="kpi-mini"><div class="label">المسدد</div><div class="value" style="color:var(--success)">${esc(ctMoney(f.paid,cur))}</div></div>
      <div class="kpi-mini"><div class="label">المتبقي المستحق</div><div class="value" style="color:${f.remainingDue>0?'var(--danger)':'inherit'}">${esc(ctMoney(f.remainingDue,cur))}</div></div>
    </div>
    ${warn}
    <div style="overflow-x:auto"><table class="responsive-table"><thead><tr><th>الاستحقاق</th><th>المبلغ</th><th>الحالة</th><th>المسدد</th><th>الفاتورة</th><th></th></tr></thead><tbody>
    ${pays.length?pays.map(p=>{
      const st=contractPaymentState(p,today),b=CT_STATE_BADGE[st];
      return `<tr>
        <td data-label="الاستحقاق"><input type="date" class="form-control" style="width:150px" value="${esc(p.dueDate||'')}" onchange="ctSetPaymentField(${ctq(id)},${ctq(p.id)},'dueDate',this.value)"></td>
        <td data-label="المبلغ"><input type="number" min="0" step="0.01" class="form-control" style="width:120px" value="${esc(p.amount)}" onchange="ctSetPaymentField(${ctq(id)},${ctq(p.id)},'amount',this.value)"></td>
        <td data-label="الحالة"><span class="badge ${b[0]}">${b[1]}</span></td>
        <td data-label="المسدد">${(+p.paidAmount||0)>0?esc(ctMoney(p.paidAmount,cur))+`<div style="font-size:11px;color:var(--text2)">${esc(fmtDate(p.paidDate))}${cur==='SYP'&&p.rate?' · سعر '+esc(fmt(p.rate)):''}</div>`:'—'}</td>
        <td data-label="الفاتورة">${p.invoiceNo?`<div style="font-weight:700;font-size:12px">${esc(p.invoiceNo)}</div><div style="font-size:11px;color:var(--text2)">${esc(fmtDate(p.invoiceDate))}</div><button class="btn btn-sm" onclick="ctPrintInvoice(${ctq(id)},${ctq(p.id)})"><i class="ti ti-printer"></i> طباعة</button>`:`<button class="btn btn-sm" onclick="ctBillPayment(${ctq(id)},${ctq(p.id)})"><i class="ti ti-file-invoice"></i> فوترة</button>`}</td>
        <td data-label=""><div style="display:flex;gap:4px">${contractPaymentRemaining(p)>0.004?`<button class="btn btn-sm btn-primary" onclick="openContractPayModal(${ctq(id)},${ctq(p.id)})">تسجيل دفعة</button>`:''}<button class="btn btn-sm" aria-label="حذف الدفعة" onclick="ctDeletePayment(${ctq(id)},${ctq(p.id)})">✕</button></div></td></tr>`;}).join('')
      :'<tr><td colspan="6" style="text-align:center;color:var(--text2)">ما في دفعات مجدولة</td></tr>'}
    </tbody></table></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
      <button class="btn btn-sm" onclick="ctAddPayment(${ctq(id)},false)"><i class="ti ti-plus"></i> إضافة دفعة</button>
      ${contractPaymentsToBill(c,today).length?`<button class="btn btn-sm btn-primary" onclick="ctBillDue(${ctq(id)})"><i class="ti ti-file-invoice"></i> فوترة المستحق (${contractPaymentsToBill(c,today).length})</button>`:''}
      <button class="btn btn-sm" ${anyPaid?'disabled title="في دفعات مسددة، ما بيصير نعيد توليد الجدول"':''} onclick="ctRegenerate(${ctq(id)},'single')">دفعة سنوية وحدة</button>
      <button class="btn btn-sm" ${anyPaid?'disabled title="في دفعات مسددة، ما بيصير نعيد توليد الجدول"':''} onclick="ctRegenerate(${ctq(id)},'equal')">دفعات متساوية…</button>
    </div>
    <div class="modal-actions"><button class="btn" onclick="closeModal();ctRerender()">إغلاق</button></div>`);
}
function ctSetPaymentField(cid,pid,field,v){
  const c=ctFind(cid),p=c&&contractPayments(c).find(x=>x.id===pid);if(!p)return;
  if(field==='amount'){
    const a=round2(+v);
    if(p.invoiceNo){alert('الدفعة انفوترت ('+p.invoiceNo+') — ما بيصير تعدّل مبلغها');}
    else if(!(a>=0)){alert('المبلغ غير صحيح');}
    else if(a<(+p.paidAmount||0)-0.004){alert('المبلغ لا يمكن أن يكون أقل من المسدد ('+fmt(p.paidAmount)+')');}
    else p.amount=a;
  }else if(field==='dueDate'){
    if(_isoParts(v))p.dueDate=v;else alert('تاريخ غير صحيح');
  }
  saveDB(db);openContractPaymentsModal(cid);
}
function ctAddPayment(cid,useDiff){
  const c=ctFind(cid);if(!c)return;
  const amt=useDiff?Math.max(0,contractScheduleDiff(c)):0;
  const pays=contractPayments(c);
  const last=pays.map(p=>p.dueDate).filter(Boolean).sort().pop();
  c.payments=pays.concat([newContractPayment(c,last?addMonthsClamped(last,1,c.anchorDay):localToday(),amt)]);
  saveDB(db);openContractPaymentsModal(cid);
}
function ctDeletePayment(cid,pid){
  const c=ctFind(cid),p=c&&contractPayments(c).find(x=>x.id===pid);if(!p)return;
  if(p.invoiceNo){alert('الدفعة انفوترت ('+p.invoiceNo+') — ما بيصير تنحذف');return;}
  if((+p.paidAmount||0)>0&&!confirm('هاي الدفعة فيها مبلغ مسدد ('+fmt(p.paidAmount)+'). حذفها بيمحي سجل التسديد. متابعة؟'))return;
  c.payments=c.payments.filter(x=>x.id!==pid);
  saveDB(db);openContractPaymentsModal(cid);
}
function ctSetValueToSchedule(cid){
  const c=ctFind(cid);if(!c)return;
  c.value=contractScheduledTotal(c);saveDB(db);openContractPaymentsModal(cid);
}
function ctRegenerate(cid,mode){
  const c=ctFind(cid);if(!c)return;
  if(contractPayments(c).some(p=>(+p.paidAmount||0)>0||p.invoiceNo))return;
  if(!(+c.value>0)){alert('أدخل قيمة العقد أول (من «تعديل»)');return;}
  let opts=null;
  if(mode==='equal'){
    const count=Math.floor(+prompt('عدد الدفعات:','4')||0),step=Math.floor(+prompt('كل كم شهر؟','3')||0);
    if(!(count>=1&&step>=1))return;
    opts={count,stepMonths:step};
  }
  if(contractPayments(c).length&&!confirm('رح يتبدّل الجدول الحالي بجدول جديد. متابعة؟'))return;
  c.payments=contractGenerateSchedule(c,mode,opts);
  saveDB(db);openContractPaymentsModal(cid);
}
function openContractPayModal(cid,pid){
  const c=ctFind(cid),p=c&&contractPayments(c).find(x=>x.id===pid);if(!p)return;
  const cur=c.currency==='SYP'?'SYP':'USD',rem=contractPaymentRemaining(p);
  showModal(`
    <div class="modal-title">تسجيل دفعة — ${esc(c.number||'')}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">استحقاق ${esc(fmtDate(p.dueDate))} · المتبقي ${esc(ctMoney(rem,cur))}</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">المبلغ (${cur==='SYP'?'ل.س':'$'})</label><input type="number" min="0" step="0.01" class="form-control" id="cp-amount" value="${esc(rem)}"></div>
      <div class="form-group"><label class="form-label">تاريخ التسديد</label><input type="date" class="form-control" id="cp-date" value="${esc(localToday())}"></div>
    </div>
    <div class="form-group"><label class="form-label">سعر الصرف وقت التسديد (ل.س لكل $)</label><input type="number" min="0" step="0.01" class="form-control" id="cp-rate" value="${esc(getExchangeRate())}"><div style="font-size:11px;color:var(--text2)">بينحفظ مع الدفعة حتى ما يتغيّر مكافئها بالدولار لو تغيّر السعر بعدين.</div></div>
    <div class="modal-actions"><button class="btn" onclick="openContractPaymentsModal(${ctq(cid)})">رجوع</button><button class="btn btn-primary" onclick="saveContractPayment(${ctq(cid)},${ctq(pid)})">تسجيل</button></div>`);
}
function saveContractPayment(cid,pid){
  const c=ctFind(cid),p=c&&contractPayments(c).find(x=>x.id===pid);if(!p)return;
  const date=document.getElementById('cp-date').value;
  if(!_isoParts(date)){alert('أدخل تاريخ صحيح');return;}
  const r=contractRegisterPayment(p,+document.getElementById('cp-amount').value,date,+document.getElementById('cp-rate').value);
  if(!r.ok){alert(r.error);return;}
  saveDB(db);openContractPaymentsModal(cid);
}

/* ===================== الزيارات: لوحة اليوم + ورقة الزيارة + التقرير (T29 / T30 / T49 / T31 / T32) ===================== */
function vsBadge(st){
  const cls={scheduled:'',inprogress:'badge-amber',done:'badge-green',cancelled:'badge-red',postponed:'badge-amber',missed:'badge-red'}[st]||'';
  return `<span class="badge ${cls}">${esc(VISIT_STATUS_LABELS[st]||st)}</span>`;
}
function vsDayLabel(dt,today){
  const n=daysUntilISO(dt,today);
  if(n===null)return '';
  return n===0?'اليوم':n<0?`متأخرة ${Math.abs(n)} يوم`:`بعد ${n} يوم`;
}
function vsRowHTML(it,today){
  const c=it.contract,v=it.visit,br=ctBranchName(c),eff=visitEffectiveStatus(v,today);
  return `<tr>
    <td data-label="الموعد">${esc(fmtDate(it.date))}<div style="font-size:11px;color:${it.date<today?'var(--danger)':'var(--text2)'}">${esc(vsDayLabel(it.date,today))}</div></td>
    <td data-label="العميل">${esc(getClientName(c.clientId))}${br?` <span style="color:var(--text2);font-size:11px">/ ${esc(br)}</span>`:''}<div style="font-size:11px;color:var(--text2)">${esc(c.number||'')} · زيارة ${esc(v.n)}${it.area?' · '+esc(it.area):''}</div></td>
    <td data-label="الفني">${it.tech?esc(it.tech):'<span style="color:var(--text2)">بدون فني</span>'}</td>
    <td data-label="الحالة">${vsBadge(eff)}</td>
    <td data-label=""><div style="display:flex;gap:4px;flex-wrap:wrap"><button class="btn btn-sm btn-primary" onclick="openVisitSheet(${ctq(c.id)},${ctq(v.id)})">ورقة الزيارة</button>${VISIT_OPEN.indexOf(v.status)>=0?`<button class="btn btn-sm" title="تذكير العميل بواتساب" aria-label="تذكير العميل بواتساب" onclick="ctWhats(${ctq(c.id)},${ctq(v.id)})"><i class="ti ti-brand-whatsapp"></i></button>`:''}</div></td></tr>`;
}
function renderVisitsBoard(el,acts){
  acts.innerHTML=`<button class="btn btn-primary" onclick="openContractModal()"><i class="ti ti-plus"></i> عقد جديد</button>`;
  const today=localToday(),tech=window._vbT||'';
  const B=visitsBoard(db,today,tech);
  const techs=(db.workers||[]);
  const section=(title,color,list)=>`<div class="card" style="margin-bottom:14px"><div style="font-weight:800;margin-bottom:8px;color:${color}">${title} <span style="font-weight:600;color:var(--text2)">(${list.length})</span></div>
    ${!list.length?'<div style="color:var(--text2);font-size:13px">لا شي</div>':`<div style="overflow-x:auto"><table class="responsive-table"><thead><tr><th>الموعد</th><th>العميل / الفرع</th><th>الفني</th><th>الحالة</th><th></th></tr></thead><tbody>${list.map(it=>vsRowHTML(it,today)).join('')}</tbody></table></div>`}</div>`;
  el.innerHTML=`${ctTabsHTML()}
  <div class="grid-4" style="margin-bottom:14px">
    <div class="metric-card"><div class="metric-label">زيارات اليوم</div><div class="metric-value">${B.today.length}</div></div>
    <div class="metric-card"><div class="metric-label">متأخرة</div><div class="metric-value ${B.overdue.length?'red':''}">${B.overdue.length}</div></div>
    <div class="metric-card"><div class="metric-label">هالأسبوع (٦ أيام)</div><div class="metric-value">${B.week.length}</div></div>
  </div>
  <div class="card" style="margin-bottom:14px"><div class="form-group" style="margin:0"><label class="form-label">الفني</label>
    <select class="form-control" style="max-width:260px" onchange="window._vbT=this.value;ctRerender()"><option value="">كل الفنيين</option>
    ${techs.map(w=>`<option value="${esc(w.id)}" ${tech===w.id?'selected':''}>${esc(w.name)}</option>`).join('')}</select></div></div>
  ${section('⚠️ متأخرة','var(--danger)',B.overdue)}${section('📅 اليوم','var(--text)',B.today)}${section('🗓️ هالأسبوع','var(--text)',B.week)}`;
}
function openContractVisitsModal(cid){
  const c=ctFind(cid);if(!c)return;
  const today=localToday(),vs=contractVisits(c).slice().sort((a,b)=>(+a.n||0)-(+b.n||0));
  showModal(`<div class="modal-title">زيارات العقد ${esc(c.number||'')} — ${esc(getClientName(c.clientId))}</div>
    <div style="overflow-x:auto"><table class="responsive-table"><thead><tr><th>#</th><th>الموعد</th><th>الفني</th><th>الحالة</th><th></th></tr></thead><tbody>
    ${vs.length?vs.map(v=>`<tr><td data-label="#">${esc(v.n)}</td><td data-label="الموعد">${esc(fmtDate(visitDate(v)))}</td><td data-label="الفني">${esc(v.performedByName||'—')}</td><td data-label="الحالة">${vsBadge(visitEffectiveStatus(v,today))}</td>
      <td data-label=""><button class="btn btn-sm" onclick="openVisitSheet(${ctq(cid)},${ctq(v.id)})">فتح</button></td></tr>`).join(''):'<tr><td colspan="5" style="text-align:center;color:var(--text2)">ما في زيارات (العقد منتهي أو ملغي)</td></tr>'}
    </tbody></table></div><div class="modal-actions"><button class="btn" onclick="closeModal();ctRerender()">إغلاق</button></div>`);
}

/* ----- ورقة الزيارة ----- */
function vsFind(cid,vid){const c=ctFind(cid);return {c:c,v:c&&contractVisits(c).find(x=>x.id===vid)};}
function openVisitSheet(cid,vid){
  const F=vsFind(cid,vid);if(!F.v)return;
  const c=F.c,v=F.v;visitEnsureChecklist(v);
  window._vsC=JSON.parse(JSON.stringify(v.checklist));
  window._vsE=JSON.parse(JSON.stringify(v.expenses||[]));
  window._vsCid=cid;window._vsVid=vid;window._vsSigDirty=false;
  vsRenderSheet();
}
function vsRenderSheet(){
  const F=vsFind(window._vsCid,window._vsVid);if(!F.v)return;
  const c=F.c,v=F.v,today=localToday(),eff=visitEffectiveStatus(v,today);
  const cl=db.clients.find(x=>x.id===c.clientId)||{},brD=(cl.branchDetails||[]).find(b=>b.id===c.branchId)||null;
  const done=v.status==='done',locked=done||v.status==='cancelled';
  const dis=locked?'disabled':'';
  const sig=vsSafeSig(v.signature);
  const cardOk=v.maintenanceId&&(db.maintenance||[]).some(m=>m.id===v.maintenanceId);
  showModal(`
    <div class="modal-title">ورقة الزيارة — ${esc(c.number||'')} · زيارة ${esc(v.n)} ${vsBadge(eff)}</div>
    <div class="print-to-box" style="margin-bottom:10px"><div class="val">${esc(cl.name||'—')}${brD?` — ${esc(brD.name)}`:''}</div>
      <div class="val-sub">${cl.phone?`📞 <a href="tel:${esc(String(cl.phone).replace(/[^0-9+]/g,''))}">${esc(cl.phone)}</a> `:''}${(brD&&brD.address)||cl.address?'📍 '+esc((brD&&brD.address)||cl.address):''}${brD&&brD.mapUrl&&/^https?:\/\//i.test(brD.mapUrl)?` · <a href="${esc(brD.mapUrl)}" target="_blank" rel="noopener">الخريطة</a>`:''}</div>
      <div class="val-sub">الموعد: ${esc(fmtDate(visitDate(v)))} ${v.date!==v.slotDate?`<span style="color:var(--text2)">(الأصلي ${esc(fmtDate(v.slotDate))})</span>`:''}</div></div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">الفني (منفّذ الزيارة)</label><select class="form-control" id="vs-tech" ${dis} onchange="vsOnTech()"><option value="">— بدون / أنا —</option>
        ${(db.workers||[]).map(w=>`<option value="${esc(w.id)}" ${v.performedBy===w.id?'selected':''}>${esc(w.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">أجرة الفني</label><div style="display:flex;gap:6px"><input type="number" min="0" step="0.01" class="form-control" id="vs-wage" ${dis} value="${esc(+v.wage||'')}"><select class="form-control" id="vs-wcur" style="max-width:90px" ${dis}><option value="SYP" ${v.wageCurrency!=='USD'?'selected':''}>ل.س</option><option value="USD" ${v.wageCurrency==='USD'?'selected':''}>$</option></select></div></div>
    </div>
    <div class="form-group"><label class="form-label">ساعات الزيارة <span style="font-size:11px;color:var(--text2);font-weight:400">(بتدخل بحضور الفني وإنتاجيته)</span></label><input type="number" min="0" step="0.25" class="form-control" id="vs-hours" ${dis} value="${esc(+v.hours||'')}" placeholder="0" style="max-width:140px">${v.hoursAuto&&+v.hours>0?'<div style="font-size:11px;color:var(--text2);margin-top:3px">مقدّرة تلقائياً من البدء للإنجاز — عدّلها لو لازم.</div>':''}</div>
    ${v.recordedByName?`<div style="font-size:11px;color:var(--text2);margin-bottom:8px">سجّلها بالنظام: ${esc(v.recordedByName)}</div>`:''}
    <div class="form-group"><label class="form-label">قائمة الفحص</label><div id="vs-checklist">${vsChecklistHTML(locked)}</div>
      ${locked?'':`<div style="display:flex;gap:6px;margin-top:6px"><input class="form-control" id="vs-newitem" placeholder="بند فحص جديد"><button class="btn btn-sm" onclick="vsAddItem()">+ إضافة</button></div>`}</div>
    <div class="form-group"><label class="form-label">ملاحظات الزيارة</label><textarea class="form-control" id="vs-notes" rows="2" ${dis}>${esc(v.notes||'')}</textarea></div>
    <div class="form-group"><label class="form-label">مصاريف الزيارة (اختياري)</label><div id="vs-exp">${vsExpensesHTML(locked)}</div>${locked?'':`<button class="btn btn-sm" onclick="vsAddExpense()">+ مصروف</button>`}</div>
    <div class="form-group"><label class="form-label">توقيع العميل</label>
      ${sig?`<div><img src="${esc(sig)}" alt="توقيع العميل" style="max-width:100%;height:70px;border:1px solid var(--border);border-radius:6px;background:#fff"></div>`:''}
      ${locked&&sig?'':`<canvas id="vs-sig" width="480" height="150" style="width:100%;max-width:480px;height:150px;border:1px dashed var(--border);border-radius:8px;background:#fff;touch-action:none"></canvas>
      <div style="display:flex;gap:6px;margin-top:4px"><button class="btn btn-sm" onclick="vsSigClear()">مسح</button></div>`}
      <input class="form-control" id="vs-signedby" style="margin-top:6px" placeholder="اسم الموقّع" value="${esc(v.signedBy||'')}" ${locked&&sig?'disabled':''}></div>
    ${window.fieldPhotosHTML?fieldPhotosHTML(v,locked):''}
    ${!locked&&(v.status==='scheduled'||v.status==='postponed'||v.status==='inprogress'||eff==='missed')?`<div class="form-group"><label class="form-label">تأجيل إلى</label><div style="display:flex;gap:6px"><input type="date" class="form-control" id="vs-postdate" value="${esc(visitDate(v)>today?visitDate(v):addDaysISO(today,1))}"><button class="btn btn-sm" onclick="vsPostpone()">تأجيل</button></div></div>`:''}
    <div class="modal-actions" style="flex-wrap:wrap">
      <button class="btn" onclick="closeModal();ctRerender()">إغلاق</button>
      ${locked?'':`<button class="btn" onclick="vsSave()">حفظ</button>`}
      ${!locked&&v.status!=='inprogress'?`<button class="btn" onclick="vsStart()">بدء الزيارة</button>`:''}
      ${!locked?`<button class="btn btn-primary" onclick="vsComplete()">✓ إنجاز الزيارة</button>`:''}
      ${v.status==='postponed'||v.status==='inprogress'?`<button class="btn" onclick="vsBack()">رجوع لمجدولة</button>`:''}
      ${!locked?`<button class="btn btn-danger" onclick="vsCancel()">إلغاء الزيارة</button>`:''}
      ${done?`<button class="btn" onclick="vsReopen()">إعادة فتح</button>`:''}
      ${cardOk?`<button class="btn" onclick="vsOpenCard()">بطاقة العمل</button>`:''}
      <button class="btn" onclick="vsReport()"><i class="ti ti-printer"></i> تقرير PDF</button>
    </div>`);
  vsSigInit();
  if(window.fieldPhotosAfterRender)fieldPhotosAfterRender(v);
}
function vsChecklistHTML(locked){
  return (window._vsC||[]).map((x,i)=>`<label style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)"><input type="checkbox" ${x.done?'checked':''} ${locked?'disabled':''} onchange="window._vsC[${i}].done=this.checked"> <span style="flex:1">${esc(x.t)}</span>${locked?'':`<button type="button" class="btn btn-sm" aria-label="حذف البند" onclick="vsDelItem(${i})">✕</button>`}</label>`).join('')||'<div style="color:var(--text2);font-size:12px">ما في بنود</div>';
}
function vsExpensesHTML(locked){
  return (window._vsE||[]).map((e,i)=>`<div style="display:flex;gap:6px;margin-bottom:6px"><input class="form-control" placeholder="البيان" value="${esc(e.note||'')}" ${locked?'disabled':''} onchange="window._vsE[${i}].note=this.value"><input type="number" min="0" step="0.01" class="form-control" style="max-width:110px" value="${esc(e.amount||'')}" ${locked?'disabled':''} onchange="window._vsE[${i}].amount=+this.value||0"><select class="form-control" style="max-width:80px" ${locked?'disabled':''} onchange="window._vsE[${i}].currency=this.value"><option value="SYP" ${e.currency!=='USD'?'selected':''}>ل.س</option><option value="USD" ${e.currency==='USD'?'selected':''}>$</option></select>${locked?'':`<button type="button" class="btn btn-sm" aria-label="حذف المصروف" onclick="vsDelExpense(${i})">✕</button>`}</div>`).join('');
}
function vsAddItem(){const i=document.getElementById('vs-newitem'),t=(i.value||'').trim();if(!t)return;vsCollect();window._vsC.push({t:t,done:false});vsRenderSheet();}
function vsDelItem(i){vsCollect();window._vsC.splice(i,1);vsRenderSheet();}
function vsAddExpense(){vsCollect();window._vsE.push({note:'',amount:0,currency:'SYP'});vsRenderSheet();}
function vsDelExpense(i){vsCollect();window._vsE.splice(i,1);vsRenderSheet();}
function vsOnTech(){
  const F=vsFind(window._vsCid,window._vsVid);if(!F.v)return;
  const id=document.getElementById('vs-tech').value;
  const w=id?lastWorkerWage(id):null;
  if(w&&!(+document.getElementById('vs-wage').value>0)){document.getElementById('vs-wage').value=w.wage;document.getElementById('vs-wcur').value=w.currency==='USD'?'USD':'SYP';}
}
// يكتب الحقول بالزيارة (بدون تغيير الحالة)
function vsCollect(){
  const F=vsFind(window._vsCid,window._vsVid);if(!F.v)return null;
  const v=F.v,g=id=>document.getElementById(id);
  if(g('vs-tech')&&!g('vs-tech').disabled){visitSetTechnician(v,g('vs-tech').value);v.wage=Math.max(0,round2(+g('vs-wage').value||0));v.wageCurrency=g('vs-wcur').value==='USD'?'USD':'SYP';}
  if(g('vs-hours')&&!g('vs-hours').disabled){const hv=Math.max(0,round2(+g('vs-hours').value||0));if(hv!==(+v.hours||0))v.hoursAuto=false;v.hours=hv;}
  if(g('vs-notes')&&!g('vs-notes').disabled)v.notes=g('vs-notes').value;
  v.checklist=JSON.parse(JSON.stringify(window._vsC||[]));
  v.expenses=(window._vsE||[]).filter(e=>(e.note||'').trim()||+e.amount>0).map(e=>({note:String(e.note||''),amount:Math.max(0,round2(+e.amount||0)),currency:e.currency==='USD'?'USD':'SYP'}));
  if(g('vs-signedby')&&!g('vs-signedby').disabled)v.signedBy=g('vs-signedby').value.trim();
  const sig=vsSigData();if(sig)v.signature=sig;
  return F;
}
function vsSave(){const F=vsCollect();if(!F)return;saveDB(db);vsRenderSheet();}
function vsStart(){const F=vsCollect();if(!F)return;const r=visitStart(F.c,F.v);if(!r.ok){alert(r.error);return;}saveDB(db);vsRenderSheet();}
function vsComplete(){
  const F=vsCollect();if(!F)return;
  if(F.v.performedBy&&!(+F.v.wage>0)&&!confirm('الفني محدّد بس بدون أجرة. المتابعة بأجرة صفر؟'))return;
  const r=visitComplete(F.c,F.v,{});
  if(!r.ok){alert(r.error);return;}
  saveDB(db);
  if(typeof logAction==='function')logAction('إنجاز','زيارة',(F.c.number||'')+' #'+F.v.n);
  vsRenderSheet();
}
function vsPostpone(){const F=vsCollect();if(!F)return;const r=visitPostpone(F.c,F.v,document.getElementById('vs-postdate').value);if(!r.ok){alert(r.error);return;}saveDB(db);vsRenderSheet();}
function vsBack(){const F=vsCollect();if(!F)return;const r=visitBackToScheduled(F.c,F.v);if(!r.ok){alert(r.error);return;}saveDB(db);vsRenderSheet();}
function vsCancel(){const F=vsFind(window._vsCid,window._vsVid);if(!F.v)return;if(!confirm('إلغاء هالزيارة؟ (بتنولّد الزيارة التالية بالجدول)'))return;const r=visitCancel(F.c,F.v);if(!r.ok){alert(r.error);return;}saveDB(db);closeModal();ctRerender();}
function vsReopen(){
  const F=vsFind(window._vsCid,window._vsVid);if(!F.v)return;
  if(!guardDelete())return;
  if(!confirm('إعادة فتح الزيارة بتحذف بطاقة العمل يلي انولدت منها (الأجور والمصاريف). متابعة؟'))return;
  const r=visitReopen(F.c,F.v);if(!r.ok){alert(r.error);return;}
  saveDB(db);openVisitSheet(window._vsCid,window._vsVid);
}
function vsOpenCard(){
  const F=vsFind(window._vsCid,window._vsVid);if(!F.v||!F.v.maintenanceId)return;
  const id=F.v.maintenanceId;closeModal();
  ensureBundle('ops').then(()=>{navigate('maintenance');setTimeout(()=>openMaintenanceModal(id),50);});
}

/* ----- لوحة التوقيع ----- */
function vsSafeSig(src){const s=String(src||'');return /^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(s)&&s.length<250000?s:'';}
function vsSigInit(){
  const cv=document.getElementById('vs-sig');if(!cv||!cv.getContext)return;
  const ctx=cv.getContext('2d');ctx.lineWidth=2.5;ctx.lineCap='round';ctx.strokeStyle='#111';
  let drawing=false;
  const pos=e=>{const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)*cv.width/r.width,y:(e.clientY-r.top)*cv.height/r.height};};
  cv.addEventListener('pointerdown',e=>{drawing=true;window._vsSigDirty=true;const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);try{cv.setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();});
  cv.addEventListener('pointermove',e=>{if(!drawing)return;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();e.preventDefault();});
  const end=()=>{drawing=false;};
  cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
}
function vsSigClear(){const cv=document.getElementById('vs-sig');if(cv){cv.getContext('2d').clearRect(0,0,cv.width,cv.height);}window._vsSigDirty=false;
  const F=vsFind(window._vsCid,window._vsVid);if(F.v)F.v.signature='';}
function vsSigData(){const cv=document.getElementById('vs-sig');if(!cv||!window._vsSigDirty)return '';try{return vsSafeSig(cv.toDataURL('image/png'));}catch(e){return '';}}

/* ----- تقرير الزيارة (T32) ----- */
function visitReportHTML(c,v){
  const co=db.company||{},cl=db.clients.find(x=>x.id===c.clientId)||{},brD=(cl.branchDetails||[]).find(b=>b.id===c.branchId)||null;
  const sig=vsSafeSig(v.signature);
  const list=Array.isArray(v.checklist)?v.checklist:[];
  const exp=(v.expenses||[]).filter(e=>+e.amount>0||e.note);
  const date=v.doneDate||visitDate(v);
  return `
  <div class="print-doc">
    <div class="print-header">${getCompanyHeader()}
      <div style="text-align:left;flex-shrink:0"><div class="print-doc-type">تقرير زيارة صيانة</div>
        <div class="print-doc-meta"><b>العقد:</b> ${esc(c.number||'—')} · <b>زيارة رقم:</b> ${esc(v.n)}<br><b>التاريخ:</b> ${esc(fmtDate(date))}<br><b>الحالة:</b> ${esc(VISIT_STATUS_LABELS[v.status]||v.status)}</div></div></div>
    <div class="print-to-section">
      <div class="print-to-box"><label>العميل</label><div class="val">${esc(cl.name||'—')}${brD?` — ${esc(brD.name)}`:''}</div>
        <div class="val-sub">${cl.phone?'هاتف: '+esc(cl.phone)+'<br>':''}${(brD&&brD.address)||cl.address?'العنوان: '+esc((brD&&brD.address)||cl.address):''}</div></div>
      <div class="print-to-box"><label>التنفيذ</label><div class="val-sub" style="line-height:1.9"><b>الفني:</b> ${esc(v.performedByName||'—')}<br>${v.recordedByName?`<b>سجّلها:</b> ${esc(v.recordedByName)}`:''}</div></div>
    </div>
    <table class="print-table" style="width:100%"><thead><tr><th style="width:34px">#</th><th>بند الفحص</th><th style="width:70px;text-align:center">النتيجة</th></tr></thead><tbody>
      ${list.length?list.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.t)}</td><td style="text-align:center">${x.done?'✓ تم':'—'}</td></tr>`).join(''):'<tr><td colspan="3" style="text-align:center">لا توجد بنود</td></tr>'}
    </tbody></table>
    ${v.notes?`<div class="print-note-box"><b>📝 ملاحظات الفني:</b><br>${formatNotesHTML(v.notes)}</div>`:''}
    ${exp.length?`<table class="print-table" style="width:100%;margin-top:6px"><thead><tr><th>مصاريف الزيارة</th><th style="width:110px;text-align:right">المبلغ</th></tr></thead><tbody>${exp.map(e=>`<tr><td>${esc(e.note||'—')}</td><td style="text-align:right">${esc(fmt(e.amount))} ${esc(curLabel(e.currency==='USD'?'USD':'SYP'))}</td></tr>`).join('')}</tbody></table>`:''}
    <div class="print-sign-row">
      <div class="print-sign-box">${sig?`<img src="${esc(sig)}" alt="توقيع العميل" style="height:46px;max-width:100%">`:'<div style="height:40px"></div>'}<div style="font-weight:700">توقيع العميل${v.signedBy?': '+esc(v.signedBy):''}</div><div style="font-size:7px;color:#9ca3af;margin-top:1px">التاريخ: ${esc(fmtDate(date))}</div></div>
      <div class="print-sign-box"><div style="height:40px"></div><div style="font-weight:700">${esc(v.performedByName||getCompanySignatory())}</div><div style="font-size:7px;color:#9ca3af;margin-top:1px">الفني</div></div>
    </div>
    <div class="print-footer">${companyFooterPhonesHTML()}${co.email?`<div>${esc(co.email)}</div>`:''}<div>جميع الحقوق محفوظة © ${new Date().getFullYear()} ${esc(co.name||'Security Mask')}</div></div>
  </div>`;
}
function vsReport(){
  const F=vsCollect();if(!F)return;
  saveDB(db);
  setPrintFile('visit',getClientName(F.c.clientId),(F.c.number||'')+'-V'+F.v.n);
  closeModal();
  showPrintDoc(visitReportHTML(F.c,F.v)+PRINT_ACTIONS_BAR_LANG);
}


/* ===================== T33 / T34 / T35: التبويبات · الأجهزة والضمان · الفوترة والربحية والتجديد · التقويم وحمل الفنيين · واتساب ===================== */
const CT_TABS=[{id:'list',label:'العقود',icon:'ti-file-certificate'},{id:'board',label:'لوحة اليوم',icon:'ti-calendar-event'},{id:'calendar',label:'التقويم',icon:'ti-calendar-month'},{id:'devices',label:'الأجهزة والضمان',icon:'ti-device-cctv'}];
const CT_MONTHS=['كانون الثاني','شباط','آذار','نيسان','أيار','حزيران','تموز','آب','أيلول','تشرين الأول','تشرين الثاني','كانون الأول'];
const CT_WEEKDAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
function ctTabsHTML(){
  const cur=window._ctTab||'list';
  return `<div role="tablist" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">${CT_TABS.map(t=>`<button role="tab" aria-selected="${cur===t.id}" class="btn btn-sm ${cur===t.id?'btn-primary':''}" onclick="window._ctTab='${t.id}';ctRerender()"><i class="ti ${t.icon}"></i> ${esc(t.label)}</button>`).join('')}</div>`;
}
// نقطة الدخول الوحيدة للصفحة: بتختار العرض حسب التبويب
function renderContracts(el,acts){
  const t=window._ctTab||'list';
  if(t==='board')return renderVisitsBoard(el,acts);
  if(t==='calendar')return renderVisitsCalendar(el,acts);
  if(t==='devices')return renderDevicesTab(el,acts);
  return renderContractsList(el,acts);
}
function ctRenewalBadge(c,today){
  if(c.renewedToId){const n=(db.contracts||[]).find(x=>x.id===c.renewedToId);return ` <span class="badge badge-green" title="تم التجديد">جُدّد${n?' → '+esc(n.number||''):''}</span>`;}
  const r=contractRenewalInfo(c,today);
  if(!r)return '';
  if(r.stage==='expired')return ` <span class="badge badge-red">انتهى منذ ${esc(Math.abs(r.days))} يوم</span>`;
  return ` <span class="badge ${r.stage===7?'badge-red':r.stage===30?'badge-amber':''}" title="ينتهي ${esc(fmtDate(r.end))}">${r.days===0?'ينتهي اليوم':'ينتهي بعد '+esc(r.days)+' يوم'}</span>`;
}

/* ----- الفوترة (T34) ----- */
function ctBillPayment(cid,pid){
  const c=ctFind(cid),p=c&&contractPayments(c).find(x=>x.id===pid);if(!p)return;
  const r=contractBillPayment(db,c,p);
  if(!r.ok){alert(r.error);return;}
  if(!r.existing)saveDB(db);
  openContractPaymentsModal(cid);
}
function ctBillDue(cid){
  const c=ctFind(cid);if(!c)return;
  const r=contractBillDue(db,c);
  if(!r.ok){alert(r.error);return;}
  if(r.count)saveDB(db);
  openContractPaymentsModal(cid);
}
function ctInvoiceHTML(c,p){
  const co=db.company||{},cl=db.clients.find(x=>x.id===c.clientId)||{},brD=(cl.branchDetails||[]).find(b=>b.id===c.branchId)||null;
  const cur=c.currency==='SYP'?'SYP':'USD',rem=contractPaymentRemaining(p);
  return `
  <div class="print-doc">
    <div class="print-header">${getCompanyHeader()}
      <div style="text-align:left;flex-shrink:0"><div class="print-doc-type">فاتورة</div>
        <div class="print-doc-meta"><b>رقم الفاتورة:</b> ${esc(p.invoiceNo||'—')}<br><b>التاريخ:</b> ${esc(fmtDate(p.invoiceDate))}<br><b>العقد:</b> ${esc(c.number||'—')}</div></div></div>
    <div class="print-to-section">
      <div class="print-to-box"><label>العميل</label><div class="val">${esc(cl.name||'—')}${brD?` — ${esc(brD.name)}`:''}</div>
        <div class="val-sub">${cl.phone?'هاتف: '+esc(cl.phone)+'<br>':''}${(brD&&brD.address)||cl.address?'العنوان: '+esc((brD&&brD.address)||cl.address):''}</div></div>
    </div>
    <table class="print-table" style="width:100%"><thead><tr><th>البيان</th><th style="width:130px;text-align:right">المبلغ</th></tr></thead><tbody>
      <tr><td>دفعة عقد صيانة دورية ${esc(c.number||'')}${c.title?' — '+esc(c.title):''}<div style="font-size:11px;color:#6b7280">استحقاق ${esc(fmtDate(p.dueDate))}${p.note?' · '+esc(p.note):''}</div></td><td style="text-align:right">${esc(ctMoney(p.amount,cur))}</td></tr>
      <tr><td style="text-align:left"><b>المسدد</b></td><td style="text-align:right">${esc(ctMoney(p.paidAmount||0,cur))}</td></tr>
      <tr><td style="text-align:left"><b>المتبقي</b></td><td style="text-align:right"><b>${esc(ctMoney(rem,cur))}</b></td></tr>
    </tbody></table>
    <div class="print-footer">${companyFooterPhonesHTML()}${co.email?`<div>${esc(co.email)}</div>`:''}<div>جميع الحقوق محفوظة © ${new Date().getFullYear()} ${esc(co.name||'Security Mask')}</div></div>
  </div>`;
}
function ctPrintInvoice(cid,pid){
  const c=ctFind(cid),p=c&&contractPayments(c).find(x=>x.id===pid);if(!p)return;
  if(!p.invoiceNo){alert('الدفعة لسا ما انفوترت');return;}
  setPrintFile('invoice',getClientName(c.clientId),p.invoiceNo);
  closeModal();
  showPrintDoc(ctInvoiceHTML(c,p)+PRINT_ACTIONS_BAR_LANG);
}

/* ----- ربحية العقد (T34) ----- */
function openContractProfitModal(id){
  const c=ctFind(id);if(!c)return;
  const P=contractProfit(c,localToday());
  const row=(l,v,extra,bold)=>`<tr><td>${l}</td><td style="text-align:right;${bold?'font-weight:800':''}">${v}</td><td style="font-size:11px;color:var(--text2)">${extra||''}</td></tr>`;
  showModal(`<div class="modal-title">ربحية العقد ${esc(c.number||'')} — ${esc(getClientName(c.clientId))}</div>
    <div style="overflow-x:auto"><table class="responsive-table"><tbody>
      ${row('قيمة العقد',esc(fmtUSD(P.valueUSD)),'')}
      ${row('المسدد فعلياً (الإيراد المعترف)',esc(fmtUSD(P.revenueUSD)),'نسبة التحصيل '+esc(P.collectedPct)+'%')}
      ${row('تكلفة الزيارات المنجزة',esc(fmtUSD(P.costUSD)),esc(P.visitsDone)+' زيارة (أجور + مصاريف + سيارات)')}
      ${row('العمولة',esc(fmtUSD(P.commissionUSD)),esc(+c.commissionPercent||0)+'% من المحصّل')}
      ${row('ربح العقد حتى الآن',`<span style="color:${P.profitUSD>=0?'var(--success)':'var(--danger)'}">${esc(fmtUSD(P.profitUSD))}</span>`,'المحصّل − التكلفة − العمولة',true)}
      ${row('الربح بعد التحصيل الكامل',esc(fmtUSD(P.fullProfitUSD)),P.marginPct===null?'':'هامش '+esc(P.marginPct)+'%')}
    </tbody></table></div>
    <div style="font-size:11px;color:var(--text2);margin-top:8px">الربح بيتحقق مع التحصيل (متل باقي التطبيق)، لهيك رقم «حتى الآن» ممكن يكون أقل من الربح النهائي. كل الأرقام بالدولار (الليرة بتتحوّل بسعر الصرف المحفوظ وقت الدفع).</div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إغلاق</button></div>`);
}
function ctRenew(id){
  const c=ctFind(id);if(!c)return;
  if(!c.renewedToId&&!confirm('رح ينعمل عقد جديد بنفس الشروط يبدأ باليوم التالي لانتهاء هالعقد (بدون دفعات — بتحددها بعدين). متابعة؟'))return;
  const r=contractRenew(db,c);
  if(!r.ok){alert(r.error);return;}
  if(!r.existing)saveDB(db);
  ctRerender();
}

/* ----- التقويم + حمل الفنيين (T35) ----- */
function ctCalMonth(){return window._calM||localToday().slice(0,7);}
function ctCalGo(k){window._calM=k==='today'?localToday().slice(0,7):calendarShiftMonth(ctCalMonth(),k);window._calDay='';ctRerender();}
function renderVisitsCalendar(el,acts){
  acts.innerHTML=`<button class="btn btn-primary" onclick="openContractModal()"><i class="ti ti-plus"></i> عقد جديد</button>`;
  const ym=ctCalMonth(),today=localToday(),tech=window._calT||'';
  const G=calendarMonthGrid(db,ym,tech);
  const [yy,mm]=ym.split('-').map(Number);
  const names=[0,1,2,3,4,5,6].map(i=>CT_WEEKDAYS[(CAL_WEEK_START+i)%7]);
  const L=techLoad(db,ym,today);
  const day=window._calDay||'';
  const list=day?G.items.filter(it=>it.date===day):G.items;
  const cell=x=>{
    if(!x.date)return '<td class="cal-cell cal-empty"></td>';
    const n=x.items.length;
    return `<td class="cal-cell ${x.date===today?'cal-today':''} ${day===x.date?'cal-sel':''}"><button class="cal-day" onclick="window._calDay=${ctq(day===x.date?'':x.date)};ctRerender()" aria-label="${esc(fmtDate(x.date))}: ${n} زيارة"><span>${+x.date.slice(8)}</span>${n?`<span class="badge">${n}</span>`:''}</button>
      ${x.items.slice(0,2).map(it=>`<div class="cal-item cal-${esc(visitEffectiveStatus(it.visit,today))}" title="${esc(getClientName(it.contract.clientId))}">${esc(getClientName(it.contract.clientId))}</div>`).join('')}${n>2?`<div class="cal-more">+${n-2}</div>`:''}</td>`;
  };
  el.innerHTML=`${ctTabsHTML()}
  <div class="card" style="margin-bottom:14px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
    <button class="btn btn-sm" aria-label="الشهر السابق" onclick="ctCalGo(-1)"><i class="ti ti-chevron-right"></i></button>
    <div style="font-weight:800;min-width:150px;text-align:center">${esc(CT_MONTHS[mm-1])} ${esc(yy)}</div>
    <button class="btn btn-sm" aria-label="الشهر التالي" onclick="ctCalGo(1)"><i class="ti ti-chevron-left"></i></button>
    <button class="btn btn-sm" onclick="ctCalGo('today')">هالشهر</button>
    <select class="form-control" style="max-width:220px;margin-right:auto" aria-label="الفني" onchange="window._calT=this.value;window._calDay='';ctRerender()"><option value="">كل الفنيين</option><option value="__none" ${tech==='__none'?'selected':''}>غير مسند</option>
      ${(db.workers||[]).map(w=>`<option value="${esc(w.id)}" ${tech===w.id?'selected':''}>${esc(w.name)}</option>`).join('')}</select>
    <div style="font-size:12px;color:var(--text2)">${esc(G.total)} زيارة بهالشهر</div></div></div>
  <div class="card" style="margin-bottom:14px"><div style="overflow-x:auto"><table class="cal-grid"><thead><tr>${names.map(n=>`<th>${esc(n)}</th>`).join('')}</tr></thead><tbody>
    ${G.weeks.map(w=>`<tr>${w.map(cell).join('')}</tr>`).join('')}</tbody></table></div></div>
  <div class="card" style="margin-bottom:14px"><div style="font-weight:800;margin-bottom:8px">${day?'زيارات '+esc(fmtDate(day)):'كل زيارات الشهر'} <span style="color:var(--text2);font-weight:600">(${list.length})</span></div>
    ${!list.length?'<div style="color:var(--text2);font-size:13px">لا شي</div>':`<div style="overflow-x:auto"><table class="responsive-table"><thead><tr><th>الموعد</th><th>العميل / الفرع</th><th>الفني</th><th>الحالة</th><th></th></tr></thead><tbody>${list.map(it=>vsRowHTML({contract:it.contract,visit:it.visit,date:it.date,tech:it.visit.performedByName||'',area:visitArea(it.contract)},today)).join('')}</tbody></table></div>`}</div>
  <div class="card"><div style="font-weight:800;margin-bottom:8px">حمل الفنيين — ${esc(CT_MONTHS[mm-1])}</div>
    ${!L.length?'<div style="color:var(--text2);font-size:13px">لا شي</div>':`<div style="overflow-x:auto"><table class="responsive-table"><thead><tr><th>الفني</th><th>الإجمالي</th><th>منجزة</th><th>مفتوحة</th><th>متأخرة</th><th>أكتر يوم ازدحاماً</th></tr></thead><tbody>
    ${L.map(r=>`<tr><td data-label="الفني">${esc(r.name)}</td><td data-label="الإجمالي" style="font-weight:700">${esc(r.total)}</td><td data-label="منجزة">${esc(r.done)}</td><td data-label="مفتوحة">${esc(r.open)}</td><td data-label="متأخرة" style="color:${r.overdue?'var(--danger)':'inherit'}">${esc(r.overdue)}</td>
      <td data-label="أكتر يوم">${esc(fmtDate(r.busiestDay))} (${esc(r.busiestCount)})${r.busy?' <span class="badge badge-red">حمل عالي</span>':''}</td></tr>`).join('')}</tbody></table></div>`}</div>`;
}
function ctWhats(cid,vid){
  const c=ctFind(cid),v=c&&contractVisits(c).find(x=>x.id===vid);if(!v)return;
  const link=visitReminderLink(c,v);
  if(!link){alert('ما في رقم هاتف صالح للعميل أو الفرع — أضفه من بطاقة العميل');return;}
  v.reminderSentAt=new Date().toISOString();saveDB(db);
  window.open(link,'_blank','noopener');
}

/* ----- الأجهزة والضمان (T33) ----- */
const DV_STATE_BADGE={active:['badge-green','ساري'],expiring:['badge-amber','قارب ينتهي'],expired:['badge-red','منتهي'],none:['','بدون ضمان']};
function renderDevicesTab(el,acts){
  acts.innerHTML=`<button class="btn btn-primary" onclick="openDeviceModal()"><i class="ti ti-plus"></i> جهاز جديد</button>`;
  const today=localToday(),cF=window._dvC||'',bF=window._dvB||'',wF=window._dvW||'all',q=(window._dvQ||'').trim().toLowerCase();
  const all=devicesAll(db);
  const list=all.filter(x=>{
    if(cF&&x.clientId!==cF)return false;
    if(bF&&x.branchId!==bF)return false;
    if(wF!=='all'&&deviceWarrantyStatus(x,today).state!==wF)return false;
    if(q&&![x.type,x.model,x.serial,x.location,getClientName(x.clientId)].join(' ').toLowerCase().includes(q))return false;
    return true;
  }).sort((a,b)=>{const A=deviceWarrantyStatus(a,today),B=deviceWarrantyStatus(b,today);return (A.days===null)-(B.days===null)||(A.days-B.days);});
  const alerts=devicesWarrantyAlerts(db,today);
  const cl=db.clients.find(x=>x.id===cF);
  el.innerHTML=`${ctTabsHTML()}
  <div class="grid-4" style="margin-bottom:14px">
    <div class="metric-card"><div class="metric-label">عدد الأجهزة</div><div class="metric-value">${all.length}</div></div>
    <div class="metric-card"><div class="metric-label">ضمان بينتهي خلال ${WARRANTY_SOON_DAYS} يوم</div><div class="metric-value ${alerts.filter(a=>a.w.state==='expiring').length?'amber':''}">${alerts.filter(a=>a.w.state==='expiring').length}</div></div>
    <div class="metric-card"><div class="metric-label">ضمان منتهي</div><div class="metric-value">${alerts.filter(a=>a.w.state==='expired').length}</div></div>
  </div>
  <div class="card" style="margin-bottom:14px"><div class="module-tools" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
    <div class="form-group"><label class="form-label">العميل</label><select class="form-control" style="width:200px" onchange="window._dvC=this.value;window._dvB='';ctRerender()"><option value="">الكل</option>${db.clients.map(c=>`<option value="${esc(c.id)}" ${cF===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
    ${cl?`<div class="form-group"><label class="form-label">الفرع</label><select class="form-control" style="width:180px" onchange="window._dvB=this.value;ctRerender()">${ctBranchOptions(cF,bF)}</select></div>`:''}
    <div class="form-group"><label class="form-label">الضمان</label><select class="form-control" style="width:150px" onchange="window._dvW=this.value;ctRerender()">${[['all','الكل'],['active','ساري'],['expiring','قارب ينتهي'],['expired','منتهي'],['none','بدون ضمان']].map(x=>`<option value="${x[0]}" ${wF===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></div>
    <input class="form-control soft-input" placeholder="بحث بالنوع أو السيريال أو المكان..." value="${esc(window._dvQ||'')}" oninput="window._dvQ=this.value;ctRerender()">
    <div style="font-size:12px;color:var(--text2);margin-right:auto">${list.length} جهاز</div></div></div>
  <div class="card"><div style="overflow-x:auto">${!list.length?`<div class="empty-state"><i class="ti ti-device-cctv"></i><p>ما في أجهزة${all.length?' بهالفلتر':' بعد'}</p></div>`:`
    <table class="responsive-table"><thead><tr><th>الجهاز</th><th>العميل / الفرع</th><th>المكان</th><th>التركيب</th><th>نهاية الضمان</th><th></th></tr></thead><tbody>
    ${list.map(x=>{
      const w=deviceWarrantyStatus(x,today),b=DV_STATE_BADGE[w.state],br=ctDeviceBranchName(x);
      return `<tr><td data-label="الجهاز"><b>${esc(x.type||'—')}</b> ${esc(x.model||'')}<div style="font-size:11px;color:var(--text2);direction:ltr;text-align:right">${esc(x.serial||'')}</div></td>
        <td data-label="العميل">${esc(getClientName(x.clientId))}${br?` <span style="color:var(--text2);font-size:11px">/ ${esc(br)}</span>`:''}</td>
        <td data-label="المكان">${esc(x.location||'—')}</td>
        <td data-label="التركيب">${x.installDate?esc(fmtDate(x.installDate)):'—'}</td>
        <td data-label="نهاية الضمان">${w.end?esc(fmtDate(w.end)):'—'} <span class="badge ${b[0]}">${b[1]}</span>${w.days!==null&&w.state!=='none'?`<div style="font-size:11px;color:var(--text2)">${w.days<0?'منذ '+esc(Math.abs(w.days))+' يوم':w.days===0?'اليوم':'بعد '+esc(w.days)+' يوم'}</div>`:''}</td>
        <td data-label=""><div style="display:flex;gap:4px"><button class="btn btn-sm" aria-label="تعديل" onclick="openDeviceModal(${ctq(x.id)})"><i class="ti ti-edit"></i></button><button class="btn btn-sm btn-danger" aria-label="حذف" onclick="deleteDevice(${ctq(x.id)})"><i class="ti ti-trash"></i></button></div></td></tr>`;}).join('')}
    </tbody></table>`}</div></div>`;
}
function ctDeviceBranchName(x){
  const cl=db.clients.find(c=>c.id===x.clientId),b=cl&&(cl.branchDetails||[]).find(y=>y.id===x.branchId);
  return b?b.name:'';
}
function dvOnClientChange(){
  const c=document.getElementById('dv-client'),b=document.getElementById('dv-branch');
  if(b)b.innerHTML=ctBranchOptions(c?c.value:'','');
}
function openDeviceModal(editId){
  const x=editId?devicesAll(db).find(d=>d.id===editId):null;
  if(editId&&!x)return;
  const pre=!x?{clientId:window._dvC||'',branchId:window._dvB||''}:x;
  showModal(`<div class="modal-title">${x?'تعديل جهاز':'جهاز جديد'}</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">العميل</label><select class="form-control" id="dv-client" onchange="dvOnClientChange()"><option value="">— اختر —</option>${db.clients.map(c=>`<option value="${esc(c.id)}" ${pre.clientId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">الفرع</label><select class="form-control" id="dv-branch">${ctBranchOptions(pre.clientId,pre.branchId)}</select></div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">نوع الجهاز</label><input class="form-control" id="dv-type" list="dv-types" value="${esc(x?x.type:'')}" placeholder="مثال: كاميرا IPC"><datalist id="dv-types">${(db.deviceTypes||[]).map(t=>`<option value="${esc(t)}"></option>`).join('')}</datalist></div>
      <div class="form-group"><label class="form-label">الموديل</label><input class="form-control" id="dv-model" value="${esc(x?x.model:'')}"></div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">الرقم التسلسلي</label><input class="form-control" id="dv-serial" dir="ltr" value="${esc(x?x.serial:'')}"></div>
      <div class="form-group"><label class="form-label">المكان</label><input class="form-control" id="dv-loc" value="${esc(x?x.location:'')}" placeholder="مثال: المدخل الرئيسي"></div>
    </div>
    <div class="form-row cols-3">
      <div class="form-group"><label class="form-label">تاريخ التركيب</label><input type="date" class="form-control" id="dv-install" value="${esc(x?x.installDate:localToday())}"></div>
      <div class="form-group"><label class="form-label">مدة الضمان (أشهر)</label><input type="number" min="0" step="1" class="form-control" id="dv-wm" value="${x?(+x.warrantyMonths||0):12}"></div>
      <div class="form-group"><label class="form-label">نهاية الضمان (اختياري)</label><input type="date" class="form-control" id="dv-wend" value="${esc(x?x.warrantyEnd:'')}"><div style="font-size:11px;color:var(--text2)">فاضي = تركيب + المدة</div></div>
    </div>
    <div class="form-group"><label class="form-label">ملاحظات</label><textarea class="form-control" id="dv-notes" rows="2">${esc(x?x.notes:'')}</textarea></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveDevice(${ctq(editId||'')})">حفظ</button></div>`);
}
function saveDevice(editId){
  const val=id=>{const e=document.getElementById(id);return e?e.value:'';};
  const clientId=val('dv-client');
  if(!clientId||!db.clients.some(c=>c.id===clientId)){alert('اختر العميل');return;}
  if(!val('dv-type').trim()){alert('اكتب نوع الجهاز');return;}
  const inst=val('dv-install'),wend=val('dv-wend');
  if(inst&&!isValidISODate(inst)){alert('تاريخ التركيب غير صحيح');return;}
  if(wend&&!isValidISODate(wend)){alert('تاريخ نهاية الضمان غير صحيح');return;}
  if(inst&&wend&&wend<inst){alert('نهاية الضمان قبل تاريخ التركيب');return;}
  const f={clientId,branchId:val('dv-branch'),type:val('dv-type'),model:val('dv-model'),serial:val('dv-serial'),location:val('dv-loc'),installDate:inst,warrantyMonths:val('dv-wm'),warrantyEnd:wend,notes:val('dv-notes')};
  const list=devicesAll(db);
  if(editId){const i=list.findIndex(d=>d.id===editId);if(i<0)return;list[i]=newDevice(Object.assign({},list[i],f,{id:editId}));}
  else list.push(newDevice(f));
  saveDB(db);closeModal();ctRerender();
}
function deleteDevice(id){
  if(!guardDelete())return;
  const x=devicesAll(db).find(d=>d.id===id);if(!x)return;
  if(!confirm('حذف هالجهاز نهائياً؟'))return;
  db.devices=db.devices.filter(d=>d.id!==id);
  saveDB(db);ctRerender();
}
