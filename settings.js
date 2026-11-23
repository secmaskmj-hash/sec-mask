/* settings.js — يتحمّل عند فتح: إدارة القوائم (يعتمد على ops.js) */
function renderSettings(el,acts){
  const tab=window._stab||'workTypes';
  const tabs=[
    {id:'workTypes',       label:'أنواع العمل',        icon:'ti-tool'},
    {id:'deviceTypes',     label:'أنواع الأجهزة',    icon:'ti-device-desktop'},
    {id:'modelNumbers',    label:'Part Numbers',   icon:'ti-barcode'},
    {id:'expenseTypes',    label:'مصاريف الورشة',     icon:'ti-receipt'},
    {id:'generalExpenseTypes', label:'المصاريف العامة', icon:'ti-receipt-2'},
    {id:'toolTypes',       label:'أنواع العدة',        icon:'ti-tools'},
    {id:'carExpenseTypes', label:'مصاريف السيارات',   icon:'ti-car'},
    {id:'projects',        label:'المشاريع',          icon:'ti-briefcase'},
    {id:'workers',         label:'العمال',            icon:'ti-users'},
    {id:'suppliers',       label:'الموردون',          icon:'ti-building-store'},
    {id:'cars',            label:'السيارات',          icon:'ti-car'},
    {id:'branches',        label:'الزبائن والفروع',   icon:'ti-building'},
    {id:'company',         label:'بيانات الشركة',     icon:'ti-building'},
    {id:'users',           label:'المستخدمون والصلاحيات', icon:'ti-user-shield'},
    {id:'danger',          label:'البيانات',          icon:'ti-database'},
  ];
  el.innerHTML=`
  <div style="max-width:860px;margin:0 auto">
    <div style="margin-bottom:22px">
      <div style="font-size:22px;font-weight:800;color:var(--text);margin-bottom:4px">الإعدادات والقوائم</div>
      <div style="font-size:13px;color:var(--text2)">إدارة القوائم</div>
    </div>

    <!-- TAB BAR -->
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:22px">
      ${tabs.map(t=>`
        <button onclick="window._stab='${t.id}';renderSettings(document.getElementById('main-content'),document.getElementById('topbar-actions'))"
          style="display:inline-flex;align-items:center;gap:7px;padding:9px 18px;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all .15s;
          background:${tab===t.id?'var(--accent)':'var(--bg)'};
          color:${tab===t.id?'white':'var(--text2)'};
          box-shadow:${tab===t.id?'0 2px 8px rgba(29,158,117,.3)':'0 1px 3px rgba(0,0,0,.08)'};
          font-family:inherit">
          <i class="ti ${t.icon}" style="font-size:16px"></i>${esc(t.label)}
        </button>`).join('')}
    </div>

    <!-- TAB CONTENT -->
    <div id="settings-tab-content">
      ${renderSettingsTab(tab)}
    </div>
  </div>`;
  if(tab==='danger')setTimeout(loadSnapshotsList,30);
}

function renderSettingsTab(tab){
  if(tab==='workTypes')       return renderSettingsWorkTypes();
  if(tab==='deviceTypes')     return renderSettingsDeviceTypes();
  if(tab==='modelNumbers')    return renderSettingsModelNumbers();
  if(tab==='expenseTypes')    return renderSettingsExpenseTypes();
  if(tab==='generalExpenseTypes') return renderSettingsGeneralExpenseTypes();
  if(tab==='toolTypes')       return renderSettingsToolTypes();
  if(tab==='carExpenseTypes') return renderSettingsCarExpenseTypes();
  if(tab==='projects')        return renderSettingsProjects();
  if(tab==='workers')         return renderSettingsWorkers();
  if(tab==='suppliers')       return renderSettingsSuppliers();
  if(tab==='cars')            return renderSettingsCars();
  if(tab==='branches')        return renderSettingsBranches();
  if(tab==='company')         return renderSettingsCompany();
  if(tab==='users')           return renderSettingsUsers();
  if(tab==='danger')          return renderSettingsDanger();
  return '';
}

function sTagItem(label, deleteFn, colorVar){
  const bg   = colorVar==='accent' ? 'var(--accent-light)' : 'var(--bg2)';
  const col  = colorVar==='accent' ? 'var(--accent-dark)'  : 'var(--text)';
  const bord = colorVar==='accent' ? 'var(--accent)'       : 'var(--border)';
  return `<div style="display:inline-flex;align-items:center;gap:7px;padding:7px 14px;background:${bg};border:1.5px solid ${bord};border-radius:24px;font-size:13px;font-weight:600;color:${col};margin:4px">
    ${esc(label)}
    <span onclick="${deleteFn}" style="cursor:pointer;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(220,38,38,.12);color:var(--danger);font-size:15px;line-height:1;font-weight:700;flex-shrink:0" title="حذف">×</span>
  </div>`;
}

function sAddBar(placeholder, addFn, inputId){
  return `<div style="display:flex;gap:10px;margin-bottom:18px;align-items:center">
    <input type="text" id="${inputId}" class="form-control" placeholder="${placeholder}"
      style="flex:1;max-width:340px"
      onkeydown="if(event.key==='Enter'){${addFn}();event.preventDefault()}">
    <button class="btn btn-primary" onclick="${addFn}()"><i class="ti ti-plus"></i> إضافة</button>
  </div>`;
}

function sCard(title, subtitle, body){
  return `<div class="card">
    <div style="margin-bottom:18px">
      <div style="font-size:16px;font-weight:700;color:var(--text)">${title}</div>
      <div style="font-size:12px;color:var(--text2);margin-top:3px">${subtitle}</div>
    </div>
    ${body}
  </div>`;
}

function renderSettingsWorkTypes(){
  const items=(db.workTypes||[]).map((t,i)=>sTagItem(t,`deleteWorkType(${i})`,'accent')).join('');
  return sCard(
    'أنواع العمل',
    'إدارة الخيارات المتاحة في القوائم',
    sAddBar('أضف عنصراً جديداً...','saveNewWorkType','new-work-type') +
    `<div style="display:flex;flex-wrap:wrap;min-height:46px">${items||'<span style="font-size:12px;color:var(--text3);padding:8px">لا يوجد عناصر</span>'}</div>`
  );
}

