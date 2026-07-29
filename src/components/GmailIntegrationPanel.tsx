import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logoutGoogle, getAccessToken } from '../services/firebaseAuth';
import { 
  listGmailMessages, 
  getGmailMessageDetail, 
  sendGmailMessage, 
  GmailMessageSummary, 
  GmailMessageDetail 
} from '../services/gmailService';
import { 
  Mail, Search, RefreshCw, Send, CheckCircle2, AlertTriangle, 
  LogOut, User as UserIcon, FileText, Inbox, Eye, ArrowLeft,
  Sparkles, ExternalLink, ShieldCheck, Clock, X, Paperclip, ChevronRight
} from 'lucide-react';

interface GmailIntegrationPanelProps {
  onToastSuccess?: (msg: string, title?: string) => void;
  onToastError?: (msg: string, title?: string) => void;
  onToastInfo?: (msg: string, title?: string) => void;
}

export default function GmailIntegrationPanel({
  onToastSuccess,
  onToastError,
  onToastInfo
}: GmailIntegrationPanelProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Messages state
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Compose email state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  
  // Confirmation dialog state before sending email (Workspace API Mandatory rule)
  const [showConfirmSendModal, setShowConfirmSendModal] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (authenticatedUser, accessToken) => {
        setUser(authenticatedUser);
        setToken(accessToken);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch inbox when authenticated
  useEffect(() => {
    if (token && !needsAuth) {
      loadMessages();
    }
  }, [token, needsAuth]);

  const loadMessages = async (query = searchQuery) => {
    if (!token) return;
    setIsLoadingMessages(true);
    try {
      const msgs = await listGmailMessages(token, query);
      setMessages(msgs);
    } catch (err: any) {
      console.error('Error loading Gmail messages:', err);
      if (onToastError) onToastError(err.message || 'Falha ao carregar mensagens do Gmail.');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleLogin = async () => {
    setIsAuthenticating(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        if (onToastSuccess) onToastSuccess(`Conectado à conta do Google com sucesso! (${result.user.email})`, 'Gmail Conectado');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      if (onToastError) onToastError(err.message || 'Falha na autenticação do Google.', 'Erro de Autenticação');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    await logoutGoogle();
    setUser(null);
    setToken(null);
    setNeedsAuth(true);
    setMessages([]);
    setSelectedMessage(null);
    if (onToastInfo) onToastInfo('Conta do Google desconectada.', 'Desconectado');
  };

  const handleOpenMessage = async (msgId: string) => {
    if (!token) return;
    setIsLoadingDetail(true);
    try {
      const detail = await getGmailMessageDetail(token, msgId);
      setSelectedMessage(detail);
    } catch (err: any) {
      console.error('Error reading message detail:', err);
      if (onToastError) onToastError(err.message || 'Não foi possível carregar a mensagem.', 'Erro Gmail');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Step 1: Click Send -> Show User Confirmation Modal
  const handleInitiateSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      if (onToastError) onToastError('Preencha todos os campos do e-mail (destinatário, assunto e mensagem).');
      return;
    }
    setShowConfirmSendModal(true);
  };

  // Step 2: Confirmed in Dialog -> Execute send
  const handleConfirmSendEmail = async () => {
    if (!token) return;
    setIsSending(true);
    try {
      await sendGmailMessage(token, composeTo.trim(), composeSubject.trim(), composeBody.trim());
      if (onToastSuccess) onToastSuccess(`E-mail enviado com sucesso para ${composeTo}!`, 'E-mail Enviado');
      setIsComposeOpen(false);
      setShowConfirmSendModal(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      // Refresh list after sending
      loadMessages();
    } catch (err: any) {
      console.error('Error sending email:', err);
      if (onToastError) onToastError(err.message || 'Erro ao enviar e-mail via Gmail.', 'Falha no Envio');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-900/40 via-slate-900 to-indigo-950 p-6 rounded-2xl border border-red-900/30 shadow-lg text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-600/20 border border-red-500/40 rounded-xl text-red-400">
              <Mail className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">Integração Oficial com Gmail</h2>
                <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                  Google Workspace
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Envie notificações de OS, relatórios e acesse a sua caixa de entrada diretamente do sistema.
              </p>
            </div>
          </div>

          {/* Account Status Badge / Sign in */}
          <div>
            {!needsAuth && user ? (
              <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'Google Account'} className="w-9 h-9 rounded-full border border-indigo-500/50" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-red-600/30 text-red-300 font-bold flex items-center justify-center border border-red-500/40">
                    <UserIcon className="w-5 h-5" />
                  </div>
                )}
                <div className="text-left pr-2">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    {user.displayName || 'Usuário Google'}
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">{user.email}</div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                  title="Desconectar conta Google"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main Body */}
      {needsAuth ? (
        /* Sign In Card - Official Material Button */
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center max-w-lg mx-auto shadow-xl space-y-6">
          <div className="w-16 h-16 bg-red-600/10 border border-red-500/30 text-red-400 rounded-2xl flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white">Conecte sua Conta do Google</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Autentique-se de forma segura com a sua conta do Google para visualizar seus e-mails e enviar comunicações oficiais de ordens de serviço via Gmail.
            </p>
          </div>

          <div className="pt-2 flex justify-center">
            {/* Standard Official Google Sign-In Button */}
            <button
              type="button"
              onClick={handleLogin}
              disabled={isAuthenticating}
              className="bg-white hover:bg-slate-100 text-slate-800 font-bold px-6 py-3 rounded-xl border border-slate-300 shadow-md flex items-center gap-3 transition-all cursor-pointer hover:shadow-lg disabled:opacity-50"
            >
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 shrink-0">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              <span>{isAuthenticating ? 'Conectando...' : 'Entrar com o Google'}</span>
            </button>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 text-left flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Suas credenciais são gerenciadas diretamente pelo serviço de autenticação do Google via OAuth 2.0. Os tokens são mantidos em memória.
            </span>
          </div>
        </div>
      ) : (
        /* Authenticated Gmail View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Messages Column */}
          <div className={`${selectedMessage ? 'lg:col-span-5 hidden lg:block' : 'lg:col-span-12'} bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl`}>
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-red-400" />
                <h3 className="font-bold text-white text-sm">Caixa de Entrada Gmail</h3>
                <span className="bg-slate-800 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded-full border border-slate-700">
                  {messages.length} e-mails
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(true)}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Novo E-mail</span>
                </button>

                <button
                  type="button"
                  onClick={() => loadMessages()}
                  disabled={isLoadingMessages}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer"
                  title="Atualizar mensagens"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingMessages ? 'animate-spin text-red-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Search Input */}
            <form onSubmit={(e) => { e.preventDefault(); loadMessages(); }} className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar e-mails no Gmail (ex: cliente, OS, assunto)..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-20 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all"
              >
                Buscar
              </button>
            </form>

            {/* Messages List */}
            {isLoadingMessages ? (
              <div className="py-12 text-center text-slate-400 space-y-3">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-red-400" />
                <p className="text-xs">Carregando e-mails da sua conta Gmail...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-800 rounded-2xl p-6">
                <Mail className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-300">Nenhum e-mail encontrado</p>
                <p className="text-xs text-slate-500 mt-1">Sua caixa de entrada está vazia ou a busca não retornou resultados.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => handleOpenMessage(msg.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left space-y-1.5 ${
                      selectedMessage?.id === msg.id
                        ? 'bg-red-950/40 border-red-500/60 ring-1 ring-red-500/30'
                        : msg.isUnread
                        ? 'bg-slate-800/80 border-slate-700 hover:bg-slate-800'
                        : 'bg-slate-950/60 border-slate-800 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-bold truncate max-w-[200px] ${msg.isUnread ? 'text-white' : 'text-slate-300'}`}>
                        {msg.from}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {msg.date ? new Date(msg.date).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1.5">
                      {msg.isUnread && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Não lida" />
                      )}
                      <span>{msg.subject}</span>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {msg.snippet}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message Detail View Column */}
          {selectedMessage && (
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl text-left">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="lg:hidden text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800 px-3 py-1.5 rounded-lg"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar à lista
                </button>
                <div className="flex items-center gap-2">
                  <span className="bg-red-500/20 text-red-300 text-[10px] font-bold px-2.5 py-1 rounded-md border border-red-500/30">
                    Detalhes do E-mail
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isLoadingDetail ? (
                <div className="py-16 text-center text-slate-400 space-y-3">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-red-400" />
                  <p className="text-xs">Carregando conteúdo do e-mail...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white leading-snug">{selectedMessage.subject}</h3>
                    <div className="mt-2 text-xs text-slate-300 space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono">
                      <div><strong className="text-slate-400">De:</strong> {selectedMessage.from}</div>
                      <div><strong className="text-slate-400">Para:</strong> {selectedMessage.to}</div>
                      <div><strong className="text-slate-400">Data:</strong> {selectedMessage.date}</div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl max-h-[380px] overflow-y-auto">
                    {selectedMessage.bodyHtml ? (
                      <div 
                        className="text-xs text-slate-200 leading-relaxed space-y-2 prose prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: selectedMessage.bodyHtml }}
                      />
                    ) : (
                      <pre className="text-xs text-slate-200 font-sans whitespace-pre-wrap leading-relaxed">
                        {selectedMessage.bodyText || selectedMessage.snippet}
                      </pre>
                    )}
                  </div>

                  {/* Quick Action: Reply */}
                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setComposeTo(selectedMessage.from || '');
                        setComposeSubject(`Re: ${selectedMessage.subject}`);
                        setIsComposeOpen(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      <Send className="w-3.5 h-3.5" /> Responder via Gmail
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Compose Email Modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-[999]">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5 text-left animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold">
                <Mail className="w-5 h-5 text-red-500" />
                <span>Novo E-mail (Gmail Oficial)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsComposeOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInitiateSend} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Para (Destinatário) <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="cliente@exemplo.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Assunto <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Atualização da Ordem de Serviço #102..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Mensagem <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={6}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Escreva a mensagem aqui..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500/30"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-mono">
                  Enviando como: <strong className="text-slate-200">{user?.email}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsComposeOpen(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar E-mail</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog before sending email (WORKSPACE INTEGRATION MANDATORY) */}
      {showConfirmSendModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 z-[1000]">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-left animate-fadeIn">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2 bg-amber-500/20 border border-amber-500/30 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Confirmar Envio de E-mail</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Você está prestes a disparar um e-mail oficial através do serviço do Gmail em nome da sua conta.
            </p>

            <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-xs space-y-1.5 font-mono text-slate-300">
              <div><span className="text-slate-500">Destinatário:</span> <strong className="text-white">{composeTo}</strong></div>
              <div><span className="text-slate-500">Assunto:</span> <strong className="text-white">{composeSubject}</strong></div>
              <div><span className="text-slate-500">Remetente:</span> {user?.email}</div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmSendModal(false)}
                disabled={isSending}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmSendEmail}
                disabled={isSending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Disparando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirmar & Enviar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
