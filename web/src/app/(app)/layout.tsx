import Link from "next/link";
import Image from "next/image";
import { LogOut, UserRound } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { AppNav, type ItemMenu } from "@/components/app-nav";
import { SelectorTema } from "@/components/tema";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const admin = user.role === "admin";
  const items: ItemMenu[] = [
    { href: "/inicio", label: "Inicio" },
    {
      label: "Proyectos",
      items: [
        { href: "/proyectos", label: "Todos los proyectos", descripcion: "Listado con filtros y búsqueda" },
        { href: "/proyectos?matriz=ruido", label: "Ruido", descripcion: "Ambiental y emisión (Res. 0627 de 2006)" },
        { href: "/aire", label: "Calidad del aire", descripcion: "Res. 2254 de 2017" },
        { href: "/vertimientos", label: "Vertimientos", descripcion: "Res. 0631 de 2015" },
      ],
    },
    { href: "/equipos", label: "Equipos" },
    ...(admin
      ? [
          {
            label: "Administración",
            items: [
              { href: "/usuarios", label: "Usuarios" },
              { href: "/ajustes", label: "Ajustes", descripcion: "Firmas, empresa y plantilla Word" },
              { href: "/actividad", label: "Actividad", descripcion: "Registro de accesos y acciones" },
            ],
          },
        ]
      : []),
  ];
  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/inicio" className="flex items-center gap-2" aria-label="ReportIQ - Ambienciq Ingenieros">
            <Image src="/logo-icono.png" alt="" width={285} height={256} priority className="h-8 w-auto" />
            <span className="flex flex-col leading-tight">
              <span className="font-semibold tracking-tight">
                Report<span className="text-primary">IQ</span>
              </span>
              <span className="hidden text-[11px] text-muted-foreground sm:block">Ambienciq Ingenieros S.A.S.</span>
            </span>
          </Link>
          <div className="order-last md:order-none">
            <AppNav items={items} />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/perfil"
              title="Mi perfil: nombre y cargo de «Elaboró»"
              className="mr-1 flex items-center gap-2 rounded-lg px-2 py-1 text-right text-xs leading-tight hover:bg-muted"
            >
              <span className="hidden lg:block">
                <span className="block font-medium">{user.fullName ?? user.email}</span>
                <span className="block text-muted-foreground">{user.cargo || (admin ? "Administrador" : "Usuario")}</span>
              </span>
              <UserRound className="size-4 lg:hidden" aria-label="Mi perfil" />
            </Link>
            <SelectorTema />
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
