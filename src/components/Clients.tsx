import React, { useState, useEffect } from "react";
import { Client, ServiceOrder, Almoxarifado, ServiceCategory } from "../types";
import { User, Search, Plus, Phone, Mail, FileText, Trash2, Edit2, MapPin, X, HelpCircle, Check, Briefcase, Database } from "lucide-react";
import { motion } from "motion/react";
import AddressValidationWidget from "./AddressValidationWidget";

interface ClientsProps {
  clients: Client[];
  orders: ServiceOrder[];
  onAddClient: (client: Client) => void;
  onUpdateClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
  almoxarifados?: Almoxarifado[];
  categories?: ServiceCategory[];
}

const formatDoc = (value: string) => {
  const clean = value.replace(/\D/g, "").slice(0, 11);
  let formatted = clean;
  if (clean.length > 9) {
    formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
  } else if (clean.length > 6) {
    formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
  } else if (clean.length > 3) {
    formatted = `${clean.slice(0, 3)}.${clean.slice(3)}`;
  }
  return formatted;
};

const ClientsSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
    {[1, 2, 3, 4].map((n) => (
      <div key={n} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between h-[210px]">
        <div>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-200 rounded-xl" />
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 rounded w-32" />
                <div className="h-3 bg-slate-200 rounded w-24" />
              </div>
            </div>
            <div className="h-5 bg-slate-200 rounded-full w-20" />
          </div>
          <div className="space-y-3 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 bg-slate-200 rounded-full" />
              <div className="h-3 bg-slate-200 rounded w-48" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 bg-slate-200 rounded-full" />
              <div className="h-3 bg-slate-200 rounded w-40" />
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-4">
          <div className="h-3 bg-slate-200 rounded w-28" />
          <div className="flex gap-2">
            <div className="w-8 h-8 bg-slate-200 rounded-lg" />
            <div className="w-8 h-8 bg-slate-200 rounded-lg" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default function Clients({ 
  clients, 
  orders, 
  onAddClient, 
  onUpdateClient, 
  onDeleteClient, 
  almoxarifados = [],
  categories = []
}: ClientsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const pendingCount = clients.filter(c => c.status === "pendente_autorizacao").length;

  // Form fields
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [formattedAddress, setFormattedAddress] = useState<string>("");
  const [isAddressValidated, setIsAddressValidated] = useState<boolean>(false);
  const [notes, setNotes] = useState("");
  const [userType, setUserType] = useState<"requisitante" | "gestor" | "gestor_servicos" | "admin">("requisitante");
  const [password, setPassword] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  
  // Technician synchronization fields
  const [isTechnician, setIsTechnician] = useState(false);
  const [specialty, setSpecialty] = useState("");
  const [technicalRole, setTechnicalRole] = useState("Técnico");

  // Detailed view of client (history of Service Orders)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const filteredClients = clients.filter(c => {
    const ut = c.userType || "requisitante";
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.document.includes(searchTerm) ||
      c.phone.includes(searchTerm) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ut.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === "ativos") {
      matchesStatus = c.status !== "pendente_autorizacao";
    } else if (statusFilter === "pendentes") {
      matchesStatus = c.status === "pendente_autorizacao";
    }

    return matchesSearch && matchesStatus;
  });

  const openForm = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setName(client.name);
      setDocument(client.document);
      setPhone(client.phone);
      setEmail(client.email);
      setAddress(client.address);
      setLat(client.lat);
      setLng(client.lng);
      setFormattedAddress(client.formattedAddress || client.address || "");
      setIsAddressValidated(client.isAddressValidated || false);
      setNotes(client.notes);
      setUserType(client.userType || "requisitante");
      setPassword(client.password || "123");
      setWorkLocation(client.workLocation || "");
      setWarehouseId(client.warehouseId || "");
      setIsTechnician(client.isTechnician || false);
      setSpecialty(client.specialty || "");
      setTechnicalRole(client.technicalRole || "Técnico");
    } else {
      setEditingClient(null);
      setName("");
      setDocument("");
      setPhone("");
      setEmail("");
      setAddress("");
      setLat(undefined);
      setLng(undefined);
      setFormattedAddress("");
      setIsAddressValidated(false);
      setNotes("");
      setUserType("requisitante");
      setPassword("123");
      setWorkLocation("");
      setWarehouseId("");
      setIsTechnician(false);
      setSpecialty("");
      setTechnicalRole("Técnico");
    }
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingClient) {
      onUpdateClient({
        ...editingClient,
        name,
        document,
        phone,
        email,
        address,
        lat,
        lng,
        formattedAddress,
        isAddressValidated,
        notes,
        userType,
        password: password || "123",
        workLocation: workLocation || undefined,
        warehouseId: warehouseId || undefined,
        isTechnician,
        specialty: isTechnician ? (specialty || (categories[0]?.name || "Geral")) : undefined,
        technicalRole: isTechnician ? technicalRole : undefined
      });
    } else {
      const newClient: Client = {
        id: "cli-" + Math.random().toString(36).substr(2, 9),
        name,
        document,
        phone,
        email,
        address,
        lat,
        lng,
        formattedAddress,
        isAddressValidated,
        notes,
        createdAt: new Date().toISOString(),
        userType,
        password: password || "123",
        status: "ativo",
        workLocation: workLocation || undefined,
        warehouseId: warehouseId || undefined,
        isTechnician,
        specialty: isTechnician ? (specialty || (categories[0]?.name || "Geral")) : undefined,
        technicalRole: isTechnician ? technicalRole : undefined
      };
      onAddClient(newClient);
    }

    setIsFormOpen(false);
    setEditingClient(null);
  };

  const getClientOSHistory = (clientId: string) => {
    return orders.filter(o => o.clientId === clientId);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Cadastro & Gestão de Usuários</h1>
          <p className="text-sm text-slate-500 font-medium">Controle de cadastros administrativos, requisitantes, gestores e histórico integrado de solicitações do sistema.</p>
        </div>

        <button
          onClick={() => openForm()}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider py-3 px-5 rounded-xl shadow-lg shadow-slate-950/5 active:translate-y-[1px] transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          Cadastrar Usuário
        </button>
      </div>

      {/* Banner de Usuários Pendentes de Autorização */}
      {pendingCount > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-400/60 rounded-2xl p-4 sm:p-5 text-amber-950 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-left">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shrink-0 font-bold shadow-sm animate-pulse">
              ⏳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-200 text-amber-900 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                  Aprovação Pendente
                </span>
                <span className="text-xs font-bold text-amber-900">
                  {pendingCount} {pendingCount === 1 ? 'cadastro de usuário aguardando autorização' : 'cadastros de usuários aguardando autorização'}
                </span>
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm mt-1">
                Existem novos usuários e requisições de teste de 15 dias aguardando concessão de perfil pelo Administrador.
              </h3>
              <p className="text-slate-700 text-xs mt-0.5 font-medium">
                Verifique as declarações de conformidade (LGPD & Licitações) e aprove o acesso diretamente nos cartões de usuário abaixo.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStatusFilter("pendentes")}
            className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl shadow-md transition-all shrink-0 flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
          >
            Exibir Apenas Pendentes ({pendingCount})
          </button>
        </div>
      )}

      {/* Search and Status Filter Row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="w-full text-sm border border-slate-200/80 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-white transition-all font-medium text-slate-700 shadow-sm"
            placeholder="Buscar por nome, perfil (requisitante, gestor), e-mail ou documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("todos")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === "todos"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Todos os Usuários ({clients.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ativos")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === "ativos"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Ativos ({clients.length - pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pendentes")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "pendentes"
                ? "bg-amber-500 text-white shadow-xs"
                : pendingCount > 0 
                  ? "bg-amber-100 text-amber-900 hover:bg-amber-200" 
                  : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Pendentes ({pendingCount})
            {pendingCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />}
          </button>
        </div>
      </div>

      {/* Clients Grid */}
      {isLoading ? (
        <ClientsSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClients.length > 0 ? (
            filteredClients.map((client, index) => {
              const history = getClientOSHistory(client.id);
              const ut = client.userType || "requisitante";
              return (
                <motion.div 
                  key={client.id} 
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-slate-300 p-5 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 font-bold text-sm">
                          {client.name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-slate-800 text-base group-hover:text-slate-900 leading-tight">{client.name}</h3>
                            {ut === "admin" ? (
                              <span className="inline-flex items-center bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide">
                                ⚙️ Administrador
                              </span>
                            ) : ut === "gestor" ? (
                              <span className="inline-flex items-center bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide">
                                🛡️ Gestor Adm
                              </span>
                            ) : ut === "gestor_servicos" ? (
                              <span className="inline-flex items-center bg-cyan-50 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide">
                                🔧 Gestor Serv
                              </span>
                            ) : (
                              <span className="inline-flex items-center bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide">
                                👤 Requisitante
                              </span>
                            )}

                            {client.status === "pendente_autorizacao" && (
                              <span className="inline-flex items-center bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide animate-pulse">
                                ⏳ Pendente Autorização
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{client.document || "Sem CPF"}</p>
                        </div>
                      </div>

                      <div className="flex gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openForm(client)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
                          title="Editar cadastro"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            const profileName = ut === "admin" ? "administrador" : ut === "gestor" ? "gestor" : ut === "gestor_servicos" ? "gestor de serviços" : "requisitante";
                            if(confirm(`Tem certeza que deseja remover este ${profileName}? Se houver ordens de serviço vinculadas, elas ficarão sem requisitante associado.`)) {
                              onDeleteClient(client.id);
                            }
                          }}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-600 transition-colors"
                          title="Deletar cadastro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Alerta de Período Experimental / Teste de 15 Dias */}
                    {client.status === "pendente_autorizacao" && (
                      <div className="mb-3 p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 text-left">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                            {client.isTrialRequested ? "Solicitação de Teste (15 Dias)" : "Novo Auto-Cadastro"}
                          </span>
                          <span className="text-[9px] text-amber-700 font-semibold">Exige Aprovação do Gestor</span>
                        </div>
                        <p className="text-[11px] text-slate-700 leading-snug font-medium">
                          {client.isTrialRequested
                            ? "Usuário solicitou degustação técnica por 15 dias. Aguardando concessão de permissão de acesso pelo Administrador."
                            : "Aguardando homologação e liberação de acesso pelo Administrador."}
                        </p>
                        
                        {/* Indicadores de Conformidade */}
                        <div className="flex items-center gap-2 pt-1 text-[10px] font-semibold text-slate-600 flex-wrap">
                          <span className={`px-2 py-0.5 rounded border ${client.lgpdAccepted !== false ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                            ✓ LGPD Aceito
                          </span>
                          <span className={`px-2 py-0.5 rounded border ${client.biddingTermsAccepted !== false ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                            ✓ Lei Licitações Aceito
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            const updated: Client = {
                              ...client,
                              status: "ativo",
                              notes: (client.notes || "") + ` | Permissão concedida pelo Administrador em ${new Date().toLocaleDateString('pt-BR')}.`
                            };
                            onUpdateClient(updated);
                          }}
                          className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] uppercase tracking-wider py-2 px-3 rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Aprovar & Conceder Permissão
                        </button>
                      </div>
                    )}

                    {/* Informações Rápidas */}
                    <div className="space-y-2.5 text-xs font-semibold text-slate-600 border-t border-slate-50 pt-3">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>{client.phone || "Sem telefone de contato"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{client.email || "Sem e-mail cadastrado"}</span>
                      </div>
                      {client.address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                          <span className="text-slate-500 font-normal line-clamp-1">{client.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-50">
                    <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all">
                      <Briefcase className="w-3 h-3" />
                      <span>{history.length} {history.length === 1 ? "Serviço" : "Serviços"}</span>
                    </div>

                    <button 
                      onClick={() => setSelectedClient(client)}
                      className="text-xs font-bold text-slate-800 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-1.5 shadow-sm transition-all bg-white"
                    >
                      Ver Histórico
                    </button>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="col-span-1 md:col-span-2 bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <User className="w-12 h-12 text-slate-300 mb-2" />
              <p className="font-bold text-slate-500">Nenhum requisitante cadastrado ou encontrado.</p>
              <p className="text-xs text-slate-400 mt-1">Clique em "Novo Requisitante" para começar a abastecer seu cadastro de GS.</p>
            </div>
          )}
        </div>
      )}

      {/* CLIENT HISTORY DRAWER/MODAL */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center font-bold">
                  {selectedClient.name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-base leading-snug">{selectedClient.name}</h2>
                    {selectedClient.userType === "admin" ? (
                      <span className="inline-flex items-center bg-red-700 text-red-105 bg-red-800 text-red-50 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide">
                        ⚙️ Admin
                      </span>
                    ) : selectedClient.userType === "gestor" ? (
                      <span className="inline-flex items-center bg-purple-700 text-purple-100 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide">
                        🛡️ Gestor Adm
                      </span>
                    ) : selectedClient.userType === "gestor_servicos" ? (
                      <span className="inline-flex items-center bg-cyan-700 text-cyan-100 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide">
                        🔧 Gestor Serv
                      </span>
                    ) : (
                      <span className="inline-flex items-center bg-emerald-700 text-emerald-100 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide">
                        👤 Requisitante
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedClient.document || "Sem documento"}</p>
                </div>
              </div>

              <button 
                onClick={() => setSelectedClient(null)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                id="close-drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Client detail logs */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {/* Profile card panel */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs font-semibold text-slate-600 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">Dados de Contato</h4>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedClient.phone || "Sem telefone"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedClient.email || "Sem e-mail"}</span>
                </div>
                {selectedClient.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                    <span className="font-normal text-slate-500">{selectedClient.address}</span>
                  </div>
                )}
                {selectedClient.notes && (
                  <div className="pt-2 border-t border-slate-200/50 mt-1">
                    <span className="font-bold text-slate-800">Anotações Internas:</span>
                    <p className="font-normal text-slate-500 mt-1 bg-white p-2 border border-slate-100 rounded-lg whitespace-pre-wrap">{selectedClient.notes}</p>
                  </div>
                )}
              </div>

              {/* Service list history */}
              <div className="space-y-3">
                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Histórico de Ordens de Serviço ({getClientOSHistory(selectedClient.id).length})</h3>
                
                <div className="space-y-3">
                  {getClientOSHistory(selectedClient.id).length > 0 ? (
                    getClientOSHistory(selectedClient.id).map((os, index) => (
                      <motion.div 
                        key={os.id} 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.2) }}
                        className="p-4 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 shadow-xs transition-colors flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-mono font-bold text-slate-500">{os.id}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              os.status === "concluido" ? "bg-green-50 text-green-700" :
                              os.status === "em_progresso" ? "bg-blue-50 text-blue-700" :
                              os.status === "aguardando" ? "bg-orange-50 text-orange-700" :
                              os.status === "cancelado" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"
                            }`}>
                              {os.status === "concluido" ? "Concluído" :
                               os.status === "em_progresso" ? "Em Execução" :
                               os.status === "aguardando" ? "Aguardando Peças" :
                               os.status === "aberto" ? "Pendente" : "Cancelado"}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{os.title}</h4>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1">{os.description}</p>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-50 pt-3 mt-3 text-xs font-semibold text-slate-600">
                          <span>Início: {os.startDate}</span>
                          <span className="font-bold text-slate-800 font-sans">Previsão: {os.endDate || "A definir"}</span>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl text-slate-400">
                      <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                      <p className="text-xs font-semibold">Tudo limpo por aqui.</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Nenhum serviço prestado para este requisitante ainda.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button
                onClick={() => setSelectedClient(null)}
                className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW CLIENT / EDIT CLIENT MODAL DIALOG */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <h3 className="font-bold text-base">{editingClient ? "Editar Usuário" : "Cadastrar Usuário"}</h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                id="close-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Nome Completo / Razão Social *</label>
                  <input
                    type="text"
                    required
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-medium text-slate-700"
                    placeholder="Ex: Ana de Albuquerque Silveira"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                {/* Tipo de Usuário / Perfil */}
                <div>
                  <label className="block text-xs font-bold text-slate-705 uppercase tracking-wider mb-1.5">Perfil / Tipo de Usuário *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setUserType("requisitante")}
                      className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                        userType === "requisitante"
                          ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-950/15 font-extrabold"
                          : "bg-white border-slate-200 hover:border-slate-300 text-slate-650"
                      }`}
                    >
                      <span>👤 Requisitante</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserType("gestor")}
                      className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                        userType === "gestor"
                          ? "bg-purple-900 border-purple-900 text-white shadow-md shadow-purple-950/15 font-extrabold"
                          : "bg-white border-slate-200 hover:border-slate-300 text-slate-650"
                      }`}
                    >
                      <span>🛡️ Gestor Adm</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserType("gestor_servicos")}
                      className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                        userType === "gestor_servicos"
                          ? "bg-cyan-900 border-cyan-900 text-white shadow-md shadow-cyan-950/15 font-extrabold"
                          : "bg-white border-slate-200 hover:border-slate-300 text-slate-650"
                      }`}
                    >
                      <span>🔧 Gestor Serv</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserType("admin")}
                      className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                        userType === "admin"
                          ? "bg-red-900 border-red-900 text-white shadow-md shadow-red-950/15 font-extrabold"
                          : "bg-white border-slate-200 hover:border-slate-300 text-slate-650"
                      }`}
                    >
                      <span>⚙️ Admin</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">CPF</label>
                    <input
                      type="text"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-medium text-slate-705 font-mono"
                      placeholder="Ex: 000.000.000-00"
                      value={document}
                      maxLength={14}
                      onChange={(e) => setDocument(formatDoc(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Telefone de Contato *</label>
                    <input
                      type="text"
                      required
                      className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-medium text-slate-700 font-mono"
                      placeholder="Ex: (11) 99999-9999"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">E-mail</label>
                  <input
                    type="email"
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-medium text-slate-700"
                    placeholder="Ex: anasilveira@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-705 uppercase tracking-wider mb-1.5">Senha de Acesso *</label>
                  <input
                    type="text"
                    required
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-medium text-slate-700"
                    placeholder="Ex: 123"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Endereço de Atendimento</label>
                  <input
                    type="text"
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-medium text-slate-700"
                    placeholder="Ex: Rua Marcílio Dias, 1500 - Bairro Bandeirantes, Araçatuba - SP"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setIsAddressValidated(false);
                    }}
                  />

                  <AddressValidationWidget
                    address={address}
                    onAddressValidated={(res) => {
                      setIsAddressValidated(res.isPrecise);
                      if (res.lat && res.lng) {
                        setLat(res.lat);
                        setLng(res.lng);
                      }
                      if (res.formattedAddress) {
                        setFormattedAddress(res.formattedAddress);
                      }
                    }}
                    onApplyFormattedAddress={(formatted, resLat, resLng) => {
                      setAddress(formatted);
                      setFormattedAddress(formatted);
                      if (resLat && resLng) {
                        setLat(resLat);
                        setLng(resLng);
                      }
                      setIsAddressValidated(true);
                    }}
                  />
                </div>

                {/* Local de Trabalho */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Local de Trabalho</label>
                  <input
                    type="text"
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-medium text-slate-700"
                    placeholder="Ex: Almoxarifado Central, Unidade Norte, etc."
                    value={workLocation}
                    onChange={(e) => setWorkLocation(e.target.value)}
                  />
                </div>

                {/* Almoxarifado selection for gestores */}
                {(userType === "gestor" || userType === "gestor_servicos" || userType === "admin") && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Almoxarifado de Responsabilidade</label>
                    <select
                      className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-medium text-slate-700 cursor-pointer"
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target.value)}
                    >
                      <option value="">Selecione o almoxarifado responsável...</option>
                      {almoxarifados.map(alm => (
                        <option key={alm.id} value={alm.id}>{alm.code} - {alm.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Integração com Corpo Técnico */}
                <div className="p-4 bg-indigo-50/90 dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-900 rounded-2xl space-y-3.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-wide">Vincular como Técnico?</h4>
                      <p className="text-[10px] text-indigo-800 dark:text-indigo-300 mt-0.5 leading-tight font-medium">Se ativado, este usuário será incluído automaticamente no corpo técnico e poderá receber ordens de serviço.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={isTechnician} 
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsTechnician(checked);
                          if (checked && !specialty) {
                            setSpecialty(categories[0]?.name || "Geral");
                          }
                        }}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {isTechnician && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-indigo-200/50 dark:border-indigo-950">
                      <div>
                        <label className="block text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-1">Cargo / Função Técnica</label>
                        <input
                          type="text"
                          className="w-full text-xs border-2 border-slate-300 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 transition-all font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 shadow-xs"
                          placeholder="Ex: Eletricista, Técnico Pleno"
                          value={technicalRole}
                          onChange={(e) => setTechnicalRole(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-1">Especialidade Principal *</label>
                        <select
                          className="w-full text-xs border-2 border-slate-300 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 transition-all font-bold text-slate-900 dark:text-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 shadow-xs"
                          value={specialty}
                          onChange={(e) => setSpecialty(e.target.value)}
                        >
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                          <option value="Geral">Serviços Gerais / Outro</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Observações Adicionais</label>
                  <textarea
                    rows={3}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-medium text-slate-700"
                    placeholder="Instruções para acesso, regras do condomínio, preferências técnicas..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider py-3 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl shadow-lg shadow-slate-950/5 transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  {editingClient ? "Salvar Alterações" : "Salvar Cadastro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
