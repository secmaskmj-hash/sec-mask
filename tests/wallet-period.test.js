/* اختبارات المرحلة 2 / الجزء 2: T22 مكوّن الفترة، T23 كشف الحساب، T24 المقارنة والأشهر، T25 إقفال الشهر.
   التشغيل:  node tests/wallet-period.test.js   (بدون أي مكتبات) */
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..');
const core=fs.readFileSync(path.join(root,'core.js'),'utf8');
const wallet=fs.readFileSync(path.join(root,'wallet.js'),'utf8');
function slice(src,a,b){const i=src.indexOf(a),j=src.indexOf(b,i);if(i<0||j<0)throw new Error('marker missing: '+a+' / '+b);return src.slice(i,j);}
const ctx={console,window:{},Math,Date,JSON,Number,String,Object,Array,RegExp,isFinite,isNaN,parseFloat,parseInt,
  document:{getElementById:()=>null},confirm:()=>true,saveDB:()=>{ctx._saves++;},_saves:0,currentPage:'wallet'};
ctx.window=ctx;vm.createContext(ctx);
// جزء core.js المطلوب: أدوات التاريخ/التقريب/الصرف + مكوّن الفترة
vm.runInContext(`
let db={settings:{exchangeRate:15000},wallet:{openingBalance:100,entries:[],closedMonths:{}}};
function getExchangeRate(){const r=+db.settings.exchangeRate;return r>0?r:15000;}
function toUSD(a,c){a=+a||0;return c==='USD'?a:a/getExchangeRate();}
function fmt(n){return (+n||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2});}
function fmtDate(d){if(!d)return'—';const m=/^(\\d{4})-(\\d{2})-(\\d{2})/.exec(String(d));return m?m[3]+'/'+m[2]+'/'+m[1]:String(d);}
function infoTip(t){return '';}
`,ctx);
vm.runInContext(slice(core,'function esc(v)','// بيحوّل نص الملاحظات'),ctx);
vm.runInContext(slice(core,'function localISODate','function esc(v)'),ctx);
vm.runInContext(wallet,ctx);
const run=c=>vm.runInContext(c,ctx);

let pass=0,fail=0;
function ok(cond,name,extra){if(cond){pass++;console.log('  ✓ '+name);}else{fail++;console.log('  ✗ '+name+(extra!==undefined?'  → '+JSON.stringify(extra):''));}}
function eq(a,b,name){ok(JSON.stringify(a)===JSON.stringify(b),name,{got:a,expected:b});}
function section(t){console.log('\n'+t);}
const setEntries=list=>{ctx._tmp=list;run('db.wallet.entries=_tmp;db.wallet.closedMonths={};');};
let _id=0;
const E=(type,amount,date,extra)=>Object.assign({id:'e'+(++_id),type,amount,currency:'USD',date},extra||{});
const SYP=(type,amount,date,rate,extra)=>E(type,amount,date,Object.assign({currency:'SYP',rate},extra||{}));

