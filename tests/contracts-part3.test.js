/* اختبارات المرحلة 3 / الجزء 3: T33 الأجهزة والضمان · T34 الفوترة الدورية وربحية العقد وتنبيه التجديد · T35 التقويم وحمل الفنيين وواتساب.
   التشغيل:  node tests/contracts-part3.test.js   (جرّبه كمان مع TZ=Asia/Riyadh و TZ=America/Los_Angeles) — بيحمّل core.js و ops.js الحقيقيين بدون متصفح. */
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


const TODAY='2027-03-15';
const reset=()=>run(`db.settings.exchangeRate=15000;db.maintenance=[];db.contracts=[];db.devices=[];db.company={name:'شركة القناع'};
 db.workers=[{id:'w1',name:'فني أحمد'},{id:'w2',name:'فني زياد'}];
 db.clients=[{id:'c1',name:'بنك الشام',phone:'0933123456',address:'دمشق',branches:['فرع المزة'],branchDetails:[{id:'b1',name:'فرع المزة',address:'المزة',contactName:'',contactPhone:'',mapUrl:''}]}];`);
reset();
const mkC=(over)=>run(`(function(){const c=Object.assign({id:uid(),number:contractNextNumber(db),clientId:'c1',branchId:'b1',startDate:'2027-01-01',anchorDay:0,durationMonths:12,intervalMonths:3,value:1200,currency:'USD',department:'',status:'active',nextVisitDate:'',payments:[],notes:''},${JSON.stringify(over||{})});db.contracts.push(c);return c.id;})()`);

section('T33 — الأجهزة والضمان');
eq(run("deviceWarrantyEnd({installDate:'2027-01-31',warrantyMonths:1})"),'2027-02-27','31 كانون2 + شهر − يوم = 27 شباط');
eq(run("deviceWarrantyEnd({installDate:'2027-03-15',warrantyMonths:12})"),'2028-03-14','سنة ضمان = يوم قبل الذكرى');
eq(run("deviceWarrantyEnd({installDate:'2028-02-29',warrantyMonths:12})"),'2029-02-27','تركيب 29 شباط (كبيسة) + سنة');
eq(run("deviceWarrantyEnd({installDate:'2027-03-15',warrantyMonths:12,warrantyEnd:'2027-06-30'})"),'2027-06-30','نهاية الضمان اليدوية بتفوز');
eq(run("deviceWarrantyEnd({installDate:'',warrantyMonths:12})"),'','بدون تاريخ تركيب = بدون نهاية');
eq(run(`deviceWarrantyStatus({warrantyEnd:'${TODAY}'},'${TODAY}')`),{state:'expiring',end:TODAY,days:0},'ينتهي اليوم = لسا ساري (0 يوم) — مو منتهي');
eq(run(`deviceWarrantyStatus({warrantyEnd:'2027-03-14'},'${TODAY}')`).state,'expired','أمس = منتهي');
eq(run(`deviceWarrantyStatus({warrantyEnd:'2027-04-14'},'${TODAY}')`).state,'expiring','بعد 30 يوم = قارب ينتهي');
eq(run(`deviceWarrantyStatus({warrantyEnd:'2027-04-15'},'${TODAY}')`).state,'active','بعد 31 يوم = ساري');
eq(run(`deviceWarrantyStatus({},'${TODAY}')`).state,'none','بدون ضمان');
run(`db.devices=[newDevice({clientId:'c1',branchId:'b1',type:'كاميرا',installDate:'2026-03-20',warrantyMonths:12}),newDevice({clientId:'c1',branchId:'b1',type:'DVR',warrantyEnd:'2027-03-01'}),newDevice({clientId:'c1',type:'سويتش',installDate:'2027-01-01',warrantyMonths:24}),newDevice({clientId:'c1',type:'راوتر'})]`);
eq(run(`devicesWarrantyAlerts(db,'${TODAY}').map(x=>x.device.type)`),['DVR','كاميرا'],'تنبيهات الضمان: المنتهي أول ثم الأقرب، الساري والبدون ضمان مستبعدين');
eq(run("devicesOfBranch(db,'c1','b1').length"),2,'أجهزة الفرع');
eq(run("devicesOfBranch(db,'c1','').length"),4,'كل أجهزة العميل');
const nd=run("newDevice({clientId:'c1',installDate:'غلط',warrantyEnd:'2027-13-45',warrantyMonths:'-5',type:'  IPC  '})");
ok(nd.installDate===''&&nd.warrantyMonths===0&&nd.type==='IPC'&&nd.warrantyEnd==='','newDevice بينظّف الحقول (تاريخ غلط/أشهر سالبة/فراغات)',nd);
// دمج العملاء بيحوّل الأجهزة
run(`db.clients.push({id:'c2',name:'بنك الشام ',phone:'0933123456',address:'',branches:['فرع المزة'],branchDetails:[{id:'b2',name:'فرع المزة',address:'',contactName:'',contactPhone:'',mapUrl:''}]});db.devices.push(newDevice({clientId:'c2',branchId:'b2',type:'جهاز مكرر'}));`);
run("mergeClientsIn(db,'c1',['c2'])");
const moved=run("db.devices.find(d=>d.type==='جهاز مكرر')");
ok(moved.clientId==='c1'&&moved.branchId==='b1','دمج العميل المكرر بينقل أجهزته لنفس الفرع',moved);
ok(run("clientLinkCount('c1')")>=5,'حذف العميل بيحسب الأجهزة والعقود',run("clientLinkCount('c1')"));
ok(run("validateImportedDB({devices:{},clients:[],workers:[]})")!==null&&run("validateImportedDB({devices:[{id:'a'}],clients:[],workers:[]})")===null,'الاستيراد بيتحقق من الأجهزة');

