import React from "react";
import { ServiceOrder } from "./types";

export function getPriorityBadge(priority?: 'low' | 'medium' | 'high' | 'urgent') {
  const prio = priority || 'medium';
  const config = {
    low: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', label: 'Baixa', dot: 'bg-emerald-500' },
    medium: { bg: 'bg-blue-50 text-blue-700 border-blue-100', label: 'Média', dot: 'bg-blue-500' },
    high: { bg: 'bg-amber-50 text-amber-700 border-amber-100', label: 'Alta', dot: 'bg-amber-500' },
    urgent: { bg: 'bg-red-50 text-red-700 border-red-100', label: 'Urgente', dot: 'bg-red-500' },
  };
  const active = config[prio] || config.medium;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8.5px] font-black border uppercase tracking-wider ${active.bg}`}>
      <span className={`w-1 h-1 rounded-full ${active.dot}`}></span>
      {active.label}
    </span>
  );
}

export function getBusinessDaysBetweenDates(startDateStr: string, endDate: Date = new Date()): number {
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return 0;
  
  let count = 0;
  const current = new Date(start);
  
  current.setHours(0, 0, 0, 0);
  const endCompare = new Date(endDate);
  endCompare.setHours(0, 0, 0, 0);

  if (current > endCompare) return 0;

  while (current < endCompare) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 is Sunday, 6 is Saturday
      count++;
    }
  }
  return count;
}

export function isDelayedOpen(os: ServiceOrder): boolean {
  if (os.status !== "aberto") return false;
  
  let lastUpdateStr = os.createdAt;
  if (os.history && os.history.length > 0) {
    const dates = os.history.map(h => new Date(h.date).getTime()).filter(t => !isNaN(t));
    if (dates.length > 0) {
      const maxTime = Math.max(...dates);
      lastUpdateStr = new Date(maxTime).toISOString();
    }
  }
  
  const businessDays = getBusinessDaysBetweenDates(lastUpdateStr);
  return businessDays > 5;
}
