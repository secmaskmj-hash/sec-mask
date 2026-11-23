/* اختبارات المرحلة 5 / الجزء 1: T43 ربط المستخدم بفني + عزل الزيارات + "زياراتي"
   التشغيل: node tests/perms.test.js (جرّبه كمان مع TZ=Asia/Riyadh و TZ=America/Los_Angeles) */
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..');
function mkProxy(n){const f=function(){return mkProxy(n+'()');};return new Proxy(f,{get:(t,k)=>{if(k===Symbol.toPrimitive)return()=>'';if(k==='then')return undefined;return mkProxy(n+'.'+String(k));},apply:()=>mkProxy(n+'()')});}
const store={},alerts=[];
const ctx={console,Math,Date,JSON,Number,String,Object,Array,RegExp,isFinite,isNaN,parseFloat,parseInt,Promise,Set,Map,Symbol,Error,Intl,Blob,
 setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,
 localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},
 document:mkProxy('document'),navigator:{userAgent:'node',onLine:true},location:{href:'',hash:'',search:''},
 addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),getComputedStyle:()=>({getPropertyValue:()=>''}),
 fetch:()=>Promise.reject(new Error('no net')),alert:m=>alerts.push(String(m)),confirm:()=>true,prompt:()=>null,requestAnimationFrame:()=>0,structuredClone:x=>JSON.parse(JSON.stringify(x))};
