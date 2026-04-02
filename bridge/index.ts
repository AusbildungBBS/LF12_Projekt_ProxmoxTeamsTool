import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import jwt, { JwtPayload } from "jsonwebtoken";
import jwksClient from "jwks-rsa";

dotenv.config();

const PORT = process.env.PORT || 3001;
const TENANT_ID = process.env.AZURE_TENANT_ID || process.env.VITE_AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID || process.env.VITE_AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const API_AUDIENCE = process.env.API_AUDIENCE;

if (!TENANT_ID || !CLIENT_ID) {
  console.warn(
    "[bridge] Missing AZURE_TENANT_ID / AZURE_CLIENT_ID — token validation will fail until set."
  );
}

const app = express();
app.use(cors());
app.use(express.json());

// ── JWKS / Token Validation ────────────────────────────────────────────────────

const jwks = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxAge: 24 * 60 * 60 * 1000,
});

function getSigningKey(header: jwt.JwtHeader, cb: jwt.SigningKeyCallback) {
  if (!header.kid) {
    cb(new Error("Token header missing kid"));
    return;
  }
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err || !key) {
      cb(err || new Error("Signing key not found"));
      return;
    }
    cb(null, key.getPublicKey());
  });
}

export interface BridgeClaims extends JwtPayload {
  oid?: string;
  preferred_username?: string;
  name?: string;
  roles?: string[];
  groups?: string[];
  scp?: string;
}

function verifyToken(token: string): Promise<BridgeClaims> {
  return new Promise((resolve, reject) => {
    const audience = API_AUDIENCE || (CLIENT_ID ? `api://${CLIENT_ID}` : undefined);
    const issuer = `https://login.microsoftonline.com/${TENANT_ID}/v2.0`;
    jwt.verify(
      token,
      getSigningKey,
      {
        audience,
        issuer,
        algorithms: ["RS256"],
      },
      (err, decoded) => {
        if (err || !decoded || typeof decoded === "string") {
          reject(err || new Error("Invalid token"));
          return;
        }
        resolve(decoded as BridgeClaims);
      }
    );
  });
}

// ── Auth Middleware ────────────────────────────────────────────────────────────

declare module "express-serve-static-core" {
  interface Request {
    user?: BridgeClaims;
    rawToken?: string;
  }
}

async function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authorization header required" });
    return;
  }
  const token = header.slice("Bearer ".length);

  try {
    req.user = await verifyToken(token);
    req.rawToken = token;
    next();
  } catch (err) {
    console.error("[bridge] token validation failed:", err);
    res.status(401).json({ error: "Invalid token" });
  }
}

// ── On-Behalf-Of Helper ────────────────────────────────────────────────────────

async function exchangeForGraphToken(userToken: string): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Bridge not configured: missing Azure credentials");
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${TENANT_ID || "common"}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: userToken,
    requested_token_use: "on_behalf_of",
    scope: "https://graph.microsoft.com/.default",
  });

  const response = await axios.post(tokenEndpoint, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return response.data.access_token;
}

// ── Routes ─────────────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/me", requireAuth, async (req, res) => {
  try {
    const graphToken = await exchangeForGraphToken(req.rawToken!);
    const profile = await axios.get("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${graphToken}` },
    });

    res.json({
      profile: profile.data,
      roles: req.user!.roles ?? [],
      groups: req.user!.groups ?? [],
    });
  } catch (error: unknown) {
    console.error("/api/me failed:", error);
    if (axios.isAxiosError(error)) {
      res.status(error.response?.status || 500).json({
        error: "Request failed",
        details: error.response?.data,
      });
    } else {
      res.status(500).json({
        error: "Request failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`[bridge] listening on http://localhost:${PORT}`);
});
