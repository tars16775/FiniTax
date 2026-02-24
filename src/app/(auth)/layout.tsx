import { Logo } from "@/components/brand";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left Panel — Branding */}
      <div className="hidden w-1/2 flex-col justify-between bg-primary p-12 lg:flex">
        <Logo size="lg" className="[&_span]:text-primary-foreground [&_svg]:text-primary-foreground" />

        <div className="space-y-4">
          <h2 className="text-3xl font-bold text-primary-foreground">
            Contabilidad inteligente para El Salvador
          </h2>
          <p className="text-lg text-primary-foreground/70">
            Facturación DTE, impuestos, nómina y más — todo en una sola plataforma diseñada para tu empresa.
          </p>
        </div>

        <p className="text-sm text-primary-foreground/50">
          © 2026 FiniTax. Todos los derechos reservados.
        </p>
      </div>

      {/* Right Panel — Auth Form */}
      <div className="flex w-full flex-col items-center justify-center px-4 sm:px-8 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo size="lg" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
