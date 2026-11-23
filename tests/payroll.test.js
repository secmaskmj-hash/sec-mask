/* اختبارات المرحلة 5: T40 حضور الفنيين وإنتاجيتهم وكشف الراتب الشهري
   التشغيل: node tests/payroll.test.js (جرّبه كمان مع TZ=Asia/Riyadh و TZ=America/Los_Angeles) */
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..');
function mkProxy(n){const f=function(){return mkProxy(n+'()');};return new Proxy(f,{get:(t,k)=>{if(k===Symbol.toPrimitive)return()=>'';if(k==='then')return undefined;return mkProxy(n+'.'+String(k));},apply:()=>mkProxy(n+'()')});}
const store={},alerts=[];
const nav={userAgent:'node',onLine:true};
const ctx={console:{log(){},error(){},warn(){}},Math,Date,JSON,Number,String,Object,Array,RegExp,isFinite,isNaN,parseFloat,parseInt,Promise,Set,Map,Symbol,Error,Intl,Blob,
 setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,
 localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},
 document:mkProxy('document'),navigator:nav,location:{href:'',hash:'',search:''},
 addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),getComputedStyle:()=>({getPropertyValue:()=>''}),
 fetch:()=>Promise.reject(new Error('no net')),alert:m=>alerts.push(String(m)),confirm:()=>true,prompt:()=>null,requestAnimationFrame:()=>0,structuredClone:x=>JSON.parse(JSON.stringify(x))};
