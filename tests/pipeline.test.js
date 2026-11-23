/* اختبارات المرحلة 4 / الجزء 3: T39 خط العروض (نسخ، صلاحية، سبب رفض، نسبة تحويل، بوابة التحويل) + واجهة المخزون
   التشغيل: node tests/pipeline.test.js (جرّبه كمان مع TZ=Asia/Riyadh و TZ=America/Los_Angeles) */
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..');
function mkProxy(n){const f=function(){return mkProxy(n+'()');};return new Proxy(f,{get:(t,k)=>{if(k===Symbol.toPrimitive)return()=>'';if(k==='then')return undefined;return mkProxy(n+'.'+String(k));},apply:()=>mkProxy(n+'()')});}
const store={};
const ctx={console,Math,Date,JSON,Number,String,Object,Array,RegExp,isFinite,isNaN,parseFloat,parseInt,Promise,Set,Map,Symbol,Error,Intl,Blob,
 setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,
 localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},
 document:mkProxy('document'),navigator:{userAgent:'node',onLine:true},location:{href:'',hash:'',search:''},
 addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),getComputedStyle:()=>({getPropertyValue:()=>''}),
 fetch:()=>Promise.reject(new Error('no net')),alert(){},confirm:()=>true,prompt:()=>null,requestAnimationFrame:()=>0,structuredClone:x=>JSON.parse(JSON.stringify(x))};
