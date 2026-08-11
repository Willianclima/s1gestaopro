import { pgTable, text, timestamp, serial, jsonb, boolean, integer, doublePrecision } from "drizzle-orm/pg-core";

// Table: users (Gestores, Requisitantes, Admins vinculados ao Firebase Auth)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(), // Firebase Auth UID
  email: text("email").notNull(),
  name: text("name"),
  document: text("document"),
  userType: text("user_type"), // "admin" | "gestor" | "gestor_servicos" | "requisitante" | "profissional"
  status: text("status").default("ativo"), // "ativo" | "pendente_autorizacao"
  warehouseId: text("warehouse_id"),
  workLocation: text("work_location"),
  googleUid: text("google_uid"),
  data: jsonb("data"), // Trial info, customPermissions, LGPD, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Table: usuarios (Antigo clients - Clientes/Usuários cadastrados no sistema)
export const usuarios = pgTable("usuarios", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  document: text("document"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  formattedAddress: text("formatted_address"),
  isAddressValidated: boolean("is_address_validated").default(false),
  notes: text("notes"),
  userType: text("user_type"),
  status: text("status").default("ativo"),
  data: jsonb("data"), // Proposals, bidding terms, trial info, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Alias para compatibilidade
export const clients = usuarios;

// Table: professionals (Corpo Técnico e Profissionais)
export const professionals = pgTable("professionals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  document: text("document"), // CPF
  email: text("email"),
  role: text("role"),
  specialty: text("specialty"),
  specialties: jsonb("specialties"), // Array de especialidades em string
  userType: text("user_type").default("profissional"),
  failedAttempts: integer("failed_attempts").default(0),
  blocked: boolean("blocked").default(false),
  workLocation: text("work_location"),
  googleUid: text("google_uid"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Table: service_orders (Ordens de Serviço)
export const serviceOrders = pgTable("service_orders", {
  id: text("id").primaryKey(),
  clientId: text("client_id"),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  status: text("status").notNull().default("aberto"), // 'aberto' | 'em_progresso' | 'aguardando' | 'concluido' | 'cancelado'
  priority: text("priority").default("medium"), // 'low' | 'medium' | 'high' | 'urgent'
  assignedTo: text("assigned_to"), // Nome do profissional ou ID
  startDate: text("start_date"),
  endDate: text("end_date"),
  notes: text("notes"),
  location: text("location"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  history: jsonb("history"), // Array de OSHistoryLog
  images: jsonb("images"), // Array de URLs/Base64 de imagens de problema
  completedImages: jsonb("completed_images"), // Array de URLs de serviço concluído
  unreadByClient: boolean("unread_by_client").default(false),
  unreadByProfessional: boolean("unread_by_professional").default(false),
  hasMissingMaterial: boolean("has_missing_material").default(false),
  missingMaterialDescription: text("missing_material_description"),
  data: jsonb("data"), // Informações dinâmicas adicionais
  createdAt: timestamp("created_at").defaultNow(),
});

// Table: service_categories (Categorias e SLAs)
export const serviceCategories = pgTable("service_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3b82f6"),
  slaHours: integer("sla_hours").default(24),
  reminderIntervalHours: integer("reminder_interval_hours").default(4),
  reminderEnabled: boolean("reminder_enabled").default(true),
  notifyGestor: boolean("notify_gestor").default(true),
  notifyTechnician: boolean("notify_technician").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Table: system_logs (Auditoria de Ações do Sistema)
export const systemLogs = pgTable("system_logs", {
  id: text("id").primaryKey(),
  timestamp: text("timestamp").notNull(),
  action: text("action").notNull(),
  details: text("details"),
  category: text("category").notNull(), // "requisicao" | "requisitante" | "tecnico" | "sistema"
  createdAt: timestamp("created_at").defaultNow(),
});

// Table: login_attempts (Auditoria de Acesso e Tentativas de Login)
export const loginAttempts = pgTable("login_attempts", {
  id: text("id").primaryKey(),
  timestamp: text("timestamp").notNull(),
  username: text("username").notNull(),
  userId: text("user_id"),
  status: text("status").notNull(), // "success" | "failed"
  userType: text("user_type"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Table: access_profiles (Matriz de Perfis e Permissões)
export const accessProfiles = pgTable("access_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"),
  isSystemDefault: boolean("is_system_default").default(false),
  permissions: jsonb("permissions").notNull(), // Record<string, boolean>
  createdAt: timestamp("created_at").defaultNow(),
});

