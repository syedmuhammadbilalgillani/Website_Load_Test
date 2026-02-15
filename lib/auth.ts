import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "load-test-saas-secret-change-in-production"
);
const COOKIE_NAME = "loadtest_token";
const ISSUER = "loadtest-saas";

export type JWTPayload = {
  sub: string;
  email: string;
  planId: string;
  isAdmin: boolean;
  iat: number;
  exp: number;
  iss: string;
};

export async function createToken(payload: Omit<JWTPayload, "iat" | "exp" | "iss">): Promise<string> {
  return new SignJWT({
    sub: payload.sub,
    email: payload.email,
    planId: payload.planId,
    isAdmin: payload.isAdmin,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER });
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      planId: (payload.planId as string) ?? "free",
      isAdmin: !!(payload.isAdmin as boolean),
      iat: (payload.iat as number) ?? 0,
      exp: (payload.exp as number) ?? 0,
      iss: (payload.iss as string) ?? "",
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function getTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
