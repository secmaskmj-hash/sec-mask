/* اختبارات المرحلة 4 / الجزء 1: T18 جداول السحابة (store.js) + الربط بمزامنة core.js
   التشغيل: node tests/store.test.js  (جرّبه كمان مع TZ=Asia/Riyadh و TZ=America/Los_Angeles)
   بيستعمل Supabase وهمي بالذاكرة — بيدعم select/eq/in/order/range/upsert/delete/insert/update/maybeSingle. */
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..');
const SM=require(path.join(root,'store.js'));
let pass=0,fail=0;
function ok(c,name,extra){if(c){pass++;console.log('  ✓ '+name);}else{fail++;console.log('  ✗ '+name+(extra!==undefined?'  → '+JSON.stringify(extra):''));}}
function eq(a,b,name){ok(JSON.stringify(a)===JSON.stringify(b),name,{got:a,expected:b});}
function section(t){console.log('\n'+t);}

/* ---- Supabase وهمي ---- */
function mkSB(){
  const T={};const log={upserts:0,deletes:0,calls:[]};
  const tbl=n=>T[n]=T[n]||[];
  function Q(name){
    const f=[];let op='select',payload=null,ord=null,rng=null,single=false,wantSel=false,opts=null;
    const q={
      select(){if(op==='select')op='select';wantSel=true;return q;},
      eq(k,v){f.push(r=>r[k]===v);return q;},is(k,v){f.push(r=>r[k]==null);return q;},
      in(k,vs){f.push(r=>vs.includes(r[k]));return q;},
      order(k){ord=k;return q;},range(a,b){rng=[a,b];return q;},maybeSingle(){single=true;return q;},
      upsert(rows,o){op='upsert';payload=rows;opts=o;return q;},insert(rows){op='insert';payload=rows;return q;},
      update(p){op='update';payload=p;return q;},delete(){op='delete';return q;},
      then(res,rej){return Promise.resolve().then(run).then(res,rej);}
    };
    function run(){
      const t=tbl(name);log.calls.push(name+':'+op);
      if(op==='select'){let r=t.filter(x=>f.every(g=>g(x)));if(ord)r=r.slice().sort((a,b)=>a[ord]<b[ord]?-1:a[ord]>b[ord]?1:0);
        if(rng)r=r.slice(rng[0],rng[1]+1);r=JSON.parse(JSON.stringify(r));return {data:single?(r[0]||null):r,error:null};}
      if(op==='upsert'){log.upserts+=payload.length;payload.forEach(p=>{p=JSON.parse(JSON.stringify(p));const i=t.findIndex(x=>x.tenant_code===p.tenant_code&&x.id===p.id);if(i>=0)t[i]=p;else t.push(p);});return {data:null,error:null};}
      if(op==='insert'){const rows=Array.isArray(payload)?payload:[payload];rows.forEach(p=>t.push(JSON.parse(JSON.stringify(p))));return {data:rows,error:null};}
      if(op==='update'){const m=t.filter(x=>f.every(g=>g(x)));m.forEach(x=>Object.assign(x,payload));return {data:m.map(x=>({...x})),error:null};}
      if(op==='delete'){const keep=t.filter(x=>!f.every(g=>g(x)));log.deletes+=t.length-keep.length;T[name]=keep;return {data:null,error:null};}
    }
    return q;
  }
  const sb={from:Q,T,log,channel(){const c={on(){return c;},subscribe(){return c;}};return c;},auth:{}};
  return sb;
}

