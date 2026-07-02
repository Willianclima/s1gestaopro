export interface Client {
  id: string;
  name: string;
  document: string; // CPF or CNPJ
  phone: string;
  email: string;
  address: string;
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
}

export interface SystemLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  category: "requisicao" | "requisitante" | "tecnico" | "sistema";
}

export interface CurrentUser {
  id: string;
  name: string;
  document: string;
  userType: "admin" | "gestor" | "gestor_servicos" | "requisitante" | "profissional";
  warehouseId?: string;
  workLocation?: string;
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



