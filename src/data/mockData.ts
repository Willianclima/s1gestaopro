import { Client, ServiceOrder, ServiceCategory, Professional, Almoxarifado, SystemLog } from "../types";

export const INITIAL_ALMOXARIFADOS: Almoxarifado[] = [
  { id: "alm-1", name: "Almoxarifado Central Araçatuba", code: "ALM-CENTRAL", address: "Rua Marcílio Dias, 1500 - Araçatuba - SP" },
  { id: "alm-2", name: "Almoxarifado Zona Norte", code: "ALM-ZONANORTE", address: "Av. Prestes Maia, 250 - Araçatuba - SP" },
  { id: "alm-3", name: "Almoxarifado Oficina Sul", code: "ALM-OFICINASUL", address: "Rua Saudade, 890 - Araçatuba - SP" }
];

export const INITIAL_CATEGORIES: ServiceCategory[] = [
  { id: "cat-1", name: "Suporte de TI & Redes", color: "blue", slaHours: 24, reminderIntervalHours: 4, reminderEnabled: true, notifyGestor: true, notifyTechnician: true },
  { id: "cat-2", name: "Eletrodomésticos & Climatização", color: "orange", slaHours: 48, reminderIntervalHours: 6, reminderEnabled: true, notifyGestor: true, notifyTechnician: true },
  { id: "cat-3", name: "Mecânica & Automotivo", color: "red", slaHours: 36, reminderIntervalHours: 6, reminderEnabled: true, notifyGestor: true, notifyTechnician: true },
  { id: "cat-4", name: "Design & Móveis Planejados", color: "purple", slaHours: 72, reminderIntervalHours: 12, reminderEnabled: true, notifyGestor: true, notifyTechnician: true },
  { id: "cat-5", name: "Serviços Gerais & Elétrica", color: "green", slaHours: 24, reminderIntervalHours: 4, reminderEnabled: true, notifyGestor: true, notifyTechnician: true },
  { id: "cat-6", name: "Serviços Gerais & hidraulica", color: "cyan", slaHours: 24, reminderIntervalHours: 4, reminderEnabled: true, notifyGestor: true, notifyTechnician: true },
  { id: "cat-7", name: "Serviços Gerais & Fundações", color: "amber", slaHours: 96, reminderIntervalHours: 12, reminderEnabled: true, notifyGestor: true, notifyTechnician: true },
  { id: "cat-8", name: "Serviços Gerais & construções", color: "indigo", slaHours: 120, reminderIntervalHours: 24, reminderEnabled: true, notifyGestor: true, notifyTechnician: true }
];

export const INITIAL_PROFESSIONALS: Professional[] = [
  { id: "prof-1", name: "Carlos Henrique", document: "111.111.111-11", email: "carlos.henrique@gestao.com", role: "Técnico Líder", specialty: "Mecânica & Automotivo", specialties: ["Mecânica & Automotivo"], userType: "profissional" },
  { id: "prof-2", name: "Mariana Costa", document: "222.222.222-22", email: "mariana.costa@gestao.com", role: "Especialista em Cloud/Redes", specialty: "Suporte de TI & Redes", specialties: ["Suporte de TI & Redes"], userType: "profissional" },
  { id: "prof-3", name: "Roberto Silva", document: "333.333.333-33", email: "roberto.silva@gestao.com", role: "Eletricista de Climatização", specialty: "Eletrodomésticos & Climatização", specialties: ["Eletrodomésticos & Climatização"], userType: "profissional" },
  { id: "prof-4", name: "Aline Souza", document: "444.444.444-44", email: "aline.souza@gestao.com", role: "Projetista de Ambientes", specialty: "Design & Móveis Planejados", specialties: ["Design & Móveis Planejados"], userType: "profissional" },
  { id: "prof-5", name: "Sérgio Pereira", document: "555.555.555-55", email: "sergio.pereira@gestao.com", role: "Eletricista Geral", specialty: "Serviços Gerais & Elétrica", specialties: ["Serviços Gerais & Elétrica"], userType: "profissional" }
];

export const INITIAL_USUARIOS: Client[] = [
  {
    id: "cli-1",
    name: "Ana Julia Silveira",
    document: "123.456.789-00",
    phone: "(11) 98765-4321",
    email: "anajulia@gmail.com",
    address: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
    notes: "Cliente preferencial. Sempre avisar antes de vir.",
    createdAt: "2026-05-10T10:00:00Z",
    userType: "requisitante",
    password: "123",
    status: "ativo"
  },
  {
    id: "cli-2",
    name: "Roberto Negócios Digitais LTDA",
    document: "12.345.678/0001-99",
    phone: "(11) 3456-7890",
    email: "suporte@robertodigital.com.br",
    address: "Rua Tabapuã, 450 - Itaim Bibi, São Paulo - SP",
    notes: "Acesso ao servidor deve ser supervisionado pela equipe de segurança cibernética.",
    createdAt: "2026-05-15T14:30:00Z",
    userType: "gestor",
    password: "123",
    status: "ativo"
  },
  {
    id: "cli-4",
    name: "Clínica Geral Sorriso Seguro",
    document: "98.765.432/0001-00",
    phone: "(31) 3224-1212",
    email: "adm@clinicasorrisoseguro.com.br",
    address: "Av. Afonso Pena, 2500 - Funcionários, Belo Horizonte - MG",
    notes: "Atendimento preferencialmente fora do horário comercial (após as 18h) para não atrapalhar atendimentos.",
    createdAt: "2026-05-25T11:45:00Z",
    userType: "requisitante",
    password: "123",
    status: "ativo"
  }
];

