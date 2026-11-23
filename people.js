/* people.js — يتحمّل عند فتح: العمال / الموردون */
function exportWorkersSummaryExcel(){
  if(!requirePerm('names'))return;
  const showSalaries=canViewWorkerSalaries();
  const headers=['العامل','إجمالي أيام العمل',...(showSalaries?['مستحق غير محسوب ($)','إجمالي تم صرفه ($)']:[]),'آخر تاريخ عمل'];
  const rows=db.workers.map(w=>{
    const allP=db.workerPayments.filter(p=>p.workerId===w.id);
    const unpaidP=allP.filter(p=>!p.paid).reduce((s,p)=>s+toUSD(+p.amount||0,p.currency),0);
    const paidP=allP.filter(p=>p.paid).reduce((s,p)=>s+toUSD(+p.amount||0,p.currency),0);
    const unpaidW=db.maintenance.reduce((s,m)=>{const we=m.workers?m.workers.filter(mw=>mw.workerId===w.id&&!mw.paid):[];return s+we.reduce((a,mw)=>a+toUSD(+mw.wage||0,mw.currency||m.workersCurrency||m.currency),0);},0);
    const paidW=db.maintenance.reduce((s,m)=>{const we=m.workers?m.workers.filter(mw=>mw.workerId===w.id&&mw.paid):[];return s+we.reduce((a,mw)=>a+toUSD(+mw.wage||0,mw.currency||m.workersCurrency||m.currency),0);},0);
    // مهم: لازم نطرح رصيد/فائض العامل (getWorkerCreditUSD) قبل التصدير، تماماً متل ما بصفحة
    // ملخص العمال بالشاشة (renderWorkerSummary) — وإلا رقم إكسل بيطلع أكبر من الحقيقة.
    const creditW=getWorkerCreditUSD(w.id);
    const netUnpaid=Math.max(0,unpaidP+unpaidW-creditW);
    const days=db.maintenance.reduce((s,m)=>{const we=m.workers?m.workers.filter(mw=>mw.workerId===w.id&&!mw.wageOnly):[];return s+we.reduce((a,mw)=>a+(+mw.days||1),0);},0);
    const lastM=db.maintenance.filter(m=>m.workers&&m.workers.some(mw=>mw.workerId===w.id&&!mw.wageOnly)).sort((a,b)=>new Date(b.startDate||0)-new Date(a.startDate||0))[0];
    return [w.name,days,...(showSalaries?[netUnpaid,paidP+paidW]:[]),lastM?lastM.startDate||'':''];
  });
  exportRowsToExcel('ملخص_العمال','ملخص العمال',headers,rows);
}

function exportWorkersPaymentsExcel(){
  if(!requirePerm('names'))return;
  if(!canViewWorkerSalaries()){alert('لا تملك صلاحية رؤية رواتب العمال.');return;}
  const headers=['العامل','النوع','المشروع','المبلغ','العملة','التاريخ','الحالة','تاريخ التسديد','ملاحظة'];
  const rows=db.workerPayments.slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).map(p=>[
    getWorkerName(p.workerId),p.type==='advance'?'سلفة':'دفعة',p.projectName||'—',p.amount||0,curLabel(p.currency||'SYP'),p.date||'',p.paid?'مدفوع':'معلق',p.paidDate||'',p.note||''
  ]);
  exportRowsToExcel('دفعات_العمال','دفعات العمال',headers,rows);
}

function exportWorkersWorklistExcel(){
  if(!requirePerm('names'))return;
  const wListFilter=window._wlF||'';
  const showSalaries=canViewWorkerSalaries();
  const rows=[];
  db.maintenance.forEach(m=>{
    if(m.workers&&m.workers.length){
      m.workers.forEach(w=>{
        if(wListFilter&&w.workerId!==wListFilter)return;
        rows.push([maskWorkerName(w.workerName||getWorkerName(w.workerId)),getClientName(m.clientId),m.branch||'',(m.workTypes||[]).join('، '),m.workDesc||'',w.date||'',w.days||1,...(showSalaries?[w.wage||0,curLabel(w.currency||m.workersCurrency||m.currency||'SYP')]:[]),w.paid?'تم الحساب':'لم يُحسب',w.paidDate||'']);
      });
    }
  });
  rows.sort((a,b)=>new Date(b[5]||0)-new Date(a[5]||0));
  const headers=['العامل','العميل','الفرع','نوع العمل','وصف العمل','التاريخ','الأيام',...(showSalaries?['الأجر','العملة']:[]),'الحالة','تاريخ التسديد'];
  exportRowsToExcel('سجل_أيام_الورش','سجل أيام الورش',headers,rows);
}

function exportWorkersExcel(){
  const tab=window._wT||'summary';
  if(tab==='payments')exportWorkersPaymentsExcel();
  else if(tab==='worklist')exportWorkersWorklistExcel();
  else exportWorkersSummaryExcel();
}

function renderWorkers(el,acts){
  acts.innerHTML=`<button class="btn btn-primary" onclick="openWorkerPaymentModal()"><i class="ti ti-plus"></i> إضافة دفعة</button><button class="btn" style="color:var(--salary);border-color:var(--gold-light)" onclick="openWorkerPaymentModal('advance')"><i class="ti ti-cash-banknote"></i> إضافة سلفة</button><button class="btn" onclick="exportWorkersExcel()"><i class="ti ti-file-spreadsheet"></i> تصدير Excel</button>`;
  el.innerHTML=`
  <div class="tab-bar">
    <div class="tab ${!window._wT||window._wT==='summary'?'active':''}" onclick="window._wT='summary';renderWorkers(document.getElementById('main-content'),document.getElementById('topbar-actions'))">ملخص العمال</div>
    <div class="tab ${window._wT==='payments'?'active':''}" onclick="window._wT='payments';renderWorkers(document.getElementById('main-content'),document.getElementById('topbar-actions'))">سجل الدفعات</div>
    <div class="tab ${window._wT==='worklist'?'active':''}" onclick="window._wT='worklist';renderWorkers(document.getElementById('main-content'),document.getElementById('topbar-actions'))">سجل أيام الورش</div>
    <div class="tab ${window._wT==='incentives'?'active':''}" onclick="window._wT='incentives';renderWorkers(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-award"></i> الأداء والحوافز</div>
    <div class="tab ${window._wT==='payroll'?'active':''}" onclick="window._wT='payroll';renderWorkers(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-calendar-user"></i> الحضور والرواتب</div>
  </div>
  ${(!window._wT||window._wT==='summary')?renderWorkerSummary():window._wT==='payments'?renderWorkerPaymentsList():window._wT==='incentives'?renderWorkerIncentives():window._wT==='payroll'?renderPayrollTab():renderWorkerWorkList()}`;
}