ctx.sessionStorage=ctx.localStorage;ctx.supabase={createClient:()=>mkProxy('sb')};ctx.window=ctx;ctx.self=ctx;
vm.createContext(ctx);
['core.js','payroll.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f}));
const run=c=>vm.runInContext(c,ctx);
let pass=0,fail=0;
function ok(c,name,extra){if(c){pass++;console.log('  ✓ '+name);}else{fail++;console.log('  ✗ '+name+(extra!==undefined?'  → '+JSON.stringify(extra):''));}}
function eq(a,b,name){ok(JSON.stringify(a)===JSON.stringify(b),name,{got:a,expected:b});}
function section(t){console.log('\n'+t);}

const E=(s)=>JSON.stringify(s);
run('canViewWorkerSalaries=function(){return true;};requirePerm=function(){return true;};');
const resetDB=()=>run(`db.settings={exchangeRate:15000};db.workers=[{id:'w1',name:'أحمد',monthlySalary:520,salaryCurrency:'USD'},{id:'w2',name:'خالد'}];db.clients=[{id:'c1',name:'بنك',branches:[],branchDetails:[]}];db.attendance=[];db.workerPayments=[];db.maintenance=[];
  db.contracts=[{id:'k1',number:'CT-1',clientId:'c1',currency:'USD',status:'active',startDate:'2026-01-01',durationMonths:24,intervalMonths:1,payments:[],visits:[]}];`);
const mkV=(id,n,date,tech,status,hours,doneDate)=>run(`(function(){const v={id:${E(id)},n:${n},slotDate:${E(date)},date:${E(date)},status:${E(status||'scheduled')},performedBy:${E(tech||'')},performedByName:'',hours:${hours||0},doneDate:${E(doneDate||'')},wage:0,wageCurrency:'USD',expenses:[],checklist:[]};db.contracts[0].visits.push(v);return v.id;})()`);

section('الحضور');
resetDB();
eq(run("attSet('w1','2026-11-03','present')"),'present','تسجيل حاضر');
eq(run("attSet('w1','2026-11-03','half')"),'half','تعديل نفس اليوم (بدون سجل مكرر)');
eq(run("db.attendance.length"),1,'سجل واحد لكل عامل/يوم');
eq(run("attSet('w1','2026-11-03','')"),'','المسح');
eq(run("db.attendance.length"),0,'انمسح فعلاً');
eq(run("attSet('w1','bad','present')"),null,'تاريخ غلط مرفوض');
eq(run("attSet('w1','2026-11-03','sick')"),null,'حالة غلط مرفوضة');
eq(run("attSet('','2026-11-03','present')"),null,'بدون عامل مرفوض');
eq([run("attNext('')"),run("attNext('present')"),run("attNext('half')"),run("attNext('absent')"),run("attNext('leave')")],['present','half','absent','leave',''],'دورة التبديل: فاضي→حاضر→نصف→غائب→إجازة→فاضي');
resetDB();
['2026-11-01:present','2026-11-02:present','2026-11-03:half','2026-11-04:absent','2026-11-05:leave','2026-11-30:present','2026-10-31:absent','2026-12-01:absent'].forEach(x=>{const[d,s]=x.split(':');run(`attSet('w1','${d}','${s}')`);});
let a=run("attMonth('w1','2026-11')");
eq([a.present,a.half,a.absent,a.leave,a.recorded,a.worked,a.absentEq],[3,1,1,1,6,3.5,1.5],'ملخص تشرين الثاني: أول يوم وآخر يوم داخل، 31/10 و1/12 برا');
eq(run("attWeekday('2026-11-06')"),5,'6 تشرين الثاني 2026 = جمعة');
eq(run("attDaysOf('2026-02').length"),28,'شباط 2026 = 28 يوم');
eq(run("attDaysOf('2028-02').length"),29,'شباط 2028 = 29 يوم');

section('تقدير ساعات الزيارة (بدء→إنجاز)');
eq(run("visitAutoHours('2026-11-10T08:00:00','2026-11-10T10:20:00')"),2.25,'2:20 ← 2.25 (أقرب ربع ساعة)');
eq(run("visitAutoHours('2026-11-10T08:00:00','2026-11-10T08:02:00')"),0.25,'أقل من ربع ساعة ← 0.25');
eq(run("visitAutoHours('2026-11-10T08:00:00','2026-11-11T08:30:00')"),0,'عبر يومين ← ما بنقدّر');
eq(run("visitAutoHours('2026-11-10T01:00:00','2026-11-10T20:00:00')"),0,'أكتر من 14 ساعة ← ما بنقدّر');
eq(run("visitAutoHours('2026-11-10T10:00:00','2026-11-10T09:00:00')"),0,'الإنجاز قبل البدء ← 0');
resetDB();
{
  const id=mkV('vA',1,'2026-11-10','w1','inprogress');
  run(`(function(){const v=db.contracts[0].visits[0];v.startedAt=new Date(Date.now()-60000).toISOString(); /* دقيقة قبل: ما بتعدّي منتصف الليل بأي منطقة زمنية */})()`);
  run(`visitComplete(db.contracts[0],db.contracts[0].visits[0],{})`);
  const v=run("db.contracts[0].visits[0]");
  ok(v.hours===0.25&&v.hoursAuto===true&&!!v.completedAt,'visitComplete بيقدّر الساعات تلقائياً (أقل من ربع ساعة ← 0.25) ويسجّل completedAt',{h:v.hours});
}
resetDB();
{
  mkV('vB',1,'2026-11-10','w1','inprogress');
  run(`db.contracts[0].visits[0].startedAt=new Date(Date.now()-3600000).toISOString();`);
  run(`visitComplete(db.contracts[0],db.contracts[0].visits[0],{hours:5})`);
  eq(run("db.contracts[0].visits[0].hours"),5,'ساعات مدخلة يدوياً بتغلب التقدير');
}

section('الإنتاجية: ساعات الفني = مجموع زياراته');
resetDB();
mkV('v1',1,'2026-11-01','w1','done',2,'2026-11-01');     // أول يوم بالشهر
mkV('v2',2,'2026-11-15','w1','done',1.5,'2026-11-15');
mkV('v3',3,'2026-11-30','w1','done',3.25,'2026-11-30');  // آخر يوم
mkV('v4',4,'2026-10-31','w1','done',9,'2026-10-31');     // الشهر اللي قبل
mkV('v5',5,'2026-12-01','w1','done',9,'2026-12-01');     // الشهر اللي بعد
mkV('v6',6,'2026-11-20','w2','done',4,'2026-11-20');     // فني تاني
mkV('v7',7,'2026-11-21','w1','cancelled',8,'');          // ملغاة
mkV('v8',8,'2026-11-22','w1','scheduled',0,'');          // مجدولة (مو منجزة)
mkV('v9',9,'2026-11-23','','done',6,'2026-11-23');       // بدون فني
mkV('v10',10,'2026-11-05','w1','postponed',0,'');        // مؤجلة وفايتة
let p=run("techProductivity('w1','2026-11','2026-11-20')");
eq(p.visitsDone,3,'w1: 3 زيارات منجزة بتشرين الثاني (أول يوم وآخر يوم داخل)');
eq(p.hours,6.75,'ساعات w1 = 2 + 1.5 + 3.25');
eq(p.hoursC,675,'بالسنت: 675 (بدون كسور عائمة)');
eq(p.hoursPerVisit,2.25,'ساعة/زيارة = 6.75 ÷ 3');
eq([p.open,p.missed],[2,1],'مفتوحة: مجدولة 22/11 + مؤجلة 5/11. فايتة بتاريخ 20/11: المؤجلة بس');
eq(p.onTimePct,100,'كلها بالموعد');
const p2=run("techProductivity('w2','2026-11','2026-11-25')");
eq([p2.visitsDone,p2.hours],[1,4],'w2: زيارة وحدة 4 ساعات');
const allDone=run("(function(){let s=0;db.contracts[0].visits.forEach(v=>{if(v.status==='done'&&v.doneDate>='2026-11-01'&&v.doneDate<='2026-11-30')s+=Math.round(v.hours*100);});return s;})()");
eq(p.hoursC+p2.hoursC+run("payCents(6)"),allDone,'مجموع ساعات الفنيين + غير المسند = مجموع ساعات كل الزيارات المنجزة بالشهر');
run(`db.contracts[0].visits.find(v=>v.id==='v2').doneDate='2026-11-20'`);
eq(run("techProductivity('w1','2026-11','2026-11-25').onTimePct"),67,'زيارة منجزة بعد موعدها ← نسبة بالموعد 67%');
// ورش + حضور
run(`db.maintenance=[{id:'m1',startDate:'2026-11-02',currency:'USD',workers:[{workerId:'w1',date:'2026-11-02',days:2,wage:20,currency:'USD'},{workerId:'w1',date:'2026-11-03',days:1,wage:10,currency:'USD',wageOnly:true}]},{id:'m2',startDate:'2026-10-31',currency:'USD',workers:[{workerId:'w1',date:'2026-10-31',days:5,wage:50,currency:'USD'}]}];`);
['2026-11-02','2026-11-03','2026-11-04'].forEach(d=>run(`attSet('w1','${d}','present')`));
p=run("techProductivity('w1','2026-11','2026-11-25')");
eq(p.cardDays,2,'أيام الورش بالشهر (wageOnly و31/10 مستثناة)');
eq(p.visitsPerDay,1,'زيارات منجزة ÷ أيام حضور = 3 ÷ 3');

section('كشف الراتب');
resetDB();
// حضور: غائب 2 + نصف يوم 1 = 2.5 يوم خصم
['2026-11-02:absent','2026-11-03:absent','2026-11-04:half','2026-11-05:present'].forEach(x=>{const[d,s]=x.split(':');run(`attSet('w1','${d}','${s}')`);});
run(`db.maintenance=[
 {id:'m1',startDate:'2026-11-01',currency:'USD',workersCurrency:'USD',workers:[{workerId:'w1',date:'2026-11-01',wage:30,currency:'USD',paid:true},{workerId:'w2',date:'2026-11-01',wage:99,currency:'USD'}]},
 {id:'m2',startDate:'2026-11-30',currency:'SYP',exchangeRateAtEntry:20000,workers:[{workerId:'w1',date:'2026-11-30',wage:200000,currency:'SYP'}]},
 {id:'m3',startDate:'2026-10-31',currency:'USD',workers:[{workerId:'w1',date:'2026-10-31',wage:500,currency:'USD'}]},
 {id:'m4',startDate:'2026-12-01',currency:'USD',workers:[{workerId:'w1',date:'2026-12-01',wage:500,currency:'USD'}]}];
 db.workerPayments=[
 {id:'p1',workerId:'w1',type:'advance',amount:40,currency:'USD',date:'2026-11-10',paid:true,paidDate:'2026-11-10'},
 {id:'p2',workerId:'w1',type:'payment',isBonus:true,amount:25,currency:'USD',date:'2026-11-12',paid:false},
 {id:'p3',workerId:'w1',type:'payment',amount:100,currency:'USD',date:'2026-11-20',paid:true,paidDate:'2026-11-20'},
 {id:'p4',workerId:'w1',type:'payment',amount:300,currency:'USD',date:'2026-12-01',paid:true,paidDate:'2026-12-01'},
 {id:'p5',workerId:'w2',type:'advance',amount:77,currency:'USD',date:'2026-11-10',paid:true}];`);
run("db.settings.useEntryRate=true"); // خيار الإعدادات «سعر الصرف المحفوظ وقت العملية» (نفس منطق الداشبورد)
let s=run("payrollStatement('w1','2026-11')");
eq(s.base,52000,'الراتب الأساسي 520$ = 52000 سنت');
eq(s.absenceDeduction,-Math.round(52000*2.5/26),'خصم الغياب = 520 ÷ 26 × 2.5 = 50$');
eq(s.absenceDeduction,-5000,'= 50.00$ بالضبط');
eq(s.wages,3000+1000,'أجور تشرين الثاني: 30$ + 200000 ل.س بسعر السجل 20000 = 10$ (مو بالسعر الحالي 15000)');
eq(s.wageLines,2,'سطرين فقط (31/10 و1/12 برا)');
eq(s.wagesPaid,3000,'منها مسدد: 30$');
eq([s.bonuses,s.advances],[2500,-4000],'مكافأة 25$ وسلفة 40$ بالشهر');
eq(s.net,52000-5000+4000+2500-4000,'الصافي = أساسي − غياب + أجور + مكافآت − سلف = 495$');
eq(s.paidOut,10000,'مدفوع فعلياً: دفعة 100$ بس (السلفة ما بتنعدّ، 1/12 برا، المكافأة المعلقة برا)');
eq(s.remaining,s.net-s.paidOut,'المتبقي = الصافي − المدفوع');
eq(s.net,s.base+s.absenceDeduction+s.wages+s.bonuses+s.advances,'الصافي = مجموع البنود بالسنت');
run("db.settings.useEntryRate=false");
eq(run("payrollStatement('w1','2026-11').wages"),3000+Math.round(200000/15000*100),'الخيار مطفي: الأجر بالليرة بالسعر الحالي (نفس سلوك باقي التقارير)');
run("db.settings.useEntryRate=true");
// عامل بدون راتب أساسي: ما في خصم، أجوره بس
let s2=run("payrollStatement('w2','2026-11')");
eq([s2.base,s2.absenceDeduction,s2.wages,s2.advances,s2.net],[0,0,9900,-7700,2200],'w2: بدون راتب ثابت — أجور 99$ − سلفة 77$');
// بدون حضور مسجل: ما في خصم
resetDB();
eq(run("payrollStatement('w1','2026-11').absenceDeduction"),0,'ما في حضور مسجّل ← ما في خصم غياب');
// الخصم ما بيتجاوز الراتب
run(`for(let d=1;d<=28;d++)attSet('w1','2026-11-'+String(d).padStart(2,'0'),'absent');`);
eq(run("payrollStatement('w1','2026-11').net"),0,'غياب 28 يوم: الخصم محصور بقيمة الراتب (الصافي ما بينزل تحت الصفر من الغياب)');
// راتب بالليرة
resetDB();
run(`db.workers[0].monthlySalary=7500000;db.workers[0].salaryCurrency='SYP';`);
eq(run("payrollStatement('w1','2026-11').base"),run("payCents(7500000/15000)"),'راتب بالليرة بيتحوّل بالسعر الحالي (500$)');
// المجاميع
resetDB();
run(`db.maintenance=[{id:'m1',startDate:'2026-11-05',currency:'USD',workers:[{workerId:'w1',date:'2026-11-05',wage:30,currency:'USD'},{workerId:'w2',date:'2026-11-05',wage:20,currency:'USD'}]}];`);
const T=run("payrollTotals('2026-11')");
eq(T.net,T.rows.reduce((x,r)=>x+r.net,0),'مجموع الصافي = مجموع صفوف العمال');
eq(T.net,T.base+T.absenceDeduction+T.wages+T.bonuses+T.advances,'مجموع الصافي = مجموع أعمدة الجدول');
eq(T.wages,5000,'مجموع الأجور 50$');

section('الصلاحيات والعرض');
resetDB();
const html=run("renderPayrollTab()");
ok(/att-table/.test(html)&&/إنتاجية الفنيين/.test(html)&&/كشف الرواتب الشهري/.test(html),'التبويب فيه الحضور + الإنتاجية + كشف الرواتب');
ok(/ps-w1/.test(html),'حقل الراتب الشهري لكل عامل');
ok(/att-fri/.test(html),'أعمدة الجمعة معلّمة');
run("window.__orig=canViewWorkerSalaries;canViewWorkerSalaries=function(){return false;};");
ok(/ما عندك صلاحية/.test(run("payrollHTML('2026-11')")),'بدون صلاحية الرواتب: الجدول مقفل');
eq(run("payOpenStatement('w1','2026-11')")===undefined,true,'فتح الكشف بدون صلاحية: ما بيعمل شي');
run("canViewWorkerSalaries=window.__orig;");
const pr=run("payrollStatementHTML(payrollStatement('w1','2026-11'))");
ok(/كشف راتب شهري/.test(pr)&&/توقيع العامل/.test(pr),'كشف الراتب المطبوع');
resetDB();
run("db.workers.push({id:'w3',name:'<img src=x onerror=alert(1)>'})");
ok(!/<img src=x/.test(run("attGridHTML('2026-11')")+run("productivityHTML('2026-11')")+run("payrollHTML('2026-11')")),'أسماء العمال مهرّبة (XSS)');
run("paySetSalary");
console.log('\n'+(fail?'❌':'✅')+' '+pass+' نجح، '+fail+' فشل');
process.exit(fail?1:0);
