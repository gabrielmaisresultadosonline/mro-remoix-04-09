-- Nome completo do comprador nos pedidos MRO (aditivo, idempotente).
ALTER TABLE public.mro_orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