function renderWorkerSummary(){
  // تصفية تلقائية عند فتح الصفحة: أي عامل عنده فائض غير مستهلك بسبب البيانات القديمة
  // (قبل تصحيح شرط التاريخ بـ applyAdvanceSurplusToWorker) بيتصفّى هون تلقائياً، حتى تطابق
  // الأرقام المعروضة الواقع الفعلي دون ما ينتظر المستخدم يسجّل دفعة جديدة ليصير التصحيح.
  let _healed=false;
  db.workers.forEach(w=>{const r=applyAdvanceSurplusToWorker(w.id);if(r.settledCount>0)_healed=true;});
  if(_healed)saveDB(db);
  return `<div class="card"><div style="overflow-x:auto"><table>
    <thead><tr><th>العامل</th><th>إجمالي أيام العمل</th><th>مستحق غير محسوب <span style="font-weight:400;font-size:10px">($)</span></th><th>الفائض <span style="font-weight:400;font-size:10px">($)</span></th><th>إجمالي تم صرفه <span style="font-weight:400;font-size:10px">($)</span></th><th>آخر تاريخ عمل</th><th></th></tr></thead>
    <tbody>
      ${db.workers.map(w=>{
        const allP=db.workerPayments.filter(p=>p.workerId===w.id);
        const unpaidP=allP.filter(p=>!p.paid).reduce((s,p)=>s+toUSD(+p.amount||0,p.currency),0);
        const paidP=allP.filter(p=>p.paid).reduce((s,p)=>s+toUSD(+p.amount||0,p.currency),0);
        const totalAdvances=allP.filter(p=>p.type==='advance').reduce((s,p)=>s+toUSD(+p.amount||0,p.currency),0);
        const unpaidW=db.maintenance.reduce((s,m)=>{const we=m.workers?m.workers.filter(mw=>mw.workerId===w.id&&!mw.paid):[];return s+we.reduce((a,mw)=>a+toUSD(+mw.wage||0,mw.currency||m.workersCurrency||m.currency),0);},0);
        const paidW=db.maintenance.reduce((s,m)=>{const we=m.workers?m.workers.filter(mw=>mw.workerId===w.id&&mw.paid):[];return s+we.reduce((a,mw)=>a+toUSD(+mw.wage||0,mw.currency||m.workersCurrency||m.currency),0);},0);
        const creditW=getWorkerCreditUSD(w.id); // رصيد مدفوع فعلياً بس ما انطبق على سطر أجرة محدد بعد
        const totalUnpaid=Math.max(0,unpaidP+unpaidW-creditW);
        const totalPaid=paidP+paidW;
        const days=db.maintenance.reduce((s,m)=>{const we=m.workers?m.workers.filter(mw=>mw.workerId===w.id&&!mw.wageOnly):[];return s+we.reduce((a,mw)=>a+(+mw.days||1),0);},0);
        const lastM=db.maintenance.filter(m=>m.workers&&m.workers.some(mw=>mw.workerId===w.id&&!mw.wageOnly)).sort((a,b)=>new Date(b.startDate||0)-new Date(a.startDate||0))[0];
        return `<tr>
          <td style="font-weight:700;font-size:14px;cursor:pointer;text-decoration:underline;text-decoration-style:dotted" onclick="showWorkerUnpaidDetails('${w.id}')" title="اضغط لعرض كل تفاصيل العامل">${esc(w.name)}${totalAdvances>0.005?`<div style="font-size:10px;font-weight:700;color:var(--accent-2)">إجمالي السلف: ${finValUSD(totalAdvances,'salary')}</div>`:''}</td>
          <td style="text-align:center">${days} يوم</td>
          <td style="color:${totalUnpaid?'var(--salary)':'var(--text2)'};font-weight:${totalUnpaid?'700':'400'}">${finValUSD(totalUnpaid,'salary')}</td>
          <td style="color:${creditW>0.005?'var(--info)':'var(--text2)'};font-weight:${creditW>0.005?'700':'400'}">${finValUSD(creditW,'salary')}</td>
          <td style="color:var(--accent);font-weight:700">${finValUSD(totalPaid,'salary')}</td>
          <td style="font-size:12px;color:var(--text2)">${lastM?fmtDate(lastM.startDate):'—'}</td>
          <td class="action-btns">
            <button class="btn btn-sm" onclick="showWorkerUnpaidDetails('${w.id}')"><i class="ti ti-list-details"></i> تفاصيل</button>
            <button class="btn btn-sm" style="color:var(--salary);border-color:var(--gold-light)" onclick="openWorkerPaymentModal('advance','${w.id}')"><i class="ti ti-cash-banknote"></i> سلفة</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table></div></div>`;
}

function showWorkerUnpaidDetails(workerId){
  if(!requirePerm('salary'))return;
  const w=db.workers.find(x=>x.id===workerId);
  if(!w)return;
  // تصفية تلقائية أولاً (نفس سبب الاستدعاء بـ renderWorkerSummary) حتى القائمة تحت
  // ما تعرض أجرة كان المفروض تتغطى من فائض موجود عند العامل فعلياً.
  const _heal=applyAdvanceSurplusToWorker(workerId);
  if(_heal.settledCount>0)saveDB(db);
  // 1) أجور غير محسوبة ضمن الأشغال (كل ورشة على حدة)
  const workshopRows=[];
  db.maintenance.forEach(m=>{
    (m.workers||[]).forEach(mw=>{
      if(mw.workerId===workerId&&!mw.paid){
        workshopRows.push({
          label:(getClientName(m.clientId)||m.clientNameFree||'—')+(m.branch?(' / '+m.branch):''),
          desc:m.workDesc||(m.workTypes||[]).join('، ')||'—',
          date:mw.date||m.startDate||'',
          amountUSD:toUSD(+mw.wage||0,mw.currency||m.workersCurrency||m.currency),
          amountRaw:+mw.wage||0,
          currency:mw.currency||m.workersCurrency||m.currency||'SYP',
          days:mw.days||1
        });
      }
    });
  });
  workshopRows.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  const workshopTotal=workshopRows.reduce((s,r)=>s+r.amountUSD,0);
  // 2) دفعات/سلف مسجلة يدوياً وغير مسددة (مو مرتبطة بورشة محددة)
  const paymentRows=db.workerPayments.filter(p=>p.workerId===workerId&&!p.paid);
  const paymentsTotal=paymentRows.reduce((s,p)=>s+toUSD(+p.amount||0,p.currency),0);
  const creditW=getWorkerCreditUSD(workerId);
  const rawTotal=workshopTotal+paymentsTotal;
  const grandTotal=Math.max(0,rawTotal-creditW);
  // مصادر الفائض (أي دفعة/سلفة مسددة إلها رصيد لسا ما انطبّق على أجرة محدّدة) — نعرضها
  // كبيانات صريحة حتى ما يضيع الفائض بمكان ما بينبان، بدل ما يبقى محسوب بالخلفية بس.
  const creditSources=db.workerPayments.filter(p=>p.workerId===workerId&&!p.isBonus&&p.paid&&p.remainingSurplus>0.005);
  // بطاقة رصيد العامل: رقم واحد واضح، موجب = فائض له عند الشركة (مقبوض أكتر من المستحق)،
  // وسالب = عليه مستحق (الشركة لسا مدينة له). فائض العامل هون شي منفصل تماماً عن "الرواتب
  // المعلقة" بلوحة التحكم — هو رصيد خاص بهاد العامل بس، وبينخصم منو تلقائياً (النقص هو يلي
  // بينزل من الفائض) أول ما تنسجل له أجرة/دفعة جديدة، مش العكس.
  const balanceUSD=creditW-grandTotal;
  // كل الدفعات/السلف المسجلة لهاد العامل — مدفوعة وغير مدفوعة معاً، بكل تفاصيلها وتواريخها
  const allPaymentsFull=db.workerPayments.filter(p=>p.workerId===workerId).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  // كل أيام/أجور الورش لهاد العامل مجمّعة حسب الورشة (مدفوعة وغير مدفوعة) — لعرض "قديش حسابو بكل ورشة"
  const byWorkshop=[];
  db.maintenance.forEach(m=>{
    const mine=(m.workers||[]).filter(mw=>mw.workerId===workerId);
    if(!mine.length)return;
    const wsTotalUSD=mine.reduce((s,mw)=>s+toUSD(+mw.wage||0,mw.currency||m.workersCurrency||m.currency),0);
    const wsPaidUSD=mine.filter(mw=>mw.paid).reduce((s,mw)=>s+toUSD(+mw.wage||0,mw.currency||m.workersCurrency||m.currency),0);
    byWorkshop.push({label:(getClientName(m.clientId)||m.clientNameFree||'—')+(m.branch?(' / '+m.branch):''),date:m.startDate||'',lines:mine,totalUSD:wsTotalUSD,paidUSD:wsPaidUSD});
  });
  byWorkshop.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  showModal(`
    <div class="modal-title">تفاصيل العامل الكاملة — ${esc(w.name)}</div>
    <div style="display:flex;gap:10px;margin-bottom:16px">
      <div style="flex:1;background:var(--bg2);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:11px;color:var(--text2);margin-bottom:4px">رصيد العامل الحالي</div>
        <div style="font-size:20px;font-weight:800;color:${balanceUSD>0.005?'var(--info)':balanceUSD<-0.005?'var(--salary)':'var(--text2)'}">${balanceUSD>0.005?'+ ':balanceUSD<-0.005?'- ':''}${finValUSD(Math.abs(balanceUSD),'salary')}</div>
        <div style="font-size:10px;color:var(--text2);margin-top:2px">${balanceUSD>0.005?'فائض له (مقبوض أكتر من المستحق)':balanceUSD<-0.005?'مستحق عليه (لسا ماخده)':'الحساب متوازن'}</div>
      </div>
    </div>
    <div style="margin-bottom:14px;font-size:13px;color:var(--text2)">
      إجمالي الأجور/الدفعات غير المحسوبة: <b style="color:var(--salary);font-size:15px">${finValUSD(rawTotal,'salary')}</b>
      ${creditW>0.005?`<br>ناقص الرصيد/الفائض المدفوع مسبقاً: <b style="color:var(--accent)">- ${finValUSD(creditW,'salary')}</b>`:''}
      <br>الصافي المستحق فعلياً: <b style="color:var(--salary);font-size:15px">${finValUSD(grandTotal,'salary')}</b>
    </div>
    ${creditW>0.005?`<div class="section-title" style="font-size:13px">رصيد/فائض مدفوع مسبقاً لسا ما اتغطى بأجرة <span class="opt-badge" style="background:var(--accent-light);color:var(--accent-dark);border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700">${creditSources.length}</span></div>
    <div style="overflow-x:auto;margin-bottom:16px">
      <table>
        <thead><tr><th>النوع</th><th>المشروع</th><th>التاريخ</th><th>الفائض المتبقي</th></tr></thead>
        <tbody>
          ${creditSources.map(p=>`<tr>
            <td>${p.type==='advance'?'سلفة':'دفعة'}</td>
            <td style="font-size:12px">${esc(p.projectName||'—')}</td>
            <td style="font-size:12px;color:var(--text2)">${fmtDate(p.date)}</td>
            <td style="font-weight:700;color:var(--accent)">${finValUSD(p.remainingSurplus,'salary')}</td>
          </tr>`).join('')}
          <tr class="summary-row"><td colspan="3">إجمالي الرصيد/الفائض</td><td style="color:var(--accent)">${finValUSD(creditW,'salary')}</td></tr>
        </tbody>
      </table>
      <div style="font-size:11px;color:var(--text2);margin-top:4px">مخصوم من أول أجرة.</div>
    </div>`:''}
    <div class="section-title" style="font-size:13px">حسب الورشة / العمل <span class="opt-badge" style="background:var(--accent-light);color:var(--accent-dark);border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700">${workshopRows.length}</span></div>
    <div style="overflow-x:auto;margin-bottom:16px">
      ${workshopRows.length?`<table>
        <thead><tr><th>العميل / الفرع</th><th>وصف العمل</th><th>التاريخ</th><th>الأيام</th><th>المبلغ المستحق</th></tr></thead>
        <tbody>
          ${workshopRows.map(r=>`<tr>
            <td>${esc(r.label)}</td>
            <td style="font-size:12px">${esc(r.desc)}</td>
            <td style="font-size:12px;color:var(--text2)">${fmtDate(r.date)}</td>
            <td style="text-align:center">${r.days}</td>
            <td style="font-weight:700;color:var(--salary)">${finValUSD(r.amountUSD,'salary')} <span style="font-size:10px;color:var(--text2)">(${fmt(r.amountRaw)} ${curLabel(r.currency)})</span></td>
          </tr>`).join('')}
          <tr class="summary-row"><td colspan="4">إجمالي أجور الورش غير المحسوبة</td><td style="color:var(--salary)">${finValUSD(workshopTotal,'salary')}</td></tr>
        </tbody>
      </table>`:`<div class="empty-state" style="padding:20px"><i class="ti ti-tool"></i><p>لا يوجد أجور ورش غير محسوبة</p></div>`}
    </div>
    <div class="section-title" style="font-size:13px">دفعات/سلف يدوية غير مسددة <span class="opt-badge" style="background:var(--accent-light);color:var(--accent-dark);border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700">${paymentRows.length}</span></div>
    <div style="overflow-x:auto">
      ${paymentRows.length?`<table>
        <thead><tr><th>النوع</th><th>المشروع</th><th>التاريخ</th><th>المبلغ</th></tr></thead>
        <tbody>
          ${paymentRows.map(p=>`<tr>
            <td>${p.type==='advance'?'سلفة':'دفعة'}</td>
            <td style="font-size:12px">${esc(p.projectName||'—')}</td>
            <td style="font-size:12px;color:var(--text2)">${fmtDate(p.date)}</td>
            <td style="font-weight:700;color:var(--salary)">${finValUSD(toUSD(+p.amount||0,p.currency),'salary')} <span style="font-size:10px;color:var(--text2)">(${fmt(p.amount)} ${curLabel(p.currency)})</span></td>
          </tr>`).join('')}
          <tr class="summary-row"><td colspan="3">إجمالي الدفعات اليدوية غير المسددة</td><td style="color:var(--salary)">${finValUSD(paymentsTotal,'salary')}</td></tr>
        </tbody>
      </table>`:`<div class="empty-state" style="padding:20px"><i class="ti ti-cash-banknote"></i><p>لا يوجد دفعات يدوية غير مسددة</p></div>`}
    </div>
    <div class="section-title" style="font-size:13px">كل الدفعات والسلف المسجلة (السجل الكامل) <span class="opt-badge" style="background:var(--accent-light);color:var(--accent-dark);border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700">${allPaymentsFull.length}</span></div>
    <div style="overflow-x:auto;margin-bottom:16px">
      ${allPaymentsFull.length?`<table>
        <thead><tr><th>النوع</th><th>المشروع</th><th>التاريخ</th><th>المبلغ</th><th>الحالة</th><th>تاريخ التسديد</th><th>فائض متبقي منها</th></tr></thead>
        <tbody>
          ${allPaymentsFull.map(p=>`<tr>
            <td>${p.type==='advance'?'سلفة':(p.isBonus?'مكافأة':'دفعة')}</td>
            <td style="font-size:12px">${esc(p.projectName||'—')}</td>
            <td style="font-size:12px;color:var(--text2)">${fmtDate(p.date)}</td>
            <td style="font-weight:700">${finValUSD(toUSD(+p.amount||0,p.currency),'salary')} <span style="font-size:10px;color:var(--text2)">(${fmt(p.amount)} ${curLabel(p.currency)})</span></td>
            <td><span class="badge ${p.paid?'badge-green':'badge-amber'}">${p.paid?'مدفوع':'معلق'}</span></td>
            <td style="font-size:12px;color:var(--text2)">${p.paidDate?fmtDate(p.paidDate):'—'}</td>
            <td style="font-size:12px;color:${p.remainingSurplus>0.005?'var(--accent)':'var(--text3)'}">${p.remainingSurplus>0.005?finValUSD(p.remainingSurplus,'salary'):'—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`:`<div class="empty-state" style="padding:20px"><i class="ti ti-cash"></i><p>لا يوجد أي دفعات أو سلف مسجلة لهذا العامل</p></div>`}
    </div>
    <div class="section-title" style="font-size:13px">حسابه في كل ورشة (كل الأجور، مدفوعة وغير مدفوعة) <span class="opt-badge" style="background:var(--accent-light);color:var(--accent-dark);border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700">${byWorkshop.length}</span></div>
    <div style="overflow-x:auto">
      ${byWorkshop.length?`<table>
        <thead><tr><th>الورشة</th><th>التاريخ</th><th>عدد الأسطر</th><th>إجمالي الأجر</th><th>منها مدفوع</th></tr></thead>
        <tbody>
          ${byWorkshop.map(ws=>`<tr>
            <td>${esc(ws.label)}</td>
            <td style="font-size:12px;color:var(--text2)">${fmtDate(ws.date)}</td>
            <td style="text-align:center">${ws.lines.length}</td>
            <td style="font-weight:700">${finValUSD(ws.totalUSD,'salary')}</td>
            <td style="color:var(--accent);font-weight:700">${finValUSD(ws.paidUSD,'salary')}</td>
          </tr>`).join('')}
        </tbody>
      </table>`:`<div class="empty-state" style="padding:20px"><i class="ti ti-tool"></i><p>لا يوجد ورش مسجلة لهذا العامل</p></div>`}
    </div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إغلاق</button></div>
  `);
}

function renderWorkerPaymentsList(){
  if(!canViewWorkerSalaries())return salaryLockedHTML('دفعات وسلف العمال');
  const wFilter=window._wpW||'';
  const tFilter=window._wpT||'all';
  const sFilter=window._wpS||'all';
  const pFilter=window._wpP||'';
  const projectsInUse=[...new Set(db.workerPayments.map(p=>p.projectName).filter(Boolean))];
  const rows=db.workerPayments.filter(p=>{
    if(wFilter&&p.workerId!==wFilter)return false;
    if(tFilter!=='all'&&p.type!==tFilter)return false;
    if(sFilter!=='all'&&(sFilter==='paid'?!p.paid:!!p.paid))return false;
    if(pFilter&&(p.projectName||'')!==pFilter)return false;
    return true;
  }).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  const filterBar=`<div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border)">
    <div class="form-group">
      <label class="form-label">العامل</label>
      <select class="form-control" style="width:160px" onchange="window._wpW=this.value;window._wpPageSize=50;renderWorkers(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
        <option value="">جميع العمال</option>
        ${db.workers.map(w=>`<option value="${w.id}" ${wFilter===w.id?'selected':''}>${esc(w.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">النوع</label>
      <select class="form-control" style="width:140px" onchange="window._wpT=this.value;window._wpPageSize=50;renderWorkers(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
        <option value="all" ${tFilter==='all'?'selected':''}>الكل</option>
        <option value="advance" ${tFilter==='advance'?'selected':''}>سلفة</option>
        <option value="payment" ${tFilter==='payment'?'selected':''}>دفعة</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">الحالة</label>
      <select class="form-control" style="width:140px" onchange="window._wpS=this.value;window._wpPageSize=50;renderWorkers(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
        <option value="all" ${sFilter==='all'?'selected':''}>الكل</option>
        <option value="paid" ${sFilter==='paid'?'selected':''}>مدفوع</option>
        <option value="pending" ${sFilter==='pending'?'selected':''}>معلق</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">المشروع</label>
      <select class="form-control" style="width:170px" onchange="window._wpP=this.value;window._wpPageSize=50;renderWorkers(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
        <option value="">كل المشاريع</option>
        ${projectsInUse.map(pn=>`<option value="${esc(pn)}" ${pFilter===pn?'selected':''}>${esc(pn)}</option>`).join('')}
      </select>
    </div>
    ${(wFilter||tFilter!=='all'||sFilter!=='all'||pFilter)?`<div class="form-group" style="padding-bottom:6px"><button class="btn btn-sm" onclick="window._wpW='';window._wpT='all';window._wpS='all';window._wpP='';window._wpPageSize=50;renderWorkers(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-filter-off"></i> مسح الفلاتر</button></div>`:''}
    <div style="font-size:12px;color:var(--text2);padding-bottom:6px;margin-right:auto">${rows.length} سجل</div>
  </div>`;
  const wpPageSize=window._wpPageSize||50;
  const wpPageRows=rows.slice(0,wpPageSize);
  return `<div class="card">${filterBar}${rows.length===0?`<div class="empty-state"><i class="ti ti-cash"></i><p>لا يوجد دفعات ${(wFilter||tFilter!=='all'||sFilter!=='all')?'بهذا الفلتر':'مسجلة'}</p></div>`:`
  <table>
    <thead><tr><th>العامل</th><th>النوع</th><th>المشروع</th><th>المبلغ</th><th>التاريخ</th><th>الحالة</th><th>تاريخ التسديد</th><th>ملاحظة</th><th></th></tr></thead>
    <tbody>
      ${wpPageRows.map(p=>`<tr>
        <td style="font-weight:700">${esc(getWorkerName(p.workerId))}</td>
        <td><span class="badge ${p.type==='advance'?'badge-amber':'badge-blue'}">${p.type==='advance'?'سلفة':'دفعة'}</span></td>
        <td style="font-size:12px">${p.projectName?`<span class="badge badge-blue">${esc(p.projectName)}</span>`:'<span style="color:var(--text3)">—</span>'}</td>
        <td style="font-weight:700">${finVal(p.amount,'salary')} <span style="font-size:10px;color:var(--text2)">${curLabel(p.currency||'SYP')}</span>${p.type==='advance'&&p.paid&&p.remainingSurplus>0.01?`<div style="font-size:10px;color:var(--text2);margin-top:2px">فائض متبقي: ${finValUSD(p.remainingSurplus,'salary')}</div>`:''}</td>
        <td>${fmtDate(p.date)}</td>
        <td><span class="badge ${p.paid?'badge-green':'badge-amber'}">${p.paid?'مدفوع':'معلق'}</span></td>
        <td style="font-size:12px;color:var(--text2)">${p.paidDate?fmtDate(p.paidDate):'—'}</td>
        <td style="font-size:12px;color:var(--text2)">${esc(p.note||'—')}</td>
        <td><div class="action-btns">
          ${!p.paid?`<button class="btn btn-sm" style="color:var(--accent);border-color:var(--accent)" onclick="markWorkerPaid('${p.id}')"><i class="ti ti-check"></i> تسديد</button>`:''}
          <button class="btn btn-sm btn-danger" onclick="deleteWorkerPayment('${p.id}')"><i class="ti ti-trash"></i></button>
        </div></td>
      </tr>`).join('')}
    </tbody>
  </table>
  ${rows.length>wpPageSize?`<div style="text-align:center;padding:14px"><button class="btn" onclick="window._wpPageSize=(window._wpPageSize||50)+50;renderWorkers(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-chevron-down"></i> تحميل المزيد (${rows.length-wpPageSize} متبقي)</button></div>`:''}`}</div>`;
}

function renderWorkerWorkList(){
  const wListFilter=window._wlF||'';
  const rows=[];
  db.maintenance.forEach(m=>{
    if(m.workers&&m.workers.length){
      m.workers.forEach(w=>{
        if(wListFilter&&w.workerId!==wListFilter)return;
        rows.push({...w,client:getClientName(m.clientId),branch:m.branch,maintId:m.id,workTypes:m.workTypes||[],workDesc:m.workDesc||''});
      });
    }
  });
  rows.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  const filterBar=`<div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border)">
    <div class="form-group">
      <label class="form-label">تصفية بالعامل</label>
      <select class="form-control" style="width:160px" onchange="window._wlF=this.value;window._wlPageSize=50;renderWorkers(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
        <option value="">جميع العمال</option>
        ${db.workers.map(w=>`<option value="${w.id}" ${wListFilter===w.id?'selected':''}>${esc(w.name)}</option>`).join('')}
      </select>
    </div>
    <div style="font-size:12px;color:var(--text2);padding-bottom:6px">${rows.length} سجل</div>
  </div>`;
  const wlPageSize=window._wlPageSize||50;
  const wlPageRows=rows.slice(0,wlPageSize);
  return `<div class="card">${filterBar}${rows.length===0?`<div class="empty-state"><i class="ti ti-calendar"></i><p>لا يوجد سجل أعمال</p></div>`:`
  <table>
    <thead><tr><th>العامل</th><th>العميل / الفرع</th><th>نوع العمل</th><th style="width:150px;">وصف العمل</th><th>التاريخ</th><th>الأيام</th><th>الأجر</th><th>الحالة</th></tr></thead>
    <tbody>
      ${wlPageRows.map(r=>`<tr>
        <td style="font-weight:700">${esc(maskWorkerName(r.workerName))}${r.wageOnly?'<div class="badge badge-amber" style="font-size:9px;margin-top:3px">تسوية/أجرة فقط</div>':''}</td>
        <td><div style="font-weight:600">${r.client}</div><div style="font-size:11px;color:var(--text2)">${esc(r.branch||'')}</div></td>
        <td style="font-size:12px">${r.workTypes&&r.workTypes.length?r.workTypes.join('، '):'—'}</td>
        <td style="font-size:11px;color:var(--text2);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.workDesc||'')}">${esc(r.workDesc||'—')}</td>
        <td>${fmtDate(r.date)}</td>
        <td style="text-align:center;font-weight:600">${r.days||1}</td>
        <td style="font-weight:700;color:var(--salary)">${finVal(r.wage,'salary')} <span style="font-size:10px;color:var(--text2)">${curLabel(r.currency||'SYP')}</span></td>
        <td>
          <span class="badge ${r.paid?'badge-green':'badge-amber'}">${r.paid?'تم الحساب':'لم يُحسب'}</span>
          ${r.paidDate?`<div style="font-size:10px;color:var(--text2);margin-top:2px">${fmtDate(r.paidDate)}</div>`:''}
        </td>
      </tr>`).join('')}
    </tbody>
  </table>
  ${rows.length>wlPageSize?`<div style="text-align:center;padding:14px"><button class="btn" onclick="window._wlPageSize=(window._wlPageSize||50)+50;renderWorkers(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-chevron-down"></i> تحميل المزيد (${rows.length-wlPageSize} متبقي)</button></div>`:''}`}</div>`;
}

/* تسوية تلقائية FIFO: لما نسجل "دفعة" حقيقية (مو سلفة، ومو مكافأة) ومدفوعة فعلياً،
   منصفّي بيها أقدم أجور ورشات غير محسوبة لنفس العامل، وحدة كاملة تلو الأخرى (الأقدم تاريخاً أولاً)،
   لحد ما يخلص مبلغ الدفعة. ما منقدر نصفّي "جزء" من أجرة ورشة واحدة (البيانات ما بتدعم دفع جزئي
   لسطر أجرة واحد)، فبنوقف عند أول أجرة أكبر من الباقي ونسيبها للمرة الجاية. */
function settleWorkerWorkshopWages(workerId,amountUSD,settleDate){
  let remaining=+amountUSD||0;
  if(remaining<=0)return{settledCount:0,settledUSD:0,remaining:0};
  const entries=[];
  (db.maintenance||[]).forEach(m=>{
    (m.workers||[]).forEach(mw=>{
      if(mw.workerId===workerId&&!mw.paid){
        entries.push({mw,m,date:mw.date||m.startDate||'',amountUSD:toUSD(+mw.wage||0,mw.currency||m.workersCurrency||m.currency)});
      }
    });
  });
  entries.sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
  let settledCount=0,settledUSD=0;
  const settledRefs=[];
  for(const e of entries){
    if(e.amountUSD<=remaining+0.005){
      e.mw.paid=true;
      e.mw.paidDate=settleDate||localToday();
      remaining-=e.amountUSD;
      settledUSD+=e.amountUSD;
      settledCount++;
      settledRefs.push({maintId:e.m.id,workerId:e.mw.workerId,date:e.mw.date||'',wage:+e.mw.wage||0,currency:e.mw.currency||e.m.workersCurrency||e.m.currency||'SYP'});
    }else{
      break; // أول أجرة أكبر من الباقي — منوقف، منسيبها لتسديد لاحق
    }
  }
  return{settledCount,settledUSD,remaining,settledRefs};
}

/* عكس تسوية تلقائية سابقة (لما نحذف دفعة كانت صفّت أجور ورشات) — بيرجّع الأجرة "غير محسوبة" متل ما كانت */
function reverseWorkerWagesSettlement(settledRefs){
  if(!settledRefs||!settledRefs.length)return 0;
  let reversedCount=0;
  settledRefs.forEach(ref=>{
    const m=(db.maintenance||[]).find(x=>x.id===ref.maintId);
    if(!m||!m.workers)return;
    const mw=m.workers.find(w=>w.workerId===ref.workerId&&(w.date||'')===ref.date&&(+w.wage||0)===ref.wage&&(w.currency||m.workersCurrency||m.currency||'SYP')===ref.currency&&w.paid);
    if(mw){mw.paid=false;mw.paidDate='';reversedCount++;}
  });
  return reversedCount;
}


/* استهلاك فائض السلفة: أي "سلفة" مقبوضة وفيها فائض ما انصرف بعد، وأي أجرة ورشة "غير محسوبة" بتاريخ
   لاحق (أو بنفس تاريخ) السلفة، بتتغطى منها تلقائياً — بالترتيب الزمني، الأقدم أولاً — لحد ما يخلص
   الفائض. زي ما بالمثال: سلفة فيها فائض 500، جاتك ورشة أجرتها 400 بتاريخ بعد السلفة → بتنخصم
   وبيضل فائض 100 للمرة الجاية. ما منقدر نغطي "جزء" من أجرة واحدة (البيانات ما بتدعم دفع جزئي لسطر واحد). */
function applyAdvanceSurplusToWorker(workerId){
  // مهم: بتشمل كل دفعة/سلفة "مسددة" وفيها فائض ما انغطى بعد بأجرة ورشة —
  // مو بس السلف (advance)، لأن الدفعة العادية (payment) لما ميبلغها أصغر من
  // أول أجرة غير محسوبة، لازم فائضها يتحفظ كرصيد وينخصم تلقائياً لاحقاً،
  // مثل السلفة تماماً. قبل هذا التعديل كان فائض الدفعة العادية يضيع بدون أثر.
  //
  // ملاحظة مهمة (تصحيح): سابقاً كان الشرط بيمنع تغطية أي أجرة ورشة تاريخها أقدم من
  // تاريخ الدفعة/السلفة صاحبة الفائض (a.date<=e.date). هاد غلط: الفائض هو مبلغ
  // مقبوض فعلياً عند العامل دلوقتي، فلازم يغطي أي أجرة "غير محسوبة" — قديمة كانت
  // أو جديدة — مش بس اللي جات بعد تاريخ الدفعة. شلنا هاد الشرط تماماً، وصرنا نغطي
  // الأقدم أولاً (أجرة) من الأقدم أولاً (فائض)، بغض النظر عن ترتيب التواريخ بين الاثنين.
  const advances=(db.workerPayments||[]).filter(p=>p.workerId===workerId&&!p.isBonus&&p.paid);
  advances.forEach(a=>{if(a.remainingSurplus===undefined)a.remainingSurplus=toUSD(+a.amount||0,a.currency);});
  const liveAdvances=advances.filter(a=>a.remainingSurplus>0.005).sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
  if(!liveAdvances.length)return{settledCount:0,settledUSD:0};
  const entries=[];
  (db.maintenance||[]).forEach(m=>{
    (m.workers||[]).forEach(mw=>{
      if(mw.workerId===workerId&&!mw.paid){
        entries.push({mw,m,date:mw.date||m.startDate||'',amountUSD:toUSD(+mw.wage||0,mw.currency||m.workersCurrency||m.currency)});
      }
    });
  });
  entries.sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
  let settledCount=0,settledUSD=0;
  entries.forEach(e=>{
    const adv=liveAdvances.find(a=>a.remainingSurplus>0.005&&a.remainingSurplus>=e.amountUSD-0.005);
    if(adv){
      e.mw.paid=true;
      e.mw.paidDate=adv.date;
      adv.remainingSurplus-=e.amountUSD;
      if(!adv.settledRefs)adv.settledRefs=[];
      adv.settledRefs.push({maintId:e.m.id,workerId:e.mw.workerId,date:e.mw.date||'',wage:+e.mw.wage||0,currency:e.mw.currency||e.m.workersCurrency||e.m.currency||'SYP'});
      settledCount++;settledUSD+=e.amountUSD;
    }
  });
  return{settledCount,settledUSD};
}


function openWorkerPaymentModal(kind,workerId){
  if(!requirePerm('salary'))return;
  const isAdvance=kind==='advance';
  showModal(`
    <div class="modal-title">${isAdvance?'إضافة سلفة لعامل':'إضافة دفعة لعامل'}</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">العامل</label><select class="form-control" id="wp-worker">${db.workers.map(w=>`<option value="${w.id}" ${workerId===w.id?'selected':''}>${esc(w.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">المبلغ</label>
        <div style="display:flex;gap:4px">
          <input type="text" inputmode="decimal" class="form-control" id="wp-amount" placeholder="0" oninput="formatMoneyInput(this)">
          <select class="form-control" id="wp-currency" style="max-width:78px;padding:9px 4px;font-size:12px">
            <option value="SYP" selected>ل.س</option>
            <option value="USD">$</option>
          </select>
        </div>
      </div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">النوع</label><select class="form-control" id="wp-type"><option value="payment" ${!isAdvance?'selected':''}>دفعة عادية</option><option value="advance" ${isAdvance?'selected':''}>سلفة</option></select></div>
      <div class="form-group"><label class="form-label">التاريخ</label><input type="date" class="form-control" id="wp-date" value="${localToday()}"></div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">المشروع <span style="font-size:11px;color:var(--text2);font-weight:400">(اختياري)</span></label>${projectInputHTML('wp-project','')}</div>
      <div class="form-group"><label class="form-label">الحالة</label><select class="form-control" id="wp-paid"><option value="true" ${isAdvance?'selected':''}>${isAdvance?'مقبوضة الآن':'مدفوع الآن'}</option><option value="false" ${!isAdvance?'selected':''}>معلق</option></select></div>
    </div>
    <div class="form-group" style="margin-bottom:14px"><label class="form-label">ملاحظة${isAdvance?' (مثال: سلفة على الحساب)':' (مثال: أجرة ورشة البنك مالكي)'}</label><input type="text" class="form-control" id="wp-note" ${isAdvance?'value="سلفة"':''}></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveWorkerPayment()">حفظ</button></div>
  `);
}

function saveWorkerPayment(isBonus){
  if(!requirePerm('salary'))return;
  const sfx=isBonus?'-b':'';
  const workerId=document.getElementById('wp-worker'+sfx).value;
  const amount=unformatNum(document.getElementById('wp-amount'+sfx).value);
  const date=document.getElementById('wp-date'+sfx).value;
  const paid=document.getElementById('wp-paid'+sfx).value==='true';
  const note=document.getElementById('wp-note'+sfx).value;
  const type=document.getElementById('wp-type'+sfx).value;
  const curEl=document.getElementById('wp-currency'+sfx);
  const currency=curEl&&curEl.value==='USD'?'USD':'SYP';
  const projectEl=document.getElementById('wp-project'+sfx);
  const projectName=projectEl?projectEl.value.trim():'';
  if(projectName)findOrCreateProject(projectName);
  if(!(amount>0)){alert('يرجى إدخال مبلغ صحيح أكبر من صفر');return;}
  if(!date){alert('يرجى إدخال التاريخ');return;}
  if(!workerId){alert('يرجى اختيار العامل');return;}
  const payment={id:uid(),workerId,amount,currency,date,paid,note,type,paidDate:paid?date:'',projectName,isBonus:!!isBonus};
  db.workerPayments.push(payment);
  logAction('إضافة',type==='advance'?'سلفة عامل':(isBonus?'مكافأة عامل':'دفعة عامل'),getWorkerNameRaw(workerId)+' — '+fmt(amount)+' '+curLabel(currency));
  let settleMsg='';
  if(type==='payment'&&!isBonus&&paid){
    const res=settleWorkerWorkshopWages(workerId,toUSD(amount,currency),date);
    if(res.settledCount>0){
      payment.settledRefs=res.settledRefs;
      settleMsg=`\n\nتمت تسوية ${res.settledCount} أجرة ورشة غير محسوبة بقيمة ${finValUSD(res.settledUSD,'salary')} تلقائياً من هالدفعة.`;
    }
    if(res.remaining>0.005){
      // الفائض يلي ما انغطى فيه أجرة كاملة (سواء ما تسوّت ولا أجرة أو تبقى جزء) بينحفظ
      // كرصيد عند العامل وبينخصم تلقائياً من أول أجرة ورشة جديدة تنسجل له لاحقاً.
      payment.remainingSurplus=res.remaining;
      settleMsg+=(res.settledCount>0?` تبقّى ${finValUSD(res.remaining,'salary')} من مبلغ الدفعة صار له رصيد إضافي عند العامل، وبينخصم تلقائياً من أول أجرة جاية.`:`\n\nمبلغ الدفعة (${finValUSD(toUSD(amount,currency),'salary')}) صار رصيد/سلفة عند العامل وبينخصم تلقائياً من أول أجرة ورشة جاية إلو.`);
    }else{
      // مهم: لازم نحدد remainingSurplus=0 صراحة (مش نتركها undefined) وإلا
      // applyAdvanceSurplusToWorker رح تعتبرها "لسا ما تهيّأت" وترجّع كامل مبلغ
      // الدفعة كفائض متاح من جديد رغم إنه انصرف بالكامل على تسوية الأجور فوق —
      // وهاد بيسبب تغطية أجور تانية "وهمياً" بمبلغ مصروف أصلاً.
      payment.remainingSurplus=0;
    }
  }
  if(type==='advance'&&paid){
    payment.remainingSurplus=toUSD(amount,currency);
  }
  if((type==='advance'||type==='payment')&&!isBonus&&paid){
    const res=applyAdvanceSurplusToWorker(workerId);
    if(res.settledCount>0){
      settleMsg+=`\n\nكان في ${res.settledCount} أجرة ورشة بتاريخ بعد ${type==='advance'?'السلفة':'الدفعة'}، انغطت تلقائياً من فائضها بقيمة ${finValUSD(res.settledUSD,'salary')}.`;
    }
  }
  saveDB(db);closeModal();renderWorkers(document.getElementById('main-content'),document.getElementById('topbar-actions'));
  if(settleMsg)alert('تم حفظ الدفعة.'+settleMsg);
}

function markWorkerPaid(id){
  if(!requirePerm('salary'))return;
  const p=db.workerPayments.find(x=>x.id===id);
  if(p){
    p.paid=true;p.paidDate=localToday();
    let settleMsg='';
    if(p.type==='payment'&&!p.isBonus){
      const res=settleWorkerWorkshopWages(p.workerId,toUSD(+p.amount||0,p.currency),p.paidDate);
      if(res.settledCount>0){
        p.settledRefs=res.settledRefs;
        settleMsg=`\n\nتمت تسوية ${res.settledCount} أجرة ورشة غير محسوبة بقيمة ${finValUSD(res.settledUSD,'salary')} تلقائياً من هالدفعة.`;
      }
      // (نفس تصحيح saveWorkerPayment): لازم نحدد 0 صراحة عند الاستهلاك الكامل، وإلا
      // applyAdvanceSurplusToWorker بترجّع كامل المبلغ كفائض وهمي من جديد.
      p.remainingSurplus=res.remaining>0.005?res.remaining:0;
    }
    if(p.type==='advance'&&p.remainingSurplus===undefined){
      p.remainingSurplus=toUSD(+p.amount||0,p.currency);
    }
    if((p.type==='advance'||p.type==='payment')&&!p.isBonus){
      const res=applyAdvanceSurplusToWorker(p.workerId);
      if(res.settledCount>0){
        settleMsg+=`\n\nكان في ${res.settledCount} أجرة ورشة بتاريخ بعد ${p.type==='advance'?'السلفة':'الدفعة'}، انغطت تلقائياً من فائضها بقيمة ${finValUSD(res.settledUSD,'salary')}.`;
      }
    }
    saveDB(db);renderWorkers(document.getElementById('main-content'),document.getElementById('topbar-actions'));
    if(settleMsg)alert('تم تسديد الدفعة.'+settleMsg);
    return;
  }
  saveDB(db);renderWorkers(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function deleteWorkerPayment(id){
  if(!guardDelete())return;
  const p=db.workerPayments.find(x=>x.id===id);
  const hasSettlement=p&&p.settledRefs&&p.settledRefs.length;
  if(!confirm(hasSettlement?`هاي الدفعة صفّت ${p.settledRefs.length} أجرة ورشة تلقائياً. حذفها بيرجّع تلك الأجور "غير محسوبة" من جديد. متأكد بدك تحذف؟`:'حذف هذه الدفعة؟'))return;
  if(hasSettlement)reverseWorkerWagesSettlement(p.settledRefs);
  db.workerPayments=db.workerPayments.filter(x=>x.id!==id);
  logAction('حذف','دفعة عامل',id);saveDB(db);renderWorkers(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function maintWorkerShareValue(m,workerId,myWageUSD){
  const incomeUSD=toUSD(maintRecognizedIncome(m),m.currency);
  const totalWagesInJobUSD=(m.workers||[]).reduce((s,w)=>s+toUSD(+w.wage||0,w.currency||m.workersCurrency||m.currency),0);
  if(totalWagesInJobUSD>0)return incomeUSD*(myWageUSD/totalWagesInJobUSD);
  const cnt=(m.workers||[]).length||1;
  return incomeUSD/cnt;
}

function getWorkerPerformanceStats(w){
  let days=0,totalWage=0,valueGenerated=0,jobsSet=new Set();
  db.maintenance.forEach(m=>{
    (m.workers||[]).forEach(mw=>{
      if(mw.workerId!==w.id)return;
      if(mw.wageOnly)return; // تسوية/أجرة فقط بدون تنفيذ عمل فعلي — لا تُحتسب بمؤشر الأداء
      const wageUSD=toUSD(+mw.wage||0,mw.currency||m.workersCurrency||m.currency);
      days+=(+mw.days||1);
      totalWage+=wageUSD;
      valueGenerated+=maintWorkerShareValue(m,w.id,wageUSD);
      jobsSet.add(m.id);
    });
  });
  const efficiency=totalWage>0?valueGenerated/totalWage:0; // كل دولار أجر بيحقق قديش قيمة
  const wagePerDay=days>0?totalWage/days:0;
  return {worker:w,days,totalWage,valueGenerated,efficiency,wagePerDay,jobs:jobsSet.size};
}

function renderWorkerIncentives(){
  if(!canViewWorkerSalaries())return salaryLockedHTML('حوافز العمال');
  const stats=db.workers.map(getWorkerPerformanceStats).filter(s=>s.days>0);
  if(!stats.length)return `<div class="card"><div class="empty-state"><i class="ti ti-award"></i><p>ما في بيانات ورش كافية بعد لتحليل أداء العمال</p></div></div>`;
  const minDays=getBonusMinDays();
  const maxEff=Math.max(...stats.map(s=>s.efficiency),0.0001);
  const teamAvgWagePerDay=stats.reduce((s,x)=>s+x.wagePerDay,0)/stats.length;
  // مؤشر إنتاجية من 100: نسبة كفاءة كل عامل (قيمة محققة / أجره) مقارنة بأعلى كفاءة بالفريق
  const enriched=stats.map(s=>{
    const score=Math.round((s.efficiency/maxEff)*100);
    const wagePerDayVsAvg=teamAvgWagePerDay>0?Math.round((s.wagePerDay/teamAvgWagePerDay)*100):100;
    let verdict,color;
    if(s.days<minDays){verdict='بيانات غير كافية بعد';color='gray';}
    else if(score>=85){verdict='🌟 إنتاجية ممتازة';color='green';}
    else if(score>=60){verdict='👍 إنتاجية جيدة';color='blue';}
    else if(score>=35){verdict='إنتاجية متوسطة';color='amber';}
    else{verdict='⚠️ إنتاجية منخفضة';color='red';}
    return {...s,score,wagePerDayVsAvg,verdict,color};
  }).sort((a,b)=>b.score-a.score);
  const colorMap={green:'var(--accent)',red:'var(--danger)',blue:'var(--info)',amber:'var(--gold-dark)',gray:'var(--text2)'};
  const badgeMap={green:'badge-green',red:'badge-red',blue:'badge-blue',amber:'badge-amber',gray:'badge-gray'};
  return `
  <div class="grid-3" style="margin-bottom:18px">
    <div class="metric-card"><div class="metric-label">متوسط الأجر/يوم بالفريق</div><div class="metric-value amber">${finVal(teamAvgWagePerDay,'salary')}</div></div>
    <div class="metric-card"><div class="metric-label">الأعلى إنتاجية</div><div class="metric-value" style="font-size:15px">${esc(enriched[0].worker.name)}</div><div style="font-size:11px;color:var(--text2);margin-top:2px">مؤشر ${enriched[0].score}/100</div></div>
    <div class="metric-card"><div class="metric-label">عدد العمال المُقيّمين</div><div class="metric-value">${enriched.filter(e=>e.days>=minDays).length}</div></div>
  </div>
  <div class="card" style="margin-bottom:18px">
    <div class="section-title" style="display:flex;align-items:center;gap:6px"><i class="ti ti-bulb" style="color:var(--gold-dark)"></i> شو هو هاد المؤشر؟</div>
    <div style="font-size:12px;color:var(--text2);line-height:1.8">
      مؤشر الإنتاجية (من 100) بيقارن كل عامل بأفضل عامل بالفريق حسب "القيمة المحققة من الورشات مقابل الأجر يلي أخذه". هو مؤشر <b>إرشادي فقط</b> لمساعدتك تشوف وتقارن — <b>ما بيقترح أي مبلغ حافز وما بينضاف لأي حساب تلقائياً</b>. إنت يلي بتقرر الحافز أو المكافأة حسب تقييمك، وإذا ضفتها من زر "دفعة/مكافأة" تحت، ساعتها بتنضاف فعلياً للحسابات.
      <br>العمال يلي عندهم أقل من ${minDays} أيام عمل مصنّفين "بيانات غير كافية" لتجنب مقارنة غير عادلة.
    </div>
  </div>
  <div class="card">
    <div class="section-title">مقارنة إنتاجية العمال</div>
    <div style="overflow-x:auto"><table>
      <thead><tr><th>العامل</th><th>أيام العمل</th><th>عدد الورشات</th><th>الأجر الكلي ($)</th><th>الأجر/يوم ($)</th><th>الأجر/يوم مقابل المتوسط</th><th>القيمة المحققة ($)</th><th>مؤشر الإنتاجية</th><th>التصنيف</th><th></th></tr></thead>
      <tbody>
        ${enriched.map(s=>`<tr>
          <td style="font-weight:700">${esc(s.worker.name)}</td>
          <td style="text-align:center">${s.days}</td>
          <td style="text-align:center">${s.jobs}</td>
          <td style="color:var(--salary);font-weight:600">${finValUSD(s.totalWage,'salary')}</td>
          <td style="font-weight:600">${finValUSD(s.wagePerDay,'salary')}</td>
          <td style="font-weight:700;color:${s.wagePerDayVsAvg>115?'var(--danger)':s.wagePerDayVsAvg<85?'var(--accent)':'var(--text2)'}">${s.wagePerDayVsAvg}%</td>
          <td style="color:var(--accent);font-weight:600">${finValUSD(s.valueGenerated,'profit')}</td>
          <td style="min-width:120px">
            <div style="display:flex;align-items:center;gap:6px">
              <div style="flex:1;background:var(--border);border-radius:20px;height:8px;overflow:hidden"><div style="width:${s.score}%;height:100%;background:${colorMap[s.color]}"></div></div>
              <span style="font-weight:700;font-size:12px;color:${colorMap[s.color]}">${s.score}</span>
            </div>
          </td>
          <td><span class="badge ${badgeMap[s.color]}" style="font-size:11px">${s.verdict}</span></td>
          <td><button class="btn btn-sm" style="color:var(--accent);border-color:var(--accent)" onclick="openWorkerBonusModal('${s.worker.id}')"><i class="ti ti-gift"></i> إضافة مكافأة</button></td>
        </tr>`).join('')}
      </tbody>
    </table></div>
  </div>`;
}

function openWorkerBonusModal(workerId){
  if(!requirePerm('salary'))return;
  showModal(`<div class="modal-title">إضافة مكافأة / حافز يدوي</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">العامل</label><select class="form-control" id="wp-worker-b">${db.workers.map(w=>`<option value="${w.id}" ${workerId===w.id?'selected':''}>${esc(w.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">مبلغ المكافأة</label>
        <div style="display:flex;gap:4px">
          <input type="text" inputmode="decimal" class="form-control" id="wp-amount-b" placeholder="0" oninput="formatMoneyInput(this)">
          <select class="form-control" id="wp-currency-b" style="max-width:78px;padding:9px 4px;font-size:12px">
            <option value="SYP" selected>ل.س</option>
            <option value="USD">$</option>
          </select>
        </div>
      </div>
    </div>
    <div class="form-row cols-2">
      <input type="hidden" id="wp-type-b" value="payment">
      <div class="form-group"><label class="form-label">التاريخ</label><input type="date" class="form-control" id="wp-date-b" value="${localToday()}"></div>
      <div class="form-group"><label class="form-label">الحالة</label><select class="form-control" id="wp-paid-b"><option value="true">مدفوعة الآن</option><option value="false" selected>معلقة (تُضاف لرصيده المستحق)</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">ملاحظة</label><input type="text" class="form-control" id="wp-note-b" value="مكافأة أداء"></div>
    <div style="font-size:11px;color:var(--text2);margin-top:8px">بينضاف لرصيد العامل فوراً.</div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveWorkerPayment(true)">حفظ المكافأة</button></div>`);
}

function exportSuppliersExcel(){
  const headers=['المورد','هاتف المورد','التاريخ','الوجهة','الصنف','وصف المادة','Part Number','الكمية','ملاحظة الصنف','إجمالي العملية','المدفوع','الباقي','ملاحظة العملية'];
  const rows=[];
  db.suppliers.forEach(sup=>{
    const purchases=sup.purchases||[];
    if(!purchases.length){rows.push([sup.name,sup.phone||'','','','','','','','','','','','']);return;}
    purchases.slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).forEach(p=>{
      const remaining=(+p.total||0)-(+p.paid||0);
      const items=p.items&&p.items.length?p.items:[{}];
      items.forEach(item=>{
        rows.push([
          sup.name,sup.phone||'',p.date||'',p.destination||'',
          item.type||item.desc||'',item.itemDesc||'',item.modelNumber||'',item.qty||'',item.note||'',
          p.total||0,p.paid||0,remaining,p.note||''
        ]);
      });
    });
  });
  exportRowsToExcel('الموردون','الموردون',headers,rows);
}

function renderSuppliers(el,acts){
  acts.innerHTML=`<button class="btn btn-primary" onclick="openSupplierPurchaseModal()"><i class="ti ti-plus"></i> تسجيل سحب بضاعة</button>
    <button class="btn" onclick="openSupplierReturnModal()"><i class="ti ti-rotate-2"></i> تسجيل مرتجع</button>
    <button class="btn" onclick="openAddSupplierModal()"><i class="ti ti-building-store"></i> مورد جديد</button>
    <button class="btn" onclick="exportSuppliersExcel()"><i class="ti ti-file-spreadsheet"></i> تصدير Excel</button>
    <button class="btn" onclick="openImportSupplierExcelModal()"><i class="ti ti-file-import"></i> استيراد من Excel</button>`;
  el.innerHTML=`<div class="grid-2" style="margin-bottom:18px">
    ${db.suppliers.map(sup=>{
      const p=sup.purchases||[];
      const tB=p.reduce((s,x)=>s+toUSD(+x.total||0,x.currency||'SYP'),0);
      const tPInvoices=p.reduce((s,x)=>s+toUSD(+x.paid||0,x.currency||'SYP'),0);
      const accPaid=getSupplierAccountPaidUSD(sup);
      const tP=tPInvoices+accPaid;
      const bal=Math.max(tB-tP,0);
      return `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
          <div><div style="font-weight:700;font-size:16px">${esc(sup.name)}</div><div style="font-size:12px;color:var(--text2)">مورد ${sup.phone?`· ${esc(sup.phone)}`:''}</div></div>
          <span class="badge ${bal>0?'badge-red':'badge-green'}">${bal>0?'مديون: '+fmtUSD(bal):'الحساب سالم'}</span>
        </div>
        <div class="grid-3" style="margin-bottom:14px">
          <div><div class="metric-label">إجمالي المشتريات ($)</div><div style="font-weight:700;font-size:15px">${fmtUSD(tB)}</div></div>
          <div><div class="metric-label">المدفوع ($)</div><div style="font-weight:700;font-size:15px;color:var(--accent)">${fmtUSD(tP)}</div></div>
          <div><div class="metric-label">المتبقي ($)</div><div style="font-weight:700;font-size:15px;color:${bal>0?'var(--danger)':'var(--accent)'}">${fmtUSD(bal)}</div></div>
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px">آخر 3 عمليات</div>
        ${p.slice(-3).reverse().map(x=>`<div onclick="viewPurchaseItems('${sup.id}','${x.id}')" style="cursor:pointer;display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid var(--border)">
          <div><div style="font-weight:600">${fmtDate(x.date)}</div><div style="color:var(--text2)">${esc(x.destination||x.note||'—')}</div></div>
          <div style="text-align:left"><div style="font-weight:700">${fmt(x.total)} <span style="font-size:10px;color:var(--text2)">${curLabel(x.currency||'SYP')}</span></div><div style="color:${(+x.total||0)>(+x.paid||0)?'var(--danger)':'var(--accent)'}">مدفوع: ${fmt(x.paid)}</div></div>
        </div>`).join('')||'<div style="font-size:12px;color:var(--text2);padding:8px 0">لا يوجد عمليات</div>'}
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" onclick="viewSupplierDetails('${sup.id}')"><i class="ti ti-list"></i> عرض الكل</button>
          <button class="btn btn-sm btn-primary" onclick="openSupplierPurchaseModal('${sup.id}')"><i class="ti ti-plus"></i> سحب جديد</button>
          <button class="btn btn-sm" onclick="openSupplierReturnModal('${sup.id}')"><i class="ti ti-rotate-2"></i> مرتجع</button>
          ${bal>0?`<button class="btn btn-sm" style="color:var(--accent);border-color:var(--accent)" onclick="openSupplierAccountPaymentModal('${sup.id}')"><i class="ti ti-coin"></i> دفعة على الحساب</button>`:''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function openAddSupplierModal(){
  showModal(`
    <div class="modal-title">إضافة مورد جديد</div>
    <div class="form-row cols-2"><div class="form-group"><label class="form-label">اسم المورد</label><input type="text" class="form-control" id="new-sup-name"></div><div class="form-group"><label class="form-label">رقم الهاتف</label><input type="tel" class="form-control" id="new-sup-phone" dir="ltr" style="text-align:left" placeholder="مثال: 0912345678"></div></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveNewSupplier()">إضافة</button></div>
  `);
}

function saveNewSupplier(){
  const name=document.getElementById('new-sup-name').value.trim();
  const phone=document.getElementById('new-sup-phone')?document.getElementById('new-sup-phone').value.trim():'';
  if(!name){alert('يرجى إدخال اسم المورد');return;}
  db.suppliers.push({id:uid(),name,phone,purchases:[]});
  saveDB(db);closeModal();renderSuppliers(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function viewSupplierDetails(supId){
  const sup=db.suppliers.find(s=>s.id===supId);if(!sup)return;
  const p=sup.purchases||[];
  const {totalUSD,paidUSD,accountPaidUSD,remainingUSD}=supplierTotalDebtBreakdown(sup);
  const accPays=(sup.accountPayments||[]).slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  showModal(`
    <div class="modal-title">تفاصيل حساب — ${esc(sup.name)}</div>
    <div class="grid-3" style="margin-bottom:14px">
      <div class="metric-card"><div class="metric-label">إجمالي المشتريات ($)</div><div style="font-weight:700;font-size:15px">${fmtUSD(totalUSD)}</div></div>
      <div class="metric-card"><div class="metric-label">المدفوع الكلي ($) <span style="font-size:9px;color:var(--text2);font-weight:400">(فواتير + دفعات على الحساب)</span></div><div style="font-weight:700;font-size:15px;color:var(--accent)">${fmtUSD(paidUSD)}</div></div>
      <div class="metric-card"><div class="metric-label">المتبقي الصافي ($)</div><div style="font-weight:700;font-size:15px;color:${remainingUSD>0?'var(--danger)':'var(--accent)'}">${fmtUSD(remainingUSD)}</div></div>
    </div>
    <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-sm btn-primary" onclick="closeModal();openSupplierPurchaseModal('${sup.id}')"><i class="ti ti-plus"></i> سحب جديد</button>
      <button class="btn btn-sm" onclick="closeModal();openSupplierReturnModal('${sup.id}')"><i class="ti ti-rotate-2"></i> تسجيل مرتجع</button>
      <button class="btn btn-sm" style="color:var(--accent);border-color:var(--accent)" onclick="openSupplierAccountPaymentModal('${sup.id}')"><i class="ti ti-coin"></i> دفعة على كامل الحساب</button>
    </div>
    ${accPays.length>0?`<div style="margin-bottom:14px">
      <div class="section-title" style="font-size:13px;margin-bottom:8px">دفعات على كامل الحساب <span style="font-size:10px;color:var(--text2);font-weight:400">(غير مرتبطة بفاتورة معينة، إجمالي ${fmtUSD(accountPaidUSD)})</span></div>
      <table><thead><tr><th>التاريخ</th><th>المبلغ</th><th>ملاحظة</th><th></th></tr></thead><tbody>
        ${accPays.map(ap=>`<tr>
          <td>${fmtDate(ap.date)}</td>
          <td style="font-weight:700;color:var(--accent)">${fmt(ap.amount)} <span style="font-size:10px;color:var(--text2)">${curLabel(ap.currency||'SYP')}</span></td>
          <td style="font-size:12px;color:var(--text2)">${esc(ap.note||'—')}</td>
          <td><div class="action-btns">
            <button class="btn btn-sm" onclick="openSupplierAccountPaymentModal('${sup.id}','${ap.id}')"><i class="ti ti-edit"></i></button>
            <button class="btn btn-sm btn-danger" onclick="deleteSupplierAccountPayment('${sup.id}','${ap.id}')"><i class="ti ti-trash"></i></button>
          </div></td>
        </tr>`).join('')}
      </tbody></table>
    </div>`:''}
    <div style="max-height:400px;overflow-y:auto">
      ${p.length===0?'<div class="empty-state"><i class="ti ti-package"></i><p>لا يوجد عمليات</p></div>':`
      <table>
        <thead><tr><th>التاريخ</th><th>الأصناف</th><th>الوجهة</th><th>الإجمالي</th><th>المدفوع</th><th>الباقي</th><th>الدفعات</th><th></th></tr></thead>
        <tbody>
          ${p.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).map(x=>`<tr onclick="if(!event.target.closest('.row-menu-wrap,details,summary'))viewPurchaseItems('${sup.id}','${x.id}')" style="cursor:pointer">
            <td>${fmtDate(x.date)}</td>
            <td style="font-size:12px">${x.items&&x.items.length?x.items.map(i=>`${i.qty||1}x ${esc(i.type||i.desc||'—')} <span style="color:var(--text2)">(${fmt(i.price)} ${curLabel(x.currency)})</span>${i.note?'<br><span style="color:var(--text2)">'+esc(i.note)+'</span>':''}`).join('<br>'):x.note||'—'}</td>
            <td style="font-size:12px">${x.isReturn?'<span class="badge badge-green" style="margin-left:4px">مرتجع</span>':''}${esc(x.destination||'—')}</td>
            <td style="font-weight:700">${fmt(x.total)} <span style="font-size:10px;color:var(--text2)">${curLabel(x.currency||'SYP')}</span></td>
            <td style="color:var(--accent);font-weight:600">${fmt(x.paid)}</td>
            <td style="color:${(+x.total||0)>(+x.paid||0)?'var(--danger)':'var(--accent)'};font-weight:700">${fmt((+x.total||0)-(+x.paid||0))}</td>
            <td>${renderSupplierPaymentsCell(x)}</td>
            <td><div class="row-menu-wrap">
              <button class="row-menu-btn" onclick="toggleRowMenu(this,event)">⋮</button>
              <div class="row-menu-list">
                <button class="row-menu-item" onclick="viewPurchaseItems('${sup.id}','${x.id}')"><i class="ti ti-eye"></i> عرض التفاصيل</button>
                <button class="row-menu-item" onclick="viewPurchaseItems('${sup.id}','${x.id}')"><i class="ti ti-cash"></i> تسديد دفعة (لكل صنف)</button>
                <button class="row-menu-item green" onclick="openSupplierGeneralPaymentModal('${sup.id}','${x.id}')"><i class="ti ti-coin"></i> دفعة عامة على الفاتورة</button>
                <button class="row-menu-item" onclick="printSupplierPurchase('${sup.id}','${x.id}')"><i class="ti ti-printer"></i> طباعة</button>
                <button class="row-menu-item" onclick="closeModal();${x.isReturn?`openSupplierReturnModal('${sup.id}','${x.id}')`:`openSupplierPurchaseModal('${sup.id}','${x.id}')`}"><i class="ti ti-edit"></i> تعديل</button>
                <button class="row-menu-item" onclick="duplicateSupplierPurchase('${sup.id}','${x.id}')"><i class="ti ti-copy"></i> نسخ كعملية جديدة</button>
                <button class="row-menu-item danger" onclick="deleteSupPurchase('${sup.id}','${x.id}')"><i class="ti ti-trash"></i> حذف</button>
              </div>
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>`}
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">إغلاق</button>
      <button class="btn btn-primary" onclick="closeModal();openSupplierPurchaseModal('${supId}')"><i class="ti ti-plus"></i> إضافة سحب</button>
    </div>
  `);
}

function renderSupplierPaymentsCell(x){
  const pays=(x.payments||[]).slice().sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
  if(pays.length===0)return `<span style="font-size:11px;color:var(--text3)">لا يوجد دفعات</span>`;
  const last=pays[pays.length-1];
  const rows=pays.map((pp,i)=>`<tr>
      <td style="padding:4px 8px;font-size:11px;color:var(--text2)">${i+1}</td>
      <td style="padding:4px 8px;font-size:11px;white-space:nowrap">${fmtDate(pp.date)}</td>
      <td style="padding:4px 8px;font-size:12px;font-weight:600">${fmt(pp.amount)} <span style="font-size:9px;color:var(--text2)">${curLabel(pp.currency||x.currency)}</span></td>
      <td style="padding:4px 8px;font-size:11px;color:var(--text2)">${esc(pp.note||'')}</td>
    </tr>`).join('');
  return `<details class="opt-details" style="min-width:150px">
    <summary><span class="opt-badge">${pays.length} دفعة</span><span style="font-size:11px;color:var(--text2)">آخرها ${fmtDate(last.date)}</span></summary>
    <div class="opt-body"><table style="width:100%;border-collapse:collapse">${rows}</table></div>
  </details>`;
}

function getSupplierAccountPaidUSD(sup){
  return (sup.accountPayments||[]).reduce((s,p)=>s+toUSD(+p.amount||0,p.currency||'SYP'),0);
}

function supplierTotalDebtBreakdown(sup){
  const p=sup.purchases||[];
  const tB=p.reduce((s,x)=>s+toUSD(+x.total||0,x.currency||'SYP'),0);
  const tPInvoices=p.reduce((s,x)=>s+toUSD(+x.paid||0,x.currency||'SYP'),0);
  const accPaid=getSupplierAccountPaidUSD(sup);
  return {totalUSD:tB,paidUSD:tPInvoices+accPaid,accountPaidUSD:accPaid,remainingUSD:Math.max(tB-tPInvoices-accPaid,0)};
}

function openSupplierAccountPaymentModal(supId,paymentId){
  const sup=db.suppliers.find(s=>s.id===supId);if(!sup)return;
  if(!sup.accountPayments)sup.accountPayments=[];
  const pp=paymentId?sup.accountPayments.find(x=>x.id===paymentId):null;
  const {remainingUSD}=supplierTotalDebtBreakdown(sup);
  showModal(`<div class="modal-title">${paymentId?'تعديل دفعة على الحساب':'دفعة على كامل الحساب'} — ${esc(sup.name)}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px">دفعة عامة، بدون ربط بفاتورة.</div>
    <div class="metric-card" style="margin-bottom:16px"><div class="metric-label">إجمالي المتبقي الحالي على الحساب ($)</div><div class="metric-value red" style="font-size:18px">${fmtUSD(remainingUSD+(pp?toUSD(+pp.amount||0,pp.currency||'SYP'):0))}</div></div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">مبلغ الدفعة</label><div style="display:flex;gap:4px"><input type="text" inputmode="decimal" class="form-control" id="supp-acc-amount" placeholder="0" value="${pp?fmt(pp.amount):''}" oninput="formatMoneyInput(this)">${currencySelectHTML('supp-acc-currency',pp?pp.currency:'USD')}</div></div>
      <div class="form-group"><label class="form-label">تاريخ الدفعة</label><input type="date" class="form-control" id="supp-acc-date" value="${pp?pp.date:localToday()}"></div>
    </div>
    <div class="form-group" style="margin-top:10px"><label class="form-label">ملاحظة</label><input type="text" class="form-control" id="supp-acc-note" value="${pp?esc(pp.note||''):''}" placeholder="مثلاً: دفعة على الحساب، نقداً..."></div>
    <div class="modal-actions"><button class="btn" onclick="viewSupplierDetails('${supId}')">إلغاء</button><button class="btn btn-primary" onclick="saveSupplierAccountPayment('${supId}','${paymentId||''}')">حفظ الدفعة</button></div>`);
}

function saveSupplierAccountPayment(supId,paymentId){
  const sup=db.suppliers.find(s=>s.id===supId);if(!sup)return;
  const amount=unformatNum(document.getElementById('supp-acc-amount').value);
  const currencyEl=document.getElementById('supp-acc-currency');
  const currency=currencyEl&&currencyEl.value==='USD'?'USD':'SYP';
  const date=document.getElementById('supp-acc-date').value;
  const note=document.getElementById('supp-acc-note').value||'دفعة على الحساب';
  if(amount<=0){alert('يرجى إدخال مبلغ صحيح');return;}
  if(!sup.accountPayments)sup.accountPayments=[];
  if(paymentId){
    const idx=sup.accountPayments.findIndex(p=>p.id===paymentId);
    if(idx>=0)sup.accountPayments[idx]={id:paymentId,amount,currency,date,note};
  }else{
    sup.accountPayments.push({id:uid(),amount,currency,date,note});
  }
  saveDB(db);
  logAction(paymentId?'تعديل دفعة على الحساب':'دفعة على الحساب','مورد',`${esc(sup.name)} — ${fmt(amount)} ${curLabel(currency)}`);
  viewSupplierDetails(supId);
}

function deleteSupplierAccountPayment(supId,paymentId){
  if(!guardDelete())return;
  const sup=db.suppliers.find(s=>s.id===supId);if(!sup)return;
  if(!confirm('حذف هذه الدفعة من رصيد الحساب؟'))return;
  sup.accountPayments=(sup.accountPayments||[]).filter(p=>p.id!==paymentId);
  saveDB(db);
  logAction('حذف دفعة على الحساب','مورد',sup.name);
  viewSupplierDetails(supId);
}

// مهم: لازم نستخدم convertedAmount (المبلغ محوّل لعملة العملية x.currency) مش amount الخام —
// لأن المستخدم ممكن يسجّل دفعة بعملة مختلفة عن عملة العملية (مثلاً عملية بالليرة ودفعة بالدولار)،
// وقبل هالتصحيح كان بينجمع amount الخام بغض النظر عن عملته فيصير خلط عملتين بنفس المجموع.
// convertedAmount||amount هون للتوافق مع دفعات قديمة اتسجلت قبل هالحقل (كانت غالباً نفس العملة).
function supItemPaid(x,itemId){return (x.payments||[]).filter(p=>p.itemId===itemId).reduce((s,p)=>s+(+(p.convertedAmount!==undefined?p.convertedAmount:p.amount)||0),0);}

function supItemRemaining(x,item){return Math.max((+item.price||0)-supItemPaid(x,item.id),0);}

function viewPurchaseItems(supId,pId){
  const sup=db.suppliers.find(s=>s.id===supId);if(!sup)return;
  const x=(sup.purchases||[]).find(p=>p.id===pId);if(!x)return;
  const remaining=(+x.total||0)-(+x.paid||0);
  showModal(`
    <div class="modal-title">تفاصيل العملية — ${esc(sup.name)}</div>
    <div class="grid-3" style="margin-bottom:16px">
      <div class="metric-card"><div class="metric-label">الإجمالي</div><div class="metric-value blue" style="font-size:16px">${fmt(x.total)} <span style="font-size:10px">${curLabel(x.currency||'SYP')}</span></div></div>
      <div class="metric-card"><div class="metric-label">المدفوع</div><div class="metric-value green" style="font-size:16px">${fmt(x.paid)}</div></div>
      <div class="metric-card"><div class="metric-label">الباقي</div><div class="metric-value ${remaining>0?'red':'green'}" style="font-size:16px">${fmt(remaining)}</div></div>
    </div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:6px">التاريخ: ${fmtDate(x.date)} — الوجهة: ${esc(x.destination||'—')}</div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn btn-sm btn-primary" onclick="openSupplierGeneralPaymentModal('${supId}','${pId}')"><i class="ti ti-cash"></i> دفعة عامة على الفاتورة</button></div>
    <div style="font-weight:700;font-size:13px;margin:10px 0 6px">الأصناف</div>
    <table><thead><tr><th>الصنف</th><th>الكمية</th><th>ملاحظة</th><th>السعر</th><th>المدفوع</th><th>الباقي</th><th></th></tr></thead>
      <tbody>${x.items&&x.items.length?x.items.map(i=>{const ip=supItemPaid(x,i.id),ir=supItemRemaining(x,i);return `<tr>
        <td>${esc(i.type||i.desc||'—')}${i.itemDesc?`<div style="font-size:11px;color:var(--text2)">${esc(i.itemDesc)}</div>`:''}</td>
        <td>${i.qty||1}</td><td>${esc(i.note||'—')}</td>
        <td style="font-weight:600">${fmt(i.price)} <span style="font-size:9px;color:var(--text2)">${curLabel(x.currency)}</span></td>
        <td style="color:var(--accent);font-weight:600">${fmt(ip)}</td>
        <td style="color:${ir>0?'var(--danger)':'var(--accent)'};font-weight:700">${fmt(ir)}</td>
        <td><button class="btn btn-sm" onclick="openSupplierItemPaymentModal('${supId}','${pId}','${i.id}')"><i class="ti ti-cash"></i> دفعة</button></td>
      </tr>`;}).join(''):'<tr><td colspan="7">لا يوجد أصناف</td></tr>'}</tbody>
    </table>
    ${x.note?`<div style="font-size:12px;color:var(--text2);margin-top:10px">ملاحظة العملية: ${esc(x.note)}</div>`:''}
    <div style="font-weight:700;font-size:13px;margin:16px 0 6px">الدفعات المسجلة</div>
    ${(!x.payments||x.payments.length===0)?`<div style="text-align:center;padding:10px;background:var(--bg2);border-radius:8px;font-size:12px;color:var(--text2)">لا يوجد دفعات مسجلة بعد</div>`:`
    <table><thead><tr><th>التاريخ</th><th>الصنف</th><th>المبلغ</th><th>ملاحظة</th><th></th></tr></thead>
      <tbody>${x.payments.slice().sort((a,b)=>new Date(a.date||0)-new Date(b.date||0)).map(pp=>{const itm=(x.items||[]).find(i=>i.id===pp.itemId);const isGeneral=!pp.itemId;const editCall=isGeneral?`openSupplierGeneralPaymentModal('${supId}','${pId}','${pp.id}')`:`openSupplierItemPaymentModal('${supId}','${pId}','${pp.itemId||''}','${pp.id}')`;return `<tr>
        <td>${fmtDate(pp.date)}</td><td style="font-size:12px">${itm?esc(itm.type||itm.desc||'—'):'<span class="badge badge-blue" style="font-size:10px">دفعة عامة</span>'}</td><td style="font-weight:600">${fmt(pp.amount)} <span style="font-size:10px;color:var(--text2)">${curLabel(pp.currency||x.currency)}</span></td><td style="font-size:12px">${esc(pp.note||'—')}</td>
        <td><div class="action-btns"><button class="btn btn-sm" onclick="${editCall}"><i class="ti ti-edit"></i></button><button class="btn btn-sm btn-danger" onclick="deleteSupplierPayment('${supId}','${pId}','${pp.id}')"><i class="ti ti-trash"></i></button></div></td>
      </tr>`;}).join('')}</tbody>
    </table>`}
    <div class="modal-actions"><button class="btn" onclick="viewSupplierDetails('${supId}')">رجوع</button></div>
  `);
}

function openSupplierItemPaymentModal(supId,pId,itemId,paymentId){
  const sup=db.suppliers.find(s=>s.id===supId);if(!sup)return;
  const x=(sup.purchases||[]).find(p=>p.id===pId);if(!x)return;
  const item=(x.items||[]).find(i=>i.id===itemId);if(!item)return;
  if(!x.payments)x.payments=[];
  const pp=paymentId?x.payments.find(y=>y.id===paymentId):null;
  const currentPaid=supItemPaid(x,itemId)-(pp?(+(pp.convertedAmount!==undefined?pp.convertedAmount:pp.amount)||0):0);
  const remaining=(+item.price||0)-currentPaid;
  showModal(`<div class="modal-title">${paymentId?'تعديل دفعة':'تسديد دفعة'} — ${esc(item.type||item.desc||'صنف')}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px">${esc(sup.name)} — عملية ${fmtDate(x.date)}</div>
    <div class="grid-3" style="margin-bottom:16px">
      <div class="metric-card"><div class="metric-label">سعر الصنف</div><div class="metric-value blue" style="font-size:16px">${fmt(item.price)}</div></div>
      <div class="metric-card"><div class="metric-label">مدفوع سابقاً</div><div class="metric-value green" style="font-size:16px">${fmt(currentPaid)}</div></div>
      <div class="metric-card"><div class="metric-label">المتبقي</div><div class="metric-value red" style="font-size:16px">${fmt(remaining)}</div></div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">مبلغ الدفعة</label><div style="display:flex;gap:4px"><input type="text" inputmode="decimal" class="form-control" id="supp-amount" value="${fmt(pp?pp.amount:(remaining>0?remaining:0))}" oninput="formatMoneyInput(this)">${currencySelectHTML('supp-currency',pp?pp.currency:(x.currency||'SYP'))}</div></div>
      <div class="form-group"><label class="form-label">تاريخ الدفعة</label><input type="date" class="form-control" id="supp-date" value="${pp?pp.date:localToday()}"></div>
    </div>
    <div class="form-group" style="margin-top:10px"><label class="form-label">ملاحظة</label><input type="text" class="form-control" id="supp-note" value="${pp?esc(pp.note||''):''}" placeholder="مثلاً: نقداً، تحويل بنكي..."></div>
    <div class="modal-actions"><button class="btn" onclick="viewPurchaseItems('${supId}','${pId}')">إلغاء</button><button class="btn btn-primary" onclick="saveSupplierItemPayment('${supId}','${pId}','${itemId}','${paymentId||''}')">حفظ الدفعة</button></div>`);
}

function saveSupplierItemPayment(supId,pId,itemId,paymentId){
  const sup=db.suppliers.find(s=>s.id===supId);if(!sup)return;
  const x=(sup.purchases||[]).find(p=>p.id===pId);if(!x)return;
  const amount=unformatNum(document.getElementById('supp-amount').value);
  const currencyEl=document.getElementById('supp-currency');
  const currency=currencyEl&&currencyEl.value==='USD'?'USD':'SYP';
  const date=document.getElementById('supp-date').value;
  const note=document.getElementById('supp-note').value;
  if(amount<=0){alert('يرجى إدخال مبلغ صحيح');return;}
  if(!x.payments)x.payments=[];
  // نحوّل مبلغ الدفعة لعملة العملية نفسها (x.currency) قبل ما نخزّنه، لأن x.paid والمتبقي
  // كلهم محسوبين بافتراض إنو كل الأرقام بعملة العملية — دفعة بعملة تانية بدون تحويل كانت
  // عم تنجمع كرقم خام وتخلط الليرة بالدولار بنفس المجموع.
  const convertedAmount=convertCurrency(amount,currency,x.currency||'SYP');
  { // T5: الدفعة ما بتتجاوز المتبقي على العملية
    const _old=paymentId?(x.payments||[]).find(y=>y.id===paymentId):null;
    const _oldC=_old?(+(_old.convertedAmount!==undefined?_old.convertedAmount:_old.amount)||0):0;
    const _rem=round2((+x.total||0)-((+x.paid||0)-_oldC));
    if(round2(convertedAmount)>_rem+0.01){alert('الدفعة ('+fmt(round2(convertedAmount))+') أكبر من المتبقي ('+fmt(Math.max(_rem,0))+').');return;}
  }
  if(paymentId){
    const idx=x.payments.findIndex(p=>p.id===paymentId);
    if(idx>=0)x.payments[idx]={id:paymentId,itemId,amount,currency,convertedAmount,date,note};
  }else{
    x.payments.push({id:uid(),itemId,amount,currency,convertedAmount,date,note});
  }
  x.paid=round2(x.payments.reduce((sum,p)=>sum+(+(p.convertedAmount!==undefined?p.convertedAmount:p.amount)||0),0));
  saveDB(db);
  viewPurchaseItems(supId,pId);
}

function openSupplierGeneralPaymentModal(supId,pId,paymentId){
  const sup=db.suppliers.find(s=>s.id===supId);if(!sup)return;
  const x=(sup.purchases||[]).find(p=>p.id===pId);if(!x)return;
  if(!x.payments)x.payments=[];
  const pp=paymentId?x.payments.find(y=>y.id===paymentId):null;
  const currentPaid=(+x.paid||0)-(pp?(+(pp.convertedAmount!==undefined?pp.convertedAmount:pp.amount)||0):0);
  const remaining=(+x.total||0)-currentPaid;
  showModal(`<div class="modal-title">${paymentId?'تعديل دفعة عامة':'دفعة عامة على الفاتورة'} — ${esc(sup.name)}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px">عملية ${fmtDate(x.date)} — الدفعة هون بتنزل عالإجمالي مباشرة بدون تحديد صنف</div>
    <div class="grid-3" style="margin-bottom:16px">
      <div class="metric-card"><div class="metric-label">إجمالي الفاتورة</div><div class="metric-value blue" style="font-size:16px">${fmt(x.total)}</div></div>
      <div class="metric-card"><div class="metric-label">مدفوع سابقاً</div><div class="metric-value green" style="font-size:16px">${fmt(currentPaid)}</div></div>
      <div class="metric-card"><div class="metric-label">المتبقي</div><div class="metric-value red" style="font-size:16px">${fmt(remaining)}</div></div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">مبلغ الدفعة</label><div style="display:flex;gap:4px"><input type="text" inputmode="decimal" class="form-control" id="supp-gen-amount" value="${fmt(pp?pp.amount:(remaining>0?remaining:0))}" oninput="formatMoneyInput(this)">${currencySelectHTML('supp-gen-currency',pp?pp.currency:(x.currency||'SYP'))}</div></div>
      <div class="form-group"><label class="form-label">تاريخ الدفعة</label><input type="date" class="form-control" id="supp-gen-date" value="${pp?pp.date:localToday()}"></div>
    </div>
    <div class="form-group" style="margin-top:10px"><label class="form-label">ملاحظة</label><input type="text" class="form-control" id="supp-gen-note" value="${pp?esc(pp.note||''):''}" placeholder="مثلاً: نقداً، تحويل بنكي..."></div>
    <div class="modal-actions"><button class="btn" onclick="viewPurchaseItems('${supId}','${pId}')">إلغاء</button><button class="btn btn-primary" onclick="saveSupplierGeneralPayment('${supId}','${pId}','${paymentId||''}')">حفظ الدفعة</button></div>`);
}

function saveSupplierGeneralPayment(supId,pId,paymentId){
  const sup=db.suppliers.find(s=>s.id===supId);if(!sup)return;
  const x=(sup.purchases||[]).find(p=>p.id===pId);if(!x)return;
  const amount=unformatNum(document.getElementById('supp-gen-amount').value);
  const currencyEl=document.getElementById('supp-gen-currency');
  const currency=currencyEl&&currencyEl.value==='USD'?'USD':'SYP';
  const date=document.getElementById('supp-gen-date').value;
  const note=document.getElementById('supp-gen-note').value;
  if(amount<=0){alert('يرجى إدخال مبلغ صحيح');return;}
  if(!x.payments)x.payments=[];
  const convertedAmount=convertCurrency(amount,currency,x.currency||'SYP');
  { // T5: الدفعة ما بتتجاوز المتبقي على العملية
    const _old=paymentId?(x.payments||[]).find(y=>y.id===paymentId):null;
    const _oldC=_old?(+(_old.convertedAmount!==undefined?_old.convertedAmount:_old.amount)||0):0;
    const _rem=round2((+x.total||0)-((+x.paid||0)-_oldC));
    if(round2(convertedAmount)>_rem+0.01){alert('الدفعة ('+fmt(round2(convertedAmount))+') أكبر من المتبقي ('+fmt(Math.max(_rem,0))+').');return;}
  }
  if(paymentId){
    const idx=x.payments.findIndex(p=>p.id===paymentId);
    if(idx>=0)x.payments[idx]={id:paymentId,itemId:null,amount,currency,convertedAmount,date,note};
  }else{
    x.payments.push({id:uid(),itemId:null,amount,currency,convertedAmount,date,note});
  }
  x.paid=round2(x.payments.reduce((sum,p)=>sum+(+(p.convertedAmount!==undefined?p.convertedAmount:p.amount)||0),0));
  saveDB(db);
  viewPurchaseItems(supId,pId);
}

function deleteSupplierPayment(supId,pId,paymentId){
  if(!guardDelete())return;
  const sup=db.suppliers.find(s=>s.id===supId);if(!sup)return;
  const x=(sup.purchases||[]).find(p=>p.id===pId);if(!x)return;
  if(!confirm('حذف هذه الدفعة؟'))return;
  x.payments=(x.payments||[]).filter(p=>p.id!==paymentId);
  x.paid=round2(x.payments.reduce((sum,p)=>sum+(+(p.convertedAmount!==undefined?p.convertedAmount:p.amount)||0),0));
  saveDB(db);
  viewPurchaseItems(supId,pId);
}

function duplicateSupplierPurchase(supId,pId){
  const sup=db.suppliers.find(s=>s.id===supId);if(!sup)return;
  const x=(sup.purchases||[]).find(p=>p.id===pId);if(!x)return;
  sup.purchases.push({...x,id:uid(),date:localToday(),paid:0,payments:[],items:(x.items||[]).map(i=>({...i}))});
  saveDB(db);closeModal();viewSupplierDetails(supId);
}

function printSupplierPurchase(supId,pId){
  const sup=db.suppliers.find(s=>s.id===supId);if(!sup)return;
  const x=(sup.purchases||[]).find(p=>p.id===pId);if(!x)return;
  const remaining=(+x.total||0)-(+x.paid||0);
  const w=window.open('','_blank');
  if(!w){alert('المتصفح حجب نافذة الطباعة. اسمح بالنوافذ المنبثقة (Pop-ups) لهذا الموقع ثم أعد المحاولة.');return;}
  w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>سند سحب بضاعة</title>
  <style>body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#101828}h2{margin-bottom:2px}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #ccc;padding:8px;text-align:right;font-size:13px}th{background:#f1f3f6}.tot{margin-top:14px;font-size:14px}</style>
  </head><body>
  <h2>سند سحب بضاعة — ${esc(sup.name)}</h2>
  <div>التاريخ: ${fmtDate(x.date)} &nbsp; | &nbsp; الوجهة: ${esc(x.destination||'—')}</div>
  <table><thead><tr><th>الصنف</th><th>الكمية</th><th>ملاحظة</th><th>السعر</th><th>المدفوع</th><th>الباقي</th></tr></thead>
  <tbody>${x.items&&x.items.length?x.items.map(i=>{const ip=supItemPaid(x,i.id),ir=supItemRemaining(x,i);return `<tr><td>${esc(i.type||i.desc||'—')}${i.itemDesc?`<br><span style="font-size:11px;color:#667">${esc(i.itemDesc)}</span>`:''}</td><td>${i.qty||1}</td><td>${esc(i.note||'—')}</td><td>${fmt(i.price)}</td><td>${fmt(ip)}</td><td>${fmt(ir)}</td></tr>`;}).join(''):'<tr><td colspan="6">لا يوجد أصناف</td></tr>'}</tbody>
  </table>
  <div class="tot">الإجمالي: <b>${fmt(x.total)} ${curLabel(x.currency||'SYP')}</b> &nbsp; | &nbsp; المدفوع: <b>${fmt(x.paid)}</b> &nbsp; | &nbsp; الباقي: <b>${fmt(remaining)}</b></div>
  ${x.note?`<div style="margin-top:10px;font-size:12px">ملاحظة: ${esc(x.note)}</div>`:''}
  </body></html>`);
  w.document.close();w.focus();w.print();
}

function deleteSupPurchase(supId,pId){
  if(!guardDelete())return;
  if(!confirm('حذف هذه العملية؟'))return;
  const sup=db.suppliers.find(s=>s.id===supId);
  if(sup)sup.purchases=sup.purchases.filter(p=>p.id!==pId);
  logAction('حذف','عملية شراء',pId);saveDB(db);closeModal();renderSuppliers(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function openSupplierPurchaseModal(preId,editId){
  const sup=editId?db.suppliers.find(s=>s.id===preId):null;
  const existing=(editId&&sup)?(sup.purchases||[]).find(p=>p.id===editId):null;
  window._supItems=existing&&existing.items&&existing.items.length?existing.items.map(i=>({...i})):[{id:uid(),type:db.deviceTypes[0]||'Camera',qty:1,note:'',price:0}];
  showModal(`
    <div class="modal-title">${editId?'تعديل عملية سحب':'تسجيل سحب بضاعة'}</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">المورد</label><select class="form-control" id="sup-id" ${editId?'disabled':''}>${db.suppliers.map(s=>`<option value="${s.id}" ${preId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">تاريخ السحب</label><input type="date" class="form-control" id="sup-date" value="${existing?existing.date:localToday()}"></div>
    </div>
    <div class="form-group" style="margin-bottom:14px"><label class="form-label">الوجهة (بيع / ورشة / مخزن)</label><input type="text" class="form-control" id="sup-dest" value="${existing?esc(existing.destination||''):''}" placeholder="مثال: ورشة البنك مالكي، مبيع لزبون..."></div>
    <div style="font-weight:700;font-size:13px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">الأصناف المسحوبة <span style="font-weight:400;color:var(--text2);font-size:11px">— سعر كل صنف لحاله، وبتقدر تسدد كل صنف لحاله لاحقاً</span></div>
    <div id="sup-items">${renderSupItems()}</div>
    <button class="btn btn-sm" onclick="addSupItem()" style="margin-bottom:14px"><i class="ti ti-plus"></i> إضافة صنف</button>
    <div class="form-group" style="margin-bottom:14px;background:var(--bg2);border-radius:8px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-weight:600;font-size:13px">إجمالي العملية (مجموع أسعار الأصناف)</span>
      <span id="sup-total-display" style="font-weight:700;font-size:16px">${fmt(supItemsTotal())}</span>
    </div>
    <div class="form-group" style="margin-bottom:14px"><label class="form-label">عملة الفاتورة</label>${currencySelectHTML('sup-currency',existing?existing.currency:'SYP')}</div>
    <div class="form-group"><label class="form-label">ملاحظة</label><textarea class="form-control" id="sup-note" rows="2">${existing?esc(existing.note||''):''}</textarea></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveSupplierPurchase('${editId||''}')">حفظ</button></div>
  `);
}

function supItemsTotal(){return (window._supItems||[]).reduce((s,i)=>s+(+i.price||0),0);}

function refreshSupTotalDisplay(){const el=document.getElementById('sup-total-display');if(el)el.textContent=fmt(supItemsTotal());}

function renderSupItems(){
  return (window._supItems||[]).map((item,i)=>`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px">
      <div style="display:grid;grid-template-columns:2fr 70px 1fr 110px auto;gap:6px;align-items:center">
        <select class="form-control" onchange="window._supItems[${i}].type=this.value">${db.deviceTypes.map(t=>`<option ${item.type===t?'selected':''}>${esc(t)}</option>`).join('')}</select>
        <input type="number" class="form-control" placeholder="الكمية" value="${esc(item.qty||1)}" onchange="window._supItems[${i}].qty=this.value">
        <input type="text" inputmode="decimal" class="form-control" placeholder="سعر الصنف" value="${item.price?fmt(item.price):''}" oninput="formatMoneyInput(this)" onchange="window._supItems[${i}].price=unformatNum(this.value);refreshSupTotalDisplay()">
        <button class="btn btn-sm btn-danger" onclick="window._supItems.splice(${i},1);document.getElementById('sup-items').innerHTML=renderSupItems();refreshSupTotalDisplay()"><i class="ti ti-x"></i></button>
      </div>
      ${invLinkSelect('_supItems',i,item.itemId)}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px">
        <div><input type="text" class="form-control" id="sup-desc-${i}" list="sup-desc-list-${i}" placeholder="وصف المادة" value="${esc(item.itemDesc||'')}" onchange="window._supItems[${i}].itemDesc=this.value"><datalist id="sup-desc-list-${i}">${getItemNoteSuggestions(item.type).map(v=>`<option value="${esc(v)}">`).join('')}</datalist></div>
        <div><input type="text" class="form-control" list="sup-model-list-${i}" placeholder="Part Number" value="${esc(item.modelNumber||'')}" onchange="window._supItems[${i}].modelNumber=this.value;ensureModelNumberInList(this.value);autofillPartDesc(this.value,window._supItems,${i},'itemDesc','sup-desc-${i}')"><datalist id="sup-model-list-${i}">${(db.modelNumbers||[]).map(v=>`<option value="${esc(v)}">`).join('')}</datalist></div>
        <div><input type="text" class="form-control" placeholder="ملاحظة" value="${esc(item.note||'')}" onchange="window._supItems[${i}].note=this.value"></div>
      </div>
    </div>
  `).join('');
}

function addSupItem(){if(!window._supItems)window._supItems=[];const last=window._supItems[window._supItems.length-1];window._supItems.push({id:uid(),type:last?last.type:(db.deviceTypes[0]||'Camera'),qty:1,note:'',price:0});document.getElementById('sup-items').innerHTML=renderSupItems();refreshSupTotalDisplay();}

function openSupplierReturnModal(preId,editId){
  const sup=editId?db.suppliers.find(s=>s.id===preId):null;
  const existing=(editId&&sup)?(sup.purchases||[]).find(p=>p.id===editId):null;
  // بيتخزنوا هون بالقيم الموجبة (متل ما بتحكي فعلياً: "رجعت 3 كاميرات بـ50$")، وبنعكسهن لسالب وقت الحفظ فقط
  window._supItems=existing&&existing.items&&existing.items.length?existing.items.map(i=>({...i,price:Math.abs(+i.price||0)})):[{id:uid(),type:db.deviceTypes[0]||'Camera',qty:1,note:'',price:0}];
  showModal(`
    <div class="modal-title">${editId?'تعديل مرتجع':'تسجيل مرتجع بضاعة'}</div>
    <div style="font-size:12.5px;color:var(--text2);margin-bottom:12px;background:var(--bg2);padding:8px 10px;border-radius:8px">بتنخصم من الدين تلقائياً.</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">المورد</label><select class="form-control" id="sup-ret-id" ${editId?'disabled':''}>${db.suppliers.map(s=>`<option value="${s.id}" ${preId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">تاريخ الإرجاع</label><input type="date" class="form-control" id="sup-ret-date" value="${existing?existing.date:localToday()}"></div>
    </div>
    <div class="form-group" style="margin-bottom:14px"><label class="form-label">مرجّعة على أي فاتورة/عملية (اختياري)</label><input type="text" class="form-control" id="sup-ret-dest" value="${existing?esc((existing.destination||'').replace(/^مردودات\s*/,'')):''}" placeholder="مثال: رقم الفاتورة أو سبب الإرجاع"></div>
    <div style="font-weight:700;font-size:13px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">الأصناف المرتجعة <span style="font-weight:400;color:var(--text2);font-size:11px">— اكتب السعر متل ما اشتريتها بالضبط</span></div>
    <div id="sup-items">${renderSupItems()}</div>
    <button class="btn btn-sm" onclick="addSupItem()" style="margin-bottom:14px"><i class="ti ti-plus"></i> إضافة صنف</button>
    <div class="form-group" style="margin-bottom:14px;background:var(--bg2);border-radius:8px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-weight:600;font-size:13px">إجمالي قيمة المرتجع (بينخصم من الدين)</span>
      <span id="sup-total-display" style="font-weight:700;font-size:16px;color:var(--accent)">${fmt(supItemsTotal())}</span>
    </div>
    <div class="form-group" style="margin-bottom:14px"><label class="form-label">عملة العملية</label>${currencySelectHTML('sup-ret-currency',existing?existing.currency:'USD')}</div>
    <div class="form-group"><label class="form-label">ملاحظة</label><textarea class="form-control" id="sup-ret-note" rows="2">${existing?esc(existing.note||''):''}</textarea></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveSupplierReturn('${editId||''}')">حفظ المرتجع</button></div>
  `);
}

function saveSupplierReturn(editId){
  const supId=document.getElementById('sup-ret-id').value;
  const date=document.getElementById('sup-ret-date').value;
  const destRaw=document.getElementById('sup-ret-dest').value.trim();
  const destination='مردودات'+(destRaw?' '+destRaw:'');
  const currencyEl=document.getElementById('sup-ret-currency');
  const currency=currencyEl&&currencyEl.value==='USD'?'USD':'SYP';
  const note=document.getElementById('sup-ret-note').value;
  const items=(window._supItems||[]).map(i=>({...i,id:i.id||uid(),price:-Math.abs(+i.price||0)}));
  if(!items.length||items.every(i=>!(+i.price))){alert('أضف صنف واحد ع الأقل بسعر');return;}
  const total=items.reduce((s,i)=>s+(+i.price||0),0);
  const sup=db.suppliers.find(s=>s.id===supId);
  if(!sup)return;
  if(!sup.purchases)sup.purchases=[];
  if(editId){
    const idx=sup.purchases.findIndex(p=>p.id===editId);
    if(idx>=0){
      const prev=sup.purchases[idx];
      sup.purchases[idx]={...prev,date,destination,total,currency,note,items,isReturn:true};
    }
    logAction('تعديل','مرتجع مورد',sup.name);
    saveDB(db);closeModal();viewSupplierDetails(supId);
  }else{
    sup.purchases.push({id:uid(),date,destination,total,paid:0,currency,note,items,payments:[],isReturn:true});
    logAction('إضافة','مرتجع مورد',sup.name);
    saveDB(db);closeModal();renderSuppliers(document.getElementById('main-content'),document.getElementById('topbar-actions'));
  }
}

function saveSupplierPurchase(editId){
  const supId=document.getElementById('sup-id').value;
  const date=document.getElementById('sup-date').value;
  const destination=document.getElementById('sup-dest').value;
  const currencyEl=document.getElementById('sup-currency');
  const currency=currencyEl&&currencyEl.value==='USD'?'USD':'SYP';
  const note=document.getElementById('sup-note').value;
  const items=(window._supItems||[]).map(i=>({...i,id:i.id||uid(),price:+i.price||0}));
  const total=items.reduce((s,i)=>s+(+i.price||0),0);
  const sup=db.suppliers.find(s=>s.id===supId);
  if(!sup)return;
  if(!sup.purchases)sup.purchases=[];
  if(editId){
    const idx=sup.purchases.findIndex(p=>p.id===editId);
    if(idx>=0){
      const prev=sup.purchases[idx];
      sup.purchases[idx]={...prev,date,destination,total,currency,note,items};
    }
    saveDB(db);closeModal();viewSupplierDetails(supId);
  }else{
    sup.purchases.push({id:uid(),date,destination,total,paid:0,currency,note,items,payments:[]});
    saveDB(db);closeModal();renderSuppliers(document.getElementById('main-content'),document.getElementById('topbar-actions'));
  }
}

/* ===== استيراد كشف حساب مورد من ملف Excel =====
   يقبل ملف بنفس تنسيق "كشف حساب" التقليدي: مدين | دائن | البيان | التاريخ | الكمية | السعر | حركة الرصيد | رقم المادة
   - صفوف "مبيعات بالفاتورة ..." / "مردودات مبيعات بالفاتورة ..." تفتح عملية سحب/مرتجع جديدة (الأصناف تحتها تنضاف إلها).
   - صفوف فيها دائن بس ومالها علاقة بفاتورة (مثل "دفعة") بتنحسب دفعة على كامل الحساب.
   - صف "المجموع" وصف "رصيد ..." الأخير بينتجاهلوا.
   هاد الاستيراد بيصير فقط جوا بيانات *هالشركة* (نفس آلية db العادية) — ما بينحقن بكود التطبيق
   المشترك متل ما صار غلط قبل هيك مع مورد أحمد بكور. */
function openImportSupplierExcelModal(){
  showModal(`
    <div class="modal-title">استيراد كشف حساب مورد من Excel</div>
    <div style="font-size:12.5px;color:var(--text2);margin-bottom:14px;background:var(--bg2);padding:8px 10px;border-radius:8px">
      الملف لازم يكون بنفس ترتيب الأعمدة: مدين، دائن، البيان، التاريخ، الكمية، السعر، حركة الرصيد، رقم المادة.
      العمليات المستوردة بتنضاف لسجل هالمورد (ما بتمسح القديم).
    </div>
    <div class="form-group" style="margin-bottom:14px">
      <label class="form-label">المورد</label>
      <select class="form-control" id="imp-sup-id" onchange="document.getElementById('imp-sup-new-wrap').style.display=this.value==='__new__'?'block':'none'">
        ${db.suppliers.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}
        <option value="__new__">+ مورد جديد</option>
      </select>
    </div>
    <div class="form-group" id="imp-sup-new-wrap" style="margin-bottom:14px;display:${db.suppliers.length?'none':'block'}">
      <label class="form-label">اسم المورد الجديد</label>
      <input type="text" class="form-control" id="imp-sup-new-name" placeholder="مثال: أحمد بكور">
    </div>
    <div class="form-group" style="margin-bottom:14px">
      <label class="form-label">ملف Excel</label>
      <input type="file" class="form-control" id="imp-sup-file" accept=".xlsx,.xls">
    </div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="runImportSupplierExcel()">استيراد</button></div>
  `);
}

/* أسماء بديلة مقبولة لكل عمود — أي وحدة منها بتتطابق (بعد إزالة المسافات/التطبيع) */
const _SUP_IMPORT_HEADER_SYNONYMS={
  debit:['مدين'],
  credit:['دائن'],
  desc:['البيان','الوصف','التفاصيل','الصنف','اسم المادة','وصف المادة'],
  date:['التاريخ','تاريخ','تاريخ السحب','تاريخ العملية'],
  qty:['الكمية','كمية','العدد'],
  price:['السعر','سعر','سعر الوحدة','السعر الافرادي','سعر القطعة'],
  balance:['حركة الرصيد','الرصيد','رصيد'],
  code:['رقم المادة','الموديل','رقم الموديل','Part Number','part number','PartNumber','Part No','part no','الكود','رقم الصنف']
};
function _normHeaderCell(v){return String(v??'').trim().replace(/\s+/g,' ');}
/* بيدوّر بكل الشيتات عن صف عناوين فيه على الأقل عمودي "البيان" و(مدين أو دائن) —
   وبيرجع خريطة اسم-الحقل -> رقم العمود، مهما كان ترتيب الأعمدة أو اختلفت تسمية بعضها شوي */
function _findSupplierImportHeader(wb){
  for(const sheetName of wb.SheetNames){
    const ws=wb.Sheets[sheetName];
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true});
    for(let i=0;i<rows.length;i++){
      const r=rows[i]||[];
      const map={};
      r.forEach((cell,ci)=>{
        const norm=_normHeaderCell(cell);
        if(!norm)return;
        for(const field in _SUP_IMPORT_HEADER_SYNONYMS){
          if(map[field]!=null)continue;
          if(_SUP_IMPORT_HEADER_SYNONYMS[field].some(syn=>norm===syn||norm.indexOf(syn)===0)){
            map[field]=ci;
          }
        }
      });
      if(map.desc!=null && (map.debit!=null||map.credit!=null)){
        return {sheetName,rows,headerIdx:i,map};
      }
    }
  }
  return null;
}
/* بيقبل: Date جاهز، رقم تسلسلي إكسل، أو نص بصيغ شائعة (يوم-شهر-سنة / يوم/شهر/سنة / سنة-شهر-يوم) */
function _parseFlexibleDate(v){
  if(v instanceof Date && !isNaN(v))return v.toISOString().slice(0,10);
  if(typeof v==='number' && v>0){
    const d=XLSX.SSF?XLSX.SSF.parse_date_code(v):null;
    if(d)return new Date(Date.UTC(d.y,d.m-1,d.d)).toISOString().slice(0,10);
  }
  if(typeof v==='string'){
    const s=v.trim();
    let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // 2026-02-23
    if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    m=s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/); // 23-02-2026 أو 23/02/2026
    if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    const d=new Date(s);
    if(!isNaN(d))return d.toISOString().slice(0,10);
  }
  return null;
}
function _numOrZero(v){
  if(v==null||v==='')return 0;
  const n=+String(v).replace(/,/g,'');
  return isNaN(n)?0:n;
}
const _SUP_IMPORT_PAYMENT_KEYWORDS=['دفعة','دفعه','تسديد','سداد','تحويل','استلمنا','دفع'];
const _SUP_IMPORT_TOTAL_KEYWORDS=['المجموع','الاجمالي','الإجمالي'];

async function runImportSupplierExcel(){
  const fileInput=document.getElementById('imp-sup-file');
  const file=fileInput&&fileInput.files[0];
  if(!file){alert('اختار ملف Excel أولاً');return;}
  let supId=document.getElementById('imp-sup-id').value;
  if(supId==='__new__'){
    const name=(document.getElementById('imp-sup-new-name').value||'').trim();
    if(!name){alert('اكتب اسم المورد الجديد');return;}
    const newSup={id:uid(),name,phone:'',purchases:[],accountPayments:[]};
    db.suppliers.push(newSup);
    supId=newSup.id;
  }
  const sup=db.suppliers.find(s=>s.id===supId);
  if(!sup){alert('تعذر إيجاد المورد');return;}
  try{await loadLibOrWarn('xlsx','استيراد بيانات المورد');}catch(e){return;}

  const buf=await file.arrayBuffer();
  const wb=XLSX.read(buf,{type:'array',cellDates:true});

  const found=_findSupplierImportHeader(wb);
  if(!found){
    alert('ما قدرت لاقي صف عناوين فيه "البيان" وعمود "مدين" أو "دائن" بأي شيت من الملف. تأكد إنو أسماء الأعمدة موجودة بنفس الصف (حتى لو الترتيب مختلف).');
    return;
  }
  const {rows,headerIdx,map}=found;
  const startIdx=headerIdx+1;
  const missing=[];
  if(map.debit==null&&map.credit==null)missing.push('مدين/دائن');
  if(map.desc==null)missing.push('البيان');
  if(missing.length){alert('ناقص أعمدة أساسية بالملف: '+missing.join('، '));return;}

  if(!sup.purchases)sup.purchases=[];
  if(!sup.accountPayments)sup.accountPayments=[];

  // منشان ما نكرر استيراد نفس الفاتورة/الدفعة لو الملف انرفع أكتر من مرة (أو فيه تداخل مع بيانات سابقة)
  const existingInvoiceSigs=new Set(sup.purchases.map(p=>_normHeaderCell(p.destination)));
  const existingPaymentSigs=new Set(sup.accountPayments.map(p=>`${p.date}|${_numOrZero(p.amount)}|${_normHeaderCell(p.note)}`));

  let currentGroup=null;
  let importedInvoices=0,importedPayments=0,importedItems=0,skippedRows=0,skippedInvoices=0,skippedPayments=0;

  function flushGroup(){
    if(!currentGroup)return;
    if(currentGroup.items.length){
      const sig=_normHeaderCell(currentGroup.label);
      if(existingInvoiceSigs.has(sig)){
        skippedInvoices++;
      }else{
        const total=currentGroup.items.reduce((s,it)=>s+(+it.price||0),0);
        sup.purchases.push({
          id:uid(),
          date:currentGroup.date||localToday(),
          destination:currentGroup.label,
          total,paid:0,currency:'USD',
          note:'مستورد من Excel',
          items:currentGroup.items,
          payments:[],
          isReturn:currentGroup.isReturn
        });
        existingInvoiceSigs.add(sig);
        importedInvoices++;
      }
    }
    currentGroup=null;
  }

  for(let i=startIdx;i<rows.length;i++){
    const r=rows[i]||[];
    const debit=_numOrZero(map.debit!=null?r[map.debit]:null);
    const credit=_numOrZero(map.credit!=null?r[map.credit]:null);
    const desc=_normHeaderCell(map.desc!=null?r[map.desc]:'');
    const rawQty=map.qty!=null?r[map.qty]:null;
    const rawCode=map.code!=null?r[map.code]:null;
    const rawDate=map.date!=null?r[map.date]:null;

    if(!desc && !debit && !credit){continue;} // صف فاضي
    const descNorm=desc.replace(/\s+/g,'');
    if(_SUP_IMPORT_TOTAL_KEYWORDS.some(k=>descNorm.indexOf(k)===0) || descNorm.indexOf('رصيد')===0){continue;} // صفوف المجموع/الرصيد النهائي

    const qty=rawQty!=null&&rawQty!==''?_numOrZero(rawQty):null;
    const code=rawCode!=null?String(rawCode).trim():'';
    const looksLikeInvoiceHeader=/فاتورة/.test(desc) && !qty && !code;
    if(looksLikeInvoiceHeader){
      flushGroup();
      currentGroup={isReturn:/مردود/.test(desc),label:desc,items:[],date:null};
      continue;
    }

    const isItemRow = currentGroup && (qty!=null || code);
    if(isItemRow){
      const date=_parseFlexibleDate(rawDate)||currentGroup.date||localToday();
      if(!currentGroup.date)currentGroup.date=date;
      const lineTotal=currentGroup.isReturn?-Math.abs(credit||debit||0):Math.abs(debit||0);
      currentGroup.items.push({
        id:uid(),
        type:(db.deviceTypes&&db.deviceTypes[0])||'Camera',
        qty:qty||1,
        price:lineTotal,
        itemDesc:desc,
        modelNumber:code,
        note:''
      });
      importedItems++;
      continue;
    }

    // مو صف فاتورة ومو صف صنف تحت فاتورة
    if(credit>0){
      const pDate=_parseFlexibleDate(rawDate)||localToday();
      const pNote=desc||'دفعة (مستوردة من Excel)';
      const sig=`${pDate}|${credit}|${_normHeaderCell(pNote)}`;
      if(existingPaymentSigs.has(sig)){
        skippedPayments++;
      }else{
        sup.accountPayments.push({
          id:uid(),
          amount:credit,
          currency:'USD',
          date:pDate,
          note:pNote
        });
        existingPaymentSigs.add(sig);
        importedPayments++;
      }
    }else{
      skippedRows++;
    }
  }
  flushGroup();

  saveDB(db);
  closeModal();
  let msg=`تم الاستيراد: ${importedInvoices} فاتورة/مرتجع جديد (${importedItems} صنف) و ${importedPayments} دفعة جديدة.`;
  if(skippedInvoices||skippedPayments)msg+=`\nتم تجاهل ${skippedInvoices} فاتورة و${skippedPayments} دفعة موجودين مسبقاً (تجنّب تكرار).`;
  if(skippedRows)msg+=`\nتم تجاهل ${skippedRows} صف ما قدرت أفهم نوعه (راجعها يدوياً لو في شي ناقص).`;
  alert(msg);
  renderSuppliers(document.getElementById('main-content'),document.getElementById('topbar-actions'));
  logAction('استيراد Excel','مورد',`${esc(sup.name)} — ${importedInvoices} فاتورة، ${importedPayments} دفعة`);
}
