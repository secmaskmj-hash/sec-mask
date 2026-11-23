/* اختبارات المرحلة 5 / الجزء 1: T14 فحص الصلاحية جوّا الدوال (رواتب · حذف · أسماء عمال).
   التشغيل:  node tests/permissions.test.js   — بيحمّل الملفات الحقيقية بدون متصفح.
   القاعدة: استدعاء مباشر بدون صلاحية بيترفض (تنبيه + ما بيتغيّر ولا سجل)، ومع الصلاحية بيشتغل متل قبل. */
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..');
function mkProxy(n){const f=function(){return mkProxy(n+'()');};return new Proxy(f,{get:(t,k)=>{if(k===Symbol.toPrimitive)return()=>'';if(k==='then')return undefined;return mkProxy(n+'.'+String(k));},set:()=>true,apply:()=>mkProxy(n+'()'),construct:()=>mkProxy('new')});}
const store={};const alerts=[];
const ctx={console:{log:console.log,error(){},warn(){}},Math,Date,JSON,Number,String,Object,Array,RegExp,isFinite,isNaN,parseFloat,parseInt,Promise,Set,Map,Symbol,Error,Intl,
 setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,
 localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},
 document:mkProxy('document'),navigator:{userAgent:'node',onLine:true},location:{href:'',hash:'',search:''},
 addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),getComputedStyle:()=>({getPropertyValue:()=>''}),
 fetch:()=>Promise.reject(new Error('no net')),alert:m=>alerts.push(String(m)),confirm:()=>true,prompt:()=>null,requestAnimationFrame:()=>0,structuredClone:x=>JSON.parse(JSON.stringify(x))};
