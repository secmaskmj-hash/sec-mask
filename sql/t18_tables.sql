-- T18: جداول السحابة للبيانات الكبيرة + RLS
-- شغّله مرة وحدة بـ Supabase → SQL Editor. آمن لإعادة التشغيل (IF NOT EXISTS).
-- الملكية: companies.owner_uid = auth.uid()  (نفس منطق T1)

do $$
declare t text;
begin
  foreach t in array array['sm_payments','sm_visits','sm_wallet','sm_workerpay','sm_activity'] loop
    execute format($f$
      create table if not exists public.%I (
        tenant_code text   not null,
        id          text   not null,          -- <مفتاح الأب>|<مفتاح العنصر>
        parent      text   not null,          -- مثلاً m:<id صيانة> أو c:<id عقد>
        seq         int    not null default 0, -- ترتيب العنصر داخل مصفوفته
        d           text,                     -- تاريخ (للفهرسة والتقارير)
        amount      numeric,
        cur         text,
        status      text,
        data        jsonb  not null,          -- العنصر الأصلي كامل بدون أي فقدان
        rev         bigint not null default 0,-- رقم الدفعة اللي كتبته
        h           text,
        primary key (tenant_code, id)
      )$f$, t);
    execute format('create index if not exists %I on public.%I (tenant_code, parent)', t||'_parent_idx', t);
    execute format('create index if not exists %I on public.%I (tenant_code, d)', t||'_d_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_owner_all', t);
    execute format($p$
      create policy %I on public.%I for all to authenticated
      using (exists (select 1 from public.companies c where c.tenant_code = %I.tenant_code and c.owner_uid = auth.uid()))
      with check (exists (select 1 from public.companies c where c.tenant_code = %I.tenant_code and c.owner_uid = auth.uid()))
    $p$, t||'_owner_all', t, t, t);
  end loop;
end $$;

-- ملاحظة: h في الجدول للمعلومة فقط؛ الفحص بيحسب البصمة من data نفسها.
-- التراجع الكامل (اختياري): drop table sm_payments, sm_visits, sm_wallet, sm_workerpay, sm_activity;
