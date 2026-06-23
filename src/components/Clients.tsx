import React, { useState, useEffect } from "react";
import { Client, ServiceOrder } from "../types";
import { User, Search, Plus, Phone, Mail, FileText, Trash2, Edit2, MapPin, X, HelpCircle, Check, Briefcase } from "lucide-react";

interface ClientsProps {
  clients: Client[];
  orders: ServiceOrder[];
  onAddClient: (client: Client) => void;
  onUpdateClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
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

export default function Clients({ clients, orders, onAddClient, onUpdateClient, onDeleteClient }: ClientsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);
  
  // Form fields
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [userType, setUserType] = useState<"requisitante" | "gestor" | "gestor_servicos" | "admin">("requisitante");
  const [password, setPassword] = useState("");

  // Detailed view of client (history of Service Orders)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const filteredClients = clients.filter(c => {
    const ut = c.userType || "requisitante";
    return c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.document.includes(searchTerm) ||
      c.phone.includes(searchTerm) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ut.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const openForm = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setName(client.name);
      setDocument(client.document);
      setPhone(client.phone);
      setEmail(client.email);
      setAddress(client.address);
      setNotes(client.notes);
      setUserType(client.userType || "requisitante");
      setPassword(client.password || "123");
    } else {
      setEditingClient(null);
      setName("");
      setDocument("");
      setPhone("");
      setEmail("");
      setAddress("");
      setNotes("");
      setUserType("requisitante");
      setPassword("123");
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
        notes,
        userType,
        password: password || "123"
      });
    } else {
      const newClient: Client = {
        id: "cli-" + Math.random().toString(36).substr(2, 9),
        name,
        document,
        phone,
        email,
        address,
        notes,
        createdAt: new Date().toISOString(),
        userType,
        password: password || "123",
        status: "ativo"
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
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Requisitantes & Gestores (GS)</h1>
          <p className="text-sm text-slate-500 font-medium">Controle de cadastros administrativos (requisitantes e gestores) e histórico integrado de solicitações.</p>
        </div>

        <button
          onClick={() => openForm()}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider py-3 px-5 rounded-xl shadow-lg shadow-slate-950/5 active:translate-y-[1px] transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          Cadastrar Requisitante / Gestor
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
        <input
          type="text"
          className="w-full text-sm border border-slate-200/80 rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-white transition-all font-medium text-slate-700 shadow-sm"
          placeholder="Buscar por nome, perfil (requisitante, gestor), e-mail ou documento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Clients Grid */}
      {isLoading ? (
        <ClientsSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClients.length > 0 ? (
            filteredClients.map(client => {
              const history = getClientOSHistory(client.id);
              const ut = client.userType || "requisitante";
              return (
                <div 
                  key={client.id} 
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
                              <span className="inline-flex items-center bg-red-105 bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide">
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
                </div>
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
                    getClientOSHistory(selectedClient.id).map(os => (
                      <div key={os.id} className="p-4 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 shadow-xs transition-colors flex flex-col justify-between">
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
                      </div>
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
              <h3 className="font-bold text-base">{editingClient ? "Editar Requisitante / Gestor" : "Cadastrar Requisitante / Gestor"}</h3>
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
                    placeholder="Ex: Av. Paulista, 1000 - Bela Vista - SP"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
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
