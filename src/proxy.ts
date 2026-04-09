import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtected = createRouteMatcher([
  "/analyze(.*)",
  "/account(.*)",
  "/pricing",
  "/payment-success",
  "/admin(.*)",
  "/api/(.*)",
]);

const isPublic = createRouteMatcher([
  "/api/docs(.*)",
  "/api/stripe/webhook",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req) && !isPublic(req)) await auth.protect();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
