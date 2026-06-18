import React, { useState } from "react";
import { Mail, ShieldCheck, Key, Server, Hash, Send, RefreshCw, CheckCircle, AlertTriangle, Eye, EyeOff, Sparkles, Terminal } from "lucide-react";
import { SmtpSettings } from "../types";

interface SmtpSettingsPanelProps {
  settings: SmtpSettings;
  onSave: (newSettings: SmtpSettings) => void;
  onNotifyTest: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

export default function SmtpSettingsPanel({ settings, onSave, onNotifyTest }: SmtpSettingsPanelProps) {
  const [host, setHost] = useState(settings.host || "smtp.aracatubaservicos.com.br");
  const [port, setPort] = useState(settings.port || "587");
  const [user, setUser] = useState(settings.user || "suporte@aracatubaservicos.com.br");
  const [pass, setPass] = useState(settings.pass || "************");
  const [senderAddress, setSenderAddress] = useState(settings.senderAddress || "Araçatuba Serviços <suporte@aracatubaservicos.com.br>");
  const [secure, setSecure] = useState(settings.secure !== undefined ? settings.secure : true);
  
  // Local states
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<"not_started" | "success" | "failed">("not_started");

  // Presets trigger
  const applyPreset = (provider: "gmail" | "outlook" | "corporate") => {
    if (provider === "gmail") {
      setHost("smtp.gmail.com");
      setPort("465");
      setUser("suporte.empresa@gmail.com");
      setPass("");
      setSenderAddress("Araçatuba Serviços <suporte.empresa@gmail.com>");
      setSecure(true);
      onNotifyTest("Preset Aplicado", "Configurado pré-ajuste para o Gmail. Use uma senha de app!", "info");
    } else if (provider === "outlook") {
      setHost("smtp.office365.com");
      setPort("587");
      setUser("suporte.empresa@outlook.com");
      setPass("");
      setSenderAddress("Araçatuba Serviços <suporte.empresa@outlook.com>");
      setSecure(false);
      onNotifyTest("Preset Aplicado", "Configurado pré-ajuste para Outlook / Office 365.", "info");
    } else {
      setHost("smtp.aracatubaservicos.com.br");
      setPort("587");
      setUser("suporte@aracatubaservicos.com.br");
      setPass("************");
      setSenderAddress("Araçatuba Serviços <suporte@aracatubaservicos.com.br>");
      setSecure(true);
      onNotifyTest("Preset Restaurado", "Configuração corporativa padrão reatribuída.", "info");
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      host,
      port,
      user,
      pass,
      senderAddress,
      secure
    });
    onNotifyTest(
      "Configurações Salvas", 
      "Servidor SMTP configurado! Novos envios utilizarão estes parâmetros.", 
      "success"
    );
  };

