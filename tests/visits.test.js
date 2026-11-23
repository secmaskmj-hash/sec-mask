/* اختبارات المرحلة 3 / الجزء 1: T36 فروع العميل ودمج المكرر · T37 أساس الهامش · T28 العقود والترحيل · T48 جدول الدفعات.
   التشغيل:  node tests/contracts.test.js   (جرّبه كمان مع TZ=Asia/Riyadh و TZ=America/Los_Angeles) — بيحمّل core.js و ops.js الحقيقيين بدون متصفح. */
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..');
function mkProxy(n){const f=function(){return mkProxy(n+'()');};return new Proxy(f,{get:(t,k)=>{if(k===Symbol.toPrimitive)return()=>'';if(k==='then')return undefined;return mkProxy(n+'.'+String(k));},set:()=>true,apply:()=>mkProxy(n+'()'),construct:()=>mkProxy('new')});}
const store={};
const ctx={console,Math,Date,JSON,Number,String,Object,Array,RegExp,isFinite,isNaN,parseFloat,parseInt,Promise,Set,Map,Symbol,Error,Intl,
 setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,
 localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},
 document:mkProxy('document'),navigator:{userAgent:'node',onLine:true},location:{href:'',hash:'',search:''},
 addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),getComputedStyle:()=>({getPropertyValue:()=>''}),
 fetch:()=>Promise.reject(new Error('no net')),alert(){},confirm:()=>true,prompt:()=>null,requestAnimationFrame:()=>0,structuredClone:x=>JSON.parse(JSON.stringify(x))};
ctx.sessionStorage=ctx.localStorage;ctx.supabase={createClient:()=>mkProxy('sb')};ctx.window=ctx;ctx.self=ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'core.js'),'utf8'),ctx,{filename:'core.js'});
vm.runInContext(fs.readFileSync(path.join(root,'ops.js'),'utf8'),ctx,{filename:'ops.js'});
vm.runInContext(fs.readFileSync(path.join(root,'contracts.js'),'utf8'),ctx,{filename:'contracts.js'});
const run=c=>vm.runInContext(c,ctx);
let pass=0,fail=0;
function ok(c,name,extra){if(c){pass++;console.log('  ✓ '+name);}else{fail++;console.log('  ✗ '+name+(extra!==undefined?'  → '+JSON.stringify(extra):''));}}
function eq(a,b,name){ok(JSON.stringify(a)===JSON.stringify(b),name,{got:a,expected:b});}
function near(a,b,name,eps){ok(Math.abs(a-b)<=(eps||0.005),name,{got:a,expected:b});}
function section(t){console.log('\n'+t);}
ctx._j=x=>x;
const fixedDb=()=>run(`db.settings=db.settings||{};db.settings.exchangeRate=15000;db.maintenance=[];db.contracts=[];db.workers=[{id:'w1',name:'فني أحمد'},{id:'w2',name:'فني <b>زياد</b>'}];
 db.clients=[{id:'c1',name:'بنك الشام',phone:'011',address:'دمشق',branches:[],branchDetails:[{id:'b1',name:'فرع المزة',address:'المزة',contactName:'',contactPhone:'',mapUrl:''}]}];
 db.security=db.security||{};db.security.users=[{id:'u1',username:'مدير',role:'admin'}];`);
fixedDb();
const mk=(over)=>run(`(function(){const c=Object.assign({id:uid(),number:'CT-0001',clientId:'c1',branchId:'b1',startDate:'2027-01-31',anchorDay:0,durationMonths:0,intervalMonths:1,value:1200,currency:'USD',status:'active',nextVisitDate:'',payments:[]},${JSON.stringify(over||{})});db.contracts.push(c);return c;})()`);

