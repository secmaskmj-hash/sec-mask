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
run("db.settings=db.settings||{};db.settings.exchangeRate=15000;");

section('T28 — مواعيد الزيارات (نهاية الشهر + السنة الكبيسة)');
eq(run("[1,2,3].map(n=>contractVisitDate({startDate:'2027-01-31',intervalMonths:1},n))"),['2027-02-28','2027-03-31','2027-04-30'],'31 كانون2 ← 28 شباط ← 31 آذار ← 30 نيسان');
eq(run("addMonthsClamped('2028-01-31',1)"),'2028-02-29','سنة كبيسة: 29 شباط');
eq(run("addMonthsClamped('2027-03-31',-1)"),'2027-02-28','طرح شهر من 31 آذار');
eq(run("addMonthsClamped('2026-01-15',-1)"),'2025-12-15','طرح شهر عبر السنة');
eq(run("addMonthsClamped('2026-11-30',3)"),'2027-02-28','30 تشرين2 + 3 أشهر');
eq(run("contractEndDate({startDate:'2027-01-31',durationMonths:12,intervalMonths:3})"),'2028-01-30','آخر يوم بعقد سنة');
eq(run("contractEndDate({startDate:'2027-01-31',durationMonths:0})"),'','مدة 0 = مفتوح');
eq(run("contractNextVisitAfter({startDate:'2027-01-31',intervalMonths:1,durationMonths:12},'2027-03-01')"),'2027-03-31','أول زيارة قادمة بعد تاريخ');
eq(run("contractNextVisitAfter({startDate:'2027-01-31',intervalMonths:1,durationMonths:2},'2027-05-01')"),'','بعد نهاية العقد ما في زيارة');
section('T9/T30 — حساب الأيام بالتاريخ المحلي (مو UTC)');
eq(run("daysUntilISO('2026-11-22','2026-11-22')"),0,'زيارة اليوم = 0 (مو -1 بعد 3 الفجر)');
eq(run("daysUntilISO('2026-11-21','2026-11-22')"),-1,'أمس = -1');
eq(run("daysUntilISO('2026-12-01','2026-11-22')"),9,'بعد 9 أيام');
eq(run("daysUntilISO('2027-03-29','2027-03-27')"),2,'عبر تغيير التوقيت الصيفي');

section('T28 — ترحيل العقود القديمة (نفس التاريخ)');
run(`db.clients=[
 {id:'c1',name:'شهري',contractType:'شهري',nextVisitDate:'2027-03-31',phone:'',branches:[]},
 {id:'c2',name:'ربع',contractType:'ربع سنوي',nextVisitDate:'2027-05-31',phone:'',branches:[]},
 {id:'c3',name:'نص',contractType:'نصف سنوي',nextVisitDate:'2027-02-28',phone:'',branches:[]},
 {id:'c4',name:'سنوي',contractType:'سنوي',nextVisitDate:'2026-10-05',phone:'',branches:[]},
 {id:'c5',name:'بدون موعد',contractType:'سنوي',nextVisitDate:'',phone:'',branches:[]},
 {id:'c6',name:'لا عقد',contractType:'لا يوجد',nextVisitDate:'2027-01-01',phone:'',branches:[]},
 {id:'c7',name:'عادي',phone:'',branches:[]}];db.contracts=[];db.migrations={};normalizeDB();`);
