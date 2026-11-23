/* اختبارات المرحلة 5 / الجزء 2: T42 الوضع الميداني — صور الزيارة + طابور الرفع بدون إنترنت + مؤشر الحالة
   التشغيل: node tests/field.test.js (جرّبه كمان مع TZ=Asia/Riyadh و TZ=America/Los_Angeles) */
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
['core.js','ops.js','contracts.js','myvisits.js','field.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f}));
const run=c=>vm.runInContext(c,ctx);
let pass=0,fail=0;
function ok(c,name,extra){if(c){pass++;console.log('  ✓ '+name);}else{fail++;console.log('  ✗ '+name+(extra!==undefined?'  → '+JSON.stringify(extra):''));}}
function eq(a,b,name){ok(JSON.stringify(a)===JSON.stringify(b),name,{got:a,expected:b});}
function section(t){console.log('\n'+t);}

(async()=>{
/* Storage وهمي */
const remote={};let failUploadAfter=Infinity,uploads=0,removes=0;
ctx.__client={storage:{from:b=>({
  upload:async(p,blob,o)=>{if(uploads>=failUploadAfter)return {error:{message:'network'}};uploads++;remote[b+'/'+p]={size:blob.size,ct:o.contentType};return {data:{path:p},error:null};},
  remove:async(ps)=>{ps.forEach(p=>{delete remote[b+'/'+p];});removes++;return {data:[],error:null};},
  createSignedUrl:async(p)=>({data:{signedUrl:'https://signed/'+p},error:null})})}};
run(`FIELD.client=__client;FIELD.compress=async function(f){return {blob:{size:f.size||1000,fake:true},w:800,h:600};};`);
const mkFile=(n,s)=>({name:n,size:s||120000});
run(`db.settings=db.settings||{};db.workers=[{id:'w1',name:'أحمد'},{id:'w2',name:'خالد'}];db.clients=[{id:'c1',name:'بنك',branches:[],branchDetails:[]}];
 const mkV=(id,n,date,tech,status)=>({id,n,slotDate:date,date,status:status||'scheduled',performedBy:tech,performedByName:tech?getWorkerNameRaw(tech):''});
 db.contracts=[{id:'k1',number:'CT-1',clientId:'c1',status:'active',payments:[],visits:[mkV('v1',1,'2027-03-10','w1'),mkV('v2',2,'2027-03-10','w2'),mkV('v3',3,'2027-03-11','w1','cancelled')]}];`);

section('T42 — حساب أبعاد الصورة');
eq(run(`fieldScale(4000,3000,1280)`),{w:1280,h:960},'صورة أفقية كبيرة 4000×3000 → 1280×960');
eq(run(`fieldScale(3000,4000,1280)`),{w:960,h:1280},'عمودية');
eq(run(`fieldScale(800,600,1280)`),{w:800,h:600},'صغيرة: ما بتكبر');
eq(run(`fieldScale(0,10,1280)`),{w:0,h:0},'أبعاد غير صالحة');

section('T42 — إضافة صور (بدون إنترنت)');
nav.onLine=false;
let r=await run(`fieldAddPhotos('k1','v1',[{name:'a.jpg',size:100000},{name:'b.jpg',size:90000}])`);
eq(r,{added:2,skipped:0},'أضاف صورتين');
const v1=()=>run(`db.contracts[0].visits[0]`);
eq(v1().photos.length,2,'بيانات الزيارة فيها صورتين');
ok(v1().photos.every(p=>p.uploaded===false&&/^[^/]+\/k1\/v1\/[^/]+\.jpg$/.test(p.path)),'uploaded=false والمسار tenant/عقد/زيارة/id.jpg',v1().photos[0]);
ok(!/data:image|blob/.test(JSON.stringify(run(`db`))),'ما في صور ولا Blob جوّا بيانات الشركة (بس معلومات صغيرة)');
eq(await run(`fieldPending()`),2,'صورتين بالطابور');
r=await run(`fieldSync()`);
ok(r.offline&&r.pending===2&&uploads===0,'بدون نت: ما بيحاول يرفع');
let st=await run(`fieldStatus()`);
ok(!st.online&&st.pendingPhotos===2,'الحالة: غير متصل + صورتين معلّقة');
ok(/غير متصل/.test(run(`fieldStatusText(${JSON.stringify(st)})`))&&/2 صورة/.test(run(`fieldStatusText(${JSON.stringify(st)})`)),'نص المؤشر');

section('T42 — رجوع الإنترنت: رفع تلقائي');
nav.onLine=true;
r=await run(`fieldSync()`);
eq([r.uploaded,r.pending,r.error],[2,0,null],'رفع الصورتين والطابور فاضي');
ok(v1().photos.every(p=>p.uploaded&&p.path),'علامة uploaded=true على البيانات');
eq(Object.keys(remote).length,2,'الملفين وصلوا للـ Storage');
ok(Object.keys(remote).every(k=>k.startsWith('visit-photos/')),'bucket صحيح');
ok(Object.values(remote).every(x=>x.ct==='image/jpeg'),'contentType');
st=await run(`fieldStatus()`);ok(st.online&&st.pendingPhotos===0,'الحالة: متصل وما في معلّق');

section('T42 — فشل رفع بالنص ثم نجاح');
nav.onLine=false;await run(`fieldAddPhotos('k1','v1',[{name:'c.jpg'},{name:'d.jpg'},{name:'e.jpg'}])`);
nav.onLine=true;failUploadAfter=uploads+1;
r=await run(`fieldSync()`);
eq([r.uploaded,r.pending],[1,2],'رفع واحدة وفشل الباقي (بينوقف عند أول فشل)');
ok(r.error==='network','سجّل الخطأ');
const q=await run(`fieldStore().all()`);ok(q.every(x=>x.tries===1||x.tries===0)&&q.some(x=>x.tries===1),'عدّاد المحاولات');
failUploadAfter=Infinity;
r=await run(`fieldSync()`);eq([r.uploaded,r.pending],[2,0],'إعادة المحاولة: رفع الباقي');
eq(v1().photos.length,5,'5 صور بالزيارة');
ok(v1().photos.every(p=>p.uploaded),'كلها مرفوعة');

section('T42 — الحد الأقصى');
nav.onLine=false;r=await run(`fieldAddPhotos('k1','v1',Array.from({length:10},(_,i)=>({name:'x'+i+'.jpg'})))`);
eq(r,{added:7,skipped:3},'الحد 12 صورة للزيارة: انضاف 7 وانتجاهل 3');
eq(v1().photos.length,12,'12 بالزيارة');
nav.onLine=true;await run(`fieldSync()`);

section('T42 — حذف الصور');
nav.onLine=false;
await run(`fieldRemovePhoto('k1','v1',db.contracts[0].visits[0].photos[0].id)`);
eq(v1().photos.length,11,'انحذفت من الزيارة');
eq(await run(`fieldPending()`),1,'صورة مرفوعة انحذفت: طلب حذف بالطابور');
const before=Object.keys(remote).length;
nav.onLine=true;r=await run(`fieldSync()`);
eq([r.deleted,Object.keys(remote).length],[1,before-1],'انحذفت من الـ Storage بعد رجوع النت');
nav.onLine=false;
await run(`fieldAddPhotos('k1','v1',[{name:'tmp.jpg'}])`).catch(()=>{});
// الزيارة ممتلئة بعد الحذف؟ 11 → بتقبل وحدة
eq(v1().photos.length,12,'بعد الحذف قبلت صورة جديدة');
const tmp=v1().photos[11];
await run(`fieldRemovePhoto('k1','v1','${tmp.id}')`);
eq(await run(`fieldPending()`),0,'صورة ما انرفعت أصلاً وانحذفت: ما بيضل شي بالطابور');
nav.onLine=true;const uBefore=uploads;await run(`fieldSync()`);eq(uploads,uBefore,'وما انرفع شي');

section('T42 — صورة انحذفت من الزيارة وهي بالطابور');
nav.onLine=false;
await run(`fieldAddPhotos('k1','v1',[{name:'ghost.jpg'}])`).catch(e=>alerts.push(e.message));
// الزيارة 12 → احذف وحدة أولاً
run(`db.contracts[0].visits[0].photos.shift()`);
await run(`fieldAddPhotos('k1','v1',[{name:'ghost.jpg'}])`);
const ghost=v1().photos[v1().photos.length-1];
run(`db.contracts[0].visits[0].photos=db.contracts[0].visits[0].photos.filter(p=>p.id!=='${ghost.id}')`); // انحذفت من البيانات مباشرة (مثلاً دمج من جهاز تاني)
nav.onLine=true;const u2=uploads;r=await run(`fieldSync()`);
ok(!Object.keys(remote).some(k=>k.includes(ghost.id)),'ما انرفعت صورة ما إلها وجود بالزيارة');
eq(await run(`fieldPending()`),0,'وانمسحت من الطابور');

section('T42 — الصلاحيات');
run(`db.security={enabled:true,users:[{id:'a',username:'admin',role:'admin'},{id:'t1',username:'فني',role:'user',ownVisitsOnly:true,workerId:'w1'}]}`);
store['security_mask_user']='t1';
let e1=null;await run(`fieldAddPhotos('k1','v2',[{name:'no.jpg'}])`).catch(e=>e1=e.message);
ok(e1&&/مسندة/.test(e1),'ما بيقدر يضيف صورة لزيارة فني تاني');
let e2=null;await run(`fieldAddPhotos('k1','v3',[{name:'no.jpg'}])`).catch(e=>e2=e.message);
ok(e2&&/ملغاة/.test(e2),'ما بينضاف صور لزيارة ملغاة');
eq(await run(`fieldRemovePhoto('k1','v2','x')`),false,'ولا حذف من زيارة غيره');
r=await run(`fieldAddPhotos('k1','v1',[{name:'own.jpg'}])`).catch(e=>({err:e.message}));
ok(r.added===1||/12|حد/.test(JSON.stringify(r)),'بيقدر يضيف لزيارته',r);
run(`db.security.enabled=false`);

section('T42 — واجهة الورقة والصفحة');
run(`db.contracts[0].visits[0].photos=db.contracts[0].visits[0].photos.slice(0,3)`);
const h=run(`fieldPhotosHTML(db.contracts[0].visits[0],false)`);
ok(/صور الزيارة \(3\/12\)/.test(h)&&/vs-photo-in/.test(h)&&/fieldUiRemove/.test(h),'قسم الصور: العدّاد وخانة الإضافة وزر الحذف');
const hl=run(`fieldPhotosHTML(db.contracts[0].visits[0],true)`);
ok(!/vs-photo-in/.test(hl)&&!/fieldUiRemove/.test(hl),'زيارة مقفلة: بدون إضافة/حذف');
run(`window._modal='';showModal=function(h){window._modal=h;}`);
run(`window._vsCid='k1';window._vsVid='v1';openVisitSheet('k1','v1')`);
ok(/vs-photos/.test(run(`_modal`)),'ورقة الزيارة (contracts.js) فيها قسم الصور');
run(`db.security={enabled:true,users:[{id:'a',username:'admin',role:'admin'},{id:'t1',username:'فني',role:'user',ownVisitsOnly:true,workerId:'w1'}]}`);
store['security_mask_user']='t1';
run(`db.contracts[0].visits[0].date=db.contracts[0].visits[0].slotDate=localToday();db.contracts[0].visits[0].status='scheduled'`);
run(`window._el={};renderMyVisits(_el,{})`);
ok(/my-field-banner/.test(run(`_el.innerHTML`))&&/myVisitSheet/.test(run(`_el.innerHTML`)),'زياراتي: مؤشر الحالة وزر الورقة');
let thr=null;try{run(`currentPage='myvisits';ctRerender()`);}catch(e){thr=e;}
ok(!thr,'إغلاق الورقة من زياراتي بيرجع لزياراتي (ctRerender)',thr&&thr.message);
ok(run(`_bundleDeps.contracts.includes('field')&&_bundleDeps.myvisits.includes('field')&&_bundleFiles.field==='field.js'`),'field.js بيتحمّل مع العقود وزياراتي');
ok(run(`window.__fieldBound===true`),'مستمعات online/offline مربوطة');

console.log('\n'+(fail?'❌':'✅')+' نجح '+pass+' / فشل '+fail);process.exit(fail?1:0);
})();
