import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_EMAIL = "mro@gmail.com";
const ADMIN_PASSWORD = "Ga145523@";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const json = (d: unknown, status = 200) =>
      new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const requireAdmin = () => {
      const e = String(body.email || "").trim().toLowerCase();
      const p = String(body.password || "");
      return e === ADMIN_EMAIL && p === ADMIN_PASSWORD;
    };

    if (action === "admin_login") {
      if (!requireAdmin()) return json({ success: false, error: "Credenciais inválidas" }, 401);
      return json({ success: true });
    }

    if (action === "get_video") {
      const { data } = await supabase.from("ferramentamropromo_settings")
        .select("video_url, hls_url, video_title, player_settings")
        .order("updated_at", { ascending: false }).limit(1).maybeSingle();
      return json({
        video_url: data?.video_url || null,
        hls_url: data?.hls_url || null,
        video_title: data?.video_title || null,
        player_settings: data?.player_settings || {},
      });
    }

    if (action === "track") {
      const visitor_id = String(body.visitor_id || "").slice(0, 80);
      const event_type = String(body.event_type || "").slice(0, 40);
      if (!visitor_id || !event_type) return json({ success: false }, 400);
      const progress_pct = body.progress_pct != null ? Number(body.progress_pct) : null;
      const ua = String(body.user_agent || "").slice(0, 300);
      const ref = String(body.referrer || "").slice(0, 300);
      const path = String(body.path || "").slice(0, 200);
      await supabase.from("ferramentamropromo_analytics").insert({
        visitor_id,
        event_type,
        progress_pct: Number.isFinite(progress_pct) ? progress_pct : null,
        user_agent: ua,
        referrer: ref,
        path,
      });
      return json({ success: true });
    }

    if (action === "get_analytics") {
      if (!requireAdmin()) return json({ success: false, error: "Não autorizado" }, 401);
      const days = Math.min(90, Math.max(1, Number(body.days) || 30));
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data: rows } = await supabase
        .from("ferramentamropromo_analytics")
        .select("visitor_id, event_type, progress_pct, referrer, path, created_at")
        .not("path", "like", "/ferramentamropromo/video%")
        .not("path", "like", "/ferramentamropromo/admin%")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50000);
      const list = rows || [];

      const visitors = new Map<string, { first: string; last: string; maxProgress: number; started: boolean; clicked: boolean; page: string; lastVideo: string | null }>();
      const pageKey = (path: string) => {
        const m = /^\/promo\/([^/?#]+)/i.exec(path || "");
        return m ? `/promo/${m[1].toLowerCase()}` : (path || "/ferramentamropromo").replace(/\/$/, "") || "/";
      };
      const pages = new Map<string, { views: number; visitors: Set<string>; starters: Set<string>; p50: Set<string>; p100: Set<string>; clicks: number; last: string }>();
      const byDay = new Map<string, { visitors: Set<string>; clicks: number; starts: number; completes: number }>();
      const refCount = new Map<string, number>();
      let totalClicks = 0;
      let totalStarts = 0;
      let totalPageViews = 0;
      let progressSum = 0;
      let progressCount = 0;
      const milestoneCounts: Record<string, Set<string>> = { "25": new Set(), "50": new Set(), "75": new Set(), "100": new Set() };

      for (const r of list) {
        const v = r.visitor_id as string;
        const ts = r.created_at as string;
        const day = ts.slice(0, 10);
        const pk = pageKey(String(r.path || ""));
        if (!visitors.has(v)) visitors.set(v, { first: ts, last: ts, maxProgress: 0, started: false, clicked: false, page: pk, lastVideo: null });
        if (!pages.has(pk)) pages.set(pk, { views: 0, visitors: new Set(), starters: new Set(), p50: new Set(), p100: new Set(), clicks: 0, last: ts });
        const pg = pages.get(pk)!;
        pg.visitors.add(v);
        if (ts > pg.last) pg.last = ts;
        if (r.event_type === "page_view") pg.views++;
        if (r.event_type === "video_start") pg.starters.add(v);
        if (r.event_type === "cta_click") pg.clicks++;
        if (r.event_type === "video_progress") {
          const pp = Number(r.progress_pct || 0);
          pg.starters.add(v);
          if (pp >= 50) pg.p50.add(v);
          if (pp >= 100) pg.p100.add(v);
        }
        const vs = visitors.get(v)!;
        if (ts < vs.first) vs.first = ts;
        if (ts > vs.last) vs.last = ts;
        if (!byDay.has(day)) byDay.set(day, { visitors: new Set(), clicks: 0, starts: 0, completes: 0 });
        const d = byDay.get(day)!;

        if (r.event_type === "page_view") {
          totalPageViews++;
          d.visitors.add(v);
        } else if (r.event_type === "video_start") {
          totalStarts++;
          vs.started = true;
          d.starts++;
          if (!vs.lastVideo || ts > vs.lastVideo) vs.lastVideo = ts;
        } else if (r.event_type === "video_progress") {
          const p = Number(r.progress_pct || 0);
          if (p > vs.maxProgress) vs.maxProgress = p;
          vs.started = true;
          if (!vs.lastVideo || ts > vs.lastVideo) vs.lastVideo = ts;
          progressSum += p;
          progressCount++;
          for (const m of ["25", "50", "75", "100"]) {
            if (p >= Number(m)) milestoneCounts[m].add(v);
          }
          if (p >= 100) d.completes++;
        } else if (r.event_type === "cta_click") {
          totalClicks++;
          vs.clicked = true;
          d.clicks++;
        }

        if (r.referrer) {
          const key = (() => {
            try { return new URL(r.referrer as string).hostname || "direto"; } catch { return "direto"; }
          })();
          refCount.set(key, (refCount.get(key) || 0) + 1);
        }
      }

      const uniqueVisitors = visitors.size;
      const started = [...visitors.values()].filter((v) => v.started).length;
      const clicked = [...visitors.values()].filter((v) => v.clicked).length;

      const daily = [...byDay.entries()]
        .map(([day, d]) => ({ day, visitors: d.visitors.size, clicks: d.clicks, starts: d.starts, completes: d.completes }))
        .sort((a, b) => a.day.localeCompare(b.day));

      const referrers = [...refCount.entries()].map(([host, count]) => ({ host, count })).sort((a, b) => b.count - a.count).slice(0, 15);

      const ranking = [...visitors.entries()]
        .map(([id, v]) => ({ visitor_id: id, first: v.first, last: v.last, max_progress: v.maxProgress, clicked: v.clicked, page: v.page, started: v.started, last_video: v.lastVideo }))
        .sort((a, b) => b.max_progress - a.max_progress || b.last.localeCompare(a.last))
        .slice(0, 200);

      const byPage = [...pages.entries()].map(([page, p]) => ({
        page, views: p.views, visitors: p.visitors.size, starters: p.starters.size,
        no_video: Math.max(0, p.visitors.size - p.starters.size),
        p50: p.p50.size, p100: p.p100.size, clicks: p.clicks, last: p.last,
      })).sort((a, b) => b.visitors - a.visitors);
      const lastVideoAccess = [...visitors.values()].reduce<string | null>((acc, v) => (v.lastVideo && (!acc || v.lastVideo > acc) ? v.lastVideo : acc), null);

      return json({
        byPage,
        success: true,
        summary: {
          totalPageViews,
          uniqueVisitors,
          totalStarts,
          uniqueStarters: started,
          totalClicks,
          uniqueClickers: clicked,
          avgProgress: progressCount ? Math.round(progressSum / progressCount) : 0,
          milestone25: milestoneCounts["25"].size,
          milestone50: milestoneCounts["50"].size,
          milestone75: milestoneCounts["75"].size,
          milestone100: milestoneCounts["100"].size,
          conversionRate: uniqueVisitors ? Math.round((clicked / uniqueVisitors) * 1000) / 10 : 0,
          lastAccess: list[0]?.created_at || null,
          lastVideoAccess,
          visitedNoVideo: Math.max(0, uniqueVisitors - started),
        },
        daily,
        referrers,
        ranking,
      });
    }

    if (action === "set_video") {
      if (!requireAdmin()) return json({ success: false, error: "Não autorizado" }, 401);
      const video_url = body.video_url ? String(body.video_url) : null;
      const hls_url = body.hls_url ? String(body.hls_url) : null;
      const video_title = body.video_title ? String(body.video_title) : null;
      const ps = (body.player_settings && typeof body.player_settings === "object") ? body.player_settings : {};
      const player_settings = {
        allow_seek: ps.allow_seek !== false,
        show_progress: ps.show_progress !== false,
        force_max_volume: ps.force_max_volume === true,
        minimal_controls: ps.minimal_controls === true,
        show_fullscreen: ps.show_fullscreen !== false,
      };
      const { data: existing } = await supabase.from("ferramentamropromo_settings")
        .select("id").order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (existing) {
        await supabase.from("ferramentamropromo_settings")
          .update({ video_url, hls_url, video_title, player_settings, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("ferramentamropromo_settings")
          .insert({ video_url, hls_url, video_title, player_settings, is_active: true });
      }
      return json({ success: true });
    }

    return json({ success: false, error: "Ação desconhecida" }, 400);
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
