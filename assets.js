/* assets.js — يتحمّل عند فتح: العدة / المصاريف العامة / السيارات / الإعارة والاستلام */
function exportToolsExcel(){
  const q=(window._toolSearch||'').trim().toLowerCase();
  const statusFilter=window._toolStatus||'all';
  const rows=db.tools.slice().filter(t=>{
    const text=[t.name,t.toolType||'',t.status,t.notes,(t.assignments||[]).map(a=>getWorkerName(a.workerId)).join(' ')].join(' ').toLowerCase();
    return (!q||text.includes(q))&&(statusFilter==='all'||(t.status||'متوفرة')===statusFilter);
  }).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  const headers=['اسم العدة','نوع العدة','الكمية','الحالة','تاريخ آخر تسليم','العامل (آخر تسليم)','كمية آخر تسليم','ملاحظات'];
  const dataRows=rows.map(t=>{
    const last=(t.assignments||[]).slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0))[0];
    return [t.name||'',t.toolType||'',t.qty||1,t.status||'متوفرة',last?last.date||'':'',last?getWorkerName(last.workerId):'',last?last.qty||1:'',t.notes||''];
  });
  exportRowsToExcel('لائحة_العدة','لائحة العدة',headers,dataRows);
}

function renderTools(el,acts){
  const q=(window._toolSearch||'').trim().toLowerCase();
  const statusFilter=window._toolStatus||'all';
  const rows=db.tools.slice().filter(t=>{
    const text=[t.name,t.toolType||'',t.status,t.notes,(t.assignments||[]).map(a=>getWorkerName(a.workerId)).join(' ')].join(' ').toLowerCase();
    return (!q||text.includes(q))&&(statusFilter==='all'||(t.status||'متوفرة')===statusFilter);
  }).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  const assigned=db.tools.filter(t=>(t.status||'متوفرة')==='مسلمة').length;
  const totalQty=db.tools.reduce((sum,t)=>sum+(+t.qty||1),0);
  const lastAssign=db.tools.flatMap(t=>(t.assignments||[]).map(a=>({...a,toolName:t.name}))).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0))[0];
  acts.innerHTML=`<button class="btn" onclick="window._toolSearch='';window._toolStatus='all';renderTools(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-refresh"></i> تحديث</button><button class="btn" onclick="exportToolsExcel()"><i class="ti ti-file-spreadsheet"></i> تصدير Excel</button><button class="btn btn-primary" onclick="openToolModal()"><i class="ti ti-plus"></i> إضافة عدة</button>`;
  el.innerHTML=`<div class="module-header"><div><div class="module-title"><i class="ti ti-tool"></i> لائحة العدة</div><div class="module-subtitle">إدارة العدة، الكميات، حالة التوفر، وآخر عملية تسليم للعامل.</div></div><div class="module-tools"><input class="form-control soft-input" placeholder="بحث باسم العدة أو العامل..." value="${esc(window._toolSearch||'')}" oninput="window._toolSearch=this.value;renderTools(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><select class="form-control" onchange="window._toolStatus=this.value;renderTools(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><option value="all" ${statusFilter==='all'?'selected':''}>كل الحالات</option><option ${statusFilter==='متوفرة'?'selected':''}>متوفرة</option><option ${statusFilter==='مسلمة'?'selected':''}>مسلمة</option><option ${statusFilter==='صيانة'?'selected':''}>صيانة</option></select></div></div>
  <div class="kpi-strip"><div class="kpi-mini"><div class="label">عدد الأصناف</div><div class="value">${db.tools.length}</div></div><div class="kpi-mini"><div class="label">إجمالي الكمية</div><div class="value">${totalQty}</div></div><div class="kpi-mini"><div class="label">مسلمة حالياً</div><div class="value">${assigned}</div></div><div class="kpi-mini"><div class="label">إجمالي مصاريف شراء العدة ($)</div><div class="value" style="color:var(--danger)">${fmtUSD(generalExpensesTotalUSD())}</div></div><div class="kpi-mini"><div class="label">آخر تسليم</div><div class="value" style="font-size:13px">${lastAssign?`${esc(lastAssign.toolName)}<br><span class="muted">${fmtDate(lastAssign.date)}</span>`:'—'}</div></div></div>
  ${bulkToolbar('tools',`
    <button class="btn btn-sm" style="background:#fff;color:#1B7A43;border-color:#86efac" onclick="bulkToolStatus('متوفرة')">تحديد كـ متوفرة</button>
    <button class="btn btn-sm" style="background:#fff" onclick="bulkToolStatus('صيانة')">تحديد كـ صيانة</button>
  `)}
  <div class="card"><div style="overflow-x:auto">${!rows.length?`<div class="empty-state"><i class="ti ti-tool"></i><p>لا يوجد عدة مطابقة للبحث</p></div>`:`
    <table class="responsive-table"><thead><tr><th style="width:32px"><input type="checkbox" ${rows.length>0&&rows.every(t=>bSel('tools').has(t.id))?'checked':''} onchange='bulkToggleAll("tools",this,${esc(JSON.stringify(rows.map(t=>t.id)))})'></th><th>اسم العدة</th><th>نوع العدة</th><th>الكمية</th><th>الحالة</th><th>آخر تسليم</th><th>ملاحظات</th><th></th></tr></thead><tbody>
      ${rows.map(t=>{const last=(t.assignments||[]).slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0))[0];const badge=(t.status||'متوفرة')==='متوفرة'?'badge-green':((t.status||'')==='صيانة'?'badge-red':'badge-amber');return `<tr>
        <td data-label=""><input type="checkbox" ${bSel('tools').has(t.id)?'checked':''} onchange="bulkToggleRow('tools','${t.id}',this)"></td>
        <td data-label="اسم العدة" style="font-weight:700">${esc(t.name)}</td>
        <td data-label="نوع العدة" style="font-size:12px;color:var(--text2)">${esc(t.toolType||'—')}</td>
        <td data-label="الكمية" class="nowrap">${esc(t.qty||1)}</td>
        <td data-label="الحالة"><span class="badge ${badge}">${esc(t.status||'متوفرة')}</span></td>
        <td data-label="آخر تسليم">${last?`${fmtDate(last.date)} - ${esc(getWorkerName(last.workerId))} <span class="muted">(${esc(last.qty||1)})</span>`:'—'}</td>
        <td data-label="ملاحظات">${esc(t.notes||'')}</td>
        <td data-label=""><div class="row-menu-wrap">
          <button class="row-menu-btn" onclick="toggleRowMenu(this,event)">⋮</button>
          <div class="row-menu-list">
            <button class="row-menu-item" onclick="openToolAssignModal('${t.id}')"><i class="ti ti-user-check"></i> تسليم</button>
            <button class="row-menu-item" onclick="openToolModal('${t.id}')"><i class="ti ti-edit"></i> تعديل</button>
            <button class="row-menu-item danger" onclick="deleteItem('tools','${t.id}');renderTools(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-trash"></i> حذف</button>
          </div>
        </div></td>
      </tr>`;}).join('')}
    </tbody></table>`}</div><div class="table-note">ملاحظة: يمكن استخدام البحث لتصفية العدة حسب الاسم أو العامل أو الملاحظة. لإدارة المصاريف العامة (غير المرتبطة بشغلة) توجه لصفحة "المصاريف العامة" من القائمة الرئيسية.</div></div>`;
}

