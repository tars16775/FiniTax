import { z } from "zod";

// ============================================
// Organization Schemas
// ============================================

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(255, "El nombre no puede exceder 255 caracteres"),
  nit_number: z
    .string()
    .regex(/^\d{14}$/, "El NIT debe tener exactamente 14 dígitos")
    .transform((val) => val.replace(/\D/g, "")),
  nrc_number: z
    .string()
    .regex(/^\d{1,10}$/, "El NRC debe tener entre 1 y 10 dígitos")
    .optional()
    .or(z.literal("")),
  industry_code: z
    .string()
    .optional()
    .or(z.literal("")),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = createOrganizationSchema.partial().extend({
  id: z.string().uuid(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

// ============================================
// User Profile Schemas
// ============================================

export const updateProfileSchema = z.object({
  first_name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  last_name: z
    .string()
    .min(1, "El apellido es requerido")
    .max(100, "El apellido no puede exceder 100 caracteres"),
  dui_number: z
    .string()
    .regex(/^\d{9}$/, "El DUI debe tener exactamente 9 dígitos")
    .optional()
    .or(z.literal("")),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ============================================
// Member Invite Schemas
// ============================================

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .email("Correo electrónico inválido"),
  role: z.enum(["ADMIN", "EMPLOYEE", "ACCOUNTANT"], {
    message: "Selecciona un rol",
  }),
  organization_id: z.string().uuid(),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// ============================================
// El Salvador Industry Codes (CIIU)
// ============================================

export const SV_INDUSTRY_CODES = [
  { value: "0111", label: "Cultivo de cereales y otros cultivos" },
  { value: "0112", label: "Cultivo de hortalizas y legumbres" },
  { value: "0113", label: "Cultivo de frutas, nueces y especias" },
  { value: "0121", label: "Cría de ganado vacuno" },
  { value: "0150", label: "Actividades mixtas (agrícola y pecuaria)" },
  { value: "1010", label: "Elaboración y conservación de carne" },
  { value: "1040", label: "Elaboración de aceites y grasas" },
  { value: "1050", label: "Elaboración de productos lácteos" },
  { value: "1071", label: "Elaboración de productos de panadería" },
  { value: "1079", label: "Elaboración de otros productos alimenticios" },
  { value: "1410", label: "Fabricación de prendas de vestir" },
  { value: "1512", label: "Fabricación de maletas, bolsos y artículos de cuero" },
  { value: "1520", label: "Fabricación de calzado" },
  { value: "2022", label: "Fabricación de pinturas y productos similares" },
  { value: "2100", label: "Fabricación de productos farmacéuticos" },
  { value: "2511", label: "Fabricación de productos metálicos de uso estructural" },
  { value: "4100", label: "Construcción de edificios" },
  { value: "4210", label: "Construcción de carreteras y vías" },
  { value: "4330", label: "Terminación y acabado de edificios" },
  { value: "4510", label: "Venta de vehículos automotores" },
  { value: "4520", label: "Mantenimiento y reparación de vehículos" },
  { value: "4610", label: "Comercio al por mayor a cambio de retribución" },
  { value: "4620", label: "Comercio al por mayor de materias primas" },
  { value: "4630", label: "Comercio al por mayor de alimentos y bebidas" },
  { value: "4641", label: "Comercio al por mayor de textiles y prendas" },
  { value: "4649", label: "Comercio al por mayor de otros enseres" },
  { value: "4711", label: "Supermercados y tiendas de abarrotes" },
  { value: "4719", label: "Otros tipos de venta al por menor" },
  { value: "4721", label: "Venta al por menor de alimentos en tiendas" },
  { value: "4771", label: "Venta al por menor de prendas de vestir" },
  { value: "4773", label: "Venta al por menor de productos farmacéuticos" },
  { value: "4791", label: "Venta al por menor por internet" },
  { value: "5110", label: "Transporte aéreo de pasajeros" },
  { value: "4911", label: "Transporte interurbano de pasajeros" },
  { value: "4921", label: "Transporte urbano de pasajeros" },
  { value: "4923", label: "Transporte de carga por carretera" },
  { value: "5210", label: "Almacenamiento y depósito" },
  { value: "5510", label: "Actividades de alojamiento" },
  { value: "5610", label: "Restaurantes y servicios de comida" },
  { value: "5630", label: "Servicio de bebidas (cafeterías, bares)" },
  { value: "5811", label: "Edición de libros" },
  { value: "5820", label: "Edición de programas informáticos" },
  { value: "6110", label: "Actividades de telecomunicaciones" },
  { value: "6201", label: "Desarrollo de programas informáticos" },
  { value: "6202", label: "Consultoría informática" },
  { value: "6209", label: "Otras actividades de tecnología" },
  { value: "6311", label: "Procesamiento de datos y hosting" },
  { value: "6399", label: "Otros servicios de información" },
  { value: "6411", label: "Banca central y comercial" },
  { value: "6419", label: "Otros servicios financieros" },
  { value: "6492", label: "Otras actividades crediticias" },
  { value: "6511", label: "Seguros de vida" },
  { value: "6512", label: "Seguros generales" },
  { value: "6810", label: "Actividades inmobiliarias" },
  { value: "6910", label: "Actividades jurídicas" },
  { value: "6920", label: "Contabilidad, teneduría de libros y auditoría" },
  { value: "7010", label: "Actividades de oficinas principales" },
  { value: "7020", label: "Consultoría de gestión empresarial" },
  { value: "7110", label: "Actividades de arquitectura e ingeniería" },
  { value: "7120", label: "Ensayos y análisis técnicos" },
  { value: "7310", label: "Publicidad" },
  { value: "7320", label: "Estudios de mercado y encuestas" },
  { value: "7490", label: "Otras actividades profesionales" },
  { value: "7810", label: "Actividades de agencias de empleo" },
  { value: "8010", label: "Actividades de seguridad privada" },
  { value: "8110", label: "Servicios combinados de apoyo" },
  { value: "8211", label: "Servicios administrativos combinados" },
  { value: "8220", label: "Actividades de centros de llamadas" },
  { value: "8510", label: "Enseñanza preescolar y primaria" },
  { value: "8521", label: "Enseñanza secundaria" },
  { value: "8530", label: "Enseñanza superior" },
  { value: "8610", label: "Actividades de hospitales" },
  { value: "8620", label: "Actividades de médicos y odontólogos" },
  { value: "8690", label: "Otras actividades de atención de salud" },
  { value: "9000", label: "Actividades creativas, artísticas y de entretenimiento" },
  { value: "9311", label: "Gestión de instalaciones deportivas" },
  { value: "9329", label: "Otras actividades de esparcimiento" },
  { value: "9411", label: "Actividades de asociaciones empresariales" },
  { value: "9491", label: "Actividades de organizaciones religiosas" },
  { value: "9601", label: "Lavado y limpieza" },
  { value: "9602", label: "Peluquería y otros tratamientos de belleza" },
  { value: "9609", label: "Otras actividades de servicios personales" },
] as const;

// ============================================
// Role Labels (Spanish)
// ============================================

export const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Administrador" },
  { value: "EMPLOYEE", label: "Empleado" },
  { value: "ACCOUNTANT", label: "Contador Externo" },
] as const;