section('T22 — مكوّن الفترة: الحدود والتنقل');
eq(run("periodMonthBounds(2026,1)"),{from:'2026-02-01',to:'2026-02-28',y:2026,m:1},'شباط 2026 ينتهي 28');
eq(run("periodMonthBounds(2028,1).to"),'2028-02-29','شباط 2028 (كبيسة) ينتهي 29');
eq(run("periodMonthBounds(2026,12)"),{from:'2027-01-01',to:'2027-01-31',y:2027,m:0},'الشهر 13 بيلف للسنة اللي بعدها');
eq(run("periodShift('2026-11-01','2026-11-30',-1)"),{from:'2026-10-01',to:'2026-10-31'},'السابق لتشرين الثاني = تشرين الأول');
eq(run("periodShift('2026-01-01','2026-01-31',-1)"),{from:'2025-12-01',to:'2025-12-31'},'السابق لكانون الثاني = كانون الأول بالسنة اللي قبلها');
eq(run("periodShift('2026-03-01','2026-03-31',-1)"),{from:'2026-02-01',to:'2026-02-28'},'السابق لآذار = شباط (28)');
eq(run("periodShift('2026-01-01','2026-12-31',-1)"),{from:'2025-01-01',to:'2025-12-31'},'السابق لسنة كاملة = السنة اللي قبلها');
eq(run("periodShift('2026-11-10','2026-11-19',-1)"),{from:'2026-10-31',to:'2026-11-09'},'فترة 10 أيام: السابق بنفس الطول');
eq(run("periodShift(null,null,-1)"),null,'"الكل" ما إلو سابق');
ok(run("periodInRange('2026-11-30','2026-11-01','2026-11-30')"),'آخر يوم بالشهر داخل الفترة');
ok(run("periodInRange('2026-11-01','2026-11-01','2026-11-30')"),'أول يوم بالشهر داخل الفترة');
ok(!run("periodInRange('2026-12-01','2026-11-01','2026-11-30')"),'أول يوم بالشهر اللي بعده برا الفترة');
ok(run("periodInRange('2028-02-29','2028-02-01','2028-02-29')"),'29 شباط داخل شباط الكبيسة');
ok(run("periodInRange('2026-11-30T23:59:59','2026-11-01','2026-11-30')"),'تاريخ بوقت (23:59:59) آخر الشهر داخل الفترة');
ok(!run("periodInRange('','2026-11-01','2026-11-30')"),'تاريخ فاضي برا فترة محددة');
ok(run("periodInRange('','','')"),'تاريخ فاضي داخل "الكل"');
// الحالة والتنقل
run("window._periods={};");
let r=run("periodResolve('t',{mode:'month',y:2026,m:10})");
eq([r.from,r.to,r.monthKey,r.label],['2026-11-01','2026-11-30','2026-11','تشرين الثاني 2026'],'الشهر الافتراضي المحدد');
run("periodAct('t','prev')");r=run("periodResolve('t')");eq([r.from,r.to],['2026-10-01','2026-10-31'],'زر السابق');
run("periodAct('t','next');periodAct('t','next')");r=run("periodResolve('t')");eq([r.from,r.to],['2026-12-01','2026-12-31'],'زر التالي مرتين');
run("periodAct('t','next')");r=run("periodResolve('t')");eq([r.from,r.to],['2027-01-01','2027-01-31'],'التالي من كانون الأول بيعدّي للسنة الجديدة');
run("window._periods.t.mode='custom';window._periods.t.from='2026-11-10';window._periods.t.to='2026-11-19';");
run("periodAct('t','next')");r=run("periodResolve('t')");eq([r.from,r.to],['2026-11-20','2026-11-29'],'التالي على فترة مخصصة بيزحف بنفس الطول');
run("window._periods.t.from='2026-11-30';window._periods.t.to='2026-11-01';");
r=run("periodResolve('t')");eq([r.from,r.to],['2026-11-01','2026-11-30'],'من أكبر من إلى: بينقلبوا');
run("periodSetPreset('t','all')");r=run("periodResolve('t')");ok(r.isAll&&r.from===null,'اختصار "الكل"');
run("periodSetPreset('t','thisMonth')");r=run("periodResolve('t')");ok(r.mode==='month'&&!!r.fullMonth,'اختصار "هالشهر" = شهر كامل');
run("periodSetPreset('t','last30')");r=run("periodResolve('t')");
ok(Math.round((new Date(r.to)-new Date(r.from))/86400000)===29,'آخر 30 يوم = 30 يوم شاملة الطرفين',r);
const html=run("periodBarHTML('t',function(){})");
ok(/period-label/.test(html)&&/type="date"/.test(html)&&/آخر 30 يوم/.test(html),'الشريط فيه تنقل + من/إلى + اختصارات');