function renderGeneralExpenses(el,acts){
  if(!db.generalExpenses)db.generalExpenses=[];
  if(!db.generalExpenseTypes)db.generalExpenseTypes=defaultData.generalExpenseTypes;
  acts.innerHTML=`<button class="btn" onclick="renderGeneralExpenses(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-refresh"></i> تحديث</button><button class="btn btn-primary" onclick="openGeneralExpenseModal()"><i class="ti ti-plus"></i> إضافة مصروف عام</button>`;
  const rows=db.generalExpenses.slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  el.innerHTML=`<div class="module-header"><div><div class="module-title"><i class="ti ti-receipt-2"></i> المصاريف العامة</div><div class="module-subtitle">مصاريف غير مرتبطة بشغلة معيّنة (عدة، بضاعة، إيجار، فواتير...)</div></div></div>
  <div class="kpi-strip"><div class="kpi-mini"><div class="label">عدد المصاريف</div><div class="value">${rows.length}</div></div><div class="kpi-mini"><div class="label">إجمالي المصاريف المدخلة ($)</div><div class="value" style="color:var(--danger)">${fmtUSD(generalExpensesTotalUSD())}</div></div></div>
  <div class="card">${!rows.length?`<div class="empty-state"><i class="ti ti-receipt-2"></i><p>لا يوجد مصاريف عامة مسجّلة بعد</p></div>`:`
  <div style="overflow-x:auto"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>ملاحظة</th><th></th></tr></thead><tbody>
  ${rows.map(e=>`<tr>
    <td>${fmtDate(e.date)}</td>
    <td><span class="badge badge-blue">${esc(e.type||'—')}</span></td>
    <td style="font-weight:700">${fmt(e.amount)} ${curLabel(e.currency||'SYP')}</td>
    <td>${esc(e.note||'')}</td>
    <td><button class="btn btn-sm btn-danger" onclick="deleteGeneralExpense('${e.id}')"><i class="ti ti-trash"></i></button></td>
  </tr>`).join('')}
  <tr class="summary-row"><td colspan="2">الإجمالي (بالدولار)</td><td colspan="3">${fmtUSD(generalExpensesTotalUSD())}</td></tr>
  </tbody></table></div>`}</div>
  ${renderMaintSyncOverview()}`;
}

function renderMaintSyncOverview(){
  const wages=maintWagesTotalUSD();
  const workshop=maintWorkshopExpensesTotalUSD();
  const carsCost=maintCarCostsTotalUSD();
  const carsDirect=carsDirectExpensesTotalUSD();
  const manual=generalExpensesTotalUSD();
  const grand=wages+workshop+carsCost+carsDirect+manual;
  return `
  <div class="card" style="margin-top:14px;border-color:var(--gold);border-style:dashed">
    <div class="section-title" style="display:flex;align-items:center;gap:8px"><i class="ti ti-link" style="color:var(--gold-dark)"></i> إجمالي المصاريف العامة (كل المصروف الفعلي) <span class="badge badge-amber">للعرض فقط</span></div>
    <div style="font-size:11px;color:var(--text2);margin:-6px 0 14px">يجمع الكل بدون تكرار.</div>
    <div class="grid-4">
      <div class="metric-card"><div class="metric-label">أجور العمال (من الأعمال)</div><div class="metric-value amber">${fmtUSD(wages)}</div></div>
      <div class="metric-card"><div class="metric-label">مصاريف ورشة (من الأعمال)</div><div class="metric-value amber">${fmtUSD(workshop)}</div></div>
      <div class="metric-card"><div class="metric-label">تكلفة سيارات (من الأعمال)</div><div class="metric-value amber">${fmtUSD(carsCost)}</div></div>
      <div class="metric-card"><div class="metric-label">مصاريف سيارات مباشرة (صفحة السيارات)</div><div class="metric-value amber">${fmtUSD(carsDirect)}</div></div>
      <div class="metric-card"><div class="metric-label">مصاريف عامة يدوية</div><div class="metric-value amber">${fmtUSD(manual)}</div></div>
    </div>
    <div class="metric-card" style="margin-top:12px;background:var(--gold-light)"><div class="metric-label">إجمالي المصاريف العامة (الكل سوا)</div><div class="metric-value" style="color:var(--gold-dark)">${fmtUSD(grand)}</div></div>
  </div>`;
}

