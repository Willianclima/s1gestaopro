import { pgTable, text, timestamp, serial, jsonb, boolean, integer, doublePrecision, index } from "drizzle-orm/pg-core";
import { relations, type InferSelectModel, type InferInsertModel } from "drizzle-orm";

/**
 * ============================================================================
 * SCHEMA DO BANCO DE DADOS POSTGRESQL (DRIZZLE ORM)
 * ============================================================================
 * Este arquivo define a estrutura das tabelas, tipos de dados, restrições (constraints)
 * e índices do nosso banco de dados relacional PostgreSQL utilizando Drizzle ORM.
 *
 * Conceitos das tecnologias utilizadas:
 * 1. pgTable: Função do Drizzle para declarar tabelas e mapear para colunas no PostgreSQL.
 * 2. Tipos de Coluna:
 *    - text(): Mapeia para VARCHAR/TEXT no SQL.
 *    - serial(): Chave primária auto-incrementada.
 *    - timestamp(): Armazena datas/horas com suporte a defaultNow() (data/hora atual).
 *    - jsonb(): Armazena estruturas JSON binárias nativas no Postgres (ideal para metadados flexíveis).
 *    - boolean(), integer(), doublePrecision(): Tipos numéricos e lógicos padrão.
 * 3. Índices (index): Aceleram consultas frequentes em colunas de filtro como clientId e assignedTo.
 */

// ============================================================================
// Tabela: users (Usuários autenticados via Firebase Auth / Google Auth)
// ============================================================================
export const users = pgTable("users", {
  id: serial("id").primaryKey(),                  // ID numérico auto-incrementado
  uid: text("uid").notNull().unique(),            // UID único vindo do Firebase Auth
  email: text("email").notNull(),                 // E-mail do usuário
  name: text("name"),                             // Nome completo
  document: text("document"),                     // CPF/CNPJ
  userType: text("user_type"),                    // Papel: "admin" | "gestor" | "requisitante" | "profissional"
  status: text("status").default("ativo"),        // Status de liberação do cadastro
  warehouseId: text("warehouse_id"),              // Vínculo com almoxarifado (se aplicável)
  workLocation: text("work_location"),            // Local de trabalho / Unidade
  googleUid: text("google_uid"),                  // ID da conta Google (OAuth)
  data: jsonb("data"),                            // Metadados dinâmicos (permissões customizadas, LGPD, etc.)
  createdAt: timestamp("created_at").defaultNow(),// Data de criação com valor default
});

// ============================================================================
// Tabela: usuarios (Clientes e Requisitantes de Ordens de Serviço)
// ============================================================================
export const usuarios = pgTable("usuarios", {
  id: text("id").primaryKey(),                     // UUID / String ID
  name: text("name").notNull(),                    // Nome/Razão social
  document: text("document"),                     // Documento
  phone: text("phone"),                           // Telefone de contato
  email: text("email"),                           // E-mail principal
  address: text("address"),                       // Endereço cadastrado
  lat: doublePrecision("lat"),                    // Latitude (coordenada geográfica)
  lng: doublePrecision("lng"),                    // Longitude (coordenada geográfica)
  formattedAddress: text("formatted_address"),    // Endereço formatado pela API de Geocoding
  isAddressValidated: boolean("is_address_validated").default(false), // Validação via Google Maps API
  notes: text("notes"),                           // Observações gerais
  userType: text("user_type"),                    // Categoria do cliente
  status: text("status").default("ativo"),        // Status do cadastro
  data: jsonb("data"),                            // Propostas, termos de licitação, metadados
  createdAt: timestamp("created_at").defaultNow(),// Data de registro no sistema
});

// Alias exportado para manter compatibilidade com códigos legados que utilizavam "clients"
export const clients = usuarios;