function renderSettingsDeviceTypes(){
  const items=(db.deviceTypes||[]).map((t,i)=>sTagItem(t,`deleteDeviceType(${i})`,'neutral')).join('');
  const sel=(t,i)=>{const cur=deviceTypeDept(t)||'shared';return `<select class="form-control" style="width:auto;min-width:140px;padding:3px 8px;font-size:12px" onchange="setDeviceTypeDept(${i},this.value)"><option value="security" ${cur==='security'?'selected':''}>${esc(DEPT_LABELS.security)}</option><option value="network" ${cur==='network'?'selected':''}>${esc(DEPT_LABELS.network)}</option><option value="shared" ${cur==='shared'?'selected':''}>مشترك (بتختار بكل بند)</option></select>`;};
  return sCard(
    'أنواع الأجهزة',
    'الأصناف المتاحة عند إدخال المبيعات والسحب من الموردين',
    sAddBar('أضف صنف جديد...','saveNewDeviceType','new-device-type') +
    `<div style="display:flex;flex-wrap:wrap;min-height:46px">${items||'<span style="font-size:12px;color:var(--text3);padding:8px">لا يوجد أصناف</span>'}</div>
    <div class="section-title" style="margin-top:18px">قسم كل صنف بالمبيعات <span style="font-weight:400;color:var(--text2);font-size:11px">(التصنيف المقترح — القسم بيتحدد لكل بند بالفاتورة، وهاد بس الافتراضي)</span></div>
    <div style="overflow-x:auto"><table><thead><tr><th>الصنف</th><th>القسم الافتراضي</th></tr></thead><tbody>${(db.deviceTypes||[]).map((t,i)=>`<tr><td style="font-weight:600">${esc(t)}</td><td>${sel(t,i)}</td></tr>`).join('')}</tbody></table></div>
    <div style="font-size:11px;color:var(--text2);margin-top:8px">فواتير قديمة بدون قسم صريح بتنحسب حسب هالتصنيف، والصنف "مشترك" بدون اختيار بالبند بيظهر "غير مصنّف". تغيير التصنيف هون بيغيّر توزيع الفواتير القديمة بالتقارير (مو أرقامها الكلية).</div>`
  );
}
function setDeviceTypeDept(i,v){
  const t=(db.deviceTypes||[])[i];if(t===undefined)return;
  if(!db.deviceDepts||typeof db.deviceDepts!=='object')db.deviceDepts={};
  if(v==='security'||v==='network'||v==='shared')db.deviceDepts[t]=v;
  saveDB(db);
}

function renderSettingsModelNumbers(){
  if(!db.modelNumbers)db.modelNumbers=defaultData.modelNumbers;
  const items=(db.modelNumbers||[]).map((t,i)=>sTagItem(t,`deleteModelNumber(${i})`,'neutral')).join('');
  return sCard(
    'Part Numbers',
    'قائمة الـ Part Number المتاحة عند إدخال المادة بالموردين والمبيعات وعروض الأسعار — تنضاف تلقائياً كمان لما تكتب رقم جديد بأي نموذج',
    sAddBar('أضف Part Number جديد...','saveNewModelNumber','new-model-number') +
    `<div style="display:flex;flex-wrap:wrap;min-height:46px">${items||'<span style="font-size:12px;color:var(--text3);padding:8px">لا يوجد أرقام</span>'}</div>`
  );
}

function renderSettingsExpenseTypes(){
  if(!db.expenseTypes)db.expenseTypes=defaultData.expenseTypes;
  const items=(db.expenseTypes||[]).map((t,i)=>sTagItem(t,`deleteExpenseType(${i})`,'neutral')).join('');
  return sCard(
    'أنواع المصاريف',
    'الفئات المتاحة عند تسجيل مصاريف الورشات',
    sAddBar('أضف نوع مصروف جديد...','saveNewExpenseType','new-expense-type') +
    `<div style="display:flex;flex-wrap:wrap;min-height:46px">${items||'<span style="font-size:12px;color:var(--text3);padding:8px">لا يوجد أنواع</span>'}</div>`
  );
}

function saveNewExpenseType(){
  const inp=document.getElementById('new-expense-type');if(!inp)return;
  const val=inp.value.trim();
  if(!val){alert('يرجى إدخال نوع المصروف');return;}
  if(!db.expenseTypes)db.expenseTypes=[];
  if(db.expenseTypes.includes(val)){alert('هذا النوع موجود مسبقاً');return;}
  db.expenseTypes.push(val);
  saveDB(db);inp.value='';refreshSettingsTab();
}

function deleteExpenseType(idx){
  if(!guardDelete())return;
  const t=db.expenseTypes[idx];
  if(!confirm(`حذف نوع "${t}"؟`))return;
  db.expenseTypes.splice(idx,1);
  logAction('حذف','نوع مصروف',t);saveDB(db);refreshSettingsTab();
}

function renderSettingsGeneralExpenseTypes(){
  if(!db.generalExpenseTypes)db.generalExpenseTypes=defaultData.generalExpenseTypes;
  const items=(db.generalExpenseTypes||[]).map((t,i)=>sTagItem(t,`deleteGeneralExpenseType(${i})`,'neutral')).join('');
  return sCard(
    'أنواع المصاريف العامة',
    'الفئات المتاحة عند إضافة مصروف عام (صفحة المصاريف العامة) — يمكن إضافة وحذف أي نوع لمرونة أكبر بالتعديل',
    sAddBar('أضف نوع مصروف عام جديد...','saveNewGeneralExpenseType','new-general-expense-type') +
    `<div style="display:flex;flex-wrap:wrap;min-height:46px">${items||'<span style="font-size:12px;color:var(--text3);padding:8px">لا يوجد أنواع</span>'}</div>`
  );
}

function saveNewGeneralExpenseType(){
  const inp=document.getElementById('new-general-expense-type');if(!inp)return;
  const val=inp.value.trim();
  if(!val){alert('يرجى إدخال نوع المصروف العام');return;}
  if(!db.generalExpenseTypes)db.generalExpenseTypes=[];
  if(db.generalExpenseTypes.includes(val)){alert('هذا النوع موجود مسبقاً');return;}
  db.generalExpenseTypes.push(val);
  logAction('إضافة','نوع مصروف عام',val);
  saveDB(db);inp.value='';refreshSettingsTab();
}

function deleteGeneralExpenseType(idx){
  if(!guardDelete())return;
  const t=db.generalExpenseTypes[idx];
  if(!confirm(`حذف نوع "${t}"؟`))return;
  db.generalExpenseTypes.splice(idx,1);
  logAction('حذف','نوع مصروف عام',t);saveDB(db);refreshSettingsTab();
}

function renderSettingsToolTypes(){
  if(!db.toolTypes)db.toolTypes=defaultData.toolTypes;
  const items=(db.toolTypes||[]).map((t,i)=>sTagItem(t,`deleteToolType(${i})`,'accent')).join('');
  return sCard(
    'أنواع العدة',
    'الأصناف المتاحة عند إضافة عدة جديدة — يمكن إضافة وحذف أي نوع',
    sAddBar('أضف نوع عدة جديد...','saveNewToolType','new-tool-type') +
    `<div style="display:flex;flex-wrap:wrap;min-height:46px">${items||'<span style="font-size:12px;color:var(--text3);padding:8px">لا يوجد أنواع</span>'}</div>`
  );
}

function saveNewToolType(){
  const inp=document.getElementById('new-tool-type');if(!inp)return;
  const val=inp.value.trim();
  if(!val){alert('يرجى إدخال نوع العدة');return;}
  if(!db.toolTypes)db.toolTypes=[];
  if(db.toolTypes.includes(val)){alert('هذا النوع موجود مسبقاً');return;}
  db.toolTypes.push(val);
  saveDB(db);inp.value='';refreshSettingsTab();
}

function deleteToolType(idx){
  if(!guardDelete())return;
  const t=db.toolTypes[idx];
  if(!confirm(`حذف نوع "${t}"؟`))return;
  db.toolTypes.splice(idx,1);
  logAction('حذف','نوع عدة',t);saveDB(db);refreshSettingsTab();
}

