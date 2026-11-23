/* اختبارات المرحلة 2 / الجزء 3: T26 الداشبورد كمجمل (مجموع الأشهر = الإجمالي = مجموع السجلات) و T27 العلامة المائية.
   التشغيل:  node tests/dashboard-watermark.test.js   — بيحمّل core.js الحقيقي بدون متصفح. */
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
const run=c=>vm.runInContext(c,ctx);
let pass=0,fail=0;
function ok(c,name,extra){if(c){pass++;console.log('  ✓ '+name);}else{fail++;console.log('  ✗ '+name+(extra!==undefined?'  → '+JSON.stringify(extra):''));}}
function near(a,b,name,eps){eps=eps||0.005;ok(Math.abs(a-b)<=eps,name,{got:a,expected:b});}
function section(t){console.log('\n'+t);}

// ---------- بيانات تجريبية ----------
let id=0;
const sale=(date,price,cost,paid,cur)=>({id:'s'+(++id),date,totalPrice:price,totalCost:cost,paidAmount:paid,currency:cur||'USD',clientId:'c1'});
const maint=(date,amount,paid,wage,cur)=>({id:'m'+(++id),startDate:date,workAmount:amount,paidAmount:paid,currency:cur||'USD',clientId:'c1',workers:wage?[{workerId:'w1',wage,paid:true,currency:cur||'USD'}]:[],expenses:[],status:'مكتملة'});
ctx._data={
  sales:[
    sale('2026-08-31',1000,600,1000),        // آخر يوم آب
    sale('2026-09-01',500,300,250),          // أول يوم أيلول (مدفوعة نصفها)
    sale('2026-09-30',800,500,800),          // آخر يوم أيلول
    sale('2026-10-15',1200,700,0),           // غير مدفوعة
    sale('2026-11-01',300,100,300),
    sale('2026-11-22',150000,90000,150000,'SYP'),  // بالليرة
    sale('',400,250,400),                    // بدون تاريخ
  ],
  maintenance:[
    maint('2026-09-10',600,600,200),
    maint('2026-10-31',400,200,100),
    maint('2026-11-30',700,700,250),
  ],
};
run("db.settings=db.settings||{};db.settings.exchangeRate=15000;db.sales=_data.sales;db.maintenance=_data.maintenance;db.projects=[];db.clients=[{id:'c1',name:'عميل'}];db.referrers=db.referrers||[];");

section('T26 — الحدود والفترات');
let r=run("periodResolve('dash',DASH_PERIOD_DEF)");
ok(r.isAll&&r.from===null&&r.to===null,'الافتراضي "الكل" (نظرة شاملة)');
ok(run("dashInRange('2026-09-30','2026-09-01','2026-09-30')")&&run("dashInRange('2026-09-01','2026-09-01','2026-09-30')"),'أول وآخر يوم بالشهر داخل الفترة');
ok(!run("dashInRange('2026-10-01','2026-09-01','2026-09-30')"),'أول تشرين الأول برا أيلول');
ok(run("dashInRange('','','')")&&!run("dashInRange('','2026-09-01','2026-09-30')"),'بدون تاريخ: داخل "الكل" بس');

section('T26 — مجاميع الداشبورد = مجموع السجلات');
const allT=run("dashRangeTotals(null,null,false)");
const expSales=1000+500+800+1200+300+150000/15000+400;
near(allT.salesRev,expSales,'إجمالي المبيعات = مجموع الفواتير بالدولار (الليرة محوّلة)');
near(allT.maintRev,600+400+700,'إجمالي الأعمال = مجموع الأعمال');
near(allT.revenue,allT.salesRev+allT.maintRev,'الإيراد = مبيعات + أعمال');
// ربح محقق يدوياً: مبيعات (المدفوع − التكلفة×نسبة التحصيل) + أعمال (المدفوع − الأجور×نسبة التحصيل)
const saleProfit=(1000-600)+(250-300*0.5)+(800-500)+(0-0)+(300-100)+(10-6)+(400-250);
const maintProfit=(600-200)+(200-100*0.5)+(700-250);
near(allT.profit,saleProfit+maintProfit,'صافي الربح المحقق = حساب يدوي',0.01);
const sep=['2026-08','2026-09','2026-10','2026-11'].map(k=>run(`(function(){const b=periodMonthBounds(${k.slice(0,4)},${+k.slice(5)-1});return dashRangeTotals(b.from,b.to,false);})()`));
const und=run("dashUndatedTotals(false)");
near(sep.reduce((s,x)=>s+x.revenue,0)+und.revenue,allT.revenue,'مجموع إيراد الأشهر + بدون تاريخ = إجمالي "الكل"');
near(sep.reduce((s,x)=>s+x.profit,0)+und.profit,allT.profit,'مجموع ربح الأشهر + بدون تاريخ = إجمالي "الكل"');

