-- Whitelabel MRO (revendedores). Aditiva e idempotente.
CREATE TABLE IF NOT EXISTS public.whitelabel_resellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  username text NOT NULL UNIQUE,
  email text,
  password_hash text NOT NULL,
  password_plain text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked')),
  active_until timestamptz,
  pix_type text,
  pix_key text,
  brand_file_path text,
  brand_file_name text,
  link_code text NOT NULL UNIQUE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.whitelabel_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.whitelabel_resellers(id) ON DELETE CASCADE,
  mro_user_id uuid,
  username text NOT NULL,
  email text,
  plan text NOT NULL CHECK (plan IN ('annual','lifetime')),
  extras_added integer NOT NULL DEFAULT 0,
  origin text NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','link')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wl_clients_reseller ON public.whitelabel_clients(reseller_id);
CREATE TABLE IF NOT EXISTS public.whitelabel_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.whitelabel_resellers(id) ON DELETE CASCADE,
  link_type text NOT NULL CHECK (link_type IN ('renda_extra','cliente_final')),
  plan text NOT NULL CHECK (plan IN ('annual','lifetime')),
  buyer_name text,
  buyer_email text NOT NULL,
  buyer_username text NOT NULL,
  amount numeric(10,2) NOT NULL,
  fee_amount numeric(10,2) NOT NULL DEFAULT 0,
  net_amount numeric(10,2) NOT NULL DEFAULT 0,
  nsu text NOT NULL UNIQUE,
  checkout_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired')),
  payout_status text NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending','paid')),
  client_id uuid,
  paid_at timestamptz,
  payout_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wl_sales_reseller ON public.whitelabel_sales(reseller_id);
CREATE TABLE IF NOT EXISTS public.whitelabel_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.whitelabel_resellers(id) ON DELETE CASCADE,
  client_id uuid,
  sale_id uuid,
  kind text NOT NULL CHECK (kind IN ('annual','lifetime','extra_annual','extra_lifetime')),
  quantity integer NOT NULL DEFAULT 1,
  amount numeric(10,2) NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  paid_via text,
  payment_id uuid,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wl_fees_reseller ON public.whitelabel_fees(reseller_id);
CREATE TABLE IF NOT EXISTS public.whitelabel_fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.whitelabel_resellers(id) ON DELETE CASCADE,
  nsu text NOT NULL UNIQUE,
  amount numeric(10,2) NOT NULL,
  fee_ids uuid[] NOT NULL DEFAULT '{}',
  checkout_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.whitelabel_tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text,
  video_url text,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whitelabel_resellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitelabel_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitelabel_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitelabel_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitelabel_fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitelabel_tutorials ENABLE ROW LEVEL SECURITY;
