import { db } from "@/db/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createToken } from "@/lib/auth";

export type RegisterInput = { email: string; password: string; name: string };
export type LoginInput = { email: string; password: string };

export async function register(input: RegisterInput): Promise<{ token: string; user: { id: string; email: string; name: string; planId: string } }> {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, input.email),
  });
  if (existing) {
    throw new Error("Email already registered");
  }
  const passwordHash = await bcrypt.hash(input.password, 10);
  let user: { id: string | number; email: string; name: string; planId: string };
  try {
    const [row] = await db
      .insert(users)
      .values({
        email: input.email,
        passwordHash,
        name: input.name,
        planId: "free",
      })
      .returning({ id: users.id, email: users.email, name: users.name, planId: users.planId });
    if (!row) throw new Error("Insert failed");
    user = row;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("foreign key") || msg.includes("plans")) {
      throw new Error(
        "Registration is not set up. Please run: npm run db:seed (to seed plans table)"
      );
    }
    throw err;
  }
  const idStr = String(user.id);
  const token = await createToken({
    sub: idStr,
    email: user.email,
    planId: user.planId,
    isAdmin: false,
  });
  return {
    token,
    user: { id: idStr, email: user.email, name: user.name, planId: user.planId },
  };
}

export async function login(input: LoginInput): Promise<{ token: string; user: { id: string; email: string; name: string; planId: string } }> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, input.email),
    columns: { id: true, email: true, name: true, planId: true, passwordHash: true, isActive: true, isAdmin: true },
  });
  if (!user || !user.passwordHash || !user.isActive) {
    throw new Error("Invalid email or password");
  }
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new Error("Invalid email or password");
  const idStr = String(user.id);
  const token = await createToken({
    sub: idStr,
    email: user.email,
    planId: user.planId,
    isAdmin: !!user.isAdmin,
  });
  return {
    token,
    user: { id: idStr, email: user.email, name: user.name, planId: user.planId },
  };
}