export const INITIAL_ORDERS: ServiceOrder[] = [
  {
    id: "req-1001",
    clientId: "cli-1",
    title: "Conserto de Geladeira Brastemp Duplex",
    description: "Geladeira não está alcançando a refrigeração mínima ideal na parte inferior. O motor faz barulhos intermitentes e o painel eletrônico fica piscando.",
    category: "Eletrodomésticos & Climatização",
    status: "concluido",
    priority: "medium",
    assignedTo: "Roberto Silva",
    startDate: "2026-06-10",
    endDate: "2026-06-12",
    notes: "Efetuada limpeza química e troca do termostato. Geladeira testada e funcionando em perfeita estabilidade de temperatura.",
    history: [
      { id: "h-1", status: "aberto", comment: "Requisição cadastrada pela atendente após contato telefônico do cliente.", date: "2026-06-10T10:15:00Z", author: "atendente" },
      { id: "h-2", status: "em_progresso", comment: "Atendimento iniciado. Técnico Roberto Silva alocado de acordo com a especialidade requerida.", date: "2026-06-11T14:00:00Z", author: "atendente" },
      { id: "h-3", status: "concluido", comment: "Finalizado o reparo. Todos os sensores reestabelecidos.", date: "2026-06-12T16:00:00Z", author: "profissional" }
    ],
    createdAt: "2026-06-10T10:15:00Z",
    images: ["https://images.unsplash.com/photo-1571175432247-fe03365b2028?auto=format&fit=crop&q=80&w=400"],
    hasMissingMaterial: false
  },
  {
    id: "req-1002",
    clientId: "cli-2",
    title: "Instalação e Montagem de Rack de Redes",
    description: "Configuração de roteador centralizado Mikrotik e montagem de cabeamento estruturado Cat6 para 12 computadores da equipe.",
    category: "Suporte de TI & Redes",
    status: "em_progresso",
    priority: "high",
    assignedTo: "Mariana Costa",
    startDate: "2026-06-13",
    endDate: "2026-06-17",
    notes: "Andamento parcial do cabeamento primário. Equipamento Mikrotik fixado no suporte.",
    history: [
      { id: "h-4", status: "aberto", comment: "Cliente solicita urgência por conta de início de operação do time comercial.", date: "2026-06-13T09:00:00Z", author: "atendente" },
      { id: "h-5", status: "em_progresso", comment: "Visita inicial executada. Mariana Costa iniciou homologação dos cabos.", date: "2026-06-14T11:00:00Z", author: "profissional" }
    ],
    createdAt: "2026-06-13T09:00:00Z",
    location: "Rua Tabapuã, 450 - Itaim Bibi, São Paulo - SP",
    lat: -23.5855,
    lng: -46.6785,
    images: ["https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&q=80&w=400"],
    hasMissingMaterial: false
  },
  {
    id: "req-1003",
    clientId: "cli-4",
    title: "Instrução de Vedação e Ajuste de Ar Condicionado",
    description: "Ar condicionado central odontológico apresentando gotejamento constante pela evaporadora sobre o compressor cirúrgico.",
    category: "Eletrodomésticos & Climatização",
    status: "aguardando",
    priority: "urgent",
    assignedTo: "Roberto Silva",
    startDate: "2026-06-14",
    endDate: "2026-06-18",
    notes: "",
    history: [
      { id: "h-6", status: "aberto", comment: "Gotejamento pode queimar equipamento esterilizador.", date: "2026-06-14T08:30:00Z", author: "atendente" },
      { id: "h-7", status: "em_progresso", comment: "Atendimento iniciado. Verificado que a mangueira de dreno está ressecada.", date: "2026-06-14T12:00:00Z", author: "profissional" },
      { id: "h-8", status: "aguardando", comment: "Falta de mangueira cristal de 3/4 polegadas e fita isolante térmica de poliuretano. O cliente deve comprar esse material de vedação para que possamos finalizar.", date: "2026-06-14T15:30:00Z", author: "profissional" }
    ],
    createdAt: "2026-06-14T08:30:00Z",
    images: ["https://images.unsplash.com/photo-1621905252507-b354bc25edac?auto=format&fit=crop&q=80&w=400"],
    hasMissingMaterial: true,
    missingMaterialDescription: "Mangueira cristal de 3/4 polegadas (3 metros) e Fita Isolante Térmica de Poliuretano"
  }
];

export const INITIAL_CLIENTS = INITIAL_USUARIOS;

export const INITIAL_SYSTEM_LOGS: SystemLog[] = [
  {
    id: "log-1001",
    timestamp: "2026-06-10T10:15:00Z",
    action: "Criação de OS",
    details: "Ordem de serviço #req-1001 criada com sucesso.",
    category: "requisicao"
  },
  {
    id: "log-1002",
    timestamp: "2026-06-11T14:00:00Z",
    action: "Atribuição de Técnico",
    details: "Técnico Roberto Silva vinculado à OS #req-1001.",
    category: "tecnico"
  },
  {
    id: "log-1003",
    timestamp: "2026-06-12T16:00:00Z",
    action: "Conclusão de OS",
    details: "Ordem de serviço #req-1001 concluída pelo profissional.",
    category: "requisicao"
  },
  {
    id: "log-1004",
    timestamp: "2026-06-13T09:00:00Z",
    action: "Criação de OS Urgente",
    details: "Ordem de serviço #req-1002 registrada com prioridade alta.",
    category: "requisicao"
  },
  {
    id: "log-1005",
    timestamp: "2026-06-14T08:30:00Z",
    action: "Sincronização de Banco",
    details: "Carga inicial de dados e sincronização no PostgreSQL executada.",
    category: "sistema"
  }
];
