/* اختبارات المرحلة 3 / الجزء 4: T46 قسم المبيعات بالبند · T47 الترقيم والطباعة والفلاتر حسب القسم.
   التشغيل:  node tests/sections.test.js   (جرّبه كمان مع TZ=Asia/Riyadh و TZ=America/Los_Angeles) — بيحمّل core.js و ops.js الحقيقيين بدون متصفح. */
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
['core.js','ops.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f}));
const run=c=>vm.runInContext(c,ctx);
let pass=0,fail=0;
function ok(c,name,extra){if(c){pass++;console.log('  ✓ '+name);}else{fail++;console.log('  ✗ '+name+(extra!==undefined?'  → '+JSON.stringify(extra):''));}}
function eq(a,b,name){ok(JSON.stringify(a)===JSON.stringify(b),name,{got:a,expected:b});}
function near(a,b,name,eps){ok(Math.abs(a-b)<=(eps||0.005),name,{got:a,expected:b});}
function section(t){console.log('\n'+t);}
run("db.settings=db.settings||{};db.settings.exchangeRate=15000;db.deviceDepts={};");
const bd=s=>JSON.parse(JSON.stringify(run(`saleSectionBreakdown(${JSON.stringify(s)})`)));
const mkSale=(items,discount,extra)=>{const raw=items.reduce((a,i)=>a+i.salePrice*i.qty,0);const cost=items.reduce((a,i)=>a+i.costPrice*i.qty,0);return Object.assign({id:'s1',clientId:'c1',currency:'USD',items,discount,totalPrice:Math.round(raw*(1-discount/100)*100)/100,totalCost:cost,paidAmount:0,payments:[]},extra||{});};
const EX=[{type:'IPC',qty:4,salePrice:90,costPrice:70},{type:'Switch',qty:1,salePrice:120,costPrice:95},{type:'Cat6',qty:1,salePrice:60,costPrice:40}];

section('T46 — القسم الافتراضي من نوع الجهاز');
eq(run("deviceTypeDept('IPC')"),'security','IPC = سيكيورتي');
eq(run("deviceTypeDept('Switch')"),'network','Switch = نتورك');
eq(run("deviceTypeDept('Battery')"),'','Battery (مشترك) = بلا افتراضي');
eq(run("deviceTypeDept('نوع جديد')"),'','نوع غير معروف = بلا افتراضي');
eq(run("itemDept({type:'Battery'})"),'unclassified','مشترك بدون اختيار = غير مصنّف');
eq(run("itemDept({type:'Battery',department:'network'})"),'network','مشترك + اختيار يدوي = القسم المختار');
eq(run("itemDept({type:'IPC',department:'network'})"),'network','تعديل يدوي لبند بيفوز على الافتراضي');
eq(run("itemDept({type:'IPC',department:'خطأ'})"),'security','قيمة قسم غير صالحة بتتجاهل');
run("db.deviceDepts={Battery:'security',IPC:'network'}");
eq(run("deviceTypeDept('Battery')"),'security','تعديل الإعدادات بيفوز (مشترك ← سيكيورتي)');
eq(run("deviceTypeDept('IPC')"),'network','تعديل الإعدادات بيفوز على المقترح');
run("db.deviceDepts={}");
eq(run("itemDept({kind:'عمل',desc:'تركيب'})"),'unclassified','بند عمل بعرض السعر = غير مصنّف');
eq(run("itemDept({kind:'مادة',desc:'Camera'})"),'security','بند مادة بعرض السعر من نوعه');

section('T46 — مثال الخطة: فاتورة واحدة مقسومة (خصم 10%)');
let r=bd(mkSale(EX,10)),S=r.sections.security,N=r.sections.network;
near(S.gross,360,'سيكيورتي: المبيع 360');near(S.discount,36,'سيكيورتي: حصة الخصم 36');near(S.net,324,'سيكيورتي: الصافي 324');near(S.cost,280,'سيكيورتي: التكلفة 280');near(S.profit,44,'سيكيورتي: الربح 44');near(S.margin,13.58,'سيكيورتي: الهامش ≈13.6%',0.05);
near(N.gross,180,'نتورك: المبيع 180');near(N.discount,18,'نتورك: حصة الخصم 18');near(N.net,162,'نتورك: الصافي 162');near(N.cost,135,'نتورك: التكلفة 135');near(N.profit,27,'نتورك: الربح 27');near(N.margin,16.67,'نتورك: الهامش ≈16.7%',0.05);
near(r.total.net,486,'المجموع: 486');near(r.total.discount,54,'المجموع: الخصم 54');near(r.total.cost,415,'المجموع: التكلفة 415');near(r.total.profit,71,'المجموع: الربح 71');near(r.total.margin,14.6,'المجموع: الهامش 14.6%',0.05);
near(S.net+N.net,486,'التحقق: 324 + 162 = 486');near(S.profit+N.profit,71,'التحقق: 44 + 27 = 71');near(540-54-415,71,'التحقق: 540 − 54 − 415 = 71');
eq(run(`saleDeptTag(${JSON.stringify(mkSale(EX,10))})`),'mixed','وسم الفاتورة المختلطة');

section('T46 — القاعدة: مجموع الأقسام = إجمالي الفاتورة بفرق أقل من $0.01 (حالات متنوّعة)');
const cases=[
 mkSale([{type:'Camera',qty:3,salePrice:33.33,costPrice:20.1},{type:'Router',qty:7,salePrice:12.49,costPrice:8.8},{type:'Battery',qty:2,salePrice:5.55,costPrice:3.1}],7.5),
 mkSale([{type:'Camera',qty:1,salePrice:0.01,costPrice:0},{type:'Switch',qty:1,salePrice:0.01,costPrice:0},{type:'Cat6',qty:1,salePrice:0.01,costPrice:0}],33.33),
 mkSale([{type:'IPC',qty:3,salePrice:100,costPrice:60},{type:'Cat6',qty:3,salePrice:100,costPrice:60},{type:'Battery',qty:3,salePrice:100,costPrice:60}],10),
 mkSale([{type:'IPC',qty:1,salePrice:1000000,costPrice:700000},{type:'Router',qty:2,salePrice:350000.5,costPrice:200000}],12.5,{currency:'SYP'}),
 mkSale([{type:'Camera',qty:5,salePrice:19.99,costPrice:11},{type:'Camera',department:'network',qty:2,salePrice:19.99,costPrice:11}],100),
 mkSale([{type:'Camera',qty:5,salePrice:19.99,costPrice:11},{type:'Router',qty:2,salePrice:49.99,costPrice:11}],0),
];
cases.forEach((s,i)=>{const b=bd(s);const sumNet=Object.values(b.sections).reduce((a,x)=>a+x.net,0);const sumDisc=Object.values(b.sections).reduce((a,x)=>a+x.discount,0);const sumCost=Object.values(b.sections).reduce((a,x)=>a+x.cost,0);
 ok(Math.abs(sumNet-s.totalPrice)<0.01,`حالة ${i+1}: مجموع صافي الأقسام = إجمالي الفاتورة`,{sumNet,total:s.totalPrice});
 ok(Math.abs(sumDisc-b.total.discount)<1e-9,`حالة ${i+1}: مجموع حصص الخصم = الخصم الكلي`,{sumDisc,d:b.total.discount});
 ok(Math.abs(sumCost-s.totalCost)<0.01,`حالة ${i+1}: مجموع تكلفة الأقسام = تكلفة الفاتورة`,{sumCost,c:s.totalCost});
 ok(Object.values(b.sections).every(x=>x.net>=0&&x.discount>=0),`حالة ${i+1}: ما في قيم سالبة`);
});

section('T46 — فاتورة بقسم واحد = نفس أرقام اليوم تماماً');
const one=mkSale([{type:'IPC',qty:2,salePrice:150,costPrice:90},{type:'NVR',qty:1,salePrice:400,costPrice:300}],5);
const b1=bd(one);
eq(b1.activeKeys,['security'],'قسم واحد فعّال');
near(b1.sections.security.net,one.totalPrice,'صافي القسم = إجمالي الفاتورة');
near(b1.sections.security.cost,one.totalCost,'تكلفة القسم = تكلفة الفاتورة');
eq(run(`saleDeptTag(${JSON.stringify(one)})`),'security','وسم قسم واحد');
const sl=JSON.parse(JSON.stringify(run(`saleSectionSlice(${JSON.stringify(one)},'security')`)));
near(sl.totalPrice,one.totalPrice,'الشريحة: السعر نفسه');near(sl.totalCost,one.totalCost,'الشريحة: التكلفة نفسها');
eq(sl.items.length,2,'الشريحة: نفس البنود');
eq(run(`saleSectionSlice(${JSON.stringify(one)},'network')`),null,'قسم فاضي = ما في شريحة');

section('T46 — فواتير قديمة بدون قسم بتنحسب حسب نوع الجهاز، والمجهول "غير مصنّف"');
const old=mkSale([{type:'Camera',qty:1,salePrice:100,costPrice:60},{type:'شي مجهول',qty:1,salePrice:50,costPrice:30}],0);
const bo=bd(old);
near(bo.sections.security.net,100,'Camera ← سيكيورتي');near(bo.sections.unclassified.net,50,'نوع مجهول ← غير مصنّف');
eq(run(`saleDeptTag(${JSON.stringify(old)})`),'mixed','سيكيورتي + غير مصنّف = مختلطة');
eq(run("saleDeptTag({items:[]})"),'unclassified','فاتورة بلا بنود = غير مصنّفة');

section('T46 — شريحة القسم: الدفعات والمتبقي والربح المعترف بتتوزع بالنسبة');
const mixed=mkSale(EX,10,{paidAmount:243,payments:[{id:'p1',amount:243,convertedAmount:243,currency:'USD',discountConverted:0}]});
const sS=run(`saleSectionSlice(${JSON.stringify(mixed)},'security')`),sN=run(`saleSectionSlice(${JSON.stringify(mixed)},'network')`);
const remS=run(`saleRemaining(${JSON.stringify(JSON.parse(JSON.stringify(sS)))})`),remN=run(`saleRemaining(${JSON.stringify(JSON.parse(JSON.stringify(sN)))})`);
near(remS+remN,run(`saleRemaining(${JSON.stringify(mixed)})`),'متبقي القسمين = متبقي الفاتورة',0.011);
near(sS.paidAmount+sN.paidAmount,243,'مدفوع القسمين = مدفوع الفاتورة',0.011);
const profS=run(`saleRecognizedProfit(${JSON.stringify(JSON.parse(JSON.stringify(sS)))})`),profN=run(`saleRecognizedProfit(${JSON.stringify(JSON.parse(JSON.stringify(sN)))})`);
near(profS+profN,run(`saleRecognizedProfit(${JSON.stringify(mixed)})`),'الربح المعترف للقسمين = ربح الفاتورة',0.011);
// دفعة بخصم بدون discAmount مخزّن (الاحتياطي من الدفعات)
const withDisc=mkSale(EX,0,{paidAmount:400,payments:[{id:'p',amount:400,convertedAmount:400,currency:'USD',discountConverted:20}]});
const dS=JSON.parse(JSON.stringify(run(`saleSectionSlice(${JSON.stringify(withDisc)},'security')`))),dN=JSON.parse(JSON.stringify(run(`saleSectionSlice(${JSON.stringify(withDisc)},'network')`)));
near(run(`genDiscountTotal(${JSON.stringify(dS)})`)+run(`genDiscountTotal(${JSON.stringify(dN)})`),20,'خصم التحصيل بيتوزع (مجموعه 20)',0.011);

section('T46 — توزيع "أكبر باقي" بالسنت');
eq(run("_deptAllocate(100,[1,1,1])"),[34,33,33],'100 سنت على 3 = 34+33+33');
eq(run("_deptAllocate(0,[5,5])"),[0,0],'صفر خصم');
eq(run("_deptAllocate(7,[0,0])"),[7,0],'أوزان صفرية: الكل للأول');
ok(run("_deptAllocate(1001,[3,5,7]).reduce((a,b)=>a+b,0)")===1001,'المجموع دايماً = المبلغ');

section('T47 — الفلاتر حسب القسم (شرائح)');
run(`db.sales=${JSON.stringify([mixed,Object.assign({},one,{id:'s2'}),Object.assign({},old,{id:'s3'})])}`);
eq(run("salesForDept('all').length"),3,'الكل = 3 فواتير');
eq(run("salesForDept('security').length"),3,'سيكيورتي: كل الفواتير فيها بند سيكيورتي');
eq(run("salesForDept('network').length"),1,'نتورك: فاتورة وحدة بس');
eq(run("salesForDept('security').map(s=>s.id)"),['s1','s2','s3'],'نفس الـ id للأزرار');
near(run("salesForDept('network')[0].totalPrice"),162,'نتورك: صافي الشريحة 162');
near(run("salesForDept('security').filter(s=>s.id==='s1')[0].totalPrice"),324,'سيكيورتي: صافي شريحة الفاتورة المختلطة 324');
near(run("salesForDept('security').concat(salesForDept('network')).filter(s=>s.id==='s1').reduce((a,s)=>a+s.totalPrice,0)"),486,'مجموع شرائح الفاتورة = إجماليها');
ok(run("db.sales[0].totalPrice")===486,'الفاتورة الأصلية ما تغيّرت');
eq(run("db.sales[0].items.length"),3,'بنود الفاتورة الأصلية ما تغيّرت');

section('T47 — جدول التوزيع للطباعة/الشاشة');
const html=run(`deptBreakdownTableHTML(saleSectionBreakdown(${JSON.stringify(mixed)}),'$',false)`);
ok(html.includes('سيستم سيكيورتي')&&html.includes('سيستم نتورك')&&html.includes('324')&&html.includes('162'),'الجدول فيه القسمين وصافيهم');
ok(!html.includes('التكلفة')&&!html.includes('الهامش'),'نسخة الطباعة بدون تكلفة/ربح');
const htmlF=run(`deptBreakdownTableHTML(saleSectionBreakdown(${JSON.stringify(mixed)}),'$',true)`);
ok(htmlF.includes('التكلفة')&&htmlF.includes('الهامش')&&htmlF.includes('13.6%'),'نسخة المخوّلين فيها التكلفة والهامش');
eq(run("deptBreakdownTableHTML(saleSectionBreakdown({items:[]}),'',false)"),'','بدون بنود = ما في جدول');
ok(run("deptTabsHTML('network','x()')").includes("var d='network'"),'تبويبات القسم');

section('عروض الأسعار — نفس التقسيم');
const q={id:'q1',discount:10,items:[{kind:'مادة',desc:'IPC',qty:4,price:90,cost:70},{kind:'مادة',desc:'Switch',qty:1,price:120,cost:95},{kind:'عمل',desc:'تركيب',qty:1,price:60,cost:40}],totalValue:486};
const qb=JSON.parse(JSON.stringify(run(`quoteSectionBreakdown(${JSON.stringify(q)})`)));
near(qb.sections.security.net,324,'عرض: سيكيورتي 324');near(qb.sections.network.net,108,'عرض: نتورك (Switch 120 − 12) = 108');near(qb.sections.unclassified.net,54,'عرض: العمل (تركيب) غير مصنّف 54');
near(qb.sections.security.net+qb.sections.network.net+qb.sections.unclassified.net,486,'عرض: مجموع الأقسام = قيمة العرض');
const q2=Object.assign({},q,{items:q.items.map((i,k)=>k===2?Object.assign({},i,{department:'network'}):i)});
near(JSON.parse(JSON.stringify(run(`quoteSectionBreakdown(${JSON.stringify(q2)})`))).sections.network.net,162,'عرض: العمل صُنّف يدوياً ← نتورك 162');
// بند عرض بديل مختار
const q3={id:'q3',discount:0,items:[{kind:'مادة',desc:'Camera',qty:1,price:100,cost:50,selectedIdx:1,alts:[{desc:'Router',qty:2,price:30,cost:10}]}],totalValue:60};
eq(run(`quoteDeptTag(${JSON.stringify(q3)})`),'security','وسم العرض حسب نوع البند الأساسي');
run(`db.quotes=${JSON.stringify([q])}`);
eq(run("quotesForDept('network').length"),1,'فلتر العروض: نتورك');
near(run("quotesForDept('network')[0].totalValue"),108,'فلتر العروض: قيمة شريحة نتورك');


section('T47 — واجهة المبيعات والعروض والطباعة والداشبورد (بيرسم HTML فعلي)');
// فاتورة مختلطة بخصم 10% + فاتورة سيكيورتي فقط + فاتورة مجهولة
run(`db.company={name:'شركة القناع'};db.clients=[{id:'c1',name:'بنك الشام',phone:'0933',address:'دمشق',branches:[]}];db.payments=[];db.maintenance=[];db.workers=[];db.workerPayments=[];db.suppliers=[];db.cars=[];db.projects=[];db.generalExpenses=[];db.tools=[];db.loans=[];
 db.sales=${JSON.stringify([Object.assign({},mixed,{invoiceNo:'SL-0001',date:'2027-03-10',projectName:''}),Object.assign({},one,{id:'s2',invoiceNo:'SL-0002',date:'2027-03-11',projectName:''}),Object.assign({},old,{id:'s3',invoiceNo:'SL-0003',date:'2027-03-12',projectName:''})])};db.quotes=[];`);
const inv=run("buildSaleInvoiceHTML('s1',true)");
ok(inv.includes('توزيع الفاتورة على الأقسام')&&inv.includes('سيستم سيكيورتي')&&inv.includes('سيستم نتورك'),'طباعة الفاتورة المختلطة بالأسعار: جدول التوزيع موجود');
ok(inv.includes('مختلطة (سيكيورتي + نتورك)'),'طباعة المختلطة: وسم القسم بالترويسة');
ok(inv.includes('324')&&inv.includes('162')&&inv.includes('486'),'طباعة المختلطة: 324 + 162 = 486 ظاهرين');
ok(!inv.includes('الهامش')&&!inv.includes('التكلفة</th>'),'طباعة العميل: بدون تكلفة/ربح/هامش بجدول التوزيع');
const invNo=run("buildSaleInvoiceHTML('s1',false)");
ok(!invNo.includes('توزيع الفاتورة على الأقسام'),'نسخة بدون أسعار: ما في جدول توزيع');
const inv1=run("buildSaleInvoiceHTML('s2',true)");
ok(!inv1.includes('توزيع الفاتورة على الأقسام')&&inv1.includes('سيستم سيكيورتي'),'فاتورة قسم واحد: بدون جدول توزيع، مع وسم القسم');
const invUSD=run("buildSaleInvoiceHTML('s1',true,'SYP')");
const f7=run("fmt(7290000)"),f4=run("fmt(4860000)");
ok(invUSD.includes('توزيع الفاتورة على الأقسام')&&invUSD.includes(f7),'طباعة بعملة عرض مختلفة: جدول التوزيع بيتحوّل (486$ ← '+f7+' ل.س بسعر 15000)',{f7});
ok(invUSD.includes(run("fmt(4860000)")),'بعملة العرض: صافي سيكيورتي 324$ = 4,860,000 ل.س');
// صفحات المبيعات والعروض (الرسم الفعلي)
const mkEl=()=>({innerHTML:''});
ctx.window._sDept='all';ctx.window._sQ='';ctx.window._sC='';ctx.window._sB='';ctx.window._sP='all';
function render(fnCall,dept){ctx.__el=mkEl();ctx.__acts=mkEl();ctx.window._sDept=dept;ctx.window._qDept=dept;run(`(function(){var el=__el,acts=__acts;${fnCall}})()`);return ctx.__el.innerHTML;}
let hAll=render("renderSales(el,acts)",'all'),hSec=render("renderSales(el,acts)",'security'),hNet=render("renderSales(el,acts)",'network');
ok(hAll.includes('سيستم سيكيورتي')&&hAll.includes('سيستم نتورك')&&hAll.includes('الكل'),'صفحة المبيعات: تبويبات الأقسام ظاهرة');
ok((hAll.match(/class="row-menu-wrap"/g)||[]).length===3,'الكل: 3 فواتير');
ok((hSec.match(/class="row-menu-wrap"/g)||[]).length===3,'سيكيورتي: 3 فواتير (كلها فيها بنود سيكيورتي)');
ok((hNet.match(/class="row-menu-wrap"/g)||[]).length===1,'نتورك: فاتورة وحدة');
ok(hNet.includes('عرض أرقام')&&hNet.includes('162'),'نتورك: ملاحظة الشرائح + صافي 162');
ok(hAll.includes("openSalePaymentModal('s1')")&&hNet.includes("openSalePaymentModal('s1')"),'أزرار الصف بتشتغل على الفاتورة الأصلية (نفس id) بالشريحة كمان');
ok(hAll.includes('مختلطة'),'وسم "مختلطة" بقائمة المبيعات');
run(`db.quotes=${JSON.stringify([Object.assign({},q,{invoiceNo:'QT-0001',date:'2027-03-10',status:'معلق',clientId:'c1',currency:'USD',projectName:''})])}`);
let qAll=render("renderQuotes(el,acts)",'all'),qNet=render("renderQuotes(el,acts)",'network');
ok(qAll.includes('سيستم نتورك')&&(qAll.match(/class="row-menu-wrap"/g)||[]).length===1,'صفحة العروض: تبويبات + عرض واحد');
ok(qNet.includes('108')&&qNet.includes('عرض قيمة'),'العروض/نتورك: قيمة الشريحة 108');
// الداشبورد: البطاقة
const dc=run("renderDashDeptCard(db.sales)");
ok(dc.includes('المبيعات حسب القسم')&&dc.includes('غير مصنّف'),'بطاقة الداشبورد موجودة وفيها "غير مصنّف"');
const rowsD=JSON.parse(JSON.stringify(run("dashDeptRows(db.sales)")));
const totNetD=Object.values(rowsD).reduce((a,x)=>a+x.net,0);
const totalSalesUSD=run("db.sales.reduce((s,x)=>s+toUSDHist(x.totalPrice,x.currency,x),0)");
near(totNetD,totalSalesUSD,'الداشبورد: مجموع صافي الأقسام = إجمالي المبيعات',0.011);
eq(run("renderDashDeptCard([])"),'','بطاقة فاضية بدون مبيعات');
// الإعدادات
ctx.window._stab='deviceTypes';

console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
