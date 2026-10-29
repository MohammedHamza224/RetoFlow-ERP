// ============================================================================
// RestoFlow: Admin Users Supabase Edge Function
// File: supabase/functions/admin-users/index.ts
// Description: Secure server-side endpoint for Supabase Auth Admin operations.
//              Enforces caller role authorization for ADMIN and MANAGER roles.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration missing (Service Key)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Verify Caller JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user: callerAuthUser }, error: callerAuthError } = await userClient.auth.getUser();
    if (callerAuthError || !callerAuthUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid session token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin Client with Service Role Key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Fetch Caller Application Profile & Role
    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("users")
      .select("*, role:roles(name)")
      .eq("id", callerAuthUser.id)
      .single();

    if (callerProfileError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: "Caller profile not found in system." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerRole = callerProfile.role?.name;
    if (!["ADMIN", "MANAGER"].includes(callerRole)) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only Administrators and Managers can access this service." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Parse Request Payload
    const { action, payload } = await req.json();

    // ACTION: CREATE_USER
    if (action === "CREATE_USER") {
      const { email, password, name, phone, role_name } = payload;

      if (!email || !password || !name || !role_name) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: email, password, name, and role_name are required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Role check for MANAGER:
      if (callerRole === "MANAGER" && !["CASHIER", "STAFF"].includes(role_name)) {
        return new Response(
          JSON.stringify({ error: "Forbidden: Managers can only create Cashier or Staff accounts." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Lookup target role_id
      const { data: targetRole, error: roleError } = await adminClient
        .from("roles")
        .select("id, name")
        .eq("name", role_name)
        .single();

      if (roleError || !targetRole) {
        return new Response(
          JSON.stringify({ error: `Invalid role specified: ${role_name}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create user in Supabase Auth via Admin API
      const { data: newAuthData, error: createAuthError } = await adminClient.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: password,
        email_confirm: true,
        user_metadata: { name: name.trim() },
      });

      if (createAuthError || !newAuthData.user) {
        return new Response(
          JSON.stringify({ error: createAuthError?.message || "Failed to create authentication account." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newUserId = newAuthData.user.id;

      // Upsert/Insert into public.users
      const { data: newUserProfile, error: profileInsertError } = await adminClient
        .from("users")
        .upsert({
          id: newUserId,
          role_id: targetRole.id,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone ? phone.trim() : null,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .select("*, role:roles(id, name, description)")
        .single();

      if (profileInsertError) {
        // Rollback created auth user
        await adminClient.auth.admin.deleteUser(newUserId);
        return new Response(
          JSON.stringify({ error: `Database profile creation failed: ${profileInsertError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Record Audit Log
      await adminClient.from("user_audit_logs").insert({
        actor_id: callerAuthUser.id,
        target_user_id: newUserId,
        action: "USER_CREATED",
        details: {
          target_email: email,
          target_role: role_name,
          actor_role: callerRole,
        },
      });

      return new Response(
        JSON.stringify({ success: true, user: newUserProfile }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: ADMIN_RESET_PASSWORD
    if (action === "RESET_PASSWORD") {
      const { target_user_id, new_password, send_email } = payload;

      if (!target_user_id) {
        return new Response(
          JSON.stringify({ error: "Target user ID is required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch target user's current role
      const { data: targetUser, error: targetError } = await adminClient
        .from("users")
        .select("*, role:roles(name)")
        .eq("id", target_user_id)
        .single();

      if (targetError || !targetUser) {
        return new Response(
          JSON.stringify({ error: "Target user profile not found." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Manager restriction: cannot touch Admin or Manager
      if (callerRole === "MANAGER" && ["ADMIN", "MANAGER"].includes(targetUser.role?.name)) {
        return new Response(
          JSON.stringify({ error: "Forbidden: Managers cannot reset passwords for Admin or Manager accounts." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (new_password) {
        // Set new password directly via Admin API
        const { error: updatePassError } = await adminClient.auth.admin.updateUserById(
          target_user_id,
          { password: new_password }
        );

        if (updatePassError) {
          return new Response(
            JSON.stringify({ error: updatePassError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        // Trigger password reset email
        const { error: resetEmailError } = await adminClient.auth.resetPasswordForEmail(
          targetUser.email
        );
        if (resetEmailError) {
          return new Response(
            JSON.stringify({ error: resetEmailError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Audit Log
      await adminClient.from("user_audit_logs").insert({
        actor_id: callerAuthUser.id,
        target_user_id: target_user_id,
        action: "PASSWORD_RESET_SENT",
        details: {
          target_email: targetUser.email,
          direct_update: Boolean(new_password),
          actor_role: callerRole,
        },
      });

      return new Response(
        JSON.stringify({ success: true, message: "Password updated or reset link sent successfully." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
