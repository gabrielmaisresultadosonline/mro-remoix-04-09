-- ============================================================================
-- 1. HARDEN DATABASE FUNCTIONS (6 findings: 3 DEFINER_EXECUTABLE + 3 SEARCH_PATH_MUTABLE)
-- ============================================================================

REVOKE ALL ON FUNCTION public.dump_table_rows(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dump_table_rows(text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.dump_list_tables() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dump_list_tables() TO service_role;

CREATE OR REPLACE FUNCTION public.increment_crm_metric(metric_column text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF metric_column = 'sent_count' THEN
    INSERT INTO public.crm_metrics (date, sent_count)
    VALUES (CURRENT_DATE, 1)
    ON CONFLICT (date) DO UPDATE SET sent_count = public.crm_metrics.sent_count + 1;
  ELSIF metric_column = 'responded_count' THEN
    INSERT INTO public.crm_metrics (date, responded_count)
    VALUES (CURRENT_DATE, 1)
    ON CONFLICT (date) DO UPDATE SET responded_count = public.crm_metrics.responded_count + 1;
  ELSIF metric_column = 'qualified_count' THEN
    INSERT INTO public.crm_metrics (date, qualified_count)
    VALUES (CURRENT_DATE, 1)
    ON CONFLICT (date) DO UPDATE SET qualified_count = public.crm_metrics.qualified_count + 1;
  ELSIF metric_column = 'sales_count' THEN
    INSERT INTO public.crm_metrics (date, sales_count)
    VALUES (CURRENT_DATE, 1)
    ON CONFLICT (date) DO UPDATE SET sales_count = public.crm_metrics.sales_count + 1;
  ELSE
    RAISE EXCEPTION 'Invalid metric column: %', metric_column;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_crm_metric(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_crm_metric(text) TO service_role;

ALTER FUNCTION public.increment_broadcast_failed(uuid) SET search_path = '';
REVOKE ALL ON FUNCTION public.increment_broadcast_failed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_broadcast_failed(uuid) TO authenticated, service_role;

ALTER FUNCTION public.increment_broadcast_sent(uuid) SET search_path = '';
REVOKE ALL ON FUNCTION public.increment_broadcast_sent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_broadcast_sent(uuid) TO authenticated, service_role;

-- Safe public partner lookup returning only non-sensitive branding fields (no password/pix_key/email)
CREATE OR REPLACE FUNCTION public.get_partner_public_by_slug(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'last_name', p.last_name,
    'slug', p.slug,
    'photo_url', p.photo_url,
    'show_promo_banner', p.show_promo_banner,
    'whatsapp', p.whatsapp,
    'status', p.status
  )
  FROM public.partners p
  WHERE p.slug = trim(COALESCE(p_slug, ''))
    AND p.status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_partner_public_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_partner_public_by_slug(text) TO anon, authenticated, service_role;

-- ============================================================================
-- 2. REMOVE REDUNDANT RESTRICTIVE TAUTOLOGY POLICY (1 finding)
-- ============================================================================

DROP POLICY IF EXISTS "Service role full access on broadcast_email_logs" ON public.broadcast_email_logs;

-- ============================================================================
-- 3. DROP PERMISSIVE TAUTOLOGY POLICIES ACROSS ALL 72 FLAGGED TABLES
-- ============================================================================

DROP POLICY IF EXISTS "Public read api_tokens" ON public.api_tokens;
DROP POLICY IF EXISTS "Allow public access to audiobooks_orders" ON public.audiobooks_orders;
DROP POLICY IF EXISTS "Anyone can insert broadcast logs" ON public.broadcast_email_logs;
DROP POLICY IF EXISTS "Anyone can read broadcast logs" ON public.broadcast_email_logs;
DROP POLICY IF EXISTS "Anyone can delete analytics" ON public.call_analytics;
DROP POLICY IF EXISTS "Anyone can insert analytics" ON public.call_analytics;
DROP POLICY IF EXISTS "Anyone can read analytics" ON public.call_analytics;
DROP POLICY IF EXISTS "anon can insert" ON public.comercialaaf_leads;
DROP POLICY IF EXISTS "Allow public insert on corretor_announcement_views" ON public.corretor_announcement_views;
DROP POLICY IF EXISTS "Allow public read on corretor_announcements" ON public.corretor_announcements;
DROP POLICY IF EXISTS "Allow public insert on corretor_corrections_log" ON public.corretor_corrections_log;
DROP POLICY IF EXISTS "Allow public read on corretor_corrections_log" ON public.corretor_corrections_log;
DROP POLICY IF EXISTS "Allow public read on corretor_settings" ON public.corretor_settings;
DROP POLICY IF EXISTS "Allow public read on corretor_users" ON public.corretor_users;
DROP POLICY IF EXISTS "Anyone can delete requests" ON public.creatordev_requests;
DROP POLICY IF EXISTS "Anyone can insert requests" ON public.creatordev_requests;
DROP POLICY IF EXISTS "Anyone can update requests" ON public.creatordev_requests;
DROP POLICY IF EXISTS "Anyone can view requests" ON public.creatordev_requests;
DROP POLICY IF EXISTS "Anyone can delete settings" ON public.creatordev_settings;
DROP POLICY IF EXISTS "Anyone can insert settings" ON public.creatordev_settings;
DROP POLICY IF EXISTS "Anyone can update settings" ON public.creatordev_settings;
DROP POLICY IF EXISTS "Anyone can view settings" ON public.creatordev_settings;
DROP POLICY IF EXISTS "Allow public access to CRM activities" ON public.crm_activities;
DROP POLICY IF EXISTS "Admin can do everything on crm_broadcasts" ON public.crm_broadcasts;
DROP POLICY IF EXISTS "Allow public access to CRM broadcasts" ON public.crm_broadcasts;
DROP POLICY IF EXISTS "Allow public access to CRM contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.crm_flow_executions;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.crm_flow_executions;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.crm_flow_executions;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.crm_flow_executions;
DROP POLICY IF EXISTS "Allow public access to CRM flow steps" ON public.crm_flow_steps;
DROP POLICY IF EXISTS "Allow public delete on crm_flow_steps" ON public.crm_flow_steps;
DROP POLICY IF EXISTS "Allow public insert on crm_flow_steps" ON public.crm_flow_steps;
DROP POLICY IF EXISTS "Allow public update on crm_flow_steps" ON public.crm_flow_steps;
DROP POLICY IF EXISTS "Allow public access to CRM flows" ON public.crm_flows;
DROP POLICY IF EXISTS "Allow public delete on crm_flows" ON public.crm_flows;
DROP POLICY IF EXISTS "Allow public insert on crm_flows" ON public.crm_flows;
DROP POLICY IF EXISTS "Allow public update on crm_flows" ON public.crm_flows;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.crm_google_accounts;
DROP POLICY IF EXISTS "Admins can update google tokens" ON public.crm_google_tokens;
DROP POLICY IF EXISTS "Admins can view google tokens" ON public.crm_google_tokens;
DROP POLICY IF EXISTS "Allow public access to CRM messages" ON public.crm_messages;
DROP POLICY IF EXISTS "Allow public access to CRM metrics" ON public.crm_metrics;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.crm_scheduled_messages;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.crm_scheduled_messages;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.crm_scheduled_messages;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.crm_scheduled_messages;
DROP POLICY IF EXISTS "Allow public access to CRM settings" ON public.crm_settings;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.crm_statuses;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.crm_statuses;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.crm_statuses;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.crm_statuses;
DROP POLICY IF EXISTS "Allow public access to CRM templates" ON public.crm_templates;
DROP POLICY IF EXISTS "Admin can view CRM webhook logs" ON public.crm_webhook_delivery_logs;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.crm_webhooks;
DROP POLICY IF EXISTS "Public access to crm_webhooks" ON public.crm_webhooks;
DROP POLICY IF EXISTS "Allow public select" ON public.desconto_alunos_settings;
DROP POLICY IF EXISTS "Allow update" ON public.desconto_alunos_settings;
DROP POLICY IF EXISTS "Anon read empresas_email_logs" ON public.empresas_email_logs;
DROP POLICY IF EXISTS "Anyone can read empresas_leads" ON public.empresas_leads;
DROP POLICY IF EXISTS "Anyone can read empresas_settings" ON public.empresas_settings;
DROP POLICY IF EXISTS "Anyone can update empresas_settings" ON public.empresas_settings;
DROP POLICY IF EXISTS "Public read ferramentamropromo settings" ON public.ferramentamropromo_settings;
DROP POLICY IF EXISTS "Authenticated users can manage ebooks" ON public.hub_product_ebooks;
DROP POLICY IF EXISTS "Global Open Access for Ebooks" ON public.hub_product_ebooks;
DROP POLICY IF EXISTS "Public Read access for ebooks" ON public.hub_product_ebooks;
DROP POLICY IF EXISTS "Allow authenticated to manage hub_products" ON public.hub_products;
DROP POLICY IF EXISTS "Allow public read access on hub_products" ON public.hub_products;
DROP POLICY IF EXISTS "Anyone can insert analytics" ON public.live_analytics;
DROP POLICY IF EXISTS "Anyone can update own analytics" ON public.live_analytics;
DROP POLICY IF EXISTS "Anyone can read active live" ON public.live_sessions;
DROP POLICY IF EXISTS "Anyone can insert livve analytics" ON public.livve_analytics;
DROP POLICY IF EXISTS "Anyone can update livve analytics" ON public.livve_analytics;
DROP POLICY IF EXISTS "Anyone can read active livve" ON public.livve_sessions;
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.localvpp_leads;
DROP POLICY IF EXISTS "Banners are viewable by everyone" ON public.metodo_seguidor_banners;
DROP POLICY IF EXISTS "Service role can manage banners" ON public.metodo_seguidor_banners;
DROP POLICY IF EXISTS "Modules are viewable by everyone" ON public.metodo_seguidor_modules;
DROP POLICY IF EXISTS "Upsells are viewable by everyone" ON public.metodo_seguidor_upsells;
DROP POLICY IF EXISTS "Videos are viewable by everyone" ON public.metodo_seguidor_videos;
DROP POLICY IF EXISTS "Anyone can create euro order" ON public.mro_euro_orders;
DROP POLICY IF EXISTS "Anyone can view mro_orders" ON public.mro_orders;
DROP POLICY IF EXISTS "Public can create mro order" ON public.mro_orders;
DROP POLICY IF EXISTS "Admins can view settings" ON public.mro_settings;
DROP POLICY IF EXISTS "Admins can view all logs" ON public.mro_tool_logs;
DROP POLICY IF EXISTS "Anyone can record a visit" ON public.partner_visits;
DROP POLICY IF EXISTS "Anyone can view partner visits" ON public.partner_visits;
DROP POLICY IF EXISTS "Anyone can manage partners" ON public.partners;
DROP POLICY IF EXISTS "Public can read partners" ON public.partners;
DROP POLICY IF EXISTS "postscomia_analytics public insert" ON public.postscomia_analytics;
DROP POLICY IF EXISTS "Public read paid check" ON public.postscomia_orders;
DROP POLICY IF EXISTS "postscomia_settings public read" ON public.postscomia_settings;
DROP POLICY IF EXISTS "Anyone can create prompts order" ON public.prompts_mro_orders;
DROP POLICY IF EXISTS "Anyone can read prompts orders" ON public.prompts_mro_orders;
DROP POLICY IF EXISTS "Anyone can track visits" ON public.renda_extra_analytics;
DROP POLICY IF EXISTS "Anyone can track visits lead" ON public.renda_extra_lead_analytics;
DROP POLICY IF EXISTS "Anyone can register lead" ON public.renda_extra_lead_leads;
DROP POLICY IF EXISTS "Anyone can register as lead" ON public.renda_extra_leads;
DROP POLICY IF EXISTS "Anyone can insert v2 analytics" ON public.renda_extra_v2_analytics;
DROP POLICY IF EXISTS "Public can insert renda_extrass leads" ON public.renda_extrass_leads;
DROP POLICY IF EXISTS "Public can read renda_extrass leads" ON public.renda_extrass_leads;
DROP POLICY IF EXISTS "Public can update renda_extrass leads" ON public.renda_extrass_leads;
DROP POLICY IF EXISTS "Anyone can insert rendaext_analytics" ON public.rendaext_analytics;
DROP POLICY IF EXISTS "Anyone can view rendaext_analytics" ON public.rendaext_analytics;
DROP POLICY IF EXISTS "Anyone can insert audio events" ON public.rendaext_audio_events;
DROP POLICY IF EXISTS "Anyone can view rendaext_audio_events" ON public.rendaext_audio_events;
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.renddx_leads;
DROP POLICY IF EXISTS "Authenticated can select leads" ON public.renddx_leads;
DROP POLICY IF EXISTS "Partners can insert trial users" ON public.trial_users;
DROP POLICY IF EXISTS "Trial users are viewable by their partner" ON public.trial_users;
DROP POLICY IF EXISTS "Enable insert for all pagamentos" ON public.vender_pagamentos;
DROP POLICY IF EXISTS "Enable select for all pagamentos" ON public.vender_pagamentos;
DROP POLICY IF EXISTS "Enable update for service role" ON public.vender_pagamentos;
DROP POLICY IF EXISTS "vender_settings public read" ON public.vender_settings;
DROP POLICY IF EXISTS "vender_settings public update" ON public.vender_settings;
DROP POLICY IF EXISTS "vender_settings public write" ON public.vender_settings;
DROP POLICY IF EXISTS "Enable insert for all" ON public.vender_usuarios;
DROP POLICY IF EXISTS "Enable select for users matching email" ON public.vender_usuarios;
DROP POLICY IF EXISTS "Allow public read on whatsapp_page_settings" ON public.whatsapp_page_settings;
DROP POLICY IF EXISTS "Allow anyone to view connection logs" ON public.wpp_connection_logs;
DROP POLICY IF EXISTS "Allow system to insert connection logs" ON public.wpp_connection_logs;
DROP POLICY IF EXISTS "Allow public delete on zapi_flows" ON public.zapi_flows;
DROP POLICY IF EXISTS "Allow public insert on zapi_flows" ON public.zapi_flows;
DROP POLICY IF EXISTS "Allow public update on zapi_flows" ON public.zapi_flows;
DROP POLICY IF EXISTS "Users can view flows" ON public.zapi_flows;
DROP POLICY IF EXISTS "Public can read zapmro announcements" ON public.zapmro_announcements;
DROP POLICY IF EXISTS "Anyone can create zapmro order" ON public.zapmro_orders;
DROP POLICY IF EXISTS "Anyone can read zapmro orders" ON public.zapmro_orders;

-- ============================================================================
-- 4. RECREATE PROPERLY SCOPED RLS POLICIES FOR ALL 72 TABLES
-- ============================================================================

-- 4a. Admin-only private/internal/order/credential/CRM tables
CREATE POLICY "Admins manage api_tokens" ON public.api_tokens FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage audiobooks_orders" ON public.audiobooks_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage broadcast_email_logs" ON public.broadcast_email_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage comercialaaf_leads" ON public.comercialaaf_leads FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage corretor_announcement_views" ON public.corretor_announcement_views FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage corretor_corrections_log" ON public.corretor_corrections_log FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage corretor_settings" ON public.corretor_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage corretor_users" ON public.corretor_users FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage creatordev_settings" ON public.creatordev_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage crm_activities" ON public.crm_activities FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage crm_broadcasts" ON public.crm_broadcasts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage crm_contacts" ON public.crm_contacts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage crm_flow_executions" ON public.crm_flow_executions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage crm_flow_steps" ON public.crm_flow_steps FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage crm_flows" ON public.crm_flows FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage crm_google_accounts" ON public.crm_google_accounts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage crm_google_tokens" ON public.crm_google_tokens FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage crm_messages" ON public.crm_messages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage crm_metrics" ON public.crm_metrics FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage crm_scheduled_messages" ON public.crm_scheduled_messages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage crm_settings" ON public.crm_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage crm_statuses" ON public.crm_statuses FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage crm_templates" ON public.crm_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage crm_webhook_delivery_logs" ON public.crm_webhook_delivery_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage crm_webhooks" ON public.crm_webhooks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage empresas_email_logs" ON public.empresas_email_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage empresas_leads" ON public.empresas_leads FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage live_analytics" ON public.live_analytics FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage live_sessions" ON public.live_sessions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage livve_analytics" ON public.livve_analytics FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage livve_sessions" ON public.livve_sessions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage localvpp_leads" ON public.localvpp_leads FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage mro_euro_orders" ON public.mro_euro_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage mro_orders" ON public.mro_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage mro_settings" ON public.mro_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage mro_tool_logs" ON public.mro_tool_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage postscomia_analytics" ON public.postscomia_analytics FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage postscomia_orders" ON public.postscomia_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage postscomia_settings" ON public.postscomia_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage prompts_mro_orders" ON public.prompts_mro_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage renda_extra_analytics" ON public.renda_extra_analytics FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage renda_extra_leads" ON public.renda_extra_leads FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage renda_extra_v2_analytics" ON public.renda_extra_v2_analytics FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage vender_pagamentos" ON public.vender_pagamentos FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage vender_settings" ON public.vender_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage vender_usuarios" ON public.vender_usuarios FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage whatsapp_page_settings" ON public.whatsapp_page_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage wpp_connection_logs" ON public.wpp_connection_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage zapi_flows" ON public.zapi_flows FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage zapmro_orders" ON public.zapmro_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4b. Partner-owned tables (admins + authenticated partner owner)
CREATE POLICY "Admins manage partners" ON public.partners FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Partners read own record" ON public.partners FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Partners update own record" ON public.partners FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage trial_users" ON public.trial_users FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Partners view own trial_users" ON public.trial_users FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.partners p WHERE p.id = trial_users.partner_id AND p.user_id = auth.uid()));
CREATE POLICY "Partners insert own trial_users" ON public.trial_users FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.partners p WHERE p.id = trial_users.partner_id AND p.user_id = auth.uid()));

