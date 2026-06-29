import React, { useState } from "react";
import { Professional, ServiceCategory, Team, ServiceOrder, Almoxarifado } from "../types";
import { User, Shield, Briefcase, Plus, Trash2, CheckCircle, Search, Mail, Tag, Edit2, Users, Crown, X, AlertCircle, Star } from "lucide-react";

interface ProfessionalsProps {
  professionals: Professional[];
  categories: ServiceCategory[];
  onAddProfessional: (professional: Professional) => void;
  onUpdateProfessional: (professional: Professional) => void;
  onDeleteProfessional: (id: string) => void;
  teams?: Team[];
  onAddTeam?: (team: Team) => void;
  onUpdateTeam?: (team: Team) => void;
  onDeleteTeam?: (id: string) => void;
  orders?: ServiceOrder[];
  almoxarifados?: Almoxarifado[];
}

export default function Professionals({
  professionals,
  categories,
  onAddProfessional,
  onUpdateProfessional,
  onDeleteProfessional,
  teams = [],
  onAddTeam,
  onUpdateTeam,
  onDeleteTeam,
  orders = [],
  almoxarifados = []
}: ProfessionalsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);

  // Mode tabs
  const [activeTabSection, setActiveTabSection] = useState<"individuals" | "teams">("individuals");

  // Team Form Fields / States
  const [isTeamFormOpen, setIsTeamFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedLeaderId, setSelectedLeaderId] = useState("");

  // Form Fields for Individual Professional
  const [name, setName] = useState("");
  const [role, setRole] = useState("Técnico");
  const [document, setDocument] = useState("");
  const [password, setPassword] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [workLocation, setWorkLocation] = useState("");

  const filteredProfessionals = professionals.filter(p => {
    return p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           p.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
           p.specialty.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getProfessionalName = (id: string): string => {
    const pr = professionals.find(p => p.id === id);
    return pr ? pr.name : "Integrante Desconhecido";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalSpecialties = selectedSpecialties.length > 0 ? selectedSpecialties : ["Geral"];
    const finalSpecialtyStr = finalSpecialties.join(", ");

    if (editingProfessional) {
      const updatedProf: Professional = {
        ...editingProfessional,
        name,
        role,
        specialty: finalSpecialtyStr,
        specialties: finalSpecialties,
        document,
        password: password || "123",
        workLocation: workLocation || undefined
      };
      onUpdateProfessional(updatedProf);
    } else {
      const newProf: Professional = {
        id: "prof-" + Math.random().toString(36).substr(2, 9),
        name,
        role,
        specialty: finalSpecialtyStr,
        specialties: finalSpecialties,
        userType: "profissional",
        document,
        password: password || "123",
        workLocation: workLocation || undefined
      };
      onAddProfessional(newProf);
    }
    
    setIsFormOpen(false);

    // Reset Form
    setEditingProfessional(null);
    setName("");
    setRole("Técnico");
    setDocument("");
    setPassword("");
    setSelectedSpecialties([]);
    setWorkLocation("");
  };

  const handleOpenForm = (prof?: Professional) => {
    if (prof) {
      setEditingProfessional(prof);
      setName(prof.name);
      setRole(prof.role);
      setDocument(prof.document || "");
      setPassword(prof.password || "123");
      setSelectedSpecialties(prof.specialties || []);
      setWorkLocation(prof.workLocation || "");
    } else {
      setEditingProfessional(null);
      setName("");
      setRole("Técnico");
      setDocument("");
      setPassword("123");
      setSelectedSpecialties([]);
      setWorkLocation("");
    }
    setIsFormOpen(true);
  };

  const handleOpenTeamForm = (team?: Team) => {
    if (team) {
      setEditingTeam(team);
      setTeamName(team.name);
      setSelectedMemberIds(team.memberIds);
      setSelectedLeaderId(team.leaderId);
    } else {
      setEditingTeam(null);
      setTeamName("");
      setSelectedMemberIds([]);
      setSelectedLeaderId("");
    }
    setIsTeamFormOpen(true);
  };

  const handleTeamFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    if (selectedMemberIds.length === 0) return;
    if (!selectedLeaderId) return;

    if (editingTeam) {
      const updated: Team = {
        ...editingTeam,
        name: teamName.trim(),
        memberIds: selectedMemberIds,
        leaderId: selectedLeaderId
      };
      onUpdateTeam?.(updated);
    } else {
      const newTeam: Team = {
        id: "team-" + Math.random().toString(36).substr(2, 9),
        name: teamName.trim(),
        memberIds: selectedMemberIds,
        leaderId: selectedLeaderId,
        createdAt: new Date().toISOString()
      };
      onAddTeam?.(newTeam);
    }
    setIsTeamFormOpen(false);

    // reset
    setEditingTeam(null);
    setTeamName("");
    setSelectedMemberIds([]);
    setSelectedLeaderId("");
  };

  const toggleMemberSelection = (profId: string) => {
    setSelectedMemberIds(prev => {
      if (prev.includes(profId)) {
        const filtered = prev.filter(id => id !== profId);
        if (selectedLeaderId === profId) {
          setSelectedLeaderId(filtered.length > 0 ? filtered[0] : "");
        }
        return filtered;
      } else {
        const updated = [...prev, profId];
        if (!selectedLeaderId) {
          setSelectedLeaderId(profId);
        }
        return updated;
      }
    });
  };

  const filteredTeams = teams.filter(t => {
    return t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           getProfessionalName(t.leaderId).toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Equipe & Técnicos</h1>
          <p className="text-sm text-slate-500 font-medium">Cadastre especialidades técnicas do corpo individual e monte times de cooperação integrada.</p>
        </div>

        {activeTabSection === "individuals" ? (
          <button
            onClick={() => handleOpenForm()}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider py-3 px-5 rounded-xl shadow-lg shadow-slate-950/5 active:translate-y-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            Cadastrar Profissional
          </button>
        ) : (
          <button
            onClick={() => handleOpenTeamForm()}
            className="bg-indigo-650 bg-indigo-600 hover:bg-indigo-550 text-white font-bold text-xs uppercase tracking-wider py-3 px-5 rounded-xl shadow-lg shadow-indigo-950/10 active:translate-y-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Users className="w-4 h-4 text-emerald-300" />
            Montar Nova Equipe
          </button>
        )}
      </div>

      {/* Specialty Quick Stats Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Profissionais Gerais</span>
            <span className="text-3xl font-extrabold text-slate-800 block">{professionals.length} Técnicos</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-600">
            <User className="w-5 h-5" />
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full pointer-events-none" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Especialidades Ativas</span>
            <span className="text-3xl font-extrabold text-slate-800 block">{categories.length} Categorias</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-600">
            <Tag className="w-5 h-5" />
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full pointer-events-none" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between relative overflow-hidden sm:col-span-2 lg:col-span-1">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Equipes Formadas</span>
            <span className="text-3xl font-extrabold text-indigo-650 text-indigo-600 block">{teams.length} Ativas</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-600">
            <Users className="w-5 h-5" />
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full pointer-events-none" />
        </div>
      </div>

      {/* View Switcher segment */}
      <div className="flex border-b border-slate-100 overflow-x-auto gap-2">
        <button 
          onClick={() => { setActiveTabSection("individuals"); setSearchTerm(""); }}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTabSection === "individuals"
              ? "border-slate-800 text-slate-800 font-extrabold"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <User className="w-4 h-4" />
          Profissionais Individuais
        </button>
        <button 
          onClick={() => { setActiveTabSection("teams"); setSearchTerm(""); }}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTabSection === "teams"
              ? "border-slate-800 text-slate-800 font-extrabold"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Users className="w-4 h-4" />
          Equipes de Campo ({teams.length})
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="w-full text-xs border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-white transition-all font-medium text-slate-700"
            placeholder={
              activeTabSection === "individuals"
                ? "Buscar técnico por nome, cargo ou especialidade..."
                : "Buscar equipe pelo nome ou pelo responsável técnico..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* INDIVIDUAL PROFESSIONALS LIST */}
      {activeTabSection === "individuals" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold text-[11px] uppercase tracking-wider">
                  <th className="px-6 py-4">Nome / Cadastro</th>
                  <th className="px-6 py-4">Cargo / Atribuição</th>
                  <th className="px-6 py-4">Especialidades Técnicas</th>
                  <th className="px-6 py-4">Carga de Trabalho (OS)</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {filteredProfessionals.length > 0 ? (
                  filteredProfessionals.map(prof => {
                    const techOrders = orders.filter(o => o.assignedTo === prof.name);
                    const activeOrders = techOrders.filter(o => o.status !== "concluido" && o.status !== "cancelado");
                    
                    const maxCapacity = 5;
                    const percentage = Math.min(100, Math.round((activeOrders.length / maxCapacity) * 100));

                    let barColor = "bg-emerald-500";
                    let textColor = "text-emerald-700 bg-emerald-50 border-emerald-150";
                    let statusText = "Sob Controle";

                    if (activeOrders.length === 0) {
                      barColor = "bg-slate-200";
                      textColor = "text-slate-500 bg-slate-50 border-slate-150";
                      statusText = "Livre / Disponível";
                    } else if (activeOrders.length >= 4) {
                      barColor = "bg-rose-500";
                      textColor = "text-rose-700 bg-rose-50 border-rose-150";
                      statusText = "Carga Crítica";
                    } else if (activeOrders.length >= 2) {
                      barColor = "bg-amber-500";
                      textColor = "text-amber-700 bg-amber-50 border-amber-150";
                      statusText = "Moderada";
                    }

                    return (
                      <tr key={prof.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700 font-bold shrink-0 uppercase text-[10px]">
                              {prof.name.split(" ").slice(0, 2).map(n => n[0]).join("")}
                            </div>
                            <div>
                              <span className="font-extrabold text-slate-850 block">{prof.name}</span>
                              <span className="text-[10px] text-slate-400 block font-mono">ID: {prof.id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-650">
                          {prof.role}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1 md:max-w-[325px]">
                            {prof.specialties && prof.specialties.length > 0 ? (
                              prof.specialties.map((spec, sidx) => (
                                <span key={sidx} className="inline-block bg-slate-100 border border-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-wide">
                                  {spec}
                                </span>
                              ))
                            ) : (
                              <span className="inline-block bg-indigo-50 border border-indigo-150 text-indigo-700 font-bold px-2 py-0.5 rounded-lg text-[9px] uppercase">
                                {prof.specialty || "Geral"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1.5 max-w-[160px]">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider ${textColor}`}>
                                {activeOrders.length} {activeOrders.length === 1 ? "Ativa" : "Ativas"}
                              </span>
                              <span className="text-slate-500 font-extrabold font-mono">
                                {percentage}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 border border-slate-200/50 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${barColor}`} 
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-slate-400 select-none">
                              <span>Teto ideal: {maxCapacity} OS</span>
                              <span className="font-bold">{statusText}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenForm(prof)}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                              title="Editar cadastro do integrante"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Remover definitivamente o integrante ${prof.name}?`)) {
                                  onDeleteProfessional(prof.id);
                                }
                              }}
                              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                              title="Excluir integrante"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400 font-medium">
                      Nenhum integrante cadastrado ou encontrado com esses filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TEAM CREATION / GRID AREA */}
      {activeTabSection === "teams" && (
        <div id="team-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeams.length > 0 ? (
            filteredTeams.map(team => {
              const leaderName = getProfessionalName(team.leaderId);
              return (
                <div key={team.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4 flex flex-col justify-between hover:shadow-lg hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group">
                  <div className="space-y-3.5">
                    {/* Team Title */}
                    <div className="flex items-start justify-between select-none">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-50 border border-indigo-100 text-indigo-650 rounded-xl flex items-center justify-center shrink-0">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-sm leading-tight uppercase tracking-wider">{team.name}</h4>
                          <span className="text-[9px] text-slate-400 font-bold block mt-0.5 uppercase tracking-wider font-mono">ID: {team.id}</span>
                        </div>
                      </div>
                    </div>

                    {/* Leader Highlight */}
                    <div className="bg-amber-50/40 border border-amber-150 p-3.5 rounded-2xl flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[8px] text-amber-800 uppercase font-extrabold tracking-wider flex items-center gap-1">
                          <Crown className="w-3 h-3 fill-amber-500 text-amber-600" />
                          Responsável Técnico / Líder
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-xs text-slate-800 leading-none">{leaderName}</span>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[8px] font-black uppercase tracking-wider shadow-xs shadow-amber-500/20">
                            <Star className="w-2.5 h-2.5 fill-white text-white" />
                            Responsável
                          </span>
                        </div>
                      </div>
                      <div className="p-1.5 bg-amber-100 text-amber-700 rounded-xl">
                        <Crown className="w-4 h-4 fill-amber-300 text-amber-605" />
                      </div>
                    </div>

                    {/* Members List */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider block">Integrantes de Campo ({team.memberIds.length}):</span>
                      <div className="flex flex-wrap gap-1.5">
                        {team.memberIds.map(memId => {
                          const isLeader = memId === team.leaderId;
                          return (
                            <span 
                              key={memId} 
                              className={`inline-flex items-center gap-1 border font-bold px-2 py-1 rounded-lg text-[9px] uppercase tracking-wide ${
                                isLeader
                                  ? "bg-amber-50 border-amber-250 text-amber-800"
                                  : "bg-slate-100 border-slate-200 text-slate-700"
                              }`}
                            >
                              {isLeader && <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />}
                              {getProfessionalName(memId)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 border-t border-slate-50 flex items-center justify-end gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenTeamForm(team)}
                      className="px-3 py-1.5 hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1"
                      title="Editar composição da equipe"
                    >
                      <Edit2 className="w-3 h-3 text-slate-450" />
                      Editar
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remover e desfazer definitivamente a equipe "${team.name}"?`)) {
                          onDeleteTeam?.(team.id);
                        }
                      }}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1"
                      title="Remover Equipe"
                    >
                      <Trash2 className="w-3 h-3" />
                      Desfazer
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full bg-white border border-slate-100 rounded-3xl p-12 text-center text-slate-400 font-medium space-y-4 shadow-sm">
              <Users className="w-12 h-12 text-slate-350 mx-auto" />
              <div className="space-y-1">
                <p className="font-extrabold text-slate-700">Nenhuma equipe configurada ou encontrada</p>
                <p className="text-xs text-slate-400">Monte equipes técnicas para coordenar múltiplos profissionais sob um líder designado.</p>
              </div>
              <button
                onClick={() => handleOpenTeamForm()}
                className="mx-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                Montar Primeira Equipe
              </button>
            </div>
          )}
        </div>
      )}

      {/* NEW PROFESSIONAL POP-UP MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-extrabold text-sm uppercase tracking-wider">
                {editingProfessional ? "Editar Técnico / Profissional" : "Cadastrar Técnico / Profissional"}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-semibold text-slate-700"
                    placeholder="Ex: João Roberto de Souza"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                {/* CPF / Document */}
                <div>
                  <label className="block text-xs font-bold text-slate-702 uppercase tracking-wider mb-1.5">CPF (Acesso Seguro) *</label>
                  <input
                    type="text"
                    required
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-semibold font-mono text-slate-700"
                    placeholder="Ex: 111.111.111-11"
                    value={document}
                    onChange={(e) => setDocument(e.target.value)}
                  />
                </div>

                {/* Password / Senha */}
                <div>
                  <label className="block text-xs font-bold text-slate-703 uppercase tracking-wider mb-1.5">Senha de Acesso *</label>
                  <input
                    type="text"
                    required
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-semibold text-slate-700"
                    placeholder="Digite a senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Cargo / Atribuição</label>
                  <input
                    type="text"
                    required
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-semibold text-slate-700"
                    placeholder="Ex: Auxiliar Técnico, Mecânico Líder"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  />
                </div>

                {/* Local de Trabalho */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Local de Trabalho</label>
                  <input
                    type="text"
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-slate-50/50 transition-all font-semibold text-slate-700"
                    placeholder="Ex: Almoxarifado Central, Unidade Norte, etc."
                    value={workLocation}
                    onChange={(e) => setWorkLocation(e.target.value)}
                  />
                </div>

                {/* Specialty category selector */}
                <div className="space-y-1.5 animate-fade-in">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Categorias Técnicas (Possibilita mais de uma) *</label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto p-2 border border-slate-205 rounded-xl bg-slate-50/50">
                    {categories.map((cat) => {
                      const isChecked = selectedSpecialties.includes(cat.name);
                      return (
                        <div
                          key={cat.id}
                          onClick={() => {
                            if (isChecked) {
                              setSelectedSpecialties(prev => prev.filter(s => s !== cat.name));
                            } else {
                              setSelectedSpecialties(prev => [...prev, cat.name]);
                            }
                          }}
                          className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                            isChecked
                              ? "bg-slate-900 border-slate-900 text-white font-extrabold"
                              : "bg-white border-slate-200 hover:border-slate-250 text-slate-600"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="rounded text-slate-900 border-slate-300 focus:ring-slate-900 pointer-events-none"
                            checked={isChecked}
                            readOnly
                          />
                          <span className="flex-1">
                            {cat.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold py-3 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  {editingProfessional ? "Salvar Alterações" : "Salvar Cadastro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEAM CONFIGURATION/ASSEMBLY POP-UP MODAL */}
      {isTeamFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-950/30 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4.5 bg-indigo-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-350 text-emerald-350" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider">
                  {editingTeam ? "Editar Equipe Técnica" : "Montar Equipe Técnica"}
                </h3>
              </div>
              <button 
                onClick={() => setIsTeamFormOpen(false)}
                className="p-1 hover:bg-indigo-850 rounded-lg text-indigo-200 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTeamFormSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-5 overflow-y-auto flex-1 text-left">
                {/* Team Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Nome da Equipe *</label>
                  <input
                    type="text"
                    required
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 bg-slate-50/50 transition-all font-semibold text-slate-700"
                    placeholder="Ex: Equipe de Redes Alpha, Equipe Civil Sul"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                  />
                </div>

                {/* Tic/Select Techs Checklist */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Ticar Integrantes de Campo (Selecione) *</label>
                  <p className="text-[10px] text-slate-400 font-medium">Marque abaixo as caixinhas de todos os técnicos que atuarão cooperativamente na equipe.</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2.5 border border-slate-200 rounded-xl bg-slate-50/50">
                    {professionals.map((prof) => {
                      const isTicked = selectedMemberIds.includes(prof.id);
                      return (
                        <div
                          key={prof.id}
                          onClick={() => toggleMemberSelection(prof.id)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                            isTicked
                              ? "bg-indigo-50 border-indigo-250 text-indigo-905 text-indigo-900 font-extrabold"
                              : "bg-white border-slate-200 hover:border-slate-300 text-slate-600"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="rounded text-indigo-600 border-slate-300 focus:ring-0 pointer-events-none w-4 h-4 shrink-0"
                            checked={isTicked}
                            readOnly
                          />
                          <div className="truncate">
                            <span className="block truncate font-bold">{prof.name}</span>
                            <span className="text-[9px] text-slate-400 block font-normal truncate mt-0.5">{prof.role}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Select Responsible / Leader */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Responsável/Coordenador Técnico da Equipe *</label>
                  
                  {selectedMemberIds.length > 0 ? (
                    <div className="relative">
                      <select
                        required
                        value={selectedLeaderId}
                        onChange={(e) => setSelectedLeaderId(e.target.value)}
                        className="w-full text-xs font-bold border border-slate-200 rounded-xl pl-3.5 pr-10 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500 text-slate-700 appearance-none cursor-pointer"
                      >
                        <option value="">Selecione o responsável principal...</option>
                        {selectedMemberIds.map(memId => {
                          const p = professionals.find(prof => prof.id === memId);
                          return (
                            <option key={memId} value={memId}>
                              {p ? `${p.name} (${p.role})` : "Profissional desconhecido"}
                            </option>
                          );
                        })}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4.5 text-slate-400">
                        <Crown className="w-4 h-4 text-amber-500 fill-amber-300" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[10.5px] text-slate-400 bg-slate-100/50 border border-dashed border-slate-200 p-3 rounded-xl">
                      <AlertCircle className="w-4.5 h-4.5 text-slate-450 shrink-0" />
                      <span>Marque (tique) os técnicos acima para apontar quem liderará a equipe.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Footer Buttons */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setIsTeamFormOpen(false)}
                  className="flex-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold py-3 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!teamName.trim() || selectedMemberIds.length === 0 || !selectedLeaderId}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  {editingTeam ? "Salvar Equipe" : "Confirmar Equipe"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
