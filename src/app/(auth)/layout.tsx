import { Logo } from "@/components/brand";
import {
  Shield,
  BarChart3,
  FileText,
  Bot,
} from "lucide-react";

const features = [
  {
    icon: Shield,
    text: "Certificado para DTE por el Ministerio de Hacienda",
  },
  {
    icon: FileText,
    text: "Facturación electrónica en menos de 2 segundos",
  },
  {
    icon: BarChart3,
    text: "Reportes financieros y fiscales automatizados",
  },
  {
    icon: Bot,
    text: "Asistente IA para consultas tributarias",
  },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left Panel — Premium branding */}
      <div className="hidden w-[55%] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0F1B3D] via-[#152657] to-[#1A2B6D] p-12 lg:flex relative">
        {/* Decorative mesh gradient */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-indigo-400/15 blur-3xl" />
          <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        <div className="relative z-10">
          <Logo size="lg" className="[&_span]:text-white [&_svg_rect]:opacity-0 [&_path]:!fill-white" />
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-bold leading-tight text-white">
              Contabilidad inteligente
              <br />
              <span className="text-blue-300">para El Salvador</span>
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-blue-100/70">
              Facturación DTE, impuestos, nómina y más — todo en una sola
              plataforma diseñada para tu empresa salvadoreña.
            </p>
          </div>

          <div className="space-y-4">
            {features.map((feature) => (
              <div key={feature.text} className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                  <feature.icon className="h-4.5 w-4.5 text-blue-300" />
                </div>
                <span className="text-sm text-blue-100/80">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-blue-200/40">
          &copy; 2026 FiniTax. Todos los derechos reservados.
        </p>
      </div>

      {/* Right Panel — Auth Form */}
      <div className="flex w-full flex-col items-center justify-center bg-background px-6 sm:px-12 lg:w-[45%]">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 lg:hidden">
            <Logo size="lg" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
