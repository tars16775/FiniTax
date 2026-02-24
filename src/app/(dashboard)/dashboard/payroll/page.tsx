"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { usePermissions, ProtectedPage } from "@/lib/rbac/client-guard";
import { useToast } from "@/components/ui/toast";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus,
  getPayrollRuns,
  getPayrollRun,
  createPayrollRun,
  updatePayrollRunStatus,
  deletePayrollRun,
  getPayrollStats,
} from "@/lib/actions/payroll";
import {
  calculateDeductions,
  EMPLOYEE_STATUS_META,
  PAYROLL_STATUS_META,
  type PayrollRunWithDetails,
} from "@/lib/payroll-utils";
import type { Employee, EmployeeStatus, PayrollRun, PayrollStatus } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Loader2,
  Edit,
  Trash2,
  Eye,
  Users,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  UserX,
  UserCheck,
  CreditCard,
  FileText,
  Play,
  Briefcase,
  Building,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Helpers
// ============================================

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string): string {
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric" });
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type ActiveTab = "employees" | "payroll";

// ============================================
// Employee Form Dialog
// ============================================

interface EmployeeFormDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  editEmployee: Employee | null;
  onSaved: () => void;
}

function EmployeeFormDialog({ open, onClose, orgId, editEmployee, onSaved }: EmployeeFormDialogProps) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dui, setDui] = useState("");
  const [nit, setNit] = useState("");
  const [afpNumber, setAfpNumber] = useState("");
  const [isssNumber, setIsssNumber] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [hireDate, setHireDate] = useState(todayISO());
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [bankAccount, setBankAccount] = useState("");

  const isEdit = !!editEmployee;

  useEffect(() => {
    if (editEmployee) {
      setFirstName(editEmployee.first_name);
      setLastName(editEmployee.last_name);
      setDui(editEmployee.dui_number);
      setNit(editEmployee.nit_number || "");
      setAfpNumber(editEmployee.afp_number || "");
      setIsssNumber(editEmployee.isss_number || "");
      setBaseSalary(String(editEmployee.base_salary));
      setHireDate(editEmployee.hire_date);
      setDepartment(editEmployee.department || "");
      setPosition(editEmployee.position || "");
      setBankAccount(editEmployee.bank_account || "");
    } else {
      setFirstName("");
      setLastName("");
      setDui("");
      setNit("");
      setAfpNumber("");
      setIsssNumber("");
      setBaseSalary("");
      setHireDate(todayISO());
      setDepartment("");
      setPosition("");
      setBankAccount("");
    }
  }, [editEmployee, open]);

  // Live deduction preview
  const salaryNum = Number(baseSalary) || 0;
  const deductions = salaryNum > 0 ? calculateDeductions(salaryNum) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      addToast({ title: "Nombre y apellido requeridos", variant: "error" });
      return;
    }
    if (dui.length !== 9) {
      addToast({ title: "DUI debe tener 9 dígitos", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      const input = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        dui_number: dui.trim(),
        nit_number: nit.trim() || undefined,
        afp_number: afpNumber.trim() || undefined,
        isss_number: isssNumber.trim() || undefined,
        base_salary: salaryNum,
        hire_date: hireDate,
        department: department.trim() || undefined,
        position: position.trim() || undefined,
        bank_account: bankAccount.trim() || undefined,
      };

      const result = isEdit
        ? await updateEmployee(orgId, editEmployee.id, input)
        : await createEmployee(orgId, input);

      if (!result.success) {
        addToast({ title: result.error || "Error", variant: "error" });
        return;
      }

      addToast({ title: isEdit ? "Empleado actualizado" : "Empleado registrado", variant: "success" });
      onSaved();
      onClose();
    } catch {
      addToast({ title: "Error inesperado", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => !saving && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Empleado" : "Nuevo Empleado"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Modifica los datos del empleado." : "Registra un nuevo empleado para la planilla."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="emp-fn">Nombre *</Label>
              <Input id="emp-fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-ln">Apellido *</Label>
              <Input id="emp-ln" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={100} />
            </div>
          </div>

          {/* DUI + NIT */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="emp-dui">DUI * (9 dígitos)</Label>
              <Input id="emp-dui" value={dui} onChange={(e) => setDui(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="000000000" maxLength={9} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-nit">NIT</Label>
              <Input id="emp-nit" value={nit} onChange={(e) => setNit(e.target.value)} placeholder="0000-000000-000-0" maxLength={14} />
            </div>
          </div>

          {/* AFP + ISSS */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="emp-afp">No. AFP</Label>
              <Input id="emp-afp" value={afpNumber} onChange={(e) => setAfpNumber(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-isss">No. ISSS</Label>
              <Input id="emp-isss" value={isssNumber} onChange={(e) => setIsssNumber(e.target.value)} maxLength={50} />
            </div>
          </div>

          {/* Salary + Hire date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="emp-salary">Salario Base (USD) *</Label>
              <Input id="emp-salary" type="number" step="0.01" min="0.01" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-hire">Fecha Contratación *</Label>
              <Input id="emp-hire" type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
            </div>
          </div>

          {/* Live deduction preview */}
          {deductions && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-1 text-xs">
              <span className="font-medium text-sm block mb-1">Vista previa de deducciones</span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-muted-foreground">ISSS Empleado (3%)</span>
                <span className="text-right">${formatMoney(deductions.isss_employee)}</span>
                <span className="text-muted-foreground">AFP Empleado (7.25%)</span>
                <span className="text-right">${formatMoney(deductions.afp_employee)}</span>
                <span className="text-muted-foreground">ISR</span>
                <span className="text-right">${formatMoney(deductions.income_tax)}</span>
                <span className="text-muted-foreground font-medium border-t pt-1">Total Deducciones</span>
                <span className="text-right font-medium border-t pt-1">${formatMoney(deductions.total_deductions)}</span>
                <span className="text-muted-foreground font-bold">Salario Neto</span>
                <span className="text-right font-bold text-green-600">${formatMoney(deductions.net_salary)}</span>
              </div>
              <div className="border-t mt-2 pt-1 text-muted-foreground">
                Costo patronal: ISSS ${formatMoney(deductions.isss_employer)} + AFP ${formatMoney(deductions.afp_employer)} = ${formatMoney(deductions.employer_cost)}
              </div>
            </div>
          )}

          {/* Department + Position */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="emp-dept">Departamento</Label>
              <Input id="emp-dept" value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-pos">Cargo</Label>
              <Input id="emp-pos" value={position} onChange={(e) => setPosition(e.target.value)} maxLength={100} />
            </div>
          </div>

          {/* Bank account */}
          <div className="space-y-2">
            <Label htmlFor="emp-bank">Cuenta Bancaria</Label>
            <Input id="emp-bank" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="No. de cuenta para depósito" maxLength={50} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEdit ? "Guardar" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Payroll Run Detail Dialog
// ============================================

interface PayrollRunDetailDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  run: PayrollRunWithDetails | null;
  onRefresh: () => void;
}

function PayrollRunDetailDialog({ open, onClose, orgId, run, onRefresh }: PayrollRunDetailDialogProps) {
  const { addToast } = useToast();
  const [acting, setActing] = useState(false);

  if (!run) return null;

  const statusMeta = PAYROLL_STATUS_META[run.status];

  async function handleStatusChange(status: "APPROVED" | "PAID") {
    if (!run) return;
    setActing(true);
    const res = await updatePayrollRunStatus(orgId, run.id, status);
    if (res.success) {
      addToast({ title: status === "APPROVED" ? "Planilla aprobada" : "Planilla marcada como pagada", variant: "success" });
      onRefresh();
      onClose();
    } else {
      addToast({ title: res.error || "Error", variant: "error" });
    }
    setActing(false);
  }

  return (
    <Dialog open={open} onOpenChange={() => !acting && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Planilla: {formatDate(run.period_start)} — {formatDate(run.period_end)}
          </DialogTitle>
          <DialogDescription>
            <Badge className={cn("text-xs", statusMeta.color)}>{statusMeta.label}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border p-3">
              <span className="text-xs text-muted-foreground block">Bruto</span>
              <span className="font-bold text-lg">${formatMoney(run.total_gross)}</span>
            </div>
            <div className="rounded-lg border p-3">
              <span className="text-xs text-muted-foreground block">Deducciones</span>
              <span className="font-bold text-lg text-red-600">${formatMoney(run.total_deductions)}</span>
            </div>
            <div className="rounded-lg border p-3">
              <span className="text-xs text-muted-foreground block">Neto a Pagar</span>
              <span className="font-bold text-lg text-green-600">${formatMoney(run.total_net)}</span>
            </div>
          </div>

          {/* Detail table */}
          {run.details.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium">Empleado</th>
                      <th className="text-right p-2 font-medium">Bruto</th>
                      <th className="text-right p-2 font-medium">ISSS</th>
                      <th className="text-right p-2 font-medium">AFP</th>
                      <th className="text-right p-2 font-medium">ISR</th>
                      <th className="text-right p-2 font-medium">Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.details.map((d) => (
                      <tr key={d.id} className="border-b">
                        <td className="p-2">
                          <span className="font-medium">{d.employee_name}</span>
                          <span className="text-muted-foreground ml-1 font-mono">{d.dui_number}</span>
                        </td>
                        <td className="p-2 text-right font-mono">${formatMoney(d.gross_salary)}</td>
                        <td className="p-2 text-right font-mono">${formatMoney(d.isss_employee)}</td>
                        <td className="p-2 text-right font-mono">${formatMoney(d.afp_employee)}</td>
                        <td className="p-2 text-right font-mono">${formatMoney(d.income_tax)}</td>
                        <td className="p-2 text-right font-mono font-bold">${formatMoney(d.net_salary)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Employer cost summary */}
          {run.details.length > 0 && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <span className="font-medium block mb-1">Costo Patronal</span>
              <div className="flex gap-4">
                <span>ISSS Patronal: ${formatMoney(run.details.reduce((s, d) => s + d.isss_employer, 0))}</span>
                <span>AFP Patronal: ${formatMoney(run.details.reduce((s, d) => s + d.afp_employer, 0))}</span>
                <span className="font-medium">
                  Total: ${formatMoney(run.details.reduce((s, d) => s + d.isss_employer + d.afp_employer, 0))}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="border-t pt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const { exportPayrollCSV } = await import("@/lib/actions/exports");
                const result = await exportPayrollCSV(orgId, run.id);
                if (result.success && result.data) {
                  const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `planilla_${run.period_start}_${run.period_end}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              Exportar CSV
            </Button>
            {run.status === "DRAFT" && (
              <Button size="sm" onClick={() => handleStatusChange("APPROVED")} disabled={acting} className="bg-blue-600 hover:bg-blue-700 text-white">
                {acting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Aprobar Planilla
              </Button>
            )}
            {run.status === "APPROVED" && (
              <Button size="sm" onClick={() => handleStatusChange("PAID")} disabled={acting} className="bg-green-600 hover:bg-green-700 text-white">
                {acting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CreditCard className="h-4 w-4 mr-1" />}
                Marcar como Pagada
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// New Payroll Run Dialog
// ============================================

interface NewPayrollDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  onCreated: () => void;
}

function NewPayrollDialog({ open, onClose, orgId, onCreated }: NewPayrollDialogProps) {
  const { addToast } = useToast();
  const [creating, setCreating] = useState(false);

  // Default to current month
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();

  const [periodStart, setPeriodStart] = useState(`${y}-${m}-01`);
  const [periodEnd, setPeriodEnd] = useState(`${y}-${m}-${String(lastDay).padStart(2, "0")}`);

  async function handleCreate() {
    setCreating(true);
    const res = await createPayrollRun(orgId, {
      period_start: periodStart,
      period_end: periodEnd,
    });
    if (res.success) {
      addToast({ title: "Planilla generada exitosamente", variant: "success" });
      onCreated();
      onClose();
    } else {
      addToast({ title: res.error || "Error", variant: "error" });
    }
    setCreating(false);
  }

  return (
    <Dialog open={open} onOpenChange={() => !creating && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Generar Planilla
          </DialogTitle>
          <DialogDescription>
            Se calcularán automáticamente las deducciones de ISSS, AFP e ISR para todos los empleados activos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Inicio del Período</Label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fin del Período</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={creating}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Generar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Main Page
// ============================================

export default function PayrollPage() {
  const { activeOrg } = useOrganization();
  const permissions = usePermissions();
  const { addToast } = useToast();

  const [tab, setTab] = useState<ActiveTab>("employees");

  // Employees
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [empSearch, setEmpSearch] = useState("");
  const [empStatusFilter, setEmpStatusFilter] = useState<EmployeeStatus | "">("");
  const [empFormOpen, setEmpFormOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);

  // Payroll
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runDetailOpen, setRunDetailOpen] = useState(false);
  const [runDetail, setRunDetail] = useState<PayrollRunWithDetails | null>(null);
  const [newRunOpen, setNewRunOpen] = useState(false);
  const [deleteRunId, setDeleteRunId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Stats
  const [stats, setStats] = useState<{
    activeEmployees: number;
    totalMonthlyPayroll: number;
    totalEmployerCost: number;
    lastRunStatus: PayrollStatus | null;
  } | null>(null);

  const orgId = activeOrg?.id;
  const canManage = permissions.can("payroll.manage_employees");
  const canRun = permissions.can("payroll.run");

  // Load employees
  const loadEmployees = useCallback(async () => {
    if (!orgId) return;
    setEmpLoading(true);
    const res = await getEmployees(orgId, {
      status: empStatusFilter || undefined,
      search: empSearch || undefined,
    });
    if (res.success && res.data) setEmployees(res.data);
    setEmpLoading(false);
  }, [orgId, empSearch, empStatusFilter]);

  // Load payroll runs
  const loadRuns = useCallback(async () => {
    if (!orgId) return;
    setRunsLoading(true);
    const res = await getPayrollRuns(orgId);
    if (res.success && res.data) setRuns(res.data);
    setRunsLoading(false);
  }, [orgId]);

  // Load stats
  const loadStats = useCallback(async () => {
    if (!orgId) return;
    const res = await getPayrollStats(orgId);
    if (res.success && res.data) setStats(res.data);
  }, [orgId]);

  useEffect(() => {
    loadEmployees();
    loadRuns();
    loadStats();
  }, [loadEmployees, loadRuns, loadStats]);

  // Employee status change
  async function handleEmpStatus(emp: Employee, status: EmployeeStatus) {
    if (!orgId) return;
    const res = await updateEmployeeStatus(
      orgId,
      emp.id,
      status,
      status === "TERMINATED" ? todayISO() : undefined
    );
    if (res.success) {
      addToast({ title: `Estado actualizado: ${EMPLOYEE_STATUS_META[status].label}`, variant: "success" });
      loadEmployees();
      loadStats();
    } else {
      addToast({ title: res.error || "Error", variant: "error" });
    }
  }

  // Open run detail
  async function openRunDetail(run: PayrollRun) {
    if (!orgId) return;
    const res = await getPayrollRun(orgId, run.id);
    if (res.success && res.data) {
      setRunDetail(res.data);
      setRunDetailOpen(true);
    }
  }

  // Delete run
  async function handleDeleteRun() {
    if (!orgId || !deleteRunId) return;
    setDeleting(true);
    const res = await deletePayrollRun(orgId, deleteRunId);
    if (res.success) {
      addToast({ title: "Planilla eliminada", variant: "success" });
      loadRuns();
      loadStats();
    } else {
      addToast({ title: res.error || "Error", variant: "error" });
    }
    setDeleting(false);
    setDeleteRunId(null);
  }

  const tabs: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { key: "employees", label: "Empleados", icon: <Users className="h-4 w-4" /> },
    { key: "payroll", label: "Planillas", icon: <FileText className="h-4 w-4" /> },
  ];

  const empStatuses: { key: EmployeeStatus | ""; label: string }[] = [
    { key: "", label: "Todos" },
    { key: "ACTIVE", label: "Activos" },
    { key: "INACTIVE", label: "Inactivos" },
    { key: "TERMINATED", label: "Cesados" },
  ];

  return (
    <ProtectedPage permission="payroll.view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Briefcase className="h-6 w-6" />
              Nómina
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gestiona empleados, planilla, ISSS, AFP e ISR
            </p>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Empleados Activos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeEmployees}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Planilla Mensual</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${formatMoney(stats.totalMonthlyPayroll)}</div>
                <p className="text-xs text-muted-foreground">salarios brutos</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Costo Total Patronal</CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${formatMoney(stats.totalEmployerCost)}</div>
                <p className="text-xs text-muted-foreground">salarios + ISSS/AFP patronal</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Última Planilla</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.lastRunStatus ? (
                    <Badge className={cn("text-xs", PAYROLL_STATUS_META[stats.lastRunStatus].color)}>
                      {PAYROLL_STATUS_META[stats.lastRunStatus].label}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">Sin planillas</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ========== EMPLOYEES TAB ========== */}
        {tab === "employees" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-10" placeholder="Buscar por nombre o DUI..." value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} />
              </div>
              <div className="flex gap-2">
                {empStatuses.map((s) => (
                  <Button
                    key={s.key}
                    variant={empStatusFilter === s.key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEmpStatusFilter(s.key as EmployeeStatus | "")}
                    className="text-xs h-9"
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
              {canManage && (
                <Button onClick={() => { setEditEmp(null); setEmpFormOpen(true); }}>
                  <UserPlus className="h-4 w-4 mr-2" /> Nuevo Empleado
                </Button>
              )}
            </div>

            {/* Employee list */}
            {empLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : employees.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold text-lg mb-1">No hay empleados</h3>
                  <p className="text-muted-foreground text-sm mb-4">Registra empleados para poder generar planillas.</p>
                  {canManage && (
                    <Button onClick={() => { setEditEmp(null); setEmpFormOpen(true); }}>
                      <UserPlus className="h-4 w-4 mr-2" /> Nuevo Empleado
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Empleado</th>
                        <th className="text-left p-3 font-medium">DUI</th>
                        <th className="text-left p-3 font-medium">Depto / Cargo</th>
                        <th className="text-right p-3 font-medium">Salario</th>
                        <th className="text-right p-3 font-medium">Neto Est.</th>
                        <th className="text-center p-3 font-medium">Estado</th>
                        <th className="text-right p-3 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp) => {
                        const ded = calculateDeductions(emp.base_salary);
                        const sMeta = EMPLOYEE_STATUS_META[emp.status];
                        return (
                          <tr key={emp.id} className={cn("border-b hover:bg-muted/30 transition-colors", emp.status !== "ACTIVE" && "opacity-60")}>
                            <td className="p-3">
                              <span className="font-medium">{emp.first_name} {emp.last_name}</span>
                              <span className="text-xs text-muted-foreground block">
                                Desde {formatDate(emp.hire_date)}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-xs">{emp.dui_number}</td>
                            <td className="p-3 text-muted-foreground text-xs">
                              {[emp.department, emp.position].filter(Boolean).join(" · ") || "—"}
                            </td>
                            <td className="p-3 text-right font-mono">${formatMoney(emp.base_salary)}</td>
                            <td className="p-3 text-right font-mono text-green-600">${formatMoney(ded.net_salary)}</td>
                            <td className="p-3 text-center">
                              <Badge className={cn("text-[10px]", sMeta.color)}>{sMeta.label}</Badge>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {canManage && (
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditEmp(emp); setEmpFormOpen(true); }}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                                {canManage && emp.status === "ACTIVE" && (
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => handleEmpStatus(emp, "TERMINATED")}>
                                    <UserX className="h-4 w-4" />
                                  </Button>
                                )}
                                {canManage && emp.status === "TERMINATED" && (
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" onClick={() => handleEmpStatus(emp, "ACTIVE")}>
                                    <UserCheck className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== PAYROLL RUNS TAB ========== */}
        {tab === "payroll" && (
          <div className="space-y-4">
            {canRun && (
              <div className="flex justify-end">
                <Button onClick={() => setNewRunOpen(true)}>
                  <Play className="h-4 w-4 mr-2" /> Generar Planilla
                </Button>
              </div>
            )}

            {runsLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : runs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold text-lg mb-1">No hay planillas</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Genera tu primera planilla mensual. Se calcularán automáticamente ISSS, AFP e ISR.
                  </p>
                  {canRun && (
                    <Button onClick={() => setNewRunOpen(true)}>
                      <Play className="h-4 w-4 mr-2" /> Generar Planilla
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Período</th>
                        <th className="text-right p-3 font-medium">Bruto</th>
                        <th className="text-right p-3 font-medium">Deducciones</th>
                        <th className="text-right p-3 font-medium">Neto</th>
                        <th className="text-center p-3 font-medium">Estado</th>
                        <th className="text-right p-3 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((run) => {
                        const sMeta = PAYROLL_STATUS_META[run.status];
                        return (
                          <tr key={run.id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="p-3">
                              <span className="font-medium">{formatDate(run.period_start)}</span>
                              <span className="text-muted-foreground mx-1">—</span>
                              <span className="font-medium">{formatDate(run.period_end)}</span>
                            </td>
                            <td className="p-3 text-right font-mono">${formatMoney(run.total_gross)}</td>
                            <td className="p-3 text-right font-mono text-red-600">${formatMoney(run.total_deductions)}</td>
                            <td className="p-3 text-right font-mono font-bold text-green-600">${formatMoney(run.total_net)}</td>
                            <td className="p-3 text-center">
                              <Badge className={cn("text-[10px]", sMeta.color)}>{sMeta.label}</Badge>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openRunDetail(run)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {run.status === "DRAFT" && canRun && (
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => setDeleteRunId(run.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dialogs */}
        <EmployeeFormDialog
          open={empFormOpen}
          onClose={() => { setEmpFormOpen(false); setEditEmp(null); }}
          orgId={orgId || ""}
          editEmployee={editEmp}
          onSaved={() => { loadEmployees(); loadStats(); }}
        />

        <PayrollRunDetailDialog
          open={runDetailOpen}
          onClose={() => { setRunDetailOpen(false); setRunDetail(null); }}
          orgId={orgId || ""}
          run={runDetail}
          onRefresh={() => { loadRuns(); loadStats(); }}
        />

        <NewPayrollDialog
          open={newRunOpen}
          onClose={() => setNewRunOpen(false)}
          orgId={orgId || ""}
          onCreated={() => { loadRuns(); loadStats(); }}
        />

        {/* Delete run confirmation */}
        <Dialog open={!!deleteRunId} onOpenChange={() => !deleting && setDeleteRunId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Eliminar Planilla
              </DialogTitle>
              <DialogDescription>
                Se eliminarán todos los detalles de esta planilla. Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteRunId(null)} disabled={deleting}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDeleteRun} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedPage>
  );
}
