/* تسجيل الـService Worker + تنبيه المستخدم لما ينزل تحديث جديد.
   قبل هيك كان يسجّل /sw.js وهو ملف غير موجود (404)، فما كان في لا عمل
   بدون إنترنت ولا تثبيت للتطبيق على الشاشة الرئيسية. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').then(function (reg) {

      // لما توصل نسخة جديدة من الكود، منبّه المستخدم بدل ما نفرض إعادة تحميل
      // وهو نص كاتب بنموذج.
      reg.addEventListener('updatefound', function () {
        var sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', function () {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            if (typeof renderSyncBanner === 'function') {
              renderSyncBanner('warn', '⬆️ في نسخة جديدة من التطبيق — حدّث الصفحة لتشتغل عندك');
            }
          }
        });
      });

      // فحص دوري للتحديثات (كل ساعة) لأجهزة بتضل مفتوحة أيام
      setInterval(function () { reg.update().catch(function () {}); }, 60 * 60 * 1000);

    }).catch(function (err) {
      console.log('SW registration failed:', err);
    });
  });
}