section('T29 — توليد 3 زيارات قادمة دايماً');
let c=mk({id:'k1'});
run("contractEnsureVisits(db.contracts[0],'2027-01-10')");
eq(run("db.contracts[0].visits.map(v=>v.slotDate)"),['2027-02-28','2027-03-31','2027-04-30'],'31 كانون2 → 28 شباط → 31 آذار → 30 نيسان');
eq(run("db.contracts[0].visits.length"),3,'3 زيارات قادمة');
run("contractEnsureVisits(db.contracts[0],'2027-01-10')");
eq(run("db.contracts[0].visits.length"),3,'التشغيل المتكرر ما بيكرر');
eq(run("db.contracts[0].nextVisitDate"),'2027-02-28','nextVisitDate = أقرب زيارة مفتوحة (للتنبيهات القديمة)');
run("(function(){const c=db.contracts[0];visitComplete(c,c.visits[0],{doneDate:'2027-03-09'});})()");
eq(run("db.contracts[0].visits.map(v=>v.slotDate+':'+v.status)"),['2027-02-28:done','2027-03-31:scheduled','2027-04-30:scheduled','2027-05-31:scheduled'],'إنجاز متأخر (9 آذار): الزيارة 4 بموعدها 31 أيار — الجدول ما زحف');
eq(run("db.contracts[0].visits.filter(v=>VISIT_OPEN.includes(v.status)).length"),3,'بعد الإنجاز لسا 3 قادمة');
eq(run("db.contracts[0].nextVisitDate"),'2027-03-31','nextVisitDate تحدّث');
section('T29 — حدود مدة العقد / ملغي / منتهي');
fixedDb();mk({id:'k2',durationMonths:2});
run("contractEnsureVisits(db.contracts[0],'2027-01-10')");
eq(run("db.contracts[0].visits.map(v=>v.slotDate)"),['2027-02-28'],'عقد شهرين (ينتهي 30 آذار): ما بتنولّد زيارة 31 آذار');
fixedDb();mk({id:'k3',status:'cancelled'});
eq(run("contractEnsureVisits(db.contracts[0],'2027-01-10')"),0,'عقد ملغي ما بيولّد');
fixedDb();mk({id:'k4',nextVisitDate:'2027-03-31'});
run("contractEnsureVisits(db.contracts[0],'2027-01-10')");
eq(run("db.contracts[0].visits[0].slotDate+'/'+db.contracts[0].visits[0].n"),'2027-03-31/2','أول توليد بيبدأ من nextVisitDate المحفوظ (عقد مرحّل) بدون إعادة بناء الماضي');
section('T29 — دمج التكرار (جهازين ولّدوا نفس الزيارة)');
fixedDb();mk({id:'k5'});
run("(function(){const c=db.contracts[0];contractEnsureVisits(c,'2027-01-10');const dup=JSON.parse(JSON.stringify(c.visits[0]));dup.id='zzz';dup.status='inprogress';c.visits.push(dup);contractEnsureVisits(c,'2027-01-10');})()");
eq(run("db.contracts[0].visits.filter(v=>v.n===1).length"),1,'رقم زيارة مكرر انحذف');
eq(run("db.contracts[0].visits.find(v=>v.n===1).status"),'inprogress','حافظنا على الأكتر تقدماً');
section('T29 — تأجيل ما بيحرّك الجدول + حالة فائتة');
fixedDb();mk({id:'k6'});
run("(function(){const c=db.contracts[0];contractEnsureVisits(c,'2027-01-10');visitPostpone(c,c.visits[0],'2027-03-15');})()");
eq(run("db.contracts[0].visits[0].status+'|'+db.contracts[0].visits[0].date+'|'+db.contracts[0].visits[0].slotDate"),'postponed|2027-03-15|2027-02-28','تأجيل: التاريخ الفعلي تغيّر والـslot لا');
eq(run("visitEffectiveStatus(db.contracts[0].visits[1],'2027-04-02')"),'missed','مجدولة فات موعدها = فائتة');
eq(run("visitEffectiveStatus(db.contracts[0].visits[1],'2027-03-31')"),'scheduled','يوم الموعد مو فائتة');
eq(run("visitPostpone(db.contracts[0],db.contracts[0].visits[0],'xx').ok"),false,'تاريخ تأجيل غلط مرفوض');