-- 4c. Public active-content catalog & settings (admin ALL + public SELECT of active rows only)
CREATE POLICY "Admins manage corretor_announcements" ON public.corretor_announcements FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read active corretor_announcements" ON public.corretor_announcements FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Admins manage zapmro_announcements" ON public.zapmro_announcements FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read active zapmro_announcements" ON public.zapmro_announcements FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Admins manage metodo_seguidor_banners" ON public.metodo_seguidor_banners FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read active metodo_seguidor_banners" ON public.metodo_seguidor_banners FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Admins manage metodo_seguidor_modules" ON public.metodo_seguidor_modules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read active metodo_seguidor_modules" ON public.metodo_seguidor_modules FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Admins manage metodo_seguidor_upsells" ON public.metodo_seguidor_upsells FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read active metodo_seguidor_upsells" ON public.metodo_seguidor_upsells FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Admins manage metodo_seguidor_videos" ON public.metodo_seguidor_videos FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read active metodo_seguidor_videos" ON public.metodo_seguidor_videos FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Admins manage desconto_alunos_settings" ON public.desconto_alunos_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read active desconto_alunos_settings" ON public.desconto_alunos_settings FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Admins manage empresas_settings" ON public.empresas_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read configured empresas_settings" ON public.empresas_settings FOR SELECT TO anon, authenticated USING (whatsapp_group_link IS NOT NULL AND length(trim(whatsapp_group_link)) > 0);