eq(run("db.contracts.length"),5,'5 عملاء بعقد قديم ← 5 عقود (من لا عقد/عادي ما انعمل)');
const bad=run("db.contracts.filter(c=>c.legacyClientId!=='c5').filter(ct=>{const cl=db.clients.find(x=>x.id===ct.clientId);return ct.nextVisitDate!==cl.nextVisitDate||contractVisitDate(ct,1)!==cl.nextVisitDate;}).map(c=>c.legacyClientId)");
eq(bad,[],'كل عقد مرحّل: الموعد = تاريخ العميل، والزيارة 1 بالصيغة (بدء + فترة) بتعطي نفس التاريخ');
ok(run("db.contracts.every(c=>c.needsReview&&c.value===0&&c.durationMonths===0)"),'القيمة/المدة مجهولة ← needsReview');
ok(run("db.contracts.every(c=>contractEffectiveStatus(c,'2030-01-01')==='active')"),'المدة المفتوحة ما بتنتهي لحالها');
eq(run("db.contracts.find(c=>c.legacyClientId==='c5').startDate===localToday()"),true,'عميل بدون موعد: البدء = اليوم');
run("normalizeDB();normalizeDB();");
eq(run("db.contracts.length"),5,'التشغيل المتكرر ما بيكرر العقود');
run("db.contracts=db.contracts.filter(c=>c.legacyClientId!=='c1');normalizeDB();");
eq(run("db.contracts.some(c=>c.legacyClientId==='c1')"),false,'عقد انحذف عمداً ما بيرجع ينولد (علم الترحيل)');
// جهازين رحّلوا بنفس الوقت → عقد وحد، نفس الاختيار على الجهازين
run("db.contracts.push(Object.assign({},db.contracts.find(c=>c.legacyClientId==='c2'),{id:'zzz-dup'}));db.contracts.push(Object.assign({},db.contracts.find(c=>c.legacyClientId==='c3'),{id:'aaa-dup',payments:[{id:'p',amount:5}]}));normalizeDB();");
eq(run("db.contracts.filter(c=>c.legacyClientId==='c2').length"),1,'نسخة مكررة من الترحيل بتنشال');
eq(run("db.contracts.find(c=>c.legacyClientId==='c3').id"),'aaa-dup','بيضل الأكتر اكتمالاً (فيه دفعات)');
eq(run("(()=>{const ids=db.contracts.map(c=>c.number);return new Set(ids).size===ids.length})()"),true,'أرقام العقود فريدة');