ctx.sessionStorage=ctx.localStorage;ctx.supabase={createClient:()=>mkProxy('sb')};ctx.window=ctx;ctx.self=ctx;
vm.createContext(ctx);
['core.js','pipeline.js','ops.js','inventory.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f}));
const run=c=>vm.runInContext(c,ctx);
let pass=0,fail=0;
function ok(c,name,extra){if(c){pass++;console.log('  ✓ '+name);}else{fail++;console.log('  ✗ '+name+(extra!==undefined?'  → '+JSON.stringify(extra):''));}}
function eq(a,b,name){ok(JSON.stringify(a)===JSON.stringify(b),name,{got:a,expected:b});}
function section(t){console.log('\n'+t);}
run(`db.settings=db.settings||{};db.settings.exchangeRate=15000;db.quotes=[];db.sales=[];db.maintenance=[];db.projects=[];db.clients=[{id:'c1',name:'بنك الشام',branches:[]}];`);

section('T39 — الصلاحية (تاريخ محلي، نهاية الشهر)');
eq(run(`qpAddDays('2027-01-31',30)`),'2027-03-02','31 كانون2 + 30 يوم = 2 آذار');
eq(run(`qpAddDays('2027-12-20',20)`),'2028-01-09','عبور السنة');
run(`db.settings.quoteValidDays=15`);
eq(run(`qpValidUntil({date:'2027-03-01'})`),'2027-03-16','الصلاحية الافتراضية من الإعدادات (15 يوم)');
eq(run(`qpValidUntil({date:'2027-03-01',validUntil:'2027-04-01'})`),'2027-04-01','تاريخ صريح بيغلب الافتراضي');
run(`db.settings.quoteValidDays=30`);
ok(run(`qpIsExpired({status:'معلق',date:'2027-01-01'},'2027-02-01')`),'معلق بعد 30 يوم = منتهي');
ok(!run(`qpIsExpired({status:'معلق',date:'2027-01-01'},'2027-01-31')`),'يوم الصلاحية الأخير لسا صالح');
ok(!run(`qpIsExpired({status:'متفق',date:'2020-01-01'},'2027-02-01')`),'المتفق ما بينتهي');
ok(!run(`qpIsExpired({status:'معلق'},'2027-02-01')`),'بدون تاريخ = ما بينتهي');

section('T39 — النسخ');
const base=`{id:'q1',clientId:'c1',projectName:'مشروع س',date:'2027-01-01',status:'معلق',discount:0,currency:'USD',items:[{kind:'مادة',desc:'Camera',qty:2,price:100,cost:60}],totalValue:200}`;
let e=run(`(function(){const ex=${base};const en=JSON.parse(JSON.stringify(ex));return qpOnSave(null,en,{});})()`);
eq([e.version,e.versions.length,e.statusHistory.length],[1,0,1],'عرض جديد: نسخة 1 بدون سجل نسخ وفيه حالة أولية');
e=run(`(function(){const ex=${base};const en=JSON.parse(JSON.stringify(ex));en.items[0].price=90;en.totalValue=180;return qpOnSave(ex,en,{});})()`);
eq([e.version,e.versions.length,e.versions[0].totalValue,e.versions[0].items[0].price],[2,1,200,100],'تغيير سعر بند = نسخة 2 ومحفوظ القديم (200 / 100)');
e=run(`(function(){const ex=${base};const en=JSON.parse(JSON.stringify(ex));en.notes='x';return qpOnSave(ex,en,{});})()`);
eq([e.version,e.versions.length],[1,0],'تغيير ملاحظة بس ما بيعمل نسخة');
e=run(`(function(){const ex=${base};const en=JSON.parse(JSON.stringify(ex));en.discount=10;return qpOnSave(ex,en,{});})()`);
eq(e.version,2,'تغيير الحسم = نسخة جديدة');

section('T39 — سبب الرفض وسجل الحالة');
e=run(`(function(){const ex=${base};const en=JSON.parse(JSON.stringify(ex));en.status='مرفوض';return qpOnSave(ex,en,{rejectReason:'السعر عالي'});})()`);
eq([e.rejectReason,e.statusHistory.map(x=>x.status)],['السعر عالي',['مرفوض']],'رفض بسبب + سجل حالة');
e=run(`(function(){const ex=${base};ex.status='مرفوض';ex.rejectReason='قديم';const en=JSON.parse(JSON.stringify(ex));en.status='معلق';return qpOnSave(ex,en,{rejectReason:'قديم'});})()`);
eq(e.rejectReason,'','رجوع لمعلق بيمسح سبب الرفض');
run(`(function(){const q={status:'معلق'};qpSetStatus(q,'مرفوض','منافس');window._r=q;})()`);
eq(run(`[_r.status,_r.rejectReason,_r.statusHistory.length]`),['مرفوض','منافس',1],'qpSetStatus (للتحديد المتعدد)');

section('T39 — نسبة التحويل');
const mkq=(id,st,v,date,extra)=>`Object.assign({id:'${id}',status:'${st}',totalValue:${v},date:'${date}',version:1},${extra||'{}'})`;
run(`db.quotes=[${mkq('a','متفق',1000,'2027-01-01',"{statusHistory:[{status:'متفق',date:'2027-01-11'}],version:3}")},${mkq('b','متفق',500,'2027-01-01',"{statusHistory:[{status:'متفق',date:'2027-01-05'}]}")},
 ${mkq('c','مرفوض',700,'2027-01-01',"{rejectReason:'السعر عالي'}")},${mkq('d','مرفوض',300,'2027-01-01',"{rejectReason:'السعر عالي'}")},${mkq('e','مرفوض',100,'2027-01-01')},
 ${mkq('f','معلق',400,'2027-01-01')},${mkq('g','معلق',250,'2027-03-20')}];`);
const st=run(`qpStats(db.quotes,'2027-03-25')`);
eq([st.accepted,st.rejected,st.expired,st.pending],[2,3,1,1],'العدّ: 2 مقبول، 3 مرفوض، 1 منتهي، 1 حي');
near=(a,b)=>Math.abs(a-b)<0.05;
ok(near(st.conversionRate,33.3),'نسبة التحويل = 2 ÷ 6 قرارات = 33.3%',st.conversionRate);
eq([st.valueAccepted,st.valuePending,st.valueExpired],[1500,250,400],'قيم: مقبول 1500، حي 250، منتهي 400');
eq(st.reasons,{'السعر عالي':2,'بدون سبب':1},'أسباب الرفض');
eq(st.avgDaysToDecision,7,'متوسط أيام القرار (10 و4) = 7');
eq(st.avgVersionsAccepted,2,'متوسط النسخ للعروض المقبولة (3 و1) = 2');
eq(run(`qpStats([],'2027-01-01').conversionRate`),0,'بدون عروض: 0 بدون NaN');

section('T39 — بوابة المرحلة: عرض متفق ← مشروع بنفس البنود (التحويل الحقيقي)');
run(`db.quotes=[];db.sales=[];db.maintenance=[];db.projects=[];`);
run(`db.quotes.push({id:'qq',clientId:'c1',projectName:'مشروع الاختبار',date:'2027-02-01',invoiceNo:'Q-1',status:'معلق',discount:10,currency:'USD',notes:'',
 items:[{kind:'مادة',desc:'Camera',qty:4,price:100,cost:60},{kind:'مادة',desc:'DVR',qty:1,price:250,cost:180},{kind:'عمل',desc:'تمديد',qty:2,price:75,cost:0},
        {kind:'مادة',desc:'Switch',qty:1,price:300,cost:0,selectedIdx:1,alts:[{desc:'Switch PoE',qty:2,price:120,cost:70}]}],totalValue:0})`);
let thrown=null;try{run(`doConvertQuote('qq')`);}catch(x){thrown=x;}
ok(!thrown,'doConvertQuote اشتغل بالبيئة',thrown&&String(thrown.stack).slice(0,300));
const chk=run(`qpConversionCheck(db.quotes[0])`);
ok(chk.ok,'الفحص: المواد والعمل والحسم والمشروع مطابقين',chk.issues);
eq(run(`db.quotes[0].status`),'متفق','حالة العرض صارت متفق');
eq(run(`db.sales[0].items.map(i=>[i.qty,i.salePrice])`),[[4,100],[1,250],[2,120]],'بنود المبيعات = المواد (مع البديل المختار)');
// كسر متعمّد: تعديل سطر بالفاتورة لازم ينمسك
run(`db.sales[0].items[0].qty=5`);
ok(!run(`qpConversionCheck(db.quotes[0])`).ok,'تعديل كمية بالفاتورة بعد التحويل بينمسك');
run(`db.sales[0].items[0].qty=4`);
run(`db.projects[0].maintId='zzz'`);
ok(run(`qpConversionCheck(db.quotes[0])`).issues.some(x=>/العمل/.test(x)),'ربط مشروع غلط بينمسك');

section('T39 — الواجهة (smoke)');
const html=run(`qpStripHtml(db.quotes)`);ok(/نسبة التحويل/.test(html)&&/خط العروض/.test(html),'شريط الخط بيرسم');
ok(/q-valid/.test(run(`qpModalFields(null)`)),'حقول المودال');
run(`window._el={};window._ac={};invAddItem({name:'كاميرا'});renderInventory(_el,_ac)`);
ok(/كاميرا/.test(run(`_el.innerHTML`))&&/قيمة المخزون/.test(run(`_el.innerHTML`)),'صفحة المخزون بتنرسم');
ok(/openInvItemModal/.test(run(`_ac.innerHTML`)),'أزرار المخزون');
run(`window._sI=[{type:'Camera',qty:1}]`);
ok(/صنف المخزون/.test(run(`invLinkSelect('_sI',0,'')`)),'خانة ربط الصنف بتظهر لما في أصناف');
run(`db.stockItems=[]`);ok(run(`invLinkSelect('_sI',0,'')`)==='','وبتختفي لما ما في أصناف');
ok(run(`PAGE_BUNDLE.inventory`)==='inventory'&&run(`PAGE_LIST.some(p=>p.id==='inventory')`),'الصفحة مسجّلة بالتوجيه والقائمة');
ok(run(`_bundleDeps.ops.indexOf('pipeline')>=0`),'pipeline بيتحمّل مع ops');

console.log('\n'+(fail?'❌':'✅')+' نجح '+pass+' / فشل '+fail);process.exit(fail?1:0);