section('T49 — الإدخال بالنيابة: مين نفّذ ≠ مين سجّل');
fixedDb();mk({id:'k7'});
run("sessionStorage.setItem('security_mask_user','u1')");
run("(function(){const c=db.contracts[0];contractEnsureVisits(c,'2027-01-10');window.__r=visitComplete(c,c.visits[0],{doneDate:'2027-03-01',performedBy:'w1',wage:25000,wageCurrency:'SYP'});})()");
eq(run("db.contracts[0].visits[0].performedByName+'|'+db.contracts[0].visits[0].recordedByName"),'فني أحمد|مدير','الفني = منفّذ، المدير = مسجّل');
section('T31 — إنجاز الزيارة بينشئ بطاقة عمل بأجور الفني');
eq(run("db.maintenance.length"),1,'بطاقة عمل وحدة');
const card=run("db.maintenance[0]");
eq([card.contractId,card.visitId===run("db.contracts[0].visits[0].id"),card.workKind,card.status,card.clientId,card.branch],['k7',true,'periodic','مكتملة','c1','فرع المزة'],'ربط بالعقد والزيارة + نوع دورية + فرع');
eq(run("db.maintenance[0].workers.map(w=>w.workerId+':'+w.wage+':'+w.currency+':'+w.workerName)"),['w1:25000:SYP:فني أحمد'],'أجر الفني على البطاقة');
eq(run("db.maintenance[0].startDate"),'2027-03-01','تاريخ البطاقة = تاريخ الإنجاز');
near(run("getMaintenanceWages(db.maintenance[0])"),25000/15000,'getMaintenanceWages بيقرأ الأجر (25000 ل.س ÷ 15000 = $1.67 بعملة العقد)',0.01);
eq(run("visitComplete(db.contracts[0],db.contracts[0].visits[0],{}).ok"),false,'إنجاز مرتين مرفوض');
eq(run("db.maintenance.length"),1,'ما انكرّرت البطاقة');
section('T31 — مصاريف الزيارة + إعادة الفتح');
fixedDb();mk({id:'k8'});
run("(function(){const c=db.contracts[0];contractEnsureVisits(c,'2027-01-10');const v=c.visits[0];v.expenses=[{note:'كبل',amount:5,currency:'USD'},{note:'فاضي',amount:0}];v.checklist=[{t:'فحص 1',done:true},{t:'فحص 2',done:false}];v.notes='ملاحظة';visitComplete(c,v,{doneDate:'2027-03-01'});})()");
eq(run("db.maintenance[0].expenses.map(e=>e.amount+e.currency)"),['5USD'],'المصروف ذو المبلغ صفر ما انضاف');
ok(run("db.maintenance[0].workDesc.includes('فحص 1')&&!db.maintenance[0].workDesc.includes('فحص 2')"),'وصف البطاقة = البنود المنجزة بس');
eq(run("db.maintenance[0].workers.length"),0,'بدون فني ← بدون صف أجر');
run("db.maintenance[0].payments=[{amount:1}];");
eq(run("visitReopen(db.contracts[0],db.contracts[0].visits[0]).ok"),false,'إعادة فتح مرفوضة لو البطاقة عليها دفعات');
run("db.maintenance[0].payments=[];");
eq(run("visitReopen(db.contracts[0],db.contracts[0].visits[0]).ok"),true,'إعادة فتح مقبولة');
eq(run("db.maintenance.length+'|'+db.contracts[0].visits[0].status"),'0|scheduled','انحذفت البطاقة ورجعت الزيارة مجدولة');

section('T30 — لوحة اليوم');
fixedDb();
mk({id:'a',number:'CT-1',startDate:'2027-01-01',intervalMonths:1});mk({id:'b',number:'CT-2',startDate:'2027-01-01',intervalMonths:1,branchId:''});
run(`(function(){db.contracts.forEach(c=>{c.visits=[];c.nextVisitDate='2027-01-01';});
 const A=db.contracts[0],B=db.contracts[1];
 const mkv=(c,n,date,st,w)=>{const v=newVisit(c,n);v.slotDate=date;v.date=date;v.status=st||'scheduled';visitSetTechnician(v,w||'');c.visits.push(v);return v;};
 mkv(A,1,'2027-03-10','scheduled','w2');mkv(A,2,'2027-03-12','scheduled','w1');mkv(A,3,'2027-03-14','scheduled','w1');mkv(A,4,'2027-03-30','scheduled','w1');
 mkv(B,1,'2027-03-12','scheduled','');mkv(B,2,'2027-03-05','done','w1');mkv(B,3,'2027-03-20','inprogress','w1');})()`);