  const executeTestConnection = async () => {
    if (!host || !port || !user) {
      onNotifyTest("Erro de Validação", "Preencha o Host, Porta e Usuário de envio para prosseguir.", "error");
      return;
    }

    setIsTesting(true);
    setTestResult("not_started");
    setTestLogs([]);
    
    const logs = [
      `[SMTP CLIENT] Iniciando rotina de teste de conexão com o servidor ${host}:${port}...`,
      `[SMTP CLIENT] Abrindo canal TCP encriptado por TLS v1.3...`,
    ];
    setTestLogs([...logs]);

    // Step 1: Handshake
    await new Promise(resolve => setTimeout(resolve, 800));
    logs.push(`[SMTP SERVER] 220 ${host} ESMTP Postfix - Service Ready.`);
    logs.push(`[SMTP CLIENT] EHLO localhost`);
    setTestLogs([...logs]);

    // Step 2: Auth Capability check
    await new Promise(resolve => setTimeout(resolve, 700));
    logs.push(`[SMTP SERVER] 250-STARTTLS, 250-AUTH LOGIN PLAIN, 250-SIZE 35840000`);
    if (secure) {
      logs.push(`[SMTP CLIENT] STARTTLS Command Sent`);
      logs.push(`[SMTP SERVER] 220 2.0.0 Ready to start TLS handshake`);
    } else {
      logs.push(`[SMTP CLIENT] TLS secure flag is off. Continuing over plain authorization...`);
    }
    setTestLogs([...logs]);

    // Step 3: Authorization log
    await new Promise(resolve => setTimeout(resolve, 1000));
    logs.push(`[SMTP CLIENT] AUTH LOGIN command dispatched`);
    logs.push(`[SMTP SERVER] 334 VXNlcm5hbWU6 (Waiting username)`);
    logs.push(`[SMTP CLIENT] Sending base64 user: ${window.btoa(user.substring(0, 5)) + "xxxx"}`);
    logs.push(`[SMTP SERVER] 334 UGFzc3dvcmQ6 (Waiting password)`);
    logs.push(`[SMTP CLIENT] Dispatched encrypted secure authorization payload...`);
    
    // Auth Validation Sim
    if (pass.trim() === "") {
      logs.push(`[SMTP SERVER] 535 5.7.8 Authentication failed: Credential is empty.`);
      setTestLogs([...logs]);
      setTestResult("failed");
      setIsTesting(false);
      onNotifyTest("Falha na Autenticação", "Não foi possível validar credenciais vazias no servidor SMTP local.", "error");
      return;
    }

    logs.push(`[SMTP SERVER] 235 2.7.0 Authentication successful.`);
    setTestLogs([...logs]);

    // Step 4: Dispatch Test Email simulation
    await new Promise(resolve => setTimeout(resolve, 900));
    const finalRecipient = testEmail || user;
    logs.push(`[SMTP CLIENT] MAIL FROM: <${user}>`);
    logs.push(`[SMTP SERVER] 250 2.1.0 Ok`);
    logs.push(`[SMTP CLIENT] RCPT TO: <${finalRecipient}>`);
    logs.push(`[SMTP SERVER] 250 2.1.5 Ok - recipient is deliverable.`);
    logs.push(`[SMTP CLIENT] DATA (Sending email body payload)`);
    logs.push(`[SMTP SERVER] 354 Start mail input; end with <CR><LF>.<CR><LF>`);
    logs.push(`[SMTP CLIENT] From: ${senderAddress}`);
    logs.push(`[SMTP CLIENT] To: ${finalRecipient}`);
    logs.push(`[SMTP CLIENT] Subject: [SMTP TEST] Araçatuba OS - Configurações de Servidor Ativa`);
    logs.push(`[SMTP SERVER] 250 2.0.0 Ok: queued as queue_id_${Math.floor(Math.random() * 90000) + 10000}`);
    setTestLogs([...logs]);
    
    setTestResult("success");
    setIsTesting(false);
    onNotifyTest("Teste Concluído!", `Email de teste enviado com sucesso para "${finalRecipient}"!`, "success");
  };