CREATE POLICY "Admins manage ferramentamropromo_settings" ON public.ferramentamropromo_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read active ferramentamropromo_settings" ON public.ferramentamropromo_settings FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Admins manage hub_products" ON public.hub_products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read active hub_products" ON public.hub_products FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Admins manage hub_product_ebooks" ON public.hub_product_ebooks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read ebooks of active hub_products" ON public.hub_product_ebooks FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.hub_products p WHERE p.id = hub_product_ebooks.product_id AND p.is_active = true));

-- 4d. Public validated-INSERT lead/analytics tables (admin ALL + validated public INSERT only, no public read/update/delete)
CREATE POLICY "Admins manage call_analytics" ON public.call_analytics FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public insert valid call_analytics" ON public.call_analytics FOR INSERT TO anon, authenticated WITH CHECK (length(trim(event_type)) > 0 AND length(event_type) <= 100);

CREATE POLICY "Admins manage creatordev_requests" ON public.creatordev_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public submit valid creatordev_requests" ON public.creatordev_requests FOR INSERT TO anon, authenticated WITH CHECK (length(trim(full_name)) > 0 AND length(trim(email)) > 3 AND position('@' in email) > 1 AND length(trim(project_description)) > 0);

CREATE POLICY "Admins manage partner_visits" ON public.partner_visits FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Partners view own partner_visits" ON public.partner_visits FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.partners p WHERE p.id = partner_visits.partner_id AND p.user_id = auth.uid()));
CREATE POLICY "Public record valid partner_visits" ON public.partner_visits FOR INSERT TO anon, authenticated WITH CHECK (partner_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.partners p WHERE p.id = partner_visits.partner_id AND p.status = 'active'));

