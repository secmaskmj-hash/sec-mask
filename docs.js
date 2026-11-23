/* ====================================================================
   docs.js — قسم "المستندات والقوالب"
   صفحات فاضية قابلة للكتابة (عقد صيانة دورية، تقرير، بروفايل، كتاب رسمي…)
   - قوالب جاهزة + قوالب بتحفظها بنفسك من أي مستند
   - محرر نصوص بسيط (عريض، عناوين، قوائم، جداول، محاذاة، ألوان)
   - حقول ذكية: اسم الشركة / العميل / الهاتف / العنوان / التاريخ
   - طباعة وحفظ PDF بنفس ترويسة الشركة المستخدمة بالفواتير
   - البيانات بتنحفظ جوا db.docs و db.docTemplates وبتتزامن مع السحابة تلقائياً
   ==================================================================== */

const DOC_CATEGORIES=['عقد','تقرير','بروفايل','مراسلة','أخرى'];

/* ---------- تنظيف HTML (حماية: ما بنخزّن ولا بنطبع إلا وسوم وخصائص مسموحة) ---------- */
const DOC_OK_TAGS=new Set(['P','DIV','BR','B','STRONG','I','EM','U','S','H1','H2','H3','H4','UL','OL','LI','TABLE','THEAD','TBODY','TR','TD','TH','SPAN','HR','BLOCKQUOTE','SUB','SUP']);
const DOC_DROP_TAGS=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','LINK','META','NOSCRIPT','TEMPLATE','SVG','MATH','FORM','INPUT','BUTTON','TEXTAREA','SELECT','IMG','VIDEO','AUDIO','CANVAS']);
const DOC_OK_STYLE=new Set(['text-align','color','background-color','font-weight','font-style','text-decoration','font-size','width','direction']);
function docSanitize(html){
  const parsed=new DOMParser().parseFromString('<body>'+String(html||'')+'</body>','text/html');
  const out=document.createElement('div');
  (function clean(node,dest){
    node.childNodes.forEach(function(ch){
      if(ch.nodeType===3){dest.appendChild(document.createTextNode(ch.nodeValue));return;}
      if(ch.nodeType!==1)return;
      const t=ch.tagName;
      if(DOC_DROP_TAGS.has(t))return;
      if(!DOC_OK_TAGS.has(t)){clean(ch,dest);return;}
      const n=document.createElement(t.toLowerCase());
      if(t==='TD'||t==='TH'){
        ['colspan','rowspan'].forEach(function(a){const v=ch.getAttribute(a);if(v&&/^\d{1,2}$/.test(v))n.setAttribute(a,v);});
      }
      const cl=(ch.getAttribute('class')||'').trim();
      if(cl==='doc-note')n.setAttribute('class',cl);
      const st=ch.getAttribute('style');
      if(st){
        const keep=[];
        st.split(';').forEach(function(d){
          const i=d.indexOf(':');if(i<0)return;
          const p=d.slice(0,i).trim().toLowerCase(),v=d.slice(i+1).trim();
          if(DOC_OK_STYLE.has(p)&&/^[#\w\s%.,()-]+$/.test(v)&&!/url|expression|javascript/i.test(v))keep.push(p+':'+v);
        });
        if(keep.length)n.setAttribute('style',keep.join(';'));
      }
      clean(ch,n);
      dest.appendChild(n);
    });
  })(parsed.body,out);
  return out.innerHTML;
}

/* ---------- استايل المحرر والورقة (بينحقن مرة وحدة) ---------- */
window.DOC_BODY_CSS=`
.doc-body{font-size:13.5px;line-height:1.85;color:#1f2430;direction:rtl;text-align:start;overflow-wrap:break-word;word-wrap:break-word;font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif}
.doc-body[dir=ltr]{direction:ltr;font-family:'Segoe UI','Helvetica Neue',Arial,'IBM Plex Sans Arabic',sans-serif}
.doc-body h1{display:table;margin:6px auto 16px;padding:0 22px 7px;font-size:23px;font-weight:800;color:#12151C;text-align:center;border-bottom:3px solid #C9A24B;letter-spacing:.2px}
.doc-body h2{font-size:15px;font-weight:800;margin:18px 0 8px;padding:5px 11px;color:#12151C;background:#F7F2E4;border-inline-start:4px solid #C9A24B;border-radius:3px;break-after:avoid;page-break-after:avoid}
.doc-body h3{font-size:14px;font-weight:800;margin:12px 0 4px;color:#9C7A2E;break-after:avoid;page-break-after:avoid}
.doc-body p{margin:0 0 7px}
.doc-body ul,.doc-body ol{margin:4px 0 10px;padding-inline-start:26px}
.doc-body li{margin-bottom:3px}
.doc-body li::marker{color:#9C7A2E}
.doc-body table{width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:13px}
.doc-body tr{page-break-inside:avoid;break-inside:avoid}
.doc-body th,.doc-body td{border:1px solid #E3D8B5;padding:7px 9px;text-align:start;vertical-align:top;min-width:40px}
.doc-body thead th{background:#12151C;color:#fff;border-color:#12151C;font-weight:800}
.doc-body tbody th{background:#F4EEDC;color:#12151C;font-weight:800}
.doc-body tbody tr:nth-child(even) td{background:#FBF8F0}
.doc-body hr{border:0;border-top:1px solid #D9CCA0;margin:14px 0}
.doc-body blockquote{border-inline-start:3px solid #C9A24B;margin:10px 0;padding:5px 13px;background:#FBF9F4;color:#4b4736}
.doc-body .doc-note{background:#FBF6E6;border:1px solid #EADFC0;border-inline-start:4px solid #C9A24B;border-radius:6px;padding:8px 13px;margin:10px 0;break-inside:avoid;page-break-inside:avoid}
.doc-body .doc-note p:last-child{margin-bottom:0}
@page doc{size:A4;margin:10mm 10mm 17mm;@bottom-center{content:counter(page) " / " counter(pages);font-size:10px;color:#8a836a}}
.print-doc.is-doc{page:doc}
`;
function docsInjectCss(){
  if(document.getElementById('docs-css'))return;
  const s=document.createElement('style');s.id='docs-css';
  s.textContent=window.DOC_BODY_CSS+`
  .doc-paper{background:#fff;color:#1f2430;border:1px solid var(--border);border-radius:10px;max-width:210mm;margin:0 auto 24px;padding:22px 26px;box-shadow:0 2px 12px rgba(0,0,0,.07)}
  .doc-editor{min-height:60vh;outline:none}
  .doc-editor:focus{outline:none}
  .doc-tb{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:4px;align-items:center;background:var(--surface,#fff);border:1px solid var(--border);border-radius:10px;padding:6px 8px;margin-bottom:12px}
  .doc-tb button,.doc-tb select{border:1px solid var(--border);background:var(--bg2,#f6f6f6);color:var(--text,#222);border-radius:7px;padding:5px 9px;font-family:inherit;font-size:12.5px;cursor:pointer;min-height:30px}
  .doc-tb button:hover{background:var(--bg3,#eee)}
  .doc-tb .sep{width:1px;align-self:stretch;background:var(--border);margin:0 3px}
  .doc-tb input[type=color]{width:30px;height:30px;padding:0;border:1px solid var(--border);border-radius:7px;background:none;cursor:pointer}
  .doc-tpl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-bottom:18px}
  .doc-tpl-card{background:var(--surface,#fff);border:1px solid var(--border);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:6px}
  .doc-tpl-card i.big{font-size:26px;color:var(--accent,#9C7A2E)}
  .doc-tpl-card .nm{font-weight:800;font-size:14px}
  .doc-tpl-card .en{font-size:11.5px;color:var(--text2);direction:ltr;text-align:right;margin-top:-4px}
  .doc-tpl-card .ds{font-size:12px;color:var(--text2);flex:1}
  .doc-lang{display:inline-block;font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:10px;background:var(--bg3);color:var(--text2);letter-spacing:.5px}
  @media(max-width:700px){.doc-paper{padding:12px;border-radius:8px}.doc-tb{gap:3px}.doc-tb button,.doc-tb select{padding:5px 7px}}
  `;
  document.head.appendChild(s);
}

/* ---------- القوالب الجاهزة ---------- */
const DOC_BLANK='<p><br></p>';
const DOC_BUILTIN_TEMPLATES=[
  {id:'blank',name:'صفحة فاضية',category:'أخرى',icon:'ti-file',desc:'ورقة بيضاء بترويسة الشركة، اكتب فيها أي شي.',sign:false,html:DOC_BLANK},
  {id:'maint-contract',name:'عقد صيانة دورية',category:'عقد',icon:'ti-file-certificate',desc:'عقد صيانة دورية لأنظمة المراقبة والأمان: المدة والزيارات والبدل والالتزامات.',sign:true,html:`
<h1>عقد صيانة دورية</h1>
<p style="text-align:center">رقم العقد: {{ref}} &nbsp;&nbsp;|&nbsp;&nbsp; تاريخ التحرير: {{date}}</p>
<p>تم الاتفاق بين كل من:</p>
<p><b>الطرف الأول (مقدّم الخدمة):</b> {{company}} — العنوان: {{companyAddress}} — الهاتف: {{companyPhone}}</p>
<p><b>الطرف الثاني (العميل):</b> {{client}} — العنوان: {{clientAddress}} — الهاتف: {{clientPhone}}</p>
<p>على ما يلي:</p>
<h2>البند الأول: موضوع العقد</h2>
<p>يلتزم الطرف الأول بتنفيذ أعمال الصيانة الدورية الوقائية لأنظمة المراقبة والأمان العائدة للطرف الثاني في الموقع التالي: ……………………………………</p>
<h2>البند الثاني: مدة العقد</h2>
<p>مدة هذا العقد …… شهراً تبدأ من تاريخ ……/……/…………  وتنتهي بتاريخ ……/……/…………</p>
<h2>البند الثالث: الزيارات الدورية</h2>
<p>يقوم الطرف الأول بزيارة الموقع مرة كل …… (شهر / شهرين / ثلاثة أشهر)، بإجمالي …… زيارة خلال مدة العقد، وبموعد يُتفق عليه مسبقاً مع الطرف الثاني. يُسلَّم الطرف الثاني تقرير مختصر عن كل زيارة.</p>
<h2>البند الرابع: نطاق الخدمة</h2>
<ul>
<li>فحص عمل جميع الكاميرات وجودة الصورة وتنظيف العدسات والأغطية.</li>
<li>فحص جهاز التسجيل (DVR / NVR) والقرص الصلب وصحة التسجيل والتخزين.</li>
<li>فحص مصادر التغذية والبطاريات والكابلات والوصلات.</li>
<li>ضبط زوايا الكاميرات والتاريخ والوقت وإعدادات التسجيل.</li>
<li>تحديث البرمجيات عند الحاجة وعند توفر ذلك فنياً.</li>
<li>تنظيف الأجهزة والخزائن الداخلية من الغبار.</li>
</ul>
<h2>البند الخامس: ما لا يشمله العقد</h2>
<ul>
<li>ثمن قطع الغيار والأجهزة التي يلزم تبديلها (تُحتسب بعرض سعر منفصل بعد موافقة الطرف الثاني).</li>
<li>الأعطال الناتجة عن سوء الاستخدام أو العبث أو الصواعق أو انقطاع/تذبذب الكهرباء أو الحوادث أو الكوارث الطبيعية.</li>
<li>التمديدات والتركيبات الجديدة والإضافات خارج نطاق التجهيزات الحالية.</li>
</ul>
<h2>البند السادس: بدل العقد وطريقة الدفع</h2>
<table>
<thead><tr><th>البيان</th><th>المبلغ</th><th>العملة</th><th>موعد الاستحقاق</th></tr></thead>
<tbody>
<tr><td>الدفعة الأولى عند التوقيع</td><td>……………</td><td>……</td><td>……/……/……</td></tr>
<tr><td>الدفعة الثانية</td><td>……………</td><td>……</td><td>……/……/……</td></tr>
<tr><td><b>إجمالي بدل العقد</b></td><td><b>……………</b></td><td>……</td><td></td></tr>
</tbody>
</table>
<h2>البند السابع: الأعطال الطارئة</h2>
<p>عند حدوث عطل طارئ يتواصل الطرف الثاني مع الطرف الأول على الأرقام المذكورة أعلاه، ويلتزم الطرف الأول بالاستجابة خلال …… ساعة عمل. تُنفَّذ الزيارات الطارئة (☐ ضمن العقد ☐ بأجر منفصل قدره ……………).</p>
<h2>البند الثامن: التزامات الطرف الثاني</h2>
<ul>
<li>تأمين وصول الفريق الفني إلى الموقع والأجهزة في المواعيد المتفق عليها.</li>
<li>تأمين التيار الكهربائي والاتصال بالشبكة اللازمين لعمل النظام.</li>
<li>إبلاغ الطرف الأول فوراً عند ملاحظة أي خلل أو تعديل على النظام.</li>
<li>عدم السماح لأي جهة أخرى بإجراء تعديلات على النظام خلال مدة العقد إلا بموافقة الطرف الأول.</li>
<li>سداد الدفعات في مواعيدها المتفق عليها.</li>
</ul>
<h2>البند التاسع: التجديد والإنهاء</h2>
<p>يتجدد العقد باتفاق الطرفين، ويحق لأي منهما إنهاءه بإشعار خطي قبل …… يوماً من تاريخ الإنهاء، مع تسوية المستحقات عن الفترة المنفَّذة.</p>
<h2>البند العاشر: أحكام عامة</h2>
<p>يُحل أي خلاف ينشأ عن هذا العقد وديّاً بين الطرفين أولاً، وإلا فيُحال إلى الجهة المختصة وفق القوانين النافذة. حُرر هذا العقد من نسختين أصليتين بيد كل طرف نسخة منه.</p>`},
  {id:'visit-report',name:'تقرير زيارة صيانة',category:'تقرير',icon:'ti-clipboard-check',desc:'تقرير يُسلَّم للعميل بعد كل زيارة: الفحص، الملاحظات، التوصيات.',sign:true,html:`
<h1>تقرير زيارة صيانة</h1>
<table>
<tbody>
<tr><th style="width:22%">العميل</th><td>{{client}}</td><th style="width:22%">تاريخ الزيارة</th><td>{{date}}</td></tr>
<tr><th>الموقع</th><td>{{clientAddress}}</td><th>الفني المنفِّذ</th><td></td></tr>
<tr><th>نوع الزيارة</th><td>☐ دورية &nbsp; ☐ طارئة &nbsp; ☐ متابعة</td><th>رقم العقد</th><td></td></tr>
</tbody>
</table>
<h2>نتيجة الفحص</h2>
<table>
<thead><tr><th>الجهاز / النقطة</th><th>الموقع</th><th>الحالة</th><th>الإجراء المتخذ</th></tr></thead>
<tbody>
<tr><td></td><td></td><td></td><td></td></tr>
<tr><td></td><td></td><td></td><td></td></tr>
<tr><td></td><td></td><td></td><td></td></tr>
<tr><td></td><td></td><td></td><td></td></tr>
</tbody>
</table>
<h2>القطع المستبدلة / المطلوبة</h2>
<ul><li>……………………………………</li></ul>
<h2>الملاحظات والتوصيات</h2>
<p>……………………………………………………………………………………</p>
<p>……………………………………………………………………………………</p>`},
  {id:'company-profile',name:'بروفايل الشركة',category:'بروفايل',icon:'ti-building-skyscraper',desc:'البروفايل الرسمي لشركة Security Mask: نبذة وكفاءات ومشاريع ومراجع وبيانات التواصل.',sign:false,html:`
<h1>{{company}}</h1>
<p style="text-align:center"><b>الهندسة والأنظمة الأمنية المتكاملة</b><br>Integrated Security Engineering &amp; Systems</p>
<p style="text-align:center"><b>البنية التحتية للشبكات &nbsp;•&nbsp; التحكم بالدخول &nbsp;•&nbsp; أنظمة الإنذار ضد التسلل &nbsp;•&nbsp; المراقبة بالكاميرات (CCTV)</b></p>
<h2>نبذة عن الشركة وملخص تنفيذي</h2>
<div class="doc-note"><p>Security Mask شركة رائدة متخصصة في هندسة أنظمة الأمن المتكاملة. تقوم منهجيتنا على التحليل الشامل للنظام، وتصميم بنية تحتية متينة (عتاد وبرمجيات)، والتحسين التقني المستمر. نمتلك القدرة الكاملة على إدارة المشاريع من دراسات الجدوى الأولية وحتى التنفيذ الكامل، مع التركيز على الأتمتة لضمان أعلى درجات الاستقرار والموثوقية.</p></div>
<h2>الكفاءات التقنية الأساسية</h2>
<table>
<thead><tr><th style="width:6%">#</th><th style="width:30%">الاختصاص</th><th>الوصف</th></tr></thead>
<tbody>
<tr><td>1</td><td><b>تصميم أنظمة المراقبة المرئية</b></td><td>دراسات فنية لتوزيع كاميرات CCTV وكاميرات IP بناءً على تحليل مجال الرؤية وتحسين الموقع.</td></tr>
<tr><td>2</td><td><b>برمجة وإدارة الخوادم</b></td><td>إعداد وضبط منصات Kantech وDSS وHikvision باحترافية، مع تحسين أداء قواعد البيانات.</td></tr>
<tr><td>3</td><td><b>دمج أنظمة الإنذار</b></td><td>تحليل الثغرات وضبط أنظمة الإنذار باستخدام Teletek وTexecom وPyronix.</td></tr>
<tr><td>4</td><td><b>أنظمة التحكم بالدخول</b></td><td>إدارة الهوية وحلول عالية الأمان لنقاط الدخول، مصمَّمة للمنشآت الحساسة.</td></tr>
<tr><td>5</td><td><b>هندسة الشبكات</b></td><td>تخطيط وتصميم وتنفيذ شبكات نقل بيانات متينة مخصصة للبنى التحتية الأمنية.</td></tr>
<tr><td>6</td><td><b>التشخيص التقني والصيانة</b></td><td>معالجة متقدمة للأعطال وصيانة وقائية للبنى التحتية من عتاد وبرمجيات.</td></tr>
</tbody>
</table>
<h2>سجل المشاريع والمراجع الرئيسية</h2>
<h3>القطاع الحكومي والدبلوماسي</h3>
<ul>
<li><b>مديرية التفتيش والرقابة (2025):</b> دراسة وتصميم وتنفيذ شبكة مراقبة مركزية.</li>
<li><b>سفارة بولندا:</b> دراسة فنية وتنفيذ منظومة المراقبة بالفيديو.</li>
<li><b>سفارة اليونان:</b> منظومة أمنية متكاملة (كاميرات مراقبة، إنذار ضد التسلل، تحكم بالدخول).</li>
<li><b>الجمعية العلمية السورية للمعلوماتية:</b> حلول أمنية تقنية معتمدة.</li>
</ul>
<h3>القطاع المصرفي والضيافة</h3>
<ul>
<li><b>بنك سورية الدولي الإسلامي (SIIB):</b> مزوّد معتمد لأنظمة المراقبة والتحكم بالدخول (كانون الثاني 2024 – حتى الآن).</li>
<li><b>فندق النخيل (2026):</b> تنفيذ منظومة مراقبة متكاملة لقطاع الضيافة.</li>
</ul>
<h3>المنظمات والمؤسسات التعليمية</h3>
<ul>
<li><b>منظمة أكساد (ACSAD):</b> دراسة وتصميم وتنفيذ أنظمة أمنية متكاملة.</li>
<li><b>منظمة أمل (Amal):</b> دراسة أمنية وتنفيذ أنظمة السلامة.</li>
<li><b>القطاع التعليمي:</b> أطر أمنية لمدرستين خاصتين وروضة أطفال.</li>
</ul>
<h3>الإنشاءات والقطاع التجاري والسكني</h3>
<ul>
<li><b>ماروتا سيتي ومشروع بوليفار:</b> حلول أمنية متقدمة وتكامل الأنظمة.</li>
<li><b>أبنية إعمار (Aamar Buildings):</b> أنظمة أمنية متكاملة وكاميرات مراقبة وتحكم بالدخول.</li>
<li><b>تجاري وسكني:</b> فيلتان فاخرتان و8 منافذ بيع رئيسية و5 مطاعم.</li>
</ul>
<h2>تواصل معنا</h2>
<table>
<tbody>
<tr><th style="width:28%">المهندس المسؤول</th><td>م. محمود جوهر</td></tr>
<tr><th>واتساب</th><td>\u2066+963 965158090\u2069</td></tr>
<tr><th>الهاتف</th><td>\u2066+963 930211119\u2069</td></tr>
<tr><th>البريد الإلكتروني</th><td>\u2066secmask.mj@gmail.com\u2069</td></tr>
<tr><th>إنستغرام</th><td>\u2066@sec_mask\u2069</td></tr>
<tr><th>فيسبوك</th><td>\u2066www.facebook.com/Secmask.Mj\u2069</td></tr>
</tbody>
</table>`},
  {id:'letter',name:'كتاب رسمي',category:'مراسلة',icon:'ti-mail',desc:'كتاب موجّه لجهة أو عميل بترويسة الشركة.',sign:true,html:`
<p>التاريخ: {{date}}</p>
<p>السادة / {{client}} &nbsp;المحترمين</p>
<p><b>الموضوع: ……………………………………</b></p>
<p>تحية طيبة وبعد،</p>
<p>…………………………………………………………………………………………………………</p>
<p>…………………………………………………………………………………………………………</p>
<p>وتفضلوا بقبول فائق الاحترام والتقدير.</p>`}
];


/* ---------- النسخ الإنكليزية للقوالب ---------- */
const DOC_EN_NAMES={blank:'Blank page','maint-contract':'Periodic Maintenance Contract','visit-report':'Maintenance Visit Report','company-profile':'Company Profile',letter:'Official Letter'};
const DOC_EN={
blank:DOC_BLANK,
'maint-contract':`
<h1>Periodic Maintenance Contract</h1>
<p style="text-align:center">Contract No.: {{ref}} &nbsp;|&nbsp; Date: {{date}}</p>
<p>This contract is made between:</p>
<p><b>First Party (Service Provider):</b> {{company}} — Address: {{companyAddress}} — Tel: {{companyPhone}}</p>
<p><b>Second Party (Client):</b> {{client}} — Address: {{clientAddress}} — Tel: {{clientPhone}}</p>
<p>The parties have agreed as follows:</p>
<h2>Article 1 — Subject of the Contract</h2>
<p>The First Party shall carry out periodic preventive maintenance of the Second Party’s security and surveillance systems at the following site: ______________________________</p>
<h2>Article 2 — Term</h2>
<p>This contract is valid for ____ months, starting on ____/____/________ and ending on ____/____/________.</p>
<h2>Article 3 — Scheduled Visits</h2>
<p>The First Party shall visit the site once every ____ (month / two months / three months), for a total of ____ visits during the term, on dates agreed in advance with the Second Party. A short report shall be provided after each visit.</p>
<h2>Article 4 — Scope of Service</h2>
<ul>
<li>Check the operation of all cameras and image quality; clean lenses and housings.</li>
<li>Check the recorder (DVR / NVR), hard drives, recording health and storage.</li>
<li>Check power supplies, batteries, cables and connectors.</li>
<li>Adjust camera angles, date/time and recording settings.</li>
<li>Update software and firmware where needed and technically possible.</li>
<li>Remove dust from equipment and internal cabinets.</li>
</ul>
<h2>Article 5 — Exclusions</h2>
<ul>
<li>The cost of spare parts and devices that must be replaced (quoted separately and subject to the Second Party’s approval).</li>
<li>Faults caused by misuse, tampering, lightning, power outages or surges, accidents or natural disasters.</li>
<li>New installations, cabling and additions beyond the existing equipment.</li>
</ul>
<h2>Article 6 — Contract Value and Payment</h2>
<table>
<thead><tr><th>Description</th><th>Amount</th><th>Currency</th><th>Due date</th></tr></thead>
<tbody>
<tr><td>First payment on signing</td><td>____________</td><td>____</td><td>__/__/____</td></tr>
<tr><td>Second payment</td><td>____________</td><td>____</td><td>__/__/____</td></tr>
<tr><td><b>Total contract value</b></td><td><b>____________</b></td><td>____</td><td></td></tr>
</tbody>
</table>
<h2>Article 7 — Emergency Call-outs</h2>
<p>In case of an urgent fault, the Second Party shall contact the First Party on the numbers above, and the First Party shall respond within ____ working hours. Emergency visits are (☐ included in this contract ☐ charged separately at ____________).</p>
<h2>Article 8 — Obligations of the Second Party</h2>
<ul>
<li>Provide access to the site and equipment on the agreed dates.</li>
<li>Provide the electrical power and network connectivity required for the system.</li>
<li>Notify the First Party immediately of any fault or change to the system.</li>
<li>Not allow third parties to modify the system during the term without the First Party’s approval.</li>
<li>Pay all instalments on their due dates.</li>
</ul>
<h2>Article 9 — Renewal and Termination</h2>
<p>This contract may be renewed by mutual agreement. Either party may terminate it with ____ days’ written notice, with all dues for the period performed to be settled.</p>
<h2>Article 10 — General Provisions</h2>
<p>Any dispute arising from this contract shall first be resolved amicably, failing which it shall be referred to the competent authority under applicable law. This contract is made in two original copies, one for each party.</p>`,
'visit-report':`
<h1>Maintenance Visit Report</h1>
<table>
<tbody>
<tr><th style="width:22%">Client</th><td>{{client}}</td><th style="width:22%">Visit date</th><td>{{date}}</td></tr>
<tr><th>Site</th><td>{{clientAddress}}</td><th>Technician</th><td></td></tr>
<tr><th>Visit type</th><td>☐ Scheduled &nbsp; ☐ Emergency &nbsp; ☐ Follow-up</td><th>Contract No.</th><td></td></tr>
</tbody>
</table>
<h2>Inspection Results</h2>
<table>
<thead><tr><th>Device / Point</th><th>Location</th><th>Condition</th><th>Action taken</th></tr></thead>
<tbody>
<tr><td></td><td></td><td></td><td></td></tr>
<tr><td></td><td></td><td></td><td></td></tr>
<tr><td></td><td></td><td></td><td></td></tr>
<tr><td></td><td></td><td></td><td></td></tr>
</tbody>
</table>
<h2>Parts Replaced / Required</h2>
<ul><li>______________________________</li></ul>
<h2>Notes and Recommendations</h2>
<div class="doc-note"><p>______________________________________________________________</p></div>`,
'company-profile':`
<h1>{{company}}</h1>
<p style="text-align:center"><b>Integrated Security Engineering &amp; Systems</b></p>
<p style="text-align:center"><b>Network Infrastructure &nbsp;•&nbsp; Access Control &nbsp;•&nbsp; Intrusion Alarms &nbsp;•&nbsp; CCTV Surveillance</b></p>
<h2>Company Profile &amp; Executive Summary</h2>
<div class="doc-note"><p>Security Mask is a premier firm specializing in integrated security systems engineering. Our methodology is built on comprehensive system analysis, robust infrastructure design (hardware &amp; software), and technical optimization. We possess full capabilities to manage projects from initial feasibility studies through to full-scale deployment, focusing on automation to ensure maximum stability and reliability.</p></div>
<h2>Core Technical Competencies</h2>
<table>
<thead><tr><th style="width:6%">#</th><th style="width:30%">Competency</th><th>Description</th></tr></thead>
<tbody>
<tr><td>1</td><td><b>Visual Surveillance System Design</b></td><td>Technical studies for CCTV &amp; IP camera distribution based on field-of-view analysis and site optimization.</td></tr>
<tr><td>2</td><td><b>Server Programming &amp; Administration</b></td><td>Expert configuration of platforms including Kantech, DSS, and Hikvision with database tuning.</td></tr>
<tr><td>3</td><td><b>Alarm Systems Integration</b></td><td>Vulnerability analysis and configuration of alarm systems using Teletek, Texecom, and Pyronix.</td></tr>
<tr><td>4</td><td><b>Access Control Systems</b></td><td>Identity management and high-security entry-point solutions tailored for sensitive facilities.</td></tr>
<tr><td>5</td><td><b>Network Engineering</b></td><td>Planning, designing, and deploying robust data transmission networks tailored for security infrastructures.</td></tr>
<tr><td>6</td><td><b>Technical Diagnostics &amp; Maintenance</b></td><td>High-level troubleshooting and preventive maintenance for hardware and software infrastructures.</td></tr>
</tbody>
</table>
<h2>Project Portfolio &amp; Key References</h2>
<h3>Governmental &amp; Diplomatic Sector</h3>
<ul>
<li><b>Directorate of Inspection &amp; Control (2025):</b> Study, design &amp; implementation of centralized surveillance network.</li>
<li><b>Embassy of Poland:</b> Technical study &amp; deployment of video surveillance.</li>
<li><b>Embassy of Greece:</b> Full security systems (CCTV, Intrusion &amp; Access Control).</li>
<li><b>Syrian Computer Society:</b> Certified technical security solutions.</li>
</ul>
<h3>Banking &amp; Hospitality Sector</h3>
<ul>
<li><b>Syria International Islamic Bank (SIIB):</b> Authorized provider for CCTV &amp; Access Control (Jan 2024 – Present).</li>
<li><b>Al-Nakheel Hotel (2026):</b> Hospitality surveillance enterprise system deployment.</li>
</ul>
<h3>NGOs &amp; Educational Institutions</h3>
<ul>
<li><b>ACSAD Organization:</b> Study, design &amp; execution of integrated security systems.</li>
<li><b>Amal Organization:</b> Security study &amp; implementation of safety systems.</li>
<li><b>Educational Sector:</b> Security frameworks for 2 private schools &amp; 1 kindergarten.</li>
</ul>
<h3>Construction, Commercial &amp; Residential</h3>
<ul>
<li><b>Marotta City &amp; Bolivar Project:</b> Advanced security solutions &amp; integration.</li>
<li><b>Aamar Buildings:</b> Integrated security, CCTV &amp; access control.</li>
<li><b>Commercial &amp; Residential:</b> 2 Luxury Villas, 8 Major Retail Outlets &amp; 5 Restaurants.</li>
</ul>
<h2>Contact Us</h2>
<table>
<tbody>
<tr><th style="width:28%">Lead Engineer</th><td>Eng. Mahmoud Johar</td></tr>
<tr><th>WhatsApp</th><td>+963 965158090</td></tr>
<tr><th>Phone</th><td>+963 930211119</td></tr>
<tr><th>Email</th><td>secmask.mj@gmail.com</td></tr>
<tr><th>Instagram</th><td>@sec_mask</td></tr>
<tr><th>Facebook</th><td>www.facebook.com/Secmask.Mj</td></tr>
</tbody>
</table>`,
letter:`
<p>Date: {{date}}</p>
<p>To: {{client}}</p>
<p><b>Subject: ______________________________</b></p>
<p>Dear Sir / Madam,</p>
<p>__________________________________________________________________________</p>
<p>__________________________________________________________________________</p>
<p>Yours faithfully,</p>`
};
function docTplHtml(t,lang){return (lang==='en'&&!t.custom&&DOC_EN[t.id])?DOC_EN[t.id]:t.html;}
function docTplName(t,lang){return (lang==='en'&&!t.custom&&DOC_EN_NAMES[t.id])?DOC_EN_NAMES[t.id]:t.name;}

/* ---------- مساعدات ---------- */
function docsAll(){db.docs=db.docs||[];db.docTemplates=db.docTemplates||[];return db.docs;}
function docsTemplates(){docsAll();return DOC_BUILTIN_TEMPLATES.concat(db.docTemplates.map(t=>Object.assign({icon:'ti-bookmark',custom:true},t)));}
const DOC_REF_PREFIX={'عقد':'CON','تقرير':'REP','بروفايل':'PRO','مراسلة':'LTR','أخرى':'DOC'};
const DOC_STATUSES={draft:['مسودة','Draft','badge-gray'],final:['نهائي','Final','badge-blue'],signed:['موقّع','Signed','badge-green']};
function docNextRef(category,dateIso){
  const pre=DOC_REF_PREFIX[category]||'DOC';
  const yr=(dateIso||localToday()).slice(0,4);
  const base=pre+'-'+yr+'-';
  let max=0;
  docsAll().forEach(function(d){
    if(d.ref&&d.ref.indexOf(base)===0){const n=parseInt(d.ref.slice(base.length),10);if(n>max)max=n;}
  });
  return base+String(max+1).padStart(3,'0');
}
function docSettings(){db.docSettings=db.docSettings||{};return db.docSettings;}
function docSafeImg(src){return (typeof src==='string'&&/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+\/=]+$/.test(src))?src:'';}
/* T12: نسخة مجمّدة من بيانات العميل بتنحفظ مع المستند وقت الإنشاء (أو لما تغيّر العميل).
   هيك تعديل اسم/عنوان/هاتف العميل بعدين ما بيغيّر مستند قديم انطبع أو انوقّع. */
function docClientSnap(clientId){
  const c=db.clients.find(x=>x.id===clientId);
  return c?{id:c.id,name:c.name||'',phone:c.phone||'',address:c.address||''}:null;
}
function docClientForDoc(d){
  if(!d||!d.clientId)return null;
  if(d.clientSnap&&d.clientSnap.id===d.clientId)return d.clientSnap;
  return docClientSnap(d.clientId); // مستند قديم قبل هالتحديث: بيتجمّد عند أول حفظ
}
function docFindTemplate(id){return docsTemplates().find(t=>t.id===id);}
function docFill(html,clientId,lang,ref,dateIso){
  const blank=lang==='en'?'__________':'……………';
  const co=db.company||{};
  const c=db.clients.find(x=>x.id===clientId)||{};
  const map={
    company:co.name||'',companyAddress:co.address||'',companyPhone:[co.phone,co.mobile].filter(Boolean).join(' / ')||blank,
    client:c.name||blank,clientAddress:c.address||blank,clientPhone:c.phone||blank,
    ref:ref||blank,
    date:fmtDate(dateIso||localToday())
  };
  return String(html).replace(/\{\{(\w+)\}\}/g,function(_,k){return esc(map[k]!==undefined?map[k]:'');});
}
function docResolveField(kind){
  const co=db.company||{};
  const v=window._docView||{};
  const curDoc=docsAll().find(x=>x.id===v.id);
  const c=((curDoc&&curDoc.clientSnap&&curDoc.clientSnap.id===v.clientId)?curDoc.clientSnap:docClientSnap(v.clientId))||{};
  return ({
    company:co.name||'',client:c.name||'',clientPhone:c.phone||'',clientAddress:c.address||'',
    date:fmtDate(localToday())
  })[kind]||'';
}

/* ---------- الصفحة الرئيسية: قوالب + مستنداتي ---------- */
function renderDocs(el,acts){
  docsInjectCss();
  if(window._docView){renderDocEditor(el,acts);return;}
  const list=docsAll();
  const q=(window._docSearch||'').trim().toLowerCase();
  const cat=window._docCat||'all';
  const rows=list.filter(d=>{
    if(cat!=='all'&&d.category!==cat)return false;
    if(q){
      const cn=(db.clients.find(c=>c.id===d.clientId)||{}).name||'';
      if(!(d.title+' '+cn+' '+(d.ref||'')).toLowerCase().includes(q))return false;
    }
    return true;
  }).sort((a,b)=>String(b.updated||'').localeCompare(String(a.updated||'')));
  acts.innerHTML=`<button class="btn" onclick="docSettingsModal()"><i class="ti ti-settings"></i> إعدادات المستندات</button><button class="btn btn-primary" onclick="docNewModal('blank')"><i class="ti ti-plus"></i> مستند جديد</button>`;
  el.innerHTML=`
  <div style="font-weight:800;margin-bottom:8px"><i class="ti ti-template"></i> القوالب</div>
  <div class="doc-tpl-grid">
    ${docsTemplates().map(t=>`<div class="doc-tpl-card">
      <i class="ti ${esc(t.icon||'ti-file')} big"></i>
      <div class="nm">${esc(t.name)}</div>
      ${(!t.custom&&DOC_EN_NAMES[t.id])?`<div class="en">${esc(DOC_EN_NAMES[t.id])}</div>`:(t.custom?`<div class="en"><span class="doc-lang">${t.lang==='en'?'EN':'AR'}</span></div>`:'')}
      <div class="ds">${esc(t.desc||('قالب محفوظ — '+(t.category||'')))}</div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm btn-primary" onclick="docNewModal('${t.id}')"><i class="ti ti-file-plus"></i> استخدام</button>
        ${t.custom?`<button class="btn btn-sm btn-danger" title="حذف القالب" onclick="docDeleteTemplate('${t.id}')"><i class="ti ti-trash"></i></button>`:''}
      </div>
    </div>`).join('')}
  </div>
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">
      <div class="form-group"><label class="form-label">بحث</label>
        <input type="text" class="form-control" style="width:200px" placeholder="عنوان المستند أو العميل..." value="${esc(window._docSearch||'')}" oninput="window._docSearch=this.value;renderDocs(document.getElementById('main-content'),document.getElementById('topbar-actions'))"></div>
      <div class="form-group"><label class="form-label">التصنيف</label>
        <select class="form-control" style="width:150px" onchange="window._docCat=this.value;renderDocs(document.getElementById('main-content'),document.getElementById('topbar-actions'))">
          <option value="all">الكل</option>
          ${DOC_CATEGORIES.map(c=>`<option ${cat===c?'selected':''}>${c}</option>`).join('')}
        </select></div>
      <div style="font-size:12px;color:var(--text2);padding-bottom:6px;margin-right:auto">${rows.length} مستند</div>
    </div>
  </div>
  <div class="card"><div style="overflow-x:auto">${!rows.length?`<div class="empty-state"><i class="ti ti-file-text"></i><p>${list.length?'ما في مستندات بهالفلتر':'ما في مستندات بعد — اختار قالب من فوق وابدأ'}</p></div>`:`
    <table class="responsive-table"><thead><tr><th>العنوان</th><th>التصنيف</th><th>اللغة</th><th>العميل</th><th>آخر تعديل</th><th style="width:170px"></th></tr></thead><tbody>
    ${rows.map(d=>{const c=db.clients.find(x=>x.id===d.clientId);return `<tr>
      <td data-label="العنوان"><a href="javascript:void(0)" style="font-weight:700;color:var(--accent)" onclick="docOpen('${d.id}')">${esc(d.title||'بدون عنوان')}</a>${d.ref?`<div style="font-size:11px;color:var(--text2);direction:ltr;text-align:right">${esc(d.ref)}</div>`:''}</td>
      <td data-label="التصنيف"><span class="badge badge-amber">${esc(d.category||'أخرى')}</span> ${(()=>{const st=DOC_STATUSES[d.status||'draft']||DOC_STATUSES.draft;return `<span class="badge ${st[2]}">${st[0]}</span>`;})()}</td>
      <td data-label="اللغة"><span class="doc-lang">${d.lang==='en'?'EN':'AR'}</span></td>
      <td data-label="العميل">${esc(c?c.name:'—')}</td>
      <td data-label="آخر تعديل">${fmtDate((d.updated||'').slice(0,10))}</td>
      <td data-label=""><div style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="btn btn-sm" title="فتح/تعديل" onclick="docOpen('${d.id}')"><i class="ti ti-edit"></i></button>
        <button class="btn btn-sm" title="طباعة / PDF" onclick="docPrintById('${d.id}')"><i class="ti ti-printer"></i></button>
        <button class="btn btn-sm" title="تصدير Word" onclick="docWordById('${d.id}')"><i class="ti ti-download"></i></button>
        <button class="btn btn-sm" title="نسخة مكررة" onclick="docDuplicate('${d.id}')"><i class="ti ti-copy"></i></button>
        <button class="btn btn-sm btn-danger" title="حذف" onclick="docDelete('${d.id}')"><i class="ti ti-trash"></i></button>
      </div></td></tr>`;}).join('')}
    </tbody></table>`}</div></div>`;
}

/* ---------- إنشاء مستند جديد من قالب ---------- */
function docNewModal(tplId){
  const t=docFindTemplate(tplId)||DOC_BUILTIN_TEMPLATES[0];
  showModal(`<div class="modal-title">مستند جديد</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">القالب</label>
        <select class="form-control" id="doc-new-tpl" onchange="docNewSync()">
          ${docsTemplates().map(x=>`<option value="${x.id}" ${x.id===t.id?'selected':''}>${esc(x.name)}${(!x.custom&&DOC_EN_NAMES[x.id])?' / '+esc(DOC_EN_NAMES[x.id]):''}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">لغة المستند</label>
        <select class="form-control" id="doc-new-lang" onchange="docNewSync()">
          <option value="ar">العربية (من اليمين لليسار)</option>
          <option value="en">English (left to right)</option>
        </select></div>
    </div>
    <div class="form-group"><label class="form-label">عنوان المستند</label>
      <input class="form-control" id="doc-new-title" value="${esc(t.name)}"></div>
    <div class="form-group"><label class="form-label">العميل (اختياري — بينعبّى اسمه وبياناته تلقائياً)</label>
      <select class="form-control" id="doc-new-client"><option value="">— بدون —</option>
        ${db.clients.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar')).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}
      </select></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="docCreate()">إنشاء وفتح</button></div>`);
  docNewSync();
}
function docNewSync(){
  const t=docFindTemplate(document.getElementById('doc-new-tpl').value)||DOC_BUILTIN_TEMPLATES[0];
  const ls=document.getElementById('doc-new-lang');
  if(t.custom){ls.value=t.lang||'ar';ls.disabled=true;}else ls.disabled=false;
  document.getElementById('doc-new-title').value=docTplName(t,ls.value);
}
function docCreate(){
  const t=docFindTemplate(document.getElementById('doc-new-tpl').value)||DOC_BUILTIN_TEMPLATES[0];
  const lang=t.custom?(t.lang||'ar'):document.getElementById('doc-new-lang').value;
  const title=document.getElementById('doc-new-title').value.trim()||docTplName(t,lang);
  const clientId=document.getElementById('doc-new-client').value;
  const now=new Date().toISOString();
  const category=t.category||'أخرى';
  const dateIso=now.slice(0,10);
  const ref=docNextRef(category,dateIso);
  const d={id:uid(),title,lang,category,clientId,ref,date:dateIso,status:'draft',sign:!!t.sign,stamp:!!t.sign,html:docSanitize(docFill(docTplHtml(t,lang),clientId,lang,ref,dateIso)),clientSnap:docClientSnap(clientId),created:now,updated:now};
  docsAll().unshift(d);
  saveDB(db);
  logAction('إضافة','مستند',title);
  closeModal();
  docOpen(d.id);
}

/* ---------- المحرر ---------- */
function docOpen(id){
  const d=docsAll().find(x=>x.id===id);if(!d)return;
  window._docView={id:d.id,clientId:d.clientId||''};
  window._docDirty=false;
  render();
}
function docBack(){
  if(window._docDirty&&!confirm('عندك تعديلات بالمستند ما انحفظت. بدك ترجع بدون حفظ؟'))return;
  window._docDirty=false;window._docView=null;render();
}
function renderDocEditor(el,acts){
  const d=docsAll().find(x=>x.id===(window._docView||{}).id);
  if(!d){window._docView=null;renderDocs(el,acts);return;}
  acts.innerHTML=`<button class="btn" onclick="docBack()"><i class="ti ti-arrow-right"></i> رجوع</button>
    <button class="btn" onclick="docSaveAsTemplate()"><i class="ti ti-bookmark-plus"></i> حفظ كقالب</button>
    <button class="btn" onclick="docWordCurrent()"><i class="ti ti-download"></i> Word</button>
    <button class="btn" onclick="docPrintCurrent()"><i class="ti ti-printer"></i> طباعة / PDF</button>
    <button class="btn btn-primary" onclick="docSave()"><i class="ti ti-device-floppy"></i> حفظ</button>`;
  el.innerHTML=`
  <div class="card" style="margin-bottom:12px">
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
      <div class="form-group" style="flex:2;min-width:200px"><label class="form-label">العنوان</label>
        <input class="form-control" id="doc-title" value="${esc(d.title)}" oninput="window._docDirty=true"></div>
      <div class="form-group" style="min-width:130px"><label class="form-label">التصنيف</label>
        <select class="form-control" id="doc-cat" onchange="window._docDirty=true">${DOC_CATEGORIES.map(c=>`<option ${d.category===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="form-group" style="flex:1;min-width:160px"><label class="form-label">العميل</label>
        <select class="form-control" id="doc-client" onchange="window._docView.clientId=this.value;window._docDirty=true"><option value="">— بدون —</option>
          ${db.clients.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar')).map(c=>`<option value="${c.id}" ${d.clientId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="form-group" style="min-width:120px"><label class="form-label">اللغة</label>
        <select class="form-control" id="doc-lang" onchange="docSetLang(this.value)"><option value="ar" ${d.lang!=='en'?'selected':''}>العربية</option><option value="en" ${d.lang==='en'?'selected':''}>English</option></select></div>
      <label class="checkbox-label" style="padding-bottom:8px"><input type="checkbox" id="doc-sign" ${d.sign?'checked':''} onchange="window._docDirty=true"> <span>خانات توقيع بالطباعة</span></label>
      <label class="checkbox-label" style="padding-bottom:8px" title="بيظهر الختم والتوقيع جوا خانة الطرف الأول (بيشتغل مع خانات التوقيع)"><input type="checkbox" id="doc-stamp" ${d.stamp?'checked':''} onchange="window._docDirty=true"> <span>ختم وتوقيع الشركة</span></label>
      <div class="form-group" style="min-width:150px"><label class="form-label">الرقم المرجعي</label>
        <input class="form-control" id="doc-ref" dir="ltr" value="${esc(d.ref||'')}" oninput="window._docDirty=true"></div>
      <div class="form-group" style="min-width:140px"><label class="form-label">تاريخ المستند</label>
        <input type="date" class="form-control" id="doc-date" value="${esc(d.date||(d.created||'').slice(0,10))}" onchange="window._docDirty=true"></div>
      <div class="form-group" style="min-width:120px"><label class="form-label">الحالة</label>
        <select class="form-control" id="doc-status" onchange="window._docDirty=true">${Object.keys(DOC_STATUSES).map(k=>`<option value="${k}" ${(d.status||'draft')===k?'selected':''}>${DOC_STATUSES[k][0]}</option>`).join('')}</select></div>
    </div>
  </div>
  <div class="doc-tb" onmousedown="if(event.target.tagName!=='SELECT'&&event.target.tagName!=='INPUT')event.preventDefault()">
    <button title="عريض" onclick="docCmd('bold')"><b>B</b></button>
    <button title="مائل" onclick="docCmd('italic')"><i>I</i></button>
    <button title="تحته خط" onclick="docCmd('underline')"><u>U</u></button>
    <span class="sep"></span>
    <button title="عنوان رئيسي" onclick="docCmd('formatBlock','<h1>')">H1</button>
    <button title="عنوان فرعي" onclick="docCmd('formatBlock','<h2>')">H2</button>
    <button title="عنوان صغير" onclick="docCmd('formatBlock','<h3>')">H3</button>
    <button title="فقرة عادية" onclick="docCmd('formatBlock','<p>')">¶</button>
    <span class="sep"></span>
    <button title="قائمة نقطية" onclick="docCmd('insertUnorderedList')"><i class="ti ti-list"></i></button>
    <button title="قائمة مرقّمة" onclick="docCmd('insertOrderedList')"><i class="ti ti-list-numbers"></i></button>
    <span class="sep"></span>
    <button title="يمين" onclick="docCmd('justifyRight')"><i class="ti ti-align-right"></i></button>
    <button title="وسط" onclick="docCmd('justifyCenter')"><i class="ti ti-align-center"></i></button>
    <button title="يسار" onclick="docCmd('justifyLeft')"><i class="ti ti-align-left"></i></button>
    <span class="sep"></span>
    <input type="color" title="لون الخط" value="#9C7A2E" onchange="docCmd('foreColor',this.value)">
    <button title="جدول" onclick="docInsertTable()"><i class="ti ti-table"></i> جدول</button>
    <button title="خط فاصل" onclick="docCmd('insertHorizontalRule')">―</button>
    <button title="مربع ملاحظة مميّز" onclick="docInsertNote()"><i class="ti ti-notes"></i> ملاحظة</button>
    <span class="sep"></span>
    <select title="إدراج حقل" onchange="docInsertField(this.value);this.value=''">
      <option value="">+ إدراج حقل…</option>
      <option value="company">اسم الشركة</option>
      <option value="client">اسم العميل</option>
      <option value="clientPhone">هاتف العميل</option>
      <option value="clientAddress">عنوان العميل</option>
      <option value="date">تاريخ اليوم</option>
    </select>
    <span class="sep"></span>
    <button title="تراجع" onclick="docCmd('undo')"><i class="ti ti-arrow-back-up"></i></button>
    <button title="إعادة" onclick="docCmd('redo')"><i class="ti ti-arrow-forward-up"></i></button>
  </div>
  <div class="doc-paper"><div id="doc-editor" class="doc-body doc-editor" contenteditable="true" dir="${d.lang==='en'?'ltr':'rtl'}" spellcheck="true">${d.html||DOC_BLANK}</div></div>`;
  const ed=document.getElementById('doc-editor');
  ed.addEventListener('input',function(){window._docDirty=true;});
  ed.addEventListener('paste',function(e){
    e.preventDefault();
    const cd=e.clipboardData||window.clipboardData;
    const html=cd.getData('text/html'),txt=cd.getData('text/plain');
    if(html)document.execCommand('insertHTML',false,docSanitize(html));
    else document.execCommand('insertText',false,txt);
  });
  try{document.execCommand('styleWithCSS',false,true);}catch(e){}
}
function docCmd(cmd,val){
  const ed=document.getElementById('doc-editor');if(!ed)return;
  ed.focus();
  document.execCommand(cmd,false,val===undefined?null:val);
  window._docDirty=true;
}
function docSetLang(l){
  const ed=document.getElementById('doc-editor');if(!ed)return;
  ed.setAttribute('dir',l==='en'?'ltr':'rtl');
  window._docDirty=true;
}
function docInsertNote(){
  docCmd('insertHTML','<div class="doc-note"><p>&nbsp;</p></div><p><br></p>');
}
function docInsertTable(){
  const r=parseInt(prompt('عدد الصفوف (مع صف العناوين):','3'),10);
  if(!r||r<1||r>40)return;
  const c=parseInt(prompt('عدد الأعمدة:','3'),10);
  if(!c||c<1||c>8)return;
  let h='<table><thead><tr>'+'<th>&nbsp;</th>'.repeat(c)+'</tr></thead><tbody>';
  for(let i=1;i<r;i++)h+='<tr>'+'<td>&nbsp;</td>'.repeat(c)+'</tr>';
  h+='</tbody></table><p><br></p>';
  docCmd('insertHTML',h);
}
function docInsertField(kind){
  if(!kind)return;
  const v=docResolveField(kind);
  if(!v){alert(kind.indexOf('client')===0?'اختار العميل من الأعلى أول.':'ما في قيمة محفوظة لهالحقل.');return;}
  docCmd('insertText',v);
}
function docReadEditor(){
  const ed=document.getElementById('doc-editor');
  return docSanitize(ed?ed.innerHTML:'');
}
function docSave(silent){
  const d=docsAll().find(x=>x.id===(window._docView||{}).id);if(!d)return false;
  d.title=(document.getElementById('doc-title').value||'').trim()||'بدون عنوان';
  d.category=document.getElementById('doc-cat').value;
  const _newClientId=document.getElementById('doc-client').value;
  if(_newClientId!==d.clientId||!d.clientSnap||d.clientSnap.id!==_newClientId)d.clientSnap=docClientSnap(_newClientId);
  d.clientId=_newClientId;
  d.sign=document.getElementById('doc-sign').checked;
  d.lang=document.getElementById('doc-lang').value;
  d.stamp=document.getElementById('doc-stamp').checked;
  d.ref=(document.getElementById('doc-ref').value||'').trim();
  d.date=document.getElementById('doc-date').value||d.date||'';
  d.status=document.getElementById('doc-status').value;
  d.html=docReadEditor();
  d.updated=new Date().toISOString();
  saveDB(db);
  window._docDirty=false;
  if(silent!==true)alert('تم حفظ المستند ✓');
  return true;
}
function docSaveAsTemplate(){
  const name=prompt('اسم القالب الجديد:',(document.getElementById('doc-title').value||'').trim());
  if(!name||!name.trim())return;
  docsAll();
  db.docTemplates.push({id:'c'+uid(),name:name.trim(),lang:document.getElementById('doc-lang').value,category:document.getElementById('doc-cat').value,sign:document.getElementById('doc-sign').checked,html:docReadEditor()});
  saveDB(db);
  logAction('إضافة','قالب مستند',name.trim());
  alert('انحفظ القالب. بتلاقيه بأول الصفحة مع القوالب.');
}
function docDeleteTemplate(id){
  if(!guardDelete())return;
  const t=db.docTemplates.find(x=>x.id===id);if(!t)return;
  if(!confirm('حذف القالب "'+t.name+'"؟ (المستندات اللي انعملت منه ما بتتأثر)'))return;
  db.docTemplates=db.docTemplates.filter(x=>x.id!==id);
  saveDB(db);render();
}
function docDuplicate(id){
  const d=docsAll().find(x=>x.id===id);if(!d)return;
  const now=new Date().toISOString();
  docsAll().unshift(Object.assign({},d,{id:uid(),title:d.title+' (نسخة)',ref:docNextRef(d.category,now.slice(0,10)),date:now.slice(0,10),status:'draft',created:now,updated:now}));
  saveDB(db);render();
}
function docDelete(id){
  if(!guardDelete())return;
  const d=docsAll().find(x=>x.id===id);if(!d)return;
  if(!confirm('حذف المستند "'+d.title+'"؟'))return;
  db.docs=db.docs.filter(x=>x.id!==id);
  saveDB(db);
  logAction('حذف','مستند',d.title);
  render();
}

/* ---------- الطباعة / PDF ---------- */
function docBuildPrintHTML(d){
  const co=db.company||{};
  const st=docSettings();
  const en=d.lang==='en',dir=en?'ltr':'rtl',al=en?'right':'left';
  const cl=docClientForDoc(d);
  const stampImg=d.stamp?docSafeImg(st.stamp):'',sigImg=d.stamp?docSafeImg(st.signature):'';
  const signer=d.stamp?[st.signerName,st.signerTitle].filter(Boolean).map(esc).join(' — '):'';
  const sign=d.sign?`<div class="print-sign-row">
    <div class="print-sign-box"><div style="min-height:${(stampImg||sigImg)?'84':'46'}px;display:flex;align-items:flex-end;justify-content:center;gap:12px;padding-bottom:6px">${sigImg?`<img src="${esc(sigImg)}" alt="" style="max-height:70px;max-width:130px;object-fit:contain">`:''}${stampImg?`<img src="${esc(stampImg)}" alt="" style="max-height:84px;max-width:100px;object-fit:contain">`:''}</div>
      ${en?'First Party':'الطرف الأول'} — ${esc(co.name||(en?'Company':'الشركة'))}${signer?`<div style="font-weight:500;font-size:11.5px;color:#6b6552;margin-top:2px">${signer}</div>`:''}</div>
    <div class="print-sign-box"><div style="min-height:${(stampImg||sigImg)?'84':'46'}px"></div>${en?'Second Party':'الطرف الثاني'}${cl?' — '+esc(cl.name):''}</div></div>`:'';
  const dateIso=(d.date||(d.updated?localISODate(d.updated):localToday()));
  const draft=(d.status||'draft')==='draft';
  return `<div class="print-doc is-doc" data-nofit="1" dir="${dir}">
    <div class="print-header">${getCompanyHeader()}
      <div><div class="print-doc-type" style="text-align:${al}">${esc(d.title||'')}</div>
      <div class="print-doc-meta" style="text-align:${al}">${d.ref?`<span style="direction:ltr;unicode-bidi:embed">${esc(d.ref)}</span><br>`:''}${esc(fmtDate(dateIso))}${draft?`<br><b style="color:#B06A3F">${en?'DRAFT':'مسودة'}</b>`:''}</div></div>
    </div>
    <div class="doc-body" dir="${dir}">${docSanitize(d.html)}</div>
    ${sign}
    <div class="print-footer">
      ${co.printNote?`<div style="font-weight:600;color:#374151;margin-bottom:2px">${esc(co.printNote)}</div>`:''}
      ${co.email?`<div>${esc(co.email)}</div>`:''}
      <div>© ${new Date().getFullYear()} ${esc(co.name||'Security Mask')}</div>
    </div>
  </div>${PRINT_ACTIONS_BAR}`;
}

/* ---------- تصدير Word (.doc) ---------- */
function docWordHTML(d){
  const co=db.company||{};
  const en=d.lang==='en',dir=en?'ltr':'rtl',al=en?'left':'right';
  const cl=docClientForDoc(d);
  const dateIso=(d.date||(d.updated?localISODate(d.updated):localToday()));
  const st=docSettings();
  const signer=d.stamp?[st.signerName,st.signerTitle].filter(Boolean).map(esc).join(' — '):'';
  const sign=d.sign?`<table style="width:100%;margin-top:40px;border:none"><tr>
    <td style="width:50%;text-align:center;border:none;border-top:1px solid #9C7A2E;padding-top:8px">${en?'First Party':'الطرف الأول'} — ${esc(co.name||'')}${signer?'<br>'+signer:''}</td>
    <td style="width:4%;border:none"></td>
    <td style="width:46%;text-align:center;border:none;border-top:1px solid #9C7A2E;padding-top:8px">${en?'Second Party':'الطرف الثاني'}${cl?' — '+esc(cl.name):''}</td></tr></table>`:'';
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(d.title||'')}</title>
<style>
@page{size:A4;margin:2cm}
body{font-family:${en?'Calibri,Arial':'Arial,Tahoma'},sans-serif;font-size:12pt;line-height:1.6;direction:${dir};text-align:${al};color:#1f2430}
h1{font-size:20pt;text-align:center;color:#12151C;border-bottom:3px solid #C9A24B;padding-bottom:4pt}
h2{font-size:13pt;color:#12151C;background:#F7F2E4;padding:3pt 8pt;margin-top:14pt}
h3{font-size:12pt;color:#9C7A2E}
table{border-collapse:collapse;width:100%}
td,th{border:1px solid #D9CCA0;padding:5pt 7pt;text-align:${al};vertical-align:top}
thead th{background:#12151C;color:#fff}
tbody th{background:#F4EEDC}
.doc-note{background:#FBF6E6;border:1px solid #EADFC0;padding:6pt 10pt}
</style></head><body dir="${dir}">
<table style="border:none;margin-bottom:10pt"><tr>
<td style="border:none;border-bottom:3px double #9C7A2E"><b style="font-size:16pt">${esc(co.name||'')}</b><br><span style="font-size:10pt;color:#6b6552">${esc(co.address||'')}${co.email?' | '+esc(co.email):''}</span></td>
<td style="border:none;border-bottom:3px double #9C7A2E;text-align:${en?'right':'left'};font-size:10pt;color:#6b6552">${d.ref?esc(d.ref)+'<br>':''}${esc(fmtDate(dateIso))}</td></tr></table>
${docSanitize(d.html)}${sign}</body></html>`;
}
function docWordDownload(d){
  const blob=new Blob(['\ufeff',docWordHTML(d)],{type:'application/msword'});
  const name=((d.ref?d.ref+' - ':'')+(d.title||'document')).replace(/[\\/:*?"<>|]+/g,' ').trim();
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name+'.doc';
  document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1000);
}
function docWordCurrent(){
  if(!docSave(true))return;
  docWordById((window._docView||{}).id);
}
function docWordById(id){
  const d=docsAll().find(x=>x.id===id);if(!d)return;
  docWordDownload(d);
}

/* ---------- إعدادات المستندات: الختم والتوقيع واسم الموقّع ---------- */
function docSettingsModal(){
  const st=docSettings();
  window._docSetTmp={stamp:docSafeImg(st.stamp),signature:docSafeImg(st.signature)};
  showModal(`<div class="modal-title">إعدادات المستندات</div>
    <div class="form-row cols-2">
      <div class="form-group"><label class="form-label">اسم الموقّع عن الشركة</label><input class="form-control" id="docset-name" value="${esc(st.signerName||'')}"></div>
      <div class="form-group"><label class="form-label">صفته</label><input class="form-control" id="docset-title" value="${esc(st.signerTitle||'')}" placeholder="مثال: المدير العام"></div>
    </div>
    ${['stamp','signature'].map(k=>`<div class="form-group"><label class="form-label">${k==='stamp'?'ختم الشركة':'توقيع المدير'} (صورة PNG شفافة أفضل)</label>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div id="docset-prev-${k}" style="width:110px;height:84px;border:1px dashed var(--border2);border-radius:8px;display:flex;align-items:center;justify-content:center;background:#fff;overflow:hidden">${window._docSetTmp[k]?`<img src="${esc(window._docSetTmp[k])}" style="max-width:100%;max-height:100%">`:'<span style="font-size:11px;color:#999">لا يوجد</span>'}</div>
        <input type="file" accept="image/*" onchange="docImgPick('${k}',this)">
        <button class="btn btn-sm" onclick="docImgClear('${k}')">إزالة</button>
      </div></div>`).join('')}
    <div style="font-size:12px;color:var(--text2)">بتنضغط الصورة تلقائياً وبتظهر بخانة الطرف الأول عند الطباعة لما تفعّل "ختم وتوقيع الشركة" بالمستند.</div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="docSettingsSave()">حفظ</button></div>`);
}
function docImgPick(kind,input){
  const f=input.files&&input.files[0];if(!f)return;
  const fr=new FileReader();
  fr.onload=function(){
    const img=new Image();
    img.onload=function(){
      const max=400,r=Math.min(1,max/Math.max(img.width,img.height));
      const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*r));c.height=Math.max(1,Math.round(img.height*r));
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      const url=c.toDataURL('image/png');
      window._docSetTmp[kind]=url;
      document.getElementById('docset-prev-'+kind).innerHTML=`<img src="${url}" style="max-width:100%;max-height:100%">`;
    };
    img.onerror=function(){alert('تعذّر قراءة الصورة.');};
    img.src=fr.result;
  };
  fr.readAsDataURL(f);
}
function docImgClear(kind){
  window._docSetTmp[kind]='';
  document.getElementById('docset-prev-'+kind).innerHTML='<span style="font-size:11px;color:#999">لا يوجد</span>';
}
function docSettingsSave(){
  const st=docSettings();
  st.signerName=document.getElementById('docset-name').value.trim();
  st.signerTitle=document.getElementById('docset-title').value.trim();
  st.stamp=window._docSetTmp.stamp||'';
  st.signature=window._docSetTmp.signature||'';
  saveDB(db);closeModal();
}
function docPrintCurrent(){
  if(!docSave(true))return;
  docPrintById((window._docView||{}).id);
}
function docPrintById(id){
  const d=docsAll().find(x=>x.id===id);if(!d)return;
  setPrintFile('doc',d.title||'',d.ref||'');
  showPrintArea(docBuildPrintHTML(d));
}