section('T34 — الفوترة الدورية (ضغطتين = فاتورة وحدة)');
reset();
let cid=mkC({payments:[]});
run(`(function(){const c=ctFind('${cid}');c.payments=[newContractPayment(c,'2027-01-01',200),newContractPayment(c,'2027-03-01',200),newContractPayment(c,'2027-06-01',300),newContractPayment(c,'2027-09-01',500)];})()`);
const pids=run(`ctFind('${cid}').payments.map(p=>p.id)`);
const r1=run(`contractBillPayment(db,ctFind('${cid}'),ctFind('${cid}').payments[0],'${TODAY}')`);
const r2=run(`contractBillPayment(db,ctFind('${cid}'),ctFind('${cid}').payments[0],'${TODAY}')`);
ok(r1.ok&&!r1.existing&&r1.invoiceNo==='CTI-0001','الضغطة الأولى بتنشئ CTI-0001',r1);
ok(r2.ok&&r2.existing&&r2.invoiceNo==='CTI-0001','الضغطة التانية بترجّع نفس الفاتورة (ما بتنشئ جديدة)',r2);
eq(run(`contractNextInvoiceNo(db)`),'CTI-0002','الرقم التالي CTI-0002 (ما انحرق رقم بالضغطة التانية)');
const cid2=mkC({payments:[]});
run(`(function(){const c=ctFind('${cid2}');c.payments=[newContractPayment(c,'2027-01-01',100)];})()`);
eq(run(`contractBillPayment(db,ctFind('${cid2}'),ctFind('${cid2}').payments[0],'${TODAY}').invoiceNo`),'CTI-0002','الترقيم متسلسل عبر العقود');
eq(run(`contractPaymentsToBill(ctFind('${cid}'),'${TODAY}').map(p=>p.dueDate)`),['2027-03-01'],'المستحق وغير المفوتر: 1 آذار بس (حزيران/أيلول لسا، كانون2 انفوترت)');
const bd=run(`contractBillDue(db,ctFind('${cid}'),'${TODAY}')`);
ok(bd.ok&&bd.count===1,'فوترة المستحق = فاتورة وحدة',bd);
eq(run(`contractBillDue(db,ctFind('${cid}'),'${TODAY}').count`),0,'فوترة المستحق مرتين = ما في جديد');
eq(run(`(function(){const c=ctFind('${cid}');const p=newContractPayment(c,'2027-01-01',0);return contractBillPayment(db,c,p,'${TODAY}').ok;})()`),false,'دفعة بمبلغ صفر ما بتنفوتر');
eq(run(`(function(){const c=ctFind('${cid}');c.status='cancelled';const p=newContractPayment(c,'2027-01-01',50);const r=contractBillPayment(db,c,p,'${TODAY}').ok;c.status='active';return r;})()`),false,'عقد ملغي ما بيتفوتر');

