/* wallet.js — يتحمّل فقط عند فتح صفحة "المحفظة الشخصية" (خاصة بالأدمن حصراً).
   منفصلة تماماً عن حسابات الشركة/المشاريع: بياناتها بـ db.wallet وحدها، وما
   بتظهر بأي تقرير أو داشبورد تاني. الرابط الوحيد مع أرباح الشركة هو زر "سحب
   من أرباح الشركة" وهو سحب يدوي بالكامل (المستخدم يقرر المبلغ والوقت) —
   ما في أي مزامنة تلقائية أو تعديل على حسابات الشركة نفسها.
   ملاحظة: getCompanyNetProfitUSD() معرّفة بـ ops.js (قراءة فقط).
   [v4.3.9] جيبين داخل نفس المحفظة: "شخصي" (الافتراضي — كل الحركات القديمة) و"شركة"
   (فلوس الشركة يلي معك: قبض من زبون / مصروف عمل، ممكن تنربط بمشروع/عمل/فاتورة).
   شاشة "التخريج" بتحسب الربح المتاح للسحب وكم لازم يرجع للشركة وبتسجّل القيود.
   بردو ما في أي تعديل على حسابات الشركة — بس قراءة لأرقام الأرباح. */

function walletAllEntries(){
  return (db.wallet&&db.wallet.entries)||[];
}
function walletBalanceUSD(){
  // T23: مجموع بالسنت (أعداد صحيحة) — نفس أساس كشف الحساب، فآخر المدة دايماً = الرصيد الحالي بالسنت
  let c=Math.round(((db.wallet&&+db.wallet.openingBalance)||0)*100);
  walletAllEntries().forEach(e=>{c+=walletSignedCents(e);});
  return c/100;
}
// بيرجع الرصيد الحالي مقسوم فعلياً حسب العملة الأصلية لكل حركة (بدون تحويل) —
// يعني قديش معك كاش دولار فعلي وقديش معك كاش ليرة فعلي، منفصلين عن بعض.
// الرصيد الافتتاحي دايماً بالدولار فبينضاف على شق الدولار بس.
function walletBalanceByCurrency(){
  let usd=Math.round(((db.wallet&&+db.wallet.openingBalance)||0)*100),syp=0;
  walletAllEntries().forEach(e=>{
    const c=Math.round(round2(+e.amount||0)*100);
    const sign=e.type==='income'?1:-1;
    if((e.currency||'USD')==='SYP')syp+=sign*c;else usd+=sign*c;
  });
  return {usd:usd/100,syp:syp/100};
}

/* ===== جيب الشركة / الجيب الشخصي =====
   الكاش الفعلي كتلة وحدة (walletBalanceUSD). كل حركة إلها جيب: pocket==='company' يعني
   فلوس الشركة (قبض زبون / مصروف عمل / تخريج)، وأي شي تاني (بدون الحقل) = شخصي.
   رصيد الشخصي = الكلي − جيب الشركة. جيب الشركة موجب = معك فلوس للشركة، سالب = الشركة مدينة إلك.
   source للحركات الجديدة:
     pocketTransfer  = سحب أرباح (الشق يلي بينقص جيب الشركة؛ الشق المقابل source:'profit' بالجيب الشخصي)
     companyHandover = تسليم للشركة (كاش طلع من إيدك للشركة)
     companyReimburse = الشركة ردّت لك (كاش دخل لإيدك من الشركة) */
