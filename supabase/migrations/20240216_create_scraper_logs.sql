-- Tabla para registrar ejecuciones del scraper
create table if not exists public.scraper_logs (
    id uuid not null default gen_random_uuid(),
    started_at timestamp with time zone not null default now(),
    finished_at timestamp with time zone,
    status text not null check (status in ('running', 'success', 'error')),
    pisos_encontrados int default 0,
    pisos_nuevos int default 0,
    pisos_actualizados int default 0,
    error_message text,
    constraint scraper_logs_pkey primary key (id)
);

-- Políticas RLS (lectura para autenticados, escritura para service_role)
alter table public.scraper_logs enable row level security;

create policy "Permitir lectura a usuarios autenticados"
on public.scraper_logs for select
to authenticated
using (true);

-- Nota: El scraper usa service_role key, así que bye-passes RLS para escribir.