section('T34 — ربحية العقد (مثال الخطة: 1,200$ ، دفعات 200+200+300+500 ، تكلفة 85+80+65+70)');
reset();
cid=mkC({payments:[],value:1200});
run(`(function(){const c=ctFind('${cid}');c.payments=[newContractPayment(c,'2027-01-01',500),newContractPayment(c,'2027-04-01',300),newContractPayment(c,'2027-07-01',200),newContractPayment(c,'2027-10-01',200)];
 [70,65,80,85].forEach((cost,i)=>{c.visits=c.visits||[];c.visits.push({id:'v'+i,n:i+1,slotDate:'2027-0'+(i*3+1)+'-01',date:'2027-0'+(i*3+1)+'-01',status:i===0?'done':'scheduled',maintenanceId:'m'+i,expenses:[],wage:0});
  db.maintenance.push({id:'m'+i,currency:'USD',workers:[{wage:cost-10,currency:'USD'}],expenses:[{amount:10,currency:'USD'}],cars:[]});});})()`);
let P=run(`contractProfit(ctFind('${cid}'),'${TODAY}')`);
eq(P.revenueUSD,0,'بدون تحصيل: الإيراد المعترف 0');
eq(P.costUSD,70,'تكلفة الزيارة المنجزة الأولى = 70');
eq(P.fullProfitUSD,1130,'قبل إنجاز باقي الزيارات: الربح لو انجمعت القيمة كلها = 1200 − 70');
run(`(function(){const c=ctFind('${cid}');contractRegisterPayment(c.payments[0],500,'2027-01-02',15000);})()`);
P=run(`contractProfit(ctFind('${cid}'),'${TODAY}')`);
eq(P.profitUSD,430,'بعد أول دفعة (500) وزيارة وحدة (70) = 430 (متل الخطة)');
eq(P.collectedPct,42,'نسبة التحصيل 500/1200 = 42%');
run(`(function(){const c=ctFind('${cid}');[1,2,3].forEach(i=>{c.visits[i].status='done';});c.payments.forEach(p=>{p.paidAmount=p.amount;p.rate=15000;});})()`);
P=run(`contractProfit(ctFind('${cid}'),'${TODAY}')`);
eq(P.costUSD,300,'تكلفة الزيارات الأربع = 300');
eq(P.profitUSD,900,'بعد التحصيل الكامل: 1200 − 300 = 900');
eq(P.marginPct,75,'هامش 75%');
run(`ctFind('${cid}').commissionPercent=10`);
P=run(`contractProfit(ctFind('${cid}'),'${TODAY}')`);
eq(P.commissionUSD,120,'عمولة 10% من المحصّل');
eq(P.profitUSD,780,'الربح بعد العمولة = 900 − 120');
// عقد بالليرة: التكلفة والإيراد بالدولار حسب سعر الصرف
reset();
cid=mkC({value:15000000,currency:'SYP',payments:[]});
run(`(function(){const c=ctFind('${cid}');c.payments=[newContractPayment(c,'2027-01-01',15000000)];contractRegisterPayment(c.payments[0],15000000,'2027-01-02',15000);
 c.visits=[{id:'v1',n:1,status:'done',maintenanceId:'m1',slotDate:'2027-01-01',date:'2027-01-01',expenses:[]}];db.maintenance.push({id:'m1',currency:'SYP',workers:[{wage:3000000,currency:'SYP'}],expenses:[],cars:[]});})()`);
P=run(`contractProfit(ctFind('${cid}'),'${TODAY}')`);
eq([P.revenueUSD,P.costUSD,P.profitUSD],[1000,200,800],'عقد بالليرة: 15,000,000 ل.س = 1000$ ، تكلفة 200$ ، ربح 800$');
// زيارة منجزة بدون بطاقة عمل محفوظة: بتنحسب من بيانات الزيارة
run(`(function(){const c=ctFind('${cid}');c.visits=[{id:'v9',n:1,status:'done',maintenanceId:'',performedBy:'w1',performedByName:'فني أحمد',wage:50,wageCurrency:'USD',expenses:[{amount:10,currency:'USD'}],doneDate:'2027-01-02',slotDate:'2027-01-01',date:'2027-01-01'}];})()`);
eq(run(`contractProfit(ctFind('${cid}'),'${TODAY}').costUSD`),60,'زيارة منجزة بدون بطاقة: الأجرة + المصاريف من بيانات الزيارة');

section('T34 — تنبيه التجديد 60 / 30 / 7 + التجديد');
const stageOf=(daysLeft)=>{reset();const c=mkC({startDate:'2027-01-01',durationMonths:12});// ينتهي 2027-12-31
  const t=run(`addDaysISO('2027-12-31',${-daysLeft})`);return run(`contractRenewalInfo(ctFind('${c}'),'${t}')`);};