const Bd=run("(function(){const b=visitsBoard(db,'2027-03-12');return {t:b.today.map(x=>x.contract.number+'#'+x.visit.n),o:b.overdue.map(x=>x.visit.n),w:b.week.map(x=>x.visit.n)};})()");
eq(Bd.t,['CT-1#2','CT-2#3','CT-2#1'],'اليوم: الفني أحمد أول (حسب الاسم) ثم بدون فني؛ والزيارة الجارية بتظهر باليوم');
eq(Bd.o,[1],'متأخرة: زيارة 10 آذار');
eq(Bd.w,[3],'هالأسبوع: 14 آذار فقط (30 آذار برّا)');
eq(run("visitsBoard(db,'2027-03-12','w1').today.length"),2,'فلتر الفني');
eq(run("visitsBoard(db,'2027-03-12').week.length+visitsBoard(db,'2027-03-12').today.length"),4,'المنجزة ما بتطلع');
section('T30 — زيارة اليوم تظهر "اليوم" بأي ساعة (توقيت محلي)');
const tz=process.env.TZ||'(default)';
eq(run("(function(){const c={startDate:'2027-01-31',intervalMonths:1};const v={status:'scheduled',date:localToday(),slotDate:localToday()};return visitEffectiveStatus(v)+'|'+daysUntilISO(v.date);})()"),'scheduled|0','TZ='+tz+': زيارة تاريخها اليوم = اليوم (مو فائتة)');

section('T32 — تقرير الزيارة PDF');
fixedDb();mk({id:'k9'});
run("(function(){const c=db.contracts[0];contractEnsureVisits(c,'2027-01-10');const v=c.visits[0];visitSetTechnician(v,'w2');v.checklist=[{t:'بند <script>x</script>',done:true}];v.notes='<img src=x onerror=alert(1)>';v.signedBy='عميل \"س\"';v.signature='data:image/png;base64,iVBORw0KGgo=';visitComplete(c,v,{doneDate:'2027-03-01'});})()");
const html=run("visitReportHTML(db.contracts[0],db.contracts[0].visits[0])");
ok(html.includes('تقرير زيارة صيانة')&&html.includes('بنك الشام')&&html.includes('فرع المزة'),'التقرير فيه العميل والفرع');
ok(!html.includes('<script>')&&!html.includes('<img src=x')&&!html.includes('<b>زياد</b>'),'كل النصوص مرمّزة (XSS)');
ok(html.includes('data:image/png;base64,iVBORw0KGgo=')&&html.includes('توقيع العميل'),'التوقيع الصحيح بيظهر');
run("db.contracts[0].visits[0].signature='javascript:alert(1)'");
ok(!run("visitReportHTML(db.contracts[0],db.contracts[0].visits[0])").includes('javascript:'),'توقيع غير PNG ما بيظهر');
ok(html.includes('print-sign-row')&&html.includes('print-doc'),'نفس قالب الطباعة (A4 + موبايل + PDF)');

section('عقد: تغيير التواريخ بيعيد توليد الزيارات النظيفة');
fixedDb();mk({id:'k10'});
run("(function(){const c=db.contracts[0];contractEnsureVisits(c,'2027-01-10');c.visits[0].performedBy='w1';c.startDate='2027-01-15';contractResyncVisits(c);})()");
eq(run("db.contracts[0].visits.map(v=>v.n+':'+v.slotDate)"),['1:2027-02-28','2:2027-03-15','3:2027-04-15','4:2027-05-15'].slice(0,run("db.contracts[0].visits.length")),'الزيارة اللي إلها فني انحفظت، والنظيفة اتولّدت من جديد على الجدول الجديد');
console.log(`\n${pass} ✓  ${fail} ✗`);process.exit(fail?1:0);
