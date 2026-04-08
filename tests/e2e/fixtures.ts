import { test as base } from "@playwright/test";
import fs from "fs";
import path from "path";
import { setUserCredits, upsertTestUser } from "./helpers/db";
import { signInViaUI } from "./helpers/auth";

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

interface TestUsers {
  freeUser: TestUser;
  paidUser: TestUser;
  adminUser: TestUser;
}

function loadTestUsers(): TestUsers {
  const file = path.join(__dirname, ".test-users.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Extends Playwright's test with fixtures for authenticated pages
export const test = base.extend<{
  asFreeUser: void;
  asPaidUser: void;
  asAdminUser: void;
  users: TestUsers;
  resetCredits: (userId: string, credits: number) => Promise<void>;
}>({
  users: async ({}, use) => {
    await use(loadTestUsers());
  },

  resetCredits: async ({}, use) => {
    await use(async (userId, credits) => {
      await setUserCredits(userId, credits);
    });
  },

  asFreeUser: async ({ page, users }, use) => {
    await upsertTestUser(users.freeUser.id, users.freeUser.email, 0);
    await signInViaUI(page, users.freeUser.email, users.freeUser.password);
    await use();
  },

  asPaidUser: async ({ page, users }, use) => {
    await upsertTestUser(users.paidUser.id, users.paidUser.email, 10);
    await signInViaUI(page, users.paidUser.email, users.paidUser.password);
    await use();
  },

  asAdminUser: async ({ page, users }, use) => {
    await signInViaUI(page, users.adminUser.email, users.adminUser.password);
    await use();
  },
});

export { expect } from "@playwright/test";

// Sample PDF bytes for upload tests (minimal valid PDF)
export const SAMPLE_PDF = Buffer.from(
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA0NCA+PgpzdHJlYW0KQlQgL0YxIDEyIFRmIDEwMCA3MDAgVGQgKEpvaG4gRG9lIC0gU29mdHdhcmUgRW5naW5lZXIpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDYyIDAwMDAwIG4gCjAwMDAwMDAxMTkgMDAwMDAgbiAKMDAwMDAwMDI3MyAwMDAwMCBuIAowMDAwMDAwMzY3IDAwMDAwIG4gCnRyYWlsZXIgPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNDQ1CiUlRU9G",
  "base64"
);
