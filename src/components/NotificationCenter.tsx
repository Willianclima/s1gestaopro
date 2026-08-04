import React, { useState } from 'react';
import { AppNotification } from '../types';
import { playNotificationSound, toggleAudioMute, getIsAudioMuted } from '../utils/notificationSound';
import { 
  Bell, Volume2, VolumeX, CheckCheck, Trash2, X, ClipboardList, 
  AlertTriangle, CheckCircle2, Clock, ArrowRight, ShieldCheck, Zap
} from 'lucide-react';

interface NotificationCenterProps {
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onSelectServiceOrder?: (osId: string) => void;
}

export default function NotificationCenter({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onSelectServiceOrder
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'alerts'>('all');
  const [isMuted, setIsMuted] = useState<boolean>(getIsAudioMuted());

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'alerts') return n.type === 'system_alert' || n.type === 'os_created';
    return true;
  });

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const muted = toggleAudioMute();
    setIsMuted(muted);
    if (!muted) {
      playNotificationSound('chime');
    }
  };

  const handleTestChime = () => {
    playNotificationSound('success');
  };

  const getNotificationIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'os_created':
        return <ClipboardList className="w-4 h-4 text-indigo-400 shrink-0" />;
      case 'os_status':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'os_assigned':
        return <Zap className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'system_alert':
        return <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />;
      default:
        return <Bell className="w-4 h-4 text-sky-400 shrink-0" />;
    }
  };

  return (
    <div className="relative">
      {/* Bell Trigger Button in Header */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`relative p-2.5 min-w-[44px] min-h-[44px] touch-manipulation rounded-xl border transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
            unreadCount > 0
              ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-300 hover:bg-indigo-900/50 shadow-md shadow-indigo-950/50'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80'
          }`}
          title="Central de Notificações em Tempo Real (In-App & Áudio Chime)"
          aria-label="Abrir Notificações"
        >
          <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'text-indigo-400 animate-bounce' : ''}`} />
          
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-indigo-600 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Audio Mute Quick Toggle Button */}
        <button
          type="button"
          onClick={handleToggleMute}
          className="p-2.5 min-w-[44px] min-h-[44px] touch-manipulation rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer hidden sm:flex items-center justify-center active:scale-95"
          title={isMuted ? 'Áudio de notificações silenciado (Clique para ativar som)' : 'Áudio de notificações ativo (Clique para silenciar)'}
          aria-label="Alternar Áudio"
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4 text-rose-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-emerald-400" />
          )}
        </button>
      </div>

      {/* Popover / Overlay Drawer */}
      {isOpen && (
        <>
          {/* Backdrop for easy click outside */}
          <div 
            className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-[1px]" 
            onClick={() => setIsOpen(false)} 
          />

          <div className="absolute right-0 mt-2.5 w-[340px] sm:w-[420px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh] animate-fadeIn">
            
            {/* Drawer Header */}
            <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-lg">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    Central de Notificações
                    {unreadCount > 0 && (
                      <span className="bg-indigo-600/80 text-indigo-100 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                        {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </h3>
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Entrega Garantida (iFrame Independent)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleTestChime}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 border border-slate-700 cursor-pointer"
                  title="Testar sinal sonoro Web Audio"
                >
                  <Volume2 className="w-3 h-3 text-indigo-400" />
                  Testar Som
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs & Quick Actions */}
            <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    filter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todas ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('unread')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    filter === 'unread' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Não lidas ({unreadCount})
                </button>
              </div>

              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllAsRead}
                    className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition-all text-[11px] flex items-center gap-1 font-semibold cursor-pointer"
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-indigo-400" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearAll}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-all text-[11px] flex items-center gap-1 font-semibold cursor-pointer"
                    title="Limpar todas as notificações"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Notification List Container */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 max-h-[380px] scroll-narrow">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500">
                    <Bell className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-300">Nenhuma notificação encontrada</p>
                  <p className="text-[11px] text-slate-500 max-w-[240px] mx-auto">
                    Você receberá alertas em tempo real aqui sobre ordens de serviço, atribuições de técnicos e atualizações do sistema.
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (!notif.read) onMarkAsRead(notif.id);
                    }}
                    className={`p-3.5 transition-all cursor-pointer flex items-start gap-3 relative ${
                      notif.read ? 'bg-slate-900/60 hover:bg-slate-800/40 opacity-75' : 'bg-indigo-950/20 hover:bg-indigo-900/30'
                    }`}
                  >
                    {/* Unread indicator bar */}
                    {!notif.read && (
                      <span className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r" />
                    )}

                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                      {getNotificationIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-black text-white truncate">
                          {notif.title}
                        </h4>
                        <span className="text-[9.5px] text-slate-500 flex items-center gap-1 shrink-0 font-mono">
                          <Clock className="w-3 h-3 text-slate-600" />
                          {notif.timestamp}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-snug break-words">
                        {notif.message}
                      </p>

                      {notif.serviceOrderId && onSelectServiceOrder && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!notif.read) onMarkAsRead(notif.id);
                            onSelectServiceOrder(notif.serviceOrderId!);
                            setIsOpen(false);
                          }}
                          className="mt-2 text-[10.5px] font-extrabold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <span>Ver Ordem de Serviço #{notif.serviceOrderId}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Drawer Footer info */}
            <div className="p-2.5 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between font-mono">
              <span>🔊 Som de Alerta: {isMuted ? 'Mudo' : 'Ativo'}</span>
              <span>100% Compatível em iFrame</span>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