ctx.sessionStorage=ctx.localStorage;ctx.supabase={createClient:()=>mkProxy('sb')};ctx.window=ctx;ctx.self=ctx;
vm.createContext(ctx);
['core.js','ops.js','people.js','contracts.js','myvisits.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f}));
const run=c=>vm.runInContext(c,ctx);
let pass=0,fail=0;
function ok(c,name,extra){if(c){pass++;console.log('  ✓ '+name);}else{fail++;console.log('  ✗ '+name+(extra!==undefined?'  → '+JSON.stringify(extra):''));}}
function eq(a,b,name){ok(JSON.stringify(a)===JSON.stringify(b),name,{got:a,expected:b});}
function section(t){console.log('\n'+t);}
const loginAs=id=>{store['security_mask_user']=id;};

run(`db.settings=db.settings||{};db.workers=[{id:'w1',name:'أحمد'},{id:'w2',name:'خالد'}];db.clients=[{id:'c1',name:'بنك',branches:[],branchDetails:[]}];
 db.workerPayments=[];db.maintenance=[];db.sales=[];db.generalExpenses=[{id:'g1',amount:5}];db.tools=[{id:'t1',name:'عدة'}];
 const mkV=(id,n,date,tech,status)=>({id,n,slotDate:date,date,status:status||'scheduled',performedBy:tech,performedByName:tech?getWorkerName(tech):''});
 db.contracts=[
  {id:'k1',number:'CT-1',clientId:'c1',status:'active',payments:[],visits:[mkV('v1',1,'2027-03-10','w1'),mkV('v2',2,'2027-03-10','w2'),mkV('v3',3,'2027-03-12',''),mkV('v4',4,'2027-03-05','w1'),mkV('v5',5,'2027-02-01','w1','done')]},
  {id:'k2',number:'CT-2',clientId:'c1',status:'active',payments:[],visits:[mkV('v6',1,'2027-03-10','w2')]}];`);

section('T43 — الأمان غير مفعّل');
ok(!run(`permEnforced()`),'غير مفعّل قبل ما نضيف المستخدمين');ok(run(`permForcedTech()`)==='','ما في تقييد زيارات');
run(`db.security={enabled:true,users:[
 {id:'ua',username:'مدير',role:'admin'},
 {id:'ub',username:'محاسب',role:'user',canDelete:false,canViewWorkerSalaries:false},
 {id:'uc',username:'مدير مشروع',role:'user',canDelete:true,canViewWorkerSalaries:true,canBackupRestore:false},
 {id:'ud',username:'فني',role:'user',canDelete:false,ownVisitsOnly:true,workerId:'w1'},
 {id:'ue',username:'فني غير مربوط',role:'user',ownVisitsOnly:true},
 {id:'uf',username:'مراقب',role:'user',workerId:'w2'},
 {id:'ug',username:'نسخ',role:'user',canBackupRestore:true}]}`);
ok(run(`permEnforced()`),'مفعّل');

section('T43 — عزل الزيارات');
const ids=r=>JSON.stringify([].concat(r.today,r.overdue,r.week).map(x=>x.visit.id).sort());
loginAs('ua');eq(ids(run(`visitsBoard(db,'2027-03-10')`)),JSON.stringify(['v1','v2','v3','v4','v6']),'المدير: كل الزيارات المفتوحة');
loginAs('ud');
eq(ids(run(`visitsBoard(db,'2027-03-10')`)),JSON.stringify(['v1','v4']),'الفني w1: زياراته فقط (v1,v4)');
eq(ids(run(`visitsBoard(db,'2027-03-10','w2')`)),JSON.stringify(['v1','v4']),'حتى لو طلب فني تاني: بيضل زياراته');
eq(run(`visitsBoard(db,'2027-03-10').overdue.map(x=>x.visit.id)`),['v4'],'المتأخرة: v4 بس');
eq(run(`visitsInMonth(db,'2027-03').map(x=>x.visit.id).sort()`),['v1','v4'],'التقويم الشهري: زياراته بس');
ok(run(`permOwnsVisit(db.contracts[0].visits[0])&&!permOwnsVisit(db.contracts[0].visits[1])`),'permOwnsVisit');
loginAs('ue');eq(ids(run(`visitsBoard(db,'2027-03-10')`)),'[]','مقيّد بدون ربط بفني: ما بيشوف شي');
loginAs('uf');eq(ids(run(`visitsBoard(db,'2027-03-10')`)),JSON.stringify(['v1','v2','v3','v4','v6']),'مستخدم مربوط بفني بدون "زياراته فقط": يشوف الكل');
loginAs('ub');eq(ids(run(`visitsBoard(db,'2027-03-10')`)),JSON.stringify(['v1','v2','v3','v4','v6']),'مستخدم عادي: يشوف الكل');
run(`db.security.enabled=false`);loginAs('ud');
eq(ids(run(`visitsBoard(db,'2027-03-10')`)),JSON.stringify(['v1','v2','v3','v4','v6']),'الأمان مطفي: ما في تقييد');
run(`db.security.enabled=true`);

section('T43 — زياراتي');
loginAs('ud');
const my=run(`myVisitsData('2027-03-10')`);
ok(my.linked,'مربوط');
eq(my.board.today.map(x=>x.visit.id),['v1'],'اليوم: v1');
eq(my.done.map(x=>x.visit.id),['v5'],'المنتهية: v5');
loginAs('ue');ok(!run(`myVisitsData('2027-03-10')`).linked,'غير مربوط');
loginAs('ud');
run(`myVisitStart('k1','v2')`);eq(run(`db.contracts[0].visits[1].status`),'scheduled','ما بيقدر يبدأ زيارة فني تاني');
run(`myVisitStart('k1','v1')`);eq(run(`db.contracts[0].visits[0].status`),'inprogress','بيبدأ زيارته');
run(`myVisitDone('k1','v2')`);eq(run(`db.contracts[0].visits[1].status`),'scheduled','ما بيقدر ينهي زيارة فني تاني');
run(`window._el={};renderMyVisits(_el,{})`);ok(/CT-1/.test(run(`_el.innerHTML`)),'الصفحة بتنرسم بزياراته');
ok(!/CT-2/.test(run(`_el.innerHTML`)),'وما فيها زيارات فني تاني');
loginAs('ue');run(`renderMyVisits(_el,{})`);ok(/غير مرتبط/.test(run(`_el.innerHTML`)),'رسالة عدم الربط');

section('T43 — التسجيل');
ok(run(`PAGE_LIST.some(p=>p.id==='myvisits')&&PAGE_BUNDLE.myvisits==='myvisits'`),'الصفحة مسجّلة');
ok(run(`ROLE_PRESETS.technician.ownVisitsOnly===true&&ROLE_PRESETS.technician.sections.includes('myvisits')`),'قالب الفني: زياراته فقط + صفحة زياراتي');
ok(!run(`ROLE_PRESETS.manager.ownVisitsOnly`),'قوالب الأدوار التانية ما تغيّرت');
ok(run(`PAGE_BUNDLE.myvisits`)==='myvisits'&&run(`_bundleFiles.myvisits`)==='myvisits.js','الصفحة بتنحمّل كـ bundle');

console.log('\n'+(fail?'❌':'✅')+' نجح '+pass+' / فشل '+fail);process.exit(fail?1:0);
