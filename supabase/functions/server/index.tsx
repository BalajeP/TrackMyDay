import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.use('*', logger(console.log));

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.get("/make-server-e4c16036/health", (c) => {
  return c.json({ status: "ok" });
});

// ── Auth: signup ──────────────────────────────────────────────────────────────
app.post("/make-server-e4c16036/auth/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name: name || "" },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true,
    });

    if (error) {
      console.log("Signup error:", error.message);
      return c.json({ error: error.message }, 400);
    }

    return c.json({ user: data.user });
  } catch (err) {
    console.log("Signup exception:", err);
    return c.json({ error: `Signup failed: ${err}` }, 500);
  }
});

// ── Helper: verify token and return user id ───────────────────────────────────
async function getUserId(token: string): Promise<string | null> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

// ── Data: GET user data by key ─────────────────────────────────────────────────
app.get("/make-server-e4c16036/data", async (c) => {
  try {
    const token = c.req.header("Authorization")?.split(" ")[1];
    if (!token) return c.json({ error: "Unauthorized" }, 401);

    const userId = await getUserId(token);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const key = c.req.query("key");
    if (!key) return c.json({ error: "Missing key parameter" }, 400);

    const data = await kv.get(`user:${userId}:${key}`);
    return c.json({ data: data ?? null });
  } catch (err) {
    console.log("GET /data error:", err);
    return c.json({ error: `Failed to get data: ${err}` }, 500);
  }
});

// ── Data: POST save user data by key ──────────────────────────────────────────
app.post("/make-server-e4c16036/data", async (c) => {
  try {
    const token = c.req.header("Authorization")?.split(" ")[1];
    if (!token) return c.json({ error: "Unauthorized" }, 401);

    const userId = await getUserId(token);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const { key, data } = await c.req.json();
    if (!key) return c.json({ error: "Missing key in body" }, 400);

    await kv.set(`user:${userId}:${key}`, data);
    return c.json({ success: true });
  } catch (err) {
    console.log("POST /data error:", err);
    return c.json({ error: `Failed to save data: ${err}` }, 500);
  }
});

Deno.serve(app.fetch);
