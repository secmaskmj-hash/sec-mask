/* Auth gate → resolve the real company for this user → reload local data
   under the real tenant code → render → start cloud sync. Until this
   completes, the auth overlay (z-index 9999) covers the placeholder-data UI
   that booted synchronously earlier in this script, so nothing real is ever
   shown or synced under the wrong (or missing) identity. */
document.addEventListener('DOMContentLoaded',function(){
  _sb.auth.getSession().then(function(res){
    const session=res.data&&res.data.session;
    return session?session.user:showAuthGate();
  }).then(function(user){
    _authUser=user;
    return resolveCompanyForUser(user);
  }).then(function(realTenantCode){
    TENANT_CODE=realTenantCode;
    db=loadDB();
    normalizeDB();
    render();
    checkLock();
    if(typeof initCloudSync==='function')initCloudSync();
  }).catch(function(e){
    console.error('Auth/company resolution failed:',e);
    // لازم نشيل شاشة الانتظار كمان، مش بس نطلع رسالة — قبل هيك كان
    // المستخدم يضل عالق على دوّامة التحميل للأبد لو فشل تسجيل الدخول.
    var gate=document.getElementById('sync-gate');
    if(gate){
      gate.innerHTML='<div style="max-width:380px">'+
        '<div style="font-size:34px;margin-bottom:12px">⚠️</div>'+
        '<div style="font-size:15px;font-weight:700;margin-bottom:8px">تعذّر الوصول لبيانات شركتك</div>'+
        '<div style="font-size:12px;opacity:.8;line-height:1.9;margin-bottom:16px">تأكد من الاتصال بالإنترنت وحاول من جديد. بياناتك المحفوظة بالجهاز ما صار فيها شي.</div>'+
        '<button onclick="location.reload()" style="padding:11px 22px;border-radius:9px;cursor:pointer;font-family:inherit;font-weight:700;font-size:13px;background:linear-gradient(135deg,#B06A3F,#8A4F2C);border:1px solid #8A4F2C;color:#fff">إعادة المحاولة</button>'+
        '</div>';
    }
  });
});