section('T48 — جدول الدفعات');
run("var C1={startDate:'2027-01-01',value:1200,currency:'USD',durationMonths:12,intervalMonths:3,anchorDay:0};");
eq(run("(()=>{const p=contractGenerateSchedule(C1,'single');return [p.length,p[0].amount,p[0].dueDate]})()"),[1,1200,'2027-01-01'],'سنوي ثابت = دفعة وحدة بتاريخ البدء');
eq(run("contractGenerateSchedule(C1,'equal',{count:4,stepMonths:3}).map(p=>p.amount+'@'+p.dueDate)"),['300@2027-01-01','300@2027-04-01','300@2027-07-01','300@2027-10-01'],'4 دفعات متساوية كل 3 أشهر');
run("var C2={startDate:'2027-01-31',value:1000,currency:'USD'};");
eq(run("(()=>{const p=contractGenerateSchedule(C2,'equal',{count:3,stepMonths:1});return [p.map(x=>x.amount),contractScheduledTotal(Object.assign({},C2,{payments:p}))]})()"),[[333.33,333.33,333.34],1000],'الكسور: الأخيرة بتمتص والمجموع = القيمة بالضبط');
eq(run("contractGenerateSchedule(C2,'equal',{count:3,stepMonths:1}).map(p=>p.dueDate)"),['2027-01-31','2027-02-28','2027-03-31'],'مواعيد الدفعات بنهاية الشهر');
// المثال المحسوب بالخطة: 200+200+300+500 = 1200
run("var C3={id:'k',value:1200,currency:'USD',payments:[]};['2026-10-01:200','2026-11-01:200','2026-12-01:300','2027-01-01:500'].forEach(s=>{const a=s.split(':');C3.payments.push(newContractPayment(C3,a[0],+a[1]));});");
eq(run("[contractScheduledTotal(C3),contractScheduleDiff(C3)]"),[1200,0],'مجموع الدفعات = قيمة العقد ← فرق 0');
run("C3.payments[3].amount=450;");
eq(run("contractScheduleDiff(C3)"),50,'مجموع الدفعات (1150) أقل من القيمة (1200) ← تحذير بالفرق (50)');
run("C3.payments[3].amount=500;");
eq(run("(()=>{const f=contractFinancials(C3,'2026-11-22');return [f.dueSoFar,f.remainingDue,f.overdue,f.overdueCount,f.paid]})()"),[400,400,400,2,0],'اليوم 22/11: مستحق 400 (دفعتين)، متأخرتين');
eq(run("contractPaymentState(C3.payments[1],'2026-11-01')+','+contractPaymentState(C3.payments[1],'2026-11-02')+','+contractPaymentState(C3.payments[1],'2026-10-31')"),'due,overdue,upcoming','حالة الدفعة: اليوم/متأخرة/قادمة (بتاريخ محلي)');
// تسجيل دفعات
eq(run("contractRegisterPayment(C3.payments[0],250,'2026-11-05',15000).ok"),false,'دفعة أكبر من المتبقي بتنرفض (T5)');
eq(run("contractRegisterPayment(C3.payments[0],0,'2026-11-05').ok"),false,'صفر بيترفض');
eq(run("contractRegisterPayment(C3.payments[0],120.5,'2026-11-05',15000).ok"),true,'دفعة جزئية');
eq(run("(()=>{const f=contractFinancials(C3,'2026-11-22');return [f.paid,f.remainingDue,f.overdue,contractPaymentRemaining(C3.payments[0])]})()"),[120.5,279.5,279.5,79.5],'بعد دفعة جزئية: المتبقي = المستحق − المسدد');
run("contractRegisterPayment(C3.payments[0],79.5,'2026-11-06',15000);");
eq(run("contractPaymentState(C3.payments[0],'2026-11-22')"),'paid','اكتملت ← مسددة');
eq(run("contractFinancials(C3,'2026-11-22').overdueCount"),1,'بقيت دفعة متأخرة وحدة');
// العملتين وسعر الصرف المحفوظ
run("var C4={id:'k4',value:30000000,currency:'SYP',payments:[]};C4.payments.push(newContractPayment(C4,'2026-11-01',15000000));C4.payments.push(newContractPayment(C4,'2026-12-01',15000000));");
run("contractRegisterPayment(C4.payments[0],15000000,'2026-11-02',15000);db.settings.exchangeRate=30000;");
near(run("contractPaymentUSD(C4.payments[0],15000000)"),1000,'دفعة ليرة: مكافئ الدولار ثابت بسعر وقتها حتى لو تغيّر السعر');
near(run("contractPaymentUSD(C4.payments[1])"),500,'دفعة ليرة مو مسددة: بتاخد السعر الحالي');
eq(run("C4.payments[0].currency"),'SYP','عملة الدفعة = عملة العقد');
run("db.settings.exchangeRate=15000;");
near(run("contractPaymentUSD({currency:'USD',amount:300})"),300,'عقد بالدولار: بدون تحويل');