section('T23 — كشف الحساب: المعادلة');
setEntries([
  E('income',500,'2026-10-31'),E('expense',120,'2026-10-31'),            // تشرين الأول
  E('income',1000,'2026-11-01'),E('expense',250.1,'2026-11-01'),          // أول تشرين الثاني
  E('expense',0.2,'2026-11-15'),E('expense',0.1,'2026-11-15'),
  E('income',300,'2026-11-30'),E('expense',50,'2026-11-30'),              // آخر الشهر
  E('income',77,'2026-12-01'),                                            // كانون الأول
]);
let st=run("walletStatement('2026-11-01','2026-11-30','all')");
eq(st.usd.open,10000+50000-12000,'أول المدة = الافتتاحي + ما قبل الفترة (بالسنت)');
eq([st.usd.income,st.usd.expense],[130000,-(25010+20+10+5000)],'إيراد/مصروف تشرين الثاني بالسنت (0.1+0.2 بدون كسور)');
eq(st.usd.close,st.usd.open+st.usd.income+st.usd.expense,'آخر المدة = أول + إيراد + مصروف');
ok(st.count===6,'عدد حركات الشهر',st.count);
// حدود الشهر
let stDec=run("walletStatement('2026-12-01','2026-12-31','all')");
eq(stDec.usd.open,st.usd.close,'آخر المدة لتشرين الثاني = أول المدة لكانون الأول');
let stAll=run("walletStatement(null,null,'all')");
eq(stAll.usd.close/100,run("walletBalanceUSD()"),'كل الفترات: آخر المدة = الرصيد الحالي');
eq(run("walletStatement('2026-10-01','2026-12-31','all')").usd.close,stAll.usd.close,'ربع سنة: آخر المدة = الرصيد الحالي');
// تجميع الأشهر
const months=['2026-10','2026-11','2026-12'].map(k=>run(`(function(){const p=periodMonthBounds(${k.slice(0,4)},${+k.slice(5)-1});return walletStatement(p.from,p.to,'all');})()`));
eq(months[0].usd.close,months[1].usd.open,'آخر تشرين الأول = أول تشرين الثاني');
eq(months[1].usd.close,months[2].usd.open,'آخر تشرين الثاني = أول كانون الأول');
const q=run("walletStatement('2026-10-01','2026-12-31','all')");
eq(months.reduce((s,m)=>s+m.usd.income,0),q.usd.income,'مجموع إيراد الأشهر = إيراد الربع');
eq(months.reduce((s,m)=>s+m.usd.expense,0),q.usd.expense,'مجموع مصروف الأشهر = مصروف الربع');

section('T23 — عملات وجيوب وتحويلات');
setEntries([
  E('income',1000,'2026-11-02'),
  // تحويل 200$ إلى ليرة بسعر 16000 (سعر الشركة المحفوظ 15000) — قيدين مترابطين
  E('expense',200,'2026-11-05',{source:'currencyExchange',pairId:'x1',rate:15000}),
  SYP('income',3200000,'2026-11-05',15000,{source:'currencyExchange',pairId:'x1'}),
  SYP('expense',1500000,'2026-11-10',15000),                              // مصروف بالليرة
  // سحب أرباح: جيب الشركة ← الشخصي
  E('expense',300,'2026-11-12',{source:'pocketTransfer',pocket:'company',pairId:'p1'}),
  E('income',300,'2026-11-12',{source:'profit',pairId:'p1'}),
  E('income',800,'2026-11-03',{pocket:'company'}),                        // قبض من زبون للشركة
]);
run("db.wallet.openingBalance=100");
const A=run("walletStatement('2026-11-01','2026-11-30','all')"),P=run("walletStatement('2026-11-01','2026-11-30','personal')"),C=run("walletStatement('2026-11-01','2026-11-30','company')");
eq(A.usd.internal,0,'تحويل بين الجيبين صافيه صفر بنطاق "الكل"');
eq(P.usd.internal,30000,'سحب الأرباح بيظهر + بالشخصي');
eq(C.usd.internal,-30000,'وبيظهر − بجيب الشركة');
eq(P.usd.close+C.usd.close,A.usd.close,'شخصي + شركة = الكل');
eq(P.usd.income+C.usd.income,A.usd.income,'إيراد شخصي + شركة = الكل');
eq(A.nat.USD.exchange,-20000,'تحويل العملة بالدولار الفعلي: −200');
eq(A.nat.SYP.exchange,320000000,'تحويل العملة بالليرة الفعلية: +3,200,000');
const fx=A.usd.exchange;
ok(Math.abs(fx-(-20000+Math.round(3200000/15000*100)))<=1,'بالمكافئ بالدولار تحويل العملة = فرق الصرف فقط (≈ +13.33$)',fx);
eq(A.nat.USD.close,run("Math.round(walletBalanceByCurrency().usd*100)"),'الدولار الفعلي آخر المدة = رصيد الدولار');
eq(A.nat.SYP.close,run("Math.round(walletBalanceByCurrency().syp*100)"),'الليرة الفعلية آخر المدة = رصيد الليرة');
eq(A.usd.close,run("Math.round(walletBalanceUSD()*100)"),'كل الأعمدة متطابقة مع الرصيد الحالي');
eq(run("Math.round(walletCompanyPocketUSD()*100)"),C.usd.close,'آخر المدة (شركة) = جيب الشركة الحالي');

