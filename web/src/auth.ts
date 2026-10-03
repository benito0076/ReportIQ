import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { logActivity, minutosBloqueo } from "@/server/activity";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
});

// Hash ficticio: bcrypt se ejecuta aunque el correo no exista, para no
// revelar por el tiempo de respuesta si una cuenta existe.
const DUMMY_HASH = bcrypt.hashSync("dummy-password", 10);

class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials";
}

/** Demasiados intentos fallidos: el código lleva los minutos de espera ("bloqueado:15"). */
class TooManyAttempts extends CredentialsSignin {
  constructor(minutos: number) {
    super();
    this.code = `bloqueado:${minutos}`;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) {
          const intento = typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : "";
          await logActivity("login_fallido", { email: intento }, "Datos incompletos o correo inválido");
          throw new InvalidCredentials();
        }
        const espera = await minutosBloqueo(parsed.data.email);
        if (espera > 0) {
          await logActivity("login_bloqueado", { email: parsed.data.email }, `Demasiados intentos fallidos; espera de ${espera} min`);
          throw new TooManyAttempts(espera);
        }
        const [user] = await db
          .select({ id: users.id, email: users.email, name: users.fullName, hash: users.passwordHash })
          .from(users)
          .where(eq(users.email, parsed.data.email))
          .limit(1);
        const ok = await bcrypt.compare(parsed.data.password, user?.hash ?? DUMMY_HASH);
        if (!user || !ok) {
          await logActivity("login_fallido", { id: user?.id, email: parsed.data.email },
            user ? "Contraseña incorrecta" : "El usuario no existe");
          throw new InvalidCredentials();
        }
        await logActivity("login_ok", { id: user.id, email: user.email });
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