CREATE POLICY "Admins manage renda_extra_lead_analytics" ON public.renda_extra_lead_analytics FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public insert valid renda_extra_lead_analytics" ON public.renda_extra_lead_analytics FOR INSERT TO anon, authenticated WITH CHECK (length(trim(event_type)) > 0 AND length(event_type) <= 100);

CREATE POLICY "Admins manage renda_extra_lead_leads" ON public.renda_extra_lead_leads FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public register valid renda_extra_lead_leads" ON public.renda_extra_lead_leads FOR INSERT TO anon, authenticated WITH CHECK (length(trim(nome_completo)) > 0 AND length(trim(email)) > 3 AND position('@' in email) > 1);

CREATE POLICY "Admins manage renda_extrass_leads" ON public.renda_extrass_leads FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public register valid renda_extrass_leads" ON public.renda_extrass_leads FOR INSERT TO anon, authenticated WITH CHECK (length(trim(name)) > 0 AND length(trim(email)) > 3 AND position('@' in email) > 1);

CREATE POLICY "Admins manage rendaext_analytics" ON public.rendaext_analytics FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public insert valid rendaext_analytics" ON public.rendaext_analytics FOR INSERT TO anon, authenticated WITH CHECK (length(trim(event_type)) > 0 AND length(event_type) <= 100);

