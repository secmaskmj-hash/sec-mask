/* ====================================================================
   store.js — T18: نقل الجداول الكبيرة (دفعات، زيارات، حركات محفظة،
   دفعات عمال، سجل النشاط) من البلوب الواحد (companies.data) إلى جداول
   حقيقية بالسحابة مع RLS.

   المبادئ (مقصودة ومحافظة):
   1) localStorage بيضل فيه نسخة كاملة متل ما كان. بس تمثيل السحابة هو اللي بيتغيّر.
   2) الجدول companies بيضل هو "البوابة" (التزامن المتفائل updated_at + دمج T11).
      البلوب الخفيف بيحمل بصمة (digest) لكل جدول؛ القارئ بيتأكد منها قبل ما يعتمد البيانات.
      إذا الصفوف لسا ما وصلت (digest ما بيطابق) → ما بيطبّق شي وبيعيد المحاولة، بدل ما يعرض بيانات ناقصة.
   3) الكتابة بالفرق فقط (hash لكل صف): صف تغيّر = upsert، صف انحذف = delete.
   4) الميزة مطفية افتراضياً (db.settings.cloudTables). التفعيل بس بعد فحص "قبل = بعد" ناجح،
      والتراجع متاح، والبلوب الأصلي ما بينلمس لحد أول دفعة بعد التفعيل (والنسخ الاحتياطية دايماً كاملة).
   ==================================================================== */
