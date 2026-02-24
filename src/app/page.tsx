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
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Facturación DTE",
    description:
      "Genera y transmite Facturas, CCF, Notas de Crédito y más directamente al Ministerio de Hacienda con firma electrónica.",
  },
  {
    icon: Calculator,
    title: "Impuestos Automáticos",
    description:
      "Calcula IVA, Renta, F-07 y F-14 automáticamente. Exporta los CSV exactos que requiere el portal tributario.",
  },
  {
    icon: BarChart3,
    title: "Contabilidad Completa",
    description:
      "Plan de cuentas localizado, partida doble, estados financieros, y conciliación bancaria con IA.",
  },
  {
    icon: Users,
    title: "Nómina & RRHH",
    description:
      "Cálculos automáticos de ISSS, AFP, Aguinaldo e Indemnización conforme al Código de Trabajo.",
  },
  {
    icon: Receipt,
    title: "OCR Inteligente",
    description:
      "Escanea recibos con tu cámara. Extrae automáticamente montos, fechas y códigos DTE.",
  },
  {
    icon: Bot,
    title: "Asistente IA",
    description:
      "Pregunta sobre leyes tributarias, laborales o la ITMIA. Respuestas contextualizadas con inteligencia artificial.",
  },
];

const stats = [
  { value: "13%", label: "IVA calculado automáticamente" },
  { value: "7", label: "Tipos de DTE soportados" },
  { value: "<2s", label: "Firma y transmisión DTE" },
  { value: "24/7", label: "Sincronización con Hacienda" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo size="md" />
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Funciones</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Cómo Funciona</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login"><Button variant="ghost" size="sm">Iniciar Sesión</Button></Link>
            <Link href="/signup"><Button size="sm">Comenzar Gratis <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground shadow-sm">
              <Shield className="h-4 w-4 text-success" />
              Certificado para DTE — Ministerio de Hacienda
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Tu negocio en <span className="text-primary">El Salvador</span><br />merece contabilidad inteligente
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
              Contabilidad, facturación electrónica, nómina e impuestos en una sola plataforma.
              Automatiza tu F-07, genera DTEs con firma digital, y cumple con Hacienda sin esfuerzo.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/signup"><Button size="xl" className="w-full sm:w-auto"><Building2 className="mr-2 h-5 w-5" />Registrar mi Empresa</Button></Link>
              <Link href="#features"><Button variant="outline" size="xl" className="w-full sm:w-auto">Ver Funciones</Button></Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-primary">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Todo lo que necesitas, en un solo lugar</h2>
            <p className="mt-4 text-lg text-muted-foreground">Diseñado específicamente para el ecosistema regulatorio, bancario y tributario de El Salvador.</p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="group relative rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="border-t border-border bg-muted/30 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Cómo Funciona</h2>
            <p className="mt-4 text-lg text-muted-foreground">De la factura a la declaración fiscal en minutos, no días.</p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              { step: "01", title: "Registra tu Empresa", description: "Ingresa tu NIT, NRC e información fiscal. FiniTax configura tu plan de cuentas y conexión con Hacienda automáticamente." },
              { step: "02", title: "Opera tu Negocio", description: "Emite facturas DTE, registra gastos con OCR, gestiona inventario y procesa nómina — todo en una interfaz unificada." },
              { step: "03", title: "Declara sin Esfuerzo", description: "Al final del mes, FiniTax genera tu F-07 y F-14 con un clic. Descarga los CSVs y súbelos al portal de Hacienda." },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="mb-4 text-5xl font-bold text-primary/15">{item.step}</div>
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-16 text-center shadow-2xl sm:px-16">
            <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">¿Listo para simplificar tu contabilidad?</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80">Únete a las empresas salvadoreñas que ya automatizan su facturación DTE, nómina e impuestos con FiniTax.</p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/signup"><Button size="xl" className="bg-white text-primary hover:bg-white/90">Crear Cuenta Gratis <ArrowRight className="ml-2 h-5 w-5" /></Button></Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-primary-foreground/70">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Sin tarjeta de crédito</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Configuración en 5 minutos</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Soporte local</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <Logo size="sm" />
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Términos</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacidad</a>
              <a href="#" className="hover:text-foreground transition-colors">Soporte</a>
              <a href="#" className="hover:text-foreground transition-colors">Contacto</a>
            </div>
            <p className="text-sm text-muted-foreground">© 2026 FiniTax. Hecho en El Salvador 🇸🇻</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
