import { NextResponse, type NextRequest } from "next/server";

// Exposes the current path so requireUser() can send people back after login.
export function proxy(req: NextRequest) {
  const h = new Headers(req.headers);
  h.set("x-pathname", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers: h } });
}

export const config = { matcher: ["/((?!_next/|favicon.ico).*)"] };
