import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtected = createRouteMatcher([
  "/analyze(.*)",
  "/account(.*)",
  "/pricing",
  "/payment-success",
  "/admin(.*)",
  "/api/((?!docs|stripe/webhook).*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