CREATE POLICY "Admins manage rendaext_audio_events" ON public.rendaext_audio_events FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public insert valid rendaext_audio_events" ON public.rendaext_audio_events FOR INSERT TO anon, authenticated WITH CHECK (length(trim(email)) > 3 AND position('@' in email) > 1 AND percent >= 0 AND percent <= 100);

CREATE POLICY "Admins manage renddx_leads" ON public.renddx_leads FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public register valid renddx_leads" ON public.renddx_leads FOR INSERT TO anon, authenticated WITH CHECK (length(trim(name)) > 0 AND length(trim(email)) > 3 AND position('@' in email) > 1);

-- ============================================================================
-- 5. DROP ALL 42 UNBOUND STORAGE.OBJECTS POLICIES & ADD OWNER/ADMIN-BOUND ONES
-- ============================================================================

DROP POLICY IF EXISTS "Admin Delete Access for lotargrupos" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update Access for lotargrupos" ON storage.objects;
DROP POLICY IF EXISTS "Admin Upload Access for lotargrupos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can manage admin video cover assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can manage announcement images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can manage announcements JSON" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can manage cover images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read admin folder in user-data" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read inteligencia-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update mktcc media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload affiliate photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload mktcc media" ON storage.objects;
DROP POLICY IF EXISTS "Assets are public" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload assets" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Access for lotargrupos videos" ON storage.objects;
DROP POLICY IF EXISTS "Public Access for public bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public CRM Media Access" ON storage.objects;
DROP POLICY IF EXISTS "Public CRM Media Upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Access for public bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Access for public bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload Access for public bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload afiliadosx photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view metodo content" ON storage.objects;
DROP POLICY IF EXISTS "Public can view trial screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for profile cache" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete from profile cache" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete metodo content" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage backups" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update metodo content" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update profile cache" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload metodo content" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload to profile cache" ON storage.objects;
DROP POLICY IF EXISTS "rendasaovivo public read" ON storage.objects;
DROP POLICY IF EXISTS "rendasaovivo public update" ON storage.objects;
DROP POLICY IF EXISTS "rendasaovivo public upload" ON storage.objects;

CREATE POLICY "Admins can manage storage objects"
ON storage.objects
FOR ALL
TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'))
WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Authenticated users manage own assets"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'assets' AND owner_id = (SELECT auth.uid()::text))
WITH CHECK (bucket_id = 'assets' AND owner_id = (SELECT auth.uid()::text));
