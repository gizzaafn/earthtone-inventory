// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface UpdateUserPayload {
  user_id: string;
  email?: string;
  password?: string;
  full_name?: string;
  role?: "admin" | "kitchen" | "bar";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) throw new Error("Invalid session");

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: UpdateUserPayload = await req.json();
    if (!body.user_id) throw new Error("user_id wajib");

    const admin = createClient(supabaseUrl, serviceKey);

    // Update auth user (email/password)
    const authUpdates: Record<string, unknown> = {};
    if (body.email && body.email.trim()) {
      authUpdates.email = body.email.trim();
      authUpdates.email_confirm = true;
    }
    if (body.password && body.password.length > 0) {
      if (body.password.length < 8) throw new Error("Kata sandi minimal 8 karakter");
      authUpdates.password = body.password;
    }
    if (body.full_name && body.full_name.trim()) {
      authUpdates.user_metadata = { full_name: body.full_name.trim() };
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authErr } = await admin.auth.admin.updateUserById(body.user_id, authUpdates);
      if (authErr) throw authErr;
    }

    // Sync profile (email/full_name)
    const profileUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.email && body.email.trim()) profileUpdates.email = body.email.trim();
    if (body.full_name && body.full_name.trim()) profileUpdates.full_name = body.full_name.trim();
    if (Object.keys(profileUpdates).length > 1) {
      const { error: profErr } = await admin
        .from("profiles")
        .update(profileUpdates)
        .eq("id", body.user_id);
      if (profErr) throw profErr;
    }

    // Update role (replace existing roles for this user)
    if (body.role) {
      if (!["admin", "kitchen", "bar"].includes(body.role)) throw new Error("Role tidak valid");
      // Prevent admin demoting themselves if they're the only admin
      if (body.user_id === user.id && body.role !== "admin") {
        const { count } = await admin
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "admin");
        if ((count ?? 0) <= 1) throw new Error("Tidak bisa demote: Anda admin terakhir");
      }
      const { error: delErr } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", body.user_id);
      if (delErr) throw delErr;
      const { error: insErr } = await admin
        .from("user_roles")
        .insert({ user_id: body.user_id, role: body.role });
      if (insErr) throw insErr;
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