function renderSettingsCarExpenseTypes(){
  if(!db.carExpenseTypes)db.carExpenseTypes=defaultData.carExpenseTypes;
  const items=(db.carExpenseTypes||[]).map((t,i)=>sTagItem(t,`deleteCarExpenseType(${i})`,'neutral')).join('');
  return sCard(
    'مصاريف السيارات',
    'أنواع المصاريف المتاحة عند تسجيل مصروف سيارة — بنزين، صيانة، إطارات...',
    sAddBar('أضف نوع مصروف جديد...','saveNewCarExpenseType','new-car-expense-type') +
    `<div style="display:flex;flex-wrap:wrap;min-height:46px">${items||'<span style="font-size:12px;color:var(--text3);padding:8px">لا يوجد أنواع</span>'}</div>`
  );
}

function saveNewCarExpenseType(){
  const inp=document.getElementById('new-car-expense-type');if(!inp)return;
  const val=inp.value.trim();
  if(!val){alert('يرجى إدخال نوع المصروف');return;}
  if(!db.carExpenseTypes)db.carExpenseTypes=[];
  if(db.carExpenseTypes.includes(val)){alert('هذا النوع موجود مسبقاً');return;}
  db.carExpenseTypes.push(val);
  saveDB(db);inp.value='';refreshSettingsTab();
}

function deleteCarExpenseType(idx){
  if(!guardDelete())return;
  const t=db.carExpenseTypes[idx];
  if(!confirm(`حذف نوع "${t}"؟`))return;
  db.carExpenseTypes.splice(idx,1);
  logAction('حذف','نوع مصروف سيارة',t);saveDB(db);refreshSettingsTab();
}

function renderSettingsProjects(){
  if(!db.projects)db.projects=[];
  const items=(db.projects||[]).map((p,i)=>sTagItem(p.name,`deleteProject(${i})`,'neutral')).join('');
  return sCard(
    'المشاريع',
    'لائحة موحّدة بأسماء المشاريع تُستخدم عند تسجيل مصاريف السيارات وتوزيع العمال، حتى تقدر تجمع كلفة كل مشروع لاحقاً بتقرير "تكلفة المشاريع".',
    sAddBar('أضف اسم مشروع جديد...','saveNewProject','new-project-name') +
    `<div style="display:flex;flex-wrap:wrap;min-height:46px">${items||'<span style="font-size:12px;color:var(--text3);padding:8px">لا يوجد مشاريع بعد</span>'}</div>`
  );
}

function normalizeProjectName(s){return (s||'').trim().replace(/\s+/g,' ').toLowerCase();}

function levenshteinDist(a,b){
  const m=a.length,n=b.length;
  const dp=Array.from({length:m+1},()=>new Array(n+1).fill(0));
  for(let i=0;i<=m;i++)dp[i][0]=i;
  for(let j=0;j<=n;j++)dp[0][j]=j;
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++){
    dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  }
  return dp[m][n];
}

function saveNewProject(){
  const inp=document.getElementById('new-project-name');if(!inp)return;
  const val=inp.value.trim();
  if(!val){alert('يرجى إدخال اسم المشروع');return;}
  if(!db.projects)db.projects=[];
  const normVal=normalizeProjectName(val);
  if(db.projects.some(p=>normalizeProjectName(p.name)===normVal)){alert('هذا المشروع موجود مسبقاً (أو نفس الاسم مع فراغات/حروف مختلفة بالحالة فقط)');return;}
  // تحذير لو الاسم قريب جداً من مشروع موجود (فرق حرف أو حرفين)، بدل السماح المباشر
  const similar=db.projects.find(p=>{
    const n=normalizeProjectName(p.name);
    const maxLen=Math.max(n.length,normVal.length);
    if(!maxLen)return false;
    return levenshteinDist(n,normVal)<=2 && maxLen>3;
  });
  if(similar){
    if(!confirm(`⚠️ اسم المشروع "${val}" قريب جداً من مشروع موجود مسبقاً: "${esc(similar.name)}".\nهل أنت متأكد إنه مشروع مختلف فعلاً، وما بدك تستخدم المشروع الموجود بدلاً من إنشاء واحد جديد؟`))return;
  }
  db.projects.push({id:uid(),name:val,status:'جارية',createdDate:localToday(),notes:'',quoteId:'',saleId:'',maintId:'',clientId:''});
  saveDB(db);inp.value='';refreshSettingsTab();
}

function deleteProject(idx){
  if(!guardDelete())return;
  const t=db.projects[idx];
  if(!confirm(`حذف مشروع "${esc(t.name)}"؟ (هذا لا يحذف السجلات المرتبطة فيه، فقط من القائمة)`))return;
  db.projects.splice(idx,1);
  logAction('حذف','مشروع',t.name);saveDB(db);refreshSettingsTab();
}

function renderSettingsWorkers(){
  if(!canViewWorkerNames())return salaryLockedHTML('أسماء العمال');
  const rows=(db.workers||[]).map(w=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 14px;border-radius:12px;border:1px solid var(--border);margin-bottom:7px;background:var(--bg2);transition:box-shadow .15s"
         onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,.08)'" onmouseout="this.style.boxShadow=''">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:34px;height:34px;background:var(--accent);color:white;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0">
          ${esc(w.name.charAt(0).toUpperCase())}
        </div>
        <div>
          <div style="font-weight:700;font-size:14px">${esc(w.name)}</div>
          <div style="font-size:11px;color:var(--text2)">${db.maintenance.filter(m=>m.workers&&m.workers.some(mw=>mw.workerId===w.id&&!mw.wageOnly)).length} أعمال مسجلة ${w.phone?`· هاتف: ${esc(w.phone)}`:''}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm" onclick="openEditWorkerModal('${w.id}')"><i class="ti ti-edit"></i> تعديل</button>
        <button class="btn btn-sm btn-danger" onclick="deleteWorkerSetting('${w.id}')"><i class="ti ti-trash"></i></button>
      </div>
    </div>`).join('');
  return sCard(
    'العمال',
    'إضافة وتعديل وحذف العمال المسجلين في النظام',
    sAddBar('اسم العامل الجديد...','saveInlineWorker','inline-worker-name') +
    `<div>${rows||'<div class="empty-state" style="padding:30px"><i class="ti ti-users"></i><p>لا يوجد عمال</p></div>'}</div>`
  );
}

function saveInlineWorker(){
  if(!requirePerm('names'))return;
  const inp=document.getElementById('inline-worker-name');
  if(!inp)return;
  const name=inp.value.trim();
  if(!name){alert('يرجى إدخال الاسم');return;}
  db.workers.push({id:uid(),name,phone:''});
  saveDB(db);inp.value='';
  refreshSettingsTab();
}

function renderSettingsSuppliers(){
  const rows=(db.suppliers||[]).map(sup=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 14px;border-radius:12px;border:1px solid var(--border);margin-bottom:7px;background:var(--bg2)">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:34px;height:34px;background:var(--info-bg);color:var(--info);border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0">
          ${esc(sup.name.charAt(0))}
        </div>
        <div>
          <div style="font-weight:700;font-size:14px">${esc(sup.name)}</div>
          <div style="font-size:11px;color:var(--text2)">${(sup.purchases||[]).length} عملية شراء ${sup.phone?`· هاتف: ${esc(sup.phone)}`:''}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm" onclick="openEditSupplierModal('${sup.id}')"><i class="ti ti-edit"></i> تعديل</button>
        <button class="btn btn-sm btn-danger" onclick="deleteSupplierSetting('${sup.id}')"><i class="ti ti-trash"></i></button>
      </div>
    </div>`).join('');
  return sCard(
    'الموردون',
    'إضافة وتعديل وحذف الموردين',
    sAddBar('اسم المورد الجديد...','saveInlineSupplier','inline-supplier-name') +
    `<div>${rows||'<div class="empty-state" style="padding:30px"><i class="ti ti-building-store"></i><p>لا يوجد موردون</p></div>'}</div>`
  );
}

