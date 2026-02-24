import Link from "next/link";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Calculator,
  Users,
  Bot,
  Shield,
  ArrowRight,
  CheckCircle2,
  BarChart3,
  Receipt,
  Building2,
  ChevronRight,
  Zap,
  Lock,
  Globe,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Facturacion DTE",
    description:
      "Genera y transmite Facturas, CCF, Notas de Credito y mas al Ministerio de Hacienda con firma electronica.",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/50",
  },
  {
    icon: Calculator,
    title: "Impuestos Automaticos",
    description:
      "Calcula IVA, Renta, F-07 y F-14 automaticamente. Exporta CSVs exactos para el portal tributario.",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/50",
  },
  {
    icon: BarChart3,
    title: "Contabilidad Completa",
    description:
      "Plan de cuentas localizado, partida doble, estados financieros y conciliacion bancaria.",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/50",
  },
  {
    icon: Users,
    title: "Nomina & RRHH",
    description:
      "Calculos automaticos de ISSS, AFP, Aguinaldo e Indemnizacion conforme al Codigo de Trabajo.",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/50",
  },
  {
    icon: Receipt,
    title: "Control de Gastos",
    description:
      "Registra gastos, categoriza automaticamente y rastrea deducciones fiscales en tiempo real.",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/50",
  },
  {
    icon: Bot,
    title: "Asistente IA",
    description:
      "Pregunta sobre leyes tributarias y laborales. Respuestas contextualizadas con inteligencia artificial.",
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/50",
  },
];

const stats = [
  { value: "13%", label: "IVA calculado automaticamente" },
  { value: "7", label: "Tipos de DTE soportados" },
  { value: "<2s", label: "Firma y transmision DTE" },
  { value: "24/7", label: "Sincronizacion con Hacienda" },
];

const steps = [
  {
    step: "01",
    title: "Registra tu Empresa",
    description:
      "Ingresa tu NIT, NRC e informacion fiscal. FiniTax configura tu plan de cuentas y conexion con Hacienda automaticamente.",
  },
  {
    step: "02",
    title: "Opera tu Negocio",
    description:
      "Emite facturas DTE, registra gastos, gestiona inventario y procesa nomina en una interfaz unificada.",
  },
  {
    step: "03",
    title: "Declara sin Esfuerzo",
    description:
      "Al final del mes FiniTax genera tu F-07 y F-14 con un clic. Descarga los CSVs y subelos al portal.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ─── Navbar ─── */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo size="md" />
          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Funciones
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Como Funciona
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Iniciar Sesion
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">
                Comenzar Gratis
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/8 via-primary/4 to-transparent blur-3xl" />
          <div className="absolute -bottom-20 right-0 h-[300px] w-[400px] rounded-full bg-blue-400/5 blur-3xl" />
        </div>
        {/* Grid overlay */}
        <div
          className="absolute inset-0 -z-10 opacity-[0.015] dark:opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm shadow-sm">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                <Shield className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-muted-foreground">
                Certificado para DTE — Ministerio de Hacienda
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl lg:leading-[1.1]">
              Tu negocio en{" "}
              <span className="bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                El Salvador
              </span>
              <br />
              merece contabilidad inteligente
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Contabilidad, facturacion electronica, nomina e impuestos en una
              sola plataforma. Automatiza tu F-07, genera DTEs con firma digital
              y cumple con Hacienda sin esfuerzo.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/signup">
                <Button size="xl" className="w-full sm:w-auto shadow-lg shadow-primary/20">
                  <Building2 className="mr-2 h-5 w-5" />
                  Registrar mi Empresa
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" size="xl" className="w-full sm:w-auto">
                  Ver Funciones
                </Button>
              </Link>
            </div>

            {/* Trust signals */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground/60">
              <span className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                Encriptacion de extremo a extremo
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                Configuracion en 5 minutos
              </span>
              <span className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                Hecho para El Salvador
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="border-y border-border/40 bg-card/50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="mt-1.5 text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Todo lo que necesitas, en un solo lugar
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Disenado especificamente para el ecosistema regulatorio, bancario
              y tributario de El Salvador.
            </p>
          </div>
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-border/60 bg-card p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20"
              >
                <div
                  className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${feature.bg}`}
                >
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it Works ─── */}
      <section
        id="how-it-works"
        className="border-t border-border/40 bg-muted/20 py-24 sm:py-32"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Como Funciona
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              De la factura a la declaracion fiscal en minutos, no dias.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {steps.map((item, idx) => (
              <div key={item.step} className="relative">
                {/* Connector line */}
                {idx < steps.length - 1 && (
                  <div className="absolute right-0 top-10 hidden h-px w-full translate-x-1/2 bg-gradient-to-r from-primary/20 to-transparent md:block" />
                )}
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F1B3D] via-[#152657] to-[#1A2B6D] px-6 py-20 text-center shadow-2xl sm:px-16">
            {/* Decorative elements */}
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
            <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl" />

            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Listo para simplificar tu contabilidad?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100/70">
                Unete a las empresas salvadorenas que ya automatizan su
                facturacion DTE, nomina e impuestos con FiniTax.
              </p>
              <div className="mt-10 flex items-center justify-center gap-4">
                <Link href="/signup">
                  <Button
                    size="xl"
                    className="bg-white text-[#1A2B6D] hover:bg-white/90 shadow-lg"
                  >
                    Crear Cuenta Gratis
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-blue-100/50">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Sin tarjeta de credito
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Configuracion en 5
                  minutos
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Soporte local
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border/40 bg-card/50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <Logo size="sm" />
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <a
                href="#"
                className="transition-colors hover:text-foreground"
              >
                Terminos
              </a>
              <a
                href="#"
                className="transition-colors hover:text-foreground"
              >
                Privacidad
              </a>
              <a
                href="#"
                className="transition-colors hover:text-foreground"
              >
                Soporte
              </a>
              <a
                href="#"
                className="transition-colors hover:text-foreground"
              >
                Contacto
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              2026 FiniTax. Hecho en El Salvador.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
