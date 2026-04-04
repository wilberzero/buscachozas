import os
from supabase import create_client, Client

url = 'https://orrxhxowxrvcvvgzvevp.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ycnhoeG93eHJ2Y3Z2Z3p2ZXZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM2ODExMSwiZXhwIjoyMDg5OTQ0MTExfQ.kghlbaUiOfRZhZTQnXA1dG7UjcUQyDhvh3KRttY3310'
supabase: Client = create_client(url, key)

sql_commands = """
-- Tabla de propiedades
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT UNIQUE NOT NULL,
    title TEXT,
    type TEXT,
    address TEXT,
    neighborhood TEXT,
    rooms INTEGER,
    size_m2 FLOAT,
    floor TEXT,
    advertiser TEXT,
    url TEXT,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de histórico de precios
CREATE TABLE IF NOT EXISTS public.price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    price INTEGER NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de favoritos
CREATE TABLE IF NOT EXISTS public.favorites (
    user_id UUID NOT NULL, -- Referencia a auth.users (se configurará después)
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, property_id)
);

-- Tabla de configuración de usuario
CREATE TABLE IF NOT EXISTS public.user_config (
    user_id UUID PRIMARY KEY,
    alert_email TEXT,
    notifications_enabled BOOLEAN DEFAULT TRUE
);
"""

# Nota: Supabase API no permite ejecutar SQL arbitrario directamente por razones de seguridad
# Tenemos que hacerlo mediante una función RPC o directamente en la consola de Supabase.
# Como no tengo acceso a la consola, crearé las tablas usando un enfoque de 'upsert' dinámico.
# Sin embargo, lo más profesional es que el usuario ejecute este SQL en la consola.

print("--- SQL PARA COPIAR EN EL SQL EDITOR DE SUPABASE ---")
print(sql_commands)
print("---------------------------------------------------")