section('T36 — فروع العميل ودمج المكرر');
run(`db.clients=[{id:'a',name:'شركة الأمل',phone:'0912345678',contact:'',branches:['دمشق','حلب'],address:''}];normalizeDB();`);
eq(run("db.clients[0].branchDetails.map(b=>b.name)"),['دمشق','حلب'],'الفروع القديمة (أسماء) صارت تفاصيل');
const ids1=run("JSON.stringify(db.clients[0].branchDetails.map(b=>b.id))");
run("db.clients[0].branchDetails=null;normalizeDB();");
eq(run("JSON.stringify(db.clients[0].branchDetails.map(b=>b.id))"),ids1,'معرّفات الفروع ثابتة (ما بتتغير بين جهازين)');
run("db.clients[0].branchDetails[0].address='شارع بغداد';db.clients[0].branchDetails[0].contactName='أبو علي';normalizeDB();");
eq(run("db.clients[0].branchDetails[0].address+'|'+db.clients[0].branchDetails[0].contactName"),'شارع بغداد|أبو علي','التفاصيل بتضل عند المزامنة مع قائمة الأسماء');
run("db.clients[0].branches=['دمشق'];normalizeDB();");
eq(run("db.clients[0].branchDetails.length"),1,'حذف فرع من الأسماء بيحذفه من التفاصيل');
eq(run("[safeExternalUrl('https://maps.app/x'),safeExternalUrl('javascript:alert(1)'),safeExternalUrl('ftp://x'),safeExternalUrl(' http://a.b/c ')]"),['https://maps.app/x','','','http://a.b/c'],'رابط الموقع: http/https فقط');
// دمج
run(`db.clients=[
 {id:'p',name:'شركة الأمل',phone:'0912345678',contact:'',type:'شركة',referrerName:'',address:'',branches:['دمشق'],branchDetails:[{id:'bp1',name:'دمشق',address:'',contactName:'',contactPhone:'',mapUrl:''}]},
 {id:'d1',name:'شركه الأمل ',phone:'+963 912 345 678',contact:'a@b.c',type:'شركة',referrerName:'سامر',address:'ح',branches:['دمشق','حلب'],branchDetails:[{id:'bd1',name:'دمشق',address:'شارع X',contactName:'',contactPhone:'',mapUrl:''},{id:'bd2',name:'حلب',address:'',contactName:'م',contactPhone:'1',mapUrl:''}]},
 {id:'o',name:'عميل آخر',phone:'0999',branches:[]},
 {id:'d2',name:'الأمل',phone:'0912345678',branches:[]}];
 db.sales=[{id:'s1',clientId:'d1'},{id:'s2',clientId:'p'},{id:'s3',clientId:'o'}];
 db.maintenance=[{id:'m1',clientId:'d1',branch:'حلب'}];db.quotes=[{id:'q1',clientId:'d1'}];db.projects=[{id:'pr',clientId:'d1'}];db.docs=[{id:'dc',clientId:'d1'}];
 db.contracts=[{id:'k',clientId:'d1',branchId:'bd1'},{id:'k2',clientId:'d1',branchId:'bd2'}];`);
const groups=run("findDuplicateClientGroups(db).map(g=>g.map(c=>c.id).sort())");
eq(groups,[['d1','d2','p']],'الكشف: نفس الاسم (تشكيل/همزة/ة) أو نفس الهاتف (+963 مقابل 09) ← مجموعة وحدة، والمختلف لا');
const mr=run("mergeClientsIn(db,'p',['d1','d2'])");
ok(mr.ok&&mr.merged===2,'الدمج نجح',mr);
eq(run("db.clients.map(c=>c.id)"),['p','o'],'المكررين انحذفوا');
eq(run("[db.sales,db.maintenance,db.quotes,db.projects,db.docs,db.contracts].map(a=>a.every(x=>x.clientId==='p'||x.clientId==='o'))"),[true,true,true,true,true,true],'كل السجلات المرتبطة انتقلت للأساسي');
eq(run("db.sales.find(s=>s.id==='s3').clientId"),'o','سجلات عميل تاني ما انلمست');
eq(run("db.clients[0].branchDetails.map(b=>b.name).sort()"),['حلب','دمشق'],'الفروع اتوحّدت بالاسم (دمشق مرة وحدة)');
eq(run("db.clients[0].branchDetails.find(b=>b.name==='دمشق').address"),'شارع X','تفاصيل الفرع المكرر اندمجت (العنوان الفاضي اتعبّى)');
eq(run("db.contracts.find(c=>c.id==='k').branchId"),'bp1','عقد على فرع مكرر ← انتقل لفرع الأساسي');
eq(run("db.contracts.find(c=>c.id==='k2').branchId"),'bd2','عقد على فرع جديد ← بقي على فرعه');
eq(run("(()=>{const c=db.clients[0];return [c.contact,c.referrerName,c.address]})()"),['a@b.c','سامر','ح'],'الحقول الفاضية بالأساسي اتعبّت من المكرر');
eq(run("db.maintenance[0].branch"),'حلب','اسم الفرع بالعمل ما تغيّر');
eq(run("mergeClientsIn(db,'nope',['o']).ok"),false,'أساسي غير موجود ← رفض');