function bulkToolStatus(status){
  const s=bSel('tools');
  if(s.size===0)return;
  if(!confirm(`تأكيد تحديد ${s.size} عدة كـ "${status}"؟`))return;
  db.tools.forEach(t=>{if(s.has(t.id))t.status=status;});
  saveDB(db);
  s.clear();
  rerenderPage('tools');
}

function openToolModal(id=''){
  const t=db.tools.find(x=>x.id===id);
  const toolTypeOpts=(db.toolTypes||defaultData.toolTypes).map(tp=>`<option value="${esc(tp)}" ${t&&t.toolType===tp?'selected':''}>${esc(tp)}</option>`).join('');
  showModal(`<div class="modal-title">${t?'تعديل عدة':'إضافة عدة'}</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">اسم العدة</label><input class="form-control" id="tool-name" value="${esc(t&&t.name||'')}" placeholder="مثال: سلم ألمنيوم، دريل بوش..."></div>
      <div class="form-group"><label class="form-label">نوع العدة</label><select class="form-control" id="tool-type">${toolTypeOpts}</select></div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">الكمية</label><input type="number" class="form-control" id="tool-qty" value="${esc(t&&t.qty||1)}"></div>
      <div class="form-group"><label class="form-label">الحالة</label><select class="form-control" id="tool-status"><option ${!t||t.status==='متوفرة'?'selected':''}>متوفرة</option><option ${t&&t.status==='مسلمة'?'selected':''}>مسلمة</option><option ${t&&t.status==='صيانة'?'selected':''}>صيانة</option><option ${t&&t.status==='ناقصة'?'selected':''}>ناقصة</option></select></div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">الحد الأدنى للكمية <span style="font-size:11px;color:var(--text2);font-weight:400">(للتنبيه عند النقص)</span></label><input type="number" class="form-control" id="tool-min-qty" value="${esc(t&&t.minQty!==undefined?t.minQty:'')}" placeholder="مثال: 2"></div>
    </div>
    ${!t?`<div class="form-row cols-2">
      <div class="form-group"><label class="form-label">سعر الشراء <span style="font-size:11px;color:var(--text2);font-weight:400">(اختياري)</span></label><input type="text" class="form-control" id="tool-price" placeholder="0"></div>
      <div class="form-group"><label class="form-label">العملة</label>${currencySelectHTML('tool-price-currency','SYP')}</div>
    </div>
    <div style="font-size:11px;color:var(--text2);margin:-6px 0 14px;background:var(--bg2);border:1px dashed var(--border2);border-radius:8px;padding:8px 10px">بينسجل تلقائياً كمصروف عام.</div>`:''}
    <div class="form-group" style="margin-bottom:14px"><label class="form-label">ملاحظات</label><input class="form-control" id="tool-notes" value="${esc(t&&t.notes||'')}"></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveTool('${id}')">حفظ</button></div>`);
}