ctx.sessionStorage=ctx.localStorage;ctx.supabase={createClient:()=>mkProxy('sb')};ctx.window=ctx;ctx.self=ctx;
vm.createContext(ctx);
['core.js','ops.js','people.js','settings.js','inventory.js','contracts.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f}));
const run=c=>vm.runInContext(c,ctx);
let pass=0,fail=0;
function ok(c,name,extra){if(c){pass++;console.log('  ✓ '+name);}else{fail++;console.log('  ✗ '+name+(extra!==undefined?'  → '+JSON.stringify(extra):''));}}
function eq(a,b,name){ok(JSON.stringify(a)===JSON.stringify(b),name,{got:a,expected:b});}
function section(t){console.log('\n'+t);}
const as=id=>{store['security_mask_user']=id;};
const base=()=>run(`db.security={enabled:true,users:[
 {id:'admin1',username:'مدير',role:'admin'},
 {id:'lim',username:'محدود',role:'user',canDelete:false,canViewProfits:false,canViewTotals:false,canViewWorkerSalaries:false,canViewWorkerNames:false},
 {id:'acct',username:'محاسب',role:'user',canDelete:false,canViewProfits:true,canViewTotals:true,canViewWorkerSalaries:true,canViewWorkerNames:true},
 {id:'del',username:'حاذف',role:'user',canDelete:true,canViewProfits:false,canViewTotals:false,canViewWorkerSalaries:false,canViewWorkerNames:true},
 {id:'names',username:'أسماء فقط',role:'user',canDelete:false,canViewWorkerSalaries:false,canViewWorkerNames:true}]};
 db.workers=[{id:'w1',name:'أحمد الفني',phone:''},{id:'w2',name:'زياد',phone:''}];
 db.workerPayments=[{id:'p1',workerId:'w1',type:'payment',amount:100,currency:'USD',date:'2027-03-01',paid:false}];
 db.maintenance=[];db.stockItems=[{id:'i1',name:'كاميرا',active:true}];db.stockMoves=[{id:'m1',itemId:'i1',kind:'adjust',qty:1}];db.sales=[];db.purchases=[];`);
const snap=()=>JSON.stringify(run("[db.workers,db.workerPayments,db.stockItems,db.stockMoves]"));
const call=(code)=>{alerts.length=0;try{run(code);}catch(e){}return alerts.length;};

section('T14 — دالة requirePerm نفسها');
base();
as('lim');
eq(run("requirePerm('salary',{silent:true})"),false,'محدود: salary مرفوض');
eq(run("requirePerm('delete',{silent:true})"),false,'محدود: delete مرفوض');
eq(run("requirePerm('names',{silent:true})"),false,'محدود: names مرفوض');
eq(run("requirePerm('admin',{silent:true})"),false,'محدود: admin مرفوض');
eq(run("requirePerm('نوع-مجهول',{silent:true})"),false,'نوع صلاحية مجهول = رفض (آمن)');
eq(call("requirePerm('salary')"),1,'الرفض بيطلّع تنبيه واحد');
as('');eq(run("requirePerm('delete',{silent:true})"),false,'بدون مستخدم مسجّل = كله مرفوض');
as('admin1');['salary','delete','names','finance','profit','totals','admin'].forEach(k=>eq(run(`requirePerm('${k}',{silent:true})`),true,'مدير: '+k+' مسموح'));
as('acct');eq(run("requirePerm('salary',{silent:true})"),true,'محاسب: salary مسموح');eq(run("requirePerm('delete',{silent:true})"),false,'محاسب: delete مرفوض');
as('del');eq(run("requirePerm('delete',{silent:true})"),true,'حاذف: delete مسموح');eq(run("requirePerm('salary',{silent:true})"),false,'حاذف: salary مرفوض');

section('T14 — الرواتب: استدعاء مباشر بدون صلاحية بيترفض ولا يغيّر شي');
base();as('lim');
const s0=snap();
['openWorkerPaymentModal()',"openWorkerPaymentModal('advance','w1')",'saveWorkerPayment(false)','saveWorkerPayment(true)',"markWorkerPaid('p1')","openWorkerBonusModal('w1')","showWorkerUnpaidDetails('w1')"].forEach(c=>eq(call(c),1,'محدود: '+c+' → مرفوض مع تنبيه'));
eq(snap(),s0,'ما تغيّرت أي بيانات');
eq(run("db.workerPayments[0].paid"),false,'الدفعة ما انقلبت لمدفوعة');
eq(run("renderWorkerPaymentsList().includes('متاح فقط لمن لديه الصلاحية')"),true,'قائمة الدفعات مقفولة');
eq(run("renderWorkerIncentives().includes('متاح فقط لمن لديه الصلاحية')"),true,'الحوافز مقفولة');
as('del');eq(call("markWorkerPaid('p1')"),1,'حاذف (بدون رواتب): markWorkerPaid مرفوض');eq(run("db.workerPayments[0].paid"),false,'ما انقلبت');
as('acct');alerts.length=0;
let threw=null;try{run("markWorkerPaid('p1')");}catch(e){threw=e;}
ok(!alerts.some(a=>a.includes('لا تملك صلاحية')),'محاسب (معه الرواتب): markWorkerPaid ما انرفض');
eq(run("db.workerPayments[0].paid"),true,'محاسب: الدفعة انقلبت لمدفوعة فعلاً');
as('admin1');base();
try{run("markWorkerPaid('p1')");}catch(e){}
eq(run("db.workerPayments[0].paid"),true,'مدير: markWorkerPaid شغّال');

section('T14 — الرواتب: التصدير');
base();as('lim');
eq(call("exportWorkersSummaryExcel()"),1,'محدود: تصدير ملخص العمال مرفوض');
eq(call("exportWorkersPaymentsExcel()"),1,'محدود: تصدير الدفعات مرفوض (تنبيه واحد فقط)');
eq(call("exportWorkersWorklistExcel()"),1,'محدود: تصدير قائمة الأعمال مرفوض');
as('names');
eq(call("exportWorkersPaymentsExcel()"),1,'أسماء فقط بدون رواتب: تصدير الدفعات مرفوض');

section('T14 — أسماء العمال');
base();as('lim');
eq(run("getWorkerName('w1')"),'•••','محدود: getWorkerName بيخفي الاسم');
eq(run("getWorkerNameRaw('w1')"),'أحمد الفني','الاسم الخام للتخزين الداخلي بس');
ok(!run("workerOptions('w1')").includes('أحمد'),'قائمة اختيار العمال بدون أسماء حقيقية');
ok(run("workerOptions('w1')").includes('عامل 1')&&run("workerOptions('w1')").includes('عامل 2'),'القائمة بتضل قابلة للاختيار (عامل 1، عامل 2)');
ok(run("workerOptions('w1')").includes('value="w1"'),'قيمة الخيار = المعرّف');
eq(run("getWorkerName('nope')"),'•••','عامل غير موجود + بدون صلاحية = مخفي');
as('acct');eq(run("getWorkerName('w1')"),'أحمد الفني','محاسب: الاسم ظاهر');
as('admin1');eq(run("getWorkerName('w1')"),'أحمد الفني','مدير: الاسم ظاهر');
as('lim');base();as('lim');
const n0=snap();
eq(call("saveInlineWorker()"),1,'محدود: إضافة عامل مرفوضة');
eq(call("openEditWorkerModal('w1')"),1,'محدود: فتح تعديل عامل مرفوض');
eq(call("saveEditWorker('w1')"),1,'محدود: حفظ تعديل عامل مرفوض');
eq(snap(),n0,'أسماء العمال ما تغيّرت');
eq(run("renderSettingsWorkers().includes('متاح فقط لمن لديه الصلاحية')"),true,'تبويب إعدادات العمال مقفول');
as('names');eq(run("renderSettingsWorkers().includes('متاح فقط')"),false,'أسماء فقط: التبويب مفتوح');
// اسم الفني بسجل بطاقة العمل (التخزين الداخلي) لازم يكون الحقيقي حتى لو اللي أنجز الزيارة محدود
as('lim');
const cardSrc=fs.readFileSync(path.join(root,'core.js'),'utf8');
ok(/workerName:v\.performedByName\|\|getWorkerNameRaw\(v\.performedBy\)/.test(cardSrc),'بطاقة العمل المولّدة من الزيارة بتخزّن الاسم الخام');
ok(!/workerName:v\.performedByName\|\|getWorkerName\(/.test(cardSrc),'ما في تخزين لاسم مخفي (•••)');

section('T14 — الحذف');
base();as('lim');
const d0=snap();
eq(call("deleteInvItem('i1')"),1,'محدود: deleteInvItem مرفوض');
eq(call("deleteInvMove('m1','i1')"),1,'محدود: deleteInvMove مرفوض');
eq(snap(),d0,'الصنف والحركة بقوا موجودين');
as('acct');eq(call("deleteInvMove('m1','i1')"),1,'محاسب بدون صلاحية الحذف: مرفوض');
eq(run("db.stockMoves.length"),1,'ما انحذفت');
as('del');
call("deleteInvMove('m1','i1')");
eq(run("db.stockMoves.length"),0,'مع صلاحية الحذف: الحركة انحذفت');
base();as('del');
call("deleteInvItem('i1')");
eq(run("[db.stockItems.length,db.stockItems[0].active]"),[1,false],'صنف عليه حركات + صلاحية الحذف: بيتعطّل (مو بينحذف) متل التصميم');
base();as('del');run("db.stockMoves=[]");
call("deleteInvItem('i1')");
eq(run("db.stockItems.length"),0,'صنف بدون حركات + صلاحية الحذف: انحذف');
base();as('admin1');call("deleteInvMove('m1','i1')");eq(run("db.stockMoves.length"),0,'مدير: يحذف');

section('T14 — كل دالة حذف بالملفات الحقيقية فيها حارس (فحص ساكن)');
const files=['core.js','ops.js','people.js','wallet.js','assets.js','settings.js','contracts.js','inventory.js'];
const exempt=new Set(['removeClientBranch','resetIdleTimer','bulkPrintMaint','bulkPrintSales','bulkToggleAll','bulkToggleRow','bulkToolbar','bulkMaintDelivery','bulkMaintPayment','bulkSalesPayment','bulkQuoteStatus','bulkToolStatus','bulkLoanReturned']);
const missing=[];
files.forEach(f=>{const s=fs.readFileSync(path.join(root,f),'utf8');const re=/^(?:async )?function (delete\w*)\(([^)]*)\)\s*\{/gm;let m;while((m=re.exec(s))){const body=s.slice(m.index,m.index+800);if(!/guardDelete|canDelete|isAdmin\(|requirePerm\('(delete|admin)'/.test(body)&&!exempt.has(m[1]))missing.push(f+':'+m[1]);}});
eq(missing,[],'كل دوال delete* فيها حارس صلاحية');

console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
