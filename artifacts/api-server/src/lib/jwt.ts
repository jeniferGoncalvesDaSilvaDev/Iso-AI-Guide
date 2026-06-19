import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.SESSION_SECRET ?? "iso-saas-access-secret";
const REFRESH_SECRET = (process.env.SESSION_SECRET ?? "iso-saas-refresh-secret") + "-refresh";
const ACCESS_EXPIRES = "15m";
const REFRESH_EXPIRES = "7d";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  companyId: string | null;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
}
