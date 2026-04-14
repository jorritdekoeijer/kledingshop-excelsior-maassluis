import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SetAllCookies } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { hasFinancialReportAccess } from "@/lib/auth/reporting-access";
import { permissions } from "@/lib/auth/permissions";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_ANON_KEY"), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options as any));
      }
    }
  });

  const { data } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  async function getPermissionsForUser(userId: string) {
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("permissions")
      .eq("id", userId)
      .single();
    if (error || !profile) return [] as string[];
    return (profile.permissions ?? []) as string[];
  }

  /** Zelfde als server-side requireAdmin: RPC + fallback user_roles. */
  async function isAdminUser(userId: string): Promise<boolean> {
    const { data: rpcAdmin, error: rpcError } = await supabase.rpc("is_admin");
    if (!rpcError && rpcAdmin === true) return true;
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .limit(1);
    return !error && !!roles && roles.length > 0;
  }

  /** `dashboard:access` of admin-rol telt als volledige toegang tot beheer-routes. */
  async function requirePermOrDashboard(required: string) {
    if (!data.user) return NextResponse.redirect(new URL("/login", request.url));
    const perms = await getPermissionsForUser(data.user.id);
    if (perms.includes(permissions.dashboard.access)) return null;
    if (await isAdminUser(data.user.id)) return null;
    if (!perms.includes(required)) return new NextResponse("Forbidden", { status: 403 });
    return null;
  }

  /** Minstens één permissie, of admin / dashboard:access. */
  async function requireAnyPermOrDashboard(keys: string[]) {
    if (!data.user) return NextResponse.redirect(new URL("/login", request.url));
    const perms = await getPermissionsForUser(data.user.id);
    if (perms.includes(permissions.dashboard.access)) return null;
    if (await isAdminUser(data.user.id)) return null;
    if (keys.some((k) => perms.includes(k))) return null;
    return new NextResponse("Forbidden", { status: 403 });
  }

  async function requireReportingOrDashboard() {
    if (!data.user) return NextResponse.redirect(new URL("/login", request.url));
    const perms = await getPermissionsForUser(data.user.id);
    const admin = await isAdminUser(data.user.id);
    if (hasFinancialReportAccess(perms, { isAdmin: admin })) return null;
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (pathname.startsWith("/dashboard")) {
    // Always require login for /dashboard/* (startpagina toont keuzes; subroutes per permissie)
    if (!data.user) return NextResponse.redirect(new URL("/login", request.url));

    // Specifieke settings-subroutes vóór de brede /dashboard/settings-check (anders nooit bereikt)
    if (pathname.startsWith("/dashboard/settings/users")) {
      const res = await requirePermOrDashboard(permissions.users.read);
      if (res) return res;
    } else if (pathname.startsWith("/dashboard/settings/cost-groups")) {
      const res = await requirePermOrDashboard(permissions.costGroups.read);
      if (res) return res;
    } else if (pathname.startsWith("/dashboard/settings/suppliers")) {
      const res = await requireAnyPermOrDashboard([
        permissions.suppliers.read,
        permissions.suppliers.write,
        permissions.settings.read
      ]);
      if (res) return res;
    } else if (pathname === "/dashboard/settings" || pathname === "/dashboard/settings/") {
      const res = await requireAnyPermOrDashboard([
        permissions.settings.read,
        permissions.suppliers.read,
        permissions.suppliers.write
      ]);
      if (res) return res;
    } else if (pathname.startsWith("/dashboard/settings")) {
      const res = await requirePermOrDashboard(permissions.settings.read);
      if (res) return res;
    }

    if (pathname.startsWith("/dashboard/rapportage")) {
      const res = await requireReportingOrDashboard();
      if (res) return res;
    }

    // Schrijf-routes vóór de algemene /dashboard/products-leesregel
    if (
      pathname === "/dashboard/products/new" ||
      pathname.startsWith("/dashboard/products/categories") ||
      pathname.match(/^\/dashboard\/products\/[0-9a-fA-F-]+\/edit$/)
    ) {
      const res = await requirePermOrDashboard(permissions.products.write);
      if (res) return res;
    } else if (pathname.startsWith("/dashboard/products")) {
      const res = await requirePermOrDashboard(permissions.products.read);
      if (res) return res;
    }

    if (pathname.startsWith("/dashboard/stock")) {
      const res = await requirePermOrDashboard(permissions.stock.read);
      if (res) return res;
    }
    if (pathname.startsWith("/dashboard/orders")) {
      const res = await requirePermOrDashboard(permissions.orders.read);
      if (res) return res;
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!data.user) return NextResponse.redirect(new URL("/login", request.url));

    const { data: isAdmin, error: rpcError } = await supabase.rpc("is_admin");
    const okRpc = !rpcError && isAdmin === true;
    if (!okRpc) {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .limit(1);

      if (error || !roles || roles.length === 0) return new NextResponse("Forbidden", { status: 403 });
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