function saveTool(id=''){
  const name=document.getElementById('tool-name').value.trim();if(!name){alert('يرجى إدخال اسم العدة');return;}
  const toolTypeEl=document.getElementById('tool-type');
  const minQtyRaw=document.getElementById('tool-min-qty').value;
  const priceEl=document.getElementById('tool-price');
  const price=priceEl?unformatNum(priceEl.value):0;
  const priceCurEl=document.getElementById('tool-price-currency');
  const priceCurrency=priceCurEl&&priceCurEl.value==='USD'?'USD':'SYP';
  const entry={id:id||uid(),name,toolType:toolTypeEl?toolTypeEl.value:'',qty:+document.getElementById('tool-qty').value||1,minQty:minQtyRaw===''?'':+minQtyRaw,status:document.getElementById('tool-status').value,notes:document.getElementById('tool-notes').value,assignments:(db.tools.find(x=>x.id===id)||{}).assignments||[],purchasePrice:(db.tools.find(x=>x.id===id)||{}).purchasePrice||0,purchaseCurrency:(db.tools.find(x=>x.id===id)||{}).purchaseCurrency||'SYP'};
  if(!id&&price>0){
    entry.purchasePrice=price;entry.purchaseCurrency=priceCurrency;
    if(!db.generalExpenses)db.generalExpenses=[];
    db.generalExpenses.push({id:uid(),type:'أدوات',amount:price,currency:priceCurrency,date:localToday(),note:`شراء عدة: ${name}`,source:'tool',toolId:entry.id});
  }
  if(id){const i=db.tools.findIndex(x=>x.id===id);if(i>=0)db.tools[i]=entry;}else db.tools.push(entry);
  saveDB(db);closeModal();renderTools(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function maintWagesTotalUSD(){
  return (db.maintenance||[]).reduce((s,m)=>s+toUSD(getMaintenanceWages(m),m.currency||'SYP'),0);
}

function maintWorkshopExpensesTotalUSD(){
  return (db.maintenance||[]).reduce((s,m)=>{
    const workshop=m&&m.expenses?m.expenses.reduce((ss,e)=>ss+convertCurrency(+e.amount||0,e.currency||m.expensesCurrency||m.currency||'SYP',m.currency||'SYP'),0):0;
    return s+toUSD(workshop,m.currency||'SYP');
  },0);
}

function maintCarCostsTotalUSD(){
  return (db.maintenance||[]).reduce((s,m)=>s+toUSD(getMaintenanceCarCosts(m),m.currency||'SYP'),0);
}
// مصاريف السيارات "المباشرة" (بنزين، نمرة، صيانة عامة...) المسجّلة من صفحة "لائحة السيارات" نفسها
// (db.cars[].expenses) وغير مرتبطة بأي عمل/شغلة محدد — هاي كانت مفقودة تماماً من ملخّص
// "إجمالي المصاريف العامة" بصفحة المصاريف العامة (كانت تحسب بس تكلفة السيارات المرتبطة بأعمال
// عبر maintCarCostsTotalUSD، وتتجاهل هالمصاريف المباشرة)، فكان الإجمالي المعروض هناك أصغر من
// حقيقة المصروف الفعلي، ومختلف عن إجمالي مصاريف السيارات المعروض بصفحة "لائحة السيارات" نفسها
// (renderCars) وبلوحة التحكم الرئيسية (ovCarExpenses بـ core.js)، واللي بيحسبوا الاثنين معاً.
function carsDirectExpensesTotalUSD(){
  return (db.cars||[]).reduce((s,c)=>s+(c.expenses||[]).reduce((a,e)=>a+toUSD(+e.amount||0,e.currency),0),0);
}

function actualCompanySpendTotalUSD(){
  return generalExpensesTotalUSD()+maintWagesTotalUSD()+maintWorkshopExpensesTotalUSD()+maintCarCostsTotalUSD()+carsDirectExpensesTotalUSD();
}

function openGeneralExpenseModal(){
  const typeOpts=(db.generalExpenseTypes||defaultData.generalExpenseTypes).map(tp=>`<option value="${esc(tp)}">${esc(tp)}</option>`).join('');
  showModal(`<div class="modal-title">إضافة مصروف عام</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">النوع</label><select class="form-control" id="ge-type">${typeOpts}</select></div>
      <div class="form-group"><label class="form-label">التاريخ</label><input type="date" class="form-control" id="ge-date" value="${localToday()}"></div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">المبلغ</label><input type="text" class="form-control" id="ge-amount" placeholder="0" oninput="formatMoneyInput(this)"></div>
      <div class="form-group"><label class="form-label">العملة</label>${currencySelectHTML('ge-currency','SYP')}</div>
    </div>
    <div class="form-group" style="margin-bottom:14px"><label class="form-label">ملاحظة</label><input class="form-control" id="ge-note" placeholder="مثال: شراء بضاعة من المورد..."></div>
    <div style="font-size:11px;color:var(--text2);margin:-6px 0 14px;background:var(--bg2);border:1px dashed var(--border2);border-radius:8px;padding:8px 10px">مصروف مستقل، ما بيتكرر.</div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveGeneralExpense()">حفظ</button></div>`);
}

function saveGeneralExpense(){
  const type=document.getElementById('ge-type').value;
  const amount=unformatNum(document.getElementById('ge-amount').value);
  if(!(amount>0)){alert('يرجى إدخال مبلغ صحيح أكبر من صفر');return;}
  const curEl=document.getElementById('ge-currency');
  const currency=curEl&&curEl.value==='USD'?'USD':'SYP';
  const date=document.getElementById('ge-date').value||localToday();
  const note=document.getElementById('ge-note').value;
  if(!db.generalExpenses)db.generalExpenses=[];
  db.generalExpenses.push({id:uid(),type,amount,currency,date,note,source:'manual'});
  logAction('إضافة','مصروف عام',type);
  saveDB(db);closeModal();renderGeneralExpenses(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function deleteGeneralExpense(id){
  if(!guardDelete())return;
  if(!confirm('تأكيد حذف هذا المصروف؟'))return;
  db.generalExpenses=(db.generalExpenses||[]).filter(e=>e.id!==id);
  logAction('حذف','مصروف عام',id);
  saveDB(db);renderGeneralExpenses(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function openToolAssignModal(id){
  const t=db.tools.find(x=>x.id===id);if(!t)return;
  showModal(`<div class="modal-title">تسليم عدة: ${esc(t.name)}</div>
    <div class="form-row cols-2"><div class="form-group"><label class="form-label">العامل</label><select class="form-control" id="ta-worker">${workerOptions('')}</select></div><div class="form-group"><label class="form-label">التاريخ</label><input type="date" class="form-control" id="ta-date" value="${localToday()}"></div></div>
    <div class="form-row cols-2"><div class="form-group"><label class="form-label">الكمية المسلمة</label><input type="number" class="form-control" id="ta-qty" value="1"></div><div class="form-group"><label class="form-label">ملاحظة</label><input class="form-control" id="ta-note"></div></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveToolAssign('${id}')">حفظ التسليم</button></div>`);
}

function saveToolAssign(id){const t=db.tools.find(x=>x.id===id);if(!t)return;t.assignments=t.assignments||[];t.assignments.push({id:uid(),workerId:document.getElementById('ta-worker').value,date:document.getElementById('ta-date').value,qty:+document.getElementById('ta-qty').value||1,note:document.getElementById('ta-note').value});t.status='مسلمة';saveDB(db);closeModal();renderTools(document.getElementById('main-content'),document.getElementById('topbar-actions'));}

function exportCarsExcel(){
  const q=(window._carSearch||'').trim().toLowerCase();
  const rows=db.cars.slice().filter(c=>[c.name,c.plate,c.project,c.moveFrom,c.moveTo,c.notes,(c.expenses||[]).map(e=>`${esc(e.type)} ${esc(e.note)} ${e.project}`).join(' ')].join(' ').toLowerCase().includes(q)).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  const headers=['السيارة','النمرة','المشروع/المكان','إجمالي المصروف ($)','تاريخ المصروف','نوع المصروف','مبلغ المصروف','عملة المصروف','مشروع المصروف','ملاحظة المصروف','ملاحظات السيارة'];
  const dataRows=[];
  rows.forEach(c=>{
    // إجمالي المصروف هون لازم يشمل مصاريف السيارة المباشرة + تكلفتها ضمن أي أعمال صيانة مرتبطة فيها
    // (carId)، بنفس منطق صفحة "لائحة السيارات" (renderCars) تماماً — قبل هذا التصحيح كان هذا العمود
    // بالتصدير يحسب فقط المصاريف المباشرة (c.expenses) ويهمل تكلفة السيارة ضمن الأعمال، فيطلع رقم
    // "الإجمالي" بملف الإكسل أصغر من نفس الرقم المعروض على الشاشة لنفس السيارة.
    const jobsCost=db.maintenance.filter(m=>(m.cars||[]).some(mc=>mc.carId===c.id)).reduce((a,m)=>a+(m.cars||[]).filter(mc=>mc.carId===c.id).reduce((s2,mc)=>s2+toUSD(+mc.amount||0,mc.currency||m.carsCurrency||m.currency),0),0);
    const total=(c.expenses||[]).reduce((s,e)=>s+toUSD(+e.amount||0,e.currency),0)+jobsCost;
    const expenses=c.expenses&&c.expenses.length?c.expenses.slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)):[{}];
    expenses.forEach(e=>{
      dataRows.push([c.name||'',c.plate||'',c.project||'',total,e.date||'',e.type||'',e.amount||'',curLabel(e.currency||'SYP'),e.project||'',e.note||'',c.notes||'']);
    });
  });
  exportRowsToExcel('لائحة_السيارات','لائحة السيارات',headers,dataRows);
}

function renderCars(el,acts){
  const q=(window._carSearch||'').trim().toLowerCase();
  const pFilter=window._carProject||'';
  const rows=db.cars.slice().filter(c=>{
    if(pFilter&&(c.project||'')!==pFilter)return false;
    return [c.name,c.plate,c.project,c.moveFrom,c.moveTo,c.notes,(c.expenses||[]).map(e=>`${esc(e.type)} ${esc(e.note)} ${e.project}`).join(' ')].join(' ').toLowerCase().includes(q);
  }).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  const totalExpenses=db.cars.reduce((s,c)=>s+(c.expenses||[]).reduce((a,e)=>a+toUSD(+e.amount||0,e.currency),0)+db.maintenance.filter(m=>(m.cars||[]).some(mc=>mc.carId===c.id)).reduce((a,m)=>a+(m.cars||[]).filter(mc=>mc.carId===c.id).reduce((s2,mc)=>s2+toUSD(+mc.amount||0,mc.currency||m.carsCurrency||m.currency),0),0),0);
  const withProject=db.cars.filter(c=>c.project).length;
  const lastExpense=db.cars.flatMap(c=>(c.expenses||[]).map(e=>({...e,carName:c.name}))).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0))[0];
  const carProjects=[...new Set(db.cars.map(c=>c.project).filter(Boolean))];
  acts.innerHTML=`<button class="btn" onclick="window._carSearch='';window._carProject='';renderCars(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-refresh"></i> تحديث</button><button class="btn" onclick="exportCarsExcel()"><i class="ti ti-file-spreadsheet"></i> تصدير Excel</button><button class="btn btn-primary" onclick="openCarModal()"><i class="ti ti-plus"></i> إضافة سيارة</button>`;
  el.innerHTML=`<div class="module-header"><div><div class="module-title"><i class="ti ti-car"></i> لائحة السيارات</div><div class="module-subtitle">متابعة السيارات، النمر، المشروع الحالي، ومصاريف البنزين والصيانة وغيرها.</div></div><div class="module-tools"><input class="form-control soft-input" placeholder="بحث بالسيارة أو النمرة أو المشروع..." value="${esc(window._carSearch||'')}" oninput="window._carSearch=this.value;renderCars(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><select class="form-control" onchange="window._carProject=this.value;renderCars(document.getElementById('main-content'),document.getElementById('topbar-actions'))" ${carProjects.length===0?'disabled':''}><option value="">كل المشاريع</option>${carProjects.map(p=>`<option value="${esc(p)}" ${pFilter===p?'selected':''}>${esc(p)}</option>`).join('')}</select></div></div>
  <div class="kpi-strip"><div class="kpi-mini"><div class="label">عدد السيارات</div><div class="value">${db.cars.length}</div></div><div class="kpi-mini"><div class="label">سيارات على مشاريع</div><div class="value">${withProject}</div></div><div class="kpi-mini"><div class="label">إجمالي المصاريف ($)</div><div class="value" style="color:var(--danger)">${fmtUSD(totalExpenses)}</div></div><div class="kpi-mini"><div class="label">آخر مصروف</div><div class="value" style="font-size:13px">${lastExpense?`${esc(lastExpense.carName)}<br><span class="muted">${fmt(lastExpense.amount)} ${curLabel(lastExpense.currency||'SYP')} - ${fmtDate(lastExpense.date)}</span>`:'—'}</div></div></div>
  ${bulkToolbar('cars')}
  <div class="card"><div style="overflow-x:auto">${!rows.length?`<div class="empty-state"><i class="ti ti-car"></i><p>لا يوجد سيارات مطابقة للبحث</p></div>`:`
    <table class="responsive-table"><thead><tr><th style="width:32px"><input type="checkbox" ${rows.length>0&&rows.every(c=>bSel('cars').has(c.id))?'checked':''} onchange='bulkToggleAll("cars",this,${esc(JSON.stringify(rows.map(c=>c.id)))})'></th><th>السيارة</th><th>النمرة</th><th>المشروع/المكان</th><th>الحركة (من - إلى)</th><th>تاريخ الحركة</th><th>إجمالي المصروف ($)</th><th>آخر مصروف</th><th>الأعمال المرتبطة</th><th>ملاحظات</th><th></th></tr></thead><tbody>
      ${rows.map(c=>{const linkedJobs=db.maintenance.filter(m=>(m.cars||[]).some(mc=>mc.carId===c.id));const jobsCost=linkedJobs.reduce((a,m)=>a+(m.cars||[]).filter(mc=>mc.carId===c.id).reduce((s2,mc)=>s2+toUSD(+mc.amount||0,mc.currency||m.carsCurrency||m.currency),0),0);const total=(c.expenses||[]).reduce((s,e)=>s+toUSD(+e.amount||0,e.currency),0)+jobsCost;const last=(c.expenses||[]).slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0))[0];const otherProjects=[...new Set([...linkedJobs.map(m=>m.projectName),...(c.expenses||[]).map(e=>e.project)].filter(p=>p&&p!==c.project))];return `<tr>
        <td data-label=""><input type="checkbox" ${bSel('cars').has(c.id)?'checked':''} onchange="bulkToggleRow('cars','${c.id}',this)"></td>
        <td data-label="السيارة" style="font-weight:700">${esc(c.name)}</td><td data-label="النمرة" class="nowrap">${esc(c.plate||'—')}</td><td data-label="المشروع/المكان">${esc(c.project||'—')}${otherProjects.length?`<br><span style="font-size:10px;color:var(--text2)">أيضاً: ${otherProjects.map(esc).join('، ')}</span>`:''}</td>
        <td data-label="الحركة (من - إلى)">${c.moveFrom || c.moveTo ? `${esc(c.moveFrom||'—')} ➔ ${esc(c.moveTo||'—')}` : '—'}</td>
        <td data-label="تاريخ الحركة">${fmtDate(c.moveDate) || '—'}</td>
        <td data-label="إجمالي المصروف ($)" style="font-weight:800;color:var(--accent-dark)">${fmtUSD(total)}</td><td data-label="آخر مصروف">${last?`${fmtDate(last.date)} - ${esc(last.type||'مصروف')} <span style="font-size:10px;color:var(--text2)">(${fmt(last.amount)} ${curLabel(last.currency||'SYP')})</span>`:'—'}</td>
        <td data-label="الأعمال المرتبطة" style="font-size:12px">${linkedJobs.length?`<b>${linkedJobs.length}</b> عمل — <span style="color:var(--info)">${fmtUSD(jobsCost)}</span>`:'—'}</td><td data-label="ملاحظات">${esc(c.notes||'')}</td>
        <td data-label=""><div class="row-menu-wrap">
          <button class="row-menu-btn" onclick="toggleRowMenu(this,event)">⋮</button>
          <div class="row-menu-list">
            <button class="row-menu-item" onclick="openCarExpenseModal('${c.id}')"><i class="ti ti-cash"></i> مصروف</button>
            <button class="row-menu-item" onclick="openCarModal('${c.id}')"><i class="ti ti-edit"></i> تعديل</button>
            <button class="row-menu-item danger" onclick="deleteItem('cars','${c.id}');renderCars(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-trash"></i> حذف</button>
          </div>
        </div></td>
      </tr>`;}).join('')}
    </tbody></table>`}</div><div class="table-note">يمكن تسجيل أكثر من مصروف لكل سيارة مع التاريخ والنوع والمشروع.</div></div>`;
}

