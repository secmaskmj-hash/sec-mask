/* اختبارات المرحلة 4 / الجزء 4: T41 التحليلات + بوابة المرحلة 4 (إجماليات التحليل = إجماليات السجلات، توازن المخزون، تحويل العروض)
   التشغيل: node tests/analytics.test.js (جرّبه كمان مع TZ=Asia/Riyadh و TZ=America/Los_Angeles) */
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
['core.js','pipeline.js','ops.js','inventory.js','analytics.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f}));
const run=c=>vm.runInContext(c,ctx);
// T14: أسماء العمال بتنعرض حسب الصلاحية — الاختبار بيشتغل كمدير
run("db.security={enabled:true,users:[{id:'admin1',username:'مدير',role:'admin'}]}");ctx.sessionStorage.setItem('security_mask_user','admin1');
let pass=0,fail=0;
function ok(c,name,extra){if(c){pass++;console.log('  ✓ '+name);}else{fail++;console.log('  ✗ '+name+(extra!==undefined?'  → '+JSON.stringify(extra):''));}}
function eq(a,b,name){ok(JSON.stringify(a)===JSON.stringify(b),name,{got:a,expected:b});}
function near(a,b,name,eps){ok(Math.abs(a-b)<=(eps||0.005),name,{got:a,expected:b});}
function section(t){console.log('\n'+t);}

run(`db.settings=db.settings||{};db.settings.exchangeRate=15000;db.settings.useEntryRate=false;
 db.clients=[{id:'c1',name:'بنك الشام',branches:[],referrerName:'وسيط'},{id:'c2',name:'شركة النور',branches:[]}];
 db.workers=[{id:'w1',name:'أحمد'},{id:'w2',name:'خالد'},{id:'w3',name:'سعيد'}];
 db.sales=[
  {id:'s1',clientId:'c1',projectName:'مشروع أ',date:'2027-01-10',currency:'USD',totalPrice:1000.01,totalCost:600.33,paidAmount:400,payments:[],commissionPercent:10,
   items:[{type:'Camera',qty:2,salePrice:300,costPrice:200},{type:'Switch',qty:1,salePrice:400.01,costPrice:200.33}]},
  {id:'s2',clientId:'c2',projectName:'مشروع ب',date:'2027-01-20',currency:'SYP',totalPrice:15000000,totalCost:9000000,paidAmount:15000000,payments:[],
   items:[{type:'NVR',qty:1,salePrice:9000000,costPrice:5000000},{type:'Cat6',qty:3,salePrice:2000000,costPrice:1333333},{type:'غير معروف',qty:1,salePrice:0,costPrice:0}]},
  {id:'s3',clientNameFree:'زبون حر',date:'2027-02-05',currency:'USD',totalPrice:90,totalCost:50,paidAmount:0,payments:[],items:[{type:'Router',qty:1,salePrice:90,costPrice:50}]}
 ];
 db.maintenance=[
  {id:'m1',clientId:'c1',projectName:'مشروع أ',startDate:'2027-01-12',endDate:'2027-01-15',currency:'USD',workAmount:700.01,paidAmount:200,payments:[],commissionPercent:10,
   workItems:[{type:'Camera',qty:1,price:400.01},{type:'Switch',qty:1,price:300}],workers:[{workerId:'w1',wage:70,currency:'USD'},{workerId:'w2',wage:30.01,currency:'USD'}],
   expenses:[{id:'e1',amount:40.07,currency:'USD'}]},
  {id:'m2',clientId:'c2',projectName:'مشروع ب',startDate:'2027-01-25',currency:'SYP',workAmount:3000000,paidAmount:1000000,payments:[],
   workItems:[{type:'تمديد',qty:1,price:3000000}],workers:[{workerId:'w3',wage:0,currency:'SYP'},{workerId:'w1',wage:0,currency:'SYP'},{workerId:'w2',wage:0,currency:'SYP'}],expenses:[]},
  {id:'m3',clientId:'c2',startDate:'2027-03-01',currency:'USD',workAmount:333.33,paidAmount:333.33,payments:[],workItems:[],workers:[],expenses:[]}
 ];
 db.contracts=[{id:'k1',clientId:'c1',status:'active',payments:[{id:'cp1',amount:300,paidAmount:100,currency:'USD',dueDate:'2027-02-01'},{id:'cp2',amount:150,paidAmount:0,currency:'USD',dueDate:'2027-06-01'}]},
  {id:'k2',clientId:'c2',status:'cancelled',payments:[{id:'cp3',amount:999,paidAmount:0,currency:'USD',dueDate:'2027-02-01'}]}];
 db.suppliers=[{id:'sp1',name:'مورد',purchases:[{id:'p1',date:'2027-01-01',currency:'USD',total:500,paid:200,items:[],payments:[]}],accountPayments:[]}];
 db.workerPayments=[{id:'x1',workerId:'w1',amount:50,currency:'USD',paid:false}];`);

section('T41 — بوابة المرحلة: كل البُعد بيطلع نفس الإجماليات');
const chk=run(`anCheck()`);
ok(chk.ok,'anCheck: كل الأبعاد = إجماليات السجلات = القديم (±سنت/سجل)',chk.issues);
for(const d of ['client','project','tech','dept']){
  const t=run(`anProfitBy('${d}').total`),ref=run(`anRecordTotals()`);
  eq([t.revenue,t.cost,t.commission,t.profit],[ref.revenue,ref.cost,ref.commission,ref.profit],'بُعد '+d+': إيراد/تكلفة/عمولة/ربح = السجلات');
}
const ref=run(`anRecordTotals()`);
near(ref.profit,ref.revenue-ref.cost-ref.commission,'الربح = إيراد − تكلفة − عمولة','0.0001'*1||0.0001);
eq(ref.count,6,'6 سجلات (3 مبيعات + 3 أعمال)');
const leg=run(`anLegacyTotals()`);
near(ref.revenue,leg.revenue,'الإيراد = مجموع الدوال القديمة',0.06);
near(ref.profit,leg.profit,'الربح = مجموع الدوال القديمة',0.06);

section('T41 — العملات وتفاصيل الأرقام');
// s2 بالليرة 15,000,000 = 1000$ ، تكلفة 600$
const byC=run(`anProfitBy('client')`);
const c2=byC.rows.find(r=>r.name==='شركة النور');
near(c2.revenue,1000+200+333.33,'إيراد شركة النور: مبيعات 1000$ + عمل 200$ + عمل 333.33',0.01);
ok(byC.rows.some(r=>r.name==='زبون حر'),'عميل حر بصف مستقل');
const byP=run(`anProfitBy('project')`);
ok(byP.rows.some(r=>r.name==='بدون مشروع'),'سجلات بدون مشروع مجمّعة');
near(byP.rows.find(r=>r.name==='مشروع أ').revenue,1000.01+700.01,'إيراد مشروع أ (بيع + عمل)',0.011);

section('T41 — العمولة');
near(ref.commission,run(`toUSDHist(saleReferralCommissionFull(db.sales[0])+maintReferralCommissionFull(db.maintenance[0]),'USD',{})`),'عمولة الوسيط = المحسوبة بالدوال الأصلية',0.011);

section('T41 — توزيع الفنيين (سنتات بدون ضياع)');
const byT=run(`anProfitBy('tech')`);
const names=byT.rows.map(r=>r.name).sort();
ok(names.includes('أحمد')&&names.includes('خالد')&&names.includes('سعيد'),'كل الفنيين ظاهرين',names);
ok(names.includes('مبيعات (بدون فني)')&&names.includes('بدون فني'),'المبيعات والأعمال بدون فني بصفوف مستقلة',names);
const ahmad=byT.rows.find(r=>r.name==='أحمد'),khalid=byT.rows.find(r=>r.name==='خالد');
ok(ahmad.revenue>khalid.revenue,'الفني الأعلى أجراً حصته من إيراد العمل أكبر');
// أجور m1: 70 + 30.01 لازم تكون كلها بتكلفة الفنيين، مع مصروف 40.07 موزّع
near(byT.rows.reduce((a,r)=>a+r.cost,0)-byP.total.cost+byP.total.cost,byT.total.cost,'مجموع تكلفة الفنيين = إجمالي التكلفة',0.0001);

section('T41 — الأقسام');
const byD=run(`anProfitBy('dept')`);
const dn=byD.rows.map(r=>r.name);
ok(dn.length>=3,'أقسام متعددة ظاهرة (أمن/شبكات/غير مصنّف)',dn);
near(byD.rows.reduce((a,r)=>a+r.revenue,0),byD.total.revenue,'مجموع أقسام الإيراد = الإجمالي',0.0001);
near(byD.rows.reduce((a,r)=>a+r.profit,0),byD.total.profit,'مجموع أرباح الأقسام = الإجمالي',0.0001);
near(byD.rows.reduce((a,r)=>a+r.remaining,0),byD.total.remaining,'مجموع متبقي الأقسام = الإجمالي',0.0001);

section('T41 — فلتر التاريخ');
const chkJan=run(`anCheck({from:'2027-01-01',to:'2027-01-31'})`);
ok(chkJan.ok,'الفلتر شهر كانون2: الأبعاد متطابقة',chkJan.issues);
eq(chkJan.ref.count,4,'4 سجلات بكانون2 (2 مبيعات + 2 أعمال)');
eq(run(`anCheck({from:'2030-01-01',to:'2030-02-01'}).ref.count`),0,'فترة فاضية: صفر');
ok(run(`anCheck({from:'2030-01-01',to:'2030-02-01'}).ok`),'فترة فاضية بدون أخطاء');

section('T41 — أعمار الديون');
const ag=run(`anAging('2027-03-15')`);
const sumB=Object.values(ag.buckets).reduce((a,b)=>a+b,0);
near(sumB,ag.total,'مجموع الشرائح = الإجمالي',0.0001);
near(ag.clients.reduce((a,c)=>a+c.total,0),ag.total,'مجموع العملاء = الإجمالي',0.0001);
const expectedTotal=run(`(db.sales.reduce((s,x)=>s+toUSDHist(saleRemaining(x),x.currency,x),0)+db.maintenance.reduce((s,m)=>s+toUSDHist(maintRemaining(m),m.currency,m),0))+200+150`);
near(ag.total,expectedTotal,'الإجمالي = متبقي الفواتير والأعمال + دفعات العقود النشطة (الملغاة مستثناة)',0.03);
// s1: متبقي 600.01 ، تاريخ 10 كانون2 + 30 = 9 شباط → عمره 34 يوم بتاريخ 15 آذار = شريحة 31–60
ok(ag.buckets.d60>=600,'فاتورة 10 كانون2 بتاريخ 15 آذار بشريحة 31–60 (استحقاق 9 شباط)',ag.buckets);
// cp2 استحقاق 1 حزيران = غير مستحق بعد
ok(ag.buckets.current>=150,'دفعة عقد مستقبلية = غير مستحق بعد');
const ag2=run(`anAging('2027-01-10')`);
ok(ag2.buckets.d90p===0,'بتاريخ مبكر ما في ديون قديمة');
eq(run(`anDays('2027-02-28','2027-03-01')`),1,'فرق الأيام عبر نهاية شباط');
eq(run(`anDays('2028-02-28','2028-03-01')`),2,'سنة كبيسة');

section('T41 — التدفق النقدي');
const cf=run(`anCashflow('2027-03-15')`);
near(cf.totalIn,ag.total,'مجموع المقبوضات المتوقعة = إجمالي الديون',0.0001);
near(Object.values(cf.inflow).reduce((a,b)=>a+b,0),cf.totalIn,'شرائح المقبوضات = الإجمالي',0.0001);
near(cf.outflow.supplierDebt,300,'دين المورد 500−200 = 300');
ok(cf.outflow.unpaidWages>=50,'أجور غير مدفوعة (دفعة العامل 50 على الأقل)',cf.outflow);
near(cf.net,cf.totalIn-cf.outflow.totalOut,'الصافي = مقبوضات − مدفوعات',0.011);
ok(cf.inflow.overdue>0&&cf.inflow.later>=0,'في متأخر');

section('T41 — الواجهة');
run(`canViewFinance=()=>true;canViewProfits=()=>true;canViewTotals=()=>true;window._el={};window._ac={};renderAnalytics(_el,_ac)`);
const html=run(`_el.innerHTML`);
ok(/ربحية حسب/.test(html)&&/أعمار الديون/.test(html)&&/التدفق النقدي/.test(html),'الصفحة بتنرسم كاملة');
ok(/مطابقة/.test(html),'مؤشر المطابقة ظاهر');
ok(run(`PAGE_BUNDLE.analytics`)==='analytics'&&run(`PAGE_LIST.some(p=>p.id==='analytics')`),'مسجّلة بالتوجيه');

section('بوابة المرحلة 4 — تكامل (مخزون + عروض + تحليلات)');
run(`db.stockItems=[];db.stockMoves=[];`);
const it=run(`invAddItem({name:'كاميرا اختبار'}).id`);
run(`db.suppliers[0].purchases.push({id:'pp',date:'2027-02-01',currency:'USD',total:300,paid:0,payments:[],items:[{id:'pi',type:'Camera',qty:10,price:300,itemId:'${it}'}]});
 db.sales[0].items[0].itemId='${it}';`);
eq(run(`invBalance('${it}')`),8,'مخزون: شراء 10 − بيع 2 = 8');
run(`invAddMove({itemId:'${it}',type:'consume',qty:1,date:'2027-02-10'});invAddMove({itemId:'${it}',type:'count',qty:6,date:'2027-02-20'})`);
const b=run(`invBreakdown('${it}')`);
ok(b.ok&&b.balance===6,'الرصيد = مشتريات − مبيعات − استهلاك ± جرد',b);
ok(run(`anCheck().ok`),'التحليلات لسا متطابقة بعد ربط المخزون');

console.log('\n'+(fail?'❌':'✅')+' نجح '+pass+' / فشل '+fail);process.exit(fail?1:0);