function saveInlineSupplier(){
  const inp=document.getElementById('inline-supplier-name');
  if(!inp)return;
  const name=inp.value.trim();
  if(!name){alert('يرجى إدخال الاسم');return;}
  db.suppliers.push({id:uid(),name,phone:'',purchases:[]});
  saveDB(db);inp.value='';
  refreshSettingsTab();
}

function openEditSupplierModal(supId){
  const sup=db.suppliers.find(x=>x.id===supId);if(!sup)return;
  showModal(`
    <div class="modal-title">تعديل المورد</div>
    <div class="form-row cols-2" style="margin-bottom:18px">
      <div class="form-group"><label class="form-label">الاسم</label><input type="text" class="form-control" id="edit-sup-name" value="${esc(sup.name)}"></div>
      <div class="form-group"><label class="form-label">رقم الهاتف</label><input type="tel" class="form-control" id="edit-sup-phone" value="${esc(sup.phone||'')}" dir="ltr" style="text-align:left"></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveEditSupplier('${supId}')">حفظ</button>
    </div>
  `);
  setTimeout(()=>{const el=document.getElementById('edit-sup-name');if(el)el.focus();},80);
}

function saveEditSupplier(supId){
  const name=document.getElementById('edit-sup-name').value.trim();
  const phone=document.getElementById('edit-sup-phone')?document.getElementById('edit-sup-phone').value.trim():'';
  if(!name){alert('يرجى إدخال الاسم');return;}
  const sup=db.suppliers.find(x=>x.id===supId);
  if(sup){sup.name=name;sup.phone=phone;}
  saveDB(db);closeModal();refreshSettingsTab();
}

function deleteSupplierSetting(supId){
  if(!guardDelete())return;
  const sup=db.suppliers.find(x=>x.id===supId);if(!sup)return;
  if(!confirm(`حذف المورد "${esc(sup.name)}" نهائياً؟\nسيتم حذف جميع سجلات الشراء المرتبطة به.`))return;
  db.suppliers=db.suppliers.filter(x=>x.id!==supId);
  logAction('حذف','مورد',sup.name);saveDB(db);refreshSettingsTab();
}

