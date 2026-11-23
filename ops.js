/* ops.js — يتحمّل عند فتح: الصيانة / المبيعات / عروض الأسعار / المشاريع / التقارير / العملاء */
function renderMaintenance(el,acts){
  acts.innerHTML=`<button class="btn btn-primary" onclick="openMaintenanceModal()"><i class="ti ti-plus"></i> عمل جديد</button><button class="btn" onclick="openGroupedInvoiceModal()"><i class="ti ti-file-invoice"></i> فاتورة مجمّعة للعميل</button><button class="btn" onclick="exportMaintenanceExcel()"><i class="ti ti-file-spreadsheet"></i> تصدير Excel</button>`;
  const filter=window._mF||'all';
  const cFilter=window._mC||'';
  const bFilter=window._mB||'';
  const wFilter=window._mW2||'';
  const dFilter=window._mD||'all';
const kFilter=window._mK||'all';
  const filtered=db.maintenance.filter(m=>{
    if(filter!=='all'&&m.status!==filter)return false;
    if(cFilter&&m.clientId!==cFilter)return false;
    if(bFilter&&m.branch!==bFilter)return false;
    if(wFilter&&(!m.workers||!m.workers.some(w=>w.workerId===wFilter)))return false;
    if(dFilter!=='all'&&(m.deliveryStatus==='مسلمة'?'مسلمة':'معلقة')!==dFilter)return false;
    if(kFilter!=='all'&&(m.workKind||'none')!==kFilter)return false;
    return true;
  });
  // Get branches for selected client
  const selClientForBranch=cFilter?db.clients.find(c=>c.id===cFilter):null;
  const availBranches=selClientForBranch&&selClientForBranch.branches?selClientForBranch.branches:
    [...new Set(db.maintenance.filter(m=>!cFilter||m.clientId===cFilter).map(m=>m.branch).filter(Boolean))];
  window._mSel=window._mSel||new Set();
  const selCount=[...window._mSel].filter(id=>filtered.some(m=>m.id===id)).length;
  const tIncome=filtered.reduce((s,x)=>s+toUSD(getMaintenanceIncome(x),x.currency),0);
  const tWages=filtered.reduce((s,x)=>s+toUSD(getMaintenanceWages(x),x.currency),0);
  const tExpenses=filtered.reduce((s,x)=>s+toUSD(getMaintenanceExpenses(x),x.currency),0);
  const tMaintProfit=filtered.reduce((s,x)=>s+toUSD(getMaintenanceProfit(x),x.currency),0);
  el.innerHTML=`
  <div class="grid-4" style="margin-bottom:18px">
    <div class="metric-card"><div class="metric-label">إجمالي أجور الأعمال <span style="font-size:9px;color:var(--text2);font-weight:400">(بالدولار)</span></div><div class="metric-value blue">${finValUSD(tIncome)}</div></div>
    <div class="metric-card"><div class="metric-label">أجور العمال <span style="font-size:9px;color:var(--text2);font-weight:400">(بالدولار)</span></div><div class="metric-value red">${finValUSD(tWages,'salary')}</div></div>
    <div class="metric-card"><div class="metric-label">مصاريف الأعمال <span style="font-size:9px;color:var(--text2);font-weight:400">(بالدولار)</span></div><div class="metric-value red">${finValUSD(tExpenses)}</div></div>
    <div class="metric-card"><div class="metric-label">ربح الأعمال <span style="font-size:10px;color:var(--text2);font-weight:400">(لحالها، بدون مبيعات، بالدولار)</span></div><div class="metric-value ${tMaintProfit>=0?'green':'red'}">${finValUSD(tMaintProfit,'profit')}</div></div>
  </div>
  <div class="grid-4" style="margin-bottom:18px">
    <div class="metric-card"><div class="metric-label">مصاريف عامة <span style="font-size:9px;color:var(--text2);font-weight:400">(شراء عدة ومستهلكات، غير مربوطة بشغلة، بالدولار)</span></div><div class="metric-value red">${finValUSD(generalExpensesTotalUSD())}</div></div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">
      <div class="form-group">
        <label class="form-label">الحالة</label>
        <select class="form-control" style="width:150px" onchange="window._mF=this.value;window._maintPageSize=50;renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
          <option value="all" ${filter==='all'?'selected':''}>الكل</option>
          <option value="مجدولة" ${filter==='مجدولة'?'selected':''}>مجدولة</option>
          <option value="جارية" ${filter==='جارية'?'selected':''}>جارية</option>
          <option value="مؤجلة" ${filter==='مؤجلة'?'selected':''}>مؤجلة</option>
          <option value="مكتملة" ${filter==='مكتملة'?'selected':''}>مكتملة</option>
          <option value="ملغاة" ${filter==='ملغاة'?'selected':''}>ملغاة</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">العميل</label>
        <select class="form-control" style="width:200px" onchange="window._mC=this.value;window._mB='';window._maintPageSize=50;renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
          <option value="">الكل</option>
          ${db.clients.map(c=>`<option value="${c.id}" ${cFilter===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">الفرع</label>
        <select class="form-control" style="width:170px" onchange="window._mB=this.value;window._maintPageSize=50;renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'))" ${availBranches.length===0?'disabled':''}>
          <option value="">الكل</option>
          ${availBranches.map(b=>`<option value="${esc(b)}" ${bFilter===b?'selected':''}>${esc(b)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">التصنيف</label>
        <select class="form-control" style="width:130px" onchange="window._mK=this.value;window._maintPageSize=50;renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
          <option value="all" ${kFilter==='all'?'selected':''}>الكل</option>
          ${Object.keys(WORK_KINDS).map(k=>`<option value="${k}" ${kFilter===k?'selected':''}>${WORK_KINDS[k]}</option>`).join('')}
          <option value="none" ${kFilter==='none'?'selected':''}>غير محدد</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">التسليم</label>
        <select class="form-control" style="width:150px" onchange="window._mD=this.value;window._maintPageSize=50;renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
          <option value="all" ${dFilter==='all'?'selected':''}>الكل</option>
          <option value="مسلمة" ${dFilter==='مسلمة'?'selected':''}>مسلمة</option>
          <option value="معلقة" ${dFilter==='معلقة'?'selected':''}>معلقة</option>
        </select>
      </div>
      ${(cFilter||bFilter||dFilter!=='all'||filter!=='all')?`<div class="form-group" style="padding-bottom:6px"><button class="btn btn-sm" onclick="window._mF='all';window._mC='';window._mB='';window._mD='all';window._maintPageSize=50;renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-filter-off"></i> مسح الفلاتر</button></div>`:''}
      <div style="font-size:12px;color:var(--text2);padding-bottom:6px;margin-right:auto">${filtered.length} عمل</div>
    </div>
  </div>
  ${selCount>0?`
  <div class="card" style="margin-bottom:16px;background:var(--accent-light);border-color:var(--accent)">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <div style="font-weight:700;font-size:13px;color:var(--accent-dark)"><i class="ti ti-checkbox"></i> محدد: ${selCount} عمل</div>
      <button class="btn btn-sm" style="background:var(--surface)" onclick="bulkMaintDelivery('مسلمة')"><i class="ti ti-truck-delivery"></i> تحديد كـ مسلمة</button>
      <button class="btn btn-sm" style="background:var(--surface)" onclick="bulkMaintDelivery('معلقة')"><i class="ti ti-clock"></i> تحديد كـ معلقة</button>
      <button class="btn btn-sm" style="background:var(--surface);color:var(--success);border-color:var(--success)" onclick="bulkMaintPayment(true)"><i class="ti ti-cash"></i> تحديد كـ مسددة (كامل)</button>
      <button class="btn btn-sm" style="background:var(--surface);color:var(--danger);border-color:var(--danger)" onclick="bulkMaintPayment(false)"><i class="ti ti-cash-off"></i> تحديد كـ غير مدفوعة</button>
      <button class="btn btn-sm" style="background:var(--surface);color:var(--accent-dark);border-color:var(--accent)" onclick="bulkPrintMaint(true)"><i class="ti ti-printer"></i> طباعة بالأسعار</button>
      <button class="btn btn-sm" style="background:var(--surface);color:var(--info);border-color:var(--info)" onclick="bulkPrintMaint(false)"><i class="ti ti-file-invoice"></i> طباعة بدون أسعار</button>
      <button class="btn btn-sm" style="background:var(--surface);color:var(--danger);border-color:var(--danger)" onclick="bulkMaintDelete()"><i class="ti ti-trash"></i> حذف المحدد</button>
      <button class="btn btn-sm" style="background:var(--surface);margin-inline-start:auto" onclick="window._mSel=new Set();renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-x"></i> إلغاء التحديد</button>
    </div>
  </div>`:''}
  <div class="card">
    ${filtered.length===0?`<div class="empty-state"><i class="ti ti-tool"></i><p>لا يوجد أعمال بهذا الفلتر</p></div>`:`
    <div style="overflow-x:auto">
    <table class="responsive-table maint-table">
      <thead><tr>
        <th style="width:32px"><input type="checkbox" ${filtered.length>0&&filtered.every(m=>window._mSel.has(m.id))?'checked':''} onchange="toggleMaintSelectAll(this)"></th>
        <th>العميل / الفرع</th><th>نوع العمل</th><th style="width:150px;">وصف العمل</th><th>تاريخ البدء</th><th>الانتهاء</th><th>العمال والأيام</th><th>الأجر الكلي</th><th>أجور العمال</th><th>مصاريف</th><th>الربح</th><th>الحالة</th><th>التسليم</th><th>الحالة المالية</th><th>ملاحظات</th><th></th>
      </tr></thead>
      <tbody>
        ${(()=>{const sortedM=filtered.slice().sort((a,b)=>new Date(b.startDate||0)-new Date(a.startDate||0));const pageSize=window._maintPageSize||50;return sortedM.slice(0,pageSize);})().map(m=>{
          const totalIncome=getMaintenanceIncome(m);
          const totalWages=getMaintenanceWages(m);
          const totalExpenses=getMaintenanceExpenses(m);
          const profit=getMaintenanceProfit(m);
          return `<tr>
            <td data-label=""><input type="checkbox" ${window._mSel.has(m.id)?'checked':''} onchange="toggleMaintRowSelect('${m.id}',this)"></td>
            <td data-label="العميل / الفرع"><div style="font-weight:600">${esc(getClientName(m.clientId))}</div><div style="font-size:11px;color:var(--text2)">${esc(m.branch||'')}</div></td>
            <td data-label="نوع العمل" style="font-size:12px">${m.workTypes?m.workTypes.join('، '):'—'}</td>
            <td data-label="وصف العمل" style="font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(m.workDesc||'')}">${esc(m.workDesc||'—')}</td>
            <td data-label="تاريخ البدء">${fmtDate(m.startDate)}</td>
            <td data-label="الانتهاء">${fmtDate(m.endDate)}</td>
            <td data-label="العمال والأيام" style="font-size:12px">${m.workers?m.workers.map(w=>`<div>${esc(maskWorkerName(w.workerName))} <b>${w.days||1}</b>ي <span style="color:var(--text2)">${fmtDate(w.date)}</span></div>`).join(''):' — '}</td>
            <td data-label="الأجر الكلي" style="font-weight:700;color:var(--accent)">${finVal(totalIncome)} <span style="font-size:10px;color:var(--text2)">${curLabel(m.currency)}</span></td>
            <td data-label="أجور العمال" style="font-weight:700;color:var(--salary)">${finVal(totalWages,'salary')} <span style="font-size:10px;color:var(--text2)">${curLabel(m.currency)}</span></td>
            <td data-label="مصاريف" style="font-weight:700;color:var(--info);font-size:12px">${(m.expenses&&m.expenses.length)||(m.cars&&m.cars.length)?(canViewTotals()?`<div>${fmt(totalExpenses)}</div><div style="font-weight:400;color:var(--text2)">${[...(m.expenses||[]).map(e=>`${esc(e.type||'مصروف')}: ${fmt(e.amount)} ${curLabel(e.currency||m.expensesCurrency||m.currency)}`),...(m.cars||[]).map(c=>`<i class="ti ti-car"></i> ${esc(c.carName||'سيارة')}: ${fmt(c.amount)} ${curLabel(c.currency||m.carsCurrency||m.currency)}`)].join('<br>')}</div>`:'••••'):'—'}</td>
            <td data-label="الربح" style="font-weight:800;color:${profit>=0?'var(--accent)':'var(--danger)'}">${finVal(profit,'profit')}</td>
            <td data-label="الحالة"><span class="badge ${m.status==='مكتملة'?'badge-green':m.status==='ملغاة'?'badge-red':'badge-amber'}">${esc(m.status||'جارية')}</span>${m.workKind&&WORK_KINDS[m.workKind]?` <span class="badge" style="font-size:10px">${WORK_KINDS[m.workKind]}</span>`:''}</td>
            <td data-label="التسليم">${m.deliveryStatus==='مسلمة'?`<span class="badge badge-green" style="cursor:pointer" title="اضغط للتراجع عن التسليم" onclick="toggleMaintDelivery('${m.id}')">مسلمة<br><span style="font-weight:400;font-size:10px">${fmtDate(m.deliveryDate)}</span></span>`:`<span class="badge badge-gray" style="cursor:pointer" title="اضغط لتسجيل التسليم" onclick="toggleMaintDelivery('${m.id}')">معلقة</span>`}</td>
            <td data-label="الحالة المالية">${maintStatusBadge(m)}</td>
            <td data-label="ملاحظات" style="font-size:11px;color:var(--text2);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(m.notes||'')}">${esc(m.notes||'—')}</td>
            <td data-label=""><div class="row-menu-wrap">
              <button class="row-menu-btn" onclick="toggleRowMenu(this,event)">⋮</button>
              <div class="row-menu-list">
                <button class="row-menu-item" onclick="openMaintenanceModal('${m.id}')"><i class="ti ti-edit"></i> تعديل</button>
                <button class="row-menu-item" onclick="duplicateMaintenance('${m.id}')"><i class="ti ti-copy"></i> نسخ كعمل جديد</button>
                <button class="row-menu-item" onclick="openMaintPaymentModal('${m.id}')"><i class="ti ti-cash"></i> تسديد دفعة</button>
                ${maintReferralCommission(m)>0?(m.commissionPaid?
                  `<button class="row-menu-item green" title="بتاريخ ${fmtDate(m.commissionPaidDate)}" onclick="if(confirm('التراجع عن تسديد العمولة لهذا العمل؟'))unpayMaintCommission('${m.id}')"><i class="ti ti-user-check"></i> عمولة مدفوعة (${fmt(maintReferralCommission(m))}) — تراجع</button>`
                  :`<button class="row-menu-item gold" onclick="if(confirm('تأكيد تسديد العمولة (${fmt(maintReferralCommission(m))})؟'))payMaintCommission('${m.id}')"><i class="ti ti-user-exclamation"></i> تسديد عمولة (${fmt(maintReferralCommission(m))})</button>`
                ):''}
                ${(()=>{const cl=db.clients.find(c=>c.id===m.clientId);return cl&&cl.referrerName?`<button class="row-menu-item" onclick="openEditCommissionModal('maintenance','${m.id}')"><i class="ti ti-percentage"></i> تعديل العمولة</button>`:'';})()}
                <button class="row-menu-item" onclick="printMaintInvoice('${m.id}',true)"><i class="ti ti-printer"></i> طباعة بالأسعار</button>
                <button class="row-menu-item" onclick="printMaintInvoice('${m.id}',false)"><i class="ti ti-file-invoice"></i> طباعة بدون أسعار</button>
                <button class="row-menu-item danger" onclick="deleteItem('maintenance','${m.id}')"><i class="ti ti-trash"></i> حذف</button>
              </div>
            </div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>
    ${filtered.length>(window._maintPageSize||50)?`<div style="text-align:center;padding:14px"><button class="btn" onclick="window._maintPageSize=(window._maintPageSize||50)+50;renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-chevron-down"></i> تحميل المزيد (${filtered.length-(window._maintPageSize||50)} متبقي)</button></div>`:''}`}
  </div>`;
}

function duplicateMaintenance(id){
  const orig=db.maintenance.find(x=>x.id===id);
  if(!orig)return;
  const today=localToday();
  const seed=JSON.parse(JSON.stringify(orig));
  delete seed.id;
  seed.startDate=today;
  seed.endDate='';
  seed.invoiceNo='';
  seed.paidAmount=0;
  seed.payments=[];
  seed.status='جارية';
  seed.deliveryStatus='معلقة';
  seed.deliveryDate='';
  seed.commissionPaid=false;
  seed.commissionPaidDate='';
  seed.advances=[];
  if(seed.workers)seed.workers=seed.workers.map(w=>({...w,date:today,paid:false,paidDate:''}));
  if(seed.expenses)seed.expenses=seed.expenses.map(e=>({...e,date:today}));
  openMaintenanceModal(null,seed);
}

function openMaintenanceModal(editId,seed){
  const m=editId?db.maintenance.find(x=>x.id===editId):(seed||null);
  chargesInit(m,'m');
  window._mWCur=m&&m.workersCurrency==='USD'?'USD':'SYP';
  window._mECur=m&&m.expensesCurrency==='USD'?'USD':'SYP';
  // كل بند (عامل/مصروف) له عملته الخاصة الآن. السجلات القديمة لم تكن تخزن عملة لكل بند،
  // فنستخدم عملة المجموعة السابقة (workersCurrency/expensesCurrency) كقيمة افتراضية لها فقط.
  window._mW=m&&m.workers?JSON.parse(JSON.stringify(m.workers)).map(w=>({...w,currency:w.currency||window._mWCur})):[];
  window._mE=m&&m.expenses?JSON.parse(JSON.stringify(m.expenses)).map(e=>({...e,currency:e.currency||window._mECur})):[];
  window._mCarsCur=m&&m.carsCurrency==='USD'?'USD':'SYP';
  window._mCars=m&&m.cars?JSON.parse(JSON.stringify(m.cars)).map(c=>({...c,currency:c.currency||window._mCarsCur})):[];
  window._mAdvCur=m&&m.currency==='USD'?'USD':'SYP';
  window._mAdv=m&&m.advances?JSON.parse(JSON.stringify(m.advances)).map(a=>({...a,currency:a.currency||window._mAdvCur})):[];
  window._mWI=m&&m.workItems&&m.workItems.length?JSON.parse(JSON.stringify(m.workItems)):(m&&(m.workDesc||(m.workTypes&&m.workTypes.length))?[{type:(m.workTypes&&m.workTypes[0])||'',desc:m.workDesc||'',qty:1,price:getMaintenanceTotal(m)||''}]:[{type:'',desc:'',qty:1,price:''}]);
  const cOpts=db.clients.map(c=>`<option value="${esc(c.name)}"></option>`).join('');
  showModal(`
    <div class="modal-title">${editId?'تعديل عمل':(seed?'نسخ عمل — عمل جديد':'عمل جديد')}</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">العميل <span style="font-size:11px;color:var(--text2);font-weight:400">(اكتب اسماً جديداً لإضافته تلقائياً)</span></label>
        <input type="text" class="form-control" id="m-client-name" list="m-client-list"
          value="${m&&m.clientId?getClientName(m.clientId):m&&m.clientNameFree?m.clientNameFree:''}"
          placeholder="اكتب اسم العميل أو اختر من القائمة"
          autocomplete="off" oninput="updateBranches()">
        <datalist id="m-client-list">${cOpts}</datalist>
        <div id="m-client-phone-wrap" style="display:none;margin-top:6px"><input type="text" class="form-control" id="m-client-phone" placeholder="رقم هاتف العميل الجديد (اختياري)"></div>
      </div>
      <div class="form-group"><label class="form-label">الفرع</label><select class="form-control" id="m-branch"></select></div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">المشروع <span style="font-size:11px;color:var(--text2);font-weight:400">(لربط كلفة العمال بالمشروع — اختياري)</span></label>${projectInputHTML('m-project',m&&m.projectName||'')}</div>
    </div>
    <div class="form-row cols-3">
      <div class="form-group"><label class="form-label">تاريخ البدء</label><input type="date" class="form-control" id="m-start" value="${m&&m.startDate?m.startDate:''}"></div>
      <div class="form-group"><label class="form-label">تاريخ الانتهاء</label><input type="date" class="form-control" id="m-end" value="${m&&m.endDate?m.endDate:''}"></div>
      <div class="form-group"><label class="form-label">فاتورة رقم <span style="font-size:11px;color:var(--text2);font-weight:400">(تلقائي)</span></label><input type="text" class="form-control" id="m-invoice" value="${m&&m.invoiceNo?m.invoiceNo:genInvoiceNo('WRK',db.maintenance)}" readonly style="background:var(--bg2)"></div>
      <div class="form-group"><label class="form-label">عملة الفاتورة</label>${currencySelectHTML('m-currency',m&&m.currency?m.currency:'SYP')}</div>
    </div>
    <div class="form-group" style="margin-bottom:14px">
      <label class="form-label">أعمال هذه الفاتورة <span style="font-size:11px;color:var(--text2);font-weight:400">(سطر لكل عمل)</span></label>
      <div style="font-size:11px;color:var(--text2);margin:-2px 0 8px">💡 مبلغ مقطوع؟ اختر "مبلغ ثابت / مشاركة عمل".</div>
      <div id="work-items-list">${renderWorkItemEntries()}</div>
      <button type="button" class="btn btn-sm" onclick="addWorkItemEntry()"><i class="ti ti-plus"></i> إضافة عمل</button>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">التصنيف</label>
        <select class="form-control" id="m-kind">
          <option value="" ${!m||!m.workKind?'selected':''}>غير محدد</option>
          ${Object.keys(WORK_KINDS).map(k=>`<option value="${k}" ${m&&m.workKind===k?'selected':''}>${WORK_KINDS[k]}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">الحالة <span style="font-size:11px;color:var(--text2);font-weight:400">(حالة الشغل فقط)</span></label>
        <select class="form-control" id="m-status">
          <option ${m&&m.status==='مجدولة'?'selected':''}>مجدولة</option>
          <option ${!m||m.status==='جارية'?'selected':''}>جارية</option>
          <option ${m&&m.status==='مؤجلة'?'selected':''}>مؤجلة</option>
          <option ${m&&m.status==='مكتملة'?'selected':''}>مكتملة</option>
          <option ${m&&m.status==='ملغاة'?'selected':''}>ملغاة</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">الحالة المالية</label>
        <div class="form-control" style="background:var(--bg2);display:flex;align-items:center;font-size:12px;color:var(--text2)">${editId?'المسدد: '+fmt(m.paidAmount||0)+' — يُدار من زر "تسديد دفعة" بالجدول':'يُدار بعد الحفظ من زر "تسديد دفعة"'}</div>
      </div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">حالة التسليم <span style="font-size:11px;color:var(--text2);font-weight:400">(هل تم تسليم العمل للعميل؟)</span></label>
        <select class="form-control" id="m-delivery-status" onchange="document.getElementById('m-delivery-date-wrap').style.display=this.value==='مسلمة'?'flex':'none'; if(this.value==='مسلمة' && !document.getElementById('m-delivery-date').value) document.getElementById('m-delivery-date').value=localToday();">
          <option value="معلقة" ${!m||m.deliveryStatus!=='مسلمة'?'selected':''}>معلقة (لم تُسلَّم بعد)</option>
          <option value="مسلمة" ${m&&m.deliveryStatus==='مسلمة'?'selected':''}>مسلمة</option>
        </select>
      </div>
      <div class="form-group" id="m-delivery-date-wrap" style="display:${m&&m.deliveryStatus==='مسلمة'?'flex':'none'}">
        <label class="form-label">تاريخ التسليم</label>
        <input type="date" class="form-control" id="m-delivery-date" value="${m&&m.deliveryDate?m.deliveryDate:''}">
      </div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">الأجر الكلي <span style="font-size:11px;color:var(--text2);font-weight:400">(تلقائي)</span></label><input type="text" class="form-control" id="m-workamount" value="${fmt(m?getMaintenanceTotal(m):(window._mWI||[]).reduce((s,it)=>s+(+it.price||0),0))}" readonly style="background:var(--bg2)"></div>
    </div>
    <div class="form-row cols-3">
      <div class="form-group"><label class="form-label">نسبة الحسم (%)</label><input type="number" min="0" max="100" step="any" class="form-control" id="m-discount" value="${m&&m.discount?m.discount:''}" oninput="refreshWorkItemsTotal()"></div>
      <div class="form-group" style="grid-column: span 2;"><label class="form-label">الإجمالي قبل الحسم</label><input type="text" class="form-control" id="m-rawamount" value="${fmt((window._mWI||[]).reduce((s,it)=>s+(+it.price||0)*(+it.qty||1),0))}" readonly style="background:var(--bg2)"></div>
    </div>
    ${chargesBlockHTML()}
    <div class="form-row cols-3" id="m-commission-wrap" style="display:none">
      <div class="form-group">
        <label class="form-label" style="color:var(--gold-dark)">العمولة <i class="ti ti-user-check"></i></label>
        <div style="display:flex;gap:10px;margin-bottom:6px">
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="radio" name="m-commission-type" value="percent" ${!m||m.commissionType!=='amount'?'checked':''} onchange="refreshMaintenanceTotals()"> نسبة %</label>
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="radio" name="m-commission-type" value="amount" ${m&&m.commissionType==='amount'?'checked':''} onchange="refreshMaintenanceTotals()"> مبلغ ثابت</label>
        </div>
        <input type="number" class="form-control" id="m-commission" value="${m&&m.commissionType==='amount'?(m.commissionAmount||''):(m&&m.commissionPercent?m.commissionPercent:'')}" min="0" step="0.5" placeholder="مثال: 15" oninput="refreshMaintenanceTotals()">
      </div>
      <div class="form-group" style="grid-column: span 2;display:flex;align-items:flex-end"><div style="font-size:11px;color:var(--text2)" id="m-commission-hint"></div></div>
      <div class="form-group" style="grid-column: span 3">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--gold-dark);cursor:pointer">
          <input type="checkbox" id="m-commission-settlement" ${m&&m.commissionSettlement?'checked':''}>
          تسوية يدوية (مش عمولة حقيقية — هالمبلغ رح يُخصم من الربح متل العادة، بس ما رح يُحتسب ضمن تقارير/متوسطات العمولة)
        </label>
      </div>
    </div>
    <div class="form-group" style="margin-bottom:14px"><label class="form-label">ملاحظات</label><textarea class="form-control" id="m-notes" rows="2" placeholder="كل سطر = ملاحظة، وبتترقم تلقائياً بالطباعة">${esc(m&&m.notes?m.notes:'')}</textarea></div>
    <div style="font-weight:700;font-size:13px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <span>أجور العمال</span>
      <span style="display:flex;align-items:center;gap:6px;font-weight:400">
        <span style="font-size:11px;color:var(--text2)">عملة البند الجديد (كل عامل له عملته الخاصة أدناه)</span>
        ${currencySelectHTML('m-workers-currency',window._mWCur||'SYP').replace('<select ','<select style="width:auto;padding:4px 8px;font-size:12px" onchange="window._mWCur=this.value==='+"'USD'"+'?'+"'USD'"+':'+"'SYP'"+';refreshMaintenanceTotals()" ')}
      </span>
    </div>
    <div id="workers-list">${renderWorkerEntries()}</div>
    <button class="btn btn-sm" onclick="addWorkerEntry()" style="margin-bottom:18px"><i class="ti ti-plus"></i> إضافة عامل / يوم عمل</button>
    <div style="font-weight:700;font-size:13px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <span style="display:flex;align-items:center;gap:8px">
        <i class="ti ti-receipt" style="color:var(--accent)"></i> مصاريف الورشة
        <span style="font-weight:400;font-size:11px;color:var(--text2)">(قطع، أكل، تكسي، وغيره)</span>
      </span>
      <span style="display:flex;align-items:center;gap:6px;font-weight:400">
        <span style="font-size:11px;color:var(--text2)">عملة البند الجديد (كل مصروف له عملته الخاصة أدناه)</span>
        ${currencySelectHTML('m-expenses-currency',window._mECur||'SYP').replace('<select ','<select style="width:auto;padding:4px 8px;font-size:12px" onchange="window._mECur=this.value==='+"'USD'"+'?'+"'USD'"+':'+"'SYP'"+';refreshMaintenanceTotals()" ')}
      </span>
    </div>
    <div id="expenses-list">${renderExpenseEntries()}</div>
    <button class="btn btn-sm" onclick="addExpenseEntry()" style="margin-bottom:18px"><i class="ti ti-plus"></i> إضافة مصروف</button>

    <div style="font-weight:700;font-size:13px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <span style="display:flex;align-items:center;gap:8px">
        <i class="ti ti-car" style="color:var(--accent)"></i> السيارات المستخدمة بهذا العمل
        <span style="font-weight:400;font-size:11px;color:var(--text2)">(بنزين، نقل، أجرة سيارة...)</span>
      </span>
      <span style="display:flex;align-items:center;gap:6px;font-weight:400">
        <span style="font-size:11px;color:var(--text2)">عملة البند الجديد (كل سيارة لها عملتها الخاصة أدناه)</span>
        ${currencySelectHTML('m-cars-currency',window._mCarsCur||'SYP').replace('<select ','<select style="width:auto;padding:4px 8px;font-size:12px" onchange="window._mCarsCur=this.value==='+"'USD'"+'?'+"'USD'"+':'+"'SYP'"+';refreshMaintenanceTotals()" ')}
      </span>
    </div>
    <div id="cars-list">${renderCarUsageEntries()}</div>
    <button class="btn btn-sm" onclick="addCarUsageEntry()" style="margin-bottom:18px"><i class="ti ti-plus"></i> إضافة سيارة</button>

    <div style="font-weight:700;font-size:13px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;margin-top:10px">
      <i class="ti ti-cash" style="color:var(--accent)"></i> دفعات مقدمة / خصومات من العميل
    </div>
    <div id="advances-list">${renderAdvanceEntries()}</div>
    <button class="btn btn-sm" onclick="addAdvanceEntry()" style="margin-bottom:18px"><i class="ti ti-plus"></i> إضافة دفعة/خصم</button>

    <div id="maintenance-totals" style="background:var(--bg2);border-radius:8px;padding:12px;font-size:13px;margin-bottom:12px">${renderMaintenanceTotals(m)}</div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveMaintenance('${editId||''}')">حفظ العمل</button>
    </div>
  `);
  setTimeout(()=>updateBranches(m&&m.branch?m.branch:null),30);
}

function renderWorkItemEntries(){
  if(!window._mWI||!window._mWI.length)window._mWI=[{type:'',desc:'',qty:1,price:''}];
  return window._mWI.map((it,i)=>{
    const suggestions=getWorkDescSuggestions(it.type);
    return `
    <div class="work-item-row">
      <select class="form-control wi-type" onchange="window._mWI[${i}].type=this.value;document.getElementById('work-items-list').innerHTML=renderWorkItemEntries()">
        <option value="">— نوع —</option>
        ${db.workTypes.map(wt=>`<option value="${esc(wt)}" ${it.type===wt?'selected':''}>${esc(wt)}</option>`).join('')}
      </select>
      <textarea class="form-control wi-desc" rows="2" placeholder="وصف هذا العمل بالتحديد..." onchange="window._mWI[${i}].desc=this.value">${esc(it.desc||'')}</textarea>
      <input type="number" class="form-control wi-qty" min="1" placeholder="عدد" value="${esc(it.qty||1)}" oninput="window._mWI[${i}].qty=this.value;refreshWorkItemsTotal()">
      <input type="text" inputmode="decimal" class="form-control wi-price" placeholder="إفرادي" value="${it.price?fmt(it.price):''}" oninput="formatMoneyInput(this);window._mWI[${i}].price=unformatNum(this.value);refreshWorkItemsTotal()">
      <button type="button" class="btn btn-sm btn-danger wi-del" onclick="window._mWI.splice(${i},1);document.getElementById('work-items-list').innerHTML=renderWorkItemEntries();refreshWorkItemsTotal()"><i class="ti ti-x"></i></button>
    </div>
    ${suggestions.length?`<div style="display:flex;flex-wrap:wrap;gap:5px;margin:-4px 0 10px 0">${suggestions.map(sv=>`<span onclick='window._mWI[${i}].desc=${esc(JSON.stringify(sv))};document.getElementById("work-items-list").innerHTML=renderWorkItemEntries()' style="cursor:pointer;font-size:11px;padding:3px 9px;background:var(--bg2);border:1px solid var(--border);border-radius:14px;color:var(--text2)" title="استخدام هذا الوصف">↺ ${esc(sv.length>40?sv.slice(0,40)+'…':sv)}</span>`).join('')}</div>`:''}`;
  }).join('');
}

function addWorkItemEntry(){
  if(!window._mWI)window._mWI=[];
  window._mWI.push({type:'',desc:'',qty:1,price:''});
  document.getElementById('work-items-list').innerHTML=renderWorkItemEntries();
}

function refreshWorkItemsTotal(){
  const raw=(window._mWI||[]).reduce((s,it)=>s+(+it.price||0)*(+it.qty||1),0);
  const discEl=document.getElementById('m-discount');
  const discount=discEl?clampDiscountPct(+discEl.value||0):0;
  const total=raw * (1 - discount/100);
  const el=document.getElementById('m-workamount');
  if(el)el.value=fmt(total);
  const rawEl=document.getElementById('m-rawamount');
  if(rawEl)rawEl.value=fmt(raw);
  refreshMaintenanceTotals();
}

function renderWorkerEntries(){
  if(!window._mW||!window._mW.length)return '<div style="color:var(--text2);font-size:12px;margin-bottom:10px;text-align:center;padding:16px;background:var(--bg2);border-radius:8px;border:1px dashed var(--border2)">اضغط على زر الإضافة لتسجيل عامل</div>';
  return window._mW.map((w,i)=>`
    <div class="worker-entry">
      <div class="worker-row">
        <select class="form-control" onchange="window._mW[${i}].workerId=this.value;window._mW[${i}].workerName=this.options[this.selectedIndex].text">
          ${db.workers.map(wk=>`<option value="${wk.id}" ${w.workerId===wk.id?'selected':''}>${esc(wk.name)}</option>`).join('')}
        </select>
        <input type="date" class="form-control" placeholder="تاريخ اليوم" value="${w.date||''}" onchange="window._mW[${i}].date=this.value">
        <div style="display:flex;gap:4px">
          <input type="text" inputmode="decimal" class="form-control" placeholder="أجر العامل" value="${w.wage?fmt(w.wage):''}" oninput="formatMoneyInput(this)" onchange="window._mW[${i}].wage=unformatNum(this.value);refreshMaintenanceTotals()">
          ${miniCurrencySelectHTML(w.currency||window._mWCur||'SYP',`window._mW[${i}].currency=this.value;refreshMaintenanceTotals()`)}
        </div>
        <button class="btn btn-sm btn-danger" onclick="window._mW.splice(${i},1);document.getElementById('workers-list').innerHTML=renderWorkerEntries();refreshMaintenanceTotals()"><i class="ti ti-x"></i></button>
      </div>
      <div style="display:grid;grid-template-columns:100px 1fr 1fr;gap:8px;margin-top:8px">
        <div class="form-group"><label class="form-label">عدد الأيام</label><input type="number" class="form-control" min="1" value="${w.days||1}" onchange="window._mW[${i}].days=this.value"></div>
        <div class="form-group"><label class="form-label">حالة الحساب</label>
          <select class="form-control" onchange="window._mW[${i}].paid=this.value==='true'">
            <option value="false" ${!w.paid?'selected':''}>لم يُحسب بعد</option>
            <option value="true" ${w.paid?'selected':''}>تم الحساب</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">تاريخ الحساب</label><input type="date" class="form-control" value="${w.paidDate||''}" onchange="window._mW[${i}].paidDate=this.value"></div>
      </div>
      <label style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:var(--gold-dark);cursor:pointer">
        <input type="checkbox" ${w.wageOnly?'checked':''} onchange="window._mW[${i}].wageOnly=this.checked">
        تسوية / أجرة فقط (ما نفّذ العامل هالعمل فعلياً — ما بتُحسب بإحصائيات الأداء وعدد الأعمال)
      </label>
    </div>
  `).join('');
}

function findClientByTypedName(inputId){
  const nameEl=document.getElementById(inputId);
  const typedName=nameEl?nameEl.value.trim():'';
  if(!typedName)return null;
  return db.clients.find(c=>c.name.trim()===typedName)||null;
}

const WORK_KINDS={periodic:'دورية',emergency:'طارئة',install:'تركيب'};
// T37: مصدر واحد لأرقام العمل المالية — بتستعمله لوحة المجاميع وتحذير الهامش، فالرقم بالتحذير = الرقم الظاهر بالشاشة
function maintFinancials(m){
  const totalEl=document.getElementById('m-workamount');
  const total=totalEl?unformatNum(totalEl.value):(m?getMaintenanceTotal(m):0);
  const mCurrencyEl=document.getElementById('m-currency');
  const invoiceCur=mCurrencyEl&&mCurrencyEl.value==='USD'?'USD':'SYP';
  const wages=(window._mW||[]).reduce((s,w)=>s+convertCurrency(+w.wage||0,w.currency||window._mWCur||'SYP',invoiceCur),0);
  const expenses=(window._mE||[]).reduce((s,e)=>s+convertCurrency(+e.amount||0,e.currency||window._mECur||'SYP',invoiceCur),0);
  const carCosts=(window._mCars||[]).reduce((s,c)=>s+convertCurrency(+c.amount||0,c.currency||window._mCarsCur||'SYP',invoiceCur),0);
  const advances=(window._mAdv||[]).reduce((s,a)=>s+convertCurrency(+a.amount||0,a.currency||window._mAdvCur||'SYP',invoiceCur),0);
  const netIncome=total-advances;
  const cost=wages+expenses+carCosts;
  return {total,invoiceCur,wages,expenses,carCosts,advances,netIncome,cost,grossProfit:netIncome-cost,marginPct:marginPctOf(netIncome,cost)};
}
function renderMaintenanceTotals(m){
  const F=maintFinancials(m);
  const {total,invoiceCur,wages,expenses,carCosts,advances,netIncome,grossProfit}=F;
  const client=findClientByTypedName('m-client-name');
  const hasReferrer=!!(client&&client.referrerName);
  const commEl=document.getElementById('m-commission');
  const commTypeEl=document.querySelector('input[name="m-commission-type"]:checked');
  const commType=commTypeEl?commTypeEl.value:'percent';
  const commVal=commEl?(+commEl.value||0):0;
  const hasCommission=hasReferrer&&commVal>0;
  const commission=hasCommission?(commType==='amount'?commVal:(grossProfit>0?grossProfit*(commVal/100):0)):0;
  const profit=grossProfit-commission;
  const wrap=document.getElementById('m-commission-wrap');
  if(wrap){
    wrap.style.display=hasReferrer?'':'none';
    const hint=document.getElementById('m-commission-hint');
    if(hint)hint.textContent=hasReferrer?`موصى من "${esc(client.referrerName)}" — حدد ${commType==='amount'?'المبلغ':'النسبة'}.`:'';
  }
  return `<div style="display:flex;gap:20px;flex-wrap:wrap">
    <span>الإجمالي: <b>${fmt(total)}</b></span>
    ${chargesTotalsHTML(total,curLabel(invoiceCur))}
    <span style="color:var(--danger)">الدفعات المقدمة: <b>${fmt(advances)}</b> <span style="font-size:10px;color:var(--text2)">${curLabel(invoiceCur)} (محوّلة تلقائياً حسب سعر الصرف)</span></span>
    <span style="color:var(--accent)">الصافي: <b>${fmt(netIncome)}</b></span>
    <span>أجور العمال: <b style="color:var(--salary)">${fmt(wages)}</b> <span style="font-size:10px;color:var(--text2)">${curLabel(invoiceCur)} (محوّلة تلقائياً حسب سعر الصرف)</span></span>
    <span>المصاريف: <b style="color:var(--info)">${fmt(expenses)}</b> <span style="font-size:10px;color:var(--text2)">${curLabel(invoiceCur)} (محوّلة تلقائياً حسب سعر الصرف)</span></span>
    <span>تكلفة السيارات: <b style="color:var(--info)">${fmt(carCosts)}</b> <span style="font-size:10px;color:var(--text2)">${curLabel(invoiceCur)} (محوّلة تلقائياً حسب سعر الصرف)</span></span>
    ${hasCommission?`<span style="color:var(--gold-dark)">${(document.getElementById('m-commission-settlement')&&document.getElementById('m-commission-settlement').checked)?'تسوية يدوية':'عمولة'} (${esc(client.referrerName)} — ${commType==='amount'?fmt(commVal):commVal+'%'}): <b>${fmt(commission)}</b></span>`:''}
    <span>الربح${hasCommission?' بعد العمولة':''}: <b style="color:${profit>=0?'var(--accent)':'var(--danger)'}">${fmt(profit)}</b></span>
    ${F.marginPct!==null&&F.cost>0?`<span title="(الصافي − الأجور − المصاريف − السيارات) ÷ الصافي، قبل العمولة">هامش الربح: <b style="color:${F.marginPct<getLowMarginPercent()?'var(--danger)':'var(--accent)'}">${F.marginPct.toFixed(1)}%</b></span>`:''}
  </div>`;
}

function renderAdvanceEntries(){
  if(!window._mAdv||!window._mAdv.length) return '<div style="color:var(--text2);font-size:12px;margin-bottom:10px;text-align:center;padding:14px;background:var(--bg2);border-radius:8px;border:1px dashed var(--border2)">لا يوجد دفعات مقدمة</div>';
  return window._mAdv.map((a,i)=>`
    <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:8px;border:1px solid var(--border)">
      <div style="display:grid;grid-template-columns:1fr 120px auto 130px auto;gap:8px;align-items:center">
        <input type="text" class="form-control" placeholder="نوع الدفعة (كاش، تحويل...)" value="${esc(a.type||'')}" onchange="window._mAdv[${i}].type=this.value">
        <input type="text" inputmode="decimal" class="form-control" placeholder="المبلغ" value="${a.amount?fmt(a.amount):''}" oninput="formatMoneyInput(this)" onchange="window._mAdv[${i}].amount=unformatNum(this.value);refreshMaintenanceTotals()">
        ${miniCurrencySelectHTML(a.currency||window._mAdvCur||'SYP',`window._mAdv[${i}].currency=this.value;refreshMaintenanceTotals()`)}
        <input type="date" class="form-control" value="${esc(a.date||'')}" onchange="window._mAdv[${i}].date=this.value">
        <button class="btn btn-sm btn-danger" onclick="window._mAdv.splice(${i},1);document.getElementById('advances-list').innerHTML=renderAdvanceEntries();refreshMaintenanceTotals()"><i class="ti ti-x"></i></button>
      </div>
      <div style="margin-top:8px">
        <input type="text" class="form-control" placeholder="ملاحظات إضافية" value="${esc(a.note||'')}" onchange="window._mAdv[${i}].note=this.value">
      </div>
    </div>
  `).join('');
}

function addAdvanceEntry(){
  if(!window._mAdv)window._mAdv=[];
  const lastAdv=window._mAdv[window._mAdv.length-1];
  window._mAdv.push({type:'دفعة مقدمة',amount:'',currency:lastAdv?(lastAdv.currency||'SYP'):(window._mAdvCur||'SYP'),date:getMFormDate(),note:''});
  document.getElementById('advances-list').innerHTML=renderAdvanceEntries();
  refreshMaintenanceTotals();
}

function refreshMaintenanceTotals(){const el=document.getElementById('maintenance-totals');if(el)el.innerHTML=renderMaintenanceTotals();}

function getMFormDate(){
  const el=document.getElementById('m-start');
  return (el&&el.value)?el.value:localToday();
}

function addWorkerEntry(){
  if(!window._mW)window._mW=[];
  const firstW=db.workers[0]||{};
  const last=window._mW[window._mW.length-1];
  window._mW.push({workerId:firstW.id||'',workerName:firstW.name||'',date:getMFormDate(),wage:last?last.wage:'',currency:last?(last.currency||'SYP'):(window._mWCur||'SYP'),days:1,paid:false,paidDate:''});
  document.getElementById('workers-list').innerHTML=renderWorkerEntries();
  refreshMaintenanceTotals();
}

function renderExpenseEntries(){
  if(!window._mE||!window._mE.length) return '<div style="color:var(--text2);font-size:12px;margin-bottom:10px;text-align:center;padding:14px;background:var(--bg2);border-radius:8px;border:1px dashed var(--border2)">لا يوجد مصاريف — اضغط إضافة</div>';
  const types=(db.expenseTypes||['قطع غيار','أكل','مواصلات / تكسي','أخرى']);
  return window._mE.map((e,i)=>`
    <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:8px;border:1px solid var(--border)">
      <div style="display:grid;grid-template-columns:1fr 120px 130px auto;gap:8px;align-items:center">
        <select class="form-control" onchange="window._mE[${i}].type=this.value==='__custom'?'':this.value;document.getElementById('expenses-list').innerHTML=renderExpenseEntries()">
          ${types.map(t=>`<option value="${esc(t)}" ${e.type===t?'selected':''}>${esc(t)}</option>`).join('')}
          <option value="__custom" ${!types.includes(e.type)&&e.type?'selected':''}>أخرى / كتابة يدوية</option>
        </select>
        <div style="display:flex;gap:4px">
          <input type="text" inputmode="decimal" class="form-control" placeholder="المبلغ" value="${e.amount?fmt(e.amount):''}" oninput="formatMoneyInput(this)" onchange="window._mE[${i}].amount=unformatNum(this.value);refreshMaintenanceTotals()">
          ${miniCurrencySelectHTML(e.currency||window._mECur||'SYP',`window._mE[${i}].currency=this.value;refreshMaintenanceTotals()`)}
        </div>
        <input type="date" class="form-control" value="${esc(e.date||'')}" onchange="window._mE[${i}].date=this.value">
        <button class="btn btn-sm btn-danger" onclick="window._mE.splice(${i},1);document.getElementById('expenses-list').innerHTML=renderExpenseEntries();refreshMaintenanceTotals()"><i class="ti ti-x"></i></button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-top:8px">
        <input type="text" class="form-control" placeholder="نوع مخصص مثل: غداء، تكسي، بنزين..." value="${!types.includes(e.type)?esc(e.type||''):''}" onchange="if(this.value.trim())window._mE[${i}].type=this.value.trim()">
        <input type="text" class="form-control" placeholder="وصف / تفاصيل" value="${esc(e.note||'')}" onchange="window._mE[${i}].note=this.value">
      </div>
    </div>
  `).join('');
}

function addExpenseEntry(){
  if(!window._mE)window._mE=[];
  const types=db.expenseTypes||['قطع غيار','أكل','مواصلات','أخرى'];
  const last=window._mE[window._mE.length-1];
  window._mE.push({type:last?last.type:types[0],amount:'',currency:last?(last.currency||'SYP'):(window._mECur||'SYP'),date:getMFormDate(),note:''});
  document.getElementById('expenses-list').innerHTML=renderExpenseEntries();
  refreshMaintenanceTotals();
}

function renderCarUsageEntries(){
  if(!db.cars||!db.cars.length) return '<div style="color:var(--text2);font-size:12px;margin-bottom:10px;text-align:center;padding:14px;background:var(--bg2);border-radius:8px;border:1px dashed var(--border2)">لا يوجد سيارات مسجّلة</div>';
  if(!window._mCars||!window._mCars.length) return '<div style="color:var(--text2);font-size:12px;margin-bottom:10px;text-align:center;padding:14px;background:var(--bg2);border-radius:8px;border:1px dashed var(--border2)">لا يوجد سيارات مضافة لهذا العمل — اضغط إضافة</div>';
  return window._mCars.map((c,i)=>`
    <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:8px;border:1px solid var(--border)">
      <div style="display:grid;grid-template-columns:1fr 120px 130px auto;gap:8px;align-items:center">
        <select class="form-control" onchange="window._mCars[${i}].carId=this.value;window._mCars[${i}].carName=this.options[this.selectedIndex].text">
          ${db.cars.map(cr=>`<option value="${cr.id}" ${c.carId===cr.id?'selected':''}>${esc(cr.name)}${cr.plate?' — '+esc(cr.plate):''}</option>`).join('')}
        </select>
        <div style="display:flex;gap:4px">
          <input type="text" inputmode="decimal" class="form-control" placeholder="التكلفة" value="${c.amount?fmt(c.amount):''}" oninput="formatMoneyInput(this)" onchange="window._mCars[${i}].amount=unformatNum(this.value);refreshMaintenanceTotals()">
          ${miniCurrencySelectHTML(c.currency||window._mCarsCur||'SYP',`window._mCars[${i}].currency=this.value;refreshMaintenanceTotals()`)}
        </div>
        <input type="date" class="form-control" value="${esc(c.date||'')}" onchange="window._mCars[${i}].date=this.value">
        <button class="btn btn-sm btn-danger" onclick="window._mCars.splice(${i},1);document.getElementById('cars-list').innerHTML=renderCarUsageEntries();refreshMaintenanceTotals()"><i class="ti ti-x"></i></button>
      </div>
      <div style="margin-top:8px">
        <input type="text" class="form-control" placeholder="ملاحظة (مثلاً: نقل عدة، بنزين ذهاب وعودة...)" value="${esc(c.note||'')}" onchange="window._mCars[${i}].note=this.value">
      </div>
    </div>
  `).join('');
}

function addCarUsageEntry(){
  if(!db.cars||!db.cars.length){alert('يرجى إضافة سيارة أولاً من قسم "لائحة السيارات"');return;}
  if(!window._mCars)window._mCars=[];
  const firstCar=db.cars[0];
  const last=window._mCars[window._mCars.length-1];
  window._mCars.push({carId:firstCar.id,carName:firstCar.name,amount:'',currency:last?(last.currency||'SYP'):(window._mCarsCur||'SYP'),date:getMFormDate(),note:''});
  document.getElementById('cars-list').innerHTML=renderCarUsageEntries();
  refreshMaintenanceTotals();
}

function updateBranches(sel){
  const nameEl=document.getElementById('m-client-name');
  const typedName=nameEl?nameEl.value.trim():'';
  const client=db.clients.find(c=>c.name.trim()===typedName);
  const b=document.getElementById('m-branch');
  if(b)b.innerHTML=client&&client.branches&&client.branches.length?client.branches.map(br=>`<option ${sel===br?'selected':''}>${br}</option>`).join(''):'<option value="">— لا يوجد فروع —</option>';
  const phoneWrap=document.getElementById('m-client-phone-wrap');
  if(phoneWrap)phoneWrap.style.display=(typedName&&!client)?'block':'none';
  if(client){
    const discEl=document.getElementById('m-discount');
    if(discEl&&!discEl.value){
      const lastM=db.maintenance.filter(x=>x.clientId===client.id&&x.discount).sort((a,b2)=>new Date(b2.startDate||0)-new Date(a.startDate||0))[0];
      if(lastM)discEl.value=lastM.discount;
    }
    const commEl=document.getElementById('m-commission');
    if(commEl&&!commEl.value&&client.referrerName){
      const lastC=db.maintenance.filter(x=>x.clientId===client.id&&(x.commissionPercent||x.commissionAmount)).sort((a,b2)=>new Date(b2.startDate||0)-new Date(a.startDate||0))[0];
      if(lastC){
        const isAmount=lastC.commissionType==='amount';
        const radio=document.querySelector(`input[name="m-commission-type"][value="${isAmount?'amount':'percent'}"]`);
        if(radio)radio.checked=true;
        commEl.value=isAmount?lastC.commissionAmount:lastC.commissionPercent;
      }
    }
  }
  refreshWorkItemsTotal();
  refreshMaintenanceTotals();
}

function saveMaintenance(editId){
  const typedName=(document.getElementById('m-client-name').value||'').trim();
  if(!typedName){alert('يرجى إدخال اسم العميل');return;}
  // Try to match an existing client by name
  let matchedClient=db.clients.find(c=>c.name.trim()===typedName);
  // If no match, auto-add as new client
  if(!matchedClient){
    if(!confirm(`"${typedName}" غير موجود في قائمة العملاء. هل تريد إضافته تلقائياً؟`))return;
    const newPhoneEl=document.getElementById('m-client-phone');
    matchedClient={id:uid(),name:typedName,phone:newPhoneEl?newPhoneEl.value.trim():'',address:'',branches:[]};
    db.clients.push(matchedClient);
  }
  const clientId=matchedClient.id;
  const branch=document.getElementById('m-branch').value;
  const startDate=document.getElementById('m-start').value;
  const endDate=document.getElementById('m-end').value;
  const status=document.getElementById('m-status').value;
  const kindEl=document.getElementById('m-kind');
  const workKind=kindEl&&WORK_KINDS[kindEl.value]?kindEl.value:'';
  const notes=document.getElementById('m-notes').value;
  const invoiceNo=document.getElementById('m-invoice').value;
  if(invoiceNo&&db.maintenance.some(x=>x.id!==editId&&x.invoiceNo===invoiceNo)){alert(`تنبيه: رقم الفاتورة (${invoiceNo}) مستخدم من قبل بعمل آخر. يرجى مراجعة الأمر.`);return;}
  const workItems=(window._mWI||[]).filter(it=>(it.type&&it.type.trim())||(it.desc&&it.desc.trim())||(it.price&&+it.price)).map(it=>({type:it.type||'',desc:it.desc||'',qty:+it.qty||1,price:+it.price||0,qIdx:it.qIdx}));
  const workTypes=[...new Set(workItems.map(it=>it.type).filter(Boolean))];
  const workDesc=workItems.map(it=>it.type?`${esc(it.type)}: ${esc(it.desc||'')}`:(it.desc||'')).join('\n');
  const discount=+(document.getElementById('m-discount').value)||0;
  if(discount<0||discount>100){alert('نسبة الحسم لازم تكون بين 0 و100');return;}
  const commEl=document.getElementById('m-commission');
  const commTypeSelEl=document.querySelector('input[name="m-commission-type"]:checked');
  const commissionType=commTypeSelEl?commTypeSelEl.value:'percent';
  const commissionPercent=commEl&&commissionType!=='amount'?(+commEl.value||0):0;
  const commissionAmount=commEl&&commissionType==='amount'?(+commEl.value||0):0;
  const commSetEl=document.getElementById('m-commission-settlement');
  const commissionSettlement=commSetEl?commSetEl.checked:false;
  const rawAmount=workItems.length?workItems.reduce((s,it)=>s+((+it.qty||1)*(+it.price||0)),0):unformatNum(document.getElementById('m-workamount').value);
  const workAmount=round2(rawAmount-(rawAmount*(discount/100)));
  const chg=chargesCollect(workAmount);
  if(!clientId){alert('يرجى اختيار عميل');return;}
  const workers=(window._mW||[]).map(w=>({...w,wage:+w.wage||0,days:+w.days||1,workerName:db.workers.find(wk=>wk.id===w.workerId)?db.workers.find(wk=>wk.id===w.workerId).name:w.workerName}));
  const expenses=(window._mE||[]).filter(e=>e.amount).map(e=>({...e,amount:+e.amount||0}));
  const cars=(window._mCars||[]).filter(c=>c.carId&&c.amount).map(c=>({...c,amount:+c.amount||0}));
  const advances=(window._mAdv||[]).filter(a=>a.amount).map(a=>({...a,amount:+a.amount||0,currency:a.currency==='USD'?'USD':'SYP'}));
  const existing=editId?db.maintenance.find(x=>x.id===editId):null;
  const paidAmount=existing?(+existing.paidAmount||0):0;
  const payments=existing&&existing.payments?existing.payments:[];
  if(!editId){ if(!checkClientDebtWarning(clientId)) return; }
  const projectName=(document.getElementById('m-project')?document.getElementById('m-project').value:'').trim();
  if(projectName)findOrCreateProject(projectName);
  const deliveryStatusEl=document.getElementById('m-delivery-status');
  const deliveryStatus=deliveryStatusEl?deliveryStatusEl.value:'معلقة';
  const deliveryDate=deliveryStatus==='مسلمة'?(document.getElementById('m-delivery-date').value||localToday()):'';
  const quoteId=existing?existing.quoteId||'':'';
  const mCurrencyEl=document.getElementById('m-currency');
  const currency=mCurrencyEl&&mCurrencyEl.value==='USD'?'USD':'SYP';
  const mWorkersCurEl=document.getElementById('m-workers-currency');
  const workersCurrency=mWorkersCurEl&&mWorkersCurEl.value==='USD'?'USD':'SYP';
  const mExpensesCurEl=document.getElementById('m-expenses-currency');
  const expensesCurrency=mExpensesCurEl&&mExpensesCurEl.value==='USD'?'USD':'SYP';
  const mCarsCurEl=document.getElementById('m-cars-currency');
  const carsCurrency=mCarsCurEl&&mCarsCurEl.value==='USD'?'USD':'SYP';
  // تحذير هامش ربح منخفض قبل حفظ فاتورة العمل (نفس منطق عروض الأسعار والمبيعات)
  {
    const F=maintFinancials(existing);
    if(F.cost>0&&F.marginPct!==null){
      const minMargin=getLowMarginPercent();
      if(F.marginPct<minMargin){
        if(!confirm(`⚠️ تحذير: هامش الربح بهذا العمل ${F.marginPct.toFixed(1)}% وهو أقل من الحد الأدنى المحدد (${minMargin}%).\nمتأكد بدك تحفظ العمل بهذا السعر؟`))return;
      }
    }
  }
  const exchangeRateAtEntry=existing&&existing.exchangeRateAtEntry?existing.exchangeRateAtEntry:getExchangeRate();
  const entry={...(existing||{}),id:editId||uid(),clientId,branch,startDate,endDate,status,workKind,paidAmount,payments,notes,invoiceNo,workDesc,workTypes,workItems,workAmount,currency,workers,expenses,cars,advances,workersCurrency,expensesCurrency,carsCurrency,discount,charges:chg.items,chargesTotal:chg.total,commissionType,commissionPercent,commissionAmount,commissionSettlement,projectName,deliveryStatus,deliveryDate,quoteId,exchangeRateAtEntry};
  if(editId){const idx=db.maintenance.findIndex(x=>x.id===editId);if(idx>=0)db.maintenance[idx]=entry;}
  else db.maintenance.push(entry);
  // تحديث "المشروع/المكان الحالي" للسيارة على آخر عمل استُخدمت فيه — فالسيارة ممكن تشتغل بأكتر من مشروع بمرور الوقت متل العمال بالضبط (بدون قفلها على أول مشروع استُخدمت فيه)
  if(projectName&&cars.length){
    cars.forEach(c=>{
      const car=db.cars.find(x=>x.id===c.carId);
      if(car)car.project=projectName;
    });
  }
  if(quoteId)syncItemsToQuote(quoteId,'maint',workItems);
  refreshProjectAutoStatus(projectName);
  // تصفية تلقائية: أي عامل عنده سلفة فيها فائض غير مستهلك، وأجرة الورشة هاي بتاريخ بعد تاريخ السلفة،
  // بيتغطى منها تلقائياً (لو كافي الفائض يغطي كامل الأجرة) — نفس منطق استهلاك السلفة اللي طلبه المستخدم
  if(typeof applyAdvanceSurplusToWorker==='function'){
    [...new Set(workers.map(w=>w.workerId).filter(Boolean))].forEach(wid=>applyAdvanceSurplusToWorker(wid));
  }
  saveDB(db);closeModal();renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function toggleMaintDelivery(maintId){
  const m=db.maintenance.find(x=>x.id===maintId);if(!m)return;
  if(m.deliveryStatus==='مسلمة'){
    if(!confirm('التراجع عن تسليم هذا العمل؟'))return;
    m.deliveryStatus='معلقة';m.deliveryDate='';
  }else{
    const d=prompt('تاريخ التسليم:',localToday());
    if(d===null)return;
    m.deliveryStatus='مسلمة';m.deliveryDate=d||localToday();
  }
  saveDB(db);renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function toggleMaintSelectAll(cb){
  window._mSel=window._mSel||new Set();
  const filter=window._mF||'all',cFilter=window._mC||'',bFilter=window._mB||'',wFilter=window._mW2||'',dFilter=window._mD||'all';
  const filtered=db.maintenance.filter(m=>{
    if(filter!=='all'&&m.status!==filter)return false;
    if(cFilter&&m.clientId!==cFilter)return false;
    if(bFilter&&m.branch!==bFilter)return false;
    if(wFilter&&(!m.workers||!m.workers.some(w=>w.workerId===wFilter)))return false;
    if(dFilter!=='all'&&(m.deliveryStatus==='مسلمة'?'مسلمة':'معلقة')!==dFilter)return false;
    return true;
  });
  if(cb.checked)filtered.forEach(m=>window._mSel.add(m.id));
  else filtered.forEach(m=>window._mSel.delete(m.id));
  renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function toggleMaintRowSelect(id,cb){
  window._mSel=window._mSel||new Set();
  if(cb.checked)window._mSel.add(id);else window._mSel.delete(id);
  renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function bulkMaintDelivery(status){
  window._mSel=window._mSel||new Set();
  if(window._mSel.size===0)return;
  let dateVal='';
  if(status==='مسلمة'){
    dateVal=prompt(`تاريخ التسليم لـ ${window._mSel.size} عمل محدد:`,localToday());
    if(dateVal===null)return;
    if(!dateVal)dateVal=localToday();
  }
  if(!confirm(`تأكيد تحديد ${window._mSel.size} عمل كـ "${status}"؟`))return;
  db.maintenance.forEach(m=>{
    if(window._mSel.has(m.id)){
      m.deliveryStatus=status;
      m.deliveryDate=status==='مسلمة'?dateVal:'';
    }
  });
  saveDB(db);
  window._mSel=new Set();
  renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function bulkMaintPayment(paid){
  window._mSel=window._mSel||new Set();
  if(window._mSel.size===0)return;
  let dateVal='';
  if(paid){
    dateVal=prompt(`تاريخ التسديد لـ ${window._mSel.size} عمل محدد:`,localToday());
    if(dateVal===null)return;
    if(!dateVal)dateVal=localToday();
  }
  if(!confirm(`تأكيد تحديد ${window._mSel.size} عمل كـ "${paid?'مسددة بالكامل':'غير مدفوعة'}"؟`))return;
  db.maintenance.forEach(m=>{
    if(!window._mSel.has(m.id))return;
    const income=getMaintenanceIncome(m);
    if(paid){
      const currentPaid=+m.paidAmount||0;
      const currentDisc=maintDiscountTotal(m);
      // لازم نطرح الخصم المسجّل مسبقاً (خصم عند التحصيل) قبل ما نحسب المبلغ المطلوب تسديده،
      // وإلا رح نضيف دفعة أكبر من اللازم على أي عمل عنده خصم مسبق
      const remaining=round2(income-currentPaid-currentDisc);
      if(remaining>0){
        if(!m.payments)m.payments=[];
        m.payments.push({id:uid(),amount:remaining,currency:m.currency||'SYP',date:dateVal,note:'تسديد جماعي',convertedAmount:remaining,rateUsed:getExchangeRate()});
      }
      m.paidAmount=round2(income-currentDisc);
    }else{
      m.paidAmount=0;
      m.discAmount=0; // T4: تصفير الخصم عند الإلغاء
      m.payments=[];
    }
  });
  saveDB(db);
  window._mSel=new Set();
  renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function bulkMaintDelete(){
  window._mSel=window._mSel||new Set();
  if(window._mSel.size===0)return;
  if(!guardDelete())return;
  if(!confirm(`حذف ${window._mSel.size} عمل نهائياً؟ هذا الإجراء لا يمكن التراجع عنه ولا يمكن استرجاع البيانات المحذوفة.`))return;
  db.maintenance=db.maintenance.filter(m=>!window._mSel.has(m.id));
  logAction('حذف جماعي','maintenance',[...window._mSel].join(','));
  window._mSel=new Set();
  saveDB(db);
  renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function openMaintPaymentModal(maintId,paymentId){
  const m=db.maintenance.find(x=>x.id===maintId);if(!m)return;
  if(!m.payments)m.payments=[];
  const p=paymentId?m.payments.find(x=>x.id===paymentId):null;
  const income=getMaintenanceIncome(m);
  const currentPaid=(+m.paidAmount||0)-(p?(+p.convertedAmount||convertCurrency(+p.amount||0,p.currency||m.currency||'SYP',m.currency||'SYP')):0);
  const currentDisc=maintDiscountTotal(m)-(p?(+p.discountConverted||0):0);
  const remaining=income-currentPaid-currentDisc;
  showModal(`<div class="modal-title">${paymentId?'تعديل دفعة':'تسجيل دفعة جديدة'} — ${esc(getClientName(m.clientId))}</div>
    <div class="grid-3" style="margin-bottom:16px">
      <div class="metric-card"><div class="metric-label">إجمالي العمل</div><div class="metric-value blue" style="font-size:16px">${fmt(income)}</div></div>
      <div class="metric-card"><div class="metric-label">مدفوع سابقاً</div><div class="metric-value green" style="font-size:16px">${fmt(currentPaid)}</div></div>
      <div class="metric-card"><div class="metric-label">المتبقي</div><div class="metric-value red" style="font-size:16px">${fmt(remaining)}</div></div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">مبلغ الدفعة (الكاش المستلم فعلاً)</label><div style="display:flex;gap:4px"><input type="text" inputmode="decimal" class="form-control" id="mp-amount" data-remaining="${remaining}" value="${fmt(p?p.amount:(remaining>0?remaining:0))}" oninput="formatMoneyInput(this);applyMaintPaymentSettlement()">${currencySelectHTML('mp-currency',p?p.currency:m.currency)}</div></div>
      <div class="form-group"><label class="form-label">تاريخ الدفعة</label><input type="date" class="form-control" id="mp-date" value="${p?p.date:localToday()}"></div>
    </div>
    <div class="form-group" style="margin-top:10px">
      <label class="form-label" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span>خصم عند التحصيل (اختياري)</span>
        <span style="display:flex;align-items:center;gap:4px;font-size:11px;font-weight:400;cursor:pointer;color:var(--gold-dark)"><input type="checkbox" id="mp-settlement" onchange="applyMaintPaymentSettlement()"> تسديد (اعتبر الفرق خصم تلقائياً)</span>
      </label>
      <input type="text" inputmode="decimal" class="form-control" id="mp-discount" value="${fmt(p?p.discount||0:0)}" oninput="formatMoneyInput(this)" placeholder="0">
    </div>
    <div style="font-size:11px;color:var(--text2);margin:-4px 0 10px">يسقط من الدين، بدون إيراد فعلي.</div>
    <div class="form-group" style="margin-top:10px"><label class="form-label">ملاحظة</label><input type="text" class="form-control" id="mp-note" value="${esc(p?p.note||'':'')}" placeholder="مثلاً: نقداً، تحويل بنكي..."></div>
    ${(m.payments&&m.payments.length)?`<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
      <div style="font-weight:700;font-size:13px;margin-bottom:8px">الدفعات المسجلة</div>
      <table><thead><tr><th>المبلغ</th><th>الخصم</th><th>التاريخ</th><th>ملاحظة</th><th></th></tr></thead><tbody>
        ${m.payments.map(pm=>`<tr>
          <td style="font-weight:600;color:var(--accent)">${fmt(pm.amount)} <span style="font-size:10px;color:var(--text2)">${curLabel(pm.currency||m.currency)}</span></td>
          <td style="font-weight:600;color:var(--gold-dark)">${pm.discount?fmt(pm.discount):'—'}</td>
          <td style="font-size:12px">${fmtDate(pm.date)}</td>
          <td style="font-size:12px;color:var(--text2)">${esc(pm.note||'—')}</td>
          <td><div class="action-btns">
            <button class="btn btn-sm" onclick="event.stopPropagation();openMaintPaymentModal('${maintId}','${pm.id}')"><i class="ti ti-edit"></i></button>
            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteMaintPayment('${maintId}','${pm.id}')"><i class="ti ti-trash"></i></button>
          </div></td>
        </tr>`).join('')}
      </tbody></table>
    </div>`:''}
    <div class="modal-actions"><button class="btn" onclick="event.stopPropagation();closeModal()">إلغاء</button><button class="btn btn-primary" onclick="event.stopPropagation();saveMaintPayment('${maintId}','${paymentId||''}')">حفظ الدفعة</button></div>`);
}

function applyMaintPaymentSettlement(){
  const chk=document.getElementById('mp-settlement');
  const discEl=document.getElementById('mp-discount');
  if(!chk||!discEl)return;
  if(chk.checked){
    const amountEl=document.getElementById('mp-amount');
    const remaining=+amountEl.dataset.remaining||0;
    const amount=unformatNum(amountEl.value);
    const diff=Math.max(remaining-amount,0);
    discEl.value=fmt(diff);
    discEl.readOnly=true;
    discEl.style.background='var(--bg3)';
  }else{
    discEl.readOnly=false;
    discEl.style.background='';
  }
}
function saveMaintPayment(maintId,paymentId){
  const m=db.maintenance.find(x=>x.id===maintId);if(!m)return;
  const amount=unformatNum(document.getElementById('mp-amount').value);
  const currencyEl=document.getElementById('mp-currency');
  const currency=currencyEl&&currencyEl.value==='USD'?'USD':'SYP';
  const date=document.getElementById('mp-date').value;
  const note=document.getElementById('mp-note').value;
  const discEl=document.getElementById('mp-discount');
  const discount=discEl?unformatNum(discEl.value):0;
  if(amount<=0 && discount<=0){alert('يرجى إدخال مبلغ صحيح');return;}
  if(!m.payments)m.payments=[];
  const existingPayment=paymentId?m.payments.find(p=>p.id===paymentId):null;
  // نستخدم سعر الصرف المحفوظ مع الدفعة الأصلية (لو كانت موجودة من قبل) حتى لو عم نعدّل عليها اليوم —
  // هيك تعديل تاريخ/ملاحظة/مبلغ دفعة قديمة ما يغيّر قيمتها المحوّلة بسبب تحرّك سعر الصرف الحي من ساعتها.
  // الدفعة الجديدة فقط بتاخد سعر الصرف الحي الحالي وتتجمّد فيه من هلق وصاعد.
  const rateUsed=(existingPayment&&+existingPayment.rateUsed>0)?+existingPayment.rateUsed:getExchangeRate();
  const convertedAmount=convertCurrencyAtRate(amount,currency,m.currency||'SYP',rateUsed);
  const discountConverted=convertCurrencyAtRate(discount,currency,m.currency||'SYP',rateUsed);
  { // T5: الدفعة + الخصم ما بيتجاوزوا المتبقي
    const _oldC=existingPayment?(+existingPayment.convertedAmount||convertCurrency(+existingPayment.amount||0,existingPayment.currency||m.currency||'SYP',m.currency||'SYP')):0;
    const _oldD=existingPayment?(+existingPayment.discountConverted||0):0;
    const _rem=round2(getMaintenanceIncome(m)-((+m.paidAmount||0)-_oldC)-(maintDiscountTotal(m)-_oldD));
    const _sum=round2(convertedAmount+discountConverted);
    if(_sum>_rem+0.01){alert('الدفعة مع الخصم ('+fmt(_sum)+') أكبر من المتبقي ('+fmt(Math.max(_rem,0))+').');return;}
  }
  if(paymentId){
    const idx=m.payments.findIndex(p=>p.id===paymentId);
    if(idx>=0)m.payments[idx]={id:paymentId,amount,currency,date,note,convertedAmount,discount,discountConverted,rateUsed};
  }else{
    m.payments.push({id:uid(),amount,currency,date,note,convertedAmount,discount,discountConverted,rateUsed});
  }
  m.paidAmount=round2(m.payments.reduce((sum,p)=>sum+(+p.convertedAmount||0),0));
  m.discAmount=round2(m.payments.reduce((sum,p)=>sum+(+p.discountConverted||0),0));
  saveDB(db);
  refreshProjectAutoStatus(m.projectName);
  renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'));
  setTimeout(()=>openMaintPaymentModal(maintId),0);
}

function deleteMaintPayment(maintId,paymentId){
  if(!guardDelete())return;
  if(!confirm('هل أنت متأكد من حذف هذه الدفعة؟'))return;
  const m=db.maintenance.find(x=>x.id===maintId);if(!m)return;
  m.payments=m.payments.filter(p=>p.id!==paymentId);
  m.paidAmount=round2(m.payments.reduce((sum,p)=>sum+(+p.convertedAmount||0),0));
  m.discAmount=round2(m.payments.reduce((sum,p)=>sum+(+p.discountConverted||0),0));
  saveDB(db);
  refreshProjectAutoStatus(m.projectName);
  renderMaintenance(document.getElementById('main-content'),document.getElementById('topbar-actions'));
  setTimeout(()=>openMaintPaymentModal(maintId),0);
}

function openGroupedInvoiceModal(){
  showModal(`
    <div class="modal-title"><i class="ti ti-file-invoice" style="color:var(--accent)"></i> فاتورة مجمّعة للعميل</div>
    <div class="form-row cols-2">
      <div class="form-group">
        <label class="form-label">اختر العميل</label>
        <select class="form-control" id="gi-client" onchange="updateGroupedInvoicePreview()">
          <option value="">— اختر العميل —</option>
          ${db.clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">الفرع (اختياري)</label>
        <select class="form-control" id="gi-branch" onchange="updateGroupedInvoicePreview()">
          <option value="">كل الفروع</option>
        </select>
      </div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group">
        <label class="form-label">من تاريخ (اختياري)</label>
        <input type="date" class="form-control" id="gi-from" onchange="updateGroupedInvoicePreview()">
      </div>
      <div class="form-group">
        <label class="form-label">إلى تاريخ (اختياري)</label>
        <input type="date" class="form-control" id="gi-to" onchange="updateGroupedInvoicePreview()">
      </div>
    </div>
    <div class="form-group" style="margin-bottom:10px">
      <label class="form-label">رقم الفاتورة</label>
      <input type="text" class="form-control" id="gi-invno" placeholder="مثال: INV-2024-001">
    </div>
    <div class="form-group" style="margin-bottom:14px">
      <label class="form-label">ملاحظات <span style="font-weight:400;color:var(--text2)">(اتركها فارغة إذا ما بدك ملاحظات)</span></label>
      <textarea class="form-control" id="gi-notes" rows="3" placeholder="اكتب ملاحظاتك هنا..."></textarea>
    </div>
    <div id="gi-preview" style="background:var(--bg2);border-radius:12px;padding:14px;border:1px solid var(--border);min-height:60px;font-size:13px;color:var(--text2);overflow-x:auto">
      اختر العميل لعرض الأعمال...
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="printGroupedInvoice(true)"><i class="ti ti-printer"></i> طباعة الفاتورة (بالأسعار)</button>
      <button class="btn" onclick="printGroupedInvoice(false)"><i class="ti ti-file-invoice"></i> طباعة وصف الأعمال (بدون أسعار)</button>
    </div>
  `);
}

function updateGroupedInvoicePreview(){
  const clientId=document.getElementById('gi-client').value;
  const branchEl=document.getElementById('gi-branch');
  const from=document.getElementById('gi-from').value;
  const to=document.getElementById('gi-to').value;

  // Update branch dropdown
  const client=db.clients.find(c=>c.id===clientId);
  const selectedBranch=branchEl.value;
  branchEl.innerHTML='<option value="">كل الفروع</option>';
  if(client&&client.branches&&client.branches.length){
    client.branches.forEach(br=>{
      const opt=document.createElement('option');
      opt.value=br; opt.textContent=br;
      if(br===selectedBranch) opt.selected=true;
      branchEl.appendChild(opt);
    });
  }

  const branch=branchEl.value;
  const preview=document.getElementById('gi-preview');
  if(!clientId){preview.innerHTML='<span style="color:var(--text2)">اختر العميل لعرض الأعمال...</span>';return;}

  const records=db.maintenance.filter(m=>{
    if(m.clientId!==clientId) return false;
    if(branch&&m.branch!==branch) return false;
    if(from&&m.startDate&&m.startDate<from) return false;
    if(to&&m.startDate&&m.startDate>to) return false;
    return true;
  }).sort((a,b)=>new Date(a.startDate||0)-new Date(b.startDate||0));

  if(!records.length){
    preview.innerHTML='<span style="color:var(--danger)">لا يوجد أعمال مسجلة لهذا العميل بهذه الفلاتر.</span>';
    return;
  }

  const distinctCurrencies=[...new Set(records.map(m=>m.currency||'SYP'))];
  if(distinctCurrencies.length>1){
    preview.innerHTML=`<span style="color:var(--danger)">⚠️ الأعمال المحددة لهذا العميل مسجّلة بعملات مختلفة (${distinctCurrencies.map(c=>curLabel(c)).join(' و ')}) — لا يمكن تجميعها بفاتورة واحدة لأن المجموع سيكون غير صحيح. يرجى تضييق نطاق التاريخ/الفرع لتشمل عملة واحدة فقط، أو إصدار فاتورة منفصلة لكل عملة.</span>`;
    return;
  }

  const total=records.reduce((s,m)=>s+getMaintenanceTotal(m),0);
  const advances=records.reduce((s,m)=>s+getMaintenanceAdvances(m),0);
  const net=total-advances;
  preview.innerHTML=`
    <div style="font-weight:700;margin-bottom:10px;color:var(--text)">
      معاينة: ${records.length} عمل — الإجمالي: <span style="color:var(--text)">${fmt(total)}</span> 
      ${advances > 0 ? `— الخصومات: <span style="color:var(--danger)">${fmt(advances)}</span> — الصافي: <span style="color:var(--accent)">${fmt(net)}</span>` : ''}
    </div>
    <table style="font-size:12px;width:100%;min-width:560px">
      <thead><tr style="background:var(--bg3)">
        <th style="padding:6px 8px;text-align:right">التاريخ</th>
        <th style="padding:6px 8px;text-align:right">الفرع</th>
        <th style="padding:6px 8px;text-align:right">نوع العمل</th>
        <th style="padding:6px 8px;text-align:right">وصف العمل</th>
        <th style="padding:6px 8px;text-align:center">العدد</th>
        <th style="padding:6px 8px;text-align:right">إفرادي</th>
        <th style="padding:6px 8px;text-align:right">الإجمالي</th>
      </tr></thead>
      <tbody>
        ${records.map(m=>{
          const items=(m.workItems&&m.workItems.length)?m.workItems:[{type:(m.workTypes&&m.workTypes.join(' / '))||'—',desc:m.workDesc||'—',qty:1,price:getMaintenanceTotal(m)}];
          const span=items.length;
          return items.map((it,idx)=>`<tr>
          ${idx===0?`<td rowspan="${span}" style="padding:5px 8px">${fmtDate(m.startDate)}</td><td rowspan="${span}" style="padding:5px 8px">${esc(m.branch||'—')}</td>`:''}
          <td style="padding:5px 8px">${esc(it.type||'—')}</td>
          <td style="padding:5px 8px">${esc(it.desc||'—')}</td>
          <td style="padding:5px 8px;text-align:center">${+it.qty||1}</td>
          <td style="padding:5px 8px;text-align:right">${fmt(+it.price||0)}</td>
          <td style="padding:5px 8px;font-weight:700;color:var(--accent)">${fmt((+it.qty||1)*(+it.price||0))}</td>
        </tr>`).join('');
        }).join('')}
      </tbody>
    </table>
  `;
}

function printGroupedInvoice(withPrices){
  if(withPrices===undefined)withPrices=true;
  const clientId=document.getElementById('gi-client').value;
  if(!clientId){alert('يرجى اختيار العميل أولاً');return;}
  const branch=document.getElementById('gi-branch').value;
  const from=document.getElementById('gi-from').value;
  const to=document.getElementById('gi-to').value;
  const invNo=document.getElementById('gi-invno').value||('GI-'+Date.now().toString().slice(-6));
  const customNotes=(document.getElementById('gi-notes').value||'').trim();

  const client=db.clients.find(c=>c.id===clientId)||{name:'—'};
  const co=db.company||{};
  const pdfFileName='فاتورة_اعمال_'+client.name+'_'+invNo;
  setPrintFile('grouped',client.name,invNo,!withPrices);

  const records=db.maintenance.filter(m=>{
    if(m.clientId!==clientId) return false;
    if(branch&&m.branch!==branch) return false;
    if(from&&m.startDate&&m.startDate<from) return false;
    if(to&&m.startDate&&m.startDate>to) return false;
    return true;
  }).sort((a,b)=>new Date(a.startDate||0)-new Date(b.startDate||0));

  if(!records.length){alert('لا يوجد أعمال لطباعتها');return;}

  const distinctCurrencies=[...new Set(records.map(m=>m.currency||'SYP'))];
  if(distinctCurrencies.length>1){
    alert('⚠️ لا يمكن إصدار الفاتورة: الأعمال المحددة لهذا العميل مسجّلة بعملات مختلفة ('+distinctCurrencies.map(c=>curLabel(c)).join(' و ')+'). يرجى تضييق نطاق التاريخ/الفرع لتشمل عملة واحدة فقط، أو إصدار فاتورة منفصلة لكل عملة.');
    return;
  }

  const rawTotal=records.reduce((s,m)=>{
    const items=(m.workItems&&m.workItems.length)?m.workItems:[{price:getMaintenanceTotal(m)/(1-(m.discount||0)/100),qty:1}];
    return s+items.reduce((a,it)=>(a+((+it.qty||1)*(+it.price||0))),0);
  },0);
  const grandTotal=records.reduce((s,m)=>s+getMaintenanceTotal(m),0);
  const totalDisc=rawTotal-grandTotal;
  const totalAdvances=records.reduce((s,m)=>s+getMaintenanceAdvances(m),0);
  const netTotal=grandTotal-totalAdvances;
  const todayStr=fmtDate(new Date());

  const colCount=withPrices?7:5;
  let rowNum=0;
  const rowsHtml=records.map(m=>{
    rowNum++;
    // كل عمل (نوع + وصف خاص فيه + سعره الخاص) بيطلع سطر لحاله بالفاتورة، بدل ما ينلزقو كلهن بوصف واحد وسعر واحد
    const items=(m.workItems&&m.workItems.length)?m.workItems:[{type:(m.workTypes&&m.workTypes.join(' / '))||'',desc:m.workDesc||'',qty:1,price:getMaintenanceIncome(m)}];
    const span=items.length;
    return items.map((it,idx)=>{
      const qty=+it.qty||1;
      const price=+it.price||0;
      const lineTotal=qty*price;
      const sharedCols=idx===0?`
      <td rowspan="${span}">${fmtDate(m.startDate)}</td>
      <td rowspan="${span}" style="color:#6b7280">${esc(m.branch||'—')}</td>`:'';
      return `<tr>${sharedCols}
      <td style="font-weight:600;color:#334155">${esc(it.type||'—')}</td>
      <td style="color:#374151">${esc(it.desc||'—')}</td>
      <td style="text-align:center;font-weight:600">${qty}</td>
      ${withPrices?`<td style="text-align:right;color:#334155">${fmt(price)}</td><td style="text-align:right;font-weight:700;color:#334155">${fmt(lineTotal)}</td>`:''}
    </tr>`;
    }).join('');
  }).join('');

  const html=`
  <div class="print-doc">
    <div class="print-header">
      ${getCompanyHeader()}
      <div style="text-align:left; flex-shrink:0;">
        <div class="print-doc-type">${withPrices?'فاتورة أعمال مجمّعة':'وصف أعمال مجمّع'}</div>
        ${withPrices?`<div style="display:inline-block; background:#334155; color:#fff; border-radius:4px; padding:2px 6px; margin:3px 0;">
	          <div style="font-size:7px; opacity:.9; font-weight:600;">رقم الفاتورة</div>
	          <div style="font-size:10px; font-weight:800;">${esc(invNo)}</div>
	        </div>`:''}
        <div class="print-doc-meta">
          <b>التاريخ:</b> <b style="color:#1a1a2e">${todayStr}</b>
          ${from||to?`<br><b>الفترة:</b> ${from?fmtDate(from):'—'} إلى ${to?fmtDate(to):'—'}`:''}
        </div>
      </div>
    </div>

    <div class="print-to-section">
      <div class="print-to-box">
        <label>${withPrices?'فاتورة إلى':'مقدم إلى'}</label>
        <div class="val">${esc(client.name)}${branch?` — <span style="color:#1e293b; font-size:9px;">${esc(branch)}</span>`:''}</div>
        <div style="margin-top:4px; display:flex; flex-direction:column; gap:2px;">
          ${client.phone?`<div class="val-sub" style="display:flex; align-items:center; gap:4px;"><span style="color:#1e293b;">●</span> هاتف: ${esc(client.phone)}</div>`:''}
          ${client.address?`<div class="val-sub" style="display:flex; align-items:center; gap:4px;"><span style="color:#1e293b;">●</span> العنوان: ${esc(client.address)}</div>`:''}
        </div>
      </div>
			      <div class="print-to-box" style="${withPrices?'background:#ffffff; border-color:#93C5FD;':''}">
			        ${withPrices?`<label style="color:#1D4ED8;">صافي الأعمال</label>
			        <div style="font-size:15px; font-weight:900; color:#1E3A8A; line-height:1.1;">${fmt(grandTotal)}</div>
		        <div style="font-size:7.5px; color:#5B7DB1; margin-top:1px;">${records.length} عمل مجمّع ${totalDisc?`(بعد الحسميات)` : ''}</div>`:
        `<label>معلومات المستند</label>
        <div class="val-sub" style="line-height:1.9;">
          <b>عدد الأعمال:</b> ${records.length}<br>
          ${from||to?`<b>الفترة:</b> ${from?fmtDate(from):'—'} إلى ${to?fmtDate(to):'—'}`:''}
        </div>`}
      </div>
    </div>

    <table class="print-table" style="table-layout:fixed; width:100%;">
      <thead>
        <tr>
          <th style="width:70px; white-space:nowrap;">التاريخ</th>
          <th style="width:50px;">الفرع</th>
          <th style="width:55px;">نوع العمل</th>
          <th>وصف العمل</th>
          <th style="width:28px; text-align:center;">عدد</th>
          ${withPrices?'<th style="width:48px; text-align:right;">إفرادي</th><th style="width:52px; text-align:right;">الإجمالي</th>':''}
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
		      ${withPrices?`<tfoot>
		        ${totalDisc>0?`
		        <tr style="background:#f8f9fa; border-top:1.5px solid #e0e0e0;">
		          <td colspan="${colCount-1}" style="font-weight:700; font-size:9px; text-align:right; padding:5px 6px;">الإجمالي قبل الحسم</td>
		          <td style="font-weight:900; font-size:11px; color:#334155; text-align:right; padding:5px 6px;">${fmt(rawTotal)}</td>
		        </tr>
		        <tr style="background:#fff; border-top:1px solid #eee;">
		          <td colspan="${colCount-1}" style="font-weight:600; font-size:8.5px; text-align:right; padding:4px 6px; color:var(--salary);">إجمالي الحسومات على الأعمال</td>
		          <td style="font-weight:700; font-size:10px; color:var(--salary); text-align:right; padding:4px 6px;">-${fmt(totalDisc)}</td>
		        </tr>
		        <tr style="background:#f8f9fa; border-top:1px solid #e0e0e0;">
		          <td colspan="${colCount-1}" style="font-weight:700; font-size:9px; text-align:right; padding:5px 6px;">الصافي بعد الحسم</td>
		          <td style="font-weight:900; font-size:11px; color:#334155; text-align:right; padding:5px 6px;">${fmt(grandTotal)}</td>
		        </tr>` : `
		        <tr style="background:#f8f9fa; border-top:1.5px solid #e0e0e0;">
		          <td colspan="${colCount-1}" style="font-weight:700; font-size:9px; text-align:right; padding:5px 6px;">الإجمالي الصافي</td>
		          <td style="font-weight:900; font-size:11px; color:#334155; text-align:right; padding:5px 6px;">${fmt(grandTotal)}</td>
		        </tr>`}
	        ${totalAdvances > 0 ? `
	        <tr style="background:#fff; border-top:1px solid #eee;">
	          <td colspan="${colCount-1}" style="font-weight:600; font-size:8.5px; text-align:right; padding:4px 6px; color:#6b7280;">إجمالي الدفعات المسددة</td>
	          <td style="font-weight:700; font-size:10px; color:#059669; text-align:right; padding:4px 6px;">${fmt(totalAdvances)}</td>
	        </tr>
	        <tr style="background:#fef2f2; border-top:1px solid #fee2e2;">
	          <td colspan="${colCount-1}" style="font-weight:700; font-size:9px; text-align:right; padding:5px 6px; color:#991b1b;">صافي المبلغ المتبقي</td>
	          <td style="font-weight:900; font-size:11px; color:#dc2626; text-align:right; padding:5px 6px;">${fmt(netTotal)}</td>
	        </tr>` : ''}
	      </tfoot>`:''}
    </table>

    ${customNotes?`<div class="print-note-box"><b style="color:#1a1a2e;">📝 ملاحظات:</b><br>${formatNotesHTML(customNotes)}</div>`:''}
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
    <button onclick="doPrint()" style="background:#334155;color:white;border:none;border-radius:8px;padding:10px 22px;font-size:14px;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:6px">🖨️ طباعة</button>
    <button onclick="doSavePDF(this)" style="background:#2563eb;color:white;border:none;border-radius:8px;padding:10px 22px;font-size:14px;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:6px">📄 حفظ PDF</button>
    <button onclick="closePrintArea()" style="background:#f3f4f6;color:#374151;border:1px solid #ccc;border-radius:8px;padding:10px 22px;font-size:14px;cursor:pointer;font-weight:600">✕ إغلاق</button>
  </div>`;

  closeModal();
  showPrintDoc(html);
}

function exportSalesExcel(){
  const headers=['العميل','الفرع','المشروع','التاريخ','رقم الفاتورة','الصنف','القسم','Part Number','الكمية','سعر الشراء','سعر البيع','ربح الصنف','الوجهة','وصف المادة','ملاحظة داخلية','إجمالي التكلفة (الفاتورة)','إجمالي البيع (الفاتورة)','ربح الفاتورة','ملاحظات الفاتورة'];
  const rows=[];
  db.sales.slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).forEach(s=>{
    const invoiceProfit=saleFullProfit(s);
    const items=s.items&&s.items.length?s.items:[{}];
    items.forEach(item=>{
      rows.push([
        getClientName(s.clientId),
        s.branch||'',
        s.projectName||'',
        s.date||'',
        s.invoiceNo||'',
        item.type||item.desc||'',
        item.type||item.desc?DEPT_LABELS[itemDept(item)]:'',
        item.modelNumber||'',
        item.qty||'',
        item.costPrice||'',
        item.salePrice||'',
        item.costPrice||item.salePrice?(+item.salePrice||0)-(+item.costPrice||0):'',
        item.destination||'',
        item.note||'',
        item.note2||'',
        s.totalCost||0,
        s.totalPrice||0,
        invoiceProfit,
        s.notes||''
      ]);
    });
  });
  exportRowsToExcel('المبيعات','المبيعات',headers,rows);
}

function renderSales(el,acts){
  acts.innerHTML=`<button class="btn btn-primary" onclick="openSaleModal()"><i class="ti ti-plus"></i> فاتورة جديدة</button><button class="btn" onclick="exportSalesExcel()"><i class="ti ti-file-spreadsheet"></i> تصدير Excel</button>`;
  const cFilter=window._sC||'';
  const bFilter=window._sB||'';
  const pFilter=window._sP||'all';
  const sqFilter=(window._sQ||'').trim().toLowerCase();
  const dFilter=window._sDept||'all'; // T47: الكل / سيكيورتي / نتورك
  const sales=salesForDept(dFilter).filter(s=>{
    if(sqFilter&&!matchesListSearch(saleSearchText(s),sqFilter))return false;
    if(cFilter&&s.clientId!==cFilter)return false;
    if(bFilter&&s.branch!==bFilter)return false;
    if(pFilter!=='all'){
      const paid=+s.paidAmount||0,total=+s.totalPrice||0,rem=saleRemaining(s);
      const st=(rem<=0&&total>0)?'paid':((paid>0||saleDiscountTotal(s)>0)?'partial':'unpaid');
      if(st!==pFilter)return false;
    }
    return true;
  });
  const selClientForBranch=cFilter?db.clients.find(c=>c.id===cFilter):null;
  const availBranches=selClientForBranch&&selClientForBranch.branches?selClientForBranch.branches:
    [...new Set(db.sales.filter(s=>!cFilter||s.clientId===cFilter).map(s=>s.branch).filter(Boolean))];
  const tR=sales.reduce((s,x)=>s+toUSD(x.totalPrice,x.currency),0);
  const tC=sales.reduce((s,x)=>s+toUSD(x.totalCost,x.currency),0);
  const tRpaid=sales.reduce((s,x)=>s+toUSD(saleRecognizedRevenue(x),x.currency),0);
  const tCpaid=sales.reduce((s,x)=>s+toUSD(saleRecognizedCost(x),x.currency),0);
  const tOutstanding=sales.reduce((s,x)=>s+toUSD(saleRemaining(x),x.currency),0);
  el.innerHTML=`
  <div class="grid-4" style="margin-bottom:18px">
    <div class="metric-card"><div class="metric-label">إجمالي المبيعات <span style="font-size:9px;color:var(--text2);font-weight:400">(بالدولار)</span></div><div class="metric-value blue">${finValUSD(tR)}</div></div>
    <div class="metric-card"><div class="metric-label">إجمالي التكلفة <span style="font-size:9px;color:var(--text2);font-weight:400">(بالدولار)</span></div><div class="metric-value red">${finValUSD(tC)}</div></div>
    <div class="metric-card"><div class="metric-label">صافي ربح المبيعات <span style="font-size:10px;color:var(--text2);font-weight:400">(محقق حسب المدفوع فعلياً، بالدولار)</span></div><div class="metric-value green">${finValUSD(tRpaid-tCpaid,'profit')}</div></div>
    <div class="metric-card"><div class="metric-label">مستحق من العملاء <span style="font-size:9px;color:var(--text2);font-weight:400">(بالدولار)</span></div><div class="metric-value amber">${finValUSD(tOutstanding)}</div></div>
  </div>
  ${deptTabsHTML(dFilter,"window._sDept=d;window._salesPageSize=50;renderSales(document.getElementById('main-content'),document.getElementById('topbar-actions'))")}
  ${dFilter!=='all'?`<div style="font-size:12px;color:var(--text2);margin:-4px 0 12px">عرض أرقام <b>${esc(DEPT_LABELS[dFilter])}</b> فقط: بنود هالقسم بالفواتير، والخصم والدفعات والعمولة الثابتة موزّعة بنسبة صافي القسم. أزرار الصف (دفعة، طباعة، تعديل...) بتشتغل على الفاتورة كاملة.</div>`:''}
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">
      ${listSearchInput('_sQ','فاتورة، عميل، مشروع، Part Number…','sales')}
      <div class="form-group">
        <label class="form-label">العميل</label>
        <select class="form-control" style="width:200px" onchange="window._sC=this.value;window._sB='';window._salesPageSize=50;renderSales(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
          <option value="">الكل</option>
          ${db.clients.map(c=>`<option value="${c.id}" ${cFilter===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">الفرع</label>
        <select class="form-control" style="width:170px" onchange="window._sB=this.value;window._salesPageSize=50;renderSales(document.getElementById('main-content'),document.getElementById('topbar-actions'))" ${availBranches.length===0?'disabled':''}>
          <option value="">الكل</option>
          ${availBranches.map(b=>`<option value="${esc(b)}" ${bFilter===b?'selected':''}>${esc(b)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">حالة الدفع</label>
        <select class="form-control" style="width:160px" onchange="window._sP=this.value;window._salesPageSize=50;renderSales(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
          <option value="all" ${pFilter==='all'?'selected':''}>الكل</option>
          <option value="paid" ${pFilter==='paid'?'selected':''}>مدفوعة</option>
          <option value="partial" ${pFilter==='partial'?'selected':''}>جزئي</option>
          <option value="unpaid" ${pFilter==='unpaid'?'selected':''}>غير مدفوعة</option>
        </select>
      </div>
      ${(cFilter||bFilter||pFilter!=='all'||sqFilter)?`<div class="form-group" style="padding-bottom:6px"><button class="btn btn-sm" onclick="window._sC='';window._sB='';window._sP='all';window._sQ='';window._salesPageSize=50;renderSales(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-filter-off"></i> مسح الفلاتر</button></div>`:''}
      <div style="font-size:12px;color:var(--text2);padding-bottom:6px;margin-right:auto">${sales.length} فاتورة</div>
    </div>
  </div>
  ${bulkToolbar('sales',`
    <button class="btn btn-sm" style="background:var(--surface);color:var(--success);border-color:var(--success)" onclick="bulkSalesPayment(true)"><i class="ti ti-cash"></i> تحديد كـ مدفوعة (كامل)</button>
    <button class="btn btn-sm" style="background:var(--surface);color:var(--danger);border-color:var(--danger)" onclick="bulkSalesPayment(false)"><i class="ti ti-cash-off"></i> تحديد كـ غير مدفوعة</button>
    <button class="btn btn-sm" style="background:var(--surface);color:var(--accent-dark);border-color:var(--accent)" onclick="bulkPrintSales(true)"><i class="ti ti-printer"></i> طباعة بالأسعار</button>
    <button class="btn btn-sm" style="background:var(--surface);color:var(--info);border-color:var(--info)" onclick="bulkPrintSales(false)"><i class="ti ti-file-invoice"></i> طباعة بدون أسعار</button>
  `)}
  <div class="card">
    ${sales.length===0?`<div class="empty-state"><i class="ti ti-receipt"></i><p>لا يوجد فواتير مبيع ${(cFilter||bFilter||pFilter!=='all'||sqFilter)?'بهذا الفلتر':'بعد'}</p></div>`:`
    <div style="overflow-x:auto"><table class="responsive-table">
      <thead><tr><th style="width:32px"><input type="checkbox" ${sales.length>0&&sales.every(s=>bSel('sales').has(s.id))?'checked':''} onchange='bulkToggleAll("sales",this,${esc(JSON.stringify(sales.map(s=>s.id)))})'></th><th>العميل / الفرع</th><th>المشروع</th><th>التاريخ</th><th>عدد الأصناف</th><th>سعر البيع</th><th>التكلفة</th><th>الربح</th><th>حالة الدفع</th><th>الدفعات</th><th>الفاتورة</th><th></th></tr></thead>
      <tbody>
        ${(()=>{const sortedSales=sales.slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));window._salesSorted=sortedSales;const pageSize=window._salesPageSize||50;return sortedSales.slice(0,pageSize);})().map(s=>{
          const profit=saleFullProfit(s);
          const so=s._sliceDept?(db.sales.find(x=>x.id===s.id)||s):s; // الفاتورة الأصلية (للعمولة والوسم)
          return `<tr>
            <td data-label=""><input type="checkbox" ${bSel('sales').has(s.id)?'checked':''} onchange="bulkToggleRow('sales','${s.id}',this)"></td>
            <td data-label="العميل / الفرع"><div style="font-weight:600">${esc(getClientName(s.clientId))}</div><div style="font-size:11px;color:var(--text2)">${esc(s.branch||'')}</div></td>
            <td data-label="المشروع">${esc(s.projectName||'—')}</td>
            <td data-label="التاريخ">${fmtDate(s.date)}</td>
            <td data-label="عدد الأصناف" style="text-align:center">${s.items?s.items.length:0} صنف</td>
            <td data-label="سعر البيع" style="font-weight:700">${fmt(s.totalPrice)} <span style="font-size:10px;color:var(--text2)">${curLabel(s.currency)}</span></td>
            <td data-label="التكلفة" style="color:var(--danger)">${finVal(s.totalCost)}</td>
            <td data-label="الربح" style="color:var(--accent);font-weight:700">${finVal(profit,'profit')}</td>
            <td data-label="حالة الدفع">${saleStatusBadge(s)}</td>
            <td data-label="الدفعات">${renderSalePaymentsCell(s)}</td>
            <td data-label="الفاتورة" style="font-size:12px;color:var(--text2)">${s.invoiceNo||'—'}<div style="margin-top:3px">${deptBadgeHTML(saleDeptTag(so))}</div></td>
            <td data-label=""><div class="row-menu-wrap">
              <button class="row-menu-btn" onclick="toggleRowMenu(this,event)">⋮</button>
              <div class="row-menu-list">
                <button class="row-menu-item" onclick="viewSaleItems('${s.id}')"><i class="ti ti-eye"></i> عرض التفاصيل</button>
                <button class="row-menu-item" onclick="openSalePaymentModal('${s.id}')"><i class="ti ti-cash"></i> تسديد دفعة</button>
                ${saleReferralCommission(so)>0?(s.commissionPaid?
                  `<button class="row-menu-item green" title="بتاريخ ${fmtDate(s.commissionPaidDate)}" onclick="if(confirm('التراجع عن تسديد العمولة لهذه الفاتورة؟'))unpaySaleCommission('${s.id}')"><i class="ti ti-user-check"></i> عمولة مدفوعة (${fmt(saleReferralCommission(so))}) — تراجع</button>`
                  :`<button class="row-menu-item gold" onclick="if(confirm('تأكيد تسديد العمولة (${fmt(saleReferralCommission(so))})؟'))paySaleCommission('${s.id}')"><i class="ti ti-user-exclamation"></i> تسديد عمولة (${fmt(saleReferralCommission(so))})</button>`
                ):''}
                ${(()=>{const cl=db.clients.find(c=>c.id===s.clientId);return cl&&cl.referrerName?`<button class="row-menu-item" onclick="openEditCommissionModal('sales','${s.id}')"><i class="ti ti-percentage"></i> تعديل العمولة</button>`:'';})()}
                <button class="row-menu-item" onclick="printInvoice('${s.id}',true)"><i class="ti ti-printer"></i> طباعة بالأسعار</button>
                <button class="row-menu-item" onclick="printInvoice('${s.id}',false)"><i class="ti ti-file-invoice"></i> طباعة بدون أسعار</button>
                <button class="row-menu-item" onclick="openSaleModal('${s.id}')"><i class="ti ti-edit"></i> تعديل</button>
                <button class="row-menu-item" onclick="duplicateSale('${s.id}')"><i class="ti ti-copy"></i> نسخ كفاتورة جديدة</button>
                <button class="row-menu-item danger" onclick="deleteItem('sales','${s.id}')"><i class="ti ti-trash"></i> حذف</button>
              </div>
            </div></td>
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot><tr class="summary-row"><td colspan="5">الإجمالي</td><td>${fmt(tR)}</td><td style="color:var(--danger)">${finVal(tC)}</td><td style="color:var(--accent)">${finVal(tR-tC,'profit')}</td><td colspan="4"></td></tr></tfoot>
    </table></div>
    ${sales.length>(window._salesPageSize||50)?`<div style="text-align:center;padding:14px"><button class="btn" onclick="window._salesPageSize=(window._salesPageSize||50)+50;renderSales(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-chevron-down"></i> تحميل المزيد (${sales.length-(window._salesPageSize||50)} متبقي)</button></div>`:''}`}
  </div>`;
}

function bulkSalesPayment(paid){
  const s=bSel('sales');
  if(s.size===0)return;
  let dateVal='';
  if(paid){
    dateVal=prompt(`تاريخ التسديد لـ ${s.size} فاتورة محددة:`,localToday());
    if(dateVal===null)return;
    if(!dateVal)dateVal=localToday();
  }
  if(!confirm(`تأكيد تحديد ${s.size} فاتورة كـ "${paid?'مدفوعة بالكامل':'غير مدفوعة'}"؟`))return;
  db.sales.forEach(x=>{
    if(!s.has(x.id))return;
    const total=+x.totalPrice||0;
    if(paid){
      const currentPaid=+x.paidAmount||0;
      const currentDisc=saleDiscountTotal(x);
      const remaining=round2(total-currentPaid-currentDisc);
      if(remaining>0){
        if(!x.payments)x.payments=[];
        x.payments.push({id:uid(),amount:remaining,currency:x.currency||'SYP',date:dateVal,note:'تسديد جماعي',convertedAmount:remaining,rateUsed:getExchangeRate()});
      }
      x.paidAmount=round2(total-currentDisc);
    }else{
      x.paidAmount=0;
      x.discAmount=0; // T4: تصفير الخصم عند الإلغاء
      x.payments=[];
    }
  });
  saveDB(db);
  s.clear();
  rerenderPage('sales');
}

function viewSaleItems(saleId){
  const s=db.sales.find(x=>x.id===saleId);
  if(!s)return;
  showModal(`
    <div class="modal-title">تفاصيل فاتورة — ${esc(getClientName(s.clientId))}${s.branch?' / '+esc(s.branch):''}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px">${esc(s.projectName||'')} · ${fmtDate(s.date)}</div>
    
    <div class="section-title">الأصناف</div>
    <div style="overflow-x:auto; margin-bottom:16px;">
      <table>
        <thead><tr><th>الصنف</th><th>القسم</th><th>الكمية</th><th>سعر الشراء</th><th>سعر البيع</th><th>ربح الوحدة</th><th>الوجهة</th><th>ملاحظة</th></tr></thead>
        <tbody>
          ${(s.items||[]).map(item=>`<tr>
            <td style="font-weight:600">${esc(item.type||item.desc||'—')}</td>
            <td>${deptBadgeHTML(itemDept(item))}</td>
            <td>${item.qty||1}</td>
            <td>${finVal(item.costPrice)}</td>
            <td>${fmt(item.salePrice)}</td>
            <td style="color:var(--accent)">${finVal((+item.salePrice||0)-(+item.costPrice||0),'profit')}</td>
            <td style="font-size:12px">${esc(item.destination||'—')}</td>
            <td style="font-size:12px">${esc(item.note||'—')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    ${(()=>{const bdV=saleSectionBreakdown(s);return bdV.activeKeys.length>1&&canViewTotals()?`<div class="section-title">توزيع الأقسام <span style="font-weight:400;color:var(--text2);font-size:11px">(الخصم موزّع بنسبة مبيعات كل قسم)</span></div><div style="overflow-x:auto;margin-bottom:16px">${deptBreakdownTableHTML(bdV,curLabel(s.currency),canViewProfits())}</div>`:'';})()}
    <div class="section-title">سجل الدفعات</div>
    <div style="overflow-x:auto; margin-bottom:16px;">
      ${(!s.payments || s.payments.length === 0) ? `<div style="text-align:center; padding:10px; background:var(--bg2); border-radius:8px; font-size:12px; color:var(--text2);">لا يوجد دفعات مسجلة بعد</div>` : `
      <table>
        <thead><tr><th>التاريخ</th><th>المبلغ</th><th>خصم عند التحصيل</th><th>ملاحظة</th><th></th></tr></thead>
        <tbody>
          ${s.payments.map(p=>`<tr>
            <td>${fmtDate(p.date)}</td>
            <td style="font-weight:700">${fmt(p.amount)} <span style="font-size:10px;color:var(--text2)">${curLabel(p.currency||s.currency)}</span></td>
            <td style="font-weight:700;color:var(--gold-dark)">${p.discount?fmt(p.discount):'—'}</td>
            <td style="font-size:12px">${esc(p.note||'—')}</td>
            <td>
              <div class="action-btns">
                <button class="btn btn-sm" onclick="editSalePayment('${s.id}', '${p.id}')"><i class="ti ti-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteSalePayment('${s.id}', '${p.id}')"><i class="ti ti-trash"></i></button>
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`}
    </div>

    <div style="margin-top:12px;background:var(--bg2);border-radius:8px;padding:12px;display:flex;gap:24px;font-size:13px;flex-wrap:wrap">
      <span>إجمالي التكلفة: <b>${finVal(s.totalCost)}</b></span>
      <span>إجمالي البيع: <b>${fmt(s.totalPrice)}</b></span>
      <span style="color:var(--accent)">الربح الكلي: <b>${finVal(saleFullProfit(s),'profit')}</b>${infoTip('الربح الكلي النظري للفاتورة بافتراض تحصيل كامل المبلغ. قد يختلف عن الربح المحقق فعلياً إذا لم تُسدَّد الفاتورة بالكامل.')}</span>
      ${saleDiscountTotal(s)>0?`<span style="color:var(--gold-dark)">خصم عند التحصيل: <b>${fmt(saleDiscountTotal(s))}</b></span>`:''}
      <span style="color:var(--danger)">صافي المبلغ المتبقي: <b>${fmt(saleRemaining(s))}</b></span>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="printInvoice('${saleId}',true)"><i class="ti ti-printer"></i> طباعة الفاتورة (بالأسعار)</button>
      <button class="btn" onclick="printInvoice('${saleId}',false)"><i class="ti ti-file-invoice"></i> طباعة وصف الأعمال (بدون أسعار)</button>
      <button class="btn" onclick="closeModal();duplicateSale('${saleId}')"><i class="ti ti-copy"></i> نسخ كفاتورة جديدة</button>
      <button class="btn" onclick="closeModal()">إغلاق</button>
    </div>
  `);
}

function duplicateSale(id){
  const orig=db.sales.find(x=>x.id===id);
  if(!orig)return;
  const today=localToday();
  const seed=JSON.parse(JSON.stringify(orig));
  delete seed.id;
  seed.date=today;
  seed.invoiceNo='';
  seed.paidAmount=0;
  seed.payments=[];
  openSaleModal(null,seed);
}

function openSaleModal(editId,seed){
  const s=editId?db.sales.find(x=>x.id===editId):(seed||null);
  window._sI=s&&s.items?JSON.parse(JSON.stringify(s.items)):[];
  window._saleProfitMode=!!(s&&s.profitMode==='total');
  window._saleTotalProfitVal=s&&s.totalProfitTarget!==undefined?s.totalProfitTarget:'';
  chargesInit(s,'s');
  showModal(`
    <div class="modal-title">${editId?'تعديل فاتورة':(seed?'نسخ فاتورة — فاتورة جديدة':'فاتورة مبيع جديدة')}</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">العميل <span style="font-size:11px;color:var(--text2);font-weight:400">(اكتب اسماً جديداً لإضافته تلقائياً)</span></label>
        <input type="text" class="form-control" id="s-client-name" list="s-client-list"
          value="${s&&s.clientId?getClientName(s.clientId):s&&s.clientNameFree?s.clientNameFree:''}"
          placeholder="اكتب اسم العميل أو اختر من القائمة"
          autocomplete="off" oninput="updateSaleBranches()">
        <datalist id="s-client-list">
          ${db.clients.map(c=>`<option value="${esc(c.name)}"></option>`).join('')}
        </datalist>
        <div id="s-client-phone-wrap" style="display:none;margin-top:6px"><input type="text" class="form-control" id="s-client-phone" placeholder="رقم هاتف العميل الجديد (اختياري)"></div>
      </div>
      <div class="form-group"><label class="form-label">الفرع</label><select class="form-control" id="s-branch"></select></div>
    </div>
    <div class="form-row cols-3">
      <div class="form-group"><label class="form-label">اسم المشروع <span style="font-size:11px;color:var(--text2);font-weight:400">(اختياري)</span></label>${projectInputHTML('s-project',s&&s.projectName?s.projectName:'')}</div>
      <div class="form-group"><label class="form-label">تاريخ الفاتورة</label><input type="date" class="form-control" id="s-date" value="${s&&s.date?s.date:''}"></div>
      <div class="form-group"><label class="form-label">رقم الفاتورة <span style="font-size:11px;color:var(--text2);font-weight:400">(تلقائي)</span></label><input type="text" class="form-control" id="s-invoice" value="${s&&s.invoiceNo?s.invoiceNo:genInvoiceNo('SALE',db.sales)}" readonly style="background:var(--bg2)"></div>
      <div class="form-group"><label class="form-label">عملة الفاتورة</label>${currencySelectHTML('s-currency',s&&s.currency?s.currency:'USD')}</div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
      <div style="font-weight:700;font-size:13px">الأصناف</div>
      <label class="checkbox-label" style="font-weight:600"><input type="checkbox" id="s-profit-mode" ${window._saleProfitMode?'checked':''} onchange="toggleSaleProfitMode()"> <span>تحديد ربح إجمالي للطلبية بدل سعر كل قطعة</span></label>
    </div>
    <div id="sale-items-list">${renderSaleItems()}</div>
    <button class="btn btn-sm" onclick="addSaleItem()" style="margin-bottom:14px"><i class="ti ti-plus"></i> إضافة صنف</button>
    <div class="form-row cols-3" style="margin-bottom:12px">
      <div class="form-group"><label class="form-label">نسبة الحسم (%)</label><input type="number" min="0" max="100" step="any" class="form-control" id="s-discount" value="${s&&s.discount?s.discount:''}" oninput="refreshSaleTotals()"></div>
      <div id="sale-totals" class="form-group" style="grid-column: span 2; background:var(--bg2);border-radius:8px;padding:12px;font-size:13px;justify-content:center">${renderSaleTotals()}</div>
    </div>
    ${chargesBlockHTML()}
    <div class="form-row cols-3" id="s-commission-wrap" style="display:none;margin-bottom:12px">
      <div class="form-group">
        <label class="form-label" style="color:var(--gold-dark)">العمولة <i class="ti ti-user-check"></i></label>
        <div style="display:flex;gap:10px;margin-bottom:6px">
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="radio" name="s-commission-type" value="percent" ${!s||s.commissionType!=='amount'?'checked':''} onchange="refreshSaleTotals()"> نسبة %</label>
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="radio" name="s-commission-type" value="amount" ${s&&s.commissionType==='amount'?'checked':''} onchange="refreshSaleTotals()"> مبلغ ثابت</label>
        </div>
        <input type="number" class="form-control" id="s-commission" value="${s&&s.commissionType==='amount'?(s.commissionAmount||''):(s&&s.commissionPercent?s.commissionPercent:'')}" min="0" step="0.5" placeholder="مثال: 15" oninput="refreshSaleTotals()">
      </div>
      <div class="form-group" style="grid-column: span 2;display:flex;align-items:flex-end"><div style="font-size:11px;color:var(--text2)" id="s-commission-hint"></div></div>
      <div class="form-group" style="grid-column: span 3">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--gold-dark);cursor:pointer">
          <input type="checkbox" id="s-commission-settlement" ${s&&s.commissionSettlement?'checked':''}>
          تسوية يدوية (مش عمولة حقيقية — هالمبلغ رح يُخصم من الربح متل العادة، بس ما رح يُحتسب ضمن تقارير/متوسطات العمولة)
        </label>
      </div>
    </div>
    <div class="form-group"><label class="form-label">ملاحظات</label><textarea class="form-control" id="s-notes" rows="2" placeholder="كل سطر = ملاحظة، وبتترقم تلقائياً بالطباعة">${esc(s&&s.notes?s.notes:'')}</textarea></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveSale('${editId||''}')">حفظ الفاتورة</button></div>
  `);
  setTimeout(()=>updateSaleBranches(s&&s.branch?s.branch:null),30);
}

function renderSaleItems(){
  if(!window._sI||!window._sI.length)return '<div style="color:var(--text2);font-size:12px;margin-bottom:10px;text-align:center;padding:14px;background:var(--bg2);border-radius:8px;border:1px dashed var(--border2)">لا يوجد أصناف — اضغط إضافة</div>';
  const saleCurEl=document.getElementById('s-currency');
  const saleCur=saleCurEl&&saleCurEl.value==='SYP'?'SYP':'USD';
  return window._sI.map((item,i)=>{
    const sugg=getSuggestedPrice(item.type,saleCur);
    return `
    <div style="background:var(--bg2);border-radius:8px;padding:10px;margin-bottom:8px;border:1px solid var(--border)">
      <div style="display:grid;grid-template-columns:2fr 80px 1fr 1fr auto;gap:6px;align-items:center">
        <select class="form-control" onchange="window._sI[${i}].type=this.value;document.getElementById('sale-items-list').innerHTML=renderSaleItems()">${db.deviceTypes.map(t=>`<option ${item.type===t?'selected':''}>${esc(t)}</option>`).join('')}</select>
        <input type="number" class="form-control" placeholder="الكمية" value="${esc(item.qty||1)}" min="1" onchange="window._sI[${i}].qty=this.value;${window._saleProfitMode?'distributeSaleProfit();':'refreshSaleTotals()'}">
        <input type="text" inputmode="decimal" class="form-control" placeholder="سعر الشراء" value="${item.costPrice?fmt(item.costPrice):''}" oninput="formatMoneyInput(this)" onchange="window._sI[${i}].costPrice=unformatNum(this.value);${window._saleProfitMode?'distributeSaleProfit();':'refreshSaleTotals()'}">
        ${window._saleProfitMode?
          `<input type="text" class="form-control" value="${item.salePrice?fmt(item.salePrice):'—'}" readonly title="سعر البيع محسوب تلقائياً حسب الربح الإجمالي للطلبية" style="background:var(--bg2);color:var(--text2)">`
          :`<input type="text" inputmode="decimal" class="form-control" placeholder="سعر البيع" value="${item.salePrice?fmt(item.salePrice):''}" oninput="formatMoneyInput(this)" onchange="window._sI[${i}].salePrice=unformatNum(this.value);refreshSaleTotals()">`}
        <button class="btn btn-sm btn-danger" onclick="window._sI.splice(${i},1);document.getElementById('sale-items-list').innerHTML=renderSaleItems();${window._saleProfitMode?'distributeSaleProfit();':'refreshSaleTotals()'}"><i class="ti ti-x"></i></button>
      </div>
      ${invLinkSelect('_sI',i,item.itemId)}
      <div style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;color:var(--text2)"><span>القسم:</span>
        <select class="form-control" style="width:auto;min-width:150px;padding:3px 8px;font-size:11px" onchange="window._sI[${i}].department=this.value">
          <option value="" ${!item.department?'selected':''}>تلقائي (${esc(DEPT_SHORT[itemDept({type:item.type})])})</option>
          <option value="security" ${item.department==='security'?'selected':''}>${esc(DEPT_LABELS.security)}</option>
          <option value="network" ${item.department==='network'?'selected':''}>${esc(DEPT_LABELS.network)}</option>
        </select></div>
      ${sugg?`<div style="font-size:11px;color:var(--text2);margin-top:4px">💡 آخر سعر بيع لهذا الصنف (محوّل لـ${curLabel(saleCur)}): <b>${fmt(sugg.last)}</b> (متوسط ${sugg.count} عملية: ${fmt(sugg.avg)}) — <span style="cursor:pointer;color:var(--accent);text-decoration:underline" onclick="window._sI[${i}].salePrice=${sugg.last};document.getElementById('sale-items-list').innerHTML=renderSaleItems();refreshSaleTotals()">استخدام هذا السعر</span></div>`:''}
      ${(()=>{const filled=['note','note2','destination','modelNumber'].filter(k=>item[k]);return `
      <details class="opt-details" ${filled.length?'open':''}>
        <summary>تفاصيل إضافية (وصف المادة، Part Number، ملاحظة، وجهة تركيب)${filled.length?`<span class="opt-badge">${filled.length}</span>`:''}</summary>
        <div class="opt-body" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-top:6px">
          <div><input type="text" class="form-control" id="sale-note-${i}" list="note-list-${i}" placeholder="وصف المادة (يظهر بالطباعة)" value="${esc(item.note||'')}" onchange="window._sI[${i}].note=this.value"><datalist id="note-list-${i}">${getItemNoteSuggestions(item.type).map(v=>`<option value="${esc(v)}">`).join('')}</datalist></div>
          <div><input type="text" class="form-control" list="model-list-${i}" placeholder="Part Number" value="${esc(item.modelNumber||'')}" onchange="window._sI[${i}].modelNumber=this.value;ensureModelNumberInList(this.value);autofillPartDesc(this.value,window._sI,${i},'note','sale-note-${i}')"><datalist id="model-list-${i}">${(db.modelNumbers||[]).map(v=>`<option value="${esc(v)}">`).join('')}</datalist></div>
          <div><input type="text" class="form-control" placeholder="ملاحظة (داخلية، لا تظهر بالطباعة)" value="${esc(item.note2||'')}" onchange="window._sI[${i}].note2=this.value"></div>
          <div><input type="text" class="form-control" list="dest-list-${i}" placeholder="الوجهة / مكان التركيب" value="${esc(item.destination||'')}" onchange="window._sI[${i}].destination=this.value"><datalist id="dest-list-${i}">${getDestinationSuggestions().map(v=>`<option value="${esc(v)}">`).join('')}</datalist></div>
        </div>
      </details>`;})()}
    </div>
  `;}).join('');
}

function renderSaleTotals(){
  const items=window._sI||[];
  const discEl=document.getElementById('s-discount');
  const discount=discEl?clampDiscountPct(+discEl.value||0):clampDiscountPct(window._sD||0);
  const tC=items.reduce((s,item)=>s+(+item.costPrice||0)*(+item.qty||1),0);
  const tS_raw=items.reduce((s,item)=>s+(+item.salePrice||0)*(+item.qty||1),0);
  const tS=tS_raw * (1 - discount/100);
  const grossProfit=tS-tC;
  const client=findClientByTypedName('s-client-name');
  const hasReferrer=!!(client&&client.referrerName);
  const commEl=document.getElementById('s-commission');
  const commTypeEl=document.querySelector('input[name="s-commission-type"]:checked');
  const commType=commTypeEl?commTypeEl.value:'percent';
  const commVal=commEl?(+commEl.value||0):0;
  const hasCommission=hasReferrer&&commVal>0;
  const commission=hasCommission?(commType==='amount'?commVal:(grossProfit>0?grossProfit*(commVal/100):0)):0;
  const profit=grossProfit-commission;
  const wrap=document.getElementById('s-commission-wrap');
  if(wrap){
    wrap.style.display=hasReferrer?'':'none';
    const hint=document.getElementById('s-commission-hint');
    if(hint)hint.textContent=hasReferrer?`موصى من "${esc(client.referrerName)}" — حدد ${commType==='amount'?'المبلغ':'النسبة'}.`:'';
  }
  const profitModeRow=window._saleProfitMode?`<div style="margin-bottom:10px;display:flex;align-items:center;gap:10px"><label class="form-label" style="margin:0">الربح الإجمالي المطلوب للطلبية</label><input type="text" inputmode="decimal" class="form-control" id="s-total-profit" style="max-width:180px" placeholder="مثال: 50" value="${window._saleTotalProfitVal!==''&&window._saleTotalProfitVal!==undefined?fmt(window._saleTotalProfitVal):''}" oninput="formatMoneyInput(this);distributeSaleProfit()"><span style="font-size:11px;color:var(--text2)">يتوزع تلقائياً على القطع</span></div>`:'';
  return `${profitModeRow}<div style="display:flex;gap:18px;flex-wrap:wrap"><span>التكلفة: <b style="color:var(--danger)">${fmt(tC)}</b></span><span>قبل الحسم: <b>${fmt(tS_raw)}</b></span><span>الصافي: <b style="color:var(--accent)">${fmt(tS)}</b></span>${chargesTotalsHTML(tS,'')}${hasCommission?`<span style="color:var(--gold-dark)">${(document.getElementById('s-commission-settlement')&&document.getElementById('s-commission-settlement').checked)?'تسوية يدوية':'عمولة'} (${esc(client.referrerName)} — ${commType==='amount'?fmt(commVal):commVal+'%'}): <b>${fmt(commission)}</b></span>`:''}<span>الربح${hasCommission?' بعد العمولة':''}: <b style="color:var(--accent)">${fmt(profit)}</b></span></div>`;
}

function refreshSaleTotals(){const el=document.getElementById('sale-totals');if(el)el.innerHTML=renderSaleTotals();}

function addSaleItem(){if(!window._sI)window._sI=[];const last=window._sI[window._sI.length-1];window._sI.push({type:last?last.type:(db.deviceTypes[0]||'Camera'),qty:1,costPrice:'',salePrice:'',note:'',note2:'',destination:last?last.destination:''});document.getElementById('sale-items-list').innerHTML=renderSaleItems();if(window._saleProfitMode)distributeSaleProfit();else refreshSaleTotals();}

function toggleSaleProfitMode(){
  const cb=document.getElementById('s-profit-mode');
  window._saleProfitMode=cb&&cb.checked;
  if(window._saleProfitMode){
    // عند التفعيل: نحسب الربح الحالي (من الأسعار المُدخلة إن وجدت) كقيمة بداية
    const items=window._sI||[];
    const tC=items.reduce((s,item)=>s+(+item.costPrice||0)*(+item.qty||1),0);
    const tS=items.reduce((s,item)=>s+(+item.salePrice||0)*(+item.qty||1),0);
    if(window._saleTotalProfitVal===''||window._saleTotalProfitVal===undefined)window._saleTotalProfitVal=(tS-tC)>0?(tS-tC):'';
  }
  document.getElementById('sale-items-list').innerHTML=renderSaleItems();
  refreshSaleTotals();
}

function distributeSaleProfit(){
  const profitEl=document.getElementById('s-total-profit');
  const targetProfit=profitEl?(+unformatNum(profitEl.value)||0):(+window._saleTotalProfitVal||0);
  window._saleTotalProfitVal=targetProfit;
  const items=window._sI||[];
  const totalCostWeighted=items.reduce((s,item)=>s+(+item.costPrice||0)*(+item.qty||1),0);
  const totalQty=items.reduce((s,item)=>s+(+item.qty||1),0);
  items.forEach(item=>{
    const qty=+item.qty||1;
    const cost=+item.costPrice||0;
    let share;
    if(totalCostWeighted>0){
      share=((cost*qty)/totalCostWeighted)*targetProfit;
    }else if(totalQty>0){
      share=(qty/totalQty)*targetProfit;
    }else{
      share=0;
    }
    item.salePrice=qty>0?(cost+(share/qty)):cost;
  });
  document.getElementById('sale-items-list').innerHTML=renderSaleItems();
  refreshSaleTotals();
}

function updateSaleBranches(sel){
  const nameEl=document.getElementById('s-client-name');
  const typedName=nameEl?nameEl.value.trim():'';
  const client=db.clients.find(c=>c.name.trim()===typedName);
  const b=document.getElementById('s-branch');
  if(b)b.innerHTML=client&&client.branches&&client.branches.length?client.branches.map(br=>`<option ${sel===br?'selected':''}>${br}</option>`).join(''):'<option value="">—</option>';
  const phoneWrap=document.getElementById('s-client-phone-wrap');
  if(phoneWrap)phoneWrap.style.display=(typedName&&!client)?'block':'none';
  if(client){
    const discEl=document.getElementById('s-discount');
    if(discEl&&!discEl.value){
      const lastS=db.sales.filter(x=>x.clientId===client.id&&x.discount).sort((a,b2)=>new Date(b2.date||0)-new Date(a.date||0))[0];
      if(lastS)discEl.value=lastS.discount;
    }
    const commEl=document.getElementById('s-commission');
    if(commEl&&!commEl.value&&client.referrerName){
      const lastC=db.sales.filter(x=>x.clientId===client.id&&(x.commissionPercent||x.commissionAmount)).sort((a,b2)=>new Date(b2.date||0)-new Date(a.date||0))[0];
      if(lastC){
        const isAmount=lastC.commissionType==='amount';
        const radio=document.querySelector(`input[name="s-commission-type"][value="${isAmount?'amount':'percent'}"]`);
        if(radio)radio.checked=true;
        commEl.value=isAmount?lastC.commissionAmount:lastC.commissionPercent;
      }
    }
  }
  refreshSaleTotals();
}

function saveSale(editId){
  // شبكة أمان: إذا وضعية "ربح إجمالي للطلبية" مفعّلة، لازم نتأكد إنو التوزيع صار فعلاً
  // ومحسوب لكل قطعة قبل ما نكمل — حتى لو لأي سبب ما انحسب لحظة الكتابة بالخانة
  if(window._saleProfitMode)distributeSaleProfit();
  const typedName=(document.getElementById('s-client-name').value||'').trim();
  if(!typedName){alert('يرجى إدخال اسم العميل');return;}
  // Try to match an existing client by name (case-insensitive)
  let matchedClient=db.clients.find(c=>c.name.trim()===typedName);
  // If no match, auto-add as new client
  if(!matchedClient){
    if(!confirm(`"${typedName}" غير موجود في قائمة العملاء. هل تريد إضافته تلقائياً؟`))return;
    const newPhoneEl=document.getElementById('s-client-phone');
    matchedClient={id:uid(),name:typedName,phone:newPhoneEl?newPhoneEl.value.trim():'',address:'',branches:[]};
    db.clients.push(matchedClient);
  }
  const clientId=matchedClient.id;
  const clientNameFree='';
  const branch=document.getElementById('s-branch').value;
  const projectName=(document.getElementById('s-project').value||'').trim();
  if(projectName)findOrCreateProject(projectName);
  const date=document.getElementById('s-date').value;
  const invoiceNo=document.getElementById('s-invoice').value;
  if(invoiceNo&&db.sales.some(x=>x.id!==editId&&x.invoiceNo===invoiceNo)){alert(`تنبيه: رقم الفاتورة (${invoiceNo}) مستخدم من قبل بفاتورة أخرى. يرجى مراجعة الأمر.`);return;}
  const notes=document.getElementById('s-notes').value;
  const items=window._sI||[];
  const discount=+document.getElementById('s-discount').value||0;
  if(discount<0||discount>100){alert('نسبة الحسم لازم تكون بين 0 و100');return;}
  const commEl=document.getElementById('s-commission');
  const commTypeSelEl=document.querySelector('input[name="s-commission-type"]:checked');
  const commissionType=commTypeSelEl?commTypeSelEl.value:'percent';
  const commissionPercent=commEl&&commissionType!=='amount'?(+commEl.value||0):0;
  const commissionAmount=commEl&&commissionType==='amount'?(+commEl.value||0):0;
  const commSetEl=document.getElementById('s-commission-settlement');
  const commissionSettlement=commSetEl?commSetEl.checked:false;
  items.forEach(i=>{if(DEPT_KEYS.indexOf(i.department)<0)delete i.department;}); // T46: القسم اليدوي بس لو صالح، وإلا تلقائي من نوع الجهاز
  const totalCost=items.reduce((s,i)=>s+(+i.costPrice||0)*(+i.qty||1),0);
  const rawPrice=items.reduce((s,i)=>s+(+i.salePrice||0)*(+i.qty||1),0);
  const totalPrice=round2(rawPrice * (1 - discount/100));
  const chg=chargesCollect(totalPrice);
  const currencyEl=document.getElementById('s-currency');
  const currency=currencyEl&&currencyEl.value==='USD'?'USD':'SYP';
  // تحذير أساسي: سعر بيع صفر بينما في تكلفة حقيقية — هاد بالضبط الغلط يلي بيصير لو نسي حدا
  // يدخل سعر البيع، أو كان بوضعية "ربح إجمالي" وما تم حساب التوزيع قبل الحفظ
  if(totalCost>0&&totalPrice<=0){
    if(!confirm(`⚠️ تنبيه مهم: سعر البيع بهذه الفاتورة صفر بينما التكلفة ${fmt(totalCost)}!\nهيك الفاتورة رح تنحفظ بخسارة كاملة (${fmt(totalCost)}) ولن يكون فيها أي مبلغ مستحق على العميل.\nإذا كنت بوضعية "ربح إجمالي للطلبية"، تأكد إنك كتبت رقم الربح وانتظرت حتى يظهر سعر البيع لكل قطعة.\nمتأكد بدك تحفظ الفاتورة هيك بسعر بيع صفر؟`))return;
  }
  // تحذير هامش ربح منخفض قبل حفظ فاتورة المبيع (نفس منطق عروض الأسعار)
  if(totalCost>0&&totalPrice>0){
    const marginPct=marginPctOf(totalPrice,totalCost);
    const minMargin=getLowMarginPercent();
    if(marginPct<minMargin){
      if(!confirm(`⚠️ تحذير: هامش الربح بهذه الفاتورة ${marginPct.toFixed(1)}% وهو أقل من الحد الأدنى المحدد (${minMargin}%).\nمتأكد بدك تحفظ الفاتورة بهذا السعر؟`))return;
    }
  }
  const existing=editId?db.sales.find(x=>x.id===editId):null;
  const paidAmount=existing?(+existing.paidAmount||0):0;
  const payments=existing?(existing.payments||[]):[];
  if(!editId){ if(!checkClientDebtWarning(clientId)) return; }
  const quoteId=existing?existing.quoteId||'':'';
  const exchangeRateAtEntry=existing&&existing.exchangeRateAtEntry?existing.exchangeRateAtEntry:getExchangeRate();
  const profitMode=window._saleProfitMode?'total':'perItem';
  const totalProfitTarget=window._saleProfitMode?(+window._saleTotalProfitVal||0):undefined;
  const entry={...(existing||{}),id:editId||uid(),clientId,clientNameFree,branch,projectName,quoteId,date,invoiceNo,notes,items,totalCost,totalPrice,currency,discount,commissionType,commissionPercent,commissionAmount,commissionSettlement,paidAmount,payments,exchangeRateAtEntry,profitMode,totalProfitTarget,charges:chg.items,chargesTotal:chg.total};
  if(editId){const idx=db.sales.findIndex(x=>x.id===editId);if(idx>=0)db.sales[idx]=entry;}
  else db.sales.push(entry);
  if(quoteId)syncItemsToQuote(quoteId,'sale',items);
  refreshProjectAutoStatus(projectName);
  saveDB(db);closeModal();renderSales(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function openSalePaymentModal(saleId, paymentId){
  const s=db.sales.find(x=>x.id===saleId);if(!s)return;
  const p=paymentId ? s.payments.find(x=>x.id===paymentId) : null;
  const currentPaid = (+s.paidAmount||0) - (p ? (+p.convertedAmount||convertCurrency(+p.amount||0,p.currency||s.currency||'SYP',s.currency||'SYP')) : 0);
  const currentDisc = saleDiscountTotal(s) - (p ? (+p.discountConverted||0) : 0);
  const remaining=(+s.totalPrice||0) - currentPaid - currentDisc;
  
  showModal(`<div class="modal-title">${paymentId?'تعديل دفعة':'تسجيل دفعة جديدة'} — ${esc(getClientName(s.clientId))}</div>
    <div class="grid-3" style="margin-bottom:16px">
      <div class="metric-card"><div class="metric-label">إجمالي الفاتورة</div><div class="metric-value blue" style="font-size:16px">${fmt(s.totalPrice)}</div></div>
      <div class="metric-card"><div class="metric-label">مدفوع سابقاً</div><div class="metric-value green" style="font-size:16px">${fmt(currentPaid)}</div></div>
      <div class="metric-card"><div class="metric-label">المتبقي</div><div class="metric-value red" style="font-size:16px">${fmt(remaining)}</div></div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">مبلغ الدفعة (الكاش المستلم فعلاً)</label><div style="display:flex;gap:4px"><input type="text" inputmode="decimal" class="form-control" id="sp-amount" data-remaining="${remaining}" value="${fmt(p?p.amount:(remaining>0?remaining:0))}" oninput="formatMoneyInput(this);applySalePaymentSettlement()">${currencySelectHTML('sp-currency',p?p.currency:s.currency)}</div></div>
      <div class="form-group"><label class="form-label">تاريخ الدفعة</label><input type="date" class="form-control" id="sp-date" value="${p?p.date:localToday()}"></div>
    </div>
    <div class="form-group" style="margin-top:10px">
      <label class="form-label" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span>خصم عند التحصيل (اختياري)</span>
        <span style="display:flex;align-items:center;gap:4px;font-size:11px;font-weight:400;cursor:pointer;color:var(--gold-dark)"><input type="checkbox" id="sp-settlement" onchange="applySalePaymentSettlement()"> تسديد (اعتبر الفرق خصم تلقائياً)</span>
      </label>
      <input type="text" inputmode="decimal" class="form-control" id="sp-discount" value="${fmt(p?p.discount||0:0)}" oninput="formatMoneyInput(this)" placeholder="0">
    </div>
    <div style="font-size:11px;color:var(--text2);margin:-4px 0 10px">يسقط من الدين، بدون إيراد فعلي.</div>
    <div class="form-group" style="margin-top:10px"><label class="form-label">ملاحظة</label><input type="text" class="form-control" id="sp-note" value="${esc(p?p.note||'':'')}" placeholder="مثلاً: نقداً، تحويل بنكي..."></div>
    <div class="modal-actions"><button class="btn" onclick="${paymentId?`viewSaleItems('${saleId}')`:'closeModal()'}">إلغاء</button><button class="btn btn-primary" onclick="saveSalePayment('${saleId}', '${paymentId||''}')">حفظ الدفعة</button></div>`);
}

function applySalePaymentSettlement(){
  const chk=document.getElementById('sp-settlement');
  const discEl=document.getElementById('sp-discount');
  if(!chk||!discEl)return;
  if(chk.checked){
    const amountEl=document.getElementById('sp-amount');
    const remaining=+amountEl.dataset.remaining||0;
    const amount=unformatNum(amountEl.value);
    const diff=Math.max(remaining-amount,0);
    discEl.value=fmt(diff);
    discEl.readOnly=true;
    discEl.style.background='var(--bg3)';
  }else{
    discEl.readOnly=false;
    discEl.style.background='';
  }
}
function saveSalePayment(saleId, paymentId){
  const s=db.sales.find(x=>x.id===saleId);if(!s)return;
  const amount=unformatNum(document.getElementById('sp-amount').value);
  const currencyEl=document.getElementById('sp-currency');
  const currency=currencyEl&&currencyEl.value==='USD'?'USD':'SYP';
  const date=document.getElementById('sp-date').value;
  const note=document.getElementById('sp-note').value;
  const discEl=document.getElementById('sp-discount');
  const discount=discEl?unformatNum(discEl.value):0;
  
  if(amount<=0 && discount<=0){alert('يرجى إدخال مبلغ صحيح');return;}
  if(!s.payments) s.payments = [];
  
  const existingPayment=paymentId?s.payments.find(p=>p.id===paymentId):null;
  // نستخدم سعر الصرف المحفوظ مع الدفعة الأصلية (لو كانت موجودة من قبل) حتى لو عم نعدّل عليها اليوم —
  // هيك تعديل تاريخ/ملاحظة/مبلغ دفعة قديمة ما يغيّر قيمتها المحوّلة بسبب تحرّك سعر الصرف الحي من ساعتها.
  const rateUsed=(existingPayment&&+existingPayment.rateUsed>0)?+existingPayment.rateUsed:getExchangeRate();
  const convertedAmount=convertCurrencyAtRate(amount,currency,s.currency||'SYP',rateUsed);
  const discountConverted=convertCurrencyAtRate(discount,currency,s.currency||'SYP',rateUsed);
  { // T5: الدفعة + الخصم ما بيتجاوزوا المتبقي
    const _oldC=existingPayment?(+existingPayment.convertedAmount||convertCurrency(+existingPayment.amount||0,existingPayment.currency||s.currency||'SYP',s.currency||'SYP')):0;
    const _oldD=existingPayment?(+existingPayment.discountConverted||0):0;
    const _rem=round2((+s.totalPrice||0)-((+s.paidAmount||0)-_oldC)-(saleDiscountTotal(s)-_oldD));
    const _sum=round2(convertedAmount+discountConverted);
    if(_sum>_rem+0.01){alert('الدفعة مع الخصم ('+fmt(_sum)+') أكبر من المتبقي ('+fmt(Math.max(_rem,0))+').');return;}
  }
  if(paymentId){
    const idx = s.payments.findIndex(p=>p.id===paymentId);
    if(idx>=0) s.payments[idx] = {id:paymentId, amount, currency, date, note, convertedAmount, discount, discountConverted, rateUsed};
  } else {
    s.payments.push({id:uid(), amount, currency, date, note, convertedAmount, discount, discountConverted, rateUsed});
  }
  
  // مجموع القيم المجمّدة لكل دفعة (وليس إعادة تحويلها بالسعر الحي كل مرة)
  s.paidAmount = round2(s.payments.reduce((sum, p) => sum + (+p.convertedAmount||0), 0));
  s.discAmount = round2(s.payments.reduce((sum, p) => sum + (+p.discountConverted||0), 0));
  
  saveDB(db);
  refreshProjectAutoStatus(s.projectName);
  if(paymentId) viewSaleItems(saleId);
  else {
    closeModal();
    renderSales(document.getElementById('main-content'),document.getElementById('topbar-actions'));
  }
}

function editSalePayment(saleId, paymentId){
  openSalePaymentModal(saleId, paymentId);
}

function deleteSalePayment(saleId, paymentId){
  if(!guardDelete())return;
  if(!confirm('هل أنت متأكد من حذف هذه الدفعة؟')) return;
  const s=db.sales.find(x=>x.id===saleId);if(!s)return;
  s.payments = s.payments.filter(p=>p.id!==paymentId);
  s.paidAmount = round2(s.payments.reduce((sum, p) => sum + (+p.convertedAmount||0), 0));
  s.discAmount = round2(s.payments.reduce((sum, p) => sum + (+p.discountConverted||0), 0));
  saveDB(db);
  refreshProjectAutoStatus(s.projectName);
  viewSaleItems(saleId);
}

function exportQuotesExcel(){
  const headers=['العميل','المشروع','تاريخ العرض','القيمة الإجمالية','القسم','الحالة','ملاحظات'];
  const rows=db.quotes.slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).map(q=>[
    getClientName(q.clientId),
    q.projectName||'',
    q.date||'',
    q.totalValue||0,
    DEPT_LABELS[quoteDeptTag(q)]||'',
    q.status||'',
    q.notes||''
  ]);
  exportRowsToExcel('عروض_الأسعار','عروض الأسعار',headers,rows);
}

function renderQuotes(el,acts){
  acts.innerHTML=`<button class="btn btn-primary" onclick="openQuoteModal()"><i class="ti ti-plus"></i> عرض سعر جديد</button><button class="btn" onclick="exportQuotesExcel()"><i class="ti ti-file-spreadsheet"></i> تصدير Excel</button>`;
  const cFilter=window._qC||'';
  const stFilter=window._qS||'all';
  const qqFilter=(window._qQ||'').trim().toLowerCase();
  const dFilterQ=window._qDept||'all'; // T47
  const quoteClientName=q=>q.clientId?getClientName(q.clientId):(q.clientNameFree||'');
  const quotes=quotesForDept(dFilterQ).filter(q=>{
    if(qqFilter&&!matchesListSearch(quoteSearchText(q),qqFilter))return false;
    if(cFilter){
      if(q.clientId){if(q.clientId!==cFilter)return false;}
      else{
        const c=db.clients.find(x=>x.id===cFilter);
        if(!c||q.clientNameFree!==c.name)return false;
      }
    }
    if(stFilter!=='all'&&q.status!==stFilter)return false;
    return true;
  });
  const total=quotes.length;
  const acc=quotes.filter(q=>q.status==='متفق').length;
  el.innerHTML=`
  ${window.qpStripHtml?qpStripHtml(quotes):''}
  <div class="grid-4" style="margin-bottom:18px">
    <div class="metric-card"><div class="metric-label">إجمالي العروض</div><div class="metric-value">${total}</div></div>
    <div class="metric-card"><div class="metric-label">تم الاتفاق</div><div class="metric-value green">${acc}</div></div>
    <div class="metric-card"><div class="metric-label">معلق</div><div class="metric-value amber">${quotes.filter(q=>q.status==='معلق').length}</div></div>
    <div class="metric-card"><div class="metric-label">نسبة القبول</div><div class="metric-value blue">${total?Math.round(acc/total*100):0}%</div></div>
  </div>
  ${deptTabsHTML(dFilterQ,"window._qDept=d;renderQuotes(document.getElementById('main-content'),document.getElementById('topbar-actions'))")}
  ${dFilterQ!=='all'?`<div style="font-size:12px;color:var(--text2);margin:-4px 0 12px">عرض قيمة <b>${esc(DEPT_LABELS[dFilterQ])}</b> فقط من كل عرض (الخصم موزّع بنسبة مبيعات القسم).</div>`:''}
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">
      ${listSearchInput('_qQ','عرض، عميل، مشروع، Part Number…','quotes')}
      <div class="form-group">
        <label class="form-label">العميل</label>
        <select class="form-control" style="width:200px" onchange="window._qC=this.value;renderQuotes(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
          <option value="">الكل</option>
          ${db.clients.map(c=>`<option value="${c.id}" ${cFilter===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">الحالة</label>
        <select class="form-control" style="width:150px" onchange="window._qS=this.value;renderQuotes(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
          <option value="all" ${stFilter==='all'?'selected':''}>الكل</option>
          <option value="معلق" ${stFilter==='معلق'?'selected':''}>معلق</option>
          <option value="متفق" ${stFilter==='متفق'?'selected':''}>متفق</option>
          <option value="مرفوض" ${stFilter==='مرفوض'?'selected':''}>مرفوض</option>
        </select>
      </div>
      ${(cFilter||stFilter!=='all'||qqFilter)?`<div class="form-group" style="padding-bottom:6px"><button class="btn btn-sm" onclick="window._qC='';window._qS='all';window._qQ='';renderQuotes(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-filter-off"></i> مسح الفلاتر</button></div>`:''}
      <div style="font-size:12px;color:var(--text2);padding-bottom:6px;margin-right:auto">${quotes.length} عرض</div>
    </div>
  </div>
  ${bulkToolbar('quotes',`
    <button class="btn btn-sm" style="background:var(--surface);color:var(--success);border-color:var(--success)" onclick="bulkQuoteStatus('متفق')"><i class="ti ti-check"></i> تحديد كـ متفق</button>
    <button class="btn btn-sm" style="background:var(--surface)" onclick="bulkQuoteStatus('معلق')"><i class="ti ti-clock"></i> تحديد كـ معلق</button>
    <button class="btn btn-sm" style="background:var(--surface);color:var(--danger);border-color:var(--danger)" onclick="bulkQuoteStatus('مرفوض')"><i class="ti ti-x"></i> تحديد كـ مرفوض</button>
  `)}
  <div class="card">
    ${quotes.length===0?`<div class="empty-state"><i class="ti ti-file-invoice"></i><p>لا يوجد عروض أسعار ${(cFilter||stFilter!=='all'||qqFilter)?'بهذا الفلتر':'بعد'}</p></div>`:`
    <table class="responsive-table">
      <thead><tr><th style="width:32px"><input type="checkbox" ${quotes.length>0&&quotes.every(q=>bSel('quotes').has(q.id))?'checked':''} onchange='bulkToggleAll("quotes",this,${esc(JSON.stringify(quotes.map(q=>q.id)))})'></th><th>العميل</th><th>اسم المشروع</th><th>تاريخ العرض</th><th>القيمة الإجمالية</th><th>الحالة</th><th>ملاحظات</th><th></th></tr></thead>
      <tbody>
        ${quotes.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).map(q=>`<tr>
          <td data-label=""><input type="checkbox" ${bSel('quotes').has(q.id)?'checked':''} onchange="bulkToggleRow('quotes','${q.id}',this)"></td>
          <td data-label="العميل" style="font-weight:600">${quoteClientName(q)||'—'}</td>
          <td data-label="اسم المشروع">${esc(q.projectName||'—')}</td>
          <td data-label="تاريخ العرض">${fmtDate(q.date)}</td>
          <td data-label="القيمة الإجمالية" style="font-weight:700">${fmt(q.totalValue)} <span style="font-size:10px;color:var(--text2)">${curLabel(q.currency)}</span><div style="margin-top:3px">${deptBadgeHTML(quoteDeptTag(q._sliceDept?(db.quotes.find(x=>x.id===q.id)||q):q))}</div></td>
          <td data-label="الحالة"><span class="badge ${q.status==='متفق'?'badge-green':q.status==='مرفوض'?'badge-red':'badge-amber'}">${q.status}</span>${window.qpExpiredBadge?qpExpiredBadge(q):''}</td>
          <td data-label="ملاحظات" style="font-size:12px;color:var(--text2)">${esc(q.notes||'—')}</td>
          <td data-label=""><div class="row-menu-wrap">
            <button class="row-menu-btn" onclick="toggleRowMenu(this,event)">⋮</button>
            <div class="row-menu-list">
              <button class="row-menu-item" onclick="openQuoteModal('${q.id}')"><i class="ti ti-edit"></i> تعديل</button>
              <button class="row-menu-item" onclick="printQuote('${q.id}')"><i class="ti ti-printer"></i> طباعة</button>
              <button class="row-menu-item" onclick="convertQuoteToTransaction('${q.id}')"><i class="ti ti-arrows-right-left"></i> تحويل لفاتورة/عمل</button>
              ${q.convertedSaleId?`<button class="row-menu-item" onclick="navigate('sales');openSaleModal('${q.convertedSaleId}')"><i class="ti ti-file-invoice"></i> فتح فاتورة المبيع المرتبطة</button>`:''}
              ${q.convertedMaintenanceId?`<button class="row-menu-item" onclick="navigate('maintenance');openMaintenanceModal('${q.convertedMaintenanceId}')"><i class="ti ti-tool"></i> فتح العمل المرتبط</button>`:''}
              ${(q.convertedSaleId||q.convertedMaintenanceId)?`<button class="row-menu-item" onclick="compareQuoteToActual('${q.id}')"><i class="ti ti-chart-bar"></i> مقارنة العرض بالتنفيذ الفعلي</button>`:''}
              <button class="row-menu-item danger" onclick="deleteItem('quotes','${q.id}')"><i class="ti ti-trash"></i> حذف</button>
            </div>
          </div></td>
        </tr>`).join('')}
      </tbody>
    </table>`}
  </div>`;
}

function bulkQuoteStatus(status){
  const s=bSel('quotes');
  if(s.size===0)return;
  if(!confirm(`تأكيد تحديد ${s.size} عرض سعر كـ "${status}"؟`))return;
  let _rr;if(status==='مرفوض'){_rr=prompt('سبب الرفض (اختياري):')||'';}
  db.quotes.forEach(q=>{if(s.has(q.id)){if(window.qpSetStatus)qpSetStatus(q,status,_rr);else q.status=status;}});
  saveDB(db);
  s.clear();
  rerenderPage('quotes');
}

function convertQuoteToTransaction(quoteId){
  const q=db.quotes.find(x=>x.id===quoteId);
  if(!q)return;
  if(!(q.projectName||'').trim()){
    alert('لازم تحط اسم المشروع بالعرض قبل التحويل، حتى تنربط فاتورة المبيعات وفاتورة العمل بنفس المشروع وتقدر تشوف أرباحه مجمّعة. عدّل العرض وضيف اسم المشروع، وبعدين حاول التحويل مرة تانية.');
    openQuoteModal(q.id);
    return;
  }
  if(q.convertedSaleId||q.convertedMaintenanceId){
    if(!confirm('هاد العرض محوّل مسبقاً (فيه فاتورة مبيعات و/أو عمل مرتبطة فيه). بدك تعيد التحويل وتنشئ فواتير جديدة إضافية؟'))return;
  }
  const items=q.items||[];
  const materialItems=items.filter(it=>(it.kind||'مادة')==='مادة');
  const laborItems=items.filter(it=>it.kind==='عمل');
  if(!materialItems.length&&!laborItems.length){alert('لا يوجد بنود بالعرض');return;}
  showModal(`
    <div class="modal-title">تحويل عرض السعر لتنفيذ</div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:16px">
      عرض "${esc(q.projectName||q.invoiceNo||'')}" فيه <b>${materialItems.length}</b> بند مادة و<b>${laborItems.length}</b> بند عمل.
      بالتأكيد، بينعمل تلقائياً: فاتورة مبيعات ببنود المواد (بربحها)، وفاتورة عمل ببنود الأعمال — بنفس تفاصيل صفحة المبيعات وصفحة الأعمال تماماً، ومربوطين بنفس اسم المشروع ورقم العرض.
    </div>
    <div class="modal-actions" style="justify-content:center">
      <button class="btn btn-primary" onclick="closeModal();doConvertQuote('${quoteId}')"><i class="ti ti-check"></i> تأكيد: توافق وتحويل</button>
      <button class="btn" onclick="closeModal()">إلغاء</button>
    </div>
  `);
}

function doConvertQuote(quoteId){
  const q=db.quotes.find(x=>x.id===quoteId);
  if(!q)return;
  const today=localToday();
  const allItems=q.items||[];
  const materialItems=allItems.filter(it=>(it.kind||'مادة')==='مادة');
  const laborItems=allItems.filter(it=>it.kind==='عمل');
  const refNote=(q.notes?q.notes+' — ':'')+`(محول من عرض سعر رقم ${q.invoiceNo||''} — مشروع: ${esc(q.projectName||'')})`;
  let createdSale=null, createdMaint=null;

  // العرض ممكن يكون مسجّل باسم عميل حر (clientNameFree) بدون clientId فعلي (عميل محتمل لسا ما انضاف).
  // قبل التحويل، لازم نربطه بعميل حقيقي بقائمة العملاء (نطابق بالاسم أو ننشئه تلقائياً)،
  // وإلا رح يضيع اسم العميل بفاتورة المبيعات/العمل الناتجة (تظهر "—" بكل الصفحات والتقارير والطباعة).
  let clientId=q.clientId;
  if(!clientId&&q.clientNameFree&&q.clientNameFree.trim()){
    const typedName=q.clientNameFree.trim();
    let matched=db.clients.find(c=>c.name.trim()===typedName);
    if(!matched){matched={id:uid(),name:typedName,phone:'',address:'',branches:[]};db.clients.push(matched);}
    clientId=matched.id;
    q.clientId=clientId;q.clientNameFree='';
  }

  if(materialItems.length){
    const items=materialItems.map(it=>{const e=quoteItemEffective(it);return {type:e.desc||(db.deviceTypes[0]||'Camera'),qty:e.qty||1,costPrice:e.cost||'',salePrice:e.price||'',note:e.note||'',note2:e.note2||'',modelNumber:e.modelNumber||'',destination:'',qIdx:allItems.indexOf(it)};});
    const totalCost=items.reduce((s,i)=>s+(+i.costPrice||0)*(+i.qty||1),0);
    const rawPrice=items.reduce((s,i)=>s+(+i.salePrice||0)*(+i.qty||1),0);
    const discount=+q.discount||0;
    const totalPrice=round2(rawPrice*(1-discount/100));
    createdSale={id:uid(),clientId,clientNameFree:'',branch:'',projectName:q.projectName,quoteId:q.id,date:today,invoiceNo:genInvoiceNo('SL',db.sales),notes:refNote+(laborItems.length?' — (مواد المشروع؛ الأعمال بفاتورة عمل منفصلة بنفس المشروع)':''),items,totalCost,totalPrice,currency:q.currency||'USD',discount,commissionPercent:0,paidAmount:0,payments:[],exchangeRateAtEntry:getExchangeRate()};
    db.sales.push(createdSale);
  }
  if(laborItems.length){
    const workItems=laborItems.map(it=>{const e=quoteItemEffective(it);return {type:e.desc||'',desc:e.note||'',qty:e.qty||1,price:e.price||0,qIdx:allItems.indexOf(it)};});
    const workTypes=[...new Set(workItems.map(it=>it.type).filter(Boolean))];
    const workDesc=workItems.map(it=>it.type?`${esc(it.type)}: ${esc(it.desc||'')}`:(it.desc||'')).join('\n');
    const discount=+q.discount||0;
    const rawAmount=workItems.reduce((s,it)=>s+((+it.qty||1)*(+it.price||0)),0);
    const workAmount=round2(rawAmount-(rawAmount*(discount/100)));
    // لو نادراً حط تكلفة على بند عمل، منسجلها كمصروف حتى ما تضيع من حساب الربح (على أساس الخيار المختار)
    const expenses=laborItems.map(it=>quoteItemEffective(it)).filter(e=>e.cost>0).map(e=>({id:uid(),type:'قطع غيار',amount:e.cost*(e.qty||1),note:`تكلفة: ${esc(e.desc||'')}${e.qty?(' × '+e.qty):''} (من العرض)`,date:today}));
    createdMaint={id:uid(),clientId,clientNameFree:'',branch:'',projectName:q.projectName,quoteId:q.id,startDate:today,endDate:'',status:'جارية',paidAmount:0,payments:[],notes:refNote+(materialItems.length?' — (أعمال المشروع؛ المواد بفاتورة مبيعات منفصلة بنفس المشروع)':''),invoiceNo:genInvoiceNo('WRK',db.maintenance),workDesc,workTypes,workItems,workAmount,currency:q.currency||'USD',workers:[],expenses,advances:[],discount,commissionPercent:0,deliveryStatus:'معلقة',deliveryDate:'',exchangeRateAtEntry:getExchangeRate()};
    db.maintenance.push(createdMaint);
  }
  q.status='متفق';
  q.convertedSaleId=createdSale?createdSale.id:q.convertedSaleId;
  q.convertedMaintenanceId=createdMaint?createdMaint.id:q.convertedMaintenanceId;
  // لقطة مجمّدة (باللحظة يلي وافق فيها الزبون وتم التحويل) لبنود وقيمة العرض الأساسي.
  // هاي اللقطة هي يلي رح تنعتمد لاحقاً بمقارنة "العرض بالتنفيذ الفعلي"، حتى لو المستخدم رجع
  // وعدّل بنود العرض بعد هيك (مثلاً وثّق تغييرات لاحقة بنفس سجل العرض) - يضل عندنا الأساس الحقيقي
  // يلي اتفق عليه الزبون بالبداية، وما تنكسر المقارنة.
  if(!q.baselineSnapshot){
    const rawValue=allItems.reduce((s,i)=>{const e=quoteItemEffective(i);return s+e.price*e.qty;},0);
    q.baselineSnapshot={
      items:JSON.parse(JSON.stringify(allItems)),
      totalValue:rawValue*(1-((+q.discount||0)/100)),
      discount:+q.discount||0,
      currency:q.currency||'USD',
      frozenAt:today
    };
  }
  // الرسوم: النسبة بتنطبق على كل فاتورة بصافيها، والمبلغ الثابت بينحط مرة وحدة (عالمبيعات إذا موجودة، وإلا عالعمل) لحتى ما يتكرر
  if((q.charges||[]).length){
    const fixedOwner=createdSale||createdMaint;
    [[createdSale,'totalPrice'],[createdMaint,'workAmount']].forEach(function(p){
      const rec=p[0];if(!rec)return;
      const list=q.charges.filter(function(c){return c.mode!=='fixed'||rec===fixedOwner;});
      const r=chargesCompute(list,rec[p[1]]);rec.charges=r.items;rec.chargesTotal=r.total;
    });
  }
  findOrCreateProject(q.projectName,{quoteId:q.id,clientId:q.clientId,saleId:createdSale?createdSale.id:undefined,maintId:createdMaint?createdMaint.id:undefined});
  saveDB(db);
  renderQuotes(document.getElementById('main-content'),document.getElementById('topbar-actions'));
  const parts=[];
  if(createdSale)parts.push(`فاتورة مبيعات رقم <b>${createdSale.invoiceNo}</b> بقيمة ${fmt(createdSale.totalPrice)}`);
  if(createdMaint)parts.push(`فاتورة عمل رقم <b>${createdMaint.invoiceNo}</b> بقيمة ${fmt(createdMaint.workAmount)}`);
  showModal(`
    <div class="modal-title">تم التحويل بنجاح</div>
    <div style="font-size:13px;color:var(--text2);line-height:2">تم إنشاء: <br>${parts.join('<br>')}</div>
    <div class="modal-actions" style="justify-content:center;gap:10px;flex-wrap:wrap">
      ${createdSale?`<button class="btn btn-primary" onclick="closeModal();openSaleModal('${createdSale.id}')">فتح فاتورة المبيعات</button>`:''}
      ${createdMaint?`<button class="btn btn-primary" onclick="closeModal();openMaintenanceModal('${createdMaint.id}')">فتح فاتورة العمل</button>`:''}
      <button class="btn" onclick="closeModal()">إغلاق</button>
    </div>
  `);
}

function compareQuoteToActual(quoteId){
  const q=db.quotes.find(x=>x.id===quoteId);
  if(!q)return;
  // المقارنة لازم تاخد بعين الاعتبار *كل* فواتير المبيع وفواتير الأعمال المرتبطة بنفس المشروع،
  // مش بس الفاتورة الوحيدة يلي طلعت مباشرة من عملية التحويل. لأنه بالواقع ممكن ينضاف عالمشروع
  // فاتورة مبيع أو عمل تانية بعدين (زيادة كاميرات، تركيب إضافي...)، ولازم كل هاد يدخل بحساب
  // "التنفيذ الفعلي" حتى يطلع الفرق الحقيقي عن قيمة العرض الأساسي.
  const projSales=q.projectName?db.sales.filter(s=>(s.projectName||'')===q.projectName):[];
  const projMaints=q.projectName?db.maintenance.filter(m=>(m.projectName||'')===q.projectName):[];
  // احتياطاً (عرض بدون اسم مشروع مسجَّل، أو بيانات قديمة): نرجع للفاتورتين المباشرتين من التحويل
  const sales=projSales.length?projSales:(q.convertedSaleId?db.sales.filter(s=>s.id===q.convertedSaleId):[]);
  const maints=projMaints.length?projMaints:(q.convertedMaintenanceId?db.maintenance.filter(m=>m.id===q.convertedMaintenanceId):[]);
  if(!sales.length&&!maints.length){alert('هاد العرض ما تحول لفاتورة مبيعات أو عمل بعد.');return;}

  // نستخدم اللقطة المجمّدة المأخوذة لحظة التحويل (باللغة يلي وافق فيها الزبون) كأساس للمقارنة،
  // مش بنود العرض الحيّة الحالية — لأنه لو المستخدم عدّل العرض بعد التحويل (وثّق زيادة/نقصان لاحقاً
  // بنفس السجل)، بيصير "الأساسي" هو نفسه المعدَّل وتنكسر المقارنة (كل شي يبين مطابق بالغلط).
  // إذا العرض قديم ومافيه لقطة مجمّدة أصلاً (اتحوّل قبل ما تنضاف هاي الميزة)، منرجع نستخدم بنوده
  // الحيّة كحل احتياطي، بس منبيّن تنبيه للمستخدم إنه هاي المقارنة مو مضمونة 100%.
  const hasSnapshot=!!q.baselineSnapshot;
  const baseItems=hasSnapshot?q.baselineSnapshot.items:(q.items||[]);
  const baseDiscount=hasSnapshot?q.baselineSnapshot.discount:(+q.discount||0);

  // قيمة العرض الأساسي المقدم للزبون (100% — أساس المقارنة)، بناءً على الخيار المختار وقت التحويل
  const originalTotal=hasSnapshot?q.baselineSnapshot.totalValue:((+q.totalValue||0)||(q.items||[]).reduce((s,i)=>{const e=quoteItemEffective(i);return s+e.price*e.qty;},0)*(1-((+q.discount||0)/100)));
  const currentSaleTotal=sales.reduce((s,x)=>s+(+x.totalPrice||0),0);
  const currentMaintTotal=maints.reduce((s,m)=>s+(+m.workAmount||0),0);
  const currentTotal=currentSaleTotal+currentMaintTotal;
  const diff=currentTotal-originalTotal;
  const pctOfOriginal=originalTotal?(currentTotal/originalTotal*100):(currentTotal>0?100:0);
  const diffPct=originalTotal?(diff/originalTotal*100):0;

  // نبني قائمة بنود العرض الأساسي (من اللقطة المجمّدة) وقائمة بنود التنفيذ الفعلي (مبيعات+أعمال).
  // المطابقة لازم تصير على أساس "اسم الصنف + وصفه/ملاحظته سوا"، مش الاسم لحاله. لأنه بالتطبيق
  // اسم الصنف (desc) بينجاب من قائمة عامة محدودة (متل "Camera")، والتفصيل يلي بيميّز نوع الكاميرا
  // عن التاني (داخلية/خارجية/PTZ...) بينكتب بحقل "وصف المادة/الملاحظة". فلو اعتمدنا الاسم العام
  // بس، كل أنواع الكاميرات الثلاثة كانت رح تنجمع بصف واحد غلط. بضم الاسم+الملاحظة سوا كمفتاح،
  // كل نوع فعلي مختلف بيضل بصف لحاله، وبنفس الوقت البنود المتطابقة تماماً (نفس الاسم ونفس
  // الملاحظة) بتنجمع سوا إذا تكررت بأكثر من سطر.
  function groupItems(list){
    const map=new Map();
    list.forEach(it=>{
      const desc=(it.desc||'—').trim()||'—';
      const note=(it.note||'').trim();
      const key=desc+'||'+note;
      if(!map.has(key))map.set(key,{desc,note,qty:0,total:0});
      const g=map.get(key);
      g.qty+=(+it.qty||1);
      g.total+=(+it.total||0);
    });
    return map;
  }
  const origItems=groupItems((baseItems||[]).map(it=>{const e=quoteItemEffective(it);return {desc:e.desc,qty:e.qty,total:e.price*e.qty,note:e.note};}));
  const curItems=groupItems([
    ...sales.flatMap(s=>(s.items||[]).map(it=>({desc:it.type,qty:it.qty||1,total:(+it.salePrice||0)*(+it.qty||1),note:(it.note||'')}))),
    ...maints.flatMap(m=>(m.workItems||[]).map(it=>({desc:it.type,qty:it.qty||1,total:(+it.price||0)*(+it.qty||1),note:it.desc||''})))
  ]);
  // مفاتيح موحّدة: كل أسماء الأصناف (مع ملاحظاتها) الموجودة إما بالعرض أو بالتنفيذ الفعلي أو الاثنين معاً
  const allDescs=[...new Set([...origItems.keys(),...curItems.keys()])];
  const compareRows=allDescs.map(key=>{
    const o=origItems.get(key);
    const c=curItems.get(key);
    const oTotal=o?o.total:0, cTotal=c?c.total:0;
    const oQty=o?o.qty:0, cQty=c?c.qty:0;
    const itemDiff=cTotal-oTotal;
    const label=(o&&o.desc)||(c&&c.desc)||'—';
    const detail=esc((o&&o.note)||(c&&c.note)||'—');
    let status,style,diffCell;
    if(o&&!c){status='<span style="color:var(--danger);font-weight:800">● محذوف</span>';style='background:var(--danger-bg)';diffCell=`<span style="color:var(--danger);font-weight:700">-${fmt(oTotal)}</span>`;}
    else if(!o&&c){status='<span style="color:var(--danger);font-weight:800">● بند جديد</span>';style='background:var(--danger-bg)';diffCell=`<span style="color:var(--danger);font-weight:700">+${fmt(cTotal)}</span>`;}
    else if(Math.abs(itemDiff)>0.01){
      // نميّز سبب الفرق: هل زادت/نقصت الكمية بنفس سعر الوحدة، أو تغيّر سعر الوحدة نفسه، أو الاثنين معاً؟
      // هاد مهم لأنه "زيادة كمية" شي طبيعي ومتوقع (الزبون طلب زيادة)، عكس "تغيّر السعر" يلي بيحتاج انتباه أكتر.
      const oUnit=oQty?oTotal/oQty:0, cUnit=cQty?cTotal/cQty:0;
      const qtyChanged=oQty!==cQty, unitChanged=Math.abs(oUnit-cUnit)>0.01;
      const qtyDiff=cQty-oQty;
      if(qtyChanged&&!unitChanged){
        status=`<span style="color:var(--info);font-weight:800">● ${qtyDiff>0?'زيادة كمية (+'+qtyDiff+')':'نقص كمية ('+qtyDiff+')'}</span>`;
        style='background:var(--info-bg)';
      } else if(!qtyChanged&&unitChanged){
        status='<span style="color:var(--salary);font-weight:800">● تغيّر سعر الوحدة</span>';
        style='background:var(--gold-light)';
      } else {
        status='<span style="color:var(--salary);font-weight:800">● تغيّر الكمية وسعر الوحدة معاً</span>';
        style='background:var(--gold-light)';
      }
      diffCell=`<span style="color:${itemDiff>0?'var(--salary)':'var(--success)'};font-weight:700">${itemDiff>0?'+':''}${fmt(itemDiff)}</span>`;
    }
    else {status='<span style="color:var(--text2)">مطابق</span>';style='';diffCell='<span style="color:var(--text2)">—</span>';}
    return `<tr style="${style}"><td>${esc(label)}</td><td style="font-size:10.5px;color:var(--text2)">${detail}</td><td style="text-align:center">${o?o.qty:'—'}</td><td style="text-align:center">${c?c.qty:'—'}</td><td style="text-align:right">${o?fmt(oTotal):'—'}</td><td style="text-align:right">${c?fmt(cTotal):'—'}</td><td style="text-align:right">${diffCell}</td><td style="text-align:center;white-space:nowrap">${status}</td></tr>`;
  }).join('');
  const currentRows=compareRows||'<tr><td colspan="8" style="text-align:center;color:var(--text2)">لا يوجد بنود</td></tr>';

  const statusColor=diff===0?'var(--text2)':diff>0?'var(--salary)':'var(--danger)';
  const statusMsg=diff===0?'✅ التنفيذ الفعلي مطابق تماماً للعرض الأساسي المقدَّم (100%).'
    :diff>0?`⚠️ التنفيذ الفعلي زاد عن العرض الأساسي بمقدار ${fmt(Math.abs(diff))} ${curLabel(q.currency)} (أي ${pctOfOriginal.toFixed(1)}% من قيمة العرض، بزيادة ${diffPct.toFixed(1)}%). على الأغلب انضافت بنود أو تعدّلت أسعار بعد التحويل.`
    :`ℹ️ التنفيذ الفعلي أقل من العرض الأساسي بمقدار ${fmt(Math.abs(diff))} ${curLabel(q.currency)} (أي ${pctOfOriginal.toFixed(1)}% من قيمة العرض).`;

  showModal(`
    <div class="modal-title">مقارنة العرض بالتنفيذ الفعلي</div>
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <div class="metric-card" style="flex:1;min-width:150px"><div class="metric-label">العرض الأساسي (100%)</div><div class="metric-value">${fmt(originalTotal)} <span style="font-size:11px;color:var(--text2)">${curLabel(q.currency)}</span></div></div>
      <div class="metric-card" style="flex:1;min-width:150px"><div class="metric-label">التنفيذ الفعلي الآن</div><div class="metric-value" style="color:${statusColor}">${fmt(currentTotal)} <span style="font-size:11px;color:var(--text2)">${curLabel(q.currency)}</span></div></div>
      <div class="metric-card" style="flex:1;min-width:150px"><div class="metric-label">النسبة عن العرض الأساسي</div><div class="metric-value" style="color:${statusColor}">${pctOfOriginal.toFixed(1)}%</div></div>
    </div>
    <div style="font-size:12.5px;margin-bottom:14px;padding:10px;border-radius:8px;background:var(--bg2);color:${statusColor};font-weight:600">${statusMsg}</div>
    ${!hasSnapshot?`<div style="font-size:11.5px;margin-bottom:14px;padding:9px 10px;border-radius:8px;background:var(--gold-light);border:1px solid var(--gold);color:var(--gold-dark)">⚠️ هاد العرض اتحوّل قبل ما تنضاف ميزة "تجميد الأساس"، فالمقارنة هون بتستخدم بنود العرض الحالية كأساس (مش لقطة من لحظة التحويل بالضبط). إذا عدّلت العرض بعد التحويل، ممكن الأساس يكون مو دقيق 100%.</div>`:''}
    <div style="font-weight:700;font-size:12px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border);display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between">
      <span>مقارنة البنود: العرض الأساسي مقابل التنفيذ الفعلي</span>
      <span style="font-size:10px;font-weight:400;color:var(--text2)"><span style="color:var(--danger);font-weight:700">أحمر = بند جديد/محذوف</span>، <span style="color:var(--info);font-weight:700">أزرق = تغيّر كمية بس</span>، <span style="color:var(--salary);font-weight:700">برتقالي = تغيّر سعر الوحدة</span></span>
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;font-size:11px;min-width:640px">
        <thead><tr><th>البند</th><th>التفاصيل</th><th>كمية العرض</th><th>كمية الفعلي</th><th>قيمة العرض</th><th>القيمة الفعلية</th><th>الفرق</th><th>الحالة</th></tr></thead>
        <tbody>${currentRows}</tbody>
      </table>
    </div>
    <div style="font-size:11px;color:var(--text2);margin-top:10px">مقارنة العرض الأصلي بالتنفيذ الفعلي.</div>
    <div class="modal-actions">
      <button class="btn" onclick="printQuoteComparison('${quoteId}')"><i class="ti ti-printer"></i> طباعة / تصدير للزبون</button>
      ${q.projectName?`<button class="btn" onclick='closeModal();navigate("projects");window._projView=${esc(JSON.stringify(q.projectName))};render()'>فتح المشروع (${sales.length+maints.length} فاتورة)</button>`:''}
      <button class="btn btn-primary" onclick="closeModal()">إغلاق</button>
    </div>
  `);
}

function openQuoteModal(editId){
  const q=editId?db.quotes.find(x=>x.id===editId):null;
  window._qI=q&&q.items?JSON.parse(JSON.stringify(q.items)):[];
  chargesInit(q,'q');
  showModal(`
    <div class="modal-title">${editId?'تعديل عرض سعر':'عرض سعر جديد'}</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">العميل</label>
        <input type="text" class="form-control" id="q-client-name" list="q-client-list"
          value="${q&&q.clientId?getClientName(q.clientId):q&&q.clientNameFree?q.clientNameFree:''}"
          placeholder="اكتب اسم العميل أو اختر من القائمة"
          autocomplete="off">
        <datalist id="q-client-list">
          ${db.clients.map(c=>`<option value="${esc(c.name)}"></option>`).join('')}
        </datalist>
      </div>
      <div class="form-group"><label class="form-label">اسم المشروع <span style="font-size:11px;color:var(--text2);font-weight:400">(اختياري)</span></label>${projectInputHTML('q-project',q&&q.projectName?q.projectName:'')}</div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">رقم العرض <span style="font-size:11px;color:var(--text2);font-weight:400">(تلقائي)</span></label><input type="text" class="form-control" id="q-invoice" value="${q&&q.invoiceNo?q.invoiceNo:genInvoiceNo('QT',db.quotes)}" readonly style="background:var(--bg2)"></div>
      <div class="form-group"><label class="form-label">تاريخ العرض</label><input type="date" class="form-control" id="q-date" value="${q&&q.date?q.date:''}"></div>
    </div>
    ${window.qpModalFields?qpModalFields(q):''}
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">عملة العرض</label>${currencySelectHTML('q-currency',q&&q.currency?q.currency:'USD').replace('<select ','<select onchange="refreshQuoteTotal()" ')}</div>
      <div class="form-group"><label class="form-label">الحالة</label>
        <select class="form-control" id="q-status">
          <option ${!q||q.status==='معلق'?'selected':''}>معلق</option>
          <option ${q&&q.status==='متفق'?'selected':''}>متفق</option>
          <option ${q&&q.status==='مرفوض'?'selected':''}>مرفوض</option>
        </select>
      </div>
    </div>
    <div style="font-weight:700;font-size:13px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">بنود العرض</div>
    <div id="quote-items">${renderQuoteItems()}</div>
    <button class="btn btn-sm" onclick="addQuoteItem()" style="margin-bottom:12px"><i class="ti ti-plus"></i> إضافة بند</button>
    <div class="form-row cols-2" style="margin-bottom:12px">
      <div class="form-group"><label class="form-label">نسبة الحسم (%)</label><input type="number" min="0" max="100" step="any" class="form-control" id="q-discount" value="${q&&q.discount?q.discount:''}" oninput="refreshQuoteTotal()"></div>
      <div id="quote-total" class="form-group" style="background:var(--bg2);border-radius:8px;padding:10px;font-size:13px;justify-content:center">${renderQuoteTotal()}</div>
    </div>
    ${chargesBlockHTML()}
    <div class="form-group"><label class="form-label">ملاحظات</label><textarea class="form-control" id="q-notes" rows="2" placeholder="كل سطر = ملاحظة، وبتترقم تلقائياً بالطباعة">${esc(q&&q.notes?q.notes:'')}</textarea></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveQuote('${editId||''}')">حفظ العرض</button></div>
  `);
}

function quoteItemEffective(item){
  // كل بند بالعرض ممكن يكون إلو "خيارات أخرى" (بدائل) بنفس نوع المادة/العمل.
  // الخيار المختار (selectedIdx=0 يعني الأساسي، وإلا رقم البديل) هو يلي يدخل بالحسبة والإجمالي.
  if(item.selectedIdx&&item.alts&&item.alts[item.selectedIdx-1]){
    const a=item.alts[item.selectedIdx-1];
    return {desc:a.desc||item.desc||'',kind:item.kind,qty:+a.qty||1,price:+a.price||0,cost:+a.cost||0,note:a.note||item.note||'',note2:a.note2||item.note2||'',modelNumber:a.modelNumber||''};
  }
  return {desc:item.desc||'',kind:item.kind,qty:+item.qty||1,price:+item.price||0,cost:+item.cost||0,note:item.note||'',note2:item.note2||'',modelNumber:item.modelNumber||''};
}

function renderQuoteItems(){
  if(!window._qI||!window._qI.length)return '<div style="color:var(--text2);font-size:12px;margin-bottom:10px;text-align:center;padding:14px;background:var(--bg2);border-radius:8px;border:1px dashed var(--border2)">لا يوجد بنود</div>';
  return window._qI.map((item,i)=>{
    const sugg=getSuggestedPrice(item.desc);
    const kind=item.kind||'مادة';
    return `
    <div style="background:var(--bg2);border-radius:8px;padding:10px;margin-bottom:8px;border:1px solid var(--border)">
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <button type="button" class="btn btn-sm" style="flex:1;${kind==='مادة'?'background:var(--accent);color:#fff':''}" onclick="window._qI[${i}].kind='مادة';window._qI[${i}].desc=db.deviceTypes[0]||'';document.getElementById('quote-items').innerHTML=renderQuoteItems();refreshQuoteTotal()"><i class="ti ti-box"></i> مادة (شراء وبيع)</button>
        <button type="button" class="btn btn-sm" style="flex:1;${kind==='عمل'?'background:var(--gold);color:#fff':''}" onclick="window._qI[${i}].kind='عمل';window._qI[${i}].desc=db.workTypes[0]||'';document.getElementById('quote-items').innerHTML=renderQuoteItems();refreshQuoteTotal()"><i class="ti ti-tools"></i> عمل (تركيب/برمجة...)</button>
      </div>
      <div style="display:grid;grid-template-columns:1.4fr 80px 1fr 1fr auto;gap:6px;align-items:center">
        <select class="form-control" onchange="window._qI[${i}].desc=this.value;document.getElementById('quote-items').innerHTML=renderQuoteItems()">${(kind==='عمل'?db.workTypes:db.deviceTypes).map(t=>`<option ${item.desc===t?'selected':''}>${esc(t)}</option>`).join('')}</select>
        <input type="number" class="form-control" placeholder="الكمية" value="${esc(item.qty||1)}" min="1" onchange="window._qI[${i}].qty=this.value;refreshQuoteTotal()">
        <input type="text" inputmode="decimal" class="form-control" placeholder="${kind==='عمل'?'التكلفة (نادراً)':'التكلفة (اختياري)'}" value="${item.cost?fmt(item.cost):''}" oninput="formatMoneyInput(this)" onchange="window._qI[${i}].cost=unformatNum(this.value);refreshQuoteTotal()">
        <input type="text" inputmode="decimal" class="form-control" placeholder="السعر" value="${item.price?fmt(item.price):''}" oninput="formatMoneyInput(this)" onchange="window._qI[${i}].price=unformatNum(this.value);refreshQuoteTotal()">
        <button class="btn btn-sm btn-danger" onclick="window._qI.splice(${i},1);document.getElementById('quote-items').innerHTML=renderQuoteItems();refreshQuoteTotal()"><i class="ti ti-x"></i></button>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;color:var(--text2)"><span>القسم:</span>
        <select class="form-control" style="width:auto;min-width:150px;padding:3px 8px;font-size:11px" onchange="window._qI[${i}].department=this.value">
          <option value="" ${!item.department?'selected':''}>تلقائي (${esc(DEPT_SHORT[itemDept({kind:item.kind,desc:item.desc})])})</option>
          <option value="security" ${item.department==='security'?'selected':''}>${esc(DEPT_LABELS.security)}</option>
          <option value="network" ${item.department==='network'?'selected':''}>${esc(DEPT_LABELS.network)}</option>
        </select></div>
      ${sugg?`<div style="font-size:11px;color:var(--text2);margin-top:4px">💡 آخر سعر بيع لهذا الصنف: <b>${fmt(sugg.last)}</b> (متوسط ${sugg.count} عملية: ${fmt(sugg.avg)}) — <span style="cursor:pointer;color:var(--accent);text-decoration:underline" onclick="window._qI[${i}].price=${sugg.last};document.getElementById('quote-items').innerHTML=renderQuoteItems();refreshQuoteTotal()">استخدام هذا السعر</span></div>`:''}
      <details class="opt-details" ${(item.note||item.note2||item.modelNumber)?'open':''}>
        <summary>تفاصيل إضافية (وصف المادة، Part Number، ملاحظة)${['note','note2','modelNumber'].filter(k=>item[k]).length?`<span class="opt-badge">${['note','note2','modelNumber'].filter(k=>item[k]).length}</span>`:''}</summary>
        <div class="opt-body" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px">
          <div><input type="text" class="form-control" id="qnote-${i}" list="qnote-list-${i}" placeholder="وصف المادة (يظهر بالطباعة)" value="${esc(item.note||'')}" onchange="window._qI[${i}].note=this.value"><datalist id="qnote-list-${i}">${getItemNoteSuggestions(item.desc).map(v=>`<option value="${esc(v)}">`).join('')}</datalist></div>
          <div><input type="text" class="form-control" list="qmodel-list-${i}" placeholder="Part Number" value="${esc(item.modelNumber||'')}" onchange="window._qI[${i}].modelNumber=this.value;ensureModelNumberInList(this.value);autofillPartDesc(this.value,window._qI,${i},'note','qnote-${i}')"><datalist id="qmodel-list-${i}">${(db.modelNumbers||[]).map(v=>`<option value="${esc(v)}">`).join('')}</datalist></div>
          <div><input type="text" class="form-control" placeholder="ملاحظة (داخلية، لا تظهر بالطباعة)" value="${esc(item.note2||'')}" onchange="window._qI[${i}].note2=this.value"></div>
        </div>
      </details>
      <details class="opt-details" ${(item.alts&&item.alts.length)?'open':''}>
        <summary>خيارات أخرى (بدائل) للزبون${(item.alts&&item.alts.length)?`<span class="opt-badge">${item.alts.length}</span>`:''}</summary>
        <div class="opt-body" style="margin-top:6px">
          <div style="font-size:11px;color:var(--text2);margin-bottom:8px">المختار (✓) فقط يدخل بالإجمالي.</div>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;background:${(!item.selectedIdx||item.selectedIdx===0)?'var(--accent-soft,#eafaf1)':'transparent'};padding:6px;border-radius:6px;margin-bottom:6px;cursor:pointer">
            <input type="radio" name="qsel-${i}" ${(!item.selectedIdx||item.selectedIdx===0)?'checked':''} onchange="window._qI[${i}].selectedIdx=0;document.getElementById('quote-items').innerHTML=renderQuoteItems();refreshQuoteTotal()">
            <span>✓ الخيار الأساسي — ${esc(item.desc||'')} × ${esc(item.qty||1)} = <b>${fmt((+item.price||0)*(+item.qty||1))}</b> ${(!item.selectedIdx||item.selectedIdx===0)?'<b style="color:var(--accent)">(مختار — يدخل بالحسبة)</b>':''}</span>
          </label>
          ${(item.alts||[]).map((alt,ai)=>`
            <div style="display:grid;grid-template-columns:auto 1.4fr 70px 1fr 1fr auto;gap:6px;align-items:center;margin-bottom:6px;padding:6px;background:var(--bg2);border-radius:6px;border:1px solid var(--border)">
              <input type="radio" name="qsel-${i}" ${item.selectedIdx===ai+1?'checked':''} onchange="window._qI[${i}].selectedIdx=${ai+1};document.getElementById('quote-items').innerHTML=renderQuoteItems();refreshQuoteTotal()">
              <select class="form-control" onchange="window._qI[${i}].alts[${ai}].desc=this.value">${(kind==='عمل'?db.workTypes:db.deviceTypes).map(t=>`<option ${alt.desc===t?'selected':''}>${esc(t)}</option>`).join('')}</select>
              <input type="number" class="form-control" placeholder="الكمية" value="${esc(alt.qty||1)}" min="1" onchange="window._qI[${i}].alts[${ai}].qty=this.value;document.getElementById('quote-items').innerHTML=renderQuoteItems();refreshQuoteTotal()">
              <input type="text" inputmode="decimal" class="form-control" placeholder="التكلفة" value="${alt.cost?fmt(alt.cost):''}" oninput="formatMoneyInput(this)" onchange="window._qI[${i}].alts[${ai}].cost=unformatNum(this.value);refreshQuoteTotal()">
              <input type="text" inputmode="decimal" class="form-control" placeholder="السعر" value="${alt.price?fmt(alt.price):''}" oninput="formatMoneyInput(this)" onchange="window._qI[${i}].alts[${ai}].price=unformatNum(this.value);document.getElementById('quote-items').innerHTML=renderQuoteItems();refreshQuoteTotal()">
              <button class="btn btn-sm btn-danger" onclick="window._qI[${i}].alts.splice(${ai},1);if(window._qI[${i}].selectedIdx>${ai+1})window._qI[${i}].selectedIdx--;else if(window._qI[${i}].selectedIdx===${ai+1})window._qI[${i}].selectedIdx=0;document.getElementById('quote-items').innerHTML=renderQuoteItems();refreshQuoteTotal()"><i class="ti ti-x"></i></button>
              <input type="text" class="form-control" style="grid-column:1/-1" list="qaltmodel-list-${i}-${ai}" placeholder="Part Number (للخيار البديل)" value="${esc(alt.modelNumber||'')}" onchange="window._qI[${i}].alts[${ai}].modelNumber=this.value;ensureModelNumberInList(this.value)"><datalist id="qaltmodel-list-${i}-${ai}">${(db.modelNumbers||[]).map(v=>`<option value="${esc(v)}">`).join('')}</datalist>
            </div>
          `).join('')}
          <button type="button" class="btn btn-sm" onclick="if(!window._qI[${i}].alts)window._qI[${i}].alts=[];window._qI[${i}].alts.push({desc:window._qI[${i}].desc||'',qty:1,price:'',cost:'',note:'',note2:'',modelNumber:''});document.getElementById('quote-items').innerHTML=renderQuoteItems();"><i class="ti ti-plus"></i> إضافة خيار بديل</button>
        </div>
      </details>
    </div>
  `;}).join('');
}

function renderQuoteTotal(){
  const discEl=document.getElementById('q-discount');
  const discount=discEl?clampDiscountPct(+discEl.value||0):0;
  const curEl=document.getElementById('q-currency');
  const curLbl=curLabel(curEl&&curEl.value==='USD'?'USD':'SYP');
  const raw=(window._qI||[]).reduce((s,i)=>{const e=quoteItemEffective(i);return s+e.price*e.qty;},0);
  const t=raw * (1 - discount/100);
  return `<div style="display:flex;gap:15px;flex-wrap:wrap"><span>قبل الحسم: <b>${fmt(raw)} ${curLbl}</b></span><span>الصافي: <b style="color:var(--accent)">${fmt(t)} ${curLbl}</b></span>${chargesTotalsHTML(t,curLbl)}</div>`;
}

function refreshQuoteTotal(){const el=document.getElementById('quote-total');if(el)el.innerHTML=renderQuoteTotal();}

function addQuoteItem(){if(!window._qI)window._qI=[];const last=window._qI[window._qI.length-1];const kind=last?(last.kind||'مادة'):'مادة';const list=kind==='عمل'?db.workTypes:db.deviceTypes;window._qI.push({desc:last?last.desc:(list[0]||''),kind,qty:1,price:'',note:'',note2:''});document.getElementById('quote-items').innerHTML=renderQuoteItems();}

function saveQuote(editId){
  const typedName=(document.getElementById('q-client-name').value||'').trim();
  if(!typedName){alert('يرجى إدخال اسم العميل');return;}
  // Try to match an existing client by name (case-insensitive)
  const matchedClient=db.clients.find(c=>c.name.trim()===typedName);
  const clientId=matchedClient?matchedClient.id:'';
  const clientNameFree=matchedClient?'':typedName; // store free-text if no match
  const projectName=(document.getElementById('q-project').value||'').trim();
  if(projectName)findOrCreateProject(projectName);
  const date=document.getElementById('q-date').value;
  const invoiceNo=document.getElementById('q-invoice').value;
  const status=document.getElementById('q-status').value;
  const notes=document.getElementById('q-notes').value;
  const items=window._qI||[];
  items.forEach(i=>{if(DEPT_KEYS.indexOf(i.department)<0)delete i.department;}); // T46
  const discount=+document.getElementById('q-discount').value||0;
  if(discount<0||discount>100){alert('نسبة الحسم لازم تكون بين 0 و100');return;}
  const rawValue=items.reduce((s,i)=>{const e=quoteItemEffective(i);return s+e.price*e.qty;},0);
  const totalValue=round2(rawValue * (1 - discount/100));
  const chg=chargesCollect(totalValue);
  // تحذير هامش ربح منخفض قبل إرسال العرض (فقط للبنود التي أُدخلت لها تكلفة) — على أساس الخيار المختار من كل بند
  const totalCostEntered=items.reduce((s,i)=>{const e=quoteItemEffective(i);return s+e.cost*e.qty;},0);
  if(totalCostEntered>0&&totalValue>0){
    const marginPct=marginPctOf(totalValue,totalCostEntered);
    const minMargin=getLowMarginPercent();
    if(marginPct<minMargin){
      if(!confirm(`⚠️ تحذير: هامش الربح بهذا العرض ${marginPct.toFixed(1)}% وهو أقل من الحد الأدنى المحدد (${minMargin}%).\nمتأكد بدك ترسل العرض بهذا السعر؟`))return;
    }
  }
  const currency=document.getElementById('q-currency')&&document.getElementById('q-currency').value==='USD'?'USD':'SYP';
  // لازم نحافظ على الحقول يلي مش جزء من فورم التعديل (زي روابط التحويل convertedSaleId/convertedMaintenanceId
  // واللقطة المجمّدة baselineSnapshot) لما نحفظ تعديل على عرض موجود مسبقاً. قبل هالتصليح كان الحفظ عم يستبدل
  // السجل كامل بكائن جديد من الصفر، فأي تعديل بسيط على العرض بعد تحويله كان بيمسح بصمت ربط الفواتير الفعلية
  // واللقطة المجمّدة، وبيخرّب مقارنة "العرض بالتنفيذ الفعلي" بالكامل.
  const existing=editId?db.quotes.find(x=>x.id===editId):null;
  const entry={...(existing||{}),id:editId||uid(),clientId,clientNameFree,projectName,date,invoiceNo,status,notes,items,totalValue,discount,currency,charges:chg.items,chargesTotal:chg.total};
  if(window.qpOnSave)qpOnSave(existing,entry,qpReadFields());
  if(editId){const idx=db.quotes.findIndex(x=>x.id===editId);if(idx>=0)db.quotes[idx]=entry;}
  else db.quotes.push(entry);
  saveDB(db);closeModal();renderQuotes(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function exportClientsExcel(){
  const headers=['الاسم','النوع','الهاتف','البريد/الموقع','الفروع','عدد الأعمال','إجمالي المبيعات ($)'];
  const rows=db.clients.map(c=>{
    const maint=db.maintenance.filter(m=>m.clientId===c.id).length;
    const rev=db.sales.filter(s=>s.clientId===c.id).reduce((s,x)=>s+toUSD(x.totalPrice||0,x.currency),0);
    return [c.name||'',c.type||'',c.phone||'',c.contact||'',c.branches&&c.branches.length?c.branches.join('، '):'',maint,rev];
  });
  exportRowsToExcel('العملاء','العملاء',headers,rows);
}

function renderClients(el,acts){
  acts.innerHTML=`<button class="btn btn-primary" onclick="openClientModal()"><i class="ti ti-plus"></i> عميل جديد</button><button class="btn" onclick="openClientDuplicatesModal()"><i class="ti ti-arrows-join"></i> دمج المكرر</button><button class="btn" onclick="exportClientsExcel()"><i class="ti ti-file-spreadsheet"></i> تصدير Excel</button>`;
  const tFilter=window._clT||'';
  const qFilter=(window._clQ||'').trim().toLowerCase();
  const branchSet=new Set();
  db.clients.forEach(c=>(c.branches||[]).forEach(b=>branchSet.add(b)));
  const bFilter=window._clB||'';
  const clients=db.clients.filter(c=>{
    if(tFilter&&c.type!==tFilter)return false;
    if(bFilter&&!(c.branches||[]).includes(bFilter))return false;
    if(qFilter&&!(c.name||'').toLowerCase().includes(qFilter)&&!(c.phone||'').toLowerCase().includes(qFilter))return false;
    return true;
  });
  el.innerHTML=`
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">
      <div class="form-group">
        <label class="form-label">بحث</label>
        <input type="text" class="form-control" style="width:200px" placeholder="اسم أو هاتف..." value="${esc(window._clQ||'')}" oninput="window._clQ=this.value;renderClients(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
      </div>
      <div class="form-group">
        <label class="form-label">النوع</label>
        <select class="form-control" style="width:160px" onchange="window._clT=this.value;renderClients(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
          <option value="">الكل</option>
          <option value="زبون" ${tFilter==='زبون'?'selected':''}>زبون</option>
          <option value="شركة" ${tFilter==='شركة'?'selected':''}>شركة</option>
          <option value="بنك" ${tFilter==='بنك'?'selected':''}>بنك</option>
          <option value="مؤسسة" ${tFilter==='مؤسسة'?'selected':''}>مؤسسة</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">الفرع</label>
        <select class="form-control" style="width:170px" onchange="window._clB=this.value;renderClients(document.getElementById('main-content'),document.getElementById('topbar-actions'))" ${branchSet.size===0?'disabled':''}>
          <option value="">الكل</option>
          ${[...branchSet].sort().map(b=>`<option value="${esc(b)}" ${bFilter===b?'selected':''}>${esc(b)}</option>`).join('')}
        </select>
      </div>
      ${(tFilter||bFilter||qFilter)?`<div class="form-group" style="padding-bottom:6px"><button class="btn btn-sm" onclick="window._clT='';window._clB='';window._clQ='';renderClients(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-filter-off"></i> مسح الفلاتر</button></div>`:''}
      <div style="font-size:12px;color:var(--text2);padding-bottom:6px;margin-right:auto">${clients.length} عميل</div>
    </div>
  </div>
  ${bulkToolbar('clients')}<div class="card"><div style="overflow-x:auto">${clients.length===0?`<div class="empty-state"><i class="ti ti-users"></i><p>لا يوجد عملاء ${(tFilter||bFilter||qFilter)?'بهذا الفلتر':'بعد'}</p></div>`:`<table class="responsive-table">
    <thead><tr><th style="width:32px"><input type="checkbox" ${clients.length>0&&clients.every(c=>bSel('clients').has(c.id))?'checked':''} onchange='bulkToggleAll("clients",this,${esc(JSON.stringify(clients.map(c=>c.id)))})'></th><th>الاسم</th><th>النوع</th><th>الفروع</th><th>عدد الأعمال</th><th>إجمالي المبيعات ($)</th><th>موصى به</th><th></th></tr></thead>
    <tbody>
      ${clients.map(c=>{
        const maint=db.maintenance.filter(m=>m.clientId===c.id).length;
        const rev=db.sales.filter(s=>s.clientId===c.id).reduce((s,x)=>s+toUSD(x.totalPrice||0,x.currency),0);
        const vip=isVipClient(c.id);
        return `<tr>
          <td data-label=""><input type="checkbox" ${bSel('clients').has(c.id)?'checked':''} onchange="bulkToggleRow('clients','${c.id}',this)"></td>
          <td data-label="الاسم" style="font-weight:700;font-size:14px">${esc(c.name)}${vip?' <span class="badge badge-amber" title="حجم تعامل كبير">⭐ VIP</span>':''}${c.contractType&&c.contractType!=='لا يوجد'?` <span class="badge badge-blue" style="font-size:10px">${esc(c.contractType)}</span>`:''}</td>
          <td data-label="النوع"><span class="badge ${c.type==='بنك'?'badge-blue':c.type==='شركة'||c.type==='مؤسسة'?'badge-blue':'badge-gray'}">${esc(c.type)}</span></td>
          <td data-label="الفروع" style="font-size:12px;max-width:200px">${c.branches&&c.branches.length?c.branches.slice(0,4).map(esc).join(' · ')+(c.branches.length>4?` +${c.branches.length-4} فرع`:''):'—'}</td>
          <td data-label="عدد الأعمال" style="text-align:center;font-weight:600">${maint}</td>
          <td data-label="إجمالي المبيعات ($)" style="color:var(--accent);font-weight:700">${finValUSD(rev)}</td>
          <td data-label="موصى به" style="font-size:12px">${c.referrerName?`<span class="badge badge-amber">${esc(c.referrerName)}</span>`:'—'}</td>
          <td data-label=""><div class="action-btns">
            <button class="btn btn-sm" onclick="openClientModal('${c.id}')"><i class="ti ti-edit"></i></button>
            <button class="btn btn-sm btn-danger" onclick="deleteItem('clients','${c.id}')"><i class="ti ti-trash"></i></button>
          </div></td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`}</div></div>`;
}

function openClientModal(editId){
  const c=editId?db.clients.find(x=>x.id===editId):null;
  if(c)normalizeClientBranches(db);
  window._cBD=c&&c.branchDetails?c.branchDetails.map(b=>Object.assign({},b)):[];
  _brSync();
  showModal(`
    <div class="modal-title">${editId?'تعديل عميل':'عميل جديد'}</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">الاسم</label><input type="text" class="form-control" id="c-name" value="${esc(c?c.name:'')}"></div>
      <div class="form-group"><label class="form-label">النوع</label>
        <select class="form-control" id="c-type">
          <option ${!c||c.type==='زبون'?'selected':''}>زبون</option>
          <option ${c&&c.type==='شركة'?'selected':''}>شركة</option>
          <option ${c&&c.type==='بنك'?'selected':''}>بنك</option>
          <option ${c&&c.type==='مؤسسة'?'selected':''}>مؤسسة</option>
        </select>
      </div>
    </div>
    <div class="form-row cols-2" style="margin-bottom:14px">
      <div class="form-group"><label class="form-label">رقم الهاتف</label>
        <input type="tel" class="form-control" id="c-phone" value="${esc(c&&c.phone?c.phone:'')}" placeholder="مثال: 0912345678" dir="ltr" style="text-align:left">
      </div>
      <div class="form-group"><label class="form-label">البريد / الموقع (اختياري)</label>
        <input type="text" class="form-control" id="c-contact" value="${esc(c&&c.contact?c.contact:'')}" placeholder="ايميل أو عنوان">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">الفروع <span style="color:var(--text2);font-weight:400">(أضف الفرع، وبعدها عبّي العنوان والمسؤول ورابط الموقع)</span></label>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <input type="text" class="form-control" id="branch-inp" placeholder="اسم الفرع" style="flex:1" onkeydown="if(event.key==='Enter'){addClientBranch();event.preventDefault()}">
        <button class="btn btn-sm btn-primary" onclick="addClientBranch()"><i class="ti ti-plus"></i> إضافة</button>
      </div>
      <div id="branch-tags" style="min-height:32px">${renderBranchTags()}</div>
    </div>
    <div style="margin-top:14px;padding:10px 12px;background:var(--bg2);border-radius:8px;font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <span>عقود الصيانة الدورية صارت تُدار من صفحة «العقود» (قيمة، دفعات، زيارات).</span>
      <button type="button" class="btn btn-sm" onclick="closeModal();navigate('contracts')"><i class="ti ti-file-certificate"></i> فتح العقود</button>
    </div>
    <details class="opt-details" ${c&&c.referrerName?'open':''}>
      <summary>موصى به (اختياري)${c&&c.referrerName?`<span class="opt-badge">${esc(c.referrerName)}</span>`:''}</summary>
      <div class="opt-body">
    <div class="form-group"><label class="form-label">موصى به من</label>
      <input type="text" class="form-control" id="c-referrer" value="${esc(c&&c.referrerName?c.referrerName:'')}" placeholder="اسم العامل أو الشخص">
    </div>
    <div style="font-size:11px;color:var(--text2);margin-top:-6px">بيظهر حقل العمولة تلقائياً.</div>
      </div>
    </details>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveClient('${editId||''}')">حفظ</button></div>
  `);
}

function openClientDuplicatesModal(){
  const groups=findDuplicateClientGroups(db);
  if(!groups.length){showModal('<div class="modal-title">دمج المكرر</div><div class="empty-state"><i class="ti ti-circle-check"></i><p>ما في عملاء مكررين (بالاسم أو رقم الهاتف).</p></div><div class="modal-actions"><button class="btn" onclick="closeModal()">إغلاق</button></div>');return;}
  window._dupGroups=groups.map(g=>g.map(c=>c.id));
  showModal(`<div class="modal-title">دمج العملاء المكررين (${groups.length})</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">اختار العميل الأساسي بكل مجموعة. كل الفواتير والأعمال والعروض والعقود والمشاريع والمستندات والفروع بتنتقل للأساسي، والمكرر بينحذف.</div>
    ${groups.map((g,gi)=>{
      const best=g.slice().sort((a,b)=>clientRecordCount(db,b.id)-clientRecordCount(db,a.id))[0];
      return `<div class="card" style="padding:10px;margin-bottom:10px">
        ${g.map(c=>`<label style="display:flex;gap:8px;align-items:center;padding:4px 0;flex-wrap:wrap"><input type="radio" name="dup-${gi}" value="${esc(c.id)}" ${c.id===best.id?'checked':''}> <b>${esc(c.name)}</b> <span style="font-size:11px;color:var(--text2)">${esc(c.phone||'بدون هاتف')} · ${clientRecordCount(db,c.id)} سجل · ${(c.branches||[]).length} فرع</span></label>`).join('')}
        <button class="btn btn-sm btn-primary" style="margin-top:6px" onclick="doMergeClientGroup(${gi})"><i class="ti ti-arrows-join"></i> دمج هالمجموعة</button>
      </div>`;}).join('')}
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إغلاق</button></div>`);
}
async function doMergeClientGroup(gi){
  const ids=(window._dupGroups||[])[gi];if(!ids)return;
  const sel=document.querySelector('input[name="dup-'+gi+'"]:checked');
  if(!sel)return;
  if(!guardDelete())return;
  if(!confirm('رح يندمج '+ids.length+' عملاء بعميل واحد، والمكرر بيتحذف نهائياً. متابعة؟'))return;
  try{await forceSnapshotNow();}
  catch(e){console.error('pre-merge snapshot failed',e);if(!confirm('تعذّر أخذ نسخة احتياطية سحابية قبل الدمج. تتابع بدونها؟'))return;}
  const r=mergeClientsIn(db,sel.value,ids);
  if(!r.ok){alert(r.error);return;}
  if(typeof logAction==='function')logAction('دمج','عملاء',ids.length+' ← '+sel.value);
  saveDB(db);
  renderClients(document.getElementById('main-content'),document.getElementById('topbar-actions'));
  openClientDuplicatesModal();
}
function saveClient(editId){
  const name=document.getElementById('c-name').value.trim();
  const type=document.getElementById('c-type').value;
  const phone=document.getElementById('c-phone')?document.getElementById('c-phone').value.trim():'';
  const contact=document.getElementById('c-contact')?document.getElementById('c-contact').value.trim():'';
  const referrerName=document.getElementById('c-referrer')?document.getElementById('c-referrer').value.trim():'';
  if(!name){alert('يرجى إدخال الاسم');return;}
  // كشف عميل مكرر: نفس الاسم تقريباً أو نفس رقم الهاتف عند عميل آخر
  const normName=name.trim().toLowerCase();
  const dup=db.clients.find(x=>x.id!==editId&&(
    clientNameKey(x.name)===clientNameKey(name)||
    (clientPhoneKey(phone)&&clientPhoneKey(x.phone)===clientPhoneKey(phone))
  ));
  if(dup){
    if(!confirm(`تنبيه: في عميل مشابه بالفعل ("${dup.name}"${dup.phone?' — '+dup.phone:''}). متأكد إنو هاد مش نفس العميل؟\n\nاضغط "موافق" للمتابعة وإضافته كعميل منفصل.`))return;
  }
  // T36: تفاصيل الفروع (اسم/عنوان/مسؤول/هاتف/رابط). أسماء الفروع ما بتتكرر، والرابط لازم http/https.
  const branchDetails=[],seenBr=new Set();
  for(const b of (window._cBD||[])){
    const bn=String(b.name||'').trim();if(!bn)continue;
    if(seenBr.has(bn.toLowerCase())){alert('اسم الفرع \"'+bn+'\" مكرر');return;}
    seenBr.add(bn.toLowerCase());
    const rawUrl=String(b.mapUrl||'').trim(),url=safeExternalUrl(rawUrl);
    if(rawUrl&&!url){alert('رابط موقع الفرع \"'+bn+'\" لازم يبدأ بـ http:// أو https://');return;}
    branchDetails.push({id:b.id||uid(),name:bn,address:String(b.address||'').trim(),contactName:String(b.contactName||'').trim(),contactPhone:String(b.contactPhone||'').trim(),mapUrl:url});
  }
  // T10: التعديل بيدمج الحقول المعدّلة فوق السجل القديم (بدل ما يستبدله كله)،
  // هيك حقول متل العنوان وأي حقل تاني ما بيظهر بهالنافذة بتضل محفوظة.
  const fields={name,type,phone,contact,branches:branchDetails.map(b=>b.name),branchDetails,referrerName};
  if(editId){
    const idx=db.clients.findIndex(x=>x.id===editId);
    if(idx>=0){
      // تغيير اسم فرع بيتبع السجلات القديمة (فواتير/أعمال/عروض/مشاريع) حتى ما تضيع عن فرعها
      const oldById={};(db.clients[idx].branchDetails||[]).forEach(b=>{oldById[b.id]=b.name;});
      branchDetails.forEach(b=>{
        const on=oldById[b.id];
        if(on&&on!==b.name)['sales','maintenance','quotes','projects'].forEach(k=>(db[k]||[]).forEach(r=>{if(r.clientId===editId&&r.branch===on)r.branch=b.name;}));
      });
      db.clients[idx]=Object.assign({},db.clients[idx],fields,{id:editId});
    }
  }
  else db.clients.push(Object.assign({id:uid(),address:''},fields));
  saveDB(db);closeModal();renderClients(document.getElementById('main-content'),document.getElementById('topbar-actions'));
  if(currentPage==='settings')refreshSettingsTab();
}

async function exportReportsExcel(){
  if(!canViewFinance()){alert('لا تملك صلاحية رؤية الأرباح والتوتال والرواتب.');return;}
  try{await loadLibOrWarn('xlsx','تصدير Excel');}catch(e){return;}
  const showTotals=canViewTotals(),showSalaries=canViewWorkerSalaries(),showProfits=canViewProfits();
  const wb=XLSX.utils.book_new();
  const addSheet=(name,headers,rows)=>{
    const ws=XLSX.utils.aoa_to_sheet([headers,...rows]);
    ws['!cols']=headers.map((h,i)=>{const maxLen=Math.max(String(h).length,...(rows.length?rows.map(r=>String(r[i]??'').length):[0]));return{wch:Math.min(Math.max(maxLen+2,10),45)};});
    XLSX.utils.book_append_sheet(wb,ws,name);
  };
  // أرباح المبيعات (محقق حسب نسبة التحصيل من كل فاتورة)
  if(showTotals||showProfits){
    addSheet('أرباح_المبيعات',['المشروع','العميل',...(showTotals?['المسدد فعلياً','التكلفة المحققة']:[]),...(showProfits?['الربح المحقق']:[])],
      db.sales.map(s=>[s.projectName||'',getClientName(s.clientId),...(showTotals?[saleRecognizedRevenue(s),saleRecognizedCost(s)]:[]),...(showProfits?[saleRecognizedProfit(s)]:[])]));
  }
  // أرباح الأعمال (محقق حسب نسبة التحصيل)
  if(showTotals||showSalaries||showProfits){
    addSheet('أرباح_الأعمال',['العمل','العميل/الفرع',...(showTotals?['الأجر الكلي']:[]),...(showSalaries?['أجور العمال']:[]),...(showTotals?['مصاريف']:[]),...(showProfits?['الربح']:[])],
      db.maintenance.map(m=>[(m.workTypes||[]).join('، '),getClientName(m.clientId)+(m.branch?' / '+m.branch:''),...(showTotals?[maintRecognizedIncome(m)]:[]),...(showSalaries?[maintRecognizedWages(m)]:[]),...(showTotals?[maintRecognizedExpenses(m)]:[]),...(showProfits?[maintRecognizedProfit(m)]:[])]));
  }
  // أداء العملاء (محوّل للدولار لتوحيد المقارنة، لأن مبيعات كل عميل ممكن تكون بعملات مختلفة)
  addSheet('أداء_العملاء',['العميل','عدد الأعمال',...(showTotals?['إجمالي المبيع ($)']:[])],
    db.clients.map(c=>[c.name||'',db.maintenance.filter(m=>m.clientId===c.id).length,...(showTotals?[db.sales.filter(s=>s.clientId===c.id).reduce((s,x)=>s+toUSDHist(x.totalPrice||0,x.currency,x),0)]:[])]));
  // ملخص عام (كل القيم موحّدة بالدولار عبر toUSD لأن السجلات مسجّلة بعملات مختلفة SYP/USD)
  const tS=db.sales.reduce((s,x)=>s+toUSDHist(saleRecognizedRevenue(x),x.currency,x),0);
  const tC=db.sales.reduce((s,x)=>s+toUSDHist(saleRecognizedCost(x),x.currency,x),0);
  // حساب الأرباح من الأعمال المسددة فقط (حالة الشغل لا تدخل بالحسابات)
  const tMI=db.maintenance.reduce((s,m)=>s+toUSDHist(maintRecognizedIncome(m),m.currency,m),0);
  const tW=db.maintenance.reduce((s,m)=>s+toUSDHist(maintRecognizedWages(m),m.currency,m),0);
  const tME=db.maintenance.reduce((s,m)=>s+toUSDHist(maintRecognizedExpenses(m),m.currency,m),0);
  const tRefSales=db.sales.reduce((s,x)=>s+toUSDHist(saleReferralCommission(x),x.currency,x),0);
  const tRefMaint=db.maintenance.reduce((s,m)=>s+toUSDHist(maintReferralCommission(m),m.currency,m),0);
  const {total:tRefProject,unpaid:tRefProjectUnpaid}=projectCommissionsInRange(null,null);
  const tRef=tRefSales+tRefMaint+tRefProject;
  const supDebt=db.suppliers.reduce((s,sup)=>s+getSupplierDebtUSD(sup),0);
  const summaryRows=[
    ...(showTotals?[['إيرادات المبيع (مسددة) ($)',tS],['تكلفة المبيع (مسددة) ($)',tC],['إيرادات الأعمال (مسددة) ($)',tMI],['مصاريف الأعمال (مسددة) ($)',tME],['ديون الموردين ($)',supDebt]]:[]),
    ...(showSalaries?[['أجور العمال (مسددة) ($)',tW]]:[]),
    ...(showProfits?[['العمولات (محققة، شامل عمولات المشاريع الكاملة) ($)',tRef],['صافي الربح ($)',(tS-tC)+(tMI-tW-tME)-tRef]]:[]),
    ['عدد عروض الأسعار',db.quotes.length],
    ['نسبة قبول العروض %',db.quotes.length?Math.round(db.quotes.filter(q=>q.status==='متفق').length/db.quotes.length*100):0]
  ];
  addSheet('ملخص_عام',['المؤشر','القيمة'],summaryRows);
  const stamp=localToday();
  XLSX.writeFile(wb,`التقارير-${stamp}.xlsx`);
}

// نسخة مستقلة للقراءة فقط من حساب "صافي الربح" الموجود بصفحة التقارير (renderReports)،
// معزولة هون خصيصاً حتى تستخدمها صفحة المحفظة الشخصية (سحب يدوي فقط) بدون أي لمس
// أو تعديل على renderReports نفسها أو أي حساب مالي فعلي بالشركة. القراءة فقط، ما في
// أي كتابة/تعديل على db من هالدالة.
function getCompanyNetProfitUSD(){
  const tS=db.sales.reduce((s,x)=>s+toUSDHist(saleRecognizedRevenue(x),x.currency,x),0);
  const tC=db.sales.reduce((s,x)=>s+toUSDHist(saleRecognizedCost(x),x.currency,x),0);
  const tMI=db.maintenance.reduce((s,m)=>s+toUSDHist(maintRecognizedIncome(m),m.currency,m),0);
  const tW=db.maintenance.reduce((s,m)=>s+toUSDHist(maintRecognizedWages(m),m.currency,m),0);
  const tME=db.maintenance.reduce((s,m)=>s+toUSDHist(maintRecognizedExpenses(m),m.currency,m),0);
  const tRefSales=db.sales.reduce((s,x)=>s+toUSDHist(saleReferralCommission(x),x.currency,x),0);
  const tRefMaint=db.maintenance.reduce((s,m)=>s+toUSDHist(maintReferralCommission(m),m.currency,m),0);
  const {total:tRefProject}=projectCommissionsInRange(null,null);
  const tRef=tRefSales+tRefMaint+tRefProject;
  return (tS-tC)+(tMI-tW-tME)-tRef;
}
function renderReports(el,acts){
  if(!canViewFinance()){
    if(acts)acts.innerHTML='';
    el.innerHTML='<div class="empty-state"><i class="ti ti-lock"></i>هذا القسم متاح فقط لمن لديه صلاحية رؤية الأرباح والتوتال والرواتب. تواصل مع المدير لمنحك هذه الصلاحية.</div>';
    return;
  }
  if(acts)acts.innerHTML=`<button class="btn btn-primary" onclick="exportReportsExcel()"><i class="ti ti-file-spreadsheet"></i> تصدير Excel</button>`;
  // كل الإجماليات هنا موحّدة بالدولار (toUSD) لأن الفواتير/الأعمال ممكن تكون مسجّلة بعملات مختلفة (ل.س / $)
  const tS=db.sales.reduce((s,x)=>s+toUSDHist(saleRecognizedRevenue(x),x.currency,x),0);
  const tC=db.sales.reduce((s,x)=>s+toUSDHist(saleRecognizedCost(x),x.currency,x),0);
  // حساب الأرباح من الأعمال المسددة فقط (حالة الشغل لا تدخل بالحسابات)
  const tMI=db.maintenance.reduce((s,m)=>s+toUSDHist(maintRecognizedIncome(m),m.currency,m),0);
  const tW=db.maintenance.reduce((s,m)=>s+toUSDHist(maintRecognizedWages(m),m.currency,m),0);
  const tME=db.maintenance.reduce((s,m)=>s+toUSDHist(maintRecognizedExpenses(m),m.currency,m),0);
  const tRefSales=db.sales.reduce((s,x)=>s+toUSDHist(saleReferralCommission(x),x.currency,x),0);
  const tRefMaint=db.maintenance.reduce((s,m)=>s+toUSDHist(maintReferralCommission(m),m.currency,m),0);
  const {total:tRefProject,unpaid:tRefProjectUnpaid}=projectCommissionsInRange(null,null);
  const tRef=tRefSales+tRefMaint+tRefProject;
  const tRefUnpaid=db.sales.filter(x=>!x.commissionPaid).reduce((s,x)=>s+toUSDHist(saleReferralCommission(x),x.currency,x),0)+db.maintenance.filter(m=>!m.commissionPaid).reduce((s,m)=>s+toUSDHist(maintReferralCommission(m),m.currency,m),0)+tRefProjectUnpaid;
  const tP=(tS-tC)+(tMI-tW-tME)-tRef;
  const supDebt=db.suppliers.reduce((s,sup)=>s+getSupplierDebtUSD(sup),0);
  const qAcc=db.quotes.length?Math.round(db.quotes.filter(q=>q.status==='متفق').length/db.quotes.length*100):0;
  el.innerHTML=`
  <div class="grid-4" style="margin-bottom:18px">
    <div class="metric-card"><div class="metric-label">إيرادات المبيع (مسددة) ($)</div><div class="metric-value blue">${finValUSD(tS,'total')}</div></div>
    <div class="metric-card"><div class="metric-label">إيرادات الأعمال (مسددة) ($)</div><div class="metric-value blue">${finValUSD(tMI,'total')}</div></div>
    <div class="metric-card"><div class="metric-label">أجور العمال (مسددة) ($)</div><div class="metric-value amber">${finValUSD(tW,'salary')}</div></div>
    <div class="metric-card"><div class="metric-label">صافي الربح ($)${infoTip('محسوب على أساس المبالغ المحصّلة فعلياً فقط (الربح المحقق)، وليس القيمة الكاملة للفواتير وأعمال الصيانة.')}</div><div class="metric-value ${tP>=0?'green':'red'}">${finValUSD(tP,'profit')}</div></div>
  </div>
  ${tRef>0?`<div class="grid-4" style="margin-bottom:18px">
    <div class="metric-card"><div class="metric-label">عمولات (مبيعات) ($)</div><div class="metric-value amber">${finValUSD(tRefSales,'profit')}</div></div>
    <div class="metric-card"><div class="metric-label">عمولات (أعمال) ($)</div><div class="metric-value amber">${finValUSD(tRefMaint,'profit')}</div></div>
    <div class="metric-card"><div class="metric-label">إجمالي العمولات ($)${tRefProject>0?infoTip('يشمل عمولات المشاريع الكاملة المسجّلة مرة وحدة على المشروع: '+fmtUSD(tRefProject)):''}</div><div class="metric-value amber">${finValUSD(tRef,'profit')}</div></div>
    <div class="metric-card"><div class="metric-label">عمولات معلقة (غير مسددة) ($)</div><div class="metric-value ${tRefUnpaid>0?'red':'green'}">${finValUSD(tRefUnpaid,'profit')}</div></div>
  </div>`:''}
  <div class="grid-2" style="margin-bottom:18px">
    <div class="card">
      <div class="section-title">أرباح المشاريع والمبيعات <span style="font-size:11px;color:var(--text2);font-weight:400">(محوّل للدولار)</span></div>
      ${db.sales.length===0?`<div class="empty-state" style="padding:30px"><i class="ti ti-chart-bar"></i><p>لا يوجد مبيعات</p></div>`:`
      <table>
        <thead><tr><th>المشروع</th><th>العميل</th><th>المسدد فعلياً</th><th>التكلفة المحققة</th><th>الربح المحقق</th></tr></thead>
        <tbody>
          ${db.sales.map(s=>`<tr>
            <td data-label="المشروع" style="font-weight:600">${esc(s.projectName||'—')}</td>
            <td data-label="العميل" style="font-size:12px">${esc(getClientName(s.clientId))}</td>
            <td data-label="المسدد فعلياً">${finVal(saleRecognizedRevenue(s),'total')} <span style="font-size:10px;color:var(--text2)">${curLabel(s.currency)}</span></td>
            <td data-label="التكلفة المحققة" style="color:var(--danger)">${finVal(saleRecognizedCost(s),'total')} <span style="font-size:10px;color:var(--text2)">${curLabel(s.currency)}</span></td>
            <td data-label="الربح المحقق" style="color:var(--accent);font-weight:700">${finVal(saleRecognizedProfit(s),'profit')} <span style="font-size:10px;color:var(--text2)">${curLabel(s.currency)}</span></td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr class="summary-row"><td colspan="2">الإجمالي ($)</td><td>${finValUSD(tS,'total')}</td><td style="color:var(--danger)">${finValUSD(tC,'total')}</td><td style="color:var(--accent)">${finValUSD(tS-tC-tRefSales,'profit')}</td></tr></tfoot>
      </table>`}
    </div>
    <div class="card">
      <div class="section-title">أرباح الأعمال والصيانة <span style="font-size:11px;color:var(--text2);font-weight:400">(محوّل للدولار)</span></div>
      ${db.maintenance.length===0?`<div class="empty-state" style="padding:30px"><i class="ti ti-tool"></i><p>لا يوجد أعمال</p></div>`:`
      <table>
        <thead><tr><th>العمل</th><th>العميل</th><th>المسدد فعلياً</th><th>أجور محققة</th><th>مصاريف محققة</th><th>الربح المحقق</th></tr></thead>
        <tbody>
          ${db.maintenance.map(m=>`<tr>
            <td data-label="العمل" style="font-weight:600">${(m.workTypes&&m.workTypes.length)?m.workTypes.join('، '):'—'}</td>
            <td data-label="العميل" style="font-size:12px">${esc(getClientName(m.clientId))}${m.branch?' / '+esc(m.branch):''}</td>
            <td data-label="المسدد فعلياً">${finVal(maintRecognizedIncome(m),'total')} <span style="font-size:10px;color:var(--text2)">${curLabel(m.currency)}</span></td>
            <td data-label="أجور محققة" style="color:var(--salary)">${finVal(maintRecognizedWages(m),'salary')} <span style="font-size:10px;color:var(--text2)">${curLabel(m.currency)}</span></td>
            <td data-label="مصاريف محققة" style="color:var(--info)">${finVal(maintRecognizedExpenses(m),'total')} <span style="font-size:10px;color:var(--text2)">${curLabel(m.currency)}</span></td>
            <td data-label="الربح المحقق" style="color:${maintRecognizedProfit(m)>=0?'var(--accent)':'var(--danger)'};font-weight:700">${finVal(maintRecognizedProfit(m),'profit')} <span style="font-size:10px;color:var(--text2)">${curLabel(m.currency)}</span></td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr class="summary-row"><td colspan="2">الإجمالي ($)</td><td>${finValUSD(tMI,'total')}</td><td style="color:var(--salary)">${finValUSD(tW,'salary')}</td><td style="color:var(--info)">${finValUSD(tME,'total')}</td><td style="color:${(tMI-tW-tME-tRefMaint)>=0?'var(--accent)':'var(--danger)'}">${finValUSD(tMI-tW-tME-tRefMaint,'profit')}</td></tr></tfoot>
      </table>`}
    </div>
  </div>
  <div class="grid-2" style="margin-bottom:18px">
    <div class="card">
      <div class="section-title">إحصائيات عروض الأسعار</div>
      <div class="grid-3" style="margin-bottom:14px">
        <div class="metric-card"><div class="metric-label">إجمالي العروض</div><div class="metric-value">${db.quotes.length}</div></div>
        <div class="metric-card"><div class="metric-label">نسبة القبول</div><div class="metric-value green">${qAcc}%</div></div>
        <div class="metric-card"><div class="metric-label">ديون الموردين ($)</div><div class="metric-value red">${finValUSD(supDebt,'total')}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="section-title">أداء كل عميل</div>
      <table>
        <thead><tr><th>العميل</th><th>الأعمال</th><th>إجمالي المبيع ($)</th></tr></thead>
        <tbody>
          ${db.clients.map(c=>{
            const maint=db.maintenance.filter(m=>m.clientId===c.id).length;
            const rev=db.sales.filter(s=>s.clientId===c.id).reduce((s,x)=>s+toUSD(x.totalPrice||0,x.currency),0);
            return `<tr><td style="font-weight:600">${esc(c.name)}</td><td style="text-align:center">${maint}</td><td style="color:var(--accent);font-weight:700">${finValUSD(rev,'total')}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>
  ${renderProjectCostsBoard()}
  ${renderTopReferrersBoard()}
  ${renderWalletWithdrawalsBoard()}`;
}

// مرجع فقط (قراءة) لسحوبات الأرباح الشخصية المسجّلة من صفحة "المحفظة الشخصية" —
// لا علاقة له بأي حساب من حسابات الشركة أعلاه، بيظهر بس للأدمن كتذكير تاريخي.
function renderWalletWithdrawalsBoard(){
  if(!isAdmin()||!db.wallet||!db.wallet.entries)return '';
  const withdrawals=db.wallet.entries.filter(e=>e.source==='profit').sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  if(!withdrawals.length)return '';
  const total=withdrawals.reduce((s,e)=>s+toUSD(+e.amount||0,e.currency||'USD'),0);
  return `<div class="card" style="margin-top:18px">
    <div class="section-title">سحوبات الأرباح للمحفظة الشخصية <span style="font-size:11px;color:var(--text2);font-weight:400">(مرجع فقط — لا يؤثر على أي حساب أعلاه)</span></div>
    <table>
      <thead><tr><th>التاريخ</th><th>المبلغ ($)</th><th>ملاحظة</th></tr></thead>
      <tbody>
        ${withdrawals.map(e=>`<tr><td>${fmtDate(e.date)}</td><td style="font-weight:700">${fmtUSD(toUSD(+e.amount||0,e.currency||'USD'))}</td><td>${esc(e.note||'')}</td></tr>`).join('')}
      </tbody>
      <tfoot><tr class="summary-row"><td>الإجمالي</td><td>${fmtUSD(total)}</td><td></td></tr></tfoot>
    </table>
  </div>`;
}

function renderProjectCostsBoard(){
  const map={};
  function ensure(name){
    if(!map[name])map[name]={name,carExp:0,workerWages:0,workExp:0};
    return map[name];
  }
  db.cars.forEach(c=>(c.expenses||[]).forEach(e=>{
    const p=(e.project||'').trim();if(!p)return;
    ensure(p).carExp+=toUSD(+e.amount||0,e.currency);
  }));
  db.maintenance.forEach(m=>{
    const p=(m.projectName||'').trim();if(!p)return;
    const entry=ensure(p);
    entry.workerWages+=(m.workers||[]).reduce((s,w)=>s+toUSD(+w.wage||0,w.currency||m.workersCurrency||m.currency),0);
    entry.workExp+=(m.expenses||[]).reduce((s,e)=>s+toUSD(+e.amount||0,e.currency||m.expensesCurrency||m.currency),0);
    // تكلفة السيارات المرتبطة تحديداً بهذا العمل (بغض النظر عن ربط السيارة بالمشروع من صفحة السيارات)
    entry.carExp+=(m.cars||[]).reduce((s,c)=>s+toUSD(+c.amount||0,c.currency||m.carsCurrency||m.currency),0);
  });
  const rows=Object.values(map).sort((a,b)=>(b.carExp+b.workerWages+b.workExp)-(a.carExp+a.workerWages+a.workExp));
  if(!rows.length)return `<div class="card" style="margin-top:18px"><div class="section-title">تكلفة المشاريع <span style="font-size:11px;color:var(--text2);font-weight:400">(سيارات + أجور عمال + مصاريف أعمال)</span></div><div class="empty-state" style="padding:30px"><i class="ti ti-briefcase"></i><p>لا يوجد مصاريف أو أعمال مربوطة بمشروع بعد. اربط المشاريع من لائحة السيارات وعند تسجيل الأعمال.</p></div></div>`;
  const tC=rows.reduce((s,r)=>s+r.carExp,0),tW=rows.reduce((s,r)=>s+r.workerWages,0),tE=rows.reduce((s,r)=>s+r.workExp,0);
  return `<div class="card" style="margin-top:18px">
    <div class="section-title">تكلفة المشاريع <span style="font-size:11px;color:var(--text2);font-weight:400">(للتسعير المستقبلي)</span></div>
    <div class="table-note" style="margin:-4px 0 10px">ملاحظة: كل الأرقام هون محوّلة تلقائياً للدولار حسب سعر الصرف الحالي، لأنها قد تكون مسجّلة بعملات مختلفة (سيارات/عمال/مصاريف).</div>
    <table>
      <thead><tr><th>المشروع</th><th>كلفة السيارات ($)</th><th>أجور العمال ($)</th><th>مصاريف الأعمال ($)</th><th>الإجمالي ($)</th></tr></thead>
      <tbody>
        ${rows.map(r=>`<tr>
          <td style="font-weight:700">${esc(r.name)}</td>
          <td>${finValUSD(r.carExp,'total')}</td>
          <td>${finValUSD(r.workerWages,'salary')}</td>
          <td>${finValUSD(r.workExp,'total')}</td>
          <td style="font-weight:800;color:var(--accent-dark)">${finValUSD(r.carExp+r.workerWages+r.workExp,'total')}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr class="summary-row"><td>الإجمالي</td><td>${finValUSD(tC,'total')}</td><td>${finValUSD(tW,'salary')}</td><td>${finValUSD(tE,'total')}</td><td>${finValUSD(tC+tW+tE,'total')}</td></tr></tfoot>
    </table>
    <div class="table-note">الأرقام هون مبنية على أسماء المشاريع الموحدة (من إعدادات ⟶ المشاريع) المختارة عند تسجيل مصروف سيارة أو عمل صيانة.</div>
  </div>`;
}

function setProjectStatus(projectId,status){
  const p=(db.projects||[]).find(x=>x.id===projectId);
  if(!p)return;
  p.status=status;
  p.autoClosedNote=false;
  saveDB(db);
}

function saveProjectNotes(projectId,val){
  const p=(db.projects||[]).find(x=>x.id===projectId);
  if(!p)return;
  p.notes=val;
  saveDB(db);
}

function projectStats(name,useLiveRate){
  const conv=(amt,cur,rec)=>useLiveRate?toUSD(amt,cur):toUSDHist(amt,cur,rec);
  const sales=db.sales.filter(s=>(s.projectName||'')===name);
  const maints=db.maintenance.filter(m=>(m.projectName||'')===name);
  const carExpItems=[];
  db.cars.forEach(c=>(c.expenses||[]).forEach(e=>{if((e.project||'')===name)carExpItems.push({...e,carName:c.name});}));
  const salesRevenue=sales.reduce((s,x)=>s+conv(saleRecognizedRevenue(x),x.currency,x),0);
  const salesCost=sales.reduce((s,x)=>s+conv(saleRecognizedCost(x),x.currency,x),0);
  const maintIncome=maints.reduce((s,m)=>s+conv(maintRecognizedIncome(m),m.currency,m),0);
  const maintWages=maints.reduce((s,m)=>s+conv(maintRecognizedWages(m),m.currency,m),0);
  const maintExpenses=maints.reduce((s,m)=>s+conv(maintRecognizedExpenses(m),m.currency,m),0);
  const carExpenses=carExpItems.reduce((s,e)=>s+toUSD(+e.amount||0,e.currency),0);
  // العمولات المرتبطة بفواتير/أعمال هذا المشروع لحالها (كل فاتورة/عمل وعمولته الخاصة) — لازم تُخصم من ربح المشروع الصافي (موحّدة بالدولار، بنفس منطق سعر الصرف المستخدم بباقي التقارير)
  const referralCost=sales.reduce((s,x)=>s+conv(saleReferralCommission(x),x.currency,x),0)+maints.reduce((s,m)=>s+conv(maintReferralCommission(m),m.currency,m),0);
  const revenue=salesRevenue+maintIncome;
  // عمولة على مستوى المشروع كلّه (بدل ما تتسجل ع كل فاتورة/عمل لحاله) — بتُخصم مرة وحدة من الربح الكلي للمشروع، بالدولار مباشرة (مبلغ العمولة نفسه مُدخل بالدولار أصلاً، ما إله علاقة بسعر الصرف)
  const rec=(db.projects||[]).find(x=>x.name===name);
  const profitBeforeProjectCommission=revenue-(salesCost+maintWages+maintExpenses+carExpenses+referralCost);
  let projectCommission=0;
  if(rec){
    if(rec.projectCommissionType==='amount'){
      projectCommission=+rec.projectCommissionAmount||0;
    }else if(+rec.projectCommissionPercent>0){
      projectCommission=profitBeforeProjectCommission>0?profitBeforeProjectCommission*(+rec.projectCommissionPercent/100):0;
    }
  }
  const cost=salesCost+maintWages+maintExpenses+carExpenses+referralCost+projectCommission;
  const profit=revenue-cost;
  const salesProfit=salesRevenue-salesCost;
  const maintProfit=maintIncome-maintWages-maintExpenses;
  const margin=revenue>0?Math.round(profit/revenue*100):0;
  // ===== إجمالي/مسدد/متبقي المشروع (مبيعات + أعمال معاً، موحّد بالدولار) =====
  // بيستخدم نفس منطق سعر الصرف المستخدم بباقي أرقام هالدالة (تاريخي أو حي حسب useLiveRate)، فيبقى متطابق معهن.
  const salesTotalUSD=sales.reduce((s,x)=>s+conv(+x.totalPrice||0,x.currency,x),0);
  const salesPaidUSD=sales.reduce((s,x)=>s+conv(Math.min(+x.paidAmount||0,+x.totalPrice||0),x.currency,x),0);
  const salesRemainingUSD=sales.reduce((s,x)=>s+conv(saleRemaining(x),x.currency,x),0);
  const maintTotalUSD=maints.reduce((s,m)=>s+conv(getMaintenanceIncome(m),m.currency,m),0);
  const maintPaidUSD=maints.reduce((s,m)=>s+conv(Math.min(+m.paidAmount||0,getMaintenanceIncome(m)),m.currency,m),0);
  const maintRemainingUSD=maints.reduce((s,m)=>s+conv(maintRemaining(m),m.currency,m),0);
  const grandTotalUSD=salesTotalUSD+maintTotalUSD;
  const grandPaidUSD=salesPaidUSD+maintPaidUSD;
  const grandRemainingUSD=salesRemainingUSD+maintRemainingUSD;
  return {name,sales,maints,carExpItems,salesRevenue,salesCost,maintIncome,maintWages,maintExpenses,carExpenses,referralCost,projectCommission,revenue,cost,profit,salesProfit,maintProfit,margin,
    salesTotalUSD,salesPaidUSD,salesRemainingUSD,maintTotalUSD,maintPaidUSD,maintRemainingUSD,grandTotalUSD,grandPaidUSD,grandRemainingUSD};
}
// نافذة تعديل عمولة المشروع كامل (بدل ما تتسجل ع كل فاتورة/عمل لحاله) — بتُخصم مرة وحدة من صافي ربح المشروع الكلي
function openEditProjectCommissionModal(name){
  const rec=findOrCreateProject(name);
  if(!rec)return;
  saveDB(db);
  const isAmount=rec.projectCommissionType==='amount';
  showModal(`
    <div class="modal-title">عمولة المشروع بالكامل</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">خصم مرة وحدة من ربح المشروع.</div>
    <div class="form-group">
      <label class="form-label">لمين العمولة؟ <span style="font-size:11px;color:var(--text2);font-weight:400">(اختياري، للتوضيح فقط)</span></label>
      <input type="text" class="form-control" id="epc-referrer" value="${esc(rec.projectCommissionReferrer||'')}" placeholder="اسم الشخص أو الجهة">
    </div>
    <div class="form-group">
      <div style="display:flex;gap:10px;margin-bottom:6px">
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="radio" name="epc-type" value="percent" ${!isAmount?'checked':''}> نسبة % من ربح المشروع</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="radio" name="epc-type" value="amount" ${isAmount?'checked':''}> مبلغ ثابت ($)</label>
      </div>
      <input type="number" class="form-control" id="epc-value" value="${isAmount?(rec.projectCommissionAmount||''):(rec.projectCommissionPercent||'')}" min="0" step="0.5" placeholder="مثال: 10">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveEditedProjectCommission('${esc(name).replace(/'/g,"\\'")}')">حفظ</button>
    </div>
  `);
}
function saveEditedProjectCommission(name){
  const rec=findOrCreateProject(name);
  if(!rec)return;
  const typeEl=document.querySelector('input[name="epc-type"]:checked');
  const commissionType=typeEl?typeEl.value:'percent';
  const val=+(document.getElementById('epc-value').value)||0;
  rec.projectCommissionType=commissionType;
  rec.projectCommissionPercent=commissionType==='amount'?0:val;
  rec.projectCommissionAmount=commissionType==='amount'?val:0;
  rec.projectCommissionReferrer=(document.getElementById('epc-referrer').value||'').trim();
  saveDB(db);closeModal();
  window._projView=name;render();
}
// تسديد/تراجع عن تسديد عمولة المشروع بالكامل — منفصل تماماً عن عمولات الفواتير والأعمال المفردة
function payProjectCommission(name){
  const rec=findOrCreateProject(name);
  if(!rec)return;
  rec.projectCommissionPaid=true;
  rec.projectCommissionPaidDate=localToday();
  saveDB(db);
  window._projView=name;render();
}
function unpayProjectCommission(name){
  const rec=findOrCreateProject(name);
  if(!rec)return;
  rec.projectCommissionPaid=false;
  rec.projectCommissionPaidDate='';
  saveDB(db);
  window._projView=name;render();
}
// إجمالي عمولات المشاريع الكاملة (منفصلة عن عمولات الفواتير/الأعمال المفردة) — تُستخدم بلوحة التحكم الرئيسية حتى ما تضيع من إجمالي العمولات
// تُحسب حسب تاريخ إنشاء المشروع (createdDate) لأنها عمولة على المشروع ككل وما إلها تاريخ فاتورة معيّن
// useLiveRate=true (اللوحة الرئيسية تستخدم دايماً سعر الصرف الحي) — false (التقارير/المحفظة تستخدم سعر الصرف التاريخي حسب الإعدادات، متل باقي أرقامهن)
function projectCommissionsInRange(from,to,useLiveRate){
  let total=0,unpaid=0;
  (db.projects||[]).forEach(p=>{
    if((from||to)&&!dashInRange(p.createdDate,from,to))return; // T26: فترة مفتوحة من طرف وحد كمان بتنفلتر (كانت بتتجاهل)
    const stats=projectStats(p.name,useLiveRate);
    if(stats.projectCommission>0){
      total+=stats.projectCommission;
      if(!p.projectCommissionPaid)unpaid+=stats.projectCommission;
    }
  });
  return {total,unpaid};
}

function setMaintStatusQuick(maintId,status){
  const m=db.maintenance.find(x=>x.id===maintId);if(!m)return;
  m.status=status;
  saveDB(db);
  refreshProjectAutoStatus(m.projectName);
  render();
}

function openProjectPaymentModal(name){
  const p=projectStats(name);
  const unpaidSales=p.sales.filter(s=>saleRemaining(s)>0);
  const unpaidMaints=p.maints.filter(m=>maintRemaining(m)>0);
  if(!unpaidSales.length&&!unpaidMaints.length){alert('كل فواتير هذا المشروع (مبيعات وأعمال) مسددة بالكامل، ما في شي لتسديده.');return;}
  const currencies=[...new Set([...unpaidSales.map(s=>s.currency||'SYP'),...unpaidMaints.map(m=>m.currency||'SYP')])];
  if(!window._ppCurrency||!currencies.includes(window._ppCurrency))window._ppCurrency=currencies[0];
  showModal(renderProjectPaymentModalHTML(name));
}

function renderProjectPaymentModalHTML(name){
  const p=projectStats(name);
  const cur=window._ppCurrency;
  const salesRows=p.sales.filter(s=>(s.currency||'SYP')===cur&&saleRemaining(s)>0);
  const maintRows=p.maints.filter(m=>(m.currency||'SYP')===cur&&maintRemaining(m)>0);
  const currencies=[...new Set([...p.sales.filter(s=>saleRemaining(s)>0).map(s=>s.currency||'SYP'),...p.maints.filter(m=>maintRemaining(m)>0).map(m=>m.currency||'SYP')])];
  return `
    <div class="modal-title">تسديد دفعة للمشروع — ${esc(name)}</div>
    ${currencies.length>1?`<div class="form-group" style="margin-bottom:10px">
      <label class="form-label">العملة</label>
      <select class="form-control" style="width:auto" onchange='window._ppCurrency=this.value;showModal(renderProjectPaymentModalHTML(${esc(JSON.stringify(name))}))'>${currencies.map(c=>`<option value="${c}" ${c===cur?'selected':''}>${curLabel(c)}</option>`).join('')}</select>
      <div style="font-size:11px;color:var(--text2);margin-top:4px">(عملات متعددة)</div>
    </div>`:''}
    <div style="background:var(--bg2);border-radius:8px;padding:10px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;margin-bottom:6px">توزيع تلقائي حسب نسبة المتبقي (اختياري — بيعبّي الحقول تحت، وفيك تعدّلها يدوياً بعدين)</div>
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">إجمالي الدفعة</label><input type="text" inputmode="decimal" class="form-control" id="pp-auto-amt" oninput="formatMoneyInput(this)" placeholder="0"></div>
        <div class="form-group"><label class="form-label">إجمالي الخصم</label><input type="text" inputmode="decimal" class="form-control" id="pp-auto-disc" oninput="formatMoneyInput(this)" placeholder="0"></div>
      </div>
      <button type="button" class="btn btn-sm" onclick='autoDistributeProjectPayment(${esc(JSON.stringify(name))})'><i class="ti ti-arrows-split"></i> توزيع على الفواتير بالتناسب</button>
    </div>
    <div style="font-size:12px;font-weight:700;margin-bottom:6px">تحكم كامل — حدد المبلغ والخصم لكل فاتورة/عمل يدوياً:</div>
    ${!salesRows.length?'':`<div style="font-weight:700;font-size:12.5px;margin:8px 0 4px">فواتير المبيع</div>
    <table style="margin-bottom:10px"><thead><tr><th>العميل</th><th>المتبقي</th><th>دفعة</th><th>خصم</th><th>تسديد</th></tr></thead><tbody>
      ${salesRows.map(s=>`<tr><td style="font-size:12px">${esc(getClientName(s.clientId)||s.clientNameFree||'—')}</td><td style="font-size:12px;color:var(--danger)">${fmt(saleRemaining(s))}</td>
        <td><input type="text" inputmode="decimal" class="form-control pp-amt" id="pp-amt-s-${s.id}" style="width:90px" oninput="formatMoneyInput(this);updateProjectPaymentTotals();applyProjectRowSettlement('s','${s.id}')" placeholder="0"></td>
        <td><input type="text" inputmode="decimal" class="form-control pp-disc" id="pp-disc-s-${s.id}" style="width:90px" oninput="formatMoneyInput(this);updateProjectPaymentTotals()" placeholder="0"></td>
        <td style="text-align:center"><input type="checkbox" class="pp-settlement" id="pp-settle-s-${s.id}" data-remaining="${saleRemaining(s)}" onchange="applyProjectRowSettlement('s','${s.id}')" title="تسديد — اعتبر الفرق خصم تلقائياً"></td>
      </tr>`).join('')}
    </tbody></table>`}
    ${!maintRows.length?'':`<div style="font-weight:700;font-size:12.5px;margin:8px 0 4px">أعمال الصيانة</div>
    <table style="margin-bottom:10px"><thead><tr><th>العميل</th><th>المتبقي</th><th>دفعة</th><th>خصم</th><th>تسديد</th></tr></thead><tbody>
      ${maintRows.map(m=>`<tr><td style="font-size:12px">${esc(getClientName(m.clientId)||m.clientNameFree||'—')}</td><td style="font-size:12px;color:var(--danger)">${fmt(maintRemaining(m))}</td>
        <td><input type="text" inputmode="decimal" class="form-control pp-amt" id="pp-amt-m-${m.id}" style="width:90px" oninput="formatMoneyInput(this);updateProjectPaymentTotals();applyProjectRowSettlement('m','${m.id}')" placeholder="0"></td>
        <td><input type="text" inputmode="decimal" class="form-control pp-disc" id="pp-disc-m-${m.id}" style="width:90px" oninput="formatMoneyInput(this);updateProjectPaymentTotals()" placeholder="0"></td>
        <td style="text-align:center"><input type="checkbox" class="pp-settlement" id="pp-settle-m-${m.id}" data-remaining="${maintRemaining(m)}" onchange="applyProjectRowSettlement('m','${m.id}')" title="تسديد — اعتبر الفرق خصم تلقائياً"></td>
      </tr>`).join('')}
    </tbody></table>`}
    <div id="pp-total-summary" style="font-size:12.5px;font-weight:700;color:var(--accent);margin:8px 0 12px">إجمالي الدفعة المدخلة: 0 — إجمالي الخصم المدخل: 0</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">تاريخ الدفعة</label><input type="date" class="form-control" id="pp-date" value="${localToday()}"></div>
      <div class="form-group"><label class="form-label">ملاحظة</label><input type="text" class="form-control" id="pp-note" placeholder="مثلاً: نقداً، تحويل بنكي..."></div>
    </div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick='saveProjectPayment(${esc(JSON.stringify(name))})'>حفظ توزيع الدفعة</button></div>
  `;
}

function applyProjectRowSettlement(kind,id){
  const chk=document.getElementById(`pp-settle-${kind}-${id}`);
  const amtEl=document.getElementById(`pp-amt-${kind}-${id}`);
  const discEl=document.getElementById(`pp-disc-${kind}-${id}`);
  if(!chk||!amtEl||!discEl)return;
  if(chk.checked){
    const remaining=+chk.dataset.remaining||0;
    const amount=unformatNum(amtEl.value);
    const diff=Math.max(remaining-amount,0);
    discEl.value=fmt(diff);
    discEl.readOnly=true;
    discEl.style.background='var(--bg3)';
  }else{
    discEl.readOnly=false;
    discEl.style.background='';
  }
  updateProjectPaymentTotals();
}
function updateProjectPaymentTotals(){
  const totalAmt=[...document.querySelectorAll('.pp-amt')].reduce((s,el)=>s+(unformatNum(el.value)||0),0);
  const totalDisc=[...document.querySelectorAll('.pp-disc')].reduce((s,el)=>s+(unformatNum(el.value)||0),0);
  const el=document.getElementById('pp-total-summary');
  if(el)el.textContent=`إجمالي الدفعة المدخلة: ${fmt(totalAmt)} — إجمالي الخصم المدخل: ${fmt(totalDisc)}`;
}

function autoDistributeProjectPayment(name){
  const totalAmt=unformatNum(document.getElementById('pp-auto-amt').value)||0;
  const totalDisc=unformatNum(document.getElementById('pp-auto-disc').value)||0;
  if(totalAmt<=0&&totalDisc<=0){alert('يرجى إدخال إجمالي الدفعة أو الخصم أولاً');return;}
  const cur=window._ppCurrency;
  const p=projectStats(name);
  const rows=[
    ...p.sales.filter(s=>(s.currency||'SYP')===cur&&saleRemaining(s)>0).map(s=>({kind:'s',id:s.id,rem:saleRemaining(s)})),
    ...p.maints.filter(m=>(m.currency||'SYP')===cur&&maintRemaining(m)>0).map(m=>({kind:'m',id:m.id,rem:maintRemaining(m)}))
  ];
  const totalRem=rows.reduce((s,r)=>s+r.rem,0);
  if(totalRem<=0)return;
  rows.forEach(r=>{
    const share=r.rem/totalRem;
    const amtEl=document.getElementById(`pp-amt-${r.kind}-${r.id}`);
    const discEl=document.getElementById(`pp-disc-${r.kind}-${r.id}`);
    if(amtEl)amtEl.value=fmt(Math.round(totalAmt*share*100)/100);
    if(discEl&&!discEl.readOnly)discEl.value=fmt(Math.round(totalDisc*share*100)/100);
    applyProjectRowSettlement(r.kind,r.id);
  });
  updateProjectPaymentTotals();
}

function saveProjectPayment(name){
  const cur=window._ppCurrency;
  const date=document.getElementById('pp-date').value||localToday();
  const note=document.getElementById('pp-note').value||'';
  const p=projectStats(name);
  { // T5: فحص مسبق — إذا أي بند تجاوز المتبقي ما منطبّق ولا دفعة
    const _bad=[];
    const _chk=(rec,rem,kind)=>{
      const aEl=document.getElementById(`pp-amt-${kind}-${rec.id}`),dEl=document.getElementById(`pp-disc-${kind}-${rec.id}`);
      const a=aEl?(unformatNum(aEl.value)||0):0,d=dEl?(unformatNum(dEl.value)||0):0;
      if(a<=0&&d<=0)return;
      if(round2(a+d)>round2(rem)+0.01)_bad.push((getClientName(rec.clientId)||'—')+': '+fmt(round2(a+d))+' > '+fmt(round2(rem)));
    };
    p.sales.filter(s=>(s.currency||'SYP')===cur).forEach(s=>_chk(s,saleRemaining(s),'s'));
    p.maints.filter(m=>(m.currency||'SYP')===cur).forEach(m=>_chk(m,maintRemaining(m),'m'));
    if(_bad.length){alert('ما انحفظت أي دفعة. هالبنود تجاوزت المتبقي:\n'+_bad.join('\n'));return;}
  }
  let applied=0;
  p.sales.filter(s=>(s.currency||'SYP')===cur).forEach(s=>{
    const amtEl=document.getElementById(`pp-amt-s-${s.id}`);
    const discEl=document.getElementById(`pp-disc-s-${s.id}`);
    const amount=amtEl?(unformatNum(amtEl.value)||0):0;
    const discount=discEl?(unformatNum(discEl.value)||0):0;
    if(amount<=0&&discount<=0)return;
    if(!s.payments)s.payments=[];
    const convertedAmount=convertCurrency(amount,cur,s.currency||'SYP');
    const discountConverted=convertCurrency(discount,cur,s.currency||'SYP');
    s.payments.push({id:uid(),amount,currency:cur,date,note:note||'دفعة مشروع',convertedAmount,discount,discountConverted});
    s.paidAmount=round2(s.payments.reduce((sum,pp)=>sum+(+pp.convertedAmount||0),0));
    s.discAmount=round2(s.payments.reduce((sum,pp)=>sum+(+pp.discountConverted||0),0));
    applied++;
  });
  p.maints.filter(m=>(m.currency||'SYP')===cur).forEach(m=>{
    const amtEl=document.getElementById(`pp-amt-m-${m.id}`);
    const discEl=document.getElementById(`pp-disc-m-${m.id}`);
    const amount=amtEl?(unformatNum(amtEl.value)||0):0;
    const discount=discEl?(unformatNum(discEl.value)||0):0;
    if(amount<=0&&discount<=0)return;
    if(!m.payments)m.payments=[];
    const convertedAmount=convertCurrency(amount,cur,m.currency||'SYP');
    const discountConverted=convertCurrency(discount,cur,m.currency||'SYP');
    m.payments.push({id:uid(),amount,currency:cur,date,note:note||'دفعة مشروع',convertedAmount,discount,discountConverted});
    m.paidAmount=round2(m.payments.reduce((sum,pp)=>sum+(+pp.convertedAmount||0),0));
    m.discAmount=round2(m.payments.reduce((sum,pp)=>sum+(+pp.discountConverted||0),0));
    applied++;
  });
  if(!applied){alert('يرجى إدخال مبلغ دفعة أو خصم لبند واحد على الأقل');return;}
  saveDB(db);
  refreshProjectAutoStatus(name);
  closeModal();
  window._projView=name;
  render();
}

function renderProjects(el,acts){
  if(!canViewFinance()){
    if(acts)acts.innerHTML='';
    el.innerHTML='<div class="empty-state"><i class="ti ti-lock"></i>هذا القسم متاح فقط لمن لديه صلاحية رؤية الأرباح والتوتال. تواصل مع المدير لمنحك هذه الصلاحية.</div>';
    return;
  }
  if(window._projView)return renderProjectDetail(el,acts,window._projView);
  if(acts)acts.innerHTML='';
  const q=(window._projSearch||'').trim().toLowerCase();
  const sortBy=window._projSort||'revenue';
  let list=(db.projects||[]).map(p=>({...projectStats(p.name),id:p.id,status:p.status,createdDate:p.createdDate,quoteId:p.quoteId}));
  if(q)list=list.filter(p=>(p.name||'').toLowerCase().includes(q));
  list.sort((a,b)=>sortBy==='name'?(a.name||'').localeCompare(b.name||''):sortBy==='profit'?b.profit-a.profit:b.revenue-a.revenue);
  const tRev=list.reduce((s,p)=>s+p.revenue,0),tCost=list.reduce((s,p)=>s+p.cost,0),tProfit=list.reduce((s,p)=>s+p.profit,0);
  el.innerHTML=`<div class="module-header"><div><div class="module-title"><i class="ti ti-briefcase"></i> المشاريع</div><div class="module-subtitle">اضغط على أي مشروع لتشوف كل التفاصيل: المبيعات، الأعمال، المصاريف، والربح مع النسب.</div></div><div class="module-tools"><input class="form-control soft-input" placeholder="بحث باسم المشروع..." value="${esc(window._projSearch||'')}" oninput="window._projSearch=this.value;renderProjects(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><select class="form-control" onchange="window._projSort=this.value;renderProjects(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><option value="revenue" ${sortBy==='revenue'?'selected':''}>الأعلى إيراداً</option><option value="profit" ${sortBy==='profit'?'selected':''}>الأعلى ربحاً</option><option value="name" ${sortBy==='name'?'selected':''}>أبجدياً</option></select></div></div>
  <div class="kpi-strip"><div class="kpi-mini"><div class="label">عدد المشاريع</div><div class="value">${list.length}</div></div><div class="kpi-mini"><div class="label">إجمالي الإيرادات ($)</div><div class="value" style="color:var(--success)">${finValUSD(tRev,'total')}</div></div><div class="kpi-mini"><div class="label">إجمالي التكلفة ($)</div><div class="value" style="color:var(--danger)">${finValUSD(tCost,'total')}</div></div><div class="kpi-mini"><div class="label">صافي الربح ($)${infoTip('محسوب على أساس المبالغ المحصّلة فعلياً من العملاء، وليس القيمة الكاملة للفواتير.')}</div><div class="value" style="color:${tProfit>=0?'var(--success)':'var(--danger)'}">${finValUSD(tProfit,'profit')}</div></div></div>
  <div class="card"><div style="overflow-x:auto">${!list.length?`<div class="empty-state"><i class="ti ti-briefcase"></i><p>${q?'لا يوجد مشاريع مطابقة للبحث':'لا يوجد مشاريع بعد. المشروع بينضاف تلقائياً أول ما تكتب اسمو بفاتورة مبيع أو عمل أو عرض سعر.'}</p></div>`:`
    <table class="responsive-table"><thead><tr><th>المشروع</th><th>الإيرادات ($)</th><th>التكلفة ($)</th><th>الربح ($)</th><th>هامش الربح</th><th>متبقي (كلي، $)</th><th></th></tr></thead><tbody>
      ${list.map(p=>`<tr style="cursor:pointer" onclick="window._projView='${esc(p.name).replace(/'/g,"\\'")}';render()">
        <td data-label="المشروع" style="font-weight:700">${esc(p.name)}</td>
        <td data-label="الإيرادات ($)">${finValUSD(p.revenue,'total')}</td>
        <td data-label="التكلفة ($)" style="color:var(--danger)">${finValUSD(p.cost,'total')}</td>
        <td data-label="الربح ($)" style="color:${p.profit>=0?'var(--success)':'var(--danger)'};font-weight:800">${finValUSD(p.profit,'profit')}</td>
        <td data-label="هامش الربح">${canViewProfits()?p.margin+'%':'••••'}</td>
        <td data-label="متبقي (كلي، $)" style="font-weight:700;color:${p.grandRemainingUSD>0?'var(--danger)':'var(--success)'}">${finValUSD(p.grandRemainingUSD,'total')}</td>
        <td data-label=""><button class="btn btn-sm" onclick="event.stopPropagation();window._projView='${esc(p.name).replace(/'/g,"\\'")}';render()">التفاصيل</button>${p.quoteId?`<button class="btn btn-sm" style="margin-right:4px" onclick="event.stopPropagation();compareQuoteToActual('${p.quoteId}')" title="مقارنة العرض بالتنفيذ الفعلي"><i class="ti ti-scale"></i></button>`:''}${(!p.revenue&&!p.cost)?`<button class="btn btn-sm btn-danger" style="margin-right:4px" onclick="event.stopPropagation();deleteProjectByName('${esc(p.name).replace(/'/g,"\\'")}')" title="حذف المشروع من اللائحة"><i class="ti ti-trash"></i></button>`:''}</td>
      </tr>`).join('')}
    </tbody></table>`}</div></div>`;
}

function renderProjectDetail(el,acts,name){
  const p=projectStats(name);
  const rec=(db.projects||[]).find(x=>x.name===name);
  if(acts)acts.innerHTML=`<button class="btn" onclick="window._projView=null;render()"><i class="ti ti-arrow-right"></i> رجوع للمشاريع</button>`;
  const costParts=[
    {label:'تكلفة المبيعات',val:p.salesCost},
    {label:'أجور العمال',val:p.maintWages},
    {label:'مصاريف الأعمال',val:p.maintExpenses},
    {label:'مصاريف السيارات',val:p.carExpenses},
    {label:'العمولات (على كل فاتورة/عمل لحاله)',val:p.referralCost},
    {label:'عمولة المشروع بالكامل',val:p.projectCommission},
  ];
  el.innerHTML=`<div class="module-header"><div><div class="module-title"><i class="ti ti-briefcase"></i> ${esc(p.name)}</div><div class="module-subtitle">تفاصيل الإيرادات والتكاليف والربح لهذا المشروع.${rec?` — الحالة: <b>${esc(rec.status||'جارية')}</b>${rec.autoClosedNote&&rec.status==='منتهية'?' <span style="color:var(--accent)">(أُقفل تلقائياً بعد تحصيل كامل قيمته)</span>':''}${rec.createdDate?' — تاريخ الإنشاء: '+esc(rec.createdDate):''}`:''}</div></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    ${rec&&rec.quoteId?`<button class="btn btn-sm" onclick="navigate('quotes');openQuoteModal('${rec.quoteId}')"><i class="ti ti-file-text"></i> عرض السعر الأصلي</button>`:''}
    ${rec&&rec.quoteId?`<button class="btn btn-sm" onclick="compareQuoteToActual('${rec.quoteId}')"><i class="ti ti-scale"></i> مقارنة العرض بالتنفيذ الفعلي</button>`:''}
    <button class="btn btn-sm btn-primary" onclick='printProjectStatement(${esc(JSON.stringify(p.name))},true)'><i class="ti ti-file-invoice"></i> كشف حساب شامل للمشروع</button>
    <button class="btn btn-sm" onclick='printProjectStatement(${esc(JSON.stringify(p.name))},false)'><i class="ti ti-file-text"></i> وصف أعمال (بدون أسعار)</button>
    <button class="btn btn-sm btn-primary" onclick='openProjectPaymentModal(${esc(JSON.stringify(p.name))})'><i class="ti ti-cash"></i> تسديد دفعة للمشروع</button>
    <button class="btn btn-sm" style="color:var(--gold-dark)" onclick='openEditProjectCommissionModal(${esc(JSON.stringify(p.name))})'><i class="ti ti-percentage"></i> عمولة المشروع بالكامل${p.projectCommission>0?` (${finValUSD(p.projectCommission,'total')})`:''}</button>
    ${p.projectCommission>0?(rec&&rec.projectCommissionPaid?`<button class="btn btn-sm" style="color:var(--success)" title="بتاريخ ${fmtDate(rec.projectCommissionPaidDate)}" onclick='if(confirm("التراجع عن تسديد عمولة المشروع؟"))unpayProjectCommission(${esc(JSON.stringify(p.name))})'><i class="ti ti-user-check"></i> عمولة المشروع مدفوعة — تراجع</button>`:`<button class="btn btn-sm btn-gold" style="background:var(--gold-light);color:var(--gold-dark)" onclick='if(confirm("تأكيد تسديد عمولة المشروع (${finValUSD(p.projectCommission,'total')})؟"))payProjectCommission(${esc(JSON.stringify(p.name))})'><i class="ti ti-user-exclamation"></i> تسديد عمولة المشروع</button>`):''}
    ${rec?`<select class="form-control" style="width:auto" onchange="setProjectStatus('${rec.id}',this.value)"><option value="جارية" ${rec.status==='جارية'?'selected':''}>جارية</option><option value="منتهية" ${rec.status==='منتهية'?'selected':''}>منتهية</option><option value="متوقفة" ${rec.status==='متوقفة'?'selected':''}>متوقفة</option></select>`:''}
  </div></div>
  <div class="kpi-strip"><div class="kpi-mini"><div class="label">الإيرادات ($)</div><div class="value" style="color:var(--success)">${finValUSD(p.revenue,'total')}</div></div><div class="kpi-mini"><div class="label">التكلفة ($)</div><div class="value" style="color:var(--danger)">${finValUSD(p.cost,'total')}</div></div><div class="kpi-mini"><div class="label">صافي الربح ($)${infoTip('محسوب على أساس المبالغ المحصّلة فعلياً من العملاء، وليس القيمة الكاملة للفواتير.')}</div><div class="value" style="color:${p.profit>=0?'var(--success)':'var(--danger)'}">${finValUSD(p.profit,'profit')}</div></div><div class="kpi-mini"><div class="label">هامش الربح</div><div class="value" style="color:${canViewProfits()&&p.margin<0?'var(--danger)':'var(--success)'}">${canViewProfits()?p.margin+'%':'••••'}</div></div></div>
  <div class="card" style="margin-bottom:18px">
    <div class="section-title">إجمالي المشروع <span style="font-weight:400;color:var(--text2);font-size:11px">(مبيعات + أعمال معاً — نفس أرقام كشف الحساب الشامل)</span></div>
    <div style="overflow-x:auto"><table>
      <thead><tr><th></th><th>الإجمالي ($)</th><th>المسدد ($)</th><th>المتبقي ($)</th></tr></thead>
      <tbody>
        <tr><td>مبيعات</td><td style="font-weight:700">${finValUSD(p.salesTotalUSD,'total')}</td><td style="font-weight:700;color:var(--success)">${finValUSD(p.salesPaidUSD,'total')}</td><td style="font-weight:700;color:${p.salesRemainingUSD>0?'var(--danger)':'var(--success)'}">${finValUSD(p.salesRemainingUSD,'total')}</td></tr>
        <tr><td>أعمال</td><td style="font-weight:700">${finValUSD(p.maintTotalUSD,'total')}</td><td style="font-weight:700;color:var(--success)">${finValUSD(p.maintPaidUSD,'total')}</td><td style="font-weight:700;color:${p.maintRemainingUSD>0?'var(--danger)':'var(--success)'}">${finValUSD(p.maintRemainingUSD,'total')}</td></tr>
        <tr class="summary-row"><td>إجمالي المشروع الكلي</td><td style="font-weight:800">${finValUSD(p.grandTotalUSD,'total')}</td><td style="font-weight:800;color:var(--success)">${finValUSD(p.grandPaidUSD,'total')}</td><td style="font-weight:800;color:${p.grandRemainingUSD>0?'var(--danger)':'var(--success)'}">${finValUSD(p.grandRemainingUSD,'total')}</td></tr>
      </tbody>
    </table></div>
    ${(()=>{const cs=[...new Set([...p.sales.map(s=>s.currency||'SYP'),...p.maints.map(m=>m.currency||'SYP')])];return cs.length>1?`<div style="font-size:11px;color:var(--text2);margin-top:6px">محوّلة للدولار (عملات مختلفة).</div>`:'';})()}
  </div>
  ${rec?`<div class="card" style="margin-bottom:18px">
    <div class="section-title">ملاحظات المشروع <span style="font-weight:400;color:var(--text2);font-size:11px">(بتنطبع بآخر كشف الحساب/وصف الأعمال، متل ملاحظات المبيعات والأعمال بالضبط)</span></div>
    <textarea class="form-control" rows="2" placeholder="اكتب أي ملاحظة بدك تظهر بالفاتورة المطبوعة لهذا المشروع..." onchange="saveProjectNotes('${rec.id}',this.value)">${esc(rec.notes||'')}</textarea>
  </div>`:''}
  <div class="grid-2" style="margin-bottom:18px">
    <div class="card">
      <div class="section-title">تركيبة التكلفة (النسب)</div>
      ${p.cost<=0?`<div class="muted" style="padding:10px">لا يوجد تكلفة مسجّلة لهذا المشروع بعد.</div>`:costParts.filter(c=>c.val>0).map(c=>{
        const pct=Math.round(c.val/p.cost*100);
        return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>${esc(c.label)}</span><span style="font-weight:700">${finValUSD(c.val,'total')} (${pct}%)</span></div><div style="background:var(--bg3);border-radius:20px;height:8px;overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--accent)"></div></div></div>`;
      }).join('')}
    </div>
    <div class="card">
      <div class="section-title">ملخص</div>
      <table>
        <tbody>
          <tr><td>عدد فواتير المبيع</td><td style="font-weight:700">${p.sales.length}</td></tr>
          <tr><td>عدد أعمال الصيانة</td><td style="font-weight:700">${p.maints.length}</td></tr>
          <tr><td>عدد مصاريف السيارات</td><td style="font-weight:700">${p.carExpItems.length}</td></tr>
          <tr><td>إيرادات المبيعات ($)</td><td style="font-weight:700">${finValUSD(p.salesRevenue,'total')}</td></tr>
          <tr><td>إيرادات الأعمال ($)</td><td style="font-weight:700">${finValUSD(p.maintIncome,'total')}</td></tr>
          <tr style="border-top:1px solid var(--border)"><td>ربح المبيعات لحالها <span style="font-size:11px;color:var(--text2)">(إيراد - تكلفة)</span></td><td style="font-weight:700;color:${p.salesProfit>=0?'var(--success)':'var(--danger)'}">${finValUSD(p.salesProfit,'profit')}</td></tr>
          <tr><td>ربح الأعمال لحالها <span style="font-size:11px;color:var(--text2)">(إيراد - أجور - مصاريف)</span></td><td style="font-weight:700;color:${p.maintProfit>=0?'var(--success)':'var(--danger)'}">${finValUSD(p.maintProfit,'profit')}</td></tr>
          <tr><td>العمولات على كل فاتورة/عمل لحاله ($)</td><td style="font-weight:700;color:var(--gold-dark)">${finValUSD(p.referralCost,'profit')}</td></tr>
          ${p.projectCommission>0?`<tr><td>عمولة المشروع بالكامل ($)${rec&&rec.projectCommissionReferrer?` <span style="font-size:11px;color:var(--text2)">(${esc(rec.projectCommissionReferrer)})</span>`:''} <span style="font-size:10px;color:${rec&&rec.projectCommissionPaid?'var(--success)':'var(--danger)'}">${rec&&rec.projectCommissionPaid?'مدفوعة':'معلّقة'}</span></td><td style="font-weight:700;color:var(--gold-dark)">${finValUSD(p.projectCommission,'profit')}</td></tr>`:''}
          <tr style="border-top:1px solid var(--border)"><td style="font-weight:700">صافي ربح المشروع الكلي <span style="font-size:11px;color:var(--text2);font-weight:400">(شامل مصاريف السيارات وكل العمولات)</span></td><td style="font-weight:800;color:${p.profit>=0?'var(--success)':'var(--danger)'}">${finValUSD(p.profit,'profit')}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="card" style="margin-bottom:18px">
    ${(()=>{const ps=db.sales.filter(s=>(s.projectName||'')===name);if(!ps.length)return '';const rows=dashDeptRows(ps),ks=DEPT_ALL_KEYS.filter(k=>rows[k].count>0);if(!ks.length)return '';return `<div class="section-title">مبيعات المشروع حسب القسم <span style="font-weight:400;color:var(--text2);font-size:11px">(بالدولار)</span></div><div style="overflow-x:auto;margin-bottom:16px"><table><thead><tr><th>القسم</th><th>الصافي</th><th>التكلفة</th><th>الربح</th></tr></thead><tbody>${ks.map(k=>`<tr><td>${deptBadgeHTML(k)}</td><td>${finValUSD(rows[k].net,'total')}</td><td style="color:var(--danger)">${finValUSD(rows[k].cost,'total')}</td><td style="color:var(--accent);font-weight:700">${finValUSD(rows[k].profit,'profit')}</td></tr>`).join('')}</tbody></table></div>`;})()}
    <div class="section-title">فواتير المبيع على هذا المشروع</div>
    ${!p.sales.length?`<div class="muted" style="padding:10px">لا يوجد مبيعات مربوطة.</div>`:`
    <table><thead><tr><th>العميل</th><th>التاريخ</th><th>الإجمالي</th><th>المسدد</th><th>الخصم</th><th>المتبقي</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>
      ${p.sales.map(s=>`<tr><td style="font-weight:600">${esc(getClientName(s.clientId)||s.clientNameFree||'—')}</td><td>${fmtDate(s.date)}</td><td>${fmt(s.totalPrice)} ${curLabel(s.currency)}</td><td style="color:#059669">${fmt(s.paidAmount||0)} ${curLabel(s.currency)}</td><td style="color:var(--gold-dark)">${saleDiscountTotal(s)>0?fmt(saleDiscountTotal(s))+' '+curLabel(s.currency):'—'}</td><td style="color:var(--danger);font-weight:700">${fmt(saleRemaining(s))} ${curLabel(s.currency)}</td><td>${saleStatusBadge(s)}</td><td style="white-space:nowrap"><button class="btn btn-sm" onclick="viewSaleItems('${s.id}')" title="عرض التفاصيل"><i class="ti ti-eye"></i></button> ${saleRemaining(s)>0?`<button class="btn btn-sm btn-primary" onclick="openSalePaymentModal('${s.id}')" title="تسديد دفعة"><i class="ti ti-cash"></i></button>`:''} ${(()=>{const cl=db.clients.find(c=>c.id===s.clientId);return cl&&cl.referrerName?`<button class="btn btn-sm" style="color:var(--gold-dark)" onclick="openEditCommissionModal('sales','${s.id}')" title="تعديل العمولة"><i class="ti ti-percentage"></i></button>`:'';})()}</td></tr>`).join('')}
    </tbody></table>`}
  </div>
  <div class="card" style="margin-bottom:18px">
    <div class="section-title">أعمال الصيانة على هذا المشروع</div>
    ${!p.maints.length?`<div class="muted" style="padding:10px">لا يوجد أعمال مربوطة.</div>`:`
    <table><thead><tr><th>العميل</th><th>الإجمالي</th><th>المسدد</th><th>الخصم</th><th>المتبقي</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>
      ${p.maints.map(m=>`<tr><td style="font-weight:600">${esc(getClientName(m.clientId)||m.clientNameFree||'—')}${m.branch?' / '+esc(m.branch):''}</td><td>${fmt(getMaintenanceIncome(m))} ${curLabel(m.currency)}</td><td style="color:#059669">${fmt(m.paidAmount||0)} ${curLabel(m.currency)}</td><td style="color:var(--gold-dark)">${maintDiscountTotal(m)>0?fmt(maintDiscountTotal(m))+' '+curLabel(m.currency):'—'}</td><td style="color:var(--danger);font-weight:700">${fmt(maintRemaining(m))} ${curLabel(m.currency)}</td><td><select class="form-control" style="width:auto;font-size:11px" onchange="setMaintStatusQuick('${m.id}',this.value)"><option value="جارية" ${m.status==='جارية'||!m.status?'selected':''}>جارية</option><option value="مكتملة" ${m.status==='مكتملة'?'selected':''}>مكتملة (إنهاء)</option><option value="ملغاة" ${m.status==='ملغاة'?'selected':''}>ملغاة</option></select></td><td style="white-space:nowrap"><button class="btn btn-sm" onclick="openMaintenanceModal('${m.id}')" title="عرض/تعديل"><i class="ti ti-eye"></i></button> ${maintRemaining(m)>0?`<button class="btn btn-sm btn-primary" onclick="openMaintPaymentModal('${m.id}')" title="تسديد دفعة"><i class="ti ti-cash"></i></button>`:''} ${(()=>{const cl=db.clients.find(c=>c.id===m.clientId);return cl&&cl.referrerName?`<button class="btn btn-sm" style="color:var(--gold-dark)" onclick="openEditCommissionModal('maintenance','${m.id}')" title="تعديل العمولة"><i class="ti ti-percentage"></i></button>`:'';})()}</td></tr>`).join('')}
    </tbody></table>`}
  </div>
  <div class="card">
    <div class="section-title">مصاريف السيارات على هذا المشروع</div>
    ${!p.carExpItems.length?`<div class="muted" style="padding:10px">لا يوجد مصاريف سيارات مربوطة.</div>`:`
    <table><thead><tr><th>السيارة</th><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>ملاحظة</th></tr></thead><tbody>
      ${p.carExpItems.slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).map(e=>`<tr><td style="font-weight:600">${esc(e.carName)}</td><td>${fmtDate(e.date)}</td><td>${esc(e.type||'')}</td><td>${finVal(e.amount,'total')} ${curLabel(e.currency||'SYP')}</td><td>${esc(e.note||'')}</td></tr>`).join('')}
    </tbody></table>`}
  </div>`;
}

function printProjectStatement(name,withPrices){
  if(withPrices===undefined)withPrices=true;
  const rec=(db.projects||[]).find(x=>x.name===name);
  // متل ما بصير بالمبيعات والأعمال: قبل ما نطبع، منعطيك فرصة تضيف/تعدّل ملاحظة تظهر أسفل الفاتورة.
  // منعبّي الملاحظة الحالية للمشروع (إذا موجودة) كنقطة بداية.
  showModal(`
    <div class="modal-title">ملاحظات قبل الطباعة</div>
    <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px">تظهر أسفل الفاتورة المطبوعة.</div>
    <textarea class="form-control" id="proj-print-notes" rows="3" placeholder="كل سطر = ملاحظة، وبتترقم تلقائياً بالطباعة">${esc(rec?rec.notes||'':'')}</textarea>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick='(function(){const v=document.getElementById("proj-print-notes").value;${rec?`saveProjectNotes(${esc(JSON.stringify(rec.id))},v);`:''}closeModal();renderProjectStatement(${esc(JSON.stringify(name))},${withPrices},v);})()'>🖨️ متابعة للطباعة</button>
    </div>
  `);
}

// شريط أزرار طباعة كشف حساب المشروع مع خيار تبديل عملة عرض الإجماليات (دولار/سوري) — نفس فكرة
// الخيار الموجود بفواتير المبيع والأعمال، وبنفس سعر الصرف الحالي المحفوظ بالإعدادات
// ملاحظة: منخزّن اسم المشروع/الملاحظات بمتغيّر عام بدل ما ندمجهن جوا onchange مباشرة، حتى ما تنكسر
// السمة لو اسم المشروع أو الملاحظة فيها علامات اقتباس
function printActionsBarProjectStatement(name,withPrices,printNotes,curSel){
  window._projStmtCtx={name,withPrices:!!withPrices,printNotes:printNotes||''};
  return `<div class="print-actions-bar"><!--LANGSEL-->
    <span style="display:inline-flex;align-items:center;gap:6px;margin-inline-end:8px;font-size:12px;color:#374151">
      <i class="ti ti-currency-dollar"></i> عرض الإجماليات بعملة:
      <select onchange="switchProjectStatementCurrency(this.value)" style="padding:4px 8px;border-radius:6px;border:1px solid #d1d5db;font-size:12px">
        <option value="SYP" ${curSel==='SYP'?'selected':''}>ل.س (سوري)</option>
        <option value="USD" ${curSel==='USD'?'selected':''}>$ (دولار)</option>
      </select>
    </span>
    <button onclick="doPrint()" style="background:#334155;color:white;border:none;border-radius:8px;padding:10px 22px;font-size:14px;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:6px">🖨️ طباعة</button>
    <button onclick="doSavePDF(this)" style="background:#2563eb;color:white;border:none;border-radius:8px;padding:10px 22px;font-size:14px;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:6px">📄 حفظ PDF</button>
    <button onclick="closePrintArea()" style="background:#f3f4f6;color:#374151;border:1px solid #ccc;border-radius:8px;padding:10px 22px;font-size:14px;cursor:pointer;font-weight:600">✕ إغلاق</button>
  </div>`;
}
function switchProjectStatementCurrency(cur){
  const ctx=window._projStmtCtx;
  if(!ctx)return;
  renderProjectStatement(ctx.name,ctx.withPrices,ctx.printNotes,cur);
}

function renderProjectStatement(name,withPrices,printNotes,displayCurrency){
  const p=projectStats(name);
  if(!p.sales.length&&!p.maints.length){alert('لا يوجد فواتير مبيع أو أعمال مسجّلة على هذا المشروع');return;}

  const distinctCurrencies=[...new Set([...p.sales.map(s=>s.currency||'SYP'),...p.maints.map(m=>m.currency||'SYP')])];
  if(distinctCurrencies.length>1){
    alert('⚠️ لا يمكن إصدار كشف حساب موحّد: سجلات هذا المشروع (مبيعات/أعمال) مسجّلة بعملات مختلفة ('+distinctCurrencies.map(c=>curLabel(c)).join(' و ')+'). يمكنك مراجعة كل قسم لحاله من صفحة المشروع.');
    return;
  }
  const cur=distinctCurrencies[0]||'SYP';
  // خيار عرض إجماليات كشف الحساب بعملة مختلفة عن عملة تسجيل فواتير المشروع (بسعر الصرف الحالي)
  // بدون أي تأثير على السجلات نفسها ولا على تفصيل بنود كل فاتورة — التحويل للإجماليات فقط
  const dispCur=(displayCurrency==='USD'||displayCurrency==='SYP')?displayCurrency:cur;
  const showConverted=dispCur!==cur;
  const conv=amt=>showConverted?convertCurrency(amt,cur,dispCur):(+amt||0);
  const curTag=c=>` <span style="font-size:0.75em;opacity:.75">${curLabel(c)}</span>`;

  // بدل ما ندمج المبيعات والأعمال بجدول واحد (يلي بيبين بس إجمالي مدموج بدون تفصيل)،
  // منبني قسمين منفصلين: قسم تفصيلي لكل فاتورة مبيع ببنودها، وقسم تفصيلي لكل فاتورة عمل ببنودها،
  // وفوقهن ملخّص شامل فيه: إجمالي المبيعات + إجمالي الأعمال + الإجمالي الكلي كل واحد لحاله.
  const salesSorted=p.sales.slice().sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
  const maintsSorted=p.maints.slice().sort((a,b)=>new Date(a.startDate||0)-new Date(b.startDate||0));

  const salesTotal=salesSorted.reduce((s,x)=>s+(+x.totalPrice||0),0);
  const salesPaid=salesSorted.reduce((s,x)=>s+Math.min(+x.paidAmount||0,+x.totalPrice||0),0);
  const maintsTotal=maintsSorted.reduce((s,m)=>s+(getMaintenanceTotal(m)-getMaintenanceAdvances(m)),0);
  const maintsPaid=maintsSorted.reduce((s,m)=>s+Math.min(+m.paidAmount||0,getMaintenanceTotal(m)-getMaintenanceAdvances(m)),0);
  const grandTotal=salesTotal+maintsTotal;
  const grandPaid=salesPaid+maintsPaid;
  const remaining=grandTotal-grandPaid;

  const co=db.company||{};
  const todayStr=fmtDate(new Date());
  const clientNames=[...new Set([...salesSorted,...maintsSorted].map(r=>r.clientId?getClientName(r.clientId):(r.clientNameFree||'')).filter(Boolean))];
  setPrintFile('project',name,'',!withPrices);

  // جدول تفصيلي لبنود فاتورة مبيع واحدة
  function saleItemsTable(s){
    const itemRows=(s.items||[]).map(it=>{
      const qty=+it.qty||1,price=+it.salePrice||0;
      return `<tr>
        <td>${esc(it.type||'—')}${it.modelNumber?' — Part Number: '+esc(it.modelNumber):''}${it.note?' — '+esc(it.note):''}</td>
        <td style="text-align:center">${qty}</td>
        ${withPrices?`<td style="text-align:right">${fmt(price)}</td><td style="text-align:right;font-weight:700">${fmt(price*qty)}</td>`:''}
      </tr>`;
    }).join('');
    return `<tr style="background:#f8fafc"><td colspan="${withPrices?4:2}" style="padding:6px 6px;font-weight:700;color:#334155">
      🧾 فاتورة مبيع ${s.invoiceNo?'#'+esc(s.invoiceNo):''} — ${fmtDate(s.date)} — ${esc(s.clientId?getClientName(s.clientId):(s.clientNameFree||'—'))}
    </td></tr>${itemRows||`<tr><td colspan="${withPrices?4:2}" style="text-align:center;color:#9ca3af">لا يوجد بنود</td></tr>`}
    ${withPrices?`<tr><td colspan="3" style="text-align:right;font-weight:700;font-size:9px;color:#475569">إجمالي الفاتورة</td><td style="text-align:right;font-weight:900;color:#334155">${fmt(+s.totalPrice||0)}</td></tr>`:''}`;
  }
  // جدول تفصيلي لبنود فاتورة عمل واحدة
  function maintItemsTable(m){
    const itemRows=(m.workItems||[]).map(it=>{
      const qty=+it.qty||1,price=+it.price||0;
      return `<tr>
        <td>${esc(it.type||'—')}${it.desc?' — '+esc(it.desc):''}</td>
        <td style="text-align:center">${qty}</td>
        ${withPrices?`<td style="text-align:right">${fmt(price)}</td><td style="text-align:right;font-weight:700">${fmt(price*qty)}</td>`:''}
      </tr>`;
    }).join('');
    const mTotal=getMaintenanceTotal(m)-getMaintenanceAdvances(m);
    return `<tr style="background:#f8fafc"><td colspan="${withPrices?4:2}" style="padding:6px 6px;font-weight:700;color:#334155">
      🛠️ فاتورة عمل ${m.invoiceNo?'#'+esc(m.invoiceNo):''} — ${fmtDate(m.startDate)} — ${esc(m.clientId?getClientName(m.clientId):(m.clientNameFree||'—'))}
    </td></tr>${itemRows||`<tr><td colspan="${withPrices?4:2}" style="text-align:center;color:#9ca3af">لا يوجد بنود</td></tr>`}
    ${withPrices?`<tr><td colspan="3" style="text-align:right;font-weight:700;font-size:9px;color:#475569">إجمالي الفاتورة (بعد خصم الدفعات المقدَّمة إن وجدت)</td><td style="text-align:right;font-weight:900;color:#334155">${fmt(mTotal)}</td></tr>`:''}`;
  }

  const salesSectionRows=salesSorted.map(saleItemsTable).join('');
  const maintSectionRows=maintsSorted.map(maintItemsTable).join('');

  const html=`
  <div class="print-doc">
    <div class="print-header">
      ${getCompanyHeader()}
      <div style="text-align:left; flex-shrink:0;">
        <div class="print-doc-type">${withPrices?'كشف حساب شامل ومفصّل — المشروع':'وصف أعمال المشروع'}</div>
        <div class="print-doc-meta"><b>التاريخ:</b> <b style="color:#1a1a2e">${todayStr}</b></div>
      </div>
    </div>
    <div class="print-to-section">
      <div class="print-to-box">
        <label>المشروع</label>
        <div class="val">${esc(name)}</div>
        ${clientNames.length?`<div class="val-sub" style="margin-top:4px">العميل: ${esc(clientNames.join('، '))}</div>`:''}
      </div>
      <div class="print-to-box" style="${withPrices?(remaining>0?'background:#ffffff; border-color:#FCA5A5;':'background:#ffffff; border-color:#86EFAC;'):''}">
        ${withPrices?`<label style="color:${remaining>0?'#B91C1C':'#166534'};">الصافي المتبقي</label>
        <div style="font-size:15px; font-weight:900; color:${remaining>0?'#991B1B':'#166534'}; line-height:1.1;">${fmt(conv(remaining))}${curTag(dispCur)}</div>
        <div style="font-size:7.5px; color:${remaining>0?'#B45354':'#3F7A56'}; margin-top:1px;">${salesSorted.length} فاتورة مبيع + ${maintsSorted.length} فاتورة عمل</div>`:
        `<label>معلومات المستند</label><div class="val-sub" style="line-height:1.9;"><b>عدد السجلات:</b> ${salesSorted.length+maintsSorted.length}</div>`}
      </div>
    </div>
    ${withPrices?`
    <div style="display:flex;gap:8px;margin-bottom:9px;flex-wrap:wrap">
      <div style="flex:1;min-width:120px;background:#ffffff;border-radius:8px;padding:8px 10px;text-align:center;border:1px solid #E2E8F0">
        <div style="font-size:8px;color:#64748b;font-weight:700">إجمالي المبيعات</div>
        <div style="font-size:13px;font-weight:900;color:#334155">${fmt(conv(salesTotal))}${curTag(dispCur)}</div>
      </div>
      <div style="flex:1;min-width:120px;background:#ffffff;border-radius:8px;padding:8px 10px;text-align:center;border:1px solid #E2E8F0">
        <div style="font-size:8px;color:#64748b;font-weight:700">إجمالي الأعمال</div>
        <div style="font-size:13px;font-weight:900;color:#334155">${fmt(conv(maintsTotal))}${curTag(dispCur)}</div>
      </div>
      <div style="flex:1;min-width:120px;background:#ffffff;border-radius:8px;padding:8px 10px;text-align:center;border:1px solid #93C5FD">
        <div style="font-size:8px;color:#1d4ed8;font-weight:700">الإجمالي الشامل (مبيع+أعمال)</div>
        <div style="font-size:13px;font-weight:900;color:#1e3a8a">${fmt(conv(grandTotal))}${curTag(dispCur)}</div>
      </div>
      <div style="flex:1;min-width:120px;background:#ffffff;border-radius:8px;padding:8px 10px;text-align:center;border:1px solid #86EFAC">
        <div style="font-size:8px;color:#166534;font-weight:700">المسدد</div>
        <div style="font-size:13px;font-weight:900;color:#166534">${fmt(conv(grandPaid))}${curTag(dispCur)}</div>
      </div>
    </div>`:''}
    ${salesSorted.length?`
    <div style="font-weight:700;font-size:10px;color:#1e293b;margin:8px 0 4px;padding-bottom:3px;border-bottom:2px solid #e2e8f0">📦 تفصيل المبيعات (${salesSorted.length})</div>
    <table class="print-table" style="table-layout:fixed; width:100%;margin-bottom:10px">
      <thead><tr>
        <th>الصنف</th><th style="width:62px;white-space:nowrap">الكمية</th>
        ${withPrices?'<th style="width:60px;text-align:right">السعر</th><th style="width:70px;text-align:right">الإجمالي</th>':''}
      </tr></thead>
      <tbody>${salesSectionRows}</tbody>
      ${withPrices?`<tfoot><tr style="background:#f8f9fa;border-top:1.5px solid #e0e0e0">
        <td colspan="3" style="font-weight:700;font-size:9px;text-align:right;padding:5px 6px">إجمالي قسم المبيعات</td>
        <td style="font-weight:900;font-size:11px;color:#334155;text-align:right;padding:5px 6px">${fmt(conv(salesTotal))}${curTag(dispCur)}</td>
      </tr></tfoot>`:''}
    </table>`:''}
    ${maintsSorted.length?`
    <div style="font-weight:700;font-size:10px;color:#1e293b;margin:8px 0 4px;padding-bottom:3px;border-bottom:2px solid #e2e8f0">🛠️ تفصيل الأعمال (${maintsSorted.length})</div>
    <table class="print-table" style="table-layout:fixed; width:100%;margin-bottom:10px">
      <thead><tr>
        <th>الصنف</th><th style="width:62px;white-space:nowrap">الكمية</th>
        ${withPrices?'<th style="width:60px;text-align:right">السعر</th><th style="width:70px;text-align:right">الإجمالي</th>':''}
      </tr></thead>
      <tbody>${maintSectionRows}</tbody>
      ${withPrices?`<tfoot><tr style="background:#f8f9fa;border-top:1.5px solid #e0e0e0">
        <td colspan="3" style="font-weight:700;font-size:9px;text-align:right;padding:5px 6px">إجمالي قسم الأعمال</td>
        <td style="font-weight:900;font-size:11px;color:#334155;text-align:right;padding:5px 6px">${fmt(conv(maintsTotal))}${curTag(dispCur)}</td>
      </tr></tfoot>`:''}
    </table>`:''}
    ${withPrices?`
    <table class="print-table" style="table-layout:fixed;width:100%">
      <tbody>
        <tr style="background:#ffffff;border-top:2px solid #93C5FD">
          <td style="font-weight:800;font-size:10px;text-align:right;padding:6px 6px;color:#1e3a8a">الإجمالي الكلي الشامل (مبيعات + أعمال)</td>
          <td style="font-weight:900;font-size:12px;color:#1e3a8a;text-align:right;padding:6px 6px;width:100px">${fmt(conv(grandTotal))}${curTag(dispCur)}</td>
        </tr>
        <tr style="background:#ffffff;border-top:1px solid #86EFAC">
          <td style="font-weight:700;font-size:9px;text-align:right;padding:5px 6px;color:#166534">المسدد</td>
          <td style="font-weight:900;font-size:11px;color:#166534;text-align:right;padding:5px 6px">${fmt(conv(grandPaid))}${curTag(dispCur)}</td>
        </tr>
        <tr style="background:#ffffff;border-top:1px solid #FCA5A5">
          <td style="font-weight:700;font-size:9px;text-align:right;padding:5px 6px;color:#991b1b">الصافي المتبقي</td>
          <td style="font-weight:900;font-size:11px;color:#dc2626;text-align:right;padding:5px 6px">${fmt(conv(remaining))}${curTag(dispCur)}</td>
        </tr>
      </tbody>
    </table>`:''}
    ${printNotes?`<div class="print-note-box"><b style="color:#1a1a2e;">📝 ملاحظات:</b><br>${formatNotesHTML(printNotes)}</div>`:''}
    ${co.printNote?`<div style="text-align:center; padding:5px; background:#fffaf0; border-radius:5px; font-weight:600; font-size:9px; color:#334155; margin-bottom:7px;margin-top:10px">${esc(co.printNote)}</div>`:''}
    <div class="print-sign-row">
      <div class="print-sign-box"><div style="height:20px;"></div><div style="font-weight:700;">توقيع العميل</div><div style="font-size:7px; color:#9ca3af; margin-top:1px;">التاريخ: ___________</div></div>
      <div class="print-sign-box"><div style="height:20px;"></div><div style="font-weight:700;">${esc(getCompanySignatory())}</div><div style="font-size:7px; color:#9ca3af; margin-top:1px;">التاريخ: ___________</div></div>
    </div>
    <div class="print-footer">
      ${companyFooterPhonesHTML()}
      ${co.email?`<div>${esc(co.email)}</div>`:''}
      <div>جميع الحقوق محفوظة © ${new Date().getFullYear()} ${esc(co.name||'Security Mask')}</div>
    </div>
  </div>
  ${withPrices?printActionsBarProjectStatement(name,withPrices,printNotes,dispCur):`<div class="print-actions-bar"><!--LANGSEL-->
    <button onclick="doPrint()" style="background:#334155;color:white;border:none;border-radius:8px;padding:10px 22px;font-size:14px;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:6px">🖨️ طباعة</button>
    <button onclick="doSavePDF(this)" style="background:#2563eb;color:white;border:none;border-radius:8px;padding:10px 22px;font-size:14px;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:6px">📄 حفظ PDF</button>
    <button onclick="closePrintArea()" style="background:#f3f4f6;color:#374151;border:1px solid #ccc;border-radius:8px;padding:10px 22px;font-size:14px;cursor:pointer;font-weight:600">✕ إغلاق</button>
  </div>`}`;
  showPrintDoc(html);
}

function renderTopReferrersBoard(){
  const map={};
  db.clients.forEach(c=>{
    if(!c.referrerName)return;
    if(!map[c.referrerName])map[c.referrerName]={name:c.referrerName,clients:0,revenue:0,paid:0,unpaid:0};
    map[c.referrerName].clients++;
    // موحّد بالدولار (toUSD) لأن عملاء الموصي الواحد ممكن يكون عندهم فواتير بعملات مختلفة
    const salesRev=db.sales.filter(s=>s.clientId===c.id).reduce((s,x)=>s+toUSD(saleRecognizedRevenue(x)-saleRecognizedCost(x),x.currency),0);
    const maintRev=db.maintenance.filter(m=>m.clientId===c.id).reduce((s,m)=>s+toUSD(maintRecognizedIncome(m)-maintRecognizedWages(m)-maintRecognizedExpenses(m),m.currency),0);
    map[c.referrerName].revenue+=salesRev+maintRev;
    db.sales.filter(s=>s.clientId===c.id).forEach(s=>{
      const com=toUSD(saleReferralCommission(s),s.currency);
      if(com>0)map[c.referrerName][s.commissionPaid?'paid':'unpaid']+=com;
    });
    db.maintenance.filter(m=>m.clientId===c.id).forEach(m=>{
      const com=toUSD(maintReferralCommission(m),m.currency);
      if(com>0)map[c.referrerName][m.commissionPaid?'paid':'unpaid']+=com;
    });
  });
  const rows=Object.values(map).sort((a,b)=>b.revenue-a.revenue);
  if(!rows.length)return '';
  return `<div class="card" style="margin-top:18px">
    <div class="section-title">لوحة أفضل الموصين ($) <span style="font-size:11px;color:var(--text2);font-weight:400">(من أرباح العملاء)</span></div>
    <table>
      <thead><tr><th>الموصي</th><th>عدد العملاء</th><th>إجمالي الربح المحقق من عملائه ($)</th><th>عمولات مدفوعة ($)</th><th>عمولات معلقة ($)</th></tr></thead>
      <tbody>
        ${rows.map(r=>`<tr>
          <td style="font-weight:700">${esc(r.name)}</td>
          <td style="text-align:center">${r.clients}</td>
          <td style="color:var(--accent);font-weight:700">${finValUSD(r.revenue,'profit')}</td>
          <td style="color:var(--success);font-weight:700">${finValUSD(r.paid,'profit')}</td>
          <td style="color:${r.unpaid>0?'var(--danger)':'var(--text2)'};font-weight:700">${finValUSD(r.unpaid,'profit')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}