function openCarModal(id=''){
  const c=db.cars.find(x=>x.id===id);
  showModal(`<div class="modal-title">${c?'تعديل سيارة':'إضافة سيارة'}</div>
    <div class="form-row cols-2"><div class="form-group"><label class="form-label">اسم السيارة</label><input class="form-control" id="car-name" value="${esc(c&&c.name||'')}"></div><div class="form-group"><label class="form-label">النمرة</label><input class="form-control" id="car-plate" value="${esc(c&&c.plate||'')}"></div></div>
    <div class="form-row cols-2"><div class="form-group"><label class="form-label">المشروع / المكان الحالي</label><select class="form-control" id="car-project">${projectOptions(c&&c.project||'')}</select></div><div class="form-group"><label class="form-label">ملاحظات عامة</label><input class="form-control" id="car-notes" value="${esc(c&&c.notes||'')}"></div></div>
    <div class="form-row cols-3">
      <div class="form-group"><label class="form-label">من (بداية الحركة)</label><input class="form-control" id="car-moveFrom" value="${esc(c&&c.moveFrom||'')}"></div>
      <div class="form-group"><label class="form-label">إلى (الوجهة)</label><input class="form-control" id="car-moveTo" value="${esc(c&&c.moveTo||'')}"></div>
      <div class="form-group"><label class="form-label">تاريخ الحركة</label><input type="date" class="form-control" id="car-moveDate" value="${c&&c.moveDate?c.moveDate:''}"></div>
    </div>
    <div class="form-group" style="margin-bottom:14px"><label class="form-label">ملاحظات الحركة</label><input class="form-control" id="car-moveNotes" value="${esc(c&&c.moveNotes||'')}"></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveCar('${id}')">حفظ</button></div>`);
}

