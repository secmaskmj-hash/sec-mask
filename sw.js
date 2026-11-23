/* ====================================================================
   sw.js — Service Worker
   كان `sw-register.js` بالنسخة القديمة يحاول يسجّل هالملف وهو أصلاً
   مش موجود بالمشروع، فكل مرة كان يرجع 404 والتسجيل يفشل بصمت
   (الخطأ كان متلقّط بـ catch). يعني: ما كان في أي عمل بدون إنترنت،
   وما كان التطبيق ينزاد على الشاشة الرئيسية كتطبيق فعلي.

   القواعد هون مقصودة ومحافظة:
   1) أي طلب مش GET → عدا عالسيرفر مباشرة، ولا تتدخّل.
   2) أي طلب لـ Supabase (بيانات/مصادقة/Realtime) → ما ينخزّن أبداً.
      تخزين بيانات الشركة بالكاش بيعني عرض أرقام قديمة، وهاد أخطر من
      إنك ما تشوف شي. المزامنة لازم تضل من الشبكة حصراً.
   3) صفحة التطبيق (navigation) → الشبكة أولاً، والكاش بس لما ينقطع النت.
      هيك أي نشر جديد بيوصل فوراً من دون ما يعلق المستخدم بنسخة قديمة.
   4) ملفات المشروع (js/css/صور) → من الكاش فوراً مع تحديث بالخلفية.
      لأنها كلها مربوطة بـ ?v=APP_VERSION، فأي تحديث بيغيّر الرابط
      وبينحمّل من جديد لحاله.
   5) مكتبات الـCDN بروابط نسخة مثبّتة → كاش دائم (ما بتتغيّر أبداً).
   ==================================================================== */

const VERSION = '4.9.2';
const APP_CACHE = 'sm-app-' + VERSION;
const CDN_CACHE = 'sm-cdn-v1';

const PRECACHE = [
  './',
  './index.html',
  './style.css?v=' + VERSION,
  './mobile.css?v=' + VERSION,
  './core.js?v=' + VERSION,
  './store.js?v=' + VERSION,
  './pro-filters.js?v=' + VERSION,
  './ux-boost.js?v=' + VERSION,
  './mobile.js?v=' + VERSION,
  './sw-register.js?v=' + VERSION,
  // الوحدات اللي بتنحمّل عند الحاجة (loadBundle بـ core.js) — بدونها ما بتفتح صفحات كاملة بدون إنترنت
  './ops.js?v=' + VERSION,
  './people.js?v=' + VERSION,
  './assets.js?v=' + VERSION,
  './settings.js?v=' + VERSION,
  './wallet.js?v=' + VERSION,
  './docs.js?v=' + VERSION,
  './contracts.js?v=' + VERSION,
  './inventory.js?v=' + VERSION,
  './pipeline.js?v=' + VERSION,
  './payroll.js?v=' + VERSION,
  './analytics.js?v=' + VERSION,
  './myvisits.js?v=' + VERSION,
  './field.js?v=' + VERSION,
  './icons/icon-192.png',
  './images/image1.png',
  './manifest.json'
];

const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(APP_CACHE)
      // addAll بيفشل كله لو ملف واحد فشل، فمنحمّل كل واحد لحاله
      .then(function (cache) {
        return Promise.all(PRECACHE.map(function (u) {
          return cache.add(u).catch(function () { /* تجاهل أي ملف مفقود */ });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== APP_CACHE && k !== CDN_CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isSupabase(url) {
  return url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in');
}

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  // (2) بيانات المزامنة: ما إلنا شغل فيها إطلاقاً
  if (isSupabase(url)) return;

  // (3) فتح التطبيق نفسه
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          const copy = res.clone();
          caches.open(APP_CACHE).then(function (c) { c.put('./index.html', copy); });
          return res;
        })
        .catch(function () {
          return caches.match('./index.html').then(function (r) {
            return r || new Response(
              '<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;direction:rtl;padding:40px;text-align:center">ما في اتصال بالإنترنت، وما في نسخة محفوظة بعد.</body>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          });
        })
    );
    return;
  }

  // (5) مكتبات CDN بنسخ مثبّتة — كاش أولاً، ما بتتغيّر
  if (CDN_HOSTS.indexOf(url.hostname) !== -1) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CDN_CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        });
      })
    );
    return;
  }

  // (4) ملفات المشروع: من الكاش فوراً + تحديث بالخلفية
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        const network = fetch(req).then(function (res) {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(APP_CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        }).catch(function () { return hit; });
        return hit || network;
      })
    );
  }
});

// رسالة من الصفحة لتفعيل نسخة جديدة فوراً من دون انتظار
self.addEventListener('message', function (e) {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