eq(stageOf(61),null,'61 يوم: لا تنبيه');
eq(stageOf(60).stage,60,'60 يوم: مرحلة 60');
eq(stageOf(31).stage,60,'31 يوم: مرحلة 60');
eq(stageOf(30).stage,30,'30 يوم: مرحلة 30');
eq(stageOf(8).stage,30,'8 أيام: مرحلة 30');
eq(stageOf(7).stage,7,'7 أيام: مرحلة 7');
eq(stageOf(0).stage,7,'آخر يوم: مرحلة 7 (بدون "منتهي")');
eq(stageOf(-1).stage,'expired','بعد يوم: منتهي');
reset();
cid=mkC({startDate:'2027-01-31',durationMonths:12,intervalMonths:1,payments:[]});
eq(run(`contractRenewalInfo(ctFind('${cid}'),'2028-01-25').end`),'2028-01-30','عقد بدأ بآخر الشهر: ينتهي 30 كانون2');
const rn=run(`contractRenew(db,ctFind('${cid}'))`);
ok(rn.ok&&!rn.existing&&rn.contract.startDate==='2028-01-31'&&rn.contract.renewedFromId===cid,'التجديد بيبدأ اليوم التالي للنهاية (31 كانون2 2028)',rn.contract&&rn.contract.startDate);
eq(run(`ctFind('${cid}').renewedToId===db.contracts[db.contracts.length-1].id`),true,'العقد القديم بيشير للجديد');
const rn2=run(`contractRenew(db,ctFind('${cid}'))`);
ok(rn2.ok&&rn2.existing&&run("db.contracts.length")===2,'تجديد مرتين = عقد جديد وحد',run("db.contracts.length"));
eq(run(`contractRenewalAlerts(db,'2028-01-25').length`),0,'العقد المجدَّد ما بيظهر بالتنبيهات تاني');
// تجديد بسنة كبيسة: مرساة اليوم 29
reset();
cid=mkC({startDate:'2028-02-29',anchorDay:29,durationMonths:12,intervalMonths:3});
const lp=run(`contractRenew(db,ctFind('${cid}'))`);
ok(lp.ok&&lp.contract.startDate==='2029-02-28'&&lp.contract.anchorDay===29,'تجديد عقد بدأ 29 شباط: النهاية 27 شباط 2029 والتجديد 28 شباط + مرساة 29',lp.contract&&[lp.contract.startDate,lp.contract.anchorDay]);
eq(run(`[1,2].map(n=>contractVisitDate(db.contracts[1],n))`),['2029-05-29','2029-08-29'],'زيارات التجديد بتحافظ على يوم 29');
reset();cid=mkC({durationMonths:0});
eq(run(`contractRenew(db,ctFind('${cid}')).ok`),false,'عقد مدته مفتوحة ما بيتجدد');
eq(run(`contractRenewalInfo(ctFind('${cid}'),'${TODAY}')`),null,'مدة مفتوحة: لا تنبيه');

section('T35 — تقويم الزيارات بيطابق جدول الزيارات');
reset();
const cA=mkC({startDate:'2027-01-31',intervalMonths:1,durationMonths:12,number:'CT-0001'});
const cB=mkC({startDate:'2027-02-10',intervalMonths:1,durationMonths:12,number:'CT-0002'});
run(`(function(){[ '${cA}','${cB}'].forEach(id=>{const c=ctFind(id);c.visits=[];for(let n=1;n<=6;n++)c.visits.push(newVisit(c,n));});
 ctFind('${cA}').visits[1].performedBy='w1';ctFind('${cA}').visits[1].performedByName='فني أحمد';ctFind('${cB}').visits[1].status='cancelled';})()`);