function saveCar(id=''){
  const name=document.getElementById('car-name').value.trim();if(!name){alert('يرجى إدخال اسم السيارة');return;}
  const entry={
    id:id||uid(),
    name,
    plate:document.getElementById('car-plate').value,
    project:document.getElementById('car-project').value,
    notes:document.getElementById('car-notes').value,
    moveFrom:document.getElementById('car-moveFrom').value,
    moveTo:document.getElementById('car-moveTo').value,
    moveDate:document.getElementById('car-moveDate').value,
    moveNotes:document.getElementById('car-moveNotes').value,
    expenses:(db.cars.find(x=>x.id===id)||{}).expenses||[]
  };
  if(id){const i=db.cars.findIndex(x=>x.id===id);if(i>=0)db.cars[i]=entry;}else db.cars.push(entry);
  saveDB(db);closeModal();renderCars(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function openCarExpenseModal(id){
  const c=db.cars.find(x=>x.id===id);if(!c)return;
  const carExpTypes=(db.carExpenseTypes||defaultData.carExpenseTypes);
  const typeOpts=carExpTypes.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  showModal(`<div class="modal-title">إضافة مصروف سيارة: ${esc(c.name)}</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">المبلغ</label>
        <div style="display:flex;gap:4px">
          <input type="text" inputmode="decimal" class="form-control" id="ce-amount" placeholder="0" oninput="formatMoneyInput(this)">
          <select class="form-control" id="ce-currency" style="max-width:78px;padding:9px 4px;font-size:12px">
            <option value="SYP" selected>ل.س</option>
            <option value="USD">$</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label class="form-label">التاريخ</label><input type="date" class="form-control" id="ce-date" value="${localToday()}"></div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group">
        <label class="form-label">نوع المصروف</label>
        <select class="form-control" id="ce-type">${typeOpts}</select>
      </div>
      <div class="form-group"><label class="form-label">المشروع</label><select class="form-control" id="ce-project">${projectOptions(c.project||'')}</select></div>
    </div>
    <div class="form-group" style="margin-bottom:14px"><label class="form-label">ملاحظة إضافية</label><input class="form-control" id="ce-note" placeholder="تفاصيل إضافية..."></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveCarExpense('${id}')">حفظ المصروف</button></div>`);
}

function saveCarExpense(id){const c=db.cars.find(x=>x.id===id);if(!c)return;const amount=unformatNum(document.getElementById('ce-amount').value);if(!(amount>0)){alert('يرجى إدخال مبلغ صحيح أكبر من صفر');return;}const curEl=document.getElementById('ce-currency');const currency=curEl&&curEl.value==='USD'?'USD':'SYP';c.expenses=c.expenses||[];c.expenses.push({id:uid(),amount:amount,currency:currency,date:document.getElementById('ce-date').value,type:document.getElementById('ce-type').value,project:document.getElementById('ce-project').value,note:document.getElementById('ce-note').value});if(document.getElementById('ce-project').value)c.project=document.getElementById('ce-project').value;saveDB(db);closeModal();renderCars(document.getElementById('main-content'),document.getElementById('topbar-actions'));}

function exportLoansExcel(){
  const headers=['النوع','الصنف','الكمية','اسم الشخص','التاريخ','الحالة','ملاحظات'];
  const rows=db.loans.slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).map(l=>[
    l.type||'عدة',l.item||'',l.qty||1,l.person||'',l.date||'',l.returned?'مرجعة':'معارة',l.notes||''
  ]);
  exportRowsToExcel('الإعارة_والاستلام','الإعارة والاستلام',headers,rows);
}

function renderLoans(el,acts){
  const q=(window._loanSearch||'').trim().toLowerCase();
  const tFilter=window._loanType||'all';
  const sFilter=window._loanStatus||'all';
  const rows=db.loans.filter(l=>{
    if(tFilter!=='all'&&(l.type||'عدة')!==tFilter)return false;
    if(sFilter!=='all'&&(sFilter==='returned'?!l.returned:!!l.returned))return false;
    if(q&&![l.item,l.person,l.notes].join(' ').toLowerCase().includes(q))return false;
    return true;
  }).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  acts.innerHTML=`<button class="btn btn-primary" onclick="openLoanModal()"><i class="ti ti-plus"></i> إضافة إعارة</button><button class="btn" onclick="exportLoansExcel()"><i class="ti ti-file-spreadsheet"></i> تصدير Excel</button>`;
  el.innerHTML=`
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">
      <div class="form-group">
        <label class="form-label">بحث</label>
        <input type="text" class="form-control" style="width:200px" placeholder="الصنف أو الشخص..." value="${esc(window._loanSearch||'')}" oninput="window._loanSearch=this.value;renderLoans(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
      </div>
      <div class="form-group">
        <label class="form-label">النوع</label>
        <select class="form-control" style="width:140px" onchange="window._loanType=this.value;renderLoans(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
          <option value="all" ${tFilter==='all'?'selected':''}>الكل</option>
          <option value="عدة" ${tFilter==='عدة'?'selected':''}>عدة</option>
          <option value="مواد" ${tFilter==='مواد'?'selected':''}>مواد</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">الحالة</label>
        <select class="form-control" style="width:140px" onchange="window._loanStatus=this.value;renderLoans(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
          <option value="all" ${sFilter==='all'?'selected':''}>الكل</option>
          <option value="returned" ${sFilter==='returned'?'selected':''}>مرجعة</option>
          <option value="out" ${sFilter==='out'?'selected':''}>معارة</option>
        </select>
      </div>
      ${(q||tFilter!=='all'||sFilter!=='all')?`<div class="form-group" style="padding-bottom:6px"><button class="btn btn-sm" onclick="window._loanSearch='';window._loanType='all';window._loanStatus='all';renderLoans(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-filter-off"></i> مسح الفلاتر</button></div>`:''}
      <div style="font-size:12px;color:var(--text2);padding-bottom:6px;margin-right:auto">${rows.length} إعارة</div>
    </div>
  </div>
  ${bulkToolbar('loans',`
    <button class="btn btn-sm" style="background:#fff;color:#1B7A43;border-color:#86efac" onclick="bulkLoanReturned(true)"><i class="ti ti-check"></i> تحديد كـ مرجعة</button>
    <button class="btn btn-sm" style="background:#fff" onclick="bulkLoanReturned(false)"><i class="ti ti-clock"></i> تحديد كـ معارة</button>
  `)}
  <div class="card"><div style="overflow-x:auto">${!rows.length?`<div class="empty-state"><i class="ti ti-transfer"></i><p>لا يوجد إعارات ${(q||tFilter!=='all'||sFilter!=='all')?'بهذا الفلتر':'مسجلة بعد'}</p></div>`:`
    <table class="responsive-table"><thead><tr><th style="width:32px"><input type="checkbox" ${rows.length>0&&rows.every(l=>bSel('loans').has(l.id))?'checked':''} onchange='bulkToggleAll("loans",this,${esc(JSON.stringify(rows.map(l=>l.id)))})'></th><th>النوع</th><th>الصنف</th><th>الكمية</th><th>اسم الشخص</th><th>التاريخ</th><th>الحالة</th><th>ملاحظات</th><th></th></tr></thead><tbody>
      ${rows.map(l=>`<tr><td data-label=""><input type="checkbox" ${bSel('loans').has(l.id)?'checked':''} onchange="bulkToggleRow('loans','${l.id}',this)"></td><td data-label="النوع">${esc(l.type||'عدة')}</td><td data-label="الصنف" style="font-weight:700">${esc(l.item||'')}</td><td data-label="الكمية">${esc(l.qty||1)}</td><td data-label="اسم الشخص">${esc(l.person||'')}</td><td data-label="التاريخ">${fmtDate(l.date)}</td><td data-label="الحالة"><span class="badge ${l.returned?'badge-green':'badge-amber'}">${l.returned?'مرجعة':'معارة'}</span></td><td data-label="ملاحظات">${esc(l.notes||'')}</td><td data-label=""><div class="row-menu-wrap"><button class="row-menu-btn" onclick="toggleRowMenu(this,event)">⋮</button><div class="row-menu-list"><button class="row-menu-item" onclick="toggleLoanReturned('${l.id}')"><i class="ti ti-refresh"></i> ${l.returned?'إلغاء الترجيع':'ترجيع'}</button><button class="row-menu-item" onclick="openLoanModal('${l.id}')"><i class="ti ti-edit"></i> تعديل</button><button class="row-menu-item danger" onclick="deleteItem('loans','${l.id}')"><i class="ti ti-trash"></i> حذف</button></div></div></td></tr>`).join('')}
    </tbody></table>`}</div></div>`;
}

function bulkLoanReturned(returned){
  const s=bSel('loans');
  if(s.size===0)return;
  if(!confirm(`تأكيد تحديد ${s.size} إعارة كـ "${returned?'مرجعة':'معارة'}"؟`))return;
  db.loans.forEach(l=>{if(s.has(l.id))l.returned=returned;});
  saveDB(db);
  s.clear();
  rerenderPage('loans');
}

function openLoanModal(id=''){
  const l=db.loans.find(x=>x.id===id);
  const personName=(l&&l.person||'').trim();
  const isKnownWorker=db.workers.some(w=>w.name.trim()===personName);
  const isKnownClient=db.clients.some(c=>c.name.trim()===personName);
  const isOther=personName&&!isKnownWorker&&!isKnownClient;
  showModal(`<div class="modal-title">${l?'تعديل إعارة':'إضافة إعارة'}</div>
    <div class="form-row cols-3"><div class="form-group"><label class="form-label">النوع</label><select class="form-control" id="loan-type"><option ${!l||l.type==='عدة'?'selected':''}>عدة</option><option ${l&&l.type==='مواد'?'selected':''}>مواد</option></select></div><div class="form-group"><label class="form-label">الصنف المعار</label><input class="form-control" id="loan-item" value="${esc(l&&l.item||'')}"></div><div class="form-group"><label class="form-label">الكمية</label><input type="number" class="form-control" id="loan-qty" value="${esc(l&&l.qty||1)}"></div></div>
    <div class="form-row cols-2">
      <div class="form-group">
        <label class="form-label">اسم الشخص</label>
        <select class="form-control" id="loan-person-select" onchange="document.getElementById('loan-person-other-wrap').style.display=this.value==='__other__'?'':'none'">
          <option value="">— اختر —</option>
          ${db.workers.length?`<optgroup label="العمال">${db.workers.map(w=>`<option value="${esc(w.name)}" ${personName===w.name.trim()?'selected':''}>${esc(w.name)}</option>`).join('')}</optgroup>`:''}
          ${db.clients.length?`<optgroup label="العملاء">${db.clients.map(c=>`<option value="${esc(c.name)}" ${personName===c.name.trim()?'selected':''}>${esc(c.name)}</option>`).join('')}</optgroup>`:''}
          <option value="__other__" ${isOther?'selected':''}>شخص آخر (اكتب الاسم)...</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">التاريخ</label><input type="date" class="form-control" id="loan-date" value="${esc(l&&l.date||localToday())}"></div>
    </div>
    <div class="form-group" id="loan-person-other-wrap" style="display:${isOther?'':'none'};margin-top:-8px">
      <label class="form-label">اسم الشخص الآخر</label>
      <input class="form-control" id="loan-person-other" placeholder="اكتب الاسم..." value="${isOther?esc(personName):''}">
    </div>
    <div class="form-row cols-2"><div class="form-group"><label class="form-label">الحالة</label><select class="form-control" id="loan-returned"><option value="false" ${!l||!l.returned?'selected':''}>معارة</option><option value="true" ${l&&l.returned?'selected':''}>مرجعة</option></select></div><div class="form-group"><label class="form-label">ملاحظات</label><input class="form-control" id="loan-notes" value="${esc(l&&l.notes||'')}"></div></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveLoan('${id}')">حفظ</button></div>`);
}

function saveLoan(id=''){
  const item=document.getElementById('loan-item').value.trim();
  if(!item){alert('يرجى إدخال الصنف المعار');return;}
  const personSel=document.getElementById('loan-person-select').value;
  const person=(personSel==='__other__'?(document.getElementById('loan-person-other').value||'').trim():personSel);
  if(!person){alert('يرجى اختيار أو إدخال اسم الشخص');return;}
  const entry={id:id||uid(),type:document.getElementById('loan-type').value,item,qty:+document.getElementById('loan-qty').value||1,person,date:document.getElementById('loan-date').value,returned:document.getElementById('loan-returned').value==='true',notes:document.getElementById('loan-notes').value};
  if(id){const i=db.loans.findIndex(x=>x.id===id);if(i>=0)db.loans[i]=entry;}else db.loans.push(entry);
  saveDB(db);closeModal();renderLoans(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function toggleLoanReturned(id){const l=db.loans.find(x=>x.id===id);if(l){l.returned=!l.returned;saveDB(db);renderLoans(document.getElementById('main-content'),document.getElementById('topbar-actions'));}}