function walletIsCompany(e){return !!e&&e.pocket==='company';}
function walletSignedUSD(e){return walletSignedCents(e)/100;}
function walletCompanyPocketUSD(){return walletAllEntries().filter(walletIsCompany).reduce((s,e)=>s+walletSignedCents(e),0)/100;}
function walletPersonalPocketUSD(){return walletBalanceUSD()-walletCompanyPocketUSD();}
function walletKindLabel(kind){return {project:'مشروع',maint:'عمل',sale:'فاتورة'}[kind]||'';}
// قائمة الجهات القابلة للربط/التخريج. noProfit=true بتوفّر حساب الأرباح (للعناوين بس).
function walletSettleEntities(kind,noProfit){
  if(kind==='project')return (db.projects||[]).map(p=>({id:p.name,label:p.name,profit:noProfit?0:projectStats(p.name).profit}));
  if(kind==='maint')return (db.maintenance||[]).map(m=>({id:m.id,label:(getClientName(m.clientId)||m.clientNameFree||'—')+(m.branch?' / '+m.branch:'')+(m.projectName?' — '+m.projectName:''),profit:noProfit?0:toUSDHist(maintRecognizedProfit(m),m.currency,m)}));
  if(kind==='sale')return (db.sales||[]).map(x=>({id:x.id,label:(getClientName(x.clientId)||x.clientNameFree||'—')+(x.projectName?' — '+x.projectName:''),profit:noProfit?0:toUSDHist(saleRecognizedProfit(x),x.currency,x)}));
  return [];
}
function walletEntityLabel(kind,id){
  const f=walletSettleEntities(kind,true).find(x=>x.id===id);
  return f?f.label:'';
}
// دفتر جهة معيّنة (أو قائمة حركات جيب الشركة): مقبوض/مصروف/مسحوب/مسلّم/مردود/صافي — كله بالدولار
function walletLedgerOf(list){
  const r={received:0,advanced:0,spent:0,withdrawn:0,handed:0,reimbursed:0,net:0};
  list.forEach(e=>{
    const v=walletEntryUSD(e);
    if(e.source==='pocketTransfer')r.withdrawn+=v;
    else if(e.source==='companyHandover')r.handed+=v;
    else if(e.source==='companyReimburse')r.reimbursed+=v;
    else if(e.source==='companyAdvance')r.advanced+=v;
    else if(e.type==='income')r.received+=v;
    else r.spent+=v;
  });
  r.net=r.received+r.advanced+r.reimbursed-r.spent-r.withdrawn-r.handed;
  return r;
}
function walletEntityLedger(kind,id){
  return walletLedgerOf(walletAllEntries().filter(e=>walletIsCompany(e)&&e.linkType===kind&&e.linkId===id));
}
function walletLinkOptionsHTML(kind,selected){
  if(!kind)return '<option value="">— اختر النوع أولاً —</option>';
  const list=walletSettleEntities(kind,true);
  return '<option value="">— اختر —</option>'+list.map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(x.label)}</option>`).join('');
}
function walletLinkSuffixHTML(e){
  if(!e||!e.linkType||!e.linkId)return '';
  const lbl=walletEntityLabel(e.linkType,e.linkId)||e.linkLabel||'';
  return lbl?` <span style="font-size:11px;color:var(--text2)">— ${walletKindLabel(e.linkType)}: ${esc(lbl)}</span>`:'';
}
function walletRowBadgeHTML(e){
  if(e.source==='balanceAdjust')return '<span class="badge badge-amber">تسوية رصيد</span>';
  if(e.source==='currencyExchange')return '<span class="badge badge-amber">تحويل عملة</span>';
  if(e.source==='pocketTransfer')return '<span class="badge badge-amber">تحويل داخلي</span>';
  const base=e.type==='income'?'<span class="badge badge-green">إيراد</span>':'<span class="badge badge-red">مصروف</span>';
  return walletIsCompany(e)?base+' <span class="badge badge-amber">شركة</span>':base;
}
function walletRowCategoryHTML(e){
  if(e.source==='balanceAdjust')return esc(e.note||'تسوية رصيد — بداية فترة جديدة');
  if(e.source==='pocketTransfer')return 'سحب أرباح للجيب الشخصي'+walletLinkSuffixHTML(e);
  if(e.source==='companyHandover')return 'تسليم للشركة'+walletLinkSuffixHTML(e);
  if(e.source==='companyReimburse')return 'الشركة ردّت لك'+walletLinkSuffixHTML(e);
  if(e.source==='companyAdvance')return 'سحب دفعة من الشركة (عهدة للشغل)'+walletLinkSuffixHTML(e);
  if(walletIsCompany(e)){const cn=walletCatName(e.catId,e.subId);return (cn&&cn!=='—'?cn:(e.type==='income'?'قبض من زبون':'مصروف عمل'))+walletLinkSuffixHTML(e);}
  if(e.source==='profit')return 'سحب من أرباح الشركة'+walletLinkSuffixHTML(e);
  if(e.source==='debtSettlement')return esc(e.note||'تسديد/تحصيل دين');
  if(e.source==='currencyExchange')return walletExchangeNoteHTML(e);
  if(e.source==='debtCreation')return esc(e.note||'دين (كاش فعلي)');
  return esc(walletCatName(e.catId,e.subId));
}
// الحركات المولّدة من التخريج ما بتنعدّل يدوياً (عشان ما ينكسر التوازن) — بس بتنحذف (مع قيدها المقابل)
function walletEntryLocked(e){
  return !!e&&(e.source==='balanceAdjust'||e.source==='pocketTransfer'||e.source==='companyHandover'||e.source==='companyReimburse'||e.source==='currencyExchange'||e.source==='debtSettlement'||(e.source==='profit'&&!!e.pairId));
}
/* ===== ديون (لي / عليّ) — سجل منفصل تماماً عن حركات الإيراد/المصروف.
   لي (مستحق لي) = إلي مبلغ عند حدا غيري (لسا ما رجعو). [type داخلياً: creditor]
   عليّ (مستحق عليّ) = علي مبلغ لحدا غيري (لسا ما رجعتو). [type داخلياً: debtor]
   كل دين إلو حقلين مبلغ منفصلين (دولار + ليرة سورية) بنفس الوقت — منشان
   نفس الشخص ممكن يكون فيه جزء بالدولار وجزء بالليرة. لما يتسدد الدين
   (كامل أو جزء، بأي عملة) بينسجل تلقائياً كحركة إيراد (لو "لي") أو مصروف
   (لو "عليّ") بالمحفظة، لأنه فعلياً كاش دخل أو طلع من إيدك. ===== */
function walletAllDebts(){
  return (db.wallet&&db.wallet.debts)||[];
}
function walletDebtRemainingUSD(d){
  return Math.max(0,(+d.amountUSD||0)-(+d.paidUSD||0));
}
function walletDebtRemainingSYP(d){
  return Math.max(0,(+d.amountSYP||0)-(+d.paidSYP||0));
}
function walletDebtIsSettled(d){
  return walletDebtRemainingUSD(d)<=0&&walletDebtRemainingSYP(d)<=0;
}
function walletDebtsSummaryUSD(){
  let creditor=0,debtor=0;
  walletAllDebts().forEach(d=>{
    const rem=walletDebtRemainingUSD(d)+toUSD(walletDebtRemainingSYP(d),'SYP');
    if(d.type==='debtor')debtor+=rem;else creditor+=rem;
  });
  return {creditor,debtor,net:creditor-debtor};
}
// يفتح/يغمّق لون hex بنسبة معيّنة — نستخدمه لتوليد درجات لونية مختلفة
// لكل فئة فرعية ضمن نفس الفئة الرئيسية (بنفس عائلة اللون) بمخطط "تفاصيل".
function walletShade(hex,percent){
  hex=(hex||'#888888').replace('#','');
  const num=parseInt(hex,16);
  let r=(num>>16)&255,g=(num>>8)&255,b=num&255;
  const t=percent<0?0:255,p=Math.min(Math.abs(percent),90)/100;
  r=Math.round((t-r)*p)+r;g=Math.round((t-g)*p)+g;b=Math.round((t-b)*p)+b;
  return '#'+(0x1000000+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
function walletCatName(catId,subId){
  const cat=(db.wallet.categories||[]).find(c=>c.id===catId);
  if(!cat)return subId?'—':'—';
  if(!subId)return cat.name;
  const sub=(cat.subs||[]).find(s=>s.id===subId);
  return sub?`${esc(cat.name)} / ${esc(sub.name)}`:cat.name;
}
// T22: الفترة بتجي من مكوّن الفترة الموحّد (periodResolve('wallet')) — حدود نصّية شاملة الطرفين.
// الرصيد الكلي دايماً من أول يوم، ما إلو علاقة بهالفلتر.
function walletInPeriod(entry,pb){
  if(!pb||(!pb.from&&!pb.to))return true;
  return periodInRange(entry.date,pb.from,pb.to);
}

/* ====================================================================
   T23: كشف حساب المحفظة — أول المدة، إيراد، مصروف، تحويلات، آخر المدة
   - كل المبالغ بالسنت (أعداد صحيحة) فما في فروقات كسور.
   - النطاق (scope): all = كل الكاش، personal = الجيب الشخصي، company = جيب الشركة.
   - أول المدة = الرصيد الافتتاحي + كل الحركات قبل بداية الفترة (والحركات بدون تاريخ بتنحسب هون).
   - آخر المدة = أول المدة + إيراد + مصروف(سالب) + تحويل بين الجيبين + تحويل عملة.
   - تحويل بين الجيبين (سحب أرباح) صافيه صفر بنطاق "الكل"، وتحويل العملة صافيه صفر بالعملة الأصلية
     (بالمكافئ بالدولار بيطلع فرق الصرف بس).
   - ثلاثة أعمدة: مكافئ بالدولار (بسعر كل حركة المحفوظ T21)، دولار فعلي، ليرة فعلية.
   ==================================================================== */
function walletEntryDay(e){return e&&e.date?String(e.date).slice(0,10):'';}
function walletEntryClass(e){
  if(e.source==='balanceAdjust')return 'adjust'; // تسوية رصيد (بدء فترة جديدة)
  if(e.source==='currencyExchange')return 'exchange';
  if(e.source==='pocketTransfer'||(e.source==='profit'&&e.pairId))return 'internal';
  return e.type==='income'?'income':'expense';
}
function walletScopeMatch(e,scope){return scope==='company'?walletIsCompany(e):(scope==='personal'?!walletIsCompany(e):true);}
const WS_LINES=['income','expense','internal','exchange','adjust'];
function _wsZero(){return {open:0,income:0,expense:0,internal:0,exchange:0,adjust:0};}
function _wsBlank(){return {usd:_wsZero(),nat:{USD:_wsZero(),SYP:_wsZero()},count:0,undated:0,frozen:[],chainBreak:false};}
function _wsCloseOf(z){return z.open+z.income+z.expense+z.internal+z.exchange+(z.adjust||0);}
function _wsFinish(r){
  r.usd.close=_wsCloseOf(r.usd);r.nat.USD.close=_wsCloseOf(r.nat.USD);r.nat.SYP.close=_wsCloseOf(r.nat.SYP);
  return r;
}
function walletClosedMap(){return (db.wallet&&db.wallet.closedMonths)||{};}
function walletMonthEnd(key){const p=key.split('-').map(Number);return periodMonthBounds(p[0],p[1]-1).to;}
function walletMonthName(key){const p=key.split('-').map(Number);return periodMonthLabel(p[0],p[1]-1);}
function walletDataSpan(){
  let min='',max='';
  walletAllEntries().forEach(e=>{const d=walletEntryDay(e);if(!d)return;if(!min||d<min)min=d;if(!max||d>max)max=d;});
  return min?{min,max}:null;
}
function walletMonthBuckets(from,to){return periodMonthBuckets(from,to);} // T26: الدالة انتقلت للمكوّن المشترك
// آخر شهر مقفل نهايته قبل بداية الفترة: أول المدة بيتحمّل من لقطته (مو من الحركات الحيّة)
function _wsBaseline(from,scope){
  if(!from)return null;
  const map=walletClosedMap();let best=null;
  Object.keys(map).forEach(k=>{
    const end=walletMonthEnd(k),sn=map[k]&&map[k].scopes&&map[k].scopes[scope];
    if(sn&&end<from&&(!best||end>best.end))best={key:k,end,snap:sn};
  });
  return best;
}
function _walletRawStatement(from,to,scope){
  const r=_wsBlank();
  const base=_wsBaseline(from,scope);
  if(base){
    r.usd.open=_wsCloseOf(base.snap.usd);r.nat.USD.open=_wsCloseOf(base.snap.nat.USD);r.nat.SYP.open=_wsCloseOf(base.snap.nat.SYP);
  }else if(scope!=='company'){
    const o=Math.round(((db.wallet&&+db.wallet.openingBalance)||0)*100);
    r.usd.open=o;r.nat.USD.open=o; // الرصيد الافتتاحي دايماً بالدولار وللجيب الشخصي
  }
  walletAllEntries().forEach(e=>{
    if(!walletScopeMatch(e,scope))return;
    const day=walletEntryDay(e);
    const cur=(e.currency||'USD')==='SYP'?'SYP':'USD';
    const sign=e.type==='income'?1:-1;
    const u=sign*walletEntryCents(e),n=sign*Math.round(round2(+e.amount||0)*100);
    if(!day){ // بدون تاريخ: بتنحسب بأول المدة (إلا لو في لقطة مقفلة بتغطيها)
      if(base)return;
      r.undated++;r.usd.open+=u;r.nat[cur].open+=n;return;
    }
    if(base&&day<=base.end)return; // مجمّد بلقطة الإقفال
    if(from&&day<from){r.usd.open+=u;r.nat[cur].open+=n;return;}
    if(to&&day>to)return;
    const cls=walletEntryClass(e);
    r.usd[cls]+=u;r.nat[cur][cls]+=n;r.count++;
  });
  return r;
}
function _wsFromSnapshot(sn,key){
  const r=_wsBlank();
  r.usd=Object.assign(_wsZero(),sn.usd);r.nat.USD=Object.assign(_wsZero(),sn.nat.USD);r.nat.SYP=Object.assign(_wsZero(),sn.nat.SYP);
  r.count=sn.count||0;r.frozen=[key];
  return r;
}
function walletStatement(from,to,scope){
  scope=scope||'all';
  const map=walletClosedMap();
  if(!Object.keys(map).length)return _wsFinish(_walletRawStatement(from,to,scope));
  let f=from,t=to;
  if(!f||!t){
    const sp=walletDataSpan();
    if(!sp)return _wsFinish(_walletRawStatement(from,to,scope));
    f=f||sp.min;t=t||(sp.max>localToday()?sp.max:localToday());
  }
  const bs=walletMonthBuckets(f,t);
  const isFrozen=b=>b.full&&map[b.key]&&map[b.key].scopes&&map[b.key].scopes[scope];
  if(!bs.some(isFrozen))return _wsFinish(_walletRawStatement(from,to,scope));
  // فترة فيها شهر مقفل: منركّبها شهر بشهر (المقفل من لقطته، والباقي حيّ)
  const parts=bs.map(b=>isFrozen(b)?_wsFromSnapshot(map[b.key].scopes[scope],b.key):_walletRawStatement(b.from,b.to,scope));
  const r=_wsBlank();
  r.usd.open=parts[0].usd.open;r.nat.USD.open=parts[0].nat.USD.open;r.nat.SYP.open=parts[0].nat.SYP.open;
  parts.forEach((p,i)=>{
    WS_LINES.forEach(k=>{r.usd[k]+=p.usd[k];r.nat.USD[k]+=p.nat.USD[k];r.nat.SYP[k]+=p.nat.SYP[k];});
    r.count+=p.count;r.undated+=p.undated;r.frozen=r.frozen.concat(p.frozen);
    if(i>0&&_wsCloseOf(parts[i-1].usd)!==p.usd.open)r.chainBreak=true;
  });
  return _wsFinish(r);
}

/* ===== T24: مقارنة بالفترة السابقة + سلسلة الأشهر ===== */
function walletCompare(from,to,scope){
  const prev=periodShift(from,to,-1);
  if(!prev)return null;
  return {cur:walletStatement(from,to,scope),prev:walletStatement(prev.from,prev.to,scope),prevRange:prev};
}
function walletMonthlySeries(from,to,scope){
  const sp=walletDataSpan();
  let f=from||(sp?sp.min:null),t=to||(sp?(sp.max>localToday()?sp.max:localToday()):null);
  if(!f||!t)return {rows:[],truncated:false,from:f,to:t};
  let bs=walletMonthBuckets(f,t),truncated=false;
  if(bs.length>36){bs=bs.slice(-36);truncated=true;f=bs[0].from;}
  const rows=bs.map(b=>{
    const r=walletStatement(b.from,b.to,scope);
    return {key:b.key,label:periodMonthLabel(b.y,b.m),from:b.from,to:b.to,full:b.full,frozen:r.frozen.length>0,usd:r.usd,nat:r.nat,count:r.count};
  });
  return {rows,truncated,from:f,to:t};
}

/* ===== T25: إقفال الشهر (لقطة مجمّدة اختيارية) =====
   الإقفال بيحفظ أرقام الشهر (أول المدة، إيراد، مصروف، تحويلات، آخر المدة) للنطاقات التلاتة.
   بعده: أرقام هالشهر ما بتتغيّر بتغيّر سعر الصرف أو تعديل حركة قديمة، وأول المدة للشهر اللي بعده
   بيتحمّل من لقطة الإقفال. لو تغيّرت حركات شهر مقفل بيطلع تنبيه "فرق" وبتقدر تعيد الإقفال أو تفتح الشهر. */
function walletMonthFingerprint(key){
  const p=key.split('-').map(Number),b=periodMonthBounds(p[0],p[1]-1);
  let n=0,net=0,abs=0;
  walletAllEntries().forEach(e=>{
    if(!periodInRange(e.date,b.from,b.to))return;
    const c=walletSignedCents(e);n++;net+=c;abs+=Math.abs(c);
  });
  return n+'|'+net+'|'+abs;
}
function walletIsMonthClosed(key){return !!(key&&walletClosedMap()[key]);}
function walletMonthDrift(key){const c=walletClosedMap()[key];return !!c&&c.fp!==walletMonthFingerprint(key);}
function walletCloseMonth(key){
  const p=key.split('-').map(Number),b=periodMonthBounds(p[0],p[1]-1);
  const scopes={};
  ['all','personal','company'].forEach(sc=>{
    const r=_walletRawStatement(b.from,b.to,sc);
    scopes[sc]={usd:r.usd,nat:r.nat,count:r.count};
  });
  if(!db.wallet.closedMonths)db.wallet.closedMonths={};
  db.wallet.closedMonths[key]={closedAt:new Date().toISOString(),rate:getExchangeRate(),fp:walletMonthFingerprint(key),scopes};
  saveDB(db);
}
function walletReopenMonth(key){
  if(db.wallet&&db.wallet.closedMonths&&db.wallet.closedMonths[key]){delete db.wallet.closedMonths[key];saveDB(db);}
}
function walletCloseMonthBtn(key){
  const redo=walletIsMonthClosed(key);
  if(!confirm((redo?'إعادة إقفال ':'إقفال ')+walletMonthName(key)+'؟\nأرقام الشهر بتتجمّد: ما بتتغيّر بتغيّر سعر الصرف، وأول المدة للشهر اللي بعده بيتحمّل منها.\n(بتقدر تفتح الشهر بأي وقت.)'))return;
  walletCloseMonth(key);
  if(window._walletRerender)window._walletRerender();
}
function walletReopenMonthBtn(key){
  if(!confirm('فتح '+walletMonthName(key)+'؟ الأرقام بترجع حيّة وبتتأثر بأي تعديل.'))return;
  walletReopenMonth(key);
  if(window._walletRerender)window._walletRerender();
}
// تعديل/حذف حركة تاريخها بشهر مقفل: تأكيد مسبق (اللقطة ما بتتغيّر، بس بيطلع تنبيه فرق)
function walletClosedGuard(date){
  const day=String(date||'').slice(0,10);
  if(!day)return true;
  const key=day.slice(0,7);
  if(!walletClosedMap()[key])return true;
  return confirm('تاريخ الحركة ('+fmtDate(day)+') ضمن شهر مقفل ('+walletMonthName(key)+').\nلقطة الإقفال ما بتتغيّر، بس رح يظهر تنبيه "تغيّرت حركات الشهر" لحد ما تعيد إقفاله. متابعة؟');
}

/* ===== عرض كشف الحساب والمقارنة ومخطط الأشهر ===== */
function walletFmtC(c,cur,withSign){
  const v=c/100,sym=cur==='SYP'?' ل.س':'';
  const a=Math.abs(v);
  const body=(cur==='SYP'?'':'$')+fmt(a)+sym;
  if(!withSign)return (v<0?'−':'')+body;
  if(c===0)return body;
  return (c>0?'+':'−')+body;
}
function walletStLabels(scope){
  return {open:'أول المدة',income:'+ إيراد',expense:'− مصروف',internal:scope==='personal'?'± سحب أرباح من جيب الشركة':(scope==='company'?'± سحب أرباح إلى الجيب الشخصي':'± تحويل بين الجيبين'),exchange:'± تحويل عملة',adjust:'± تسوية رصيد (بداية فترة جديدة)',close:'آخر المدة'};
}
function renderWalletStatementCard(pb,scope){
  const r=walletStatement(pb.from,pb.to,scope);
  const L=walletStLabels(scope);
  const closed=pb.monthKey?walletClosedMap()[pb.monthKey]:null;
  const drift=pb.monthKey&&closed?walletMonthDrift(pb.monthKey):false;
  const showRow=k=>{if(k==='open'||k==='close'||k==='income'||k==='expense')return true;return r.usd[k]!==0||r.nat.USD[k]!==0||r.nat.SYP[k]!==0;};
  const hasSyp=WS_LINES.concat(['open','close']).some(k=>r.nat.SYP[k]!==0);
  const color=(k,c)=>k==='income'?'var(--success)':(k==='expense'?'var(--danger)':(c<0?'var(--danger)':(c>0?'var(--success)':'var(--text2)')));
  const cell=(k,c,cur)=>{
    if(k==='open'||k==='close')return `<td style="font-weight:800">${walletFmtC(c,cur,false)}</td>`;
    return `<td style="color:${color(k,c)}">${walletFmtC(c,cur,true)}</td>`;
  };
  const rowsHTML=['open'].concat(WS_LINES).concat(['close']).filter(showRow).map(k=>`<tr class="${k==='close'?'summary-row':''}">
      <td style="font-weight:${k==='open'||k==='close'?800:600}">${L[k]}</td>
      ${cell(k,r.usd[k],'USD_EQ')}${cell(k,r.nat.USD[k],'USD')}${hasSyp?cell(k,r.nat.SYP[k],'SYP'):''}</tr>`).join('');
  const scopeBtns=[['all','كل الكاش'],['personal','شخصي'],['company','شركة']].map(x=>`<button class="btn btn-sm ${scope===x[0]?'btn-primary':''}" style="padding:4px 12px" onclick="window._walletStScope='${x[0]}';window._walletRerender()">${x[1]}</button>`).join('');
  let closeUI='';
  if(pb.monthKey){
    closeUI=closed
      ?`<span class="badge badge-green" title="أُقفل بتاريخ ${esc(fmtDate(closed.closedAt))}"><i class="ti ti-lock"></i> مقفل</span>
         <button class="btn btn-sm" onclick="walletCloseMonthBtn('${pb.monthKey}')"><i class="ti ti-refresh"></i> إعادة الإقفال</button>
         <button class="btn btn-sm" onclick="walletReopenMonthBtn('${pb.monthKey}')"><i class="ti ti-lock-open"></i> فتح الشهر</button>`
      :`<button class="btn btn-sm" onclick="walletCloseMonthBtn('${pb.monthKey}')" title="تجميد أرقام هالشهر (اختياري)"><i class="ti ti-lock"></i> إقفال الشهر</button>`;
  }
  const notes=[];
  if(closed&&!drift)notes.push(`<div class="table-note" style="border-radius:10px;padding:8px 12px;margin-top:10px;background:var(--success-bg);color:var(--success)"><i class="ti ti-snowflake"></i> هالأرقام من لقطة الإقفال، ما بتتغيّر بتغيّر سعر الصرف.</div>`);
  if(closed&&drift)notes.push(`<div class="table-note" style="border-radius:10px;padding:8px 12px;margin-top:10px;background:var(--warning-bg);color:var(--warning)"><i class="ti ti-alert-triangle"></i> تغيّرت حركات هالشهر بعد الإقفال. الأرقام المعروضة من لقطة الإقفال؛ اضغط "إعادة الإقفال" لتحديثها أو "فتح الشهر".</div>`);
  if(r.chainBreak)notes.push(`<div class="table-note" style="border-radius:10px;padding:8px 12px;margin-top:10px;background:var(--warning-bg);color:var(--warning)"><i class="ti ti-alert-triangle"></i> في فرق بين نهاية شهر مقفل وبداية الشهر اللي بعده. راجع حركات الشهر المقفل.</div>`);
  if(r.undated>0)notes.push(`<div class="table-note" style="border-radius:10px;padding:8px 12px;margin-top:10px;background:var(--warning-bg);color:var(--warning)"><i class="ti ti-calendar-off"></i> ${r.undated} حركة بدون تاريخ محسوبة ضمن أول المدة.</div>`);
  return `<div class="card" style="margin-bottom:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <div class="section-title" style="margin-bottom:0">كشف حساب المحفظة — ${esc(pb.label)}${infoTip('آخر المدة = أول المدة + إيراد − مصروف ± تحويلات. آخر مدة كل شهر = أول مدة الشهر اللي بعده. "مكافئ $" محسوب بسعر الصرف المحفوظ مع كل حركة، والأعمدة الفعلية بدون أي تحويل.')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <div style="display:flex;gap:4px;background:var(--bg2,rgba(0,0,0,.05));padding:3px;border-radius:8px">${scopeBtns}</div>
        ${closeUI}
      </div>
    </div>
    <div style="overflow-x:auto"><table class="wallet-st"><thead><tr><th>البند</th><th>مكافئ بالدولار</th><th>دولار فعلي</th>${hasSyp?'<th>ليرة فعلية</th>':''}</tr></thead><tbody>${rowsHTML}</tbody></table></div>
    <div style="font-size:11px;color:var(--text2);margin-top:8px">${r.count} حركة بالفترة</div>
    ${notes.join('')}
  </div>`;
}
function renderWalletCompareCard(pb,scope){
  if(!pb.from||!pb.to)return '';
  const cmp=walletCompare(pb.from,pb.to,scope);
  if(!cmp)return '';
  const fm=periodAsFullMonth(cmp.prevRange.from,cmp.prevRange.to);
  const prevLabel=fm?periodMonthLabel(fm.y,fm.m):fmtDate(cmp.prevRange.from)+' – '+fmtDate(cmp.prevRange.to);
  const cur=cmp.cur,prev=cmp.prev;
  const items=[
    ['إيراد',cur.usd.income,prev.usd.income,'up'],
    ['مصروف',-cur.usd.expense,-prev.usd.expense,'down'],
    ['صافي الحركة',cur.usd.close-cur.usd.open,prev.usd.close-prev.usd.open,'up'],
    ['آخر المدة',cur.usd.close,prev.usd.close,'up']
  ];
  const rows=items.map(it=>{
    const d=it[1]-it[2],good=(it[3]==='up')?d>=0:d<=0;
    const pct=it[2]!==0?Math.round(d/Math.abs(it[2])*100):null;
    return `<tr><td style="font-weight:600">${it[0]}</td><td>${walletFmtC(it[1],'USD',false)}</td><td>${walletFmtC(it[2],'USD',false)}</td>
      <td style="color:${d===0?'var(--text2)':(good?'var(--success)':'var(--danger)')};font-weight:700">${d===0?'—':walletFmtC(d,'USD',true)}${pct!==null&&d!==0?` <span style="font-size:11px">(${d>0?'+':'−'}${Math.abs(pct)}%)</span>`:''}</td></tr>`;
  }).join('');
  return `<div class="card" style="margin-bottom:18px">
    <div class="section-title">مقارنة بالفترة السابقة (${esc(prevLabel)})${infoTip('نفس النطاق (كل الكاش / شخصي / شركة) ونفس الطول. الأرقام بالمكافئ بالدولار.')}</div>
    <div style="overflow-x:auto"><table class="wallet-st"><thead><tr><th>البند</th><th>${esc(pb.fullMonth?periodMonthLabel(pb.fullMonth.y,pb.fullMonth.m):'هالفترة')}</th><th>${esc(prevLabel)}</th><th>الفرق</th></tr></thead><tbody>${rows}</tbody></table></div>
  </div>`;
}
function renderWalletMonthsCard(pb,scope){
  const ser=walletMonthlySeries(pb.from,pb.to,scope);
  if(ser.rows.length<2)return {html:'',series:ser};
  const sum=k=>ser.rows.reduce((s,r)=>s+r.usd[k],0);
  const tot={income:sum('income'),expense:sum('expense'),internal:sum('internal'),exchange:sum('exchange'),adjust:sum('adjust')};
  const first=ser.rows[0],last=ser.rows[ser.rows.length-1];
  const trs=ser.rows.map(r=>`<tr><td>${esc(r.label)}${r.frozen?' <i class="ti ti-lock" title="مقفل" style="font-size:11px"></i>':''}${r.full?'':' <span style="font-size:10px;color:var(--text2)">(جزئي)</span>'}</td>
    <td>${walletFmtC(r.usd.open,'USD',false)}</td><td style="color:var(--success)">${walletFmtC(r.usd.income,'USD',true)}</td><td style="color:var(--danger)">${walletFmtC(r.usd.expense,'USD',true)}</td>
    <td>${walletFmtC(r.usd.internal+r.usd.exchange+(r.usd.adjust||0),'USD',true)}</td><td style="font-weight:700">${walletFmtC(_wsCloseOf(r.usd),'USD',false)}</td></tr>`).join('');
  const html=`<div class="card" style="margin-bottom:18px">
    <div class="section-title">الأشهر بالفترة${infoTip('مجموع الإيراد والمصروف عبر الأشهر = إجمالي الفترة بكشف الحساب. آخر المدة لكل شهر = أول المدة للشهر اللي بعده.')}</div>
    ${ser.truncated?'<div style="font-size:11px;color:var(--text2);margin-bottom:6px">معروض آخر 36 شهر بس.</div>':''}
    <div style="position:relative;width:100%;height:240px"><canvas id="walletMonthsChart"></canvas></div>
    <details style="margin-top:10px"><summary style="cursor:pointer;font-size:12.5px;font-weight:700">جدول الأشهر</summary>
      <div style="overflow-x:auto;margin-top:8px"><table class="wallet-st"><thead><tr><th>الشهر</th><th>أول المدة</th><th>إيراد</th><th>مصروف</th><th>تحويلات / تسوية</th><th>آخر المدة</th></tr></thead><tbody>${trs}</tbody>
      <tfoot><tr class="summary-row"><td>المجموع</td><td>${walletFmtC(first.usd.open,'USD',false)}</td><td>${walletFmtC(tot.income,'USD',true)}</td><td>${walletFmtC(tot.expense,'USD',true)}</td><td>${walletFmtC(tot.internal+tot.exchange+tot.adjust,'USD',true)}</td><td>${walletFmtC(_wsCloseOf(last.usd),'USD',false)}</td></tr></tfoot></table></div>
    </details>
  </div>`;
  return {html,series:ser};
}
function drawWalletMonthsChart(ser){
  const el=document.getElementById('walletMonthsChart');
  if(!el||typeof Chart==='undefined'||!ser||ser.rows.length<2)return;
  if(window._walletMonthsChartInstance){try{window._walletMonthsChartInstance.destroy();}catch(e){}}
  const cs=getComputedStyle(document.documentElement);
  const cv=(n,d)=>(cs.getPropertyValue(n).trim()||d);
  window._walletMonthsChartInstance=new Chart(el,{
    data:{labels:ser.rows.map(r=>r.label),datasets:[
      {type:'bar',label:'إيراد',data:ser.rows.map(r=>r.usd.income/100),backgroundColor:cv('--success','#1B7A43'),borderRadius:4,yAxisID:'y'},
      {type:'bar',label:'مصروف',data:ser.rows.map(r=>-r.usd.expense/100),backgroundColor:cv('--danger','#B3261E'),borderRadius:4,yAxisID:'y'},
      {type:'line',label:'آخر المدة',data:ser.rows.map(r=>_wsCloseOf(r.usd)/100),borderColor:cv('--accent','#28455F'),backgroundColor:cv('--accent','#28455F'),tension:.25,pointRadius:3,yAxisID:'y2'}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      scales:{y:{beginAtZero:true,ticks:{callback:v=>'$'+Number(v).toLocaleString()}},y2:{position:'right',grid:{drawOnChartArea:false},ticks:{callback:v=>'$'+Number(v).toLocaleString()}}},
      plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>' '+c.dataset.label+': $'+(Math.round(c.raw*100)/100).toLocaleString()}}}}
  });
}

function exportWalletExcel(){
  const rows=walletAllEntries().slice().sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
  const headers=['التاريخ','النوع','الجيب','الفئة الرئيسية','الفئة الفرعية','الجهة المرتبطة','المبلغ','العملة','ملاحظة'];
  const dataRows=rows.map(e=>{
    const cat=(db.wallet.categories||[]).find(c=>c.id===e.catId);
    const sub=cat?(cat.subs||[]).find(s=>s.id===e.subId):null;
    const sourceLabel=e.source==='pocketTransfer'?'تحويل داخلي (أرباح)':e.source==='companyHandover'?'تسليم للشركة':e.source==='companyReimburse'?'ردّ الشركة':e.source==='companyAdvance'?'دفعة من الشركة (عهدة)':walletIsCompany(e)?(e.type==='income'?'قبض من زبون':'مصروف عمل'):e.source==='profit'?'سحب من أرباح الشركة':(e.source==='debtSettlement'?'تسديد/تحصيل دين':(e.source==='currencyExchange'?'تحويل عملة':(e.source==='debtCreation'?'دين (كاش فعلي)':'—')));
    const typeLabel=e.source==='currencyExchange'?'تحويل عملة':(e.type==='income'?'إيراد':'مصروف');
    return [e.date||'',typeLabel,walletIsCompany(e)?'شركة':'شخصي',cat?cat.name:sourceLabel,sub?sub.name:'',(e.linkType&&e.linkId)?(walletKindLabel(e.linkType)+': '+(walletEntityLabel(e.linkType,e.linkId)||e.linkLabel||'')):'',e.amount||0,curLabel(e.currency||'USD'),e.note||''];
  });
  exportRowsToExcel('المحفظة_الشخصية','المحفظة',headers,dataRows);
}

function renderWallet(el,acts){
  if(!isAdmin()){el.innerHTML='<div class="empty-state"><i class="ti ti-lock"></i>هذا القسم متاح للمدير فقط</div>';return;}
  const bal=walletBalanceUSD();
  const balSplit=walletBalanceByCurrency();
  const q=(window._walletSearch||'').trim().toLowerCase();
  const typeFilter=window._walletType||'all';
  const pocketFilter=window._walletPocket||'all';
  const companyPocket=walletCompanyPocketUSD();
  const personalBal=bal-companyPocket;
  const hasCompany=walletAllEntries().some(walletIsCompany);
  const chartMode=window._walletChartMode||'main';
  // نطاق مخطط توزيع المصاريف: الكل (شخصي + شركة بتمييز بسيط) / شخصي / شركة
  // الافتراضي الآن "شخصي" (بدون حركات الشركة) لحد ما المستخدم يغيّرو يدوياً
  const chartScope=window._walletChartScope||'personal';
  const chartSrc=e=>e.type==='expense'&&e.source!=='currencyExchange'&&e.source!=='balanceAdjust'&&e.source!=='pocketTransfer'&&e.source!=='companyHandover'&&(chartScope==='all'||(chartScope==='company'?walletIsCompany(e):!walletIsCompany(e)));
  // T22: مكوّن الفترة الموحّد (الافتراضي: الشهر الحالي)
  window._walletRerender=function(){renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'));};
  if(typeof Chart==='undefined'&&!window._walletChartLoading){
    window._walletChartLoading=true;
    loadLib('chart').then(function(){window._walletChartLoading=false;if(currentPage==='wallet')window._walletRerender();}).catch(function(e){window._walletChartLoading=false;console.error('chart.js load failed:',e);});
  }
  const pb=periodResolve('wallet');
  const stScope=window._walletStScope||'all';
  const periodEntries=walletAllEntries().filter(e=>walletInPeriod(e,pb));
  const chartEntries=periodEntries.filter(e=>chartSrc(e)&&(+e.amount||0)>0);
  const chartHasData=chartEntries.length>0;
  const chartHasCompany=chartEntries.some(walletIsCompany);
  const rows=periodEntries.slice().filter(e=>{
    const text=[e.note||'',walletCatName(e.catId,e.subId)].join(' ').toLowerCase();
    return (!q||text.includes(q))&&(typeFilter==='all'||e.type===typeFilter)&&(pocketFilter==='all'||(pocketFilter==='company'?walletIsCompany(e):!walletIsCompany(e)));
  }).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  const totalIncome=walletAllEntries().filter(e=>e.type==='income'&&e.source!=='currencyExchange'&&e.source!=='balanceAdjust'&&!walletIsCompany(e)).reduce((s,e)=>s+walletEntryUSD(e),0);
  const totalExpense=walletAllEntries().filter(e=>e.type==='expense'&&e.source!=='currencyExchange'&&e.source!=='balanceAdjust'&&!walletIsCompany(e)).reduce((s,e)=>s+walletEntryUSD(e),0);
  const compIncome=walletAllEntries().filter(e=>walletIsCompany(e)&&e.type==='income'&&!e.source).reduce((s,e)=>s+walletEntryUSD(e),0);
  const compExpense=walletAllEntries().filter(e=>walletIsCompany(e)&&e.type==='expense'&&!e.source).reduce((s,e)=>s+walletEntryUSD(e),0);
  const chip=(lbl,val,color)=>`<span style="display:inline-flex;align-items:center;gap:5px;background:var(--bg2,rgba(0,0,0,.05));border-radius:20px;padding:4px 10px;font-size:12px"><span style="color:var(--text2)">${lbl}</span> <b style="color:${color}">${fmtUSD(val)}</b></span>`;
  const threshold=(db.wallet&&+db.wallet.lowBalanceAlert)||0;
  const lowBalanceWarn=personalBal<threshold;
  // مجموع فرق الصرف التراكمي من كل عمليات "تحويل بين العملات" — منجمعه من إدخال
  // الدخل بس (income) بكل عملية تحويل حتى ما نعده مرتين (كل تحويل بيسجّل قيد
  // مصروف وقيد دخل، وكلاهم عندهم نفس fxDiffUSD).
  const totalFxDiff=walletAllEntries().filter(e=>e.source==='currencyExchange'&&e.type==='income'&&typeof e.fxDiffUSD==='number').reduce((s,e)=>s+e.fxDiffUSD,0);

  const monthsCard=renderWalletMonthsCard(pb,stScope);

  acts.innerHTML=`
    <button class="btn" onclick="exportWalletExcel()"><i class="ti ti-file-spreadsheet"></i> تصدير Excel</button>
    <div class="row-menu-wrap">
      <button class="btn" onclick="toggleRowMenu(this,event)"><i class="ti ti-dots"></i> المزيد</button>
      <div class="row-menu-list">
        <button class="row-menu-item" onclick="renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'))"><i class="ti ti-refresh"></i> تحديث</button>
        <button class="row-menu-item" onclick="openWalletNewPeriodModal()"><i class="ti ti-player-play"></i> بدء فترة جديدة (أرشفة القديم)</button>
        <button class="row-menu-item" onclick="openWalletCategoriesModal()"><i class="ti ti-list"></i> إدارة الفئات</button>
        <button class="row-menu-item" onclick="openWalletBudgetsModal()"><i class="ti ti-target"></i> ميزانيات الفئات</button>
        <button class="row-menu-item" onclick="openWalletProfitPullModal()"><i class="ti ti-building-bank"></i> سحب من الشركة (دفعة / أرباح)</button>
      </div>
    </div>
    <button class="btn" onclick="openWalletSettleModal()"><i class="ti ti-checkup-list"></i> تخريج مشروع / عمل</button>
    <button class="btn" onclick="openWalletExchangeModal()"><i class="ti ti-arrows-exchange"></i> تحويل بين العملات</button>
    <button class="btn" onclick="openWalletDebtModal()"><i class="ti ti-notes"></i> تسجيل دين</button>
    <button class="btn btn-primary" onclick="openWalletEntryModal()"><i class="ti ti-plus"></i> تسجيل حركة</button>
  `;

  el.innerHTML=`
  <div class="module-header">
    <div>
      <div class="module-title"><i class="ti ti-wallet"></i> المحفظة الشخصية</div>
      <div class="module-subtitle">خاصة فيك وحدك.</div>
    </div>
  </div>
  ${lowBalanceWarn?`<div class="table-note" style="background:var(--danger-bg,#fee2e2);color:var(--danger);border:1px solid var(--danger);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-weight:600"><i class="ti ti-alert-triangle"></i> تنبيه: رصيدك الشخصي (${fmtUSD(personalBal)}) تحت حد التنبيه يلي حددتو (${fmtUSD(threshold)}).</div>`:''}
  ${Math.abs(totalFxDiff)>=0.5?`<div class="table-note" style="background:${totalFxDiff>0?'var(--success-bg)':'var(--danger-bg)'};color:${totalFxDiff>0?'var(--success)':'var(--danger)'};border:1px solid ${totalFxDiff>0?'var(--success)':'var(--danger)'};border-radius:10px;padding:10px 14px;margin-bottom:14px;font-weight:600">
    <i class="ti ti-arrows-exchange"></i> إجمالي فرق الصرف التراكمي من عمليات "تحويل بين العملات": ${totalFxDiff>0?'+':''}${fmt(totalFxDiff)}$${infoTip('هاد الرقم هو الفرق المتراكم بين سعر الصرف يلي استعملتو فعلياً بتحويلاتك وسعر إعدادات الشركة الحالي. هو جزء من رصيدك الحالي أصلاً، هون بس منوضّحلك من وين إجا.')}
  </div>`:''}
  <div class="grid-4" style="margin-bottom:18px">
    <div class="metric-card" style="--accent:${bal>=0?'var(--success)':'var(--danger)'}"><div class="metric-label"><i class="ti ti-wallet"></i> الرصيد الحالي (معك كاش) ($)</div><div class="metric-value ${bal>=0?'green':'red'}">${fmtUSD(bal)}</div>
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:8px">
        <span style="display:inline-flex;align-items:center;gap:5px;background:var(--bg2,rgba(0,0,0,.05));border-radius:20px;padding:4px 10px;font-size:12px">
          <span style="width:6px;height:6px;border-radius:50%;background:var(--gold,#B8862E)"></span>
          <b style="color:var(--text)">${fmt(balSplit.usd)}</b><span style="color:var(--text2)">$</span>
        </span>
        ${balSplit.syp?`<span style="display:inline-flex;align-items:center;gap:5px;background:var(--bg2,rgba(0,0,0,.05));border-radius:20px;padding:4px 10px;font-size:12px">
          <span style="width:6px;height:6px;border-radius:50%;background:var(--info,#13324F)"></span>
          <b style="color:var(--text)">${fmt(balSplit.syp)}</b><span style="color:var(--text2)">ل.س</span>
        </span>`:''}
        <button class="btn btn-sm" style="padding:3px 10px;border-radius:20px" onclick="openWalletExchangeModal()" title="حوّل جزء من الدولار لليرة أو العكس"><i class="ti ti-arrows-exchange"></i> تحويل</button>
      </div>
      ${true?`<div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:8px;font-size:12px">
        <span style="display:inline-flex;align-items:center;gap:5px;background:var(--bg2,rgba(0,0,0,.05));border-radius:20px;padding:4px 10px"><i class="ti ti-user"></i> شخصي: <b style="color:${personalBal>=0?'var(--success)':'var(--danger)'}">${fmtUSD(personalBal)}</b></span>
        <span style="display:inline-flex;align-items:center;gap:5px;background:var(--bg2,rgba(0,0,0,.05));border-radius:20px;padding:4px 10px"><i class="ti ti-building"></i> للشركة: <b style="color:${companyPocket>=0?'var(--gold,#B8862E)':'var(--danger)'}">${fmtUSD(companyPocket)}</b></span>
        ${infoTip('الكاش الكلي فوق = شخصي + للشركة. "للشركة" موجب = فلوس الشركة يلي معك (قبضتها ولسا ما خرّجتها). سالب = دفعت مصاريف شركة من جيبك والشركة مدينة إلك.')}
      </div>`:''}
    </div>
    <div class="metric-card" style="--accent:var(--success)"><div class="metric-label"><i class="ti ti-arrow-down-left"></i> إجمالي الإيرادات (كل الفترات) ($)</div><div class="metric-value green">${fmtUSD(totalIncome+compIncome)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${chip('عامة',totalIncome,'var(--success)')}${chip('شركة',compIncome,'var(--gold,#B8862E)')}</div></div>
    <div class="metric-card" style="--accent:var(--danger)"><div class="metric-label"><i class="ti ti-arrow-up-right"></i> إجمالي المصاريف (كل الفترات) ($)</div><div class="metric-value red">${fmtUSD(totalExpense+compExpense)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${chip('عامة',totalExpense,'var(--danger)')}${chip('شركة (مصاريف عمل)',compExpense,'var(--gold,#B8862E)')}</div></div>
    <div class="metric-card" style="--accent:var(--gold)"><div class="metric-label"><i class="ti ti-adjustments"></i> الرصيد الافتتاحي / حد التنبيه ($)${infoTip('كاشك الفعلي وحد التنبيه.')}</div><div class="metric-value amber" style="font-size:16px">${fmtUSD((db.wallet&&+db.wallet.openingBalance)||0)} <button class="btn btn-sm" style="margin-right:6px" onclick="openWalletOpeningModal()" title="تعديل الرصيد الافتتاحي"><i class="ti ti-edit"></i></button></div>
      <button class="btn btn-sm btn-primary" style="margin-top:8px" onclick="openWalletNewPeriodModal()" title="أرشفة القديم وبدء فترة جديدة برصيدك الفعلي"><i class="ti ti-player-play"></i> بدء فترة جديدة</button></div>
  </div>
  <div class="card" style="margin-bottom:18px">${periodBarHTML('wallet',window._walletRerender)}</div>
  ${renderWalletStatementCard(pb,stScope)}
  ${renderWalletCompareCard(pb,stScope)}
  ${monthsCard.html}
  <div class="card" style="margin-bottom:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:2px">
      <div class="section-title" style="margin-bottom:0">توزيع المصاريف ${chartMode==='detail'?'حسب الفئة الفرعية':'حسب الفئة'} (الفترة المختارة)</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <div style="display:flex;gap:4px;background:var(--bg2,rgba(0,0,0,.05));padding:3px;border-radius:8px">
        ${[['all','الكل'],['personal','شخصي'],['company','شركة']].map(x=>`<button class="btn btn-sm ${chartScope===x[0]?'btn-primary':''}" style="padding:4px 12px" onclick="window._walletChartScope='${x[0]}';renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'))">${x[1]}</button>`).join('')}
      </div>
      <div style="display:flex;gap:4px;background:var(--bg2,rgba(0,0,0,.05));padding:3px;border-radius:8px">
        <button class="btn btn-sm ${chartMode==='main'?'btn-primary':''}" style="padding:4px 12px" onclick="window._walletChartMode='main';renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'))">شامل</button>
        <button class="btn btn-sm ${chartMode==='detail'?'btn-primary':''}" style="padding:4px 12px" onclick="window._walletChartMode='detail';renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'))">تفاصيل</button>
      </div>
      </div>
    </div>
    ${chartScope==='all'&&chartHasCompany?`<div style="display:flex;gap:14px;font-size:11.5px;color:var(--text2);margin:6px 0 2px"><span><span style="display:inline-block;width:12px;height:10px;border-radius:3px;background:var(--text2);vertical-align:middle"></span> شخصي</span><span><span style="display:inline-block;width:12px;height:10px;border-radius:3px;background:var(--text2);opacity:.4;vertical-align:middle"></span> شركة (نفس لون الفئة، أفتح)</span></div>`:''}
    ${chartHasData?`<div style="position:relative;box-sizing:border-box;width:100%" id="walletCatChartWrap"><canvas id="walletCatChart"></canvas></div>`:`<div class="empty-state" style="padding:20px"><i class="ti ti-chart-pie"></i><p>لا يوجد مصاريف ${chartScope==='company'?'شركة ':(chartScope==='personal'?'شخصية ':'')}بهالفترة</p></div>`}
  </div>
  ${renderWalletBudgetsBoard(pb)}
  ${renderWalletCompanyPocketSection()}
  ${renderWalletDebtsSection()}
  <div class="module-tools" style="margin-bottom:14px">
    <input class="form-control soft-input" placeholder="بحث بالملاحظة أو الفئة..." value="${esc(window._walletSearch||'')}" oninput="window._walletSearch=this.value;renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
    <select class="form-control" onchange="window._walletType=this.value;renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
      <option value="all" ${typeFilter==='all'?'selected':''}>الكل</option>
      <option value="income" ${typeFilter==='income'?'selected':''}>إيراد</option>
      <option value="expense" ${typeFilter==='expense'?'selected':''}>مصروف</option>
    </select>
    <select class="form-control" onchange="window._walletPocket=this.value;renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
      <option value="all" ${pocketFilter==='all'?'selected':''}>كل الجيوب</option>
      <option value="personal" ${pocketFilter==='personal'?'selected':''}>الشخصي</option>
      <option value="company" ${pocketFilter==='company'?'selected':''}>الشركة</option>
    </select>
  </div>
  <div class="card"><div style="overflow-x:auto">${!rows.length?`<div class="empty-state"><i class="ti ti-wallet"></i><p>لا يوجد حركات مسجّلة بهالفترة</p></div>`:`
    <table class="responsive-table"><thead><tr><th>التاريخ</th><th>النوع</th><th>الفئة</th><th>المبلغ</th><th>ملاحظة</th><th></th></tr></thead><tbody>
      ${rows.map(e=>`<tr style="border-inline-start:3px solid ${(e.source==='currencyExchange'||e.source==='pocketTransfer')?'var(--gold-dark)':(e.type==='income'?'var(--success)':'var(--danger)')}">
        <td data-label="التاريخ">${fmtDate(e.date)}</td>
        <td data-label="النوع">${walletRowBadgeHTML(e)}</td>
        <td data-label="الفئة">${walletRowCategoryHTML(e)}</td>
        <td data-label="المبلغ" style="font-weight:700">${fmt(e.amount)} <span style="font-size:10px;color:var(--text2)">${curLabel(e.currency||'USD')}</span></td>
        <td data-label="ملاحظة">${esc(e.note||'')}</td>
        <td data-label=""><div class="row-menu-wrap">
          <button class="row-menu-btn" onclick="toggleRowMenu(this,event)">⋮</button>
          <div class="row-menu-list">
            ${walletEntryLocked(e)?'':`<button class="row-menu-item" onclick="openWalletEntryModal('${e.id}')"><i class="ti ti-edit"></i> تعديل</button>`}
            <button class="row-menu-item danger" onclick="deleteWalletEntry('${e.id}')"><i class="ti ti-trash"></i> حذف</button>
          </div>
        </div></td>
      </tr>`).join('')}
    </tbody></table>`}</div></div>`;

  if(chartHasData){
    const catEl=document.getElementById('walletCatChart');
    if(catEl&&typeof Chart!=='undefined'){
      // بالاتة منسّقة (نفس درجة التشبّع/الإضاءة تقريباً) بحيث الألوان تبين مجموعة متناسقة
      // وليس تشكيلة عشوائية، مبنية حوالين لون الذهب الأساسي للتطبيق (--gold) وتدرجاتها.
      const palette=['#B8874A','#2E5C88','#3E8B6B','#A4463C','#6B5B95','#3E8FA0','#C79A4B','#5B7A9E','#9C5B7A','#7A8B3E','#4A6B6B','#8A5C8A'];
      const catList=(db.wallet.categories||[]).filter(c=>(c.kind||'expense')==='expense');
      const catColor={};
      catList.forEach((c,i)=>{catColor[c.id]=palette[i%palette.length];});
      let labels,pData,cData,colors;
      if(chartMode==='detail'){
        // تجميع حسب الفئة الرئيسية + الفرعية معاً، مرتّبة بحيث تبقى فئات كل
        // فئة رئيسية متجاورة، وكل فئة فرعية تاخد درجة مختلفة من نفس لون فئتها
        // الرئيسية — هيك تعرف بلمحة أي شريحة تابعة لأي فئة.
        const groups=[],byKey={};
        chartEntries.forEach(e=>{
          const cat=(db.wallet.categories||[]).find(c=>c.id===e.catId);
          const sub=cat?(cat.subs||[]).find(s=>s.id===e.subId):null;
          const key=(e.catId||'—')+'|'+(e.subId||'');
          if(!byKey[key]){
            const g={catId:e.catId,catName:cat?cat.name:'أخرى',label:cat?(sub?cat.name+' - '+sub.name:cat.name):'أخرى',total:0,p:0,c:0};
            byKey[key]=g;groups.push(g);
          }
          const v=walletEntryUSD(e);byKey[key].total+=v;if(walletIsCompany(e))byKey[key].c+=v;else byKey[key].p+=v;
        });
        const order=catList.map(c=>c.id);
        groups.sort((a,b)=>{const ia=order.indexOf(a.catId),ib=order.indexOf(b.catId);return (ia<0?999:ia)-(ib<0?999:ib);});
        const shadeN={};
        groups.forEach(g=>{
          const base=catColor[g.catId]||'#6b7280';
          const n=shadeN[g.catId]||0;shadeN[g.catId]=n+1;
          const step=Math.ceil(n/2)*20;
          g.color=n===0?base:walletShade(base,n%2===1?step:-step);
        });
        // ترتيب تنازلي حسب القيمة لسهولة القراءة بالرسم واللائحة معاً (مع الحفاظ على مجموعة "أخرى" إذا وجدت)
        groups.sort((a,b)=>b.total-a.total);
        labels=groups.map(g=>g.label);pData=groups.map(g=>g.p);cData=groups.map(g=>g.c);colors=groups.map(g=>g.color);
      }else{
        const byCat={};
        chartEntries.forEach(e=>{
          const cat=(db.wallet.categories||[]).find(c=>c.id===e.catId);
          const key=cat?cat.id:'—';
          if(!byCat[key])byCat[key]={label:cat?cat.name:'أخرى',total:0,p:0,c:0,color:cat?catColor[cat.id]:'#6b7280'};
          const v=walletEntryUSD(e);byCat[key].total+=v;if(walletIsCompany(e))byCat[key].c+=v;else byCat[key].p+=v;
        });
        const list=Object.values(byCat).sort((a,b)=>b.total-a.total);
        labels=list.map(x=>x.label);pData=list.map(x=>x.p);cData=list.map(x=>x.c);colors=list.map(x=>x.color);
      }
      if(window._walletCatChartInstance){try{window._walletCatChartInstance.destroy();}catch(e){}}
      const data=pData.map((v,i)=>v+cData[i]);
      const total=data.reduce((a,b)=>a+b,0);
      // ارتفاع ديناميكي حسب عدد الأعمدة حتى تضل واضحة ومريحة ومو مزحومة عبعض
      const wrapEl=document.getElementById('walletCatChartWrap');
      const rowH=chartMode==='detail'?30:38;
      if(wrapEl)wrapEl.style.height=Math.max(180,Math.min(560,labels.length*rowH+30))+'px';
      const ctx2d=catEl.getContext('2d');
      const barColors=colors.map((c,i)=>{
        const grad=ctx2d.createLinearGradient(0,0,catEl.width||300,0);
        grad.addColorStop(0,walletShade(c,-8));
        grad.addColorStop(1,c);
        return grad;
      });
      // الشركة بنفس لون الفئة بس أفتح — تمييز بسيط جوّا نفس العمود
      const companyColors=colors.map(c=>walletShade(c,45));
      window._walletCatChartInstance=new Chart(catEl,{
        type:'bar',
        data:{labels,datasets:[{
          label:'شخصي',
          data:pData,
          backgroundColor:barColors,
          borderRadius:6,
          borderSkipped:false,
          barPercentage:0.72,
          categoryPercentage:0.82
        },{
          label:'شركة',
          data:cData,
          backgroundColor:companyColors,
          borderColor:colors,
          borderWidth:1,
          borderRadius:6,
          borderSkipped:false,
          barPercentage:0.72,
          categoryPercentage:0.82
        }]},
        options:{
          indexAxis:'y',
          responsive:true,maintainAspectRatio:false,
          layout:{padding:{left:6,right:70,top:4,bottom:4}},
          scales:{
            x:{
              stacked:true,
              beginAtZero:true,
              suggestedMax:Math.max(...data,1)*1.05,
              grid:{color:'rgba(120,120,120,.12)',drawBorder:false},
              ticks:{callback:v=>'$'+Number(v).toLocaleString(),font:{size:11}}
            },
            y:{
              stacked:true,
              grid:{display:false,drawBorder:false},
              ticks:{font:{size:12,weight:'600'},autoSkip:false}
            }
          },
          plugins:{
            legend:{display:false},
            tooltip:{
              filter:item=>item.raw>0,
              callbacks:{
                label:c=>{const pct=total?Math.round(c.raw/total*100):0;return ' '+c.dataset.label+': $'+Math.round(c.raw*100)/100+' ('+pct+'%)';},
                footer:items=>{const i=items[0].dataIndex;return (pData[i]>0&&cData[i]>0)?'الإجمالي: $'+Math.round(data[i]*100)/100:'';}
              }
            }
          }
        },
        plugins:[{
          id:'walletCatValueLabels',
          afterDatasetsDraw(chart){
            const {ctx}=chart;
            const meta=chart.getDatasetMeta(1); // آخر جزء بالعمود المتراكم = نهاية العمود كامل
            ctx.save();
            ctx.font='600 11px inherit';
            ctx.textBaseline='middle';
            meta.data.forEach((bar,i)=>{
              const val=data[i];const pct=total?Math.round(val/total*100):0;
              const label='$'+Math.round(val).toLocaleString()+'  ·  '+pct+'%';
              ctx.fillStyle=(getComputedStyle(document.body).getPropertyValue('--text')||'#333').trim()||'#333';
              ctx.textAlign='left';
              ctx.fillText(label,bar.x+8,bar.y);
            });
            ctx.restore();
          }
        }]
      });
    }
  }
  drawWalletMonthsChart(monthsCard.series);
}

/* ===== ميزانيات شهرية لكل فئة رئيسية (اختياري) ===== */
function renderWalletBudgetsBoard(pb){
  const budgets=db.wallet.budgets||{};
  const catIds=Object.keys(budgets).filter(id=>+budgets[id]>0);
  if(!catIds.length)return '';
  // الميزانية شهرية بطبيعتها: لو الفترة المختارة شهر كامل بتنحسب عليه، وغير هيك على الشهر الحالي. (T22: مقارنة نصّية بالتاريخ المحلي)
  const nowD=new Date();
  const mb=(pb&&pb.fullMonth)?periodMonthBounds(pb.fullMonth.y,pb.fullMonth.m):periodMonthBounds(nowD.getFullYear(),nowD.getMonth());
  const mLabel=(pb&&pb.fullMonth)?periodMonthLabel(pb.fullMonth.y,pb.fullMonth.m):'هالشهر';
  const monthEntries=walletAllEntries().filter(e=>e.type==='expense'&&!walletIsCompany(e)&&periodInRange(e.date,mb.from,mb.to));
  return `<div class="card" style="margin-bottom:18px">
    <div class="section-title">ميزانيات الفئات — ${esc(mLabel)}${infoTip('مصروفك مقابل السقف.')}</div>
    ${catIds.map(catId=>{
      const cat=(db.wallet.categories||[]).find(c=>c.id===catId);
      if(!cat)return '';
      const limit=+budgets[catId]||0;
      const spent=monthEntries.filter(e=>e.catId===catId).reduce((s,e)=>s+walletEntryUSD(e),0);
      const pct=limit>0?Math.min(100,Math.round(spent/limit*100)):0;
      const over=spent>limit;
      return `<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span style="font-weight:700">${esc(cat.name)}</span>
          <span style="color:${over?'var(--danger)':'var(--text2)'}">${fmtUSD(spent)} / ${fmtUSD(limit)}</span>
        </div>
        <div style="background:var(--bg2);border-radius:8px;height:10px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${over?'var(--danger)':(pct>80?'#B8862E':'#1B7A43')}"></div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}
function openWalletBudgetsModal(){
  showModal(`<div class="modal-title">ميزانيات الفئات الشهرية</div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:12px">سقف شهري بالدولار.</div>
    ${(db.wallet.categories||[]).map(c=>`<div class="form-group" style="margin-bottom:10px"><label class="form-label">${esc(c.name)}</label><input type="text" inputmode="decimal" class="form-control" id="wb-${c.id}" value="${(db.wallet.budgets&&db.wallet.budgets[c.id])?fmt(db.wallet.budgets[c.id]):''}" oninput="formatMoneyInput(this)" placeholder="0"></div>`).join('')}
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveWalletBudgets()">حفظ</button>
    </div>`);
}
function saveWalletBudgets(){
  if(!db.wallet.budgets)db.wallet.budgets={};
  (db.wallet.categories||[]).forEach(c=>{
    const el=document.getElementById('wb-'+c.id);
    const v=el?unformatNum(el.value):0;
    if(v>0)db.wallet.budgets[c.id]=v;else delete db.wallet.budgets[c.id];
  });
  saveDB(db);closeModal();renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

/* ===== واجهة قسم الديون (لي / عليّ) — كل دين ممكن يكون فيه جزء دولار
   وجزء ليرة بنفس الوقت (نفس الشخص أو أشخاص مختلفين، كل واحد بعملته). ===== */
function renderWalletDebtsSection(){
  const debts=walletAllDebts().slice().sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  const sum=walletDebtsSummaryUSD();
  const amountCell=(usd,syp)=>{
    const parts=[];
    if(usd>0)parts.push(fmt(usd)+' <span style="font-size:10px;color:var(--text2)">$</span>');
    if(syp>0)parts.push(fmt(syp)+' <span style="font-size:10px;color:var(--text2)">ل.س</span>');
    return parts.join('<br>')||'—';
  };
  return `<div class="card" style="margin-bottom:18px">
    <div class="section-title">الديون (لي وعليّ)${infoTip('لي = إلك عند حدا. عليّ = عليك لحدا.')}</div>
    <div class="kpi-strip" style="margin-bottom:${debts.length?'14px':'0'}">
      <div class="kpi-mini"><div class="label">لي (مستحق لي) ($)</div><div class="value" style="color:var(--info)">${fmtUSD(sum.creditor)}</div></div>
      <div class="kpi-mini"><div class="label">عليّ (مستحق عليّ) ($)</div><div class="value" style="color:var(--gold-dark)">${fmtUSD(sum.debtor)}</div></div>
      <div class="kpi-mini"><div class="label">الصافي ($)</div><div class="value" style="color:${sum.net>=0?'var(--success)':'var(--danger)'}">${fmtUSD(sum.net)}</div></div>
    </div>
    ${!debts.length?'':`<div style="overflow-x:auto"><table class="responsive-table"><thead><tr><th>الشخص</th><th>النوع</th><th>المبلغ الأصلي</th><th>المتبقي</th><th>التاريخ</th><th>ملاحظة</th><th></th></tr></thead><tbody>
      ${debts.map(d=>{
        const remUSD=walletDebtRemainingUSD(d),remSYP=walletDebtRemainingSYP(d);
        const settled=walletDebtIsSettled(d);
        return `<tr style="border-inline-start:3px solid ${d.type==='debtor'?'var(--gold-dark)':'var(--info)'}">
          <td data-label="الشخص">${esc(d.person||'—')}</td>
          <td data-label="النوع"><span class="badge ${d.type==='debtor'?'badge-amber':'badge-blue'}">${d.type==='debtor'?'عليّ (مستحق عليّ)':'لي (مستحق لي)'}</span></td>
          <td data-label="المبلغ الأصلي">${amountCell(+d.amountUSD||0,+d.amountSYP||0)}</td>
          <td data-label="المتبقي" style="font-weight:700">${settled?'<span class=\"badge badge-green\">مسدد بالكامل</span>':amountCell(remUSD,remSYP)}</td>
          <td data-label="التاريخ">${fmtDate(d.date)}</td>
          <td data-label="ملاحظة">${esc(d.note||'')}</td>
          <td data-label=""><div class="row-menu-wrap">
            <button class="row-menu-btn" onclick="toggleRowMenu(this,event)">⋮</button>
            <div class="row-menu-list">
              ${settled?'':`<button class="row-menu-item" onclick="openWalletDebtSettleModal('${d.id}')"><i class="ti ti-cash"></i> تسديد</button>`}
              <button class="row-menu-item" onclick="openWalletDebtModal('${d.id}')"><i class="ti ti-edit"></i> تعديل</button>
              <button class="row-menu-item danger" onclick="deleteWalletDebt('${d.id}')"><i class="ti ti-trash"></i> حذف</button>
            </div>
          </div></td>
        </tr>`;
      }).join('')}
    </tbody></table></div>`}
  </div>`;
}
function walletDebtAffectsLabel(type){
  return type==='debtor' ? 'إيراد بالرصيد' : 'مصروف بالرصيد';
}
function onWalletDebtTypeChange(){
  const lbl=document.getElementById('wd-affects-label');
  if(lbl)lbl.textContent=walletDebtAffectsLabel(document.getElementById('wd-type').value==='debtor'?'debtor':'creditor');
}
function openWalletDebtModal(id=''){
  const d=walletAllDebts().find(x=>x.id===id);
  const type=d?d.type:'creditor';
  showModal(`<div class="modal-title">${d?'تعديل دين':'تسجيل دين'}</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">النوع</label><select class="form-control" id="wd-type" onchange="onWalletDebtTypeChange()">
        <option value="creditor" ${type==='creditor'?'selected':''}>لي (مستحق لي)</option>
        <option value="debtor" ${type==='debtor'?'selected':''}>عليّ (مستحق عليّ)</option>
      </select></div>
      <div class="form-group"><label class="form-label">التاريخ</label><input type="date" class="form-control" id="wd-date" value="${esc(d&&d.date||localToday())}"></div>
    </div>
    <div class="form-group" style="margin-bottom:14px"><label class="form-label">اسم الشخص</label><input class="form-control" id="wd-person" value="${esc(d&&d.person||'')}" placeholder="مثال: أبو محمد"></div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">المبلغ بالدولار ($)</label><input type="text" inputmode="decimal" class="form-control" id="wd-amount-usd" value="${d&&d.amountUSD?fmt(d.amountUSD):''}" oninput="formatMoneyInput(this)" placeholder="0"></div>
      <div class="form-group"><label class="form-label">المبلغ بالليرة السورية (ل.س)</label><input type="text" inputmode="decimal" class="form-control" id="wd-amount-syp" value="${d&&d.amountSYP?fmt(d.amountSYP):''}" oninput="formatMoneyInput(this)" placeholder="0"></div>
    </div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:10px">عملة واحدة تكفي.</div>
    ${d?`<div style="font-size:11px;color:var(--text2);margin-bottom:10px">المسدد لهلق: ${fmt(d.paidUSD||0)}$ و${fmt(d.paidSYP||0)} ل.س</div>`:''}
    <label style="display:flex;align-items:flex-start;gap:8px;background:var(--bg-soft,#f8f9fa);border-radius:8px;padding:10px 12px;margin-bottom:14px;cursor:pointer;font-size:12px">
      <input type="checkbox" id="wd-affects" ${d&&d.affectsBalance?'checked':''} style="margin-top:2px">
      <span id="wd-affects-label">${walletDebtAffectsLabel(type)}</span>
    </label>
    <div class="form-group" style="margin-bottom:14px"><label class="form-label">ملاحظة (اختياري)</label><input class="form-control" id="wd-note" value="${esc(d&&d.note||'')}" placeholder="سبب الدين مثلاً"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveWalletDebt('${id}')">حفظ</button>
    </div>`);
}
// يزامن الحركة (إيراد/مصروف) المرتبطة بهالدين مع حالة التشيك — يمسح القديمة
// وينشئ وحدة جديدة إذا التشيك مفعّل، منشان الرصيد يعكس الكاش الفعلي فوراً.
function walletSyncDebtEntries(debt){
  if(!db.wallet.entries)db.wallet.entries=[];
  const oldIds=debt.entryIds||[];
  const oldRates={};
  db.wallet.entries.forEach(e=>{if(oldIds.includes(e.id)&&+e.rate>0)oldRates[e.currency]=e.rate;});
  if(oldIds.length)db.wallet.entries=db.wallet.entries.filter(e=>!oldIds.includes(e.id));
  debt.entryIds=[];
  if(!debt.affectsBalance)return;
  const entryType=debt.type==='debtor'?'income':'expense';
  const noteBase=(debt.type==='debtor'?'دين عليّ (استلمت كاش) من ':'دين لي (دفعت كاش) لـ ')+(debt.person||'');
  if(+debt.amountUSD>0){
    const e={id:uid(),type:entryType,amount:+debt.amountUSD,currency:'USD',date:debt.date,note:debt.note||noteBase,source:'debtCreation'};
    db.wallet.entries.push(e);debt.entryIds.push(e.id);
  }
  if(+debt.amountSYP>0){
    const e={id:uid(),type:entryType,amount:+debt.amountSYP,currency:'SYP',date:debt.date,note:debt.note||noteBase,source:'debtCreation',rate:oldRates.SYP};
    db.wallet.entries.push(e);debt.entryIds.push(e.id);
  }
}
function saveWalletDebt(id=''){
  const type=document.getElementById('wd-type').value==='debtor'?'debtor':'creditor';
  const person=document.getElementById('wd-person').value.trim();
  if(!person){alert('يرجى إدخال اسم الشخص');return;}
  const amountUSD=unformatNum(document.getElementById('wd-amount-usd').value);
  const amountSYP=unformatNum(document.getElementById('wd-amount-syp').value);
  if(!(amountUSD>0)&&!(amountSYP>0)){alert('يرجى إدخال مبلغ بالدولار أو بالليرة على الأقل');return;}
  const date=document.getElementById('wd-date').value;
  const note=document.getElementById('wd-note').value;
  const affectsBalance=!!document.getElementById('wd-affects').checked;
  const existing=walletAllDebts().find(x=>x.id===id);
  const debt={id:id||uid(),type,person,amountUSD,amountSYP,date,note,affectsBalance,entryIds:(existing&&existing.entryIds)||[],paidUSD:(existing&&existing.paidUSD)||0,paidSYP:(existing&&existing.paidSYP)||0};
  if(!db.wallet.debts)db.wallet.debts=[];
  walletSyncDebtEntries(debt);
  if(id){const i=db.wallet.debts.findIndex(x=>x.id===id);if(i>=0)db.wallet.debts[i]=debt;}
  else db.wallet.debts.push(debt);
  saveDB(db);closeModal();renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}
function deleteWalletDebt(id){
  if(!guardDelete())return;
  if(!confirm('حذف هذا الدين نهائياً؟ (رح يمسح كمان كل حركات الإيراد/المصروف يلي اتسجلت منو على الرصيد، وحركات التسديد المرتبطة فيه)'))return;
  const d=walletAllDebts().find(x=>x.id===id);
  if(d&&d.entryIds&&d.entryIds.length)db.wallet.entries=(db.wallet.entries||[]).filter(e=>!d.entryIds.includes(e.id));
  db.wallet.entries=(db.wallet.entries||[]).filter(e=>e.debtId!==id);
  db.wallet.debts=(db.wallet.debts||[]).filter(x=>x.id!==id);
  saveDB(db);renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}
/* ===== تحويل بين العملات — نفس القيمة الإجمالية بالدولار ما بتتغير (تقريباً،
   حسب سعر الصرف المستخدم باللحظة)، بس بتتغير نسبة الكاش دولار مقابل كاش ليرة
   يلي معك فعلياً. بينسجل كحركتين (مصروف بالعملة المصدر + إيراد بالعملة
   الهدف) بعلامة source:'currencyExchange' منشان ما تدخل بإحصائيات
   الإيرادات/المصاريف الحقيقية ولا برسم توزيع المصاريف. ===== */
// عرض ملاحظة "تحويل عملة" بشكل واضح: النص العادي، وإذا في فرق صرف مسجّل
// (fxDiffUSD) — سواء بالحقل الجديد أو مكتوب سابقاً جوا نص الملاحظة نفسها
// بسجلات قبل هالتحديث — منبرزه بلون واضح (أخضر ربح / أحمر خسارة) بدل
// ما يضيع بنص رمادي عادي.
function walletExchangeNoteHTML(e){
  const base=esc((e.note||'تحويل عملة').replace(/\s*—\s*فرق صرف عن سعر الشركة:.*$/,''));
  const diff=(typeof e.fxDiffUSD==='number')?e.fxDiffUSD:null;
  if(diff===null||Math.abs(diff)<0.005)return base;
  const good=diff>0;
  return `${base}<div style="margin-top:3px;font-size:10.5px;font-weight:700;color:${good?'var(--success)':'var(--danger)'}"><i class="ti ti-${good?'trending-up':'trending-down'}"></i> فرق صرف: ${good?'+':''}${fmt(diff)}$</div>`;
}

function openWalletExchangeModal(){
  const fromCur=window._weFromCur||'USD';
  const rate=getExchangeRate();
  const toCur=fromCur==='USD'?'SYP':'USD';
  showModal(`<div class="modal-title">تحويل بين العملات</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px">تحويل داخلي بين الكاش.</div>
    <div class="form-group" style="margin-bottom:10px">
      <label class="form-label">المبلغ يلي بدك تحوّلو</label>
      <div style="display:flex;gap:8px">
        <input type="text" inputmode="decimal" class="form-control" id="we-amount" value="" oninput="formatMoneyInput(this);walletExchangeRecalc()" placeholder="0" style="flex:1">
        <select class="form-control" id="we-cur" style="flex:0 0 90px" onchange="window._weFromCur=this.value;openWalletExchangeModal();closeModal()">
          <option value="USD" ${fromCur==='USD'?'selected':''}>$</option>
          <option value="SYP" ${fromCur==='SYP'?'selected':''}>ل.س</option>
        </select>
      </div>
    </div>
    <div class="form-group" style="margin-bottom:6px"><label class="form-label">سعر الصرف المستخدم بهالتحويل (1$ = كم ل.س)</label><input type="text" inputmode="decimal" class="form-control" id="we-rate" value="${fmt(rate)}" oninput="formatMoneyInput(this);walletExchangeRecalc()"></div>
    <div class="table-note" style="margin-bottom:10px">سعر الصرف بإعدادات الشركة حالياً: <b>${fmt(rate)}</b>. إذا استعملت سعر مختلف هون (مثلاً سعر الصرّاف الفعلي)، الفرق بينهن رح ينعكس على رصيدك بالدولار بلوحة التحكم — وبنوريك قد إيش هو تحت قبل ما تأكد.</div>
    <div style="font-size:13px;background:var(--bg-soft,#f8f9fa);border-radius:8px;padding:10px 12px;margin-bottom:14px" id="we-result">رح تستلم: <b>0 ${toCur==='SYP'?'ل.س':'$'}</b></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveWalletExchange()">تسجيل التحويل</button>
    </div>`);
  walletExchangeRecalc();
}
function walletExchangeRecalc(){
  const fromCur=window._weFromCur||'USD';
  const toCur=fromCur==='USD'?'SYP':'USD';
  const amountEl=document.getElementById('we-amount'),rateEl=document.getElementById('we-rate'),resEl=document.getElementById('we-result');
  if(!amountEl||!rateEl||!resEl)return;
  const amount=unformatNum(amountEl.value),rate=unformatNum(rateEl.value)||getExchangeRate();
  const result=fromCur==='USD'?amount*rate:amount/rate;
  // فرق الصرف: الفرق بالدولار بين قيمة المبلغ بسعر الشركة الرسمي وقيمته بالسعر
  // يلي استعملته هون بالتحويل الفعلي. لو نفس السعر، الفرق صفر تلقائياً.
  const companyRate=getExchangeRate();
  const fromUSDatCompany=toUSD(amount,fromCur);
  const toUSDatCompany=toCur==='USD'?result:(result/companyRate);
  const diffUSD=toUSDatCompany-fromUSDatCompany;
  let diffHTML='';
  if(amount>0&&Math.abs(diffUSD)>=0.005){
    const good=diffUSD>0;
    diffHTML=`<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border2);color:${good?'var(--success)':'var(--danger)'};font-weight:700">
      <i class="ti ti-${good?'trending-up':'trending-down'}"></i>
      فرق صرف عن سعر الشركة (${fmt(companyRate)}): ${good?'+':''}${fmt(diffUSD)}$
      <div style="font-weight:500;color:var(--text2);font-size:11px;margin-top:2px">${good?'رصيدك بالدولار رح يزيد بهالقد لأن سعرك أفضل من سعر الشركة.':'رصيدك بالدولار رح ينزل بهالقد لأن سعرك أقل من سعر الشركة.'}</div>
    </div>`;
  }
  resEl.innerHTML=`رح تستلم: <b>${fmt(result)} ${toCur==='SYP'?'ل.س':'$'}</b>${diffHTML}`;
}
function saveWalletExchange(){
  const fromCurrency=window._weFromCur||'USD';
  const toCurrency=fromCurrency==='USD'?'SYP':'USD';
  const amountEl=document.getElementById('we-amount'),rateEl=document.getElementById('we-rate');
  const amount=unformatNum(amountEl.value),rate=unformatNum(rateEl.value)||getExchangeRate();
  if(!(amount>0)){alert('يرجى إدخال مبلغ صحيح أكبر من صفر');return;}
  const toAmount=fromCurrency==='USD'?amount*rate:amount/rate;
  const balSplit=walletBalanceByCurrency();
  const availFrom=fromCurrency==='USD'?balSplit.usd:balSplit.syp;
  if(amount>availFrom+0.01){alert('المبلغ أكبر من الكاش المتوفر فعلياً بهاي العملة ('+fmt(availFrom)+(fromCurrency==='USD'?'$':' ل.س')+')');return;}
  // فرق الصرف: الفرق بالدولار بين قيمة المبلغ بسعر الشركة الرسمي (اللي بيبني عليه
  // toUSD كل أرقام الرئيسية والتقارير) وقيمته بالسعر الفعلي يلي استُعمل بهالتحويل.
  // منسجّله كحقل منفصل (fxDiffUSD) بدون ما نلمس amount/currency الأصليين — هيك
  // رصيد المحفظة بالدولار يضل صحيح رياضياً متل ما كان، وبس منوضّح مصدر الفرق بدل
  // ما يظهر كرقم غامض بلا تفسير.
  const companyRate=getExchangeRate();
  const fromUSDatCompany=toUSD(amount,fromCurrency);
  const toUSDatCompany=toCurrency==='USD'?toAmount:(toAmount/companyRate);
  const fxDiffUSD=toUSDatCompany-fromUSDatCompany;
  const today=localToday();
  if(!db.wallet.entries)db.wallet.entries=[];
  const pairId=uid(); // T7: ربط القيدين ببعض
  const diffNote=Math.abs(fxDiffUSD)>=0.005?` — فرق صرف عن سعر الشركة: ${fxDiffUSD>0?'+':''}${fmt(fxDiffUSD)}$`:'';
  db.wallet.entries.push({id:uid(),type:'expense',amount,currency:fromCurrency,date:today,note:'تحويل عملة (سعر '+fmt(rate)+')'+diffNote,source:'currencyExchange',pairId,rate:companyRate,fxDiffUSD,fxCompanyRate:companyRate,fxUsedRate:rate});
  db.wallet.entries.push({id:uid(),type:'income',amount:toAmount,currency:toCurrency,date:today,note:'تحويل عملة (سعر '+fmt(rate)+')'+diffNote,source:'currencyExchange',pairId,rate:companyRate,fxDiffUSD,fxCompanyRate:companyRate,fxUsedRate:rate});
  saveDB(db);closeModal();renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}
function openWalletDebtSettleModal(id){
  const d=walletAllDebts().find(x=>x.id===id);if(!d)return;
  const remUSD=walletDebtRemainingUSD(d),remSYP=walletDebtRemainingSYP(d);
  const verb=d.type==='debtor'?'رح تدفعو':'رح تقبضو';
  showModal(`<div class="modal-title">تسديد دين — ${esc(d.person||'')}</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">المتبقي حالياً: <b>${remUSD>0?fmt(remUSD)+'$ ':''}${remSYP>0?fmt(remSYP)+' ل.س':''}</b></div>
    <div class="form-row cols-2">
      ${remUSD>0?`<div class="form-group"><label class="form-label">${verb} بالدولار ($)</label><input type="text" inputmode="decimal" class="form-control" id="wds-amount-usd" value="${fmt(remUSD)}" oninput="formatMoneyInput(this)"></div>`:''}
      ${remSYP>0?`<div class="form-group"><label class="form-label">${verb} بالليرة (ل.س)</label><input type="text" inputmode="decimal" class="form-control" id="wds-amount-syp" value="${fmt(remSYP)}" oninput="formatMoneyInput(this)"></div>`:''}
    </div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:14px">${d.type==='debtor'?'مصروف بالمحفظة':'إيراد بالمحفظة'}</div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveWalletDebtSettle('${id}')">تسجيل التسديد</button>
    </div>`);
}
function saveWalletDebtSettle(id){
  const d=walletAllDebts().find(x=>x.id===id);if(!d)return;
  const remUSD=walletDebtRemainingUSD(d),remSYP=walletDebtRemainingSYP(d);
  const usdEl=document.getElementById('wds-amount-usd');
  const sypEl=document.getElementById('wds-amount-syp');
  const amountUSD=usdEl?unformatNum(usdEl.value):0;
  const amountSYP=sypEl?unformatNum(sypEl.value):0;
  if(!(amountUSD>0)&&!(amountSYP>0)){alert('يرجى إدخال مبلغ صحيح أكبر من صفر بعملة واحدة على الأقل');return;}
  if(amountUSD>remUSD+0.01){alert('المبلغ بالدولار أكبر من المتبقي ('+fmt(remUSD)+'$)');return;}
  if(amountSYP>remSYP+0.01){alert('المبلغ بالليرة أكبر من المتبقي ('+fmt(remSYP)+' ل.س)');return;}
  d.paidUSD=(+d.paidUSD||0)+amountUSD;
  d.paidSYP=(+d.paidSYP||0)+amountSYP;
  if(!db.wallet.entries)db.wallet.entries=[];
  const noteBase=(d.type==='debtor'?'تسديد دين لـ ':'تحصيل دين من ')+(d.person||'');
  if(amountUSD>0)db.wallet.entries.push({id:uid(),type:d.type==='debtor'?'expense':'income',amount:amountUSD,currency:'USD',date:localToday(),note:noteBase,source:'debtSettlement',debtId:id});
  if(amountSYP>0)db.wallet.entries.push({id:uid(),type:d.type==='debtor'?'expense':'income',amount:amountSYP,currency:'SYP',date:localToday(),note:noteBase,source:'debtSettlement',debtId:id});
  saveDB(db);closeModal();renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}
function walletCategoryOptionsHTML(selectedCat,kind){
  return (db.wallet.categories||[]).filter(c=>(c.kind||'expense')===(kind||'expense')).map(c=>`<option value="${c.id}" ${selectedCat===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
}
function walletSubOptionsHTML(catId,selectedSub){
  const cat=(db.wallet.categories||[]).find(c=>c.id===catId);
  if(!cat)return '';
  return (cat.subs||[]).map(s=>`<option value="${s.id}" ${selectedSub===s.id?'selected':''}>${esc(s.name)}</option>`).join('');
}
function onWalletCatChange(){
  const catId=document.getElementById('we-cat').value;
  const subSel=document.getElementById('we-sub');
  if(subSel)subSel.innerHTML=walletSubOptionsHTML(catId,'');
}
// لما يتغيّر النوع (إيراد/مصروف) داخل نافذة تسجيل الحركة، لازم قائمة الفئات تتبدّل
// معه (فئات مصروف أو فئات إيراد)، مش تختفي — كل حركة (إيراد أو مصروف) إلها فئة هلق.
function onWalletTypeChange(){
  const kind=document.getElementById('we-type').value==='expense'?'expense':'income';
  const firstCat=(db.wallet.categories||[]).find(c=>(c.kind||'expense')===kind);
  const catSel=document.getElementById('we-cat');
  const subSel=document.getElementById('we-sub');
  catSel.innerHTML=walletCategoryOptionsHTML(firstCat?firstCat.id:'',kind);
  subSel.innerHTML=walletSubOptionsHTML(firstCat?firstCat.id:'','');
}

function openWalletEntryModal(id=''){
  const e=walletAllEntries().find(x=>x.id===id);
  const type=e?e.type:(window._walletType==='expense'?'expense':'income');
  const catsOfKind=(db.wallet.categories||[]).filter(c=>(c.kind||'expense')===type);
  const catId=e&&e.catId?e.catId:(catsOfKind[0]?catsOfKind[0].id:'');
  const isSpecial=!!(e&&e.source);           // حركات النظام (ديون/تحويل عملة/سحب...) جيبها ثابت
  const company=!!(e&&walletIsCompany(e));
  showModal(`<div class="modal-title">${e?'تعديل حركة':'تسجيل حركة'}</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">النوع</label><select class="form-control" id="we-type" onchange="onWalletTypeChange()">
        <option value="income" ${type==='income'?'selected':''}>إيراد</option>
        <option value="expense" ${type==='expense'?'selected':''}>مصروف</option>
      </select></div>
      <div class="form-group"><label class="form-label">التاريخ</label><input type="date" class="form-control" id="we-date" value="${esc(e&&e.date||localToday())}"></div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">المبلغ</label><input type="text" inputmode="decimal" class="form-control" id="we-amount" value="${e?fmt(e.amount):''}" oninput="formatMoneyInput(this)" placeholder="0"></div>
      <div class="form-group"><label class="form-label">العملة</label>${currencySelectHTML('we-currency',e&&e.currency||'USD')}</div>
    </div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">الفئة</label><select class="form-control" id="we-cat" onchange="onWalletCatChange()">${walletCategoryOptionsHTML(catId,type)}</select></div>
      <div class="form-group"><label class="form-label">الفئة الفرعية</label><select class="form-control" id="we-sub">${walletSubOptionsHTML(catId,e&&e.subId)}</select></div>
    </div>
    ${isSpecial?'':`<label style="display:flex;align-items:flex-start;gap:8px;margin:0 0 14px;padding:9px 12px;background:var(--bg2);border:1px dashed var(--border2);border-radius:8px;font-size:12.5px;cursor:pointer"><input type="checkbox" id="we-company" ${company?'checked':''} style="margin-top:3px"><span><i class="ti ti-building"></i> <b>من الشركة</b> (مو شخصي)<br><span style="font-size:11px;color:var(--text2)">بيتسجل بجيب "شركة" وما بيدخل بإحصائياتك الشخصية. تركو فاضي = حركة شخصية عادية.</span></span></label>`}
    <div class="form-group" style="margin-bottom:14px"><label class="form-label">ملاحظة (اختياري)</label><input class="form-control" id="we-note" value="${esc(e&&e.note||'')}"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveWalletEntry('${id}')">حفظ</button>
    </div>`);
}
function saveWalletEntry(id=''){
  const type=document.getElementById('we-type').value==='expense'?'expense':'income';
  const amount=unformatNum(document.getElementById('we-amount').value);
  if(!(amount>0)){alert('يرجى إدخال مبلغ صحيح أكبر من صفر');return;}
  const currency=document.getElementById('we-currency').value==='USD'?'USD':'SYP';
  const date=document.getElementById('we-date').value;
  const note=document.getElementById('we-note').value;
  const existing=walletAllEntries().find(x=>x.id===id);
  if(!walletClosedGuard(date)||(existing&&existing.date!==date&&!walletClosedGuard(existing.date)))return; // T25
  const chk=document.getElementById('we-company');
  const company=chk?chk.checked:walletIsCompany(existing);
  const entry=Object.assign({},existing||{},{id:id||uid(),type,amount,currency,date,note,catId:document.getElementById('we-cat').value,subId:document.getElementById('we-sub').value,source:(existing&&existing.source)||undefined,pocket:company?'company':undefined});
  if(!db.wallet.entries)db.wallet.entries=[];
  if(id){const i=db.wallet.entries.findIndex(x=>x.id===id);if(i>=0)db.wallet.entries[i]=entry;}
  else db.wallet.entries.push(entry);
  saveDB(db);closeModal();renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}
// T7: حذف حركة بيحذف قيدها المقابل (سحب الأرباح / تحويل العملة) وبيرجّع تسديد الدين على دينه
function walletFindDebtOfSettlement(e){
  if(!e||e.source!=='debtSettlement')return null;
  const debts=walletAllDebts();
  if(e.debtId)return debts.find(d=>d.id===e.debtId)||null;
  const m=debts.filter(d=>((d.type==='debtor'?'تسديد دين لـ ':'تحصيل دين من ')+(d.person||''))===e.note);
  return m.length===1?m[0]:null;
}
function deleteWalletEntry(id){
  if(!guardDelete())return;
  const all=walletAllEntries();
  const cur=all.find(x=>x.id===id);if(!cur)return;
  if(!walletClosedGuard(cur.date))return; // T25
  let group=[cur];
  if(cur.pairId)group=all.filter(x=>x.pairId===cur.pairId);
  else if(cur.source==='currencyExchange'){
    const mates=all.filter(x=>x.id!==cur.id&&x.source==='currencyExchange'&&!x.pairId&&x.type!==cur.type&&x.date===cur.date&&x.fxUsedRate===cur.fxUsedRate&&(x.currency||'USD')!==(cur.currency||'USD'));
    if(mates.length===1)group=[cur,mates[0]];
  }
  const debt=walletFindDebtOfSettlement(cur);
  let msg='حذف هذه الحركة نهائياً؟';
  if(group.length>1)msg=cur.source==='currencyExchange'?'حذف هالحركة وقيدها المقابل (تحويل العملة بيتعكس بالطرفين)؟':'حذف هالحركة وقيدها المقابل (سحب الأرباح بيتعكس بالجيبين)؟';
  else if(cur.source==='currencyExchange')msg='ما لقيت القيد المقابل لهالتحويل (قيد قديم). رح تنحذف هالحركة بس — تأكد من القيد التاني يدوياً. متابعة؟';
  if(debt)msg+='\n(بيرجع '+fmt(cur.amount)+(cur.currency==='SYP'?' ل.س':'$')+' على دين '+(debt.person||'')+' كمتبقي)';
  if(!confirm(msg))return;
  const ids=new Set(group.map(x=>x.id));
  db.wallet.entries=(db.wallet.entries||[]).filter(x=>!ids.has(x.id));
  if(debt){
    if(cur.currency==='SYP')debt.paidSYP=Math.max(round2((+debt.paidSYP||0)-(+cur.amount||0)),0);
    else debt.paidUSD=Math.max(round2((+debt.paidUSD||0)-(+cur.amount||0)),0);
  }
  saveDB(db);renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

function openWalletOpeningModal(){
  showModal(`<div class="modal-title">الرصيد الافتتاحي وحد التنبيه</div>
    <div class="form-group" style="margin-bottom:6px"><label class="form-label">الرصيد الافتتاحي (بالدولار $)</label><input type="text" inputmode="decimal" class="form-control" id="wo-amount" value="${fmt((db.wallet&&db.wallet.openingBalance)||0)}" oninput="formatMoneyInput(this)"></div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:8px">رصيدك قبل أول حركة مسجّلة بالمحفظة.</div>
    <div class="table-note" style="background:var(--warning-bg);color:var(--warning);border-radius:10px;padding:8px 12px;margin-bottom:14px;font-size:12px"><i class="ti ti-alert-triangle"></i> تعديل هالرقم بيغيّر كل الأرقام من البداية (وبيحرّك الرصيد القديم). لو قاطع تسجيل وبدك تبلّش من جديد، استعمل "بدء فترة جديدة" بدل ما تعدّل هون.<br><button class="btn btn-sm" style="margin-top:8px" onclick="closeModal();openWalletNewPeriodModal()"><i class="ti ti-player-play"></i> بدء فترة جديدة</button></div>
    <div class="form-group" style="margin-bottom:6px"><label class="form-label">تنبيهني لو الرصيد نزل تحت (بالدولار $)</label><input type="text" inputmode="decimal" class="form-control" id="wo-threshold" value="${fmt((db.wallet&&db.wallet.lowBalanceAlert)||0)}" oninput="formatMoneyInput(this)" placeholder="مثال: 50"></div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:14px">0 = تنبيه عند السالب فقط.</div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveWalletOpening()">حفظ</button>
    </div>`);
}
function saveWalletOpening(){
  db.wallet.openingBalance=unformatNum(document.getElementById('wo-amount').value);
  db.wallet.lowBalanceAlert=unformatNum(document.getElementById('wo-threshold').value);
  saveDB(db);closeModal();renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

/* ===== بدء فترة جديدة (أرشفة القديم + تسوية الرصيد على كاشك الفعلي) =====
   الفكرة: بدل ما تعدّل الرصيد الافتتاحي (وبيتحرّك معو كل القديم)، منعمل شغلتين:
   1) نقفل (نجمّد) كل الأشهر القديمة يلي قبل تاريخ البداية — هيدي هي "الأرشفة".
   2) منسجّل حركة "تسوية رصيد" بتاريخ البداية بقيمة الفرق بين رصيد البرنامج وكاشك الفعلي،
      فالرصيد الحالي بيصير = كاشك الفعلي بالضبط، والقديم بيضل مثل ما هو بدون أي تغيير. */
function walletArchiveMonthsBefore(date){
  const sp=walletDataSpan();if(!sp)return 0;
  const endKey=String(date).slice(0,7);
  let y=+sp.min.slice(0,4),m=+sp.min.slice(5,7),n=0;
  while((y+'-'+String(m).padStart(2,'0'))<endKey){
    const key=y+'-'+String(m).padStart(2,'0');
    const b=periodMonthBounds(y,m-1);
    const has=walletAllEntries().some(e=>periodInRange(e.date,b.from,b.to));
    if(has&&!walletIsMonthClosed(key)){walletCloseMonth(key);n++;}
    m++;if(m>12){m=1;y++;}
  }
  return n;
}
function walletStartNewPeriod(date,actualUSD,actualSYP){
  const cur=walletBalanceByCurrency();
  const archived=walletArchiveMonthsBefore(date);
  if(!db.wallet.entries)db.wallet.entries=[];
  let added=0;
  const mk=(curCode,oldBal,newBal)=>{
    const diff=Math.round(newBal*100)-Math.round(oldBal*100);
    if(diff===0)return;
    const sym=curCode==='SYP'?' ل.س':'$';
    const e={id:uid(),type:diff>0?'income':'expense',amount:Math.abs(diff)/100,currency:curCode,date,
      note:'تسوية رصيد — بداية فترة جديدة (الرصيد قبل: '+fmt(oldBal)+sym+' ← الفعلي: '+fmt(newBal)+sym+')',source:'balanceAdjust'};
    if(curCode==='SYP')e.rate=getExchangeRate();
    db.wallet.entries.push(e);added++;
  };
  mk('USD',cur.usd,actualUSD);
  mk('SYP',cur.syp,actualSYP);
  saveDB(db);
  return {archived,added};
}
function openWalletNewPeriodModal(){
  const cur=walletBalanceByCurrency();
  showModal(`<div class="modal-title">بدء فترة جديدة</div>
    <div style="font-size:12.5px;color:var(--text2);line-height:1.7;margin-bottom:12px">
      حط كاشك الفعلي هلأ. البرنامج بيجمّد الأشهر القديمة (أرشفة) وبيكمّل من رقمك الجديد، <b>بدون ما يلمس أي حركة قديمة</b>.</div>
    <div class="table-note" style="border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:12.5px">الرصيد حسب البرنامج هلأ: <b>${fmt(cur.usd)}$</b>${cur.syp?` + <b>${fmt(cur.syp)} ل.س</b>`:''}</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">كاشك الفعلي بالدولار ($)</label><input type="text" inputmode="decimal" class="form-control" id="wnp-usd" value="${fmt(cur.usd)}" oninput="formatMoneyInput(this)"></div>
      <div class="form-group"><label class="form-label">كاشك الفعلي بالليرة (ل.س)</label><input type="text" inputmode="decimal" class="form-control" id="wnp-syp" value="${fmt(cur.syp)}" oninput="formatMoneyInput(this)"></div>
    </div>
    <div class="form-group" style="margin-bottom:8px"><label class="form-label">تاريخ بداية الفترة الجديدة</label><input type="date" class="form-control" id="wnp-date" value="${localToday()}"></div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:14px">كل الأشهر يلي قبل شهر هالتاريخ بتنقفل. الفرق بيتسجّل حركة "تسوية رصيد" وبتقدر تحذفها لو غلطت. المبلغ يلي بتكتبو هو كاشك الكلي (شخصي + شركة).</div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveWalletNewPeriod()">بدء الفترة الجديدة</button>
    </div>`);
}
function saveWalletNewPeriod(){
  const date=(document.getElementById('wnp-date').value||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){alert('اختار تاريخ صحيح');return;}
  const usd=unformatNum(document.getElementById('wnp-usd').value),syp=unformatNum(document.getElementById('wnp-syp').value);
  if(!isFinite(usd)||!isFinite(syp)){alert('تأكد من المبالغ');return;}
  if(!confirm('بدء فترة جديدة من '+fmtDate(date)+'؟\nالأشهر القديمة بتنقفل (أرشفة) والرصيد بيصير '+fmt(usd)+'$'+(syp?' + '+fmt(syp)+' ل.س':'')+'.'))return;
  const r=walletStartNewPeriod(date,usd,syp);
  closeModal();
  renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'));
  setTimeout(()=>alert('تم. انقفل '+r.archived+' شهر قديم'+(r.added?' وانسجّلت تسوية الرصيد.':' (الرصيد كان مطابق، ما احتاج تسوية).')),50);
}

/* ===== سحب يدوي من أرباح الشركة (قراءة فقط لرقم الأرباح — ما بيعدّل أي حساب شركة) ===== */
function openWalletProfitPullModal(){
  window._wpSourceType=window._wpSourceType||'total';
  window._wpSourceId=window._wpSourceId||'';
  window._wpDest=window._wpDest||'company';
  showModal(renderWalletProfitPullModalHTML());
}
function renderWalletProfitPullModalHTML(){
  const type=window._wpSourceType||'total';
  const totalProfit=(typeof getCompanyNetProfitUSD==='function')?getCompanyNetProfitUSD():0;
  let entitySectionHTML='';
  let prefillAmount='';
  let prefillNote='';
  if(type==='project'){
    const list=(db.projects||[]).map(p=>({id:p.name,label:p.name,profit:projectStats(p.name).profit})).sort((a,b)=>b.profit-a.profit);
    entitySectionHTML=`<div class="form-group" style="margin-bottom:14px"><label class="form-label">اختر المشروع</label><select class="form-control" id="wp-entity" onchange="updateWalletProfitPullFromEntity()"><option value="">— اختر —</option>${list.map(x=>`<option value="${esc(x.id)}" ${x.id===window._wpSourceId?'selected':''}>${esc(x.label)} (${fmtUSD(x.profit)})</option>`).join('')}</select></div>`;
    const sel=list.find(x=>x.id===window._wpSourceId);
    if(sel){prefillAmount=sel.profit>0?fmt(sel.profit):'';prefillNote=`سحب أرباح مشروع: ${esc(sel.label)}`;}
  }else if(type==='maint'){
    const list=db.maintenance.map(m=>({id:m.id,label:(getClientName(m.clientId)||m.clientNameFree||'—')+(m.branch?' / '+m.branch:'')+(m.projectName?' — '+m.projectName:''),profit:toUSDHist(maintRecognizedProfit(m),m.currency,m)})).sort((a,b)=>b.profit-a.profit);
    entitySectionHTML=`<div class="form-group" style="margin-bottom:14px"><label class="form-label">اختر العمل</label><select class="form-control" id="wp-entity" onchange="updateWalletProfitPullFromEntity()"><option value="">— اختر —</option>${list.map(x=>`<option value="${esc(x.id)}" ${x.id===window._wpSourceId?'selected':''}>${esc(x.label)} (${fmtUSD(x.profit)})</option>`).join('')}</select></div>`;
    const sel=list.find(x=>x.id===window._wpSourceId);
    if(sel){prefillAmount=sel.profit>0?fmt(sel.profit):'';prefillNote=`سحب أرباح عمل: ${esc(sel.label)}`;}
  }else if(type==='sale'){
    const list=db.sales.map(s=>({id:s.id,label:(getClientName(s.clientId)||s.clientNameFree||'—')+(s.projectName?' — '+s.projectName:''),profit:toUSDHist(saleRecognizedProfit(s),s.currency,s)})).sort((a,b)=>b.profit-a.profit);
    entitySectionHTML=`<div class="form-group" style="margin-bottom:14px"><label class="form-label">اختر فاتورة المبيع</label><select class="form-control" id="wp-entity" onchange="updateWalletProfitPullFromEntity()"><option value="">— اختر —</option>${list.map(x=>`<option value="${esc(x.id)}" ${x.id===window._wpSourceId?'selected':''}>${esc(x.label)} (${fmtUSD(x.profit)})</option>`).join('')}</select></div>`;
    const sel=list.find(x=>x.id===window._wpSourceId);
    if(sel){prefillAmount=sel.profit>0?fmt(sel.profit):'';prefillNote=`سحب أرباح فاتورة: ${esc(sel.label)}`;}
  }
  return `<div class="modal-title">سحب من الشركة (دفعة أو أرباح)</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">صافي ربح الشركة الحالي (الإجمالي، بالدولار): <b style="color:var(--accent)">${fmtUSD(totalProfit)}</b></div>
    <div class="form-group" style="margin-bottom:14px">
      <label class="form-label">مصدر السحب</label>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="radio" name="wp-source-type" value="total" ${type==='total'?'checked':''} onchange="window._wpSourceType='total';window._wpSourceId='';showModal(renderWalletProfitPullModalHTML())"> من إجمالي الأرباح (مبلغ حر — شهر أو أي مبلغ)</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="radio" name="wp-source-type" value="project" ${type==='project'?'checked':''} onchange="window._wpSourceType='project';window._wpSourceId='';showModal(renderWalletProfitPullModalHTML())"> من مشروع معيّن</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="radio" name="wp-source-type" value="maint" ${type==='maint'?'checked':''} onchange="window._wpSourceType='maint';window._wpSourceId='';showModal(renderWalletProfitPullModalHTML())"> من عمل صيانة معيّن</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="radio" name="wp-source-type" value="sale" ${type==='sale'?'checked':''} onchange="window._wpSourceType='sale';window._wpSourceId='';showModal(renderWalletProfitPullModalHTML())"> من فاتورة مبيع معيّنة</label>
      </div>
    </div>
    ${entitySectionHTML}
    <div class="form-group" style="margin-bottom:14px">
      <label class="form-label">المبلغ رح يكون${infoTip('المبلغ حر — مو لازم يكون ضمن الربح. اختار "عهدة" إذا بدك تسحب مبلغ (ممكن أكبر من الربح) وتصرف منو على الشغل قبل التخريج، وبعدها التخريج بيحسب الربح والمتبقي لحالو.')}</label>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:4px">
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="radio" name="wp-dest" value="company" ${window._wpDest==='personal'?'':'checked'} onchange="window._wpDest='company'"> عهدة للشغل (بينحسب بجيب الشركة، وبتصرف منو وبعدين تخرّج)</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="radio" name="wp-dest" value="personal" ${window._wpDest==='personal'?'checked':''} onchange="window._wpDest='personal'"> أرباح إلي (بتنضاف لجيبي الشخصي مباشرة)</label>
      </div>
    </div>
    <div class="form-group" style="margin-bottom:14px"><label class="form-label">المبلغ ($) — بدون حد أعلى</label><input type="text" inputmode="decimal" class="form-control" id="wp-amount" value="${prefillAmount}" placeholder="0" oninput="formatMoneyInput(this)"></div>
    <div class="form-group" style="margin-bottom:14px"><label class="form-label">ملاحظة (اختياري)</label><input class="form-control" id="wp-note" value="${esc(prefillNote)}" placeholder="مثال: سحب أرباح شهر ٩"></div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:14px">هاد بيزيد كاشك الكلي (فلوس إجتك من صندوق الشركة). إذا الفلوس أصلاً معك بجيب الشركة، استعمل "تخريج مشروع / عمل".</div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveWalletProfitPull()">تسجيل كإيراد</button>
    </div>`;
}
function updateWalletProfitPullFromEntity(){
  const sel=document.getElementById('wp-entity');
  window._wpSourceId=sel?sel.value:'';
  showModal(renderWalletProfitPullModalHTML());
}
function saveWalletProfitPull(){
  const amount=unformatNum(document.getElementById('wp-amount').value);
  if(!(amount>0)){alert('يرجى إدخال مبلغ صحيح أكبر من صفر');return;}
  const dest=window._wpDest==='personal'?'personal':'company';
  const kind=window._wpSourceType||'total',id=window._wpSourceId||'';
  const linked=(kind!=='total'&&id);
  if(kind!=='total'&&!id&&dest==='company'){alert('اختر المشروع/العمل/الفاتورة أو رجّع المصدر لـ "من إجمالي الأرباح".');return;}
  const note=document.getElementById('wp-note').value||(dest==='company'?'سحب دفعة من الشركة':'سحب من أرباح الشركة');
  if(!db.wallet.entries)db.wallet.entries=[];
  const date=localToday();
  const link=linked?{linkType:kind,linkId:id,linkLabel:walletEntityLabel(kind,id)}:{};
  if(dest==='company')db.wallet.entries.push(Object.assign({id:uid(),type:'income',amount,currency:'USD',date,note,source:'companyAdvance',pocket:'company'},link));
  else db.wallet.entries.push(Object.assign({id:uid(),type:'income',amount,currency:'USD',date,note,source:'profit'},link));
  saveDB(db);closeModal();renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}

/* ===== إدارة الفئات (رئيسية + فرعية) ===== */
function openWalletCategoriesModal(){
  showModal(`<div class="modal-title">إدارة الفئات</div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:10px">تصنيف الحركات.</div>
    <div class="section-title" style="margin-top:6px;color:var(--danger)"><i class="ti ti-arrow-up-right"></i> فئات المصروف</div>
    <div id="wallet-cats-body-expense">${renderWalletCategoriesBody('expense')}</div>
    <div class="form-row cols-2" style="margin-bottom:18px">
      <div class="form-group"><input class="form-control" id="wc-new-cat-expense" placeholder="اسم فئة مصروف جديدة (مثال: صحة)"></div>
      <div class="form-group"><button class="btn btn-primary" style="width:100%" onclick="addWalletCategory('expense')"><i class="ti ti-plus"></i> إضافة فئة مصروف</button></div>
    </div>
    <div class="section-title" style="color:var(--success)"><i class="ti ti-arrow-down-left"></i> فئات الإيراد</div>
    <div id="wallet-cats-body-income">${renderWalletCategoriesBody('income')}</div>
    <div class="form-row cols-2">
      <div class="form-group"><input class="form-control" id="wc-new-cat-income" placeholder="اسم فئة إيراد جديدة (مثال: عمل تاني)"></div>
      <div class="form-group"><button class="btn btn-primary" style="width:100%" onclick="addWalletCategory('income')"><i class="ti ti-plus"></i> إضافة فئة إيراد</button></div>
    </div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إغلاق</button></div>`);
}
function renderWalletCategoriesBody(kind){
  const list=(db.wallet.categories||[]).filter(c=>(c.kind||'expense')===kind);
  const accent=kind==='income'?'var(--success)':'var(--danger)';
  return list.map(c=>`
    <div class="card" style="margin-bottom:10px;padding:12px;border-inline-start:3px solid ${accent}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <b>${esc(c.name)}</b>
        <div>
          <button class="btn btn-sm" onclick="renameWalletCategory('${c.id}')"><i class="ti ti-edit"></i></button>
          <button class="btn btn-sm btn-danger" onclick="deleteWalletCategory('${c.id}')"><i class="ti ti-trash"></i></button>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
        ${(c.subs||[]).map(s=>`<span class="badge badge-gray" style="display:flex;align-items:center;gap:4px">${esc(s.name)}<span onclick="deleteWalletSub('${c.id}','${s.id}')" style="cursor:pointer;opacity:.6">✕</span></span>`).join('')||'<span style="font-size:11px;color:var(--text2)">لا يوجد فئات فرعية</span>'}
      </div>
      <div style="display:flex;gap:6px">
        <input class="form-control" id="wc-new-sub-${c.id}" placeholder="فئة فرعية جديدة..." style="flex:1">
        <button class="btn btn-sm" onclick="addWalletSub('${c.id}')">إضافة</button>
      </div>
    </div>`).join('')||`<div class="empty-state" style="padding:20px"><p>لا يوجد فئات ${kind==='income'?'إيراد':'مصروف'} بعد</p></div>`;
}
function refreshWalletCategoriesModal(){
  const expEl=document.getElementById('wallet-cats-body-expense');
  const incEl=document.getElementById('wallet-cats-body-income');
  if(expEl)expEl.innerHTML=renderWalletCategoriesBody('expense');
  if(incEl)incEl.innerHTML=renderWalletCategoriesBody('income');
}
function addWalletCategory(kind){
  kind=kind==='income'?'income':'expense';
  const inp=document.getElementById('wc-new-cat-'+kind);
  const name=inp.value.trim();
  if(!name){alert('يرجى إدخال اسم الفئة');return;}
  db.wallet.categories.push({id:uid(),name,kind,subs:[]});
  saveDB(db);inp.value='';refreshWalletCategoriesModal();
}
function renameWalletCategory(catId){
  const cat=db.wallet.categories.find(c=>c.id===catId);if(!cat)return;
  const name=prompt('اسم الفئة الجديد:',cat.name);
  if(!name||!name.trim())return;
  cat.name=name.trim();saveDB(db);refreshWalletCategoriesModal();
}
function deleteWalletCategory(catId){
  if(!guardDelete())return;
  if(!confirm('حذف هذه الفئة وكل فئاتها الفرعية؟ (الحركات القديمة المسجّلة عليها رح تضل موجودة بس بدون اسم فئة واضح)'))return;
  db.wallet.categories=db.wallet.categories.filter(c=>c.id!==catId);
  saveDB(db);refreshWalletCategoriesModal();
}
function addWalletSub(catId){
  const inp=document.getElementById('wc-new-sub-'+catId);
  const name=inp.value.trim();
  if(!name){alert('يرجى إدخال اسم الفئة الفرعية');return;}
  const cat=db.wallet.categories.find(c=>c.id===catId);if(!cat)return;
  if(!cat.subs)cat.subs=[];
  cat.subs.push({id:uid(),name});
  saveDB(db);refreshWalletCategoriesModal();
}
function deleteWalletSub(catId,subId){
  if(!guardDelete())return;
  const cat=db.wallet.categories.find(c=>c.id===catId);if(!cat)return;
  cat.subs=(cat.subs||[]).filter(s=>s.id!==subId);
  saveDB(db);refreshWalletCategoriesModal();
}


/* ===== قسم "جيب الشركة": شو معك للشركة وعلى أي جهة ===== */
function renderWalletCompanyPocketSection(){
  const comp=walletAllEntries().filter(walletIsCompany);
  if(!comp.length)return '';
  const groups={};
  comp.forEach(e=>{
    const k=(e.linkType&&e.linkId)?e.linkType+'|'+e.linkId:'';
    (groups[k]=groups[k]||{kind:e.linkType||'',id:e.linkId||'',label:e.linkLabel||'',list:[]}).list.push(e);
  });
  const rows=Object.values(groups).map(g=>{
    g.led=walletLedgerOf(g.list);
    if(g.kind&&g.id)g.label=walletEntityLabel(g.kind,g.id)||g.label||'—';
    return g;
  }).sort((a,b)=>Math.abs(b.led.net)-Math.abs(a.led.net));
  const total=walletCompanyPocketUSD();
  return `<div class="card" style="margin-bottom:18px">
    <div class="section-title">جيب الشركة (يلي معك للشركة)${infoTip('الصافي = المقبوض − المصاريف يلي دفعتها من كاشك − الأرباح يلي سحبتها − يلي سلّمتو للشركة. موجب = فلوس الشركة معك. سالب = الشركة مدينة إلك. لما تعمل تخريج للمشروع بيرجع الصافي صفر.')}</div>
    <div style="overflow-x:auto"><table class="responsive-table"><thead><tr><th>الجهة</th><th>مقبوض من الزبون ($)</th><th>سحبته من الشركة ($)</th><th>مصاريف من كاشك ($)</th><th>أرباح مسحوبة ($)</th><th>مسلّم للشركة ($)</th><th>الصافي عندك ($)</th><th></th></tr></thead><tbody>
    ${rows.map(g=>`<tr>
      <td data-label="الجهة">${g.kind?`<span class="badge badge-amber">${walletKindLabel(g.kind)}</span> `:''}${g.kind?esc(g.label):'<span style="color:var(--text2)">حركات غير مربوطة</span>'}</td>
      <td data-label="مقبوض">${fmtUSD(g.led.received)}</td>
      <td data-label="سحبته من الشركة">${fmtUSD(g.led.advanced)}</td>
      <td data-label="مصاريف">${fmtUSD(g.led.spent)}</td>
      <td data-label="أرباح مسحوبة">${fmtUSD(g.led.withdrawn)}</td>
      <td data-label="مسلّم">${fmtUSD(g.led.handed-g.led.reimbursed)}</td>
      <td data-label="الصافي" style="font-weight:700;color:${Math.abs(g.led.net)<0.005?'var(--text2)':(g.led.net>0?'var(--gold,#B8862E)':'var(--danger)')}">${fmtUSD(g.led.net)}</td>
      <td data-label="">${g.kind?`<button class="btn btn-sm" data-k="${g.kind}" data-id="${esc(g.id)}" onclick="openWalletSettleFromBtn(this)"><i class="ti ti-checkup-list"></i> تخريج</button>`:''}</td>
    </tr>`).join('')}
    </tbody><tfoot><tr class="summary-row"><td colspan="6">الإجمالي</td><td>${fmtUSD(total)}</td><td></td></tr></tfoot></table></div>
  </div>`;
}

/* ===== شاشة التخريج (Settlement) =====
   بتقرأ ربح الجهة من حسابات الشركة (قراءة فقط) وبتحسب:
     المتاح للسحب = الربح − يلي سبق وسحبتو
     المتبقي للشركة = الصافي عندك − المبلغ يلي رح تسحبو كربح
   وبتسجّل القيود: سحب أرباح (جيب شركة ← شخصي) + تسليم للشركة/ردّ منها للمتبقي. */
function openWalletSettleFromBtn(btn){openWalletSettleModal(btn.getAttribute('data-k'),btn.getAttribute('data-id'));}
function openWalletSettleModal(kind,id){
  window._wsKind=kind||window._wsKind||'project';
  window._wsId=id||'';
  showModal(renderWalletSettleModalHTML());
}
function walletSettleChangeKind(kind){window._wsKind=kind;window._wsId='';showModal(renderWalletSettleModalHTML());}
function walletSettleChangeEntity(){
  const sel=document.getElementById('ws-entity');
  window._wsId=sel?sel.value:'';
  showModal(renderWalletSettleModalHTML());
}
function walletSettlePreviewHTML(net,w,avail){
  const rem=Math.round((net-w)*100)/100;
  let line;
  if(rem>0.004)line=`<div style="color:var(--gold,#B8862E);font-weight:700"><i class="ti ti-building"></i> رح تسلّم للشركة: ${fmtUSD(rem)} (بينقص كاشك الكلي بهالمبلغ)</div>`;
  else if(rem<-0.004)line=`<div style="color:var(--danger);font-weight:700"><i class="ti ti-building"></i> الشركة رح تردلك: ${fmtUSD(-rem)} (بينزاد كاشك الكلي بهالمبلغ)</div>`;
  else line=`<div style="color:var(--success);font-weight:700"><i class="ti ti-circle-check"></i> بيتسكّر صفر: ما بيضل شي للشركة عندك ولا الشركة مدينة إلك.</div>`;
  const warn=w>avail+0.01?`<div style="color:var(--danger);font-size:12px;margin-top:4px"><i class="ti ti-alert-triangle"></i> المبلغ أكبر من الربح المتاح للسحب (${fmtUSD(avail)}).</div>`:'';
  return `<div style="margin-bottom:6px">للجيب الشخصي كربح: <b>${fmtUSD(w)}</b></div>${line}${warn}`;
}
function walletSettleRecalc(){
  const w=unformatNum(document.getElementById('ws-amount').value)||0;
  const el=document.getElementById('ws-preview');
  if(el)el.innerHTML=walletSettlePreviewHTML(window._wsNet||0,w,window._wsAvail||0);
}
function renderWalletSettleModalHTML(){
  const kind=window._wsKind||'project',id=window._wsId||'';
  const list=walletSettleEntities(kind).sort((a,b)=>b.profit-a.profit);
  const sel=list.find(x=>x.id===id);
  const kinds=[['project','مشروع'],['maint','عمل صيانة'],['sale','فاتورة مبيع']];
  let body='<div class="table-note" style="margin-bottom:14px">اختر المشروع أو العمل أو الفاتورة لتشوف الحساب.</div>';
  if(sel){
    const L=walletEntityLedger(kind,id);
    const avail=Math.max(0,Math.round((sel.profit-L.withdrawn)*100)/100);
    window._wsNet=L.net;window._wsAvail=avail;
    const row=(lbl,val,bold,color)=>`<tr><td style="padding:5px 0;color:var(--text2)">${lbl}</td><td style="padding:5px 0;text-align:left;${bold?'font-weight:700;':''}${color?'color:'+color+';':''}">${val}</td></tr>`;
    body=`<table style="width:100%;font-size:13px;margin-bottom:12px"><tbody>
      ${row('المقبوض من الزبون (بالمحفظة)',fmtUSD(L.received))}
      ${L.advanced>0?row('سحبتو من الشركة كدفعة (عهدة)',fmtUSD(L.advanced)):''}
      ${row('مصاريف دفعتها من كاشك',fmtUSD(L.spent))}
      ${row('ربح هالجهة (من حسابات الشركة)',fmtUSD(sel.profit),true,sel.profit>=0?'var(--accent)':'var(--danger)')}
      ${row('سبق وسحبتو من الربح',fmtUSD(L.withdrawn))}
      ${row('سبق وسلّمتو للشركة',fmtUSD(L.handed))}
      ${L.reimbursed>0?row('ردّتو الشركة إلك',fmtUSD(L.reimbursed)):''}
      <tr><td colspan="2" style="border-top:1px solid var(--border2);padding-top:2px"></td></tr>
      ${row('الموجود عندك حالياً للشركة (الصافي)',fmtUSD(L.net),true)}
    </tbody></table>
    ${(L.received+L.advanced)<=0?`<div class="table-note" style="margin-bottom:12px;color:var(--danger)"><i class="ti ti-alert-triangle"></i> ما في قبض ولا دفعة مسجّلة بالمحفظة لهالجهة. سجّل القبض (تسجيل حركة ← الجيب: شركة) أو الدفعة (المزيد ← سحب من صندوق الشركة) وإلا التخريج رح يطلع الشركة مدينة إلك.</div>`:''}
    <div class="form-group" style="margin-bottom:12px"><label class="form-label">الربح يلي بدك تسحبو للجيب الشخصي ($)${infoTip('المتاح = ربح الجهة − يلي سحبتو قبل. تقدر تسحب أقل (مثلاً بعض الربح هلق والباقي بعدين).')}</label>
      <input type="text" inputmode="decimal" class="form-control" id="ws-amount" value="${avail?fmt(avail):'0'}" oninput="formatMoneyInput(this);walletSettleRecalc()"></div>
    <div id="ws-preview" style="background:var(--bg2);border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:14px">${walletSettlePreviewHTML(L.net,avail,avail)}</div>`;
  }
  return `<div class="modal-title">تخريج مشروع / عمل</div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:12px">
      ${kinds.map(k=>`<label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="radio" name="ws-kind" ${kind===k[0]?'checked':''} onchange="walletSettleChangeKind('${k[0]}')"> ${k[1]}</label>`).join('')}
    </div>
    <div class="form-group" style="margin-bottom:14px"><select class="form-control" id="ws-entity" onchange="walletSettleChangeEntity()">
      <option value="">— اختر —</option>${list.map(x=>`<option value="${esc(x.id)}" ${x.id===id?'selected':''}>${esc(x.label)} (${fmtUSD(x.profit)})</option>`).join('')}
    </select></div>
    ${body}
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">إلغاء</button>
      ${sel?`<button class="btn btn-primary" onclick="saveWalletSettle()"><i class="ti ti-check"></i> تنفيذ التخريج</button>`:''}
    </div>`;
}
function saveWalletSettle(){
  const kind=window._wsKind,id=window._wsId;
  if(!kind||!id){alert('اختر الجهة أول');return;}
  const label=walletEntityLabel(kind,id);
  const w=Math.round((unformatNum(document.getElementById('ws-amount').value)||0)*100)/100;
  const net=walletEntityLedger(kind,id).net;
  const rem=Math.round((net-w)*100)/100;
  if(w<=0&&Math.abs(rem)<0.005){alert('ما في شي لتخريجو: الصافي صفر وما حددت ربح للسحب.');return;}
  const avail=window._wsAvail||0;
  let msg=`تخريج ${walletKindLabel(kind)}: ${label}\n\n`;
  msg+=w>0?`• سحب أرباح للجيب الشخصي: ${fmtUSD(w)}\n`:'';
  msg+=rem>0.004?`• تسليم للشركة: ${fmtUSD(rem)}\n`:(rem<-0.004?`• الشركة بتردلك: ${fmtUSD(-rem)}\n`:'• المتبقي: صفر\n');
  if(w>avail+0.01)msg+=`\nتنبيه: المبلغ أكبر من الربح المتاح (${fmtUSD(avail)}).\n`;
  msg+='\nتأكيد؟';
  if(!confirm(msg))return;
  if(!db.wallet.entries)db.wallet.entries=[];
  const today=localToday();
  const link={linkType:kind,linkId:id,linkLabel:label};
  const kl=walletKindLabel(kind);
  if(w>0){
    const pairId=uid();
    db.wallet.entries.push(Object.assign({id:uid(),type:'expense',amount:w,currency:'USD',date:today,note:`سحب أرباح ${kl}: ${label}`,source:'pocketTransfer',pocket:'company',pairId},link));
    db.wallet.entries.push(Object.assign({id:uid(),type:'income',amount:w,currency:'USD',date:today,note:`سحب أرباح ${kl}: ${label}`,source:'profit',pairId},link));
  }
  if(rem>0.004)db.wallet.entries.push(Object.assign({id:uid(),type:'expense',amount:rem,currency:'USD',date:today,note:`تسليم للشركة — تخريج ${kl}: ${label}`,source:'companyHandover',pocket:'company'},link));
  else if(rem<-0.004)db.wallet.entries.push(Object.assign({id:uid(),type:'income',amount:-rem,currency:'USD',date:today,note:`الشركة ردّت لك — تخريج ${kl}: ${label}`,source:'companyReimburse',pocket:'company'},link));
  saveDB(db);closeModal();renderWallet(document.getElementById('main-content'),document.getElementById('topbar-actions'));
}
