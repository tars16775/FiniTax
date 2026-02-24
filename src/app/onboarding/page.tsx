"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrganization } from "@/lib/actions/organizations";
import { updateUserProfile } from "@/lib/actions/profiles";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SV_INDUSTRY_CODES } from "@/lib/types/forms";
import {
  Building2,
  User,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Sparkles,
  Search,
} from "lucide-react";

const STEPS = [
  { id: "profile", title: "Tu Perfil", icon: User },
  { id: "company", title: "Tu Empresa", icon: Building2 },
  { id: "complete", title: "¡Listo!", icon: CheckCircle2 },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [duiNumber, setDuiNumber] = useState("");

  // Company fields
  const [companyName, setCompanyName] = useState("");
  const [nitNumber, setNitNumber] = useState("");
  const [nrcNumber, setNrcNumber] = useState("");
  const [industryCode, setIndustryCode] = useState("");
  const [industrySearch, setIndustrySearch] = useState("");
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNitChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 4) setNitNumber(digits);
    else if (digits.length <= 10) setNitNumber(`${digits.slice(0, 4)}-${digits.slice(4)}`);
    else if (digits.length <= 13) setNitNumber(`${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10)}`);
    else setNitNumber(`${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10, 13)}-${digits.slice(13)}`);
  };

  const handleDuiChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    if (digits.length <= 8) setDuiNumber(digits);
    else setDuiNumber(`${digits.slice(0, 8)}-${digits.slice(8)}`);
  };

  const filteredIndustries = SV_INDUSTRY_CODES.filter(
    (ind) => ind.label.toLowerCase().includes(industrySearch.toLowerCase()) || ind.value.includes(industrySearch)
  ).slice(0, 8);

  // Step 1: Save Profile
  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError("Nombre y apellido son requeridos");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("first_name", firstName.trim());
      formData.set("last_name", lastName.trim());
      formData.set("dui_number", duiNumber.replace(/\D/g, ""));
      const result = await updateUserProfile(formData);
      if (!result.success) { setError(result.error || "Error al guardar perfil"); return; }
      setCurrentStep(1);
    } catch {
      setError("Error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Create Organization
  const handleCreateOrganization = async () => {
    if (!companyName.trim()) { setError("El nombre de la empresa es requerido"); return; }
    const cleanNit = nitNumber.replace(/\D/g, "");
    if (cleanNit.length !== 14) { setError("El NIT debe tener exactamente 14 dígitos"); return; }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("name", companyName.trim());
      formData.set("nit_number", cleanNit);
      formData.set("nrc_number", nrcNumber.replace(/\D/g, ""));
      formData.set("industry_code", industryCode);
      const result = await createOrganization(formData);
      if (!result.success) { setError(result.error || "Error al crear empresa"); return; }
      setCurrentStep(2);
    } catch {
      setError("Error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Go to dashboard
  const handleFinish = () => {
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Logo size="sm" />
        <span className="text-sm text-muted-foreground">
          Paso {currentStep + 1} de {STEPS.length}
        </span>
      </header>

      {/* Progress */}
      <div className="px-6 pt-4">
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Step Indicators */}
      <div className="flex justify-center gap-8 px-6 py-6">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isComplete = index < currentStep;
          return (
            <div key={step.id} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                  isComplete ? "bg-success text-success-foreground"
                    : isActive ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isComplete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className={`hidden text-sm font-medium sm:block ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                {step.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex flex-1 items-start justify-center px-4 py-4">
        <div className="w-full max-w-lg">
          {/* Error Banner */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Step 1: Profile */}
          {currentStep === 0 && (
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Completa tu perfil</CardTitle>
                <CardDescription>Necesitamos algunos datos básicos para personalizar tu experiencia</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nombre *</Label>
                    <Input id="firstName" placeholder="Juan" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Apellido *</Label>
                    <Input id="lastName" placeholder="Martínez" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dui">DUI (opcional)</Label>
                  <Input id="dui" placeholder="00000000-0" value={duiNumber} onChange={(e) => handleDuiChange(e.target.value)} maxLength={10} />
                  <p className="text-xs text-muted-foreground">Tu Documento Único de Identidad. Se usa para firmas electrónicas.</p>
                </div>
                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveProfile} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Continuar</span><ArrowRight className="h-4 w-4" /></>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Company */}
          {currentStep === 1 && (
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Configura tu empresa</CardTitle>
                <CardDescription>Ingresa los datos fiscales de tu empresa para comenzar a facturar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nombre de la empresa *</Label>
                  <Input id="companyName" placeholder="Mi Empresa, S.A. de C.V." value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoFocus />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nit">NIT *</Label>
                  <Input id="nit" placeholder="0000-000000-000-0" value={nitNumber} onChange={(e) => handleNitChange(e.target.value)} maxLength={17} />
                  <p className="text-xs text-muted-foreground">Número de Identificación Tributaria (14 dígitos)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nrc">NRC (opcional)</Label>
                  <Input id="nrc" placeholder="000000-0" value={nrcNumber} onChange={(e) => setNrcNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} />
                  <p className="text-xs text-muted-foreground">Número de Registro de Contribuyente</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Actividad Económica (opcional)</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="industry"
                      placeholder="Buscar actividad económica..."
                      value={industrySearch}
                      onChange={(e) => { setIndustrySearch(e.target.value); setShowIndustryDropdown(true); }}
                      onFocus={() => setShowIndustryDropdown(true)}
                      onBlur={() => setTimeout(() => setShowIndustryDropdown(false), 200)}
                      className="pl-9"
                    />
                    {showIndustryDropdown && filteredIndustries.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                        {filteredIndustries.map((ind) => (
                          <button
                            key={ind.value}
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                            onMouseDown={(e) => { e.preventDefault(); setIndustryCode(ind.value); setIndustrySearch(`${ind.value} — ${ind.label}`); setShowIndustryDropdown(false); }}
                          >
                            <span className="font-mono text-xs text-muted-foreground">{ind.value}</span>
                            <span>{ind.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {industryCode && <p className="text-xs text-success">✓ Código CIIU seleccionado: {industryCode}</p>}
                </div>
                <div className="flex justify-between pt-4">
                  <Button variant="ghost" onClick={() => { setCurrentStep(0); setError(null); }}>
                    <ArrowLeft className="h-4 w-4" />
                    Atrás
                  </Button>
                  <Button onClick={handleCreateOrganization} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Crear empresa</span><ArrowRight className="h-4 w-4" /></>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Complete */}
          {currentStep === 2 && (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                  <Sparkles className="h-8 w-8 text-success" />
                </div>
                <h2 className="text-2xl font-bold">¡Todo listo!</h2>
                <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                  Tu empresa <strong>{companyName}</strong> ha sido creada exitosamente. Ya puedes comenzar a usar FiniTax para gestionar tu contabilidad y facturación electrónica.
                </p>
                <div className="mx-auto mt-8 max-w-sm space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border border-border p-3 text-left">
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Perfil configurado</p>
                      <p className="text-xs text-muted-foreground">{firstName} {lastName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-border p-3 text-left">
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Empresa registrada</p>
                      <p className="text-xs text-muted-foreground">NIT: {nitNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-border p-3 text-left">
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Rol: Administrador</p>
                      <p className="text-xs text-muted-foreground">Control total de la empresa</p>
                    </div>
                  </div>
                </div>
                <Button size="xl" onClick={handleFinish} className="mt-8">
                  <Sparkles className="h-5 w-5" />
                  Ir al Dashboard
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