function renderSettingsCars(){
  const rows=(db.cars||[]).map(c=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 14px;border-radius:12px;border:1px solid var(--border);margin-bottom:7px;background:var(--bg2)">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:34px;height:34px;background:var(--gold-light);color:var(--gold-dark);border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0">
          ${esc(c.name.charAt(0))}
        </div>
        <div>
          <div style="font-weight:700;font-size:14px">${esc(c.name)} ${c.plate?`<span style="font-weight:500;color:var(--text2);font-size:12px">— ${esc(c.plate)}</span>`:''}</div>
          <div style="font-size:11px;color:var(--text2)">${(c.expenses||[]).length} مصروف مسجل ${c.project?`· المشروع الحالي: ${esc(c.project)}`:''}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm" onclick="openEditCarModal('${c.id}')"><i class="ti ti-edit"></i> تعديل</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCarSetting('${c.id}')"><i class="ti ti-trash"></i></button>
      </div>
    </div>`).join('');
  return sCard(
    'السيارات',
    'إضافة وتعديل وحذف السيارات المسجلة في النظام',
    sAddBar('اسم السيارة الجديدة...','saveInlineCar','inline-car-name') +
    `<div>${rows||'<div class="empty-state" style="padding:30px"><i class="ti ti-car"></i><p>لا يوجد سيارات</p></div>'}</div>`
  );
}

function saveInlineCar(){
  const inp=document.getElementById('inline-car-name');
  if(!inp)return;
  const name=inp.value.trim();
  if(!name){alert('يرجى إدخال اسم السيارة');return;}
  db.cars.push({id:uid(),name,plate:'',project:'',notes:'',moveFrom:'',moveTo:'',moveDate:'',moveNotes:'',expenses:[]});
  saveDB(db);inp.value='';
  refreshSettingsTab();
}

function openEditCarModal(carId){
  const c=db.cars.find(x=>x.id===carId);if(!c)return;
  showModal(`
    <div class="modal-title">تعديل السيارة</div>
    <div class="form-row cols-2" style="margin-bottom:18px">
      <div class="form-group"><label class="form-label">اسم السيارة</label><input type="text" class="form-control" id="edit-car-name" value="${esc(c.name)}"></div>
      <div class="form-group"><label class="form-label">النمرة</label><input type="text" class="form-control" id="edit-car-plate" value="${esc(c.plate||'')}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveEditCar('${carId}')">حفظ</button>
    </div>
  `);
  setTimeout(()=>{const el=document.getElementById('edit-car-name');if(el)el.focus();},80);
}

function saveEditCar(carId){
  const name=document.getElementById('edit-car-name').value.trim();
  const plate=document.getElementById('edit-car-plate')?document.getElementById('edit-car-plate').value.trim():'';
  if(!name){alert('يرجى إدخال اسم السيارة');return;}
  const c=db.cars.find(x=>x.id===carId);
  if(c){c.name=name;c.plate=plate;}
  saveDB(db);closeModal();refreshSettingsTab();
}

function deleteCarSetting(carId){
  if(!guardDelete())return;
  const c=db.cars.find(x=>x.id===carId);if(!c)return;
  if(!confirm(`حذف السيارة "${esc(c.name)}" نهائياً؟\nسيتم حذف جميع المصاريف المرتبطة بها.`))return;
  db.cars=db.cars.filter(x=>x.id!==carId);
  logAction('حذف','سيارة',c.name);saveDB(db);refreshSettingsTab();
}

function renderSettingsBranches(){
  const rows=(db.clients||[]).map(c=>`
    <div style="border:1px solid var(--border);border-radius:12px;margin-bottom:10px;overflow:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 14px;background:var(--bg2)">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="badge ${c.type==='بنك'?'badge-blue':c.type==='شركة'||c.type==='مؤسسة'?'badge-blue':'badge-gray'}">${esc(c.type)}</span>
          <span style="font-weight:700;font-size:14px">${esc(c.name)}</span>
          <span style="font-size:11px;color:var(--text2)">${(c.branches||[]).length} فرع</span>
          ${c.phone?`<span style="font-size:11px;color:var(--accent);font-family:monospace"><i class="ti ti-phone" style="font-size:11px"></i> ${esc(c.phone)}</span>`:''}
        </div>
        <div style="display:flex;gap:5px">
          <button class="btn btn-sm" onclick="openClientModal('${c.id}')"><i class="ti ti-edit"></i> تعديل</button>
          <button class="btn btn-sm btn-danger" onclick="deleteItem('clients','${c.id}')"><i class="ti ti-trash"></i></button>
        </div>
      </div>
      ${c.branches&&c.branches.length?`<div style="padding:10px 14px;display:flex;flex-wrap:wrap;gap:5px">
        ${c.branches.map(b=>`<span style="padding:4px 10px;background:var(--accent-light);color:var(--accent-dark);border-radius:20px;font-size:12px;font-weight:600\">${esc(b)}</span>`).join('')}
      </div>`:''}
    </div>`).join('');
  return sCard(
    'الزبائن والفروع',
    'عرض وتعديل وحذف الزبائن وفروعهم',
    `<div style="display:flex;justify-content:flex-end;margin-bottom:14px">
      <button class="btn btn-primary" onclick="openClientModal()"><i class="ti ti-plus"></i> زبون جديد</button>
    </div>` +
    `<div>${rows||'<div class="empty-state" style="padding:30px"><i class="ti ti-building"></i><p>لا يوجد زبائن</p></div>'}</div>`
  );
}

function renderSettingsDanger_base(){
  const dangerItem=(title,desc,btnLabel,action)=>`
    <div style="background:var(--danger-bg);border:1px solid var(--danger);border-radius:12px;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
      <div>
        <div style="font-weight:700;font-size:13px;color:var(--text);margin-bottom:3px">${title}</div>
        <div style="font-size:12px;color:var(--text2)">${desc}</div>
      </div>
      <button class="btn btn-sm btn-danger" style="flex-shrink:0" onclick="${action}"><i class="ti ti-trash"></i> ${btnLabel}</button>
    </div>`;
  return sCard(
    'البيانات والنسخ الاحتياطي',
    'تصدير البيانات أو حذفها — تأكد قبل أي إجراء',
    `<div style="display:flex;gap:10px;margin-bottom:22px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="exportData()"><i class="ti ti-download"></i> تصدير نسخة احتياطية (JSON)</button>
      <button class="btn" onclick="exportFullExcel()"><i class="ti ti-file-spreadsheet"></i> تصدير شامل (Excel — كل الجداول)</button>
      <button class="btn" onclick="document.getElementById('import-file').click()"><i class="ti ti-upload"></i> استيراد نسخة احتياطية</button>
      <button class="btn" style="border-color:var(--accent);color:var(--accent)" onclick="changePassword()"><i class="ti ti-lock"></i> تغيير كلمة المرور</button>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:22px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-weight:700;font-size:13px"><i class="ti ti-clock-hour-4" style="color:var(--accent)"></i> القفل التلقائي عند عدم النشاط</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px">(قفل تلقائي)</div>
      </div>
      <select class="form-control" style="max-width:180px" onchange="setAutoLockMinutes(this.value)">
        <option value="0" ${!getAutoLockMinutes()?'selected':''}>معطّل</option>
        <option value="5" ${getAutoLockMinutes()===5?'selected':''}>5 دقائق</option>
        <option value="15" ${getAutoLockMinutes()===15?'selected':''}>15 دقيقة</option>
        <option value="30" ${getAutoLockMinutes()===30?'selected':''}>30 دقيقة</option>
        <option value="60" ${getAutoLockMinutes()===60?'selected':''}>60 دقيقة</option>
      </select>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:22px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-weight:700;font-size:13px"><i class="ti ti-cloud" style="color:var(--accent)"></i> النسخ الاحتياطية السحابية التلقائية</div>
          <div style="font-size:11px;color:var(--text2);margin-top:3px">نسخة تلقائية كل ٥ دقائق.</div>
        </div>
        <button class="btn btn-sm" onclick="loadSnapshotsList()"><i class="ti ti-refresh"></i> تحديث القائمة</button>
      </div>
      <div id="snapshots-list"><div style="font-size:12px;color:var(--text2);padding:10px">اضغط "تحديث"</div></div>
    </div>
    <div style="font-weight:700;font-size:13px;color:var(--danger);margin-bottom:10px;display:flex;align-items:center;gap:6px"><i class="ti ti-alert-triangle"></i> منطقة الخطر</div>
    ${dangerItem('حذف جميع الأعمال','حذف كل سجلات الأعمال — لا يمكن التراجع','حذف الأعمال',"dangerDeleteAll('maintenance')")}
    ${dangerItem('حذف جميع المبيعات','حذف كل فواتير البيع — لا يمكن التراجع','حذف المبيعات',"dangerDeleteAll('sales')")}
    ${dangerItem('حذف جميع عروض الأسعار','حذف كل العروض — لا يمكن التراجع','حذف العروض',"dangerDeleteAll('quotes')")}
    <div style="background:var(--danger-bg);border:2px solid var(--danger);border-radius:12px;padding:16px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
      <div>
        <div style="font-weight:800;font-size:13px;color:var(--danger);margin-bottom:3px">⚠️ مسح جميع البيانات — إعادة ضبط المصنع</div>
        <div style="font-size:12px;color:var(--text2)">حذف نهائي، بلا تراجع</div>
      </div>
      <button class="btn btn-danger" style="border-width:2px;flex-shrink:0" onclick="dangerResetAll()"><i class="ti ti-alert-circle"></i> مسح كل البيانات</button>
    </div>`
  );
}

function openEditWorkerModal(wId){
  if(!requirePerm('names'))return;
  const w=db.workers.find(x=>x.id===wId);if(!w)return;
  showModal(`
    <div class="modal-title">تعديل العامل</div>
    <div class="form-row cols-2" style="margin-bottom:18px">
      <div class="form-group"><label class="form-label">الاسم</label><input type="text" class="form-control" id="edit-worker-name" value="${esc(w.name)}"></div>
      <div class="form-group"><label class="form-label">رقم الهاتف</label><input type="tel" class="form-control" id="edit-worker-phone" value="${esc(w.phone||'')}" dir="ltr" style="text-align:left"></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveEditWorker('${wId}')">حفظ</button>
    </div>
  `);
  setTimeout(()=>{const el=document.getElementById('edit-worker-name');if(el)el.focus();},80);
}

function saveEditWorker(wId){
  if(!requirePerm('names'))return;
  const name=document.getElementById('edit-worker-name').value.trim();
  const phone=document.getElementById('edit-worker-phone')?document.getElementById('edit-worker-phone').value.trim():'';
  if(!name){alert('يرجى إدخال الاسم');return;}
  const w=db.workers.find(x=>x.id===wId);
  if(w){w.name=name;w.phone=phone;}
  saveDB(db);closeModal();refreshSettingsTab();
}

function deleteWorkerSetting(wId){
  if(!guardDelete())return;
  const w=db.workers.find(x=>x.id===wId);if(!w)return;
  const n=workerLinkCount(wId);
  const msg=n>0
    ?`⚠️ هذا العامل مرتبط بـ ${n} سجل (أيام عمل/دفعات). حذفه سيفقد اسمه من هذه السجلات نهائياً. هل تريد حذف العامل "${esc(w.name)}" فعلاً؟`
    :`حذف العامل "${esc(w.name)}" نهائياً؟`;
  if(!confirm(msg))return;
  db.workers=db.workers.filter(x=>x.id!==wId);
  logAction('حذف','عامل',w.name);saveDB(db);refreshSettingsTab();
}

function saveNewModelNumber(){
  const inp=document.getElementById('new-model-number');if(!inp)return;
  const val=inp.value.trim();
  if(!val){alert('يرجى إدخال Part Number');return;}
  if(!db.modelNumbers)db.modelNumbers=[];
  if(db.modelNumbers.includes(val)){alert('هذا الـ Part Number موجود مسبقاً');return;}
  db.modelNumbers.push(val);
  saveDB(db);inp.value='';refreshSettingsTab();
}

function deleteModelNumber(idx){
  if(!guardDelete())return;
  const t=db.modelNumbers[idx];
  if(!confirm(`حذف Part Number "${t}"؟`))return;
  db.modelNumbers.splice(idx,1);
  logAction('حذف','Part Number',t);saveDB(db);refreshSettingsTab();
}

function saveNewDeviceType(){
  const inp=document.getElementById('new-device-type');if(!inp)return;
  const val=inp.value.trim();
  if(!val){alert('يرجى إدخال اسم الصنف');return;}
  if(!db.deviceTypes)db.deviceTypes=[];
  if(db.deviceTypes.includes(val)){alert('هذا الصنف موجود مسبقاً');return;}
  db.deviceTypes.push(val);
  saveDB(db);inp.value='';refreshSettingsTab();
}

function deleteDeviceType(idx){
  if(!guardDelete())return;
  const t=db.deviceTypes[idx];
  if(!confirm(`حذف صنف "${t}"؟`))return;
  db.deviceTypes.splice(idx,1);
  logAction('حذف','نوع جهاز',t);saveDB(db);refreshSettingsTab();
}

function saveNewWorkType(){
  const inp=document.getElementById('new-work-type');if(!inp)return;
  const val=inp.value.trim();
  if(!val){alert('يرجى إدخال نوع العمل');return;}
  if(!db.workTypes)db.workTypes=[];
  if(db.workTypes.includes(val)){alert('هذا النوع موجود مسبقاً');return;}
  db.workTypes.push(val);
  saveDB(db);inp.value='';refreshSettingsTab();
}

function deleteWorkType(idx){
  if(!guardDelete())return;
  const t=db.workTypes[idx];
  if(!confirm(`حذف نوع "${t}"؟`))return;
  db.workTypes.splice(idx,1);
  logAction('حذف','نوع عمل',t);saveDB(db);refreshSettingsTab();
}

function dangerDeleteAll(col){
  const names={maintenance:'الأعمال والورشات',sales:'المبيعات والفواتير',quotes:'عروض الأسعار'};
  if(!confirm(`⚠️ تأكيد الحذف الكامل لـ ${names[col]||col}؟\nهذا الإجراء لا يمكن التراجع عنه.`))return;
  const confirmed=prompt('اكتب "تأكيد" للمتابعة:');
  if(confirmed!=='تأكيد'){alert('تم الإلغاء');return;}
  db[col]=[];
  saveDB(db);refreshSettingsTab();
  alert(`تم حذف ${names[col]||col} بنجاح`);
}

function dangerResetAll(){
  if(!confirm('⚠️⚠️ تحذير خطير!\nسيتم مسح كامل جميع البيانات.\nهل أنت متأكد تماماً؟'))return;
  const c1=prompt('اكتب "مسح كل شيء" للتأكيد:');
  if(c1!=='مسح كل شيء'){alert('تم الإلغاء');return;}
  const c2=prompt('تأكيد أخير — اكتب "نعم":');
  if(c2!=='نعم'){alert('تم الإلغاء');return;}
  localStorage.removeItem(scopedDbKey());
  db=JSON.parse(JSON.stringify(defaultData));
  saveDB(db);
  alert('تم مسح جميع البيانات وإعادة ضبط المصنع.');
  navigate('dashboard');
}

function renderSettingsCompany(){
  const co=ensureCompanyPrintDefaults();
  return `<div class="card">
    <div class="section-title" style="margin-bottom:18px">بيانات الشركة للطباعة</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
      <div class="form-group"><label class="form-label">اسم الشركة</label><input type="text" class="form-control" id="co-name" value="${esc(co.name||'Security Mask')}"></div>
      <div class="form-group"><label class="form-label">العنوان</label><input type="text" class="form-control" id="co-address" value="${esc(co.address||'')}"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">
      <div class="form-group"><label class="form-label">هاتف</label><input type="text" class="form-control" id="co-phone" value="${esc(co.phone||'')}"></div>
      <div class="form-group"><label class="form-label">موبايل / واتساب</label><input type="text" class="form-control" id="co-mobile" value="${esc(co.mobile||'')}"></div>
      <div class="form-group"><label class="form-label">البريد الإلكتروني</label><input type="text" class="form-control" id="co-email" value="${esc(co.email||'')}"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
      <div class="form-group"><label class="form-label">اسم الموقّع على الفواتير والعروض (خانة توقيع الشركة)</label><input type="text" class="form-control" id="co-signatory" value="${esc(co.signatory||'')}" placeholder="مثال: ENG. Mahmoud Jouhar"></div>
      <div class="form-group"><label class="form-label">العلامة المائية بالطباعة</label>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px">
          ${[['text','نص'],['logo','شعار الشركة'],['none','بدون']].map(x=>`<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;cursor:pointer"><input type="radio" name="co-wm-mode" value="${x[0]}" ${getWatermarkMode()===x[0]?'checked':''} onchange="settingsWmPreview()"> ${x[1]}</label>`).join('')}
        </div>
        <input type="text" class="form-control" id="co-watermark" value="${esc(co.watermark||'')}" placeholder="${esc((co.name||'Security Mask').toUpperCase())}" oninput="settingsWmPreview()">
        <div style="font-size:11px;color:var(--text2);margin-top:4px">النص (فاضي = اسم الشركة). بتظهر رمادية خفيفة، 3 مرات بكل صفحة.</div>
        <div id="wm-preview" style="height:110px;border:1px solid var(--border);border-radius:8px;margin-top:8px;background:#fff center/contain no-repeat ${watermarkDataURI()?`url('${watermarkDataURI()}')`:''}"></div></div>
      <div class="table-note" style="grid-column:1/-1;margin-top:-6px">رقم الهاتف والموبايل أعلاه، والموقّع، والعلامة المائية — كلها بتظهر تلقائياً بترويسة وتذييل كل الفواتير وعروض الأسعار والكشوفات.</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
      <div class="form-group"><label class="form-label">الرقم الضريبي</label><input type="text" class="form-control" id="co-tax" value="${esc(co.taxNo||'')}"></div>
      <div class="form-group"><label class="form-label">نص الختام في الفواتير</label><input type="text" class="form-control" id="co-note" value="${esc(co.printNote||'شكراً لتعاملكم معنا')}"></div>
      <div class="form-group" style="grid-column:span 2;background:var(--gold-light);border:1px solid var(--gold);border-radius:10px;padding:12px">
        <label class="form-label" style="color:var(--gold-dark);font-weight:700">سعر الصرف الحالي (كم ليرة سورية = 1 دولار)</label>
        <input type="text" inputmode="decimal" class="form-control" id="co-exchange-rate" value="${fmt(getExchangeRate())}" oninput="formatMoneyInput(this)" placeholder="مثال: 15000">
        <div class="table-note" style="margin-top:6px">هذا السعر يُستخدم لتحويل كل المبالغ المدخلة بالليرة السورية إلى دولار في لوحة التحكم والتقارير الإجمالية. عدّله متى تغيّر سعر السوق، ولن يتغير أي رقم مُدخل أصلاً — فقط طريقة عرضه بالدولار.</div>
        <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-weight:600;font-size:13px;cursor:pointer">
          <input type="checkbox" id="co-use-entry-rate" ${getUseEntryRate()?'checked':''}>
          تثبيت سعر الصرف وقت كل عملية بالتقارير التاريخية (بدل استخدام السعر الحالي دائماً)
        </label>
        <div class="table-note" style="margin-top:4px">لو مفعّل: أرباح شهر سابق بالدولار رح تضل ثابتة حتى لو غيّرت سعر الصرف اليوم، لأنها بتحسب بالسعر وقت تسجيل العملية نفسها (يُطبّق فقط على السجلات المسجّلة بعد تفعيل هذا الخيار — السجلات القديمة قبل التفعيل رح تستمر تستخدم السعر الحالي لأنه ما كان محفوظ لها سعر وقتها).</div>
      </div>
    </div>
    <details class="opt-details" style="margin-bottom:18px">
      <summary>إعدادات التنبيهات والحدود الذكية (سقف الدين، VIP، الهامش، المتابعات...)</summary>
      <div class="opt-body" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px">
      <div class="form-group"><label class="form-label">سقف دين العميل (تحذير عند تجاوزه)</label><input type="text" inputmode="decimal" class="form-control" id="co-debt-threshold" value="${fmt(getDebtThreshold())}" oninput="formatMoneyInput(this)"></div>
      <div class="form-group"><label class="form-label">حد تصنيف العميل VIP (حجم تعامل سنوي)</label><input type="text" inputmode="decimal" class="form-control" id="co-vip-threshold" value="${fmt(getVipThreshold())}" oninput="formatMoneyInput(this)"></div>
      <div class="form-group"><label class="form-label">الحد الأدنى لهامش الربح % (تحذير عند الانخفاض)</label><input type="number" class="form-control" id="co-low-margin" value="${getLowMarginPercent()}" min="0" max="100"></div>
      <div class="form-group"><label class="form-label">متابعة عروض الأسعار المعلقة بعد (أيام)</label><input type="number" class="form-control" id="co-quote-followup" value="${getQuoteFollowupDays()}" min="1"></div>
      <div class="form-group"><label class="form-label">تذكير دفعات الموردين المستحقة بعد (أيام)</label><input type="number" class="form-control" id="co-supplier-due" value="${getSupplierDueDays()}" min="1"></div>
      <div class="form-group"><label class="form-label">أقل عدد أيام عمل لاحتساب أداء العامل</label><input type="number" class="form-control" id="co-bonus-days" value="${getBonusMinDays()}" min="1"></div>
      </div>
    </details>
    <div class="form-group" style="margin-bottom:18px">
      <label class="form-label">شعار الشركة (اختياري — ارفع صورة)</label>
      <input type="file" accept="image/*" class="form-control" id="co-logo-file" onchange="previewLogo(event)">
      <img src="${esc(safeLogoSrc(co.logo))}" style="height:60px;margin-top:8px;border-radius:8px;border:1px solid var(--border)">${co.logo?`<button class="btn btn-sm btn-danger" style="margin-right:8px" onclick="db.company.logo='';saveDB(db);refreshSettingsTab()">حذف الشعار</button>`:''}
      <div id="logo-preview"></div>
    </div>
    <button class="btn btn-primary" onclick="saveCompanySettings()"><i class="ti ti-device-floppy"></i> حفظ الإعدادات</button>
  </div>`;
}

function resizeImageFile(file,maxDim,cb){
  const reader=new FileReader();
  reader.onload=function(ev){
    const img=new Image();
    img.onload=function(){
      let w=img.width,h=img.height;
      if(w>h){if(w>maxDim){h=Math.round(h*maxDim/w);w=maxDim;}}
      else{if(h>maxDim){w=Math.round(w*maxDim/h);h=maxDim;}}
      const canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
      ctx.drawImage(img,0,0,w,h);
      let dataUrl=canvas.toDataURL('image/png');
      // if still large (e.g. complex image), fall back to compressed JPEG
      if(dataUrl.length>180000){
        dataUrl=canvas.toDataURL('image/jpeg',0.85);
      }
      cb(dataUrl);
    };
    img.onerror=function(){cb(null);};
    img.src=ev.target.result;
  };
  reader.onerror=function(){cb(null);};
  reader.readAsDataURL(file);
}

function previewLogo(e){
  const file=e.target.files[0];if(!file)return;
  resizeImageFile(file,300,function(dataUrl){
    if(!dataUrl)return;
    document.getElementById('logo-preview').innerHTML=`<img src="${esc(safeLogoSrc(dataUrl))}" style="height:70px;margin-top:8px;border-radius:8px;border:1px solid var(--border)">`;
  });
}

function saveCompanySettings(){
  if(!db.company)db.company={};
  db.company.name=document.getElementById('co-name').value.trim();
  db.company.address=document.getElementById('co-address').value.trim();
  db.company.phone=document.getElementById('co-phone').value.trim();
  db.company.mobile=document.getElementById('co-mobile').value.trim();
  db.company.email=document.getElementById('co-email').value.trim();
  db.company.taxNo=document.getElementById('co-tax').value.trim();
  db.company.printNote=document.getElementById('co-note').value.trim();
  db.company.signatory=document.getElementById('co-signatory').value.trim();
  db.company.watermark=document.getElementById('co-watermark').value.trim();
  const wmSel=document.querySelector('input[name="co-wm-mode"]:checked');
  db.company.watermarkMode=wmSel?wmSel.value:'text';
  db.company.watermarkOff=db.company.watermarkMode==='none';
  if(typeof warmWatermarkLogo==='function')warmWatermarkLogo().then(function(){injectWatermarkCSS();});
  db.company.printDefaultsApplied=true;
  if(!db.settings)db.settings={};
  db.settings.exchangeRate=unformatNum(document.getElementById('co-exchange-rate').value)||15000;
  const useEntryRateEl=document.getElementById('co-use-entry-rate');
  if(useEntryRateEl)db.settings.useEntryRate=useEntryRateEl.checked;
  db.settings.debtThreshold=unformatNum(document.getElementById('co-debt-threshold').value)||5000000;
  db.settings.vipThreshold=unformatNum(document.getElementById('co-vip-threshold').value)||10000000;
  db.settings.lowMarginPercent=+document.getElementById('co-low-margin').value||0;
  db.settings.quoteFollowupDays=+document.getElementById('co-quote-followup').value||7;
  db.settings.supplierDueDays=+document.getElementById('co-supplier-due').value||15;
  db.settings.bonusMinDays=+document.getElementById('co-bonus-days').value||5;
  // save logo if file selected — resized first so it reliably persists in localStorage
  const fileInp=document.getElementById('co-logo-file');
  if(fileInp&&fileInp.files&&fileInp.files[0]){
    resizeImageFile(fileInp.files[0],300,function(dataUrl){
      if(!dataUrl){alert('تعذرت قراءة الصورة، جرّب صورة أخرى');return;}
      db.company.logo=dataUrl;
      if(saveDB(db)){alert('تم حفظ الإعدادات مع الشعار ✓');refreshSettingsTab();}
      else{alert('تعذر حفظ الشعار — مساحة التخزين ممتلئة. جرّب صورة أصغر أو احذف بعض البيانات القديمة.');}
    });
  } else {
    if(saveDB(db))alert('تم حفظ الإعدادات ✓');
    else alert('تعذر حفظ الإعدادات — مساحة التخزين ممتلئة.');
  }
}

async function exportPDF(btn,filename){
  const doc=document.querySelector('#print-area .print-doc');
  if(!doc){alert('لا يوجد مستند لتصديره');return;}
  // html2pdf (~700 كيلوبايت) بتتحمّل هون عند أول تصدير PDF بس
  if(typeof html2pdf==='undefined'){
    if(btn){btn.disabled=true;btn.style.opacity='.6';}
    try{await loadLib('html2pdf');}
    catch(e){
      if(btn){btn.disabled=false;btn.style.opacity='';}
      alert('تعذّر تحميل مكتبة تصدير PDF (يلزم اتصال بالإنترنت أول مرة). يمكنك استخدام زر الطباعة واختيار "حفظ كـ PDF".');
      return;
    }
    if(btn){btn.disabled=false;btn.style.opacity='';}
  }
  const label=btn?btn.innerHTML:null;
  if(btn){btn.disabled=true;btn.style.opacity='.6';btn.innerHTML='⏳ جاري التصدير...';}
  const safeName=String(filename||'مستند').replace(/[\\/:*?"'<>|]/g,'').replace(/\s+/g,'_').slice(0,80)||'مستند';
  const opt={
    margin:0,
    filename:safeName+'.pdf',
    image:{type:'jpeg',quality:0.98},
    html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff',scrollX:0,scrollY:0,windowWidth:doc.scrollWidth,windowHeight:doc.scrollHeight},
    jsPDF:{unit:'mm',format:'a5',orientation:'portrait'},
    pagebreak:{mode:['css','legacy']}
  };
  html2pdf().set(opt).from(doc).save().then(()=>{
    if(btn){btn.disabled=false;btn.style.opacity='';btn.innerHTML=label;}
  }).catch(err=>{
    console.error('exportPDF error:',err);
    alert('حدث خطأ أثناء تصدير PDF. يمكنك استخدام زر الطباعة واختيار "حفظ كـ PDF" كبديل.');
    if(btn){btn.disabled=false;btn.style.opacity='';btn.innerHTML=label;}
  });
}

function workerLinkCount(id){
  const inMaint=(db.maintenance||[]).reduce((n,m)=>n+((m.workers||[]).filter(w=>w.workerId===id).length),0);
  const payments=(db.workerPayments||[]).filter(p=>p.workerId===id).length;
  return inMaint+payments;
}

// T27: معاينة حيّة للعلامة المائية بالإعدادات
function settingsWmPreview(){
  const el=document.getElementById('wm-preview');if(!el)return;
  const sel=document.querySelector('input[name="co-wm-mode"]:checked');
  const txt=document.getElementById('co-watermark');
  const uri=watermarkDataURI({mode:sel?sel.value:'text',text:txt&&txt.value.trim()?txt.value:undefined});
  el.style.backgroundImage=uri?'url("'+uri+'")':'none';
}


/* ===== T18: لوحة نقل الجداول الكبيرة للسحابة (جداول حقيقية + RLS) ===== */
function renderSettingsDanger(){return renderSettingsDanger_base()+smPanelHtml();}
function smPanelHtml(){
  const on=!!(db.settings&&db.settings.cloudTables);
  const st=window.SM?SM.stats(db):null;
  const rows=st?SM.TABLES.map(t=>`<tr><td>${t}</td><td>${st.counts[t]}</td><td>${st.sums[t]}</td></tr>`).join(''):'';
  return `<div class="card" style="margin-top:16px">
    <div style="font-size:16px;font-weight:700">جداول السحابة للبيانات الكبيرة (T18)</div>
    <div style="font-size:12px;color:var(--text2);margin:3px 0 14px">الدفعات والزيارات وحركات المحفظة ودفعات العمال وسجل النشاط بتنحفظ بجداول حقيقية بدل بلوب واحد. الحالة: <b style="color:${on?'var(--success,#16a34a)':'var(--text2)'}">${on?'مفعّلة':'مطفية'}</b></div>
    ${st?`<table style="font-size:12px;margin-bottom:14px"><thead><tr><th>الجدول</th><th>عدد الصفوف</th><th>مجموع المبالغ</th></tr></thead><tbody>${rows}</tbody></table>`:'<div style="color:var(--danger)">store.js غير محمّل</div>'}
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px">⚠️ قبل التفعيل حدّث التطبيق على كل الأجهزة (النسخ القديمة ما بتقرأ الجداول). التفعيل بياخد نسخة احتياطية كاملة، بيكتب الجداول، بيقرأها، وبيقارن النتيجة مع الأصل — إذا اختلف شي ما بيتفعّل.</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${on?'':'<button class="btn btn-primary" onclick="smEnable()"><i class="ti ti-database-import"></i> فحص وتفعيل</button>'}
      ${on?'<button class="btn btn-danger" onclick="smDisable()"><i class="ti ti-arrow-back-up"></i> تراجع (رجوع للبلوب الكامل)</button>':''}
      <button class="btn" onclick="smVerifyNow()"><i class="ti ti-checks"></i> فحص قبل = بعد</button>
    </div></div>`;
}
function _smReport(v){
  return SM.TABLES.map(t=>t+': '+v.before.counts[t]+' → '+v.after.counts[t]+' | '+v.before.sums[t]+' → '+v.after.sums[t]).join('\n')+'\nالبصمة: '+(v.before.hash===v.after.hash?'مطابقة':'مختلفة');
}
async function smVerifyNow(){
  try{
    const ex=SM.extract(db,Date.now(),TENANT_CODE);
    const back=SM.hydrate(JSON.parse(JSON.stringify(ex.slim)),ex.tables);
    const v=SM.verify(db,back);
    alert((v.ok?'✅ الفحص المحلي ناجح (استخراج ثم إرجاع = الأصل)':'❌ الفحص فشل: '+v.diffs.join(','))+'\n\n'+_smReport(v));
  }catch(e){alert('تعذّر الفحص: '+e.message);}
}
async function smEnable(){
  if(!window.SM||typeof _sb==='undefined'){alert('store.js غير محمّل');return;}
  if(!confirm('تفعيل جداول السحابة؟ رح نحفظ نسخة احتياطية كاملة وبعدين نفحص قبل = بعد.'))return;
  if(!(await confirmPasswordFor('نقل الجداول للسحابة')))return;
  try{
    await forceSnapshotNow();
    const v=await SM.migrate(_sb,TENANT_CODE,db,SM.state);
    if(!v.ok){alert('❌ فشل فحص قبل = بعد ('+v.diffs.join(', ')+') — ما تم التفعيل، وبياناتك ما انلمست.\n\n'+_smReport(v));return;}
    db.settings=db.settings||{};db.settings.cloudTables=true;
    saveDB(db);
    alert('✅ تم التفعيل. الفحص قبل = بعد ناجح:\n\n'+_smReport(v));
    render();
  }catch(e){console.error(e);alert('❌ فشل النقل: '+(e&&e.message||e)+'\nما تم التفعيل. تأكد إنك شغّلت sql/t18_tables.sql بـ Supabase.');}
}
async function smDisable(){
  if(!confirm('التراجع؟ البيانات بترجع تنحفظ كبلوب كامل متل قبل. جداول السحابة بتضل نسخة ثانية بدون استعمال.'))return;
  db.settings.cloudTables=false;
  if(window.SM)SM.state.hashes=null;
  saveDB(db);
  alert('تم التراجع. أول مزامنة جاية بترفع البلوب الكامل.');
  render();
}
