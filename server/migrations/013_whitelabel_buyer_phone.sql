-- Telefone do comprador nas vendas Whitelabel (aditiva, preserva dados).
ALTER TABLE whitelabel_sales ADD COLUMN IF NOT EXISTS buyer_phone text;