section('T21+T23 — تغيير سعر الصرف ما بيغيّر أشهر ماضية');
setEntries([SYP('income',3000000,'2026-09-10',15000),E('income',50,'2026-09-12'),SYP('expense',150000,'2026-11-10',15000)]);
const before=run("walletStatement('2026-09-01','2026-09-30','all')");
run("db.settings.exchangeRate=30000");
eq(run("walletStatement('2026-09-01','2026-09-30','all')").usd.close,before.usd.close,'تغيير السعر بعد التثبيت: أيلول ثابت');
run("db.settings.exchangeRate=15000");

section('T24 — المقارنة وسلسلة الأشهر');
setEntries([
  E('income',1000,'2026-08-10'),E('expense',400,'2026-08-20'),
  E('income',700,'2026-09-05'),E('expense',900,'2026-09-25'),
  E('income',1200,'2026-10-01'),E('expense',300,'2026-10-31'),
  E('income',50,'2026-11-30'),
]);
let cmp=run("walletCompare('2026-10-01','2026-10-31','all')");
eq(cmp.prevRange,{from:'2026-09-01',to:'2026-09-30'},'الفترة السابقة لتشرين الأول = أيلول');
eq([cmp.cur.usd.income,cmp.prev.usd.income],[120000,70000],'إيراد الشهر مقابل السابق');
eq(run("walletCompare(null,null,'all')"),null,'"الكل" بدون مقارنة');
let ser=run("walletMonthlySeries('2026-08-01','2026-11-30','all')");
eq(ser.rows.length,4,'4 أشهر');
const tot=run("walletStatement('2026-08-01','2026-11-30','all')");
eq(ser.rows.reduce((s,r)=>s+r.usd.income,0),tot.usd.income,'مجموع إيراد الأشهر = إجمالي الفترة');
eq(ser.rows.reduce((s,r)=>s+r.usd.expense,0),tot.usd.expense,'مجموع مصروف الأشهر = إجمالي الفترة');
ser.rows.slice(1).forEach((rw,i)=>eq(rw.usd.open,ser.rows[i].usd.open+ser.rows[i].usd.income+ser.rows[i].usd.expense+ser.rows[i].usd.internal+ser.rows[i].usd.exchange,'أول '+rw.label+' = آخر الشهر السابق'));
let serAll=run("walletMonthlySeries(null,null,'all')");
eq(serAll.rows.reduce((s,r)=>s+r.usd.income,0),run("walletStatement(null,null,'all')").usd.income,'"الكل": مجموع الأشهر = الإجمالي');
// جزئي
let serPart=run("walletMonthlySeries('2026-08-15','2026-10-15','all')");
ok(serPart.rows[0].full===false&&serPart.rows[2].full===false,'أشهر الأطراف جزئية');
eq(serPart.rows.reduce((s,r)=>s+r.usd.income+r.usd.expense,0),run("(function(){const t=walletStatement('2026-08-15','2026-10-15','all');return t.usd.income+t.usd.expense;})()"),'فترة جزئية: المجموع يتطابق');

section('T25 — إقفال الشهر');
setEntries([SYP('income',3000000,'2026-10-10',15000),E('income',200,'2026-10-11'),E('expense',50,'2026-10-20'),E('income',10,'2026-11-05'),SYP('expense',150000,'2026-11-08',15000)]);
const live=run("walletStatement('2026-10-01','2026-10-31','all')");
run("walletCloseMonth('2026-10')");
ok(run("walletIsMonthClosed('2026-10')")&&!run("walletMonthDrift('2026-10')"),'بعد الإقفال: مقفل وبدون فرق');
eq(run("walletStatement('2026-10-01','2026-10-31','all')").usd.close,live.usd.close,'أرقام الشهر المقفل = الأرقام وقت الإقفال');
// إلغاء ختم سعر الصرف لحركة ليرة (حركة قديمة بدون سعر) ثم تغيير السعر
run("db.wallet.entries.forEach(e=>{if(e.currency==='SYP')delete e.rate;});db.settings.exchangeRate=30000;");
const liveRaw=run("_walletRawStatement('2026-10-01','2026-10-31','all')");
ok(liveRaw.usd.close!==live.usd.close,'(تأكيد) الحساب الحيّ كان رح يتغيّر بتغيّر السعر');
eq(run("walletStatement('2026-10-01','2026-10-31','all')").usd.close,live.usd.close,'الشهر المقفل ما بيتغيّر بتغيّر سعر الصرف');
ok(run("walletMonthDrift('2026-10')"),'والنظام بيكشف إنو الحركات الحيّة اختلفت (تنبيه)');
const nov=run("walletStatement('2026-11-01','2026-11-30','all')");
eq(nov.usd.open,live.usd.close,'أول تشرين الثاني بيتحمّل من آخر لقطة تشرين الأول');
const q2=run("walletStatement('2026-10-01','2026-11-30','all')");
ok(q2.frozen.indexOf('2026-10')>=0,'فترة فيها شهر مقفل بتتركّب من لقطته');
eq(q2.usd.close,q2.usd.open+q2.usd.income+q2.usd.expense+q2.usd.internal+q2.usd.exchange,'معادلة الفترة المركّبة');
ser=run("walletMonthlySeries('2026-10-01','2026-11-30','all')");
ok(ser.rows[0].frozen,'مخطط الأشهر بيعتبر الشهر المقفل مجمّد');
eq(ser.rows[1].usd.open,_close(ser.rows[0].usd),'سلسلة الأشهر متصلة مع شهر مقفل');
function _close(z){return z.open+z.income+z.expense+z.internal+z.exchange;}
run("db.settings.exchangeRate=15000");
// فتح الشهر
run("walletReopenMonth('2026-10')");
ok(!run("walletIsMonthClosed('2026-10')"),'فتح الشهر بيرجّعو حيّ');
// حماية التعديل
let asked=0;ctx.confirm=()=>{asked++;return false;};
run("walletCloseMonth('2026-10')");
ok(run("walletClosedGuard('2026-10-15')")===false&&asked===1,'تعديل حركة بشهر مقفل بيطلب تأكيد');
ok(run("walletClosedGuard('2026-11-15')")===true&&asked===1,'شهر مفتوح بدون سؤال');
ctx.confirm=()=>true;