(function(root){
'use strict';
var SM_VERSION=1;
var PAGE=1000, UP_CHUNK=400, DEL_CHUNK=150;

/* ---------- أدوات ---------- */
function stable(v){
  if(v===null||typeof v!=='object')return JSON.stringify(v===undefined?null:v);
  if(Array.isArray(v))return '['+v.map(stable).join(',')+']';
  var ks=Object.keys(v).filter(function(k){return v[k]!==undefined;}).sort();
  return '{'+ks.map(function(k){return JSON.stringify(k)+':'+stable(v[k]);}).join(',')+'}';
}
function hash(str){ // cyrb53
  var h1=0xdeadbeef,h2=0x41c6ce57;
  for(var i=0;i<str.length;i++){var ch=str.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (4294967296*(2097151&h2)+(h1>>>0)).toString(16);
}
function isObj(o){return o&&typeof o==='object'&&!Array.isArray(o);}

/* ---------- تعريف المجموعات: مين الحاملين (holders) لكل مصفوفة ---------- */
function keyOf(o,i){return (o&&o.id!=null)?String(o.id):'#'+i;}
function uniq(out,key){var k=key,n=1;while(out.seen[k]){k=key+'~'+(n++);}out.seen[k]=1;return k;}
function listHolders(db,spec){
  var out=[];out.seen={};
  spec.sources(db).forEach(function(s){
    if(isObj(s.obj)&&Array.isArray(s.obj[spec.field]))out.push({key:uniq(out,s.key),obj:s.obj});
  });
  return out;
}
function arrSrc(db,name,prefix){
  return (Array.isArray(db[name])?db[name]:[]).map(function(o,i){return {key:prefix+':'+keyOf(o,i),obj:o};});
}
var COLLECTIONS=[
  {table:'sm_payments',field:'payments',sources:function(db){
    var s=[].concat(arrSrc(db,'maintenance','m'),arrSrc(db,'sales','s'),arrSrc(db,'contracts','c'));
    (Array.isArray(db.suppliers)?db.suppliers:[]).forEach(function(sup,i){
      var sk=keyOf(sup,i);
      ((sup&&Array.isArray(sup.purchases))?sup.purchases:[]).forEach(function(pu,j){s.push({key:'p:'+sk+'/'+keyOf(pu,j),obj:pu});});
    });
    return s;}},
  {table:'sm_visits',field:'visits',sources:function(db){return arrSrc(db,'contracts','c');}},
  {table:'sm_wallet',field:'entries',sources:function(db){return [{key:'w',obj:db.wallet}];}},
  {table:'sm_workerpay',field:'workerPayments',sources:function(db){return [{key:'r',obj:db}];}},
  {table:'sm_activity',field:'activityLog',sources:function(db){return [{key:'r',obj:db}];}}
];
var TABLES=COLLECTIONS.map(function(c){return c.table;});

/* ---------- صف ---------- */
function pickDate(it){
  if(!isObj(it))return null;
  var v=it.date||it.slotDate||it.doneDate||it.createdAt||it.time||it.ts||it.at;
  return v==null?null:String(v).slice(0,40);
}
function mkRow(tenant,holderKey,seq,item,used,rev){
  var base=keyOf(item,seq),k=base,n=1;
  while(used[k]){k=base+'~'+(n++);}used[k]=1;
  var amt=isObj(item)&&item.amount!=null?Number(item.amount):NaN;
  return {tenant_code:tenant,id:holderKey+'|'+k,parent:holderKey,seq:seq,
    d:pickDate(item),amount:isFinite(amt)?amt:null,cur:isObj(item)&&item.currency!=null?String(item.currency):null,
    status:isObj(item)&&item.status!=null?String(item.status):null,
    data:item,rev:rev,h:hash(seq+'|'+stable(item))};
}
function digestOf(rows){
  var ids=rows.map(function(r){return r.id+':'+r.h;}).sort();
  return {n:rows.length,h:hash(ids.join('\n'))};
}

/* ---------- استخراج: db كامل → بلوب خفيف + صفوف ---------- */
function extract(db,rev,tenant){
  var slim=JSON.parse(JSON.stringify(db));
  var tables={},digest={};
  COLLECTIONS.forEach(function(spec){
    var rows=[];
    listHolders(slim,spec).forEach(function(h){
      var arr=h.obj[spec.field],used={};
      arr.forEach(function(it,i){rows.push(mkRow(tenant||null,h.key,i,it,used,rev));});
      h.obj[spec.field]=[];
    });
    tables[spec.table]=rows;digest[spec.table]=digestOf(rows);
  });
  slim._sm={v:SM_VERSION,rev:rev,digest:digest};
  return {slim:slim,tables:tables,digest:digest,rev:rev};
}

/* ---------- إرجاع: بلوب خفيف + صفوف → db كامل ---------- */
function hydrate(slim,tables){
  var db=slim,orphans=0;
  COLLECTIONS.forEach(function(spec){
    var rows=(tables[spec.table]||[]).slice().sort(function(a,b){return a.seq-b.seq;});
    var byParent={};rows.forEach(function(r){(byParent[r.parent]=byParent[r.parent]||[]).push(r);});
    var holders=listHolders(db,spec),seen={};
    holders.forEach(function(h){seen[h.key]=1;if(byParent[h.key])h.obj[spec.field]=byParent[h.key].map(function(r){return r.data;});});
    Object.keys(byParent).forEach(function(k){if(!seen[k])orphans+=byParent[k].length;});
  });
  if(orphans)throw new Error('SM_ORPHANS:'+orphans);
  delete db._sm;
  return db;
}
function isSlim(o){return !!(o&&typeof o==='object'&&o._sm&&o._sm.v);}

/* ---------- قراءة من السحابة ---------- */
function fetchAll(sb,table,tenant,cols){
  var out=[];
  function page(from){
    return sb.from(table).select(cols).eq('tenant_code',tenant).order('id',{ascending:true}).range(from,from+PAGE-1).then(function(res){
      if(res.error)throw res.error;
      var d=res.data||[];out=out.concat(d);
      return d.length===PAGE?page(from+PAGE):out;
    });
  }
  return page(0);
}
/* بيجيب الصفوف، بيتحقق من البصمة، وبيرجّع db كامل. state.hashes بيتحدّث ليصير الفرق صحيح. */
function pull(sb,tenant,slim,state){
  var tables={};
  return Promise.all(TABLES.map(function(t){
    return fetchAll(sb,t,tenant,'id,parent,seq,data,rev').then(function(rows){
      rows=rows.map(function(r){r.h=hash(r.seq+'|'+stable(r.data));return r;});
      tables[t]=rows;
    });
  })).then(function(){
    var want=slim._sm.digest;
    for(var i=0;i<TABLES.length;i++){
      var t=TABLES[i],got=digestOf(tables[t]),w=want[t]||{n:0,h:digestOf([]).h};
      if(got.n!==w.n||got.h!==w.h){var e=new Error('SM_NOT_READY:'+t);e.smNotReady=true;throw e;}
    }
    if(state){state.hashes={};TABLES.forEach(function(t){var m={};tables[t].forEach(function(r){m[r.id]=r.h;});state.hashes[t]=m;});}
    return hydrate(slim,tables);
  });
}

/* ---------- كتابة بالفرق ---------- */
function chunks(a,n){var o=[];for(var i=0;i<a.length;i+=n)o.push(a.slice(i,i+n));return o;}
function seqRun(fns){return fns.reduce(function(p,f){return p.then(f);},Promise.resolve());}
function remoteHashes(sb,tenant,table){
  return fetchAll(sb,table,tenant,'id,seq,data').then(function(rows){
    var m={};rows.forEach(function(r){m[r.id]=hash(r.seq+'|'+stable(r.data));});return m;});
}
function pushRows(sb,tenant,ex,state){
  state=state||{};state.hashes=state.hashes||{};
  var stats={up:0,del:0};
  return seqRun(TABLES.map(function(t){return function(){
    var known=state.hashes[t]?Promise.resolve(state.hashes[t]):remoteHashes(sb,tenant,t);
    return known.then(function(kn){
      var rows=ex.tables[t],cur={},up=[],del=[];
      rows.forEach(function(r){r.tenant_code=tenant;cur[r.id]=r.h;if(kn[r.id]!==r.h)up.push(r);});
      Object.keys(kn).forEach(function(id){if(cur[id]===undefined)del.push(id);});
      return seqRun(chunks(up,UP_CHUNK).map(function(c){return function(){
        return sb.from(t).upsert(c,{onConflict:'tenant_code,id'}).then(function(res){if(res&&res.error)throw res.error;});};}))
      .then(function(){return seqRun(chunks(del,DEL_CHUNK).map(function(c){return function(){
        return sb.from(t).delete().eq('tenant_code',tenant).in('id',c).then(function(res){if(res&&res.error)throw res.error;});};}));})
      .then(function(){state.hashes[t]=cur;stats.up+=up.length;stats.del+=del.length;});
    });
  };})).then(function(){return stats;});
}
function clearRows(sb,tenant){
  return seqRun(TABLES.map(function(t){return function(){
    return sb.from(t).delete().eq('tenant_code',tenant).then(function(res){if(res&&res.error)throw res.error;});};}));
}

/* ---------- فحص قبل = بعد ---------- */
function stats(db){
  var out={hash:hash(stable(db)),counts:{},sums:{}};
  COLLECTIONS.forEach(function(spec){
    var n=0,sum=0;
    listHolders(db,spec).forEach(function(h){h.obj[spec.field].forEach(function(it){n++;var a=isObj(it)?Number(it.amount):NaN;if(isFinite(a))sum+=a;});});
    out.counts[spec.table]=n;out.sums[spec.table]=Math.round(sum*100)/100;
  });
  return out;
}
function verify(before,after){
  var a=stats(before),b=stats(after),diffs=[];
  if(a.hash!==b.hash)diffs.push('hash');
  TABLES.forEach(function(t){
    if(a.counts[t]!==b.counts[t])diffs.push('count:'+t);
    if(a.sums[t]!==b.sums[t])diffs.push('sum:'+t);
  });
  return {ok:diffs.length===0,diffs:diffs,before:a,after:b};
}

/* ---------- ترحيل (آمن): كتابة الصفوف → قراءتها → مقارنة بالأصل ---------- */
function migrate(sb,tenant,db,state){
  var rev=Date.now(),ex=extract(db,rev,tenant);
  return pushRows(sb,tenant,ex,state).then(function(st){
    var slim=JSON.parse(JSON.stringify(ex.slim));
    return pull(sb,tenant,slim,state).then(function(back){
      var v=verify(db,back);v.pushed=st;v.rev=rev;return v;
    });
  });
}

var api={VERSION:SM_VERSION,TABLES:TABLES,COLLECTIONS:COLLECTIONS,extract:extract,hydrate:hydrate,isSlim:isSlim,pull:pull,pushRows:pushRows,
  clearRows:clearRows,verify:verify,stats:stats,migrate:migrate,hash:hash,stable:stable,state:{hashes:null}};
root.SM=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