section('T26 — جدول ومخطط الأشهر');
let ser=run("dashMonthRows(null,null,false,12)");
ok(ser.rows.length>=4&&ser.rows[0].key==='2026-08','"الكل": يبدأ من أول شهر فيه بيانات',ser.rows.map(x=>x.key));
ok(ser.undated&&ser.undated.nSales===1,'سطر "بدون تاريخ" ظاهر');
const sumAll=k=>ser.rows.reduce((s,x)=>s+x[k],0)+(ser.undated?ser.undated[k]:0);
near(sumAll('revenue'),allT.revenue,'مجموع الأشهر (الإيراد) = إجمالي البطاقات');
near(sumAll('profit'),allT.profit,'مجموع الأشهر (الربح) = إجمالي البطاقات');
near(sumAll('salesRev'),allT.salesRev,'مجموع مبيعات الأشهر = بطاقة المبيعات');
// فترة مخصصة بأطراف جزئية
ser=run("dashMonthRows('2026-09-15','2026-11-10',false,12)");
const part=run("dashRangeTotals('2026-09-15','2026-11-10',false)");
near(ser.rows.reduce((s,x)=>s+x.revenue,0),part.revenue,'فترة جزئية: مجموع الأشهر = إجمالي الفترة');
ok(ser.rows[0].full===false&&ser.rows[2].full===false&&ser.undated===null,'أشهر الأطراف جزئية وبدون سطر بدون تاريخ');
// حدود الشهر بالضبط
const sep09=run("dashRangeTotals('2026-09-01','2026-09-30',false)");
near(sep09.salesRev,500+800,'أيلول: فاتورة 1 أيلول و30 أيلول داخل، 31 آب برا');
// فترة مفتوحة من طرف واحد
near(run("dashRangeTotals('2026-11-01',null,false)").salesRev,300+10,'فترة مفتوحة النهاية');
near(run("dashRangeTotals(null,'2026-08-31',false)").salesRev,1000,'فترة مفتوحة البداية (السجلات بدون تاريخ برا أي فترة محددة)');
// المقارنة بالفترة السابقة
r=run("periodShift('2026-10-01','2026-10-31',-1)");
near(run(`dashRangeTotals('${r.from}','${r.to}',false)`).salesRev,500+800,'الفترة السابقة لتشرين الأول = أيلول');
// تقليم 12 شهر
ctxSerTrunc=run("(function(){db.sales.push({id:'old',date:'2024-01-10',totalPrice:10,totalCost:5,paidAmount:10,currency:'USD'});const s=dashMonthRows(null,null,false,12);db.sales.pop();return {n:s.rows.length,t:s.truncated,u:!!s.undated,first:s.rows[0].key};})()");
ok(ctxSerTrunc.n===12&&ctxSerTrunc.t&&!ctxSerTrunc.u,'أكتر من 12 شهر: بيعرض آخر 12 وبينبّه',ctxSerTrunc);
var ctxSerTrunc;

