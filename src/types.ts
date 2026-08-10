export interface Client {
  id: string;
  name: string;
  document: string; // CPF or CNPJ
  phone: string;
  email: string;
  address: string;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
  isAddressValidated?: boolean;
  notes: string;
  createdAt: string;
  userType?: "requisitante" | "gestor" | "gestor_servicos" | "admin";
  password?: string;
  status?: "ativo" | "pendente_autorizacao";
  failedAttempts?: number;
  blocked?: boolean;
  warehouseId?: string; // Almoxarifado responsável (para gestor/adm)
  workLocation?: string; // Local de trabalho (para requisitante/outro)
  isTechnician?: boolean;
  specialty?: string;
  specialties?: string[];
  technicalRole?: string;
  isTrialRequested?: boolean;
  trialDays?: number;
  trialRequestedAt?: string;
  lgpdAccepted?: boolean;
  biddingTermsAccepted?: boolean;
  googleUid?: string;
  enablePurchaseOpportunity?: boolean;
  proposalEmail?: string;
  proposalStatus?: "nenhuma" | "solicitada" | "proposta_enviada" | "contratado";
  proposalRequestedAt?: string;
  selectedPlan?: string;
  proposalValue?: number;
  accessProfileId?: string;
  customPermissions?: Record<string, boolean>;
}

export interface Almoxarifado {
  id: string;
  name: string;
  code: string;
  address: string;
}

export type OSStatus = 'aberto' | 'em_progresso' | 'aguardando' | 'concluido' | 'cancelado';

export interface OSHistoryLog {
  id: string;
  status: OSStatus;
  comment: string;
  date: string;
  author: 'atendente' | 'profissional' | 'sistema';
}

export interface ServiceOrder {
  id: string;
  clientId: string; // References Client
  title: string;
  description: string;
  category: string; // e.g. "TI", "Mecânica"
  status: OSStatus;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo: string; // Professional name or empty if not yet assigned
  startDate: string;
  endDate: string; // Expected completion date
  notes: string;
  history: OSHistoryLog[];
  createdAt: string;
  location?: string; // Specific location/address of the technical service in Aracatuba
  lat?: number; // Technical GPS latitude registered during service
  lng?: number; // Technical GPS longitude registered during service
  images?: string[]; // Base64 or online URLs of physical issues
  completedImages?: string[]; // Base64 or online URLs of the completed service/repair
  unreadByClient?: boolean; // Client/Gestor needs to read latest professional's response
  unreadByProfessional?: boolean; // Professional needs to read latest client's/gestor's response
  hasMissingMaterial?: boolean;
  missingMaterialDescription?: string; // Material the client must buy
}

export interface ServiceCategory {
  id: string;
  name: string;
  color: string;
  slaHours?: number; // Prazo padrão do SLA em horas (ex: 24, 48, 72)
  reminderIntervalHours?: number; // Frequência de lembretes em horas (ex: 4, 8, 12)
  reminderEnabled?: boolean; // Lembretes automáticos ativados (padrão: true)
  notifyGestor?: boolean; // Enviar notificação ao gestor
  notifyTechnician?: boolean; // Enviar notificação ao técnico atribuído
}

export interface SlaReminderLog {
  id: string;
  osId: string;
  osTitle: string;
  categoryName: string;
  reminderType: 'warning' | 'expired' | 'manual';
  recipientName?: string;
  recipientRole?: string;
  sentAt: string;
  slaHours: number;
  timeOverdueMinutes?: number;
  message: string;
}

export interface Professional {
  id: string;
  name: string;
  document?: string; // CPF for secure technician login
  email?: string; // Optional email for password resets
  role: string;
  specialty: string; // matches ServiceCategory.name
  specialties?: string[]; // Multiple technical categories if userType is "profissional"
  userType?: "profissional" | "requisitante" | "gestor";
  password?: string;
  failedAttempts?: number;
  blocked?: boolean;
  workLocation?: string; // Local de trabalho
  googleUid?: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  category: "requisicao" | "requisitante" | "tecnico" | "sistema";
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'os_created' | 'os_status' | 'os_assigned' | 'system_alert' | 'info';
  read: boolean;
  serviceOrderId?: string;
  targetUserType?: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  document: string;
  userType: "admin" | "gestor" | "gestor_servicos" | "requisitante" | "profissional" | string;
  warehouseId?: string;
  workLocation?: string;
  email?: string;
  photoURL?: string;
  googleUid?: string;
  isGoogleWorkspace?: boolean;
  isTrialRequested?: boolean;
  trialDays?: number;
  trialRequestedAt?: string;
  status?: "ativo" | "pendente_autorizacao";
  enablePurchaseOpportunity?: boolean;
  proposalEmail?: string;
  proposalStatus?: "nenhuma" | "solicitada" | "proposta_enviada" | "contratado";
  proposalRequestedAt?: string;
  selectedPlan?: string;
  proposalValue?: number;
  customPermissions?: Record<string, boolean>;
}

export interface PermissionRoutine {
  key: string;
  label: string;
  description: string;
  category: "dashboard" | "orders" | "bi" | "scheduler" | "professionals" | "clients" | "system";
}

export interface AccessProfile {
  id: string;
  name: string;
  description: string;
  color?: string;
  isSystemDefault?: boolean;
  permissions: Record<string, boolean>;
  createdAt?: string;
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "critical" | "warning" | "info" | "system";
  title?: string;
  duration?: number;
}

export interface SmtpSettings {
  host: string;
  port: string;
  user: string;
  pass: string;
  senderAddress: string;
  secure: boolean;
  enabled?: boolean;
}

export interface WhatsappSettings {
  provider: "twilio" | "cloud_api" | "custom";
  apiToken: string;
  apiUrl: string;
  fromNumber: string;
  enabled: boolean;
}

export interface Team {
  id: string;
  name: string;
  memberIds: string[]; // references Professional.id
  leaderId: string; // references Professional.id
  createdAt: string;
}

export interface LoginAttempt {
  id: string;
  timestamp: string;
  username: string; // Document inputted
  userId: string; // ID of profile if found, or "Desconhecido" / ID entered
  status: "success" | "failed";
  userType: string; // "gestor" | "requisitante" | "profissional" | "desconhecido"
  details: string; // Reason or description of status
}

export interface BlockedDate {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  type: "holiday" | "day_off";
  professionalId?: string; // "all" or professional's specific ID
}

export interface TravelReminder {
  id: string;
  orderId: string;
  technicianId?: string;
  technicianName?: string;
  travelTimeMinutes: number;
  leadTimeMinutes: number;
  transportMode: 'car' | 'motorcycle' | 'transit' | 'walking';
  notes?: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  calculatedDepartureTime: string; // YYYY-MM-DD HH:mm
  notifyBrowser: boolean;
  notifyInApp: boolean;
  status: 'active' | 'notified' | 'cancelled';
  createdAt: string;
}



