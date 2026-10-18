import { NextResponse, type NextRequest } from "next/server";
import { JURY_COOKIE, isValidJuryToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(JURY_COOKIE)?.value;
  const authed = await isValidJuryToken(token);

  if (pathname.startsWith("/login")) {
    if (authed) {
      return NextResponse.redirect(new URL("/research", request.url));
    }
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/research") ||
    pathname === "/api/copilotkit" ||
    pathname.startsWith("/api/copilotkit/")
  ) {
    if (!authed) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/research/:path*", "/api/copilotkit", "/api/copilotkit/:path*", "/login"],
};
