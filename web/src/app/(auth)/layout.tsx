import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Image
          src="/logo.png"
          alt="Ambienciq Ingenieros S.A.S."
          width={770}
          height={120}
          priority
          className="h-auto w-full max-w-xs"
        />
        <span className="text-sm font-medium text-muted-foreground">
          Report<span className="text-primary">IQ</span> · informes de ruido, calidad del aire y vertimientos
        </span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