/* ---- بيانات تجريبية صعبة ---- */
function sampleDb(){
  return {
    settings:{exchangeRate:15000},
    maintenance:[
      {id:'m1',name:'صيانة ١',payments:[{id:'p1',amount:100,currency:'USD',date:'2027-01-31',note:'دفعة أولى'},{id:'p2',amount:50.25,currency:'USD',date:'2027-02-01',discount:5}]},
      {id:'m2',name:'بدون دفعات',payments:[]},
      {id:'m3',name:'بدون حقل'},
      {name:'بدون id',payments:[{id:'x',amount:7,currency:'SYP'}]}
    ],
    sales:[{id:'s1',payments:[{id:'a',amount:10},{id:'a',amount:20}]}], // id مكرر داخل نفس المصفوفة
    contracts:[{id:'c1',payments:[{id:'cp1',amount:300,currency:'USD',date:'2027-01-01'}],visits:[{id:'v1',slotDate:'2027-02-28',status:'done'},{id:'v2',slotDate:'2027-03-31',status:'scheduled'}]},
               {id:'c2',visits:[]}],
    suppliers:[{id:'sp1',purchases:[{id:'pu1',payments:[{id:'q1',amount:40,currency:'USD'}]},{id:'pu2',payments:[]}]},{name:'بدون id',purchases:[{payments:[{id:'z',amount:1}]}]}],
    wallet:{balance:5,entries:[{id:'w1',amount:25,currency:'USD',date:'2027-01-05',note:'سحب'},{id:'w2',amount:-5,date:'2027-01-06'}]},
    workerPayments:[{id:'wp1',amount:200,currency:'USD',date:'2027-01-09'}],
    activityLog:[{id:'l1',time:1700000000000,action:'تسجيل'},{id:'l2',time:1700000001000,action:'خروج'}],
    clients:[{id:'cl1',name:'بنك الشام'}]
  };
}
const clone=o=>JSON.parse(JSON.stringify(o));
const jsonbRoundTrip=o=>{ // jsonb بيرتّب المفاتيح — منقلّده
  const sortKeys=v=>Array.isArray(v)?v.map(sortKeys):(v&&typeof v==='object')?Object.keys(v).sort().reduce((a,k)=>(a[k]=sortKeys(v[k]),a),{}):v;return sortKeys(o);};

