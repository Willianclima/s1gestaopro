import React, { useState } from "react";
import { Professional, ServiceCategory } from "../types";
import { User, Shield, Briefcase, Plus, Trash2, CheckCircle, Search, Mail, Tag, Edit2 } from "lucide-react";

interface ProfessionalsProps {
  professionals: Professional[];
  categories: ServiceCategory[];
  onAddProfessional: (professional: Professional) => void;
  onUpdateProfessional: (professional: Professional) => void;
  onDeleteProfessional: (id: string) => void;
}

export default function Professionals({
  professionals,
  categories,
  onAddProfessional,
  onUpdateProfessional,
  onDeleteProfessional
}: ProfessionalsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [role, setRole] = useState("Técnico");
  const [document, setDocument] = useState("");
  const [password, setPassword] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);

  const filteredProfessionals = professionals.filter(p => {
    return p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           p.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
           p.specialty.toLowerCase().includes(searchTerm.toLowerCase());
  });

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
        password: password || "123"
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
        password: password || "123"
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
  };

  const handleOpenForm = (prof?: Professional) => {
    if (prof) {
      setEditingProfessional(prof);
      setName(prof.name);
      setRole(prof.role);
      setDocument(prof.document || "");
      setPassword(prof.password || "123");
      setSelectedSpecialties(prof.specialties || []);
    } else {
      setEditingProfessional(null);
      setName("");
      setRole("Técnico");
      setDocument("");
      setPassword("123");
      setSelectedSpecialties([]);
    }
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Equipe & Técnicos</h1>
          <p className="text-sm text-slate-500 font-medium">Cadastre e atribua especialidades técnicas para alocação apropriada na esteira de ordens de serviço.</p>
        </div>

        <button
          onClick={handleOpenForm}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider py-3 px-5 rounded-xl shadow-lg shadow-slate-950/5 active:translate-y-[1px] transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          Cadastrar Técnico / Profissional
        </button>
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
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Especialidades Disponíveis</span>
            <span className="text-3xl font-extrabold text-slate-800 block">{categories.length} Categorias</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-600">
            <Tag className="w-5 h-5" />
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full pointer-events-none" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between relative overflow-hidden sm:col-span-2 lg:col-span-1">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Status Operacional</span>
            <span className="text-sm font-bold text-emerald-600 block mt-1 flex items-center gap-1">
              <CheckCircle className="w-4.5 h-4.5" /> Equipe Pronta para Alocação
            </span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-600">
            <Shield className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="w-full text-xs border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-500/10 focus:border-slate-800 bg-white transition-all font-medium text-slate-700"
            placeholder="Buscar técnico por nome, cargo ou especialidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold text-[11px] uppercase tracking-wider">
                <th className="px-6 py-4">Nome / Cadastro</th>
                <th className="px-6 py-4">Cargo / Atribuição</th>
                <th className="px-6 py-4">Especialidades Técnicas</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
              {filteredProfessionals.length > 0 ? (
                filteredProfessionals.map(prof => (
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
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-slate-400 font-medium">
                    Nenhum integrante cadastrado ou encontrado com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW PROFESSIONAL POP-UP MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
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
    </div>
  );
}