section('T37 — أساس هامش واحد (التحذير = الرقم الظاهر)');
near(run("marginPctOf(900,400)"),55.5556,'هامش = (الإيراد − التكلفة) ÷ الإيراد',0.001);
eq(run("[marginPctOf(0,10),marginPctOf(-5,1)]"),[null,null],'إيراد صفر/سالب ← بدون هامش (مو NaN/Infinity)');
// maintFinancials بنفس مدخلات اللوحة
const els={'m-workamount':{value:'1000'},'m-currency':{value:'USD'}};
ctx.document={getElementById:id=>els[id]||null};
run("window._mW=[{wage:300,currency:'USD'}];window._mE=[{amount:50,currency:'USD'}];window._mCars=[{amount:50,currency:'USD'}];window._mAdv=[{amount:100,currency:'USD'}];");
const F=run("(()=>{const f=maintFinancials(null);return {net:f.netIncome,cost:f.cost,gp:f.grossProfit,m:f.marginPct,cars:f.carCosts}})()");
eq([F.net,F.cost,F.gp,F.cars],[900,400,500,50],'اللوحة: الصافي 900 − (أجور 300 + مصاريف 50 + سيارات 50) = 500');
near(F.m,55.5556,'الهامش المحسوب = 55.6% (كان التحذير يتجاهل السيارات والدفعات المقدمة)',0.001);
run("window._mCars=[];");
near(run("maintFinancials(null).marginPct"),(900-350)/900*100,'بدون سيارات ← الرقم بيتغيّر مع المدخلات',0.001);
const src=fs.readFileSync(path.join(root,'ops.js'),'utf8');
ok(!/\(\(workAmount-totalCost\)\/workAmount\)/.test(src)&&!/\(\(totalPrice-totalCost\)\/totalPrice\)/.test(src)&&!/\(\(totalValue-totalCostEntered\)\/totalValue\)/.test(src),'ما بقي أي حساب هامش مكرر بالأعمال/المبيعات/العروض');
eq(run("Object.keys(WORK_KINDS)"),['periodic','emergency','install'],'تصنيفات العمل: دورية/طارئة/تركيب');

section('الواجهة — الأمان وعدم التكسير');
const csrc=fs.readFileSync(path.join(root,'contracts.js'),'utf8');
ok(!/onclick="[^"]*\$\{(c|p)\.id\}/.test(csrc),'ما في id مباشر داخل onclick (كله من ctq)');
eq(run("ctq(\"x');alert(1);//\")"),'&quot;x&#39;);alert(1);//&quot;','ctq بيهرّب الاقتباس');
ok(!!run("typeof renderContracts==='function'&&typeof openContractPaymentsModal==='function'"),'صفحة العقود والدفعات معرّفة');
ok(run("PAGE_BUNDLE.contracts==='contracts'&&_bundleDeps.contracts[0]==='ops'&&PAGE_LIST.some(p=>p.id==='contracts')"),'العقود مسجّلة بالصفحات والحزم والصلاحيات');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
ok(html.includes("navigate('contracts')")&&sw.includes("contracts.js"),'عنصر القائمة + تخزين الملف للعمل بدون إنترنت');
ok(run("validateImportedDB({contracts:[{id:'a'}],clients:[],workers:[]})")===null&&run("validateImportedDB({contracts:{},clients:[],workers:[]})")!==null,'الاستيراد بيتحقق من قائمة العقود');

console.log('\n'+pass+' passed, '+fail+' failed  (TZ='+(process.env.TZ||'system')+')');
process.exit(fail?1:0);