const sched=run(`(function(){const out={};db.contracts.forEach(c=>c.visits.forEach(v=>{if(v.status==='cancelled')return;const m=visitDate(v).slice(0,7);out[m]=(out[m]||0)+1;}));return out;})()`);
['2027-02','2027-03','2027-04','2027-05'].forEach(ym=>{
  const G=run(`calendarMonthGrid(db,'${ym}')`);
  const inCells=G.weeks.reduce((s,w)=>s+w.reduce((x,c)=>x+c.items.length,0),0);
  ok(G.total===(sched[ym]||0)&&inCells===G.total,`تقويم ${ym}: ${G.total} زيارة = جدول الزيارات (${sched[ym]||0}) = مجموع الخلايا (${inCells})`,{total:G.total,sched:sched[ym],inCells});
});
let G=run("calendarMonthGrid(db,'2027-02')");
ok(G.weeks.every(w=>w.length===7),'كل أسبوع 7 خلايا');
const flat=[].concat(...G.weeks);
eq(flat.filter(c=>c.date).length,28,'شباط 2027 = 28 يوم');
eq(flat.findIndex(c=>c.date==='2027-02-01'),2,'الاثنين 1 شباط بالخلية 2 (الأسبوع بيبدأ السبت)');
eq(run("calendarMonthGrid(db,'2028-02')").weeks.reduce((s,w)=>s+w.filter(c=>c.date).length,0),29,'شباط 2028 (كبيسة) = 29 يوم');
const day28=flat.find(c=>c.date==='2027-02-28');
ok(day28.items.length===1&&day28.items[0].contract.id===cA,'زيارة 28 شباط (31 كانون2 + شهر) بتظهر بخليتها',day28.items.length);
eq(run("calendarMonthGrid(db,'2027-03','w1').total"),1,'فلتر الفني أحمد: زيارة وحدة بآذار (31 آذار)');
eq(run("calendarMonthGrid(db,'2027-03','__none').total"),sched['2027-03']-1,'فلتر غير مسند = الباقي');
eq(run("calendarMonthGrid(db,'2027-03','w2').total"),0,'فني بدون زيارات = 0');
eq(run("calendarMonthGrid(db,'غلط')"),null,'شهر غير صحيح = null');
eq([run("calendarShiftMonth('2027-12',1)"),run("calendarShiftMonth('2027-01',-1)"),run("calendarShiftMonth('2027-03',-1)")],['2028-01','2026-12','2027-02'],'التنقل بين الأشهر (عبر السنة)');

section('T35 — حمل الفنيين');
const L=run(`techLoad(db,'2027-03','${TODAY}')`);
eq(L.reduce((s,r)=>s+r.total,0),run("calendarMonthGrid(db,'2027-03').total"),'مجموع حمل الفنيين = زيارات الشهر');
ok(L[0].techId==='w1'&&L[L.length-1].name==='غير مسند','المسنَدين أول و«غير مسند» آخر',L.map(r=>r.name));
run(`(function(){const c=ctFind('${cA}');c.visits=[];for(let i=0;i<5;i++){const v=newVisit(c,i+1);v.date='2027-03-20';v.slotDate='2027-03-20';v.performedBy='w2';v.performedByName='فني زياد';c.visits.push(v);}})()`);
const L2=run(`techLoad(db,'2027-03','${TODAY}')`).find(r=>r.techId==='w2');
ok(L2.total===5&&L2.busy&&L2.busiestDay==='2027-03-20'&&L2.overdue===0,'5 زيارات بيوم وحد = حمل عالي',L2);
const L3=run(`techLoad(db,'2027-03','2027-04-01')`).find(r=>r.techId==='w2');
eq(L3.overdue,5,'زيارات فات موعدها بتنحسب متأخرة بالتاريخ المحلي');