(async()=>{
section('T18 — استخراج ثم إرجاع = الأصل بالضبط');
const db=sampleDb();
const ex=SM.extract(db,111,'T1');
ok(ex.slim.maintenance[0].payments.length===0,'البلوب الخفيف ما فيه دفعات');
ok(Array.isArray(ex.slim.maintenance[0].payments),'الحقل بيضل مصفوفة فاضية (مش محذوف)');
ok(!('payments' in ex.slim.maintenance[2]),'اللي ما كان عنده حقل ما بينضاف إله حقل');
ok(ex.slim._sm&&ex.slim._sm.v===1,'علامة _sm موجودة');
eq(ex.tables.sm_payments.length,8,'عدد صفوف الدفعات (صيانة 2+1، مبيعات 2، عقد 1، مورد 1+1)');
eq(ex.tables.sm_visits.length,2,'صفّين زيارات');
eq(ex.tables.sm_wallet.length,2,'حركتين محفظة');
const back=SM.hydrate(clone(ex.slim),ex.tables);
eq(SM.stable(back),SM.stable(db),'الإرجاع مطابق للأصل (بما فيها id مكرر وبدون id)');
ok(!('_sm' in back),'_sm انحذفت بعد الإرجاع');
eq(db,sampleDb(),'extract ما عدّل الأصل');
const ids=ex.tables.sm_payments.map(r=>r.id);
eq(ids.length,new Set(ids).size,'كل id صف فريد حتى مع id مكرر');

section('T18 — فحص قبل = بعد');
let v=SM.verify(db,back);ok(v.ok,'verify ناجح',v.diffs);
const tampered=clone(back);tampered.maintenance[0].payments[0].amount=101;
v=SM.verify(db,tampered);ok(!v.ok&&v.diffs.includes('sum:sm_payments'),'تغيير مبلغ بيانمسك (مجموع)',v.diffs);
const tampered2=clone(back);tampered2.maintenance[0].payments.pop();
v=SM.verify(db,tampered2);ok(!v.ok&&v.diffs.includes('count:sm_payments'),'حذف دفعة بينمسك (عدد)',v.diffs);
const tampered3=clone(back);tampered3.maintenance[0].payments[0].note='غيرت';
v=SM.verify(db,tampered3);ok(!v.ok&&v.diffs.includes('hash'),'تغيير نص بس بينمسك (بصمة)',v.diffs);

section('T18 — دفع بالفرق وقراءة من السحابة');
let sb=mkSB();let st={hashes:null};
let r=await SM.pushRows(sb,'T1',SM.extract(db,1,'T1'),st);
eq(r.up,ex.tables.sm_payments.length+2+2+1+2+0+0,'أول دفعة: كل الصفوف');
ok(sb.T.sm_payments.every(x=>x.tenant_code==='T1'),'كل صف عليه tenant_code');
r=await SM.pushRows(sb,'T1',SM.extract(db,2,'T1'),st);
eq([r.up,r.del],[0,0],'بدون تغيير: ولا كتابة');
const db2=clone(db);db2.maintenance[0].payments[1].amount=60;
r=await SM.pushRows(sb,'T1',SM.extract(db2,3,'T1'),st);
eq([r.up,r.del],[1,0],'تغيير دفعة وحدة = upsert واحد');
const db3=clone(db2);db3.maintenance[0].payments.splice(0,1);
r=await SM.pushRows(sb,'T1',SM.extract(db3,4,'T1'),st);
ok(r.del>=1,'حذف دفعة = delete');
const db4=clone(db3);db4.contracts[0].visits.reverse();
r=await SM.pushRows(sb,'T1',SM.extract(db4,5,'T1'),st);
ok(r.up>=2,'تبديل ترتيب الزيارات بينكتب',r);
const ex4=SM.extract(db4,5,'T1');
let full=await SM.pull(sb,'T1',clone(ex4.slim),{});
eq(SM.stable(full),SM.stable(db4),'pull بيرجع النسخة الأخيرة كاملة');
// jsonb بيرتّب المفاتيح — لازم ما يأثر
sb.T.sm_payments.forEach(x=>x.data=jsonbRoundTrip(x.data));
full=await SM.pull(sb,'T1',clone(ex4.slim),{});
eq(SM.stable(full),SM.stable(db4),'ترتيب مفاتيح jsonb ما بيأثر');
// جهاز تاني بدأ من state فاضي: لازم يجيب الفرق صح
let st2={hashes:null};
r=await SM.pushRows(sb,'T1',SM.extract(db4,6,'T1'),st2);
eq([r.up,r.del],[0,0],'state فاضي: بيقارن مع السحابة وما بيعيد كتابة شي');

section('T18 — البصمة: ما منعتمد بيانات ناقصة');
const exX=SM.extract(db4,7,'T1');
sb.T.sm_payments.pop();
let err=null;try{await SM.pull(sb,'T1',clone(exX.slim),{});}catch(e){err=e;}
ok(err&&err.smNotReady,'صف ناقص → SM_NOT_READY (القارئ بيستنى ما بيعرض ناقص)');
const sbB=mkSB();
err=null;try{await SM.pull(sbB,'T1',clone(exX.slim),{});}catch(e){err=e;}
ok(err&&err.smNotReady,'جداول فاضية والبلوب خفيف → ما بيمرق');

section('T18 — عزل الشركات (tenant)');
const sbT=mkSB();
await SM.pushRows(sbT,'A',SM.extract(db,1,'A'),{});
await SM.pushRows(sbT,'B',SM.extract(db4,1,'B'),{});
const fa=await SM.pull(sbT,'A',clone(SM.extract(db,1,'A').slim),{});
eq(SM.stable(fa),SM.stable(db),'tenant A ما بيشوف بيانات B');
await SM.clearRows(sbT,'A');
ok(sbT.T.sm_payments.every(x=>x.tenant_code==='B')&&sbT.T.sm_payments.length>0,'clearRows بيمسح tenant واحد بس');

section('T18 — حجم كبير (ترقيم الصفحات + أجزاء الكتابة)');
const big=sampleDb();
big.activityLog=Array.from({length:2500},(_,i)=>({id:'a'+i,time:i,action:'x'+i}));
big.workerPayments=Array.from({length:1200},(_,i)=>({id:'w'+i,amount:i%7+0.25,currency:'USD',date:'2027-01-01'}));
const sbG=mkSB();const exG=SM.extract(big,9,'T1');
await SM.pushRows(sbG,'T1',exG,{});
const fullG=await SM.pull(sbG,'T1',clone(exG.slim),{});
eq(SM.stable(fullG),SM.stable(big),'2500 + 1200 صف: رجعوا كلهم بنفس الترتيب');
ok(JSON.stringify(exG.slim).length<JSON.stringify(big).length/3,'البلوب الخفيف أصغر بكتير',[JSON.stringify(exG.slim).length,JSON.stringify(big).length]);

section('T18 — migrate (كتابة ← قراءة ← مقارنة)');
const sbM=mkSB();const stM={hashes:null};
const mv=await SM.migrate(sbM,'T1',db,stM);
ok(mv.ok,'migrate ناجح على بيانات الاختبار',mv.diffs);
eq(mv.before.counts,mv.after.counts,'العدد قبل = بعد');
eq(mv.before.sums,mv.after.sums,'المجاميع قبل = بعد');
// فشل كتابة أثناء الهجرة: ما بيعتبرها ناجحة
const sbF=mkSB();const origFrom=sbF.from;
sbF.from=n=>{const q=origFrom(n);if(n==='sm_visits'){q.upsert=()=>({then:(a,b)=>Promise.resolve({error:{message:'denied'}}).then(a,b)});}return q;};
err=null;try{await SM.migrate(sbF,'T1',db,{hashes:null});}catch(e){err=e;}
ok(err,'رفض RLS/كتابة بيوقف الهجرة بخطأ (ما بيفعّل)');

section('T18 — ربط core.js: دفع خفيف + قراءة كاملة');
function mkProxy(n){const f=function(){return mkProxy(n+'()');};return new Proxy(f,{get:(t,k)=>{if(k===Symbol.toPrimitive)return()=>'';if(k==='then')return undefined;return mkProxy(n+'.'+String(k));},apply:()=>mkProxy(n+'()')});}
const lsStore={};const fsb=mkSB();
const ctx={console:{log(){},error(){},warn(){}},Math,Date,JSON,Number,String,Object,Array,RegExp,isFinite,isNaN,parseFloat,parseInt,Promise,Set,Map,Symbol,Error,Intl,Blob,
 setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,
 localStorage:{getItem:k=>lsStore[k]??null,setItem:(k,v)=>{lsStore[k]=String(v);},removeItem:k=>{delete lsStore[k];}},
 document:mkProxy('document'),navigator:{userAgent:'node',onLine:true},location:{href:'',hash:'',search:''},
 addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),getComputedStyle:()=>({getPropertyValue:()=>''}),
 fetch:()=>Promise.reject(new Error('no net')),alert(){},confirm:()=>true,prompt:()=>null,requestAnimationFrame:()=>0,structuredClone:x=>JSON.parse(JSON.stringify(x))};
ctx.sessionStorage=ctx.localStorage;ctx.supabase={createClient:()=>fsb};ctx.window=ctx;ctx.self=ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'core.js'),'utf8'),ctx,{filename:'core.js'});
vm.runInContext(fs.readFileSync(path.join(root,'store.js'),'utf8'),ctx,{filename:'store.js'});
const run=c=>vm.runInContext(c,ctx);
ok(typeof run('hydrateRow')==='function','hydrateRow موجودة بـ core.js');
ok(run('typeof SM')==='object','SM محمّل بنفس السياق');
const tenant=run('TENANT_CODE');
ctx.__src=sampleDb();
run('Object.assign(db,__src)');
run('db.settings.cloudTables=true');
run('_initialSyncReady=true;_conflictDetected=false;_pushInFlight=false;_knownRemoteUpdatedAt=null');
run('doPushToCloud(db)');
await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));await new Promise(r=>setTimeout?setImmediate(r):r());
await new Promise(r=>setImmediate(r));
const row=fsb.T.companies&&fsb.T.companies[0];
ok(!!row,'صف companies انكتب');
const blob=row?JSON.parse(row.data):null;
ok(blob&&blob._sm&&blob.maintenance[0].payments.length===0,'البلوب بالسحابة خفيف (فيه _sm وبدون دفعات)');
ok(fsb.T.sm_payments&&fsb.T.sm_payments.length>0,'صفوف الدفعات انكتبت بجدولها');
// قراءة: fetchCloudRow لازم يرجّع كامل
const got=await run('fetchCloudRow()');
const fullDb=JSON.parse(got.data);
ok(!('_sm' in fullDb),'fetchCloudRow رجّع نسخة كاملة (بدون _sm)');
eq(fullDb.maintenance[0].payments.length,2,'الدفعات رجعت بمكانها');
eq(fullDb.contracts[0].visits.map(x=>x.id),['v1','v2'],'الزيارات رجعت بترتيبها');
eq(run('_syncBaseJson')===JSON.stringify(run('db')),true,'أساس الدمج (_syncBaseJson) = النسخة الكاملة مش الخفيفة');
// الميزة مطفية → بلوب كامل
run('db.settings.cloudTables=false;_pushInFlight=false');
fsb.T.companies.length=0;run('_knownRemoteUpdatedAt=null;doPushToCloud(db)');
await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
const row2=fsb.T.companies[0];
ok(row2&&!('_sm' in JSON.parse(row2.data))&&JSON.parse(row2.data).maintenance[0].payments.length===2,'الميزة مطفية → بلوب كامل متل قبل');

console.log('\n'+(fail?'❌':'✅')+' نجح '+pass+' / فشل '+fail);
process.exit(fail?1:0);
})();
