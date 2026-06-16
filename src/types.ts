export interface Client {
  id: string;
  name: string;
  document: string; // CPF or CNPJ
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
  userType?: "requisitante" | "gestor";
  password?: string;
  status?: "ativo" | "pendente_autorizacao";
  failedAttempts?: number;
  blocked?: boolean;
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
  role: string;
  specialty: string; // matches ServiceCategory.name
  specialties?: string[]; // Multiple technical categories if userType is "profissional"
  userType?: "profissional" | "requisitante" | "gestor";
  password?: string;
  failedAttempts?: number;
  blocked?: boolean;
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
  userType: "gestor" | "requisitante" | "profissional";
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  title?: string;
  duration?: number;
}