section('T35 — تذكير واتساب');
eq(run("waNormalizePhone('0933123456')"),'963933123456','09xxxxxxxx ← 963 9xxxxxxxx');
eq(run("waNormalizePhone('+963 933-123-456')"),'963933123456','رقم دولي بفراغات وشرطات');
eq(run("waNormalizePhone('00963933123456')"),'963933123456','00963...');
eq(run("waNormalizePhone('933123456')"),'963933123456','بدون صفر');
eq(run("waNormalizePhone('٠٩٣٣١٢٣٤٥٦')"),'963933123456','أرقام عربية');
eq(run("waNormalizePhone('0933123456','966')"),'966933123456','كود دولة مختلف');
eq(run("waNormalizePhone('12')"),'','رقم قصير غلط = فاضي');
eq(run("waNormalizePhone('')"),'','فاضي');
const lk=run("waLink('0933123456','مرحبا & <b> \"x\"')");
ok(lk.startsWith('https://wa.me/963933123456?text=')&&!/[<>" ]/.test(lk.split('?text=')[1]),'الرابط wa.me والنص مشفّر (ما فيه < > " فراغ)',lk);
eq(run("waLink('abc','x')"),'','رقم غير صالح = بدون رابط');
reset();
const cR=mkC({startDate:'2027-03-31',intervalMonths:1,number:'CT-0007'});
run(`(function(){const c=ctFind('${cR}');c.visits=[newVisit(c,1)];c.visits[0].performedByName='فني أحمد';})()`);
const txt=run(`visitReminderText(ctFind('${cR}'),ctFind('${cR}').visits[0])`);
ok(txt.includes('بنك الشام')&&txt.includes('30/04/2027')&&txt.includes('فرع المزة')&&txt.includes('فني أحمد')&&txt.includes('CT-0007')&&txt.includes('شركة القناع'),'نص التذكير: العميل + التاريخ + الفرع + الفني + رقم العقد + الشركة',txt);
eq(run(`visitReminderPhone(ctFind('${cR}'))`),'0933123456','رقم التذكير: هاتف العميل');
run("db.clients[0].branchDetails[0].contactPhone='0944555666'");
eq(run(`visitReminderPhone(ctFind('${cR}'))`),'0944555666','رقم مسؤول الفرع بيتقدّم على هاتف العميل');
ok(run(`visitReminderLink(ctFind('${cR}'),ctFind('${cR}').visits[0])`).startsWith('https://wa.me/963944555666?text='),'رابط التذكير النهائي');
run("db.clients[0].phone='';db.clients[0].branchDetails[0].contactPhone=''");
eq(run(`visitReminderLink(ctFind('${cR}'),ctFind('${cR}').visits[0])`),'','بدون رقم = بدون رابط');

section('الواجهة — رسم كل التبويبات بدون أخطاء + ترميز النصوص');
reset();
run(`db.clients[0].name='<img src=x onerror=alert(1)>';db.clients[0].phone='0933123456';db.devices=[newDevice({clientId:'c1',branchId:'b1',type:'<script>x</script>',model:'"q"',serial:'S1',installDate:'2027-01-01',warrantyMonths:12})];`);
const cU=mkC({startDate:'2027-03-01',intervalMonths:1,payments:[],number:'CT-0001'});
run(`(function(){const c=ctFind('${cU}');c.payments=[newContractPayment(c,'2027-03-01',600),newContractPayment(c,'2027-09-01',600)];contractEnsureVisits(c,'${TODAY}');})()`);
const el={innerHTML:''},acts={innerHTML:''};ctx._el=el;ctx._acts=acts;
for(const tab of ['list','board','calendar','devices']){
  let err=null;try{run(`window._ctTab='${tab}';window._calM='2027-03';renderContracts(_el,_acts)`);}catch(e){err=e.message;}
  ok(!err&&el.innerHTML.length>200,'رسم تبويب «'+tab+'» بدون أخطاء',err);
  ok(!/<img src=x|<script>x/.test(el.innerHTML),'تبويب «'+tab+'»: النصوص الخبيثة مرمّزة');
  ok(el.innerHTML.includes('role="tablist"')&&el.innerHTML.includes("window._ctTab='calendar'"),'تبويب «'+tab+'»: شريط التبويبات موجود');
}
for(const fn of [`openContractProfitModal('${cU}')`,`openContractPaymentsModal('${cU}')`,`openDeviceModal()`,`openDeviceModal(db.devices[0].id)`,`openContractModal('${cU}')`]){
  let err=null;try{run(fn);}catch(e){err=e.message;}
  ok(!err,'نافذة '+fn.split('(')[0]+' بدون أخطاء',err);
}
const inv=run(`(function(){const c=ctFind('${cU}');const p=c.payments[0];contractBillPayment(db,c,p,'${TODAY}');return ctInvoiceHTML(c,p);})()`);
ok(inv.includes('CTI-0001')&&inv.includes('600')&&!/<img src=x/.test(inv),'HTML الفاتورة: الرقم والمبلغ والنصوص مرمّزة');
run(`(function(){const c=ctFind('${cU}');ctSetPaymentField('${cU}',c.payments[0].id,'amount','999');})()`);
eq(run(`ctFind('${cU}').payments[0].amount`),600,'مبلغ دفعة مفوترة ما بيتعدّل');
run(`(function(){const c=ctFind('${cU}');ctDeletePayment('${cU}',c.payments[0].id);})()`);
eq(run(`ctFind('${cU}').payments.length`),2,'دفعة مفوترة ما بتنحذف');

console.log('\n'+pass+' passed, '+fail+' failed  (TZ='+(process.env.TZ||'system')+')');
process.exit(fail?1:0);
