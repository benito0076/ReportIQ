import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const links = [
    { href: "/proyectos", label: "Proyectos" },
    { href: "/equipos", label: "Equipos" },
    ...(user.role === "admin"
      ? [
          { href: "/usuarios", label: "Usuarios" },
          { href: "/ajustes", label: "Ajustes" },
        ]
      : []),
  ];
  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/proyectos" className="flex items-center gap-2" aria-label="Ruido Ambiental - Ambienciq Ingenieros">
            <Image src="/logo-icono.png" alt="" width={285} height={256} priority className="h-8 w-auto" />
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="font-semibold">Ruido Ambiental</span>
              <span className="text-[11px] text-muted-foreground">Ambienciq Ingenieros S.A.S.</span>
            </span>
          </Link>
          <AppNav links={links} />
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right text-xs leading-tight md:block">
              <div className="font-medium">{user.fullName ?? user.email}</div>
              <div className="text-muted-foreground">{user.role === "admin" ? "Administrador" : "Usuario"}</div>
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Cerrar sesión" title="Cerrar sesión">
                <LogOut />
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