// ============================================================================
// Tabela: professionals (Corpo Técnico, Prestadores e Profissionais)
// ============================================================================
export const professionals = pgTable("professionals", {
  id: text("id").primaryKey(),                     // UUID / String ID
  name: text("name").notNull(),                    // Nome do profissional
  document: text("document"),                     // CPF
  email: text("email"),                           // E-mail corporativo
  role: text("role"),                             // Cargo/Função
  specialty: text("specialty"),                   // Especialidade principal
  specialties: jsonb("specialties"),              // Lista de especialidades (Array JSON)
  userType: text("user_type").default("profissional"),
  failedAttempts: integer("failed_attempts").default(0), // Controle de tentativas de login incorretas
  blocked: boolean("blocked").default(false),     // Bloqueio de segurança
  workLocation: text("work_location"),            // Base operacional
  googleUid: text("google_uid"),                  // Vínculo Google OAuth
  data: jsonb("data"),                            // Informações adicionais
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// Tabela: service_orders (Ordens de Serviço)
// ============================================================================
export const serviceOrders = pgTable("service_orders", {
  id: text("id").primaryKey(),                     // ID único da OS (ex: req-1001)
  clientId: text("client_id").references(() => usuarios.id, { onDelete: "set null", onUpdate: "cascade" }), // Foreign Key -> usuarios.id
  title: text("title").notNull(),                 // Título resumido do chamado
  description: text("description"),               // Detalhamento do problema ou solicitação
  category: text("category"),                     // Categoria do serviço (Elétrica, Hidráulica, etc.)
  status: text("status").notNull().default("aberto"), // Status: 'aberto' | 'em_progresso' | 'concluido' | 'cancelado'
  priority: text("priority").default("medium"),   // Prioridade: 'low' | 'medium' | 'high' | 'urgent'
  assignedTo: text("assigned_to"),                // ID ou Nome do profissional responsável
  startDate: text("start_date"),                  // Data prevista/efetiva de início
  endDate: text("end_date"),                      // Data prevista/efetiva de encerramento
  notes: text("notes"),                           // Observações internas do atendimento
  location: text("location"),                     // Local específico do atendimento
  lat: doublePrecision("lat"),                    // Latitude do local da OS
  lng: doublePrecision("lng"),                    // Longitude do local da OS
  history: jsonb("history"),                      // Histórico de alterações e tramitações (Array JSON)
  images: jsonb("images"),                        // Fotos/Anexos do problema inicial
  completedImages: jsonb("completed_images"),    // Fotos de comprovação do serviço concluído
  unreadByClient: boolean("unread_by_client").default(false),             // Indicador de atualização pendente pro cliente
  unreadByProfessional: boolean("unread_by_professional").default(false), // Indicador de atualização pendente pro técnico
  hasMissingMaterial: boolean("has_missing_material").default(false),     // Sinalização de falta de material
  missingMaterialDescription: text("missing_material_description"),      // Detalhes dos materiais ausentes
  data: jsonb("data"),                            // Informações dinâmicas adicionais
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Índices B-Tree para alta performance em buscas e relatórios
  index("service_orders_client_id_idx").on(table.clientId),    // Otimiza busca de OS por cliente
  index("service_orders_assigned_to_idx").on(table.assignedTo),// Otimiza busca de OS por técnico
]);

// ============================================================================
// Tabela: service_categories (Categorias de Serviço, SLAs e Notificações)
// ============================================================================
export const serviceCategories = pgTable("service_categories", {
  id: text("id").primaryKey(),                     // ID da categoria
  name: text("name").notNull(),                    // Nome exibido (ex: Manutenção Predial)
  color: text("color").notNull().default("#3b82f6"),// Cor de identificação no Kanban / Dashboard
  slaHours: integer("sla_hours").default(24),      // Tempo limite em horas para atendimento (SLA)
  reminderIntervalHours: integer("reminder_interval_hours").default(4), // Frequência de alertas
  reminderEnabled: boolean("reminder_enabled").default(true),  // Ativação de lembretes automáticos
  notifyGestor: boolean("notify_gestor").default(true),        // Notificação enviada aos gestores
  notifyTechnician: boolean("notify_technician").default(true),// Notificação enviada ao técnico
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// Tabela: system_logs (Auditoria e Logs de Ações do Sistema)
// ============================================================================
export const systemLogs = pgTable("system_logs", {
  id: text("id").primaryKey(),                     // ID do log
  timestamp: text("timestamp").notNull(),         // Data/hora da ocorrência em formato ISO
  action: text("action").notNull(),               // Título da ação registrada (ex: "Criação de OS")
  details: text("details"),                       // Detalhamento do evento
  category: text("category").notNull(),           // Categoria: "requisicao" | "tecnico" | "sistema"
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// Tabela: login_attempts (Auditoria de Tentativas de Autenticação)
// ============================================================================
export const loginAttempts = pgTable("login_attempts", {
  id: text("id").primaryKey(),                     // ID da tentativa
  timestamp: text("timestamp").notNull(),         // Data/hora da tentativa
  username: text("username").notNull(),           // Usuário/E-mail informado
  userId: text("user_id"),                        // ID do usuário (se identificado)
  status: text("status").notNull(),               // Status: "success" | "failed"
  userType: text("user_type"),                    // Tipo de usuário
  details: text("details"),                       // Motivo de falha ou IP/Browser
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// Tabela: access_profiles (Matriz de Perfis e Permissões de Acesso)
// ============================================================================
export const accessProfiles = pgTable("access_profiles", {
  id: text("id").primaryKey(),                     // ID do perfil (ex: prof-admin)
  name: text("name").notNull(),                    // Nome (ex: Administrador do Sistema)
  description: text("description"),               // Descrição das atribuições
  color: text("color"),                           // Cor da tag
  isSystemDefault: boolean("is_system_default").default(false), // Proteção contra exclusão
  permissions: jsonb("permissions").notNull(),    // Mapa de permissões ex: {"canManageOS": true}
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// Drizzle ORM Relations (Integridade Referencial e Mapeamento Objetual)
// ============================================================================

export const usuariosRelations = relations(usuarios, ({ many }) => ({
  serviceOrders: many(serviceOrders),
}));

export const professionalsRelations = relations(professionals, ({ many }) => ({
  serviceOrders: many(serviceOrders),
}));

export const serviceOrdersRelations = relations(serviceOrders, ({ one }) => ({
  client: one(usuarios, {
    fields: [serviceOrders.clientId],
    references: [usuarios.id],
  }),
  professional: one(professionals, {
    fields: [serviceOrders.assignedTo],
    references: [professionals.id],
  }),
}));

// ============================================================================
// Drizzle ORM Inferred TypeScript Types
// ============================================================================

export type UserDb = InferSelectModel<typeof users>;
export type NewUserDb = InferInsertModel<typeof users>;

export type UsuarioDb = InferSelectModel<typeof usuarios>;
export type NewUsuarioDb = InferInsertModel<typeof usuarios>;

export type ProfessionalDb = InferSelectModel<typeof professionals>;
export type NewProfessionalDb = InferInsertModel<typeof professionals>;

export type ServiceOrderDb = InferSelectModel<typeof serviceOrders>;
export type NewServiceOrderDb = InferInsertModel<typeof serviceOrders>;

export type ServiceCategoryDb = InferSelectModel<typeof serviceCategories>;
export type NewServiceCategoryDb = InferInsertModel<typeof serviceCategories>;

export type SystemLogDb = InferSelectModel<typeof systemLogs>;
export type NewSystemLogDb = InferInsertModel<typeof systemLogs>;

export type LoginAttemptDb = InferSelectModel<typeof loginAttempts>;
export type NewLoginAttemptDb = InferInsertModel<typeof loginAttempts>;

export type AccessProfileDb = InferSelectModel<typeof accessProfiles>;
export type NewAccessProfileDb = InferInsertModel<typeof accessProfiles>;