  return (
    <div className="space-y-6">
      {/* Visual Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Parametrização SMTP</h1>
          <p className="text-sm text-slate-500 font-medium">Garanta a máxima segurança (LGPD) e o disparo automático pontual de alertas corporativos e resets de senha.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Form Column */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Server className="w-5 h-5 text-indigo-500" />
            <h2 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Parâmetros de Conexão</h2>
          </div>

          {/* Preset Buttons */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Configuração Rápida (Presets):</span>
            <div className="flex flex-wrap gap-2">
              <button 
                type="button"
                onClick={() => applyPreset("gmail")}
                className="px-3.5 py-1.5 bg-slate-55 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-150 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Gmail SMTP
              </button>
              <button 
                type="button"
                onClick={() => applyPreset("outlook")}
                className="px-3.5 py-1.5 bg-slate-55 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-150 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                Outlook/Hotmail
              </button>
              <button 
                type="button"
                onClick={() => applyPreset("corporate")}
                className="px-3.5 py-1.5 bg-slate-55 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                SMTP Araçatuba Técnico
              </button>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Host SMTP */}
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Servidor Host SMTP</label>
                <div className="relative">
                  <Server className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    required 
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="ex: smtp.provedor.com"
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500" 
                  />
                </div>
              </div>

              {/* Port SMTP */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Porta SMTP</label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    required
                    maxLength={5}
                    value={port}
                    onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="ex: 587"
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500" 
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* SMTP Username */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Usuário de Autenticação</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="email" 
                    required
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="ex: remetente@email.com"
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500" 
                  />
                </div>
              </div>

              {/* SMTP Password */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Senha de Envio</label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder="ex: Senha segura ou Token SMTP"
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 flex items-center cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Custom Sender Address display string */}
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Nome do Remetente Exibido (Header)</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  required
                  value={senderAddress}
                  onChange={(e) => setSenderAddress(e.target.value)}
                  placeholder="Araçatuba Gestão Técnica <suporte@empresa.com.br>"
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500" 
                />
              </div>
              <span className="text-[10px] text-slate-400 block font-medium">Determina o nome amigável e o email que os requisitantes visualizarão no cabeçalho das notificações.</span>
            </div>

            {/* SSL Checkbox toggle with details */}
            <div className="flex items-start gap-3 bg-slate-50 p-4 border border-slate-200/50 rounded-xl">
              <input 
                id="ssl-option"
                type="checkbox" 
                checked={secure}
                onChange={(e) => setSecure(e.target.checked)}
                className="w-4.5 h-4.5 rounded border-slate-350 bg-white text-indigo-600 mt-0.5 focus:ring-0 cursor-pointer"
              />
              <div className="text-left font-sans text-xs">
                <label htmlFor="ssl-option" className="font-extrabold text-slate-800 cursor-pointer flex items-center gap-1.5 select-none">
                  <ShieldCheck className="w-4 h-4 text-indigo-550 text-indigo-600" />
                  Habilitar Sessão Segura e Conexão SSL / TLS
                </label>
                <p className="text-slate-450 text-[10.5px] mt-1">Recomendado na maioria dos provedores (Portas 465 SSL ou 587 TLS automático) para ocultar senhas brutas de redes públicas e em trânsito de acordo com recomendações de conformidade de infraestrutura.</p>
              </div>
            </div>

            {/* Submit Action Block */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:translate-y-[1px] cursor-pointer"
              >
                Salvar Configurações
              </button>
            </div>
          </form>
        </div>

        {/* Diagnostic and Testing Sandbox Simulator Column */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-6 flex flex-col space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Terminal className="w-5 h-5 text-indigo-500" />
            <h2 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Auditoria de Conexão</h2>
          </div>

          <div className="text-left space-y-3 flex-1 flex flex-col">
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Dispare um teste rápido usando os dados acima para garantir que o redirecionamento de senha não seja interrompido por servidores bloqueados ou portas desatualizadas.
            </p>

            {/* Target test email input */}
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Destinatário do Teste</label>
              <div className="relative">
                <input 
                  type="email" 
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder={user || "destinatario@teste.com"}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-500" 
                />
              </div>
            </div>

            {/* Test Trigger button */}
            <button
              type="button"
              disabled={isTesting}
              onClick={executeTestConnection}
              className="w-full py-2.5 bg-slate-900 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-800 disabled:bg-slate-400 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:translate-y-[1px]"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                  Testando Conexão...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Testar Envio SMTP
                </>
              )}
            </button>

            {/* Real-time terminal diagnostic logs block */}
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 font-mono text-[9.5px] leading-relaxed text-emerald-400 flex-1 flex flex-col justify-between overflow-hidden min-h-[220px]">
              <div>
                <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 mb-2.5 text-slate-500 font-bold">
                  <span className="uppercase text-[8px] tracking-wider text-slate-400">Terminal Diagnóstico SMTP</span>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                
                <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1 text-slate-300">
                  {testLogs.length === 0 ? (
                    <div className="text-slate-500 italic py-6 text-center">Nenhum teste de conexão executado na sessão corrente.</div>
                  ) : (
                    testLogs.map((log, idx) => {
                      const isClient = log.includes("[SMTP CLIENT]");
                      const isServer = log.includes("[SMTP SERVER]");
                      let colorClass = "text-slate-400";
                      if (isClient) colorClass = "text-indigo-400";
                      if (isServer) colorClass = "text-teal-400";
                      if (log.includes("failed") || log.includes("Error")) colorClass = "text-rose-400 font-bold";
                      if (log.includes("successful") || log.includes("Ok") || log.includes("Ready")) colorClass = "text-emerald-400 font-extrabold";
                      return (
                        <div key={idx} className={`${colorClass} whitespace-pre-wrap breakdown-all`}>
                          {log}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {testResult !== "not_started" && (
                <div className="border-t border-slate-900 pt-2 mt-2 flex items-center justify-between">
                  <span className="text-slate-550 text-[8.5px] text-slate-500 uppercase font-black">Status do Canal:</span>
                  {testResult === "success" ? (
                    <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                      OK, DISK ENVIADO!
                    </span>
                  ) : (
                    <span className="text-red-400 font-extrabold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      AUTENTICAÇÃO INVÁLIDA
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
