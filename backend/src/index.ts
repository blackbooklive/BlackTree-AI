import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import "./env";
import { sampleRouter } from "./routes/sample";
import { aiRouter } from "./routes/ai";
import { userRouter } from "./routes/user";
import { logger } from "hono/logger";
import { auth } from "./auth";

const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// CORS middleware - validates origin against allowlist
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecodeapp\.com$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.dev$/,
  /^https:\/\/vibecode\.dev$/,
];

app.use(
  "*",
  cors({
    origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
    credentials: true,
  })
);

// Logging
app.use("*", logger());

// Auth middleware - populates user/session for all routes
app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    c.set("user", null);
    c.set("session", null);
    await next();
    return;
  }
  c.set("user", session.user);
  c.set("session", session.session);
  await next();
});

// Mount auth handler
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// Privacy policy page
app.get("/privacy", (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy – BlackTree AI</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f0f0f;
      color: #e0e0e0;
      line-height: 1.7;
      padding: 24px 16px 60px;
    }
    .container {
      max-width: 680px;
      margin: 0 auto;
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 6px;
    }
    .last-updated {
      font-size: 12px;
      color: #888;
      margin-bottom: 32px;
    }
    h2 {
      font-size: 16px;
      font-weight: 600;
      color: #ffffff;
      margin-top: 28px;
      margin-bottom: 8px;
    }
    p {
      font-size: 14px;
      color: #aaa;
      margin-bottom: 8px;
    }
    ul {
      font-size: 14px;
      color: #aaa;
      padding-left: 20px;
      margin-bottom: 8px;
    }
    ul li { margin-bottom: 4px; }
    strong { color: #e0e0e0; }
    a { color: #7b61ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Privacy Policy</h1>
    <p class="last-updated">Last Updated: February 2025</p>

    <h2>1. Introduction</h2>
    <p>BlackTree AI ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.</p>

    <h2>2. Information We Collect</h2>
    <p><strong>Location Data:</strong> With your permission, we collect your device's location to provide personalized local recommendations for restaurants, events, and activities near you.</p>
    <p><strong>Usage Data:</strong> We collect information about how you interact with the App, including features used, search queries, and preferences.</p>
    <p><strong>Device Information:</strong> We may collect device type, operating system, and unique device identifiers.</p>
    <p><strong>Account Information:</strong> If you create an account, we collect your email address and any profile information you provide.</p>

    <h2>3. How We Use Your Information</h2>
    <p>We use the information we collect to:</p>
    <ul>
      <li>Provide personalized local recommendations</li>
      <li>Improve and optimize the App</li>
      <li>Process subscription payments</li>
      <li>Send you updates and notifications (with your consent)</li>
      <li>Respond to your inquiries and support requests</li>
      <li>Comply with legal obligations</li>
    </ul>

    <h2>4. Sharing of Information</h2>
    <p>We do not sell your personal information. We may share your information with:</p>
    <ul>
      <li>Service providers who assist in operating our App</li>
      <li>Legal authorities when required by law</li>
      <li>Business partners with your explicit consent</li>
    </ul>

    <h2>5. Data Security</h2>
    <p>We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure.</p>

    <h2>6. Your Rights</h2>
    <p>You have the right to:</p>
    <ul>
      <li>Access your personal data</li>
      <li>Correct inaccurate data</li>
      <li>Request deletion of your data</li>
      <li>Opt-out of marketing communications</li>
      <li>Disable location services through your device settings</li>
    </ul>

    <h2>7. Third-Party Services</h2>
    <p>Our App may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to read their privacy policies.</p>

    <h2>8. Children's Privacy</h2>
    <p>Our App is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe we have collected such information, please contact us immediately at <a href="mailto:blacktreeai@yahoo.com">blacktreeai@yahoo.com</a>.</p>

    <h2>9. Changes to This Policy</h2>
    <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy in the App and updating the "Last Updated" date.</p>

    <h2>10. Contact Us</h2>
    <p>If you have questions or concerns about this Privacy Policy or our data practices, please contact us at <a href="mailto:blacktreeai@yahoo.com">blacktreeai@yahoo.com</a>.</p>
  </div>
</body>
</html>`;
  return c.html(html);
});

// File upload endpoint
app.post("/api/upload", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  const storageForm = new FormData();
  storageForm.append("file", file);

  const response = await fetch("https://storage.vibecodeapp.com/v1/files/upload", {
    method: "POST",
    body: storageForm,
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    return c.json({ error: error.error || "Upload failed" }, 500);
  }

  const result = await response.json() as { file: { id: string; url: string; originalFilename: string; contentType: string; sizeBytes: number } };
  return c.json({ data: result.file });
});

// Get current user endpoint
app.get("/api/me", (c) => {
  const user = c.get("user");
  if (!user) return c.body(null, 401);
  return c.json({ data: user });
});

// Routes
app.route("/api/sample", sampleRouter);
app.route("/api/ai", aiRouter);
app.route("/api/user", userRouter);

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 255, // max allowed by Bun for AI requests with large images
};
