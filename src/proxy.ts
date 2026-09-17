import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Next.js 16 proxy (formerly middleware).
 *
 * This only makes Clerk's session available to the rest of the app. It makes no
 * access decisions: path-based checks here can drift from how Next.js actually
 * routes a request (Clerk has deprecated them for that reason), and Next.js's
 * own guidance is that proxy is not an authorization layer. Access is decided
 * from the database wherever data is read — the loaders, server actions and
 * API routes each call `requireUser()` or `requirePageUser()` themselves.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Everything except Next.js internals and static files, unless a search
    // param is present.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
    // Clerk's auto-proxy path.
    "/__clerk/:path*",
  ],
};
