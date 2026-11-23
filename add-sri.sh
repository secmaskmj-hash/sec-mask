#!/usr/bin/env bash
# add-sri.sh — بيحسب بصمة SRI لسكربت Supabase ولستايل Tabler وبيضيفها على index.html
# التشغيل (مرة وحدة، لازم إنترنت):   bash add-sri.sh
# لما تغيّر رقم نسخة المكتبة بـ index.html، شغّله من جديد.
set -euo pipefail
f="index.html"
patch() {
  local url="$1" tag="$2"
  local h; h="sha384-$(curl -fsSL "$url" | openssl dgst -sha384 -binary | openssl base64 -A)"
  python3 - "$f" "$url" "$h" "$tag" <<'PY'
import sys,re
f,url,h,tag=sys.argv[1:5]
s=open(f,encoding='utf-8').read()
pat=re.compile(r'<'+tag+r'\b[^>]*'+re.escape(url)+r'[^>]*>')
m=pat.search(s)
if not m: sys.exit('ما لقيت '+url)
el=m.group(0)
el=re.sub(r'\s+integrity="[^"]*"','',el)
el=re.sub(r'\s+crossorigin="[^"]*"','',el)
el=el[:-1].rstrip('/').rstrip()+' integrity="'+h+'" crossorigin="anonymous">'
s=s[:m.start()]+el+s[m.end():]
open(f,'w',encoding='utf-8').write(s)
print('تم:',url)
PY
}
patch "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js" script
patch "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css" link
