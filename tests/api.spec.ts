import { test, expect } from "@playwright/test";
test("real local API reports configuration, rejects bad origins and malformed requests", async ({
  request,
}) => {
  const status = await request.get("/api/status");
  expect(status.status()).toBe(200);
  const body = await status.json();
  expect(body.provider).toBe("Google Gemini");
  expect(typeof body.configured).toBe("boolean");
  expect(JSON.stringify(body)).not.toContain("AIza");
  const blocked = await request.get("/api/status", {
    headers: { Origin: "https://untrusted.example" },
  });
  expect(blocked.status()).toBe(403);
  const malformed = await request.post("/api/chat", { data: { messages: [] } });
  expect(malformed.status()).toBe(400);
  const secret = await request.get("/server/private/ashraf.md");
  expect(secret.status()).toBe(403);
});