section('رسم الواجهة (بدون أخطاء)');
setEntries([E('income',500,'2026-11-05'),E('expense',120,'2026-11-06'),E('income',90,'2026-10-06')]);
const pb=run("periodResolve('w',{mode:'month',y:2026,m:10})");
ctx._pb=pb;
const card=run("renderWalletStatementCard(_pb,'all')");
ok(/كشف حساب المحفظة/.test(card)&&/آخر المدة/.test(card)&&/إقفال الشهر/.test(card),'بطاقة كشف الحساب');
ok(/مقارنة بالفترة السابقة/.test(run("renderWalletCompareCard(_pb,'all')")),'بطاقة المقارنة');
ok(/walletMonthsChart/.test(run("renderWalletMonthsCard(periodResolve('w2',{mode:'custom',from:'2026-10-01',to:'2026-11-30'}),'all').html")),'بطاقة الأشهر');

section('بدء فترة جديدة — أرشفة + تسوية الرصيد');
run("var _n=0;function uid(){return 'u'+(++_n);}");
setEntries([E('income',500,'2026-08-10'),E('expense',100,'2026-08-20'),E('expense',50,'2026-09-05'),SYP('income',3000000,'2026-09-06',15000)]);
const beforeAug=run("walletStatement('2026-08-01','2026-08-31','all').usd.close");
const balBefore=run("walletBalanceUSD()");
run("walletStartNewPeriod('2026-11-23',1000,0)");
ok(run("walletBalanceByCurrency().usd")===1000,'الدولار صار 1000 بالضبط',run("walletBalanceByCurrency()"));
ok(run("walletBalanceByCurrency().syp")===0,'الليرة صارت 0');
ok(run("walletIsMonthClosed('2026-08')&&walletIsMonthClosed('2026-09')"),'آب وأيلول انقفلوا');
ok(!run("walletIsMonthClosed('2026-10')"),'تشرين الأول (فاضي) ما انقفل');
ok(run("walletStatement('2026-08-01','2026-08-31','all').usd.close")===beforeAug,'أرقام آب القديمة ما تغيّرت',beforeAug);
ok(run("walletAllEntries().filter(e=>e.source==='balanceAdjust').length")===2,'تسويتين (دولار + ليرة)');
const novSt=run("walletStatement('2026-11-01','2026-11-30','all')");
ok(novSt.usd.close===100000,'آخر المدة لتشرين الثاني = 1000$',novSt.usd.close);
ok(!novSt.chainBreak,'ما في كسر بالسلسلة');
ok(run("db.wallet.openingBalance")===100,'الرصيد الافتتاحي ما انلمس');
ok(run("walletEntryLocked(walletAllEntries().find(e=>e.source==='balanceAdjust'))"),'التسوية ما بتنعدّل يدوياً');

console.log('\n'+(fail?'❌':'✅')+' '+pass+' نجح، '+fail+' فشل');
process.exit(fail?1:0);
