import { auth } from "@/auth";
import { NextResponse } from "next/server";

const ADMIN_ONLY_PREFIXES = ["/nomina", "/personal/historial", "/usuarios"];

// El encargado del galpón solo necesita el inicio, su producción, sus tareas y la lista de compras.
const GALPON_ALLOWED_PREFIXES = ["/", "/produccion", "/tareas", "/compras"];

// El conductor solo necesita el inicio y el módulo Vehículo (incluida la ruta que sirve
// sus fotos/archivos privados).
const CONDUCTOR_ALLOWED_PREFIXES = ["/", "/vehiculo", "/api/vehiculo"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isLoginPage = pathname.startsWith("/login");

  if (!isLoggedIn && !isLoginPage) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  if (
    isLoggedIn &&
    req.auth?.user.role !== "ADMIN" &&
    ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  if (
    isLoggedIn &&
    (pathname.startsWith("/finanzas") || pathname.startsWith("/inventario")) &&
    req.auth?.user.role !== "ADMIN" &&
    !req.auth?.user.puedeVerFinanzas
  ) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  if (
    isLoggedIn &&
    req.auth?.user.role === "GALPON" &&
    !GALPON_ALLOWED_PREFIXES.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)))
  ) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  if (
    isLoggedIn &&
    req.auth?.user.role === "CONDUCTOR" &&
    !CONDUCTOR_ALLOWED_PREFIXES.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)))
  ) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
