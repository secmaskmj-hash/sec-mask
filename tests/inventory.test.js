/* اختبارات المرحلة 4 / الجزء 2: T38 محرك المخزون — الرصيد، متوسط التكلفة، الجرد، ربح الصنف، وبوابة المرحلة.
   التشغيل: node tests/inventory.test.js (جرّبه كمان مع TZ=Asia/Riyadh و TZ=America/Los_Angeles) */
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
['core.js','ops.js','inventory.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f}));
const run=c=>vm.runInContext(c,ctx);
let pass=0,fail=0;
function ok(c,name,extra){if(c){pass++;console.log('  ✓ '+name);}else{fail++;console.log('  ✗ '+name+(extra!==undefined?'  → '+JSON.stringify(extra):''));}}
function eq(a,b,name){ok(JSON.stringify(a)===JSON.stringify(b),name,{got:a,expected:b});}
function near(a,b,name,eps){ok(Math.abs(a-b)<=(eps||0.005),name,{got:a,expected:b});}
function section(t){console.log('\n'+t);}

run(`db.settings=db.settings||{};db.settings.exchangeRate=15000;db.sales=[];db.maintenance=[];db.stockItems=[];db.stockMoves=[];
 db.suppliers=[{id:'sp1',name:'مورد',purchases:[]}];`);
const item=run(`invAddItem({name:'كاميرا 2MP',sku:'C2',minQty:3}).id`);
const addPurchase=(id,date,cur,qty,price)=>run(`db.suppliers[0].purchases.push({id:'${id}',date:'${date}',currency:'${cur}',total:0,paid:0,payments:[],items:[{id:'i${id}',type:'كاميرا',qty:${qty},price:${qty}*${price},itemId:'${item}'}]})`);
const addSale=(id,date,cur,qty,price)=>run(`db.sales.push({id:'${id}',date:'${date}',currency:'${cur}',payments:[],items:[{type:'كاميرا',qty:${qty},salePrice:${price},itemId:'${item}'}]})`);

section('T38 — الرصيد من المشتريات والمبيعات');
addPurchase('p1','2027-01-02','USD',10,20);
eq(run(`invBalance('${item}')`),10,'شراء 10 → الرصيد 10');
addSale('s1','2027-01-10','USD',4,35);
eq(run(`invBalance('${item}')`),6,'بيع 4 → الرصيد 6');
near(run(`invAvgCost('${item}')`),20,'متوسط التكلفة 20$');

section('T38 — متوسط التكلفة المتحرك (شراء بسعر مختلف بعملة تانية)');
addPurchase('p2','2027-01-15','SYP',6,15000*30); // 30$ للوحدة بسعر صرف 15000
near(run(`invAvgCost('${item}')`),(6*20+6*30)/12,'متوسط = (6×20+6×30)/12 = 25$');
eq(run(`invBalance('${item}')`),12,'الرصيد 12');
const prof=run(`invItemProfit('${item}')`);
near(prof.cogs,80,'تكلفة المباع 4×20 = 80 (متوسط وقت البيع، مش الحالي)');
near(prof.revenue,140,'إيراد 4×35');
near(prof.profit,60,'ربح الصنف 60$');
near(prof.margin,42.9,'هامش 42.9%',0.05);

section('T38 — بيع بالليرة بتحويل صحيح');
addSale('s2','2027-01-20','SYP',2,15000*40);
near(run(`invItemProfit('${item}')`).revenue,140+80,'إيراد الليرة محوّل للدولار (2×40)');
eq(run(`invBalance('${item}')`),10,'الرصيد 10');

section('T38 — الاستهلاك والتسوية والجرد');
run(`invAddMove({itemId:'${item}',type:'consume',qty:2,date:'2027-01-25',note:'تركيب داخلي'})`);
eq(run(`invBalance('${item}')`),8,'استهلاك 2 → 8');
run(`invAddMove({itemId:'${item}',type:'adjust',qty:-1,date:'2027-01-26',note:'تالف'})`);
eq(run(`invBalance('${item}')`),7,'تسوية −1 → 7');
run(`invAddMove({itemId:'${item}',type:'count',qty:6,date:'2027-01-31'})`);
eq(run(`invBalance('${item}')`),6,'جرد فعلي 6 → الرصيد يصير 6');
let b=run(`invBreakdown('${item}')`);
eq([b.purchases,b.sales,b.consumption,b.adjust,b.countAdj],[16,6,2,-1,-1],'تفصيل: شراء 16، بيع 6، استهلاك 2، تسوية −1، فرق جرد −1');
ok(b.ok&&b.expected===b.balance,'بوابة المرحلة: الرصيد = مشتريات − مبيعات − استهلاك ± جرد/تسوية',b);
run(`invAddMove({itemId:'${item}',type:'count',qty:9,date:'2027-02-01'})`);
b=run(`invBreakdown('${item}')`);
eq([b.balance,b.countAdj,b.ok],[9,2,true],'جرد بزيادة (+3) بيحفظ الهوية');

section('T38 — ترتيب نفس اليوم وبيع على المكشوف');
const it2=run(`invAddItem({name:'DVR',openQty:0}).id`);
run(`db.sales.push({id:'sx',date:'2027-03-01',currency:'USD',items:[{type:'DVR',qty:2,salePrice:100,itemId:'${it2}'}]})`);
run(`db.suppliers[0].purchases.push({id:'px',date:'2027-03-01',currency:'USD',items:[{id:'ix',qty:5,price:250,itemId:'${it2}'}]})`);
eq(run(`invLedger('${it2}').map(r=>r.kind)`),['purchase','sale'],'الشراء قبل البيع بنفس اليوم');
eq(run(`invBalance('${it2}')`),3,'رصيد 3');
const it3=run(`invAddItem({name:'كبل',openQty:0}).id`);
run(`db.sales.push({id:'sy',date:'2027-03-01',currency:'USD',items:[{qty:2,salePrice:10,itemId:'${it3}'}]})`);
eq(run(`invReport().find(r=>r.id==='${it3}').negative`),true,'رصيد سالب بينعلّم (negative)');

section('T38 — رصيد افتتاحي وأي تاريخ (asOf)');
const it4=run(`invAddItem({name:'شاشة',openQty:5,openCost:100}).id`);
run(`db.suppliers[0].purchases.push({id:'pw',date:'2027-04-10',currency:'USD',items:[{id:'iw',qty:5,price:1000,itemId:'${it4}'}]})`);
eq(run(`invBalance('${it4}','2027-04-05')`),5,'الرصيد بتاريخ 5 نيسان = الافتتاحي');
near(run(`invAvgCost('${it4}')`),150,'متوسط (5×100+5×200)/10');
ok(run(`invBreakdown('${it4}')`).ok,'الهوية بتصح مع الافتتاحي');

section('T38 — حذف فاتورة بيعدّل الرصيد لحاله (ما في قيد مزدوج)');
const before=run(`invBalance('${it2}')`);
run(`db.sales=db.sales.filter(s=>s.id!=='sx')`);
eq(run(`invBalance('${it2}')`),before+2,'حذف فاتورة البيع بيرجّع كميتها للرصيد');
run(`db.suppliers[0].purchases=db.suppliers[0].purchases.filter(p=>p.id!=='px')`);
eq(run(`invBalance('${it2}')`),0,'حذف فاتورة الشراء بينقص الرصيد');

section('T38 — تنبيه النقص والتقييم');
const low=run(`invLowStock().map(i=>i.name)`);
ok(Array.isArray(low),'invLowStock بترجع مصفوفة');
run(`invAddMove({itemId:'${item}',type:'count',qty:2,date:'2027-05-01'})`);
ok(run(`invLowStock().some(i=>i.id==='${item}')`),'الرصيد 2 ≤ الحد الأدنى 3 → تنبيه نقص');
ok(run(`invValuation()`)>0,'قيمة المخزون موجبة');
ok(run(`invReport().every(r=>r.gateOk)`),'بوابة المرحلة بتصح لكل الأصناف');

section('T38 — التحقق من المدخلات');
const thr=c=>{try{run(c);return false;}catch(e){return true;}};
ok(thr(`invAddItem({name:'  '})`),'اسم فاضي مرفوض');
ok(thr(`invAddMove({itemId:'nope',type:'consume',qty:1})`),'صنف غير موجود مرفوض');
ok(thr(`invAddMove({itemId:'${item}',type:'consume',qty:-1})`),'استهلاك سالب مرفوض');
ok(thr(`invAddMove({itemId:'${item}',type:'count',qty:-2})`),'جرد سالب مرفوض');
ok(thr(`invAddMove({itemId:'${item}',type:'xx',qty:1})`),'نوع غريب مرفوض');

console.log('\n'+(fail?'❌':'✅')+' نجح '+pass+' / فشل '+fail);process.exit(fail?1:0);
