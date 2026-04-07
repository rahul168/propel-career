/**
 * Creates/retrieves Clerk test users via the Clerk REST API.
 * Users are created with email verified so no confirmation step is needed.
 */

const CLERK_API = "https://api.clerk.com/v1";
const headers = () => ({
  Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
  "Content-Type": "application/json",
});

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

export async function createOrFetchTestUser(email: string, password: string): Promise<TestUser> {
  // Check if user already exists
  const search = await fetch(
    `${CLERK_API}/users?email_address=${encodeURIComponent(email)}`,
    { headers: headers() }
  );
  const existing = await search.json();
  if (Array.isArray(existing) && existing.length > 0) {
    return { id: existing[0].id, email, password };
  }

  // Create user with email verified
  const res = await fetch(`${CLERK_API}/users`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      email_address: [email],
      password,
      skip_password_checks: true,
      skip_password_requirements: true,
    }),
  });
  const user = await res.json();
  if (!user.id) throw new Error(`Failed to create Clerk user: ${JSON.stringify(user)}`);

  // Verify the email address
  const emailId = user.email_addresses?.[0]?.id;
  if (emailId) {
    await fetch(`${CLERK_API}/email_addresses/${emailId}/verify`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ strategy: "admin" }),
    });
  }

  return { id: user.id, email, password };
}

export async function deleteTestUser(userId: string) {
  await fetch(`${CLERK_API}/users/${userId}`, {
    method: "DELETE",
    headers: headers(),
  });
}

export async function setClerkUserRole(userId: string, role: "admin" | null) {
  await fetch(`${CLERK_API}/users/${userId}/metadata`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({
      public_metadata: role ? { role } : {},
    }),
  });
}