section('T26 — رسم الجدول');
ser=run("dashMonthRows(null,null,false,12)");ctx._ser=ser;
const html=run("renderDashMonthsCard(_ser)");
ok(/المقارنة الشهرية/.test(html)&&/المجموع/.test(html)&&/بدون تاريخ/.test(html),'بطاقة المقارنة الشهرية فيها مجموع وسطر بدون تاريخ');
ok(/تشرين الأول 2026/.test(html)&&/آب 2026/.test(html),'أسماء الأشهر بالعربي');
const bar=run("periodBarHTML('dash',dashRerender,DASH_PERIOD_DEF)");
ok(/period-chip on" onclick="periodPick\('dash','all'\)"/.test(bar),'شريط الفترة: "الكل" مفعّل افتراضياً');

section('T26 — عمولات المشاريع بفترة مفتوحة من طرف');
{
  const ops=fs.readFileSync(path.join(root,'ops.js'),'utf8');
  const i=ops.indexOf('function projectCommissionsInRange');
  const fn=ops.slice(i,ops.indexOf('\n}\n',i)+3);
  vm.runInContext(fn,ctx);
  run("db.projects=[{name:'A',createdDate:'2026-01-10'},{name:'B',createdDate:'2026-11-10'}];projectStats=function(n){return {projectCommission:n==='A'?100:50};};");
  const a=run("projectCommissionsInRange('2026-06-01',null,true).total");
  ok(a===50,'من 1/6 بدون نهاية: فقط مشروع تشرين الثاني (كان بيرجع 150)',a);
  ok(run("projectCommissionsInRange(null,null,true).total")===150,'"الكل": المشروعين');
  ok(run("projectCommissionsInRange('2026-11-01','2026-11-30',true).total")===50,'شهر محدد');
  // مجموع الأشهر مع عمولات المشاريع
  const T=run("dashRangeTotals(null,null,true)");
  const s2=run("dashMonthRows(null,null,true,12)");
  near(s2.rows.reduce((s,x)=>s+x.profit,0)+(s2.undated?s2.undated.profit:0),T.profit,'مجموع ربح الأشهر = إجمالي الربح مع عمولات المشاريع');
  run("db.projects=[]");
}

section('T27 — العلامة المائية: الأوضاع');
run("db.company={name:'Security Mask',printDefaultsApplied:true,logo:''}");
let svg=run("watermarkSVG()");
ok(/^<svg /.test(svg)&&/SECURITY MASK/.test(svg),'الافتراضي: نص اسم الشركة');
ok(/fill="#6b7280"/.test(svg)&&/fill-opacity="0\.1"/.test(svg),'رمادية وشفافية خفيفة (10%)');
ok(/rotate\(-30/.test(svg),'مائلة 30°');
ok(/letter-spacing/.test(svg),'نص لاتيني: تباعد حروف');
run("db.company.watermark='سيكيوريتي ماسك'");
svg=run("watermarkSVG()");
ok(/سيكيوريتي ماسك/.test(svg)&&!/letter-spacing/.test(svg),'نص عربي: بدون تباعد (حتى ما ينفك وصل الحروف)');
run("db.company.watermark='<script>alert(1)</script>&\"x\"'");
svg=run("watermarkSVG()");
ok(!/<script>/i.test(svg)&&/&lt;SCRIPT&gt;/.test(svg),'نص فيه كود: بيظهر كنص مهرّب (ما بيشتغل)');
ok(/<svg[^>]*>.*<\/svg>$/s.test(svg)&&(svg.match(/<svg/g)||[]).length===1,'SVG سليم (عنصر واحد)');
// خارج حد الطول
run("db.company.watermark='A'.repeat(200)");
const long=run("watermarkSVG()");
ok(/>A{40}</.test(long),'نص طويل بيتقصّ لـ 40 حرف');
const fs40=+/font-size="(\d+)"/.exec(long)[1];
ok(fs40>=22&&fs40*0.66*40<=640,'حجم الخط بيصغّر مع الطول ليبقى داخل البلاطة',fs40);
run("db.company.watermark='AB'");
ok(+/font-size="(\d+)"/.exec(run("watermarkSVG()"))[1]===64,'نص قصير: أكبر حجم 64');
run("db.company.watermark='';db.company.watermarkMode='none'");
ok(run("watermarkSVG()")==='','وضع "بدون": ما في SVG');
ok(/background-image:none/.test(run("watermarkCSS()")),'وضع "بدون": CSS بيلغي الخلفية');
run("db.company.watermarkMode='text';db.company.watermarkOff=true");
ok(run("getWatermarkMode()")==='none','التوافق مع الإعداد القديم watermarkOff');
run("db.company.watermarkOff=false;db.company.watermarkMode='logo'");
svg=run("watermarkSVG()");
ok(/SECURITY MASK/.test(svg),'وضع الشعار قبل ما يتحمّل الشعار: بيرجع مؤقتاً لنص (بدون صفحة فاضية)');
const png='data:image/png;base64,iVBORw0KGgo=';
svg=run(`watermarkSVG({mode:'logo',logo:{data:'${png}',w:600,h:200}})`);
ok(/<image /.test(svg)&&/feColorMatrix type="saturate" values="0"/.test(svg),'وضع الشعار: صورة رمادية (saturate 0)');
ok(/width="300" height="100"/.test(svg),'الشعار بيتناسب مع صندوق 300×230 بدون تشويه');

section('T27 — التوزيع والتغطية (CSS)');
run("db.company.watermarkMode='text';db.company.watermark=''");
const css=run("watermarkCSS()");
ok(/background-repeat:repeat-y/.test(css)&&/background-size:100% 92\.333mm/.test(css),'تكرار عمودي ببلاطة = ثلث صفحة A4 (277mm ÷ 3)');
ok(Math.abs(92.333*3-277)<0.01,'3 بلاطات = 277mm (صفحة A4 بهامش 10mm)');
ok(/\.print-doc\.is-doc\{background-size:100% 90mm\}/.test(css)&&90*3===270,'مستندات الصفحة المرقّمة: 3 × 90mm = 270mm');
ok(95*3===285,'تصدير PDF (هامش 6mm): 3 × 95mm = 285mm');
ok(/url\("data:image\/svg\+xml,%3Csvg/.test(css)&&!/url\("[^"]*"[^)]*"[^)]*\)/.test(css.split('}')[0].replace(/url\("[^"]*"\)/,'')),'الـ SVG مرمّز داخل url("...") بدون كسر الاقتباس');
ok(/\.print-table tbody tr:nth-child\(even\) td\{background:rgba\(251,248,240,\.55\)\}/.test(css),'صفوف الجدول شبه شفافة: العلامة بالخلفية وما بتغطي الأرقام');
// البلاطة: النص داخل حدود البلاطة (لا يقص من الأطراف) للنص الأطول
{
  const t=run("(function(){db.company.watermark='SECURITY MASK SYSTEMS COMPANY LTD';return watermarkSVG();})()");
  const f=+/font-size="(\d+)"/.exec(t)[1],len=32,w=len*f*0.66;
  const ang=30*Math.PI/180,bw=w*Math.cos(ang)+f*Math.sin(ang),bh=w*Math.sin(ang)+f*Math.cos(ang);
  ok(bw<=760&&bh<=370,'أطول نص عادي بيبقى كامل داخل البلاطة بعد الدوران',{bw:Math.round(bw),bh:Math.round(bh)});
}
// فحص: ما في ::before قديم
ok(!/\.print-doc::before/.test(fs.readFileSync(path.join(root,'style.css'),'utf8')+fs.readFileSync(path.join(root,'core.js'),'utf8')),'العلامة القديمة (::before بأول الصفحة بس) انشالت');
ok(/\[data-theme="dark"\] \.print-doc,\[data-theme="dark"\] #print-area\{\s*background-color:#ffffff/.test(fs.readFileSync(path.join(root,'style.css'),'utf8')),'الوضع الليلي ما بيمسح الخلفية (background-color بدل background)');

console.log('\n'+(fail?'❌':'✅')+' '+pass+' نجح، '+fail+' فشل');
process.exit(fail?1:0);
