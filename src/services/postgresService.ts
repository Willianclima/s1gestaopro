import { getApiAuthHeaders } from "./apiAuth.ts";
import type { Client, Professional, ServiceOrder, ServiceCategory, SystemLog, LoginAttempt, AccessProfile } from "../types.ts";

export async function fetchUsuarios(): Promise<Client[]> {
  const res = await fetch("/api/usuarios", {
    headers: getApiAuthHeaders(),
  });
  if (!res.ok) throw new Error("Erro ao buscar usuários no PostgreSQL");
  return res.json();
}

export async function fetchUsuarioById(id: string): Promise<Client> {
  const res = await fetch(`/api/usuarios/${encodeURIComponent(id)}`, {
    headers: getApiAuthHeaders(),
  });
  if (!res.ok) throw new Error("Erro ao buscar usuário por ID no PostgreSQL");
  return res.json();
}

export async function createUsuario(usuario: Partial<Client>) {
  const res = await fetch("/api/usuarios", {
    method: "POST",
    headers: getApiAuthHeaders(),
    body: JSON.stringify(usuario),
  });
  if (!res.ok) throw new Error("Erro ao criar usuário no PostgreSQL");
  return res.json();
}

export async function updateUsuario(id: string, usuario: Partial<Client>) {
  const res = await fetch(`/api/usuarios/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: getApiAuthHeaders(),
    body: JSON.stringify(usuario),
  });
  if (!res.ok) throw new Error("Erro ao atualizar usuário no PostgreSQL");
  return res.json();
}

export async function deleteUsuario(id: string) {
  const res = await fetch(`/api/usuarios/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getApiAuthHeaders(),
  });
  if (!res.ok) throw new Error("Erro ao remover usuário no PostgreSQL");
  return res.json();
}

export const fetchPostgresUsuarios = fetchUsuarios;
export const savePostgresUsuario = createUsuario;
export const fetchPostgresClients = fetchUsuarios;
export const savePostgresClient = createUsuario;

export async function fetchPostgresServiceOrders(): Promise<ServiceOrder[]> {
  const res = await fetch("/api/postgres/service-orders", {
    headers: getApiAuthHeaders(),
  });
  if (!res.ok) throw new Error("Erro ao buscar ordens de serviço no PostgreSQL");
  return res.json();
}

export async function savePostgresServiceOrder(order: ServiceOrder) {
  const res = await fetch("/api/postgres/service-orders", {
    method: "POST",
    headers: getApiAuthHeaders(),
    body: JSON.stringify(order),
  });
  if (!res.ok) throw new Error("Erro ao salvar ordem de serviço no PostgreSQL");
  return res.json();
}

export async function fetchPostgresSystemLogs(): Promise<SystemLog[]> {
  const res = await fetch("/api/postgres/system-logs", {
    headers: getApiAuthHeaders(),
  });
  if (!res.ok) throw new Error("Erro ao buscar logs no PostgreSQL");
  return res.json();
}

export async function savePostgresSystemLog(log: SystemLog) {
  const res = await fetch("/api/postgres/system-logs", {
    method: "POST",
    headers: getApiAuthHeaders(),
    body: JSON.stringify(log),
  });
  if (!res.ok) throw new Error("Erro ao gravar log no PostgreSQL");
  return res.json();
}

export async function fetchPostgresLoginAttempts(): Promise<LoginAttempt[]> {
  const res = await fetch("/api/postgres/login-attempts", {
    headers: getApiAuthHeaders(),
  });
  if (!res.ok) throw new Error("Erro ao buscar tentativas de login no PostgreSQL");
  return res.json();
}

export async function savePostgresLoginAttempt(attempt: LoginAttempt) {
  const res = await fetch("/api/postgres/login-attempts", {
    method: "POST",
    headers: getApiAuthHeaders(),
    body: JSON.stringify(attempt),
  });
  if (!res.ok) throw new Error("Erro ao registrar tentativa de login no PostgreSQL");
  return res.json();
}

export async function fetchPostgresAccessProfiles(): Promise<AccessProfile[]> {
  const res = await fetch("/api/postgres/access-profiles", {
    headers: getApiAuthHeaders(),
  });
  if (!res.ok) throw new Error("Erro ao buscar perfis de acesso no PostgreSQL");
  return res.json();
}

export async function savePostgresAccessProfile(profile: AccessProfile) {
  const res = await fetch("/api/postgres/access-profiles", {
    method: "POST",
    headers: getApiAuthHeaders(),
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error("Erro ao salvar perfil de acesso no PostgreSQL");
  return res.json();
}

export async function fetchPostgresProfessionals(): Promise<Professional[]> {
  const res = await fetch("/api/postgres/professionals", {
    headers: getApiAuthHeaders(),
  });
  if (!res.ok) throw new Error("Erro ao buscar profissionais no PostgreSQL");
  return res.json();
}

export async function savePostgresProfessional(prof: Professional) {
  const res = await fetch("/api/postgres/professionals", {
    method: "POST",
    headers: getApiAuthHeaders(),
    body: JSON.stringify(prof),
  });
  if (!res.ok) throw new Error("Erro ao salvar profissional no PostgreSQL");
  return res.json();
}

export async function fetchPostgresServiceCategories(): Promise<ServiceCategory[]> {
  const res = await fetch("/api/postgres/service-categories", {
    headers: getApiAuthHeaders(),
  });
  if (!res.ok) throw new Error("Erro ao buscar categorias de serviço no PostgreSQL");
  return res.json();
}

export async function savePostgresServiceCategory(cat: ServiceCategory) {
  const res = await fetch("/api/postgres/service-categories", {
    method: "POST",
    headers: getApiAuthHeaders(),
    body: JSON.stringify(cat),
  });
  if (!res.ok) throw new Error("Erro ao salvar categoria no PostgreSQL");
  return res.json();
}

export async function triggerFirestoreToPostgresMigration() {
  const res = await fetch("/api/postgres/migrate-from-firestore", {
    method: "POST",
    headers: getApiAuthHeaders(),
  });
  if (!res.ok) throw new Error("Erro ao acionar migração ETL do Firestore para o PostgreSQL");
  return res.json();
}
