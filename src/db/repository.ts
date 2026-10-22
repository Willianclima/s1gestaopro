import crypto from "crypto";
import { db } from "./index.ts";
import { users, usuarios, clients, professionals, serviceOrders, serviceCategories, systemLogs, loginAttempts, accessProfiles, revokedSessions, passwordResetTokens, type UserDb, type UsuarioDb } from "./schema.ts";
import { eq, desc, and, lt, gt, sql } from "drizzle-orm";
import type { Client, Professional, ServiceOrder, ServiceCategory, SystemLog, LoginAttempt, AccessProfile } from "../types.ts";

/**
 * ============================================================================
 * PADRÃO REPOSITORY DA CAMADA DE DADOS (src/db/repository.ts)
 * ============================================================================
 * Este arquivo encapsula todas as operações de persistência e consulta (CRUD)
 * no banco PostgreSQL utilizando o Drizzle ORM.
 *
 * Conceitos Aplicados:
 * - Abstração: A aplicação interage com funções simples de domínio (`getAllUsuarios`, `upsertServiceOrder`).
 * - Idiomas SQL do Drizzle:
 *   * db.select().from(tabela).where(eq(coluna, valor)): Consulta SQL SELECT com WHERE
 *   * db.insert(tabela).values(...).onConflictDoUpdate(...): UPSERT (Insert or Update)
 *   * db.delete(tabela).where(...): Remoção segura DELETE
 *   * .orderBy(desc(coluna)): Ordenação decrescente
 */

// Helper: Users

export async function getUserByUid(uid: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid));
    if (rows.length === 0) return null;
    const u = rows[0];
    const extraData = (u.data as Record<string, any>) || {};
    return {
      uid: u.uid,
      email: u.email,
      name: u.name || "",
      document: u.document || "",
      userType: (u.userType || "requisitante") as any,
      status: u.status || "ativo",
      warehouseId: u.warehouseId || undefined,
      workLocation: u.workLocation || undefined,
      googleUid: u.googleUid || undefined,
      photoURL: extraData.photoURL || undefined,
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
      ...extraData,
    };
  } catch (error) {
    console.error("Database error in getUserByUid:", error);
    return null;
  }
}

export async function upsertUser(userData: {
  uid: string;
  email: string;
  name?: string;
  document?: string;
  userType?: string;
  status?: string;
  warehouseId?: string;
  workLocation?: string;
  googleUid?: string;
  photoURL?: string;
  [key: string]: any;
}) {
  try {
    const { uid, email, name, document, userType, status, warehouseId, workLocation, googleUid, photoURL, ...extra } = userData;
    const dataJson = { ...(photoURL ? { photoURL } : {}), ...extra };

    const result = await db.insert(users)
      .values({
        uid,
        email: email || "",
        name: name || "",
        document: document || "",
        userType: userType || "requisitante",
        status: status || "ativo",
        warehouseId: warehouseId || null,
        workLocation: workLocation || null,
        googleUid: googleUid || null,
        data: dataJson,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: email || "",
          ...(name !== undefined ? { name } : {}),
          ...(document !== undefined ? { document } : {}),
          ...(userType !== undefined ? { userType } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(warehouseId !== undefined ? { warehouseId } : {}),
          ...(workLocation !== undefined ? { workLocation } : {}),
          ...(googleUid !== undefined ? { googleUid } : {}),
          data: dataJson,
        },
      })
      .returning();

    const u = result[0];
    const extraData = (u.data as Record<string, any>) || {};
    return {
      uid: u.uid,
      email: u.email,
      name: u.name || "",
      document: u.document || "",
      userType: u.userType as any,
      status: u.status || "ativo",
      warehouseId: u.warehouseId || undefined,
      workLocation: u.workLocation || undefined,
      googleUid: u.googleUid || undefined,
      photoURL: extraData.photoURL || undefined,
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
      ...extraData,
    };
  } catch (error) {
    console.error("Database error in upsertUser:", error);
    throw new Error("Erro ao salvar usuário no PostgreSQL.", { cause: error });
  }
}

export async function getOrCreateUser(uid: string, email: string, name?: string, document?: string, userType?: string) {
  return upsertUser({ uid, email, name, document, userType });
}

export async function deleteUser(uid: string): Promise<boolean> {
  try {
    const result = await db.delete(users).where(eq(users.uid, uid)).returning();
    return result.length > 0;
  } catch (error) {
    console.error("Database error in deleteUser:", error);
    return false;
  }
}

// Helper: Usuarios (Antigo Clients)
export async function getAllUsuarios(): Promise<Client[]> {
  try {
    const rows = await db.select().from(usuarios);
    return rows.map((r) => {
      const extraData = (r.data as Record<string, any>) || {};
      const { password, senha, ...safeExtra } = extraData;
      return {
        id: r.id,
        name: r.name,
        document: r.document || "",
        phone: r.phone || "",
        email: r.email || "",
        address: r.address || "",
        lat: r.lat ?? safeExtra.lat ?? undefined,
        lng: r.lng ?? safeExtra.lng ?? undefined,
        formattedAddress: r.formattedAddress || safeExtra.formattedAddress || undefined,
        isAddressValidated: r.isAddressValidated ?? safeExtra.isAddressValidated ?? false,
        notes: r.notes || safeExtra.notes || "",
        status: (r.status || safeExtra.status || "ativo") as any,
        userType: (r.userType || safeExtra.userType || "requisitante") as any,
        createdAt: (safeExtra.createdAt || (r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString())),
        ...safeExtra,
      };
    });
  } catch (error) {
    console.error("Database error in getAllUsuarios:", error);
    throw new Error("Erro ao buscar usuários no PostgreSQL.", { cause: error });
  }
}

export async function upsertUsuario(usuario: Client) {
  try {
    const { id, name, document, phone, email, address, status, userType, lat, lng, formattedAddress, isAddressValidated, notes, password, senha, ...extraData } = usuario as any;
    const finalStatus = status || "ativo";
    const finalUserType = userType || "requisitante";

    const result = await db.insert(usuarios)
      .values({
        id,
        name,
        document: document || "",
        phone: phone || "",
        email: email || "",
        address: address || "",
        lat: lat ?? null,
        lng: lng ?? null,
        formattedAddress: formattedAddress ?? null,
        isAddressValidated: isAddressValidated ?? false,
        notes: notes || "",
        status: finalStatus,
        userType: finalUserType,
        data: {
          ...extraData,
          status: finalStatus,
          userType: finalUserType
        },
      })
      .onConflictDoUpdate({
        target: usuarios.id,
        set: {
          name,
          document: document || "",
          phone: phone || "",
          email: email || "",
          address: address || "",
          lat: lat ?? null,
          lng: lng ?? null,
          formattedAddress: formattedAddress ?? null,
          isAddressValidated: isAddressValidated ?? false,
          notes: notes || "",
          status: finalStatus,
          userType: finalUserType,
          data: {
            ...extraData,
            status: finalStatus,
            userType: finalUserType
          },
        },
      })
      .returning();

    const r = result[0];
    const rExtra = (r.data as Record<string, any>) || {};
    return {
      id: r.id,
      name: r.name,
      document: r.document || "",
      phone: r.phone || "",
      email: r.email || "",
      address: r.address || "",
      lat: r.lat ?? rExtra.lat ?? undefined,
      lng: r.lng ?? rExtra.lng ?? undefined,
      formattedAddress: r.formattedAddress || rExtra.formattedAddress || undefined,
      isAddressValidated: r.isAddressValidated ?? rExtra.isAddressValidated ?? false,
      status: (r.status || rExtra.status || finalStatus) as any,
      userType: (r.userType || rExtra.userType || finalUserType) as any,
      notes: r.notes || rExtra.notes || "",
      createdAt: (rExtra.createdAt || (r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString())),
      ...rExtra,
    };
  } catch (error) {
    console.error("Database error in upsertUsuario:", error);
    throw new Error("Erro ao salvar usuário no PostgreSQL.", { cause: error });
  }
}

export async function getUsuarioById(id: string): Promise<Client | null> {
  try {
    const rows = await db.select().from(usuarios).where(eq(usuarios.id, id));
    if (!rows.length) return null;
    const r = rows[0];
    const extraData = (r.data as Record<string, any>) || {};
    const { password, senha, ...safeExtra } = extraData;
    return {
      id: r.id,
      name: r.name,
      document: r.document || "",
      phone: r.phone || "",
      email: r.email || "",
      address: r.address || "",
      lat: r.lat ?? safeExtra.lat ?? undefined,
      lng: r.lng ?? safeExtra.lng ?? undefined,
      formattedAddress: r.formattedAddress || safeExtra.formattedAddress || undefined,
      isAddressValidated: r.isAddressValidated ?? safeExtra.isAddressValidated ?? false,
      notes: r.notes || safeExtra.notes || "",
      status: (r.status || safeExtra.status || "ativo") as any,
      userType: (r.userType || safeExtra.userType || "requisitante") as any,
      createdAt: (safeExtra.createdAt || (r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString())),
      ...safeExtra,
    };
  } catch (error) {
    console.error("Database error in getUsuarioById:", error);
    throw new Error("Erro ao buscar usuário por ID no PostgreSQL.", { cause: error });
  }
}

export async function countServiceOrdersByClientId(clientId: string): Promise<number> {
  try {
    const rows = await db.select().from(serviceOrders).where(eq(serviceOrders.clientId, clientId));
    return rows.length;
  } catch (error) {
    console.error("Database error in countServiceOrdersByClientId:", error);
    return 0;
  }
}

export async function deleteUsuario(id: string): Promise<boolean> {
  try {
    const result = await db.delete(usuarios).where(eq(usuarios.id, id)).returning();
    return result.length > 0;
  } catch (error) {
    console.error("Database error in deleteUsuario:", error);
    throw new Error("Erro ao remover usuário no PostgreSQL.", { cause: error });
  }
}

// Aliases para compatibilidade
export const getAllClients = getAllUsuarios;
export const upsertClient = upsertUsuario;
export const getClientById = getUsuarioById;
export const deleteClient = deleteUsuario;

// Helper: Service Orders
export async function getAllServiceOrders(): Promise<ServiceOrder[]> {
  try {
    const rows = await db.select().from(serviceOrders);
    return rows.map((r) => ({
      id: r.id,
      clientId: r.clientId || "",
      title: r.title,
      description: r.description || "",
      category: r.category || "Geral",
      status: (r.status as any) || "aberto",
      priority: (r.priority as any) || "medium",
      assignedTo: r.assignedTo || "",
      startDate: r.startDate || "",
      endDate: r.endDate || "",
      history: (r.history as any) || [],
      notes: (r.data as any)?.notes || "",
      createdAt: (r.data as any)?.createdAt || r.createdAt?.toISOString() || new Date().toISOString(),
      ...(r.data as any || {}),
    }));
  } catch (error) {
    console.error("Database error in getAllServiceOrders:", error);
    throw new Error("Erro ao buscar ordens de serviço no PostgreSQL.", { cause: error });
  }
}

export async function upsertServiceOrder(order: ServiceOrder) {
  try {
    const { id, clientId, title, description, category, status, priority, assignedTo, startDate, endDate, history, ...extraData } = order;
    const result = await db.insert(serviceOrders)
      .values({
        id,
        clientId: clientId || "",
        title,
        description: description || "",
        category: category || "Geral",
        status: status || "aberto",
        priority: priority || "medium",
        assignedTo: assignedTo || "",
        startDate: startDate || "",
        endDate: endDate || "",
        history: history || [],
        data: extraData,
      })
      .onConflictDoUpdate({
        target: serviceOrders.id,
        set: {
          clientId: clientId || "",
          title,
          description: description || "",
          category: category || "Geral",
          status: status || "aberto",
          priority: priority || "medium",
          assignedTo: assignedTo || "",
          startDate: startDate || "",
          endDate: endDate || "",
          history: history || [],
          data: extraData,
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error("Database error in upsertServiceOrder:", error);
    throw new Error("Erro ao salvar ordem de serviço no PostgreSQL.", { cause: error });
  }
}

export async function deleteServiceOrder(id: string): Promise<boolean> {
  try {
    const result = await db.delete(serviceOrders).where(eq(serviceOrders.id, id)).returning();
    return result.length > 0;
  } catch (error) {
    console.error("Database error in deleteServiceOrder:", error);
    return false;
  }
}

// Helper: System Logs
export async function getAllSystemLogs(): Promise<SystemLog[]> {
  try {
    const rows = await db.select().from(systemLogs).orderBy(desc(systemLogs.createdAt));
    return rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      action: r.action,
      details: r.details || "",
      category: r.category as any,
    }));
  } catch (error) {
    console.error("Database error in getAllSystemLogs:", error);
    throw new Error("Erro ao buscar logs do sistema no PostgreSQL.", { cause: error });
  }
}

export async function insertSystemLog(log: SystemLog) {
  try {
    const result = await db.insert(systemLogs)
      .values({
        id: log.id || `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: log.timestamp || new Date().toISOString(),
        action: log.action,
        details: log.details || "",
        category: log.category || "sistema",
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error("Database error in insertSystemLog:", error);
    throw new Error("Erro ao inserir log do sistema no PostgreSQL.", { cause: error });
  }
}

// Helper: Login Attempts
export async function getAllLoginAttempts(): Promise<LoginAttempt[]> {
  try {
    const rows = await db.select().from(loginAttempts).orderBy(desc(loginAttempts.createdAt));
    return rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      username: r.username,
      userId: r.userId || "Desconhecido",
      status: r.status as any,
      userType: r.userType || "desconhecido",
      details: r.details || "",
    }));
  } catch (error) {
    console.error("Database error in getAllLoginAttempts:", error);
    throw new Error("Erro ao buscar tentativas de login no PostgreSQL.", { cause: error });
  }
}

export async function insertLoginAttempt(attempt: LoginAttempt) {
  try {
    const result = await db.insert(loginAttempts)
      .values({
        id: attempt.id || `ATT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: attempt.timestamp || new Date().toISOString(),
        username: attempt.username || "Desconhecido",
        userId: attempt.userId || "Desconhecido",
        status: attempt.status || "failed",
        userType: attempt.userType || "desconhecido",
        details: attempt.details || "",
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error("Database error in insertLoginAttempt:", error);
    throw new Error("Erro ao registrar tentativa de login no PostgreSQL.", { cause: error });
  }
}

// Helper: Access Profiles
export async function getAllAccessProfiles(): Promise<AccessProfile[]> {
  try {
    const rows = await db.select().from(accessProfiles);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description || "",
      permissions: (r.permissions as any) || {},
      createdAt: r.createdAt?.toISOString(),
    }));
  } catch (error) {
    console.error("Database error in getAllAccessProfiles:", error);
    throw new Error("Erro ao buscar perfis de acesso no PostgreSQL.", { cause: error });
  }
}

export async function upsertAccessProfile(profile: AccessProfile) {
  try {
    const result = await db.insert(accessProfiles)
      .values({
        id: profile.id,
        name: profile.name,
        description: profile.description || "",
        permissions: profile.permissions || {},
      })
      .onConflictDoUpdate({
        target: accessProfiles.id,
        set: {
          name: profile.name,
          description: profile.description || "",
          permissions: profile.permissions || {},
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error("Database error in upsertAccessProfile:", error);
    throw new Error("Erro ao salvar perfil de acesso no PostgreSQL.", { cause: error });
  }
}

// Helper: Professionals
export async function getAllProfessionals(): Promise<Professional[]> {
  try {
    const rows = await db.select().from(professionals);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      document: r.document || "",
      email: r.email || "",
      role: r.role || "",
      specialty: r.specialty || "",
      specialties: (r.specialties as any) || [],
      userType: (r.userType as any) || "profissional",
      failedAttempts: r.failedAttempts || 0,
      blocked: r.blocked || false,
      workLocation: r.workLocation || "",
      googleUid: r.googleUid || "",
      ...(r.data as any || {}),
    }));
  } catch (error) {
    console.error("Database error in getAllProfessionals:", error);
    throw new Error("Erro ao buscar profissionais no PostgreSQL.", { cause: error });
  }
}

export async function upsertProfessional(prof: Professional) {
  try {
    const { id, name, document, email, role, specialty, specialties, userType, failedAttempts, blocked, workLocation, googleUid, ...extraData } = prof;
    const result = await db.insert(professionals)
      .values({
        id,
        name,
        document: document || "",
        email: email || "",
        role: role || "",
        specialty: specialty || "",
        specialties: specialties || [],
        userType: userType || "profissional",
        failedAttempts: failedAttempts || 0,
        blocked: blocked || false,
        workLocation: workLocation || "",
        googleUid: googleUid || "",
        data: extraData,
      })
      .onConflictDoUpdate({
        target: professionals.id,
        set: {
          name,
          document: document || "",
          email: email || "",
          role: role || "",
          specialty: specialty || "",
          specialties: specialties || [],
          userType: userType || "profissional",
          failedAttempts: failedAttempts || 0,
          blocked: blocked || false,
          workLocation: workLocation || "",
          googleUid: googleUid || "",
          data: extraData,
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error("Database error in upsertProfessional:", error);
    throw new Error("Erro ao salvar profissional no PostgreSQL.", { cause: error });
  }
}

// Helper: Service Categories
export async function getAllServiceCategories(): Promise<ServiceCategory[]> {
  try {
    const rows = await db.select().from(serviceCategories);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color || "#3b82f6",
      slaHours: r.slaHours || 24,
      reminderIntervalHours: r.reminderIntervalHours || 4,
      reminderEnabled: r.reminderEnabled ?? true,
      notifyGestor: r.notifyGestor ?? true,
      notifyTechnician: r.notifyTechnician ?? true,
    }));
  } catch (error) {
    console.error("Database error in getAllServiceCategories:", error);
    throw new Error("Erro ao buscar categorias de serviço no PostgreSQL.", { cause: error });
  }
}

export async function upsertServiceCategory(cat: ServiceCategory) {
  try {
    const result = await db.insert(serviceCategories)
      .values({
        id: cat.id,
        name: cat.name,
        color: cat.color || "#3b82f6",
        slaHours: cat.slaHours || 24,
        reminderIntervalHours: cat.reminderIntervalHours || 4,
        reminderEnabled: cat.reminderEnabled ?? true,
        notifyGestor: cat.notifyGestor ?? true,
        notifyTechnician: cat.notifyTechnician ?? true,
      })
      .onConflictDoUpdate({
        target: serviceCategories.id,
        set: {
          name: cat.name,
          color: cat.color || "#3b82f6",
          slaHours: cat.slaHours || 24,
          reminderIntervalHours: cat.reminderIntervalHours || 4,
          reminderEnabled: cat.reminderEnabled ?? true,
          notifyGestor: cat.notifyGestor ?? true,
          notifyTechnician: cat.notifyTechnician ?? true,
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error("Database error in upsertServiceCategory:", error);
    throw new Error("Erro ao salvar categoria no PostgreSQL.", { cause: error });
  }
}

export async function getServiceCategoryById(id: string): Promise<ServiceCategory | null> {
  try {
    const rows = await db.select().from(serviceCategories).where(eq(serviceCategories.id, id));
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      color: r.color || "#3b82f6",
      slaHours: r.slaHours || 24,
      reminderIntervalHours: r.reminderIntervalHours || 4,
      reminderEnabled: r.reminderEnabled ?? true,
      notifyGestor: r.notifyGestor ?? true,
      notifyTechnician: r.notifyTechnician ?? true,
    };
  } catch (error) {
    console.error("Database error in getServiceCategoryById:", error);
    return null;
  }
}

export async function countServiceOrdersByCategory(categoryName: string): Promise<number> {
  try {
    const rows = await db.select().from(serviceOrders).where(eq(serviceOrders.category, categoryName));
    return rows.length;
  } catch (error) {
    console.error("Database error in countServiceOrdersByCategory:", error);
    return 0;
  }
}

export async function deleteServiceCategory(id: string): Promise<boolean> {
  try {
    const result = await db.delete(serviceCategories).where(eq(serviceCategories.id, id)).returning();
    return result.length > 0;
  } catch (error) {
    console.error("Database error in deleteServiceCategory:", error);
    throw new Error("Erro ao remover categoria no PostgreSQL.", { cause: error });
  }
}

// ============================================================================
// Persistência de Revogações de Sessão no PostgreSQL (Sobrevive a reinício)
// ============================================================================

export async function recordRevocationInDb(
  type: "jti" | "token_sig" | "user_all",
  identifier: string,
  expiresAt?: Date | null
): Promise<boolean> {
  try {
    await db.insert(revokedSessions).values({
      type,
      identifier,
      revokedAt: new Date(),
      expiresAt: expiresAt || null
    });
    return true;
  } catch (err) {
    console.error("Database error in recordRevocationInDb:", err);
    return false;
  }
}

export async function isSessionRevokedInDb(
  type: "jti" | "token_sig" | "user_all",
  identifier: string,
  issuedAtSeconds?: number
): Promise<boolean> {
  try {
    if (type === "user_all") {
      const rows = await db.select().from(revokedSessions).where(
        and(eq(revokedSessions.type, "user_all"), eq(revokedSessions.identifier, identifier))
      );
      if (rows.length === 0) return false;
      if (issuedAtSeconds === undefined) return true;
      return rows.some(r => {
        const revSeconds = Math.floor(new Date(r.revokedAt).getTime() / 1000);
        return issuedAtSeconds <= revSeconds;
      });
    }

    const rows = await db.select().from(revokedSessions).where(
      and(eq(revokedSessions.type, type), eq(revokedSessions.identifier, identifier))
    );
    return rows.length > 0;
  } catch (err) {
    console.error("Database error in isSessionRevokedInDb:", err);
    throw new Error("Falha ao consultar revogações no PostgreSQL.", { cause: err });
  }
}

export async function pruneExpiredRevocations(): Promise<number> {
  try {
    const now = new Date();
    const result = await db.delete(revokedSessions).where(
      and(sql`${revokedSessions.expiresAt} IS NOT NULL`, lt(revokedSessions.expiresAt, now))
    ).returning();
    return result.length;
  } catch (err) {
    console.error("Database error in pruneExpiredRevocations:", err);
    return 0;
  }
}

// ============================================================================
// Gerenciamento Seguro de Credenciais e Hashes (Argon2id)
// ============================================================================

export async function setUserPasswordHash(uid: string, passwordHash: string): Promise<boolean> {
  try {
    const result = await db.update(users).set({
      passwordHash,
      forcePasswordChange: false
    }).where(eq(users.uid, uid)).returning();
    return result.length > 0;
  } catch (err) {
    console.error("Database error in setUserPasswordHash:", err);
    return false;
  }
}

export async function getUserAuthByDocument(document: string): Promise<{
  uid: string;
  passwordHash: string | null;
  role: string;
  name: string;
  email: string;
  status: string;
  forcePasswordChange: boolean;
} | null> {
  try {
    const normalizedDoc = document.replace(/\D/g, "");
    if (!normalizedDoc) return null;
    const rows = await db.select().from(users);
    const matched = rows.find(u => (u.document || "").replace(/\D/g, "") === normalizedDoc);
    if (!matched) return null;
    return {
      uid: matched.uid,
      passwordHash: matched.passwordHash || null,
      role: matched.userType || "requisitante",
      name: matched.name || "",
      email: matched.email || "",
      status: matched.status || "ativo",
      forcePasswordChange: matched.forcePasswordChange ?? false
    };
  } catch (err) {
    console.error("Database error in getUserAuthByDocument:", err);
    return null;
  }
}

// ============================================================================
// Gerenciamento de Tokens de Ativação e Redefinição de Senha
// ============================================================================

export async function createPasswordResetToken(
  userId: string,
  document?: string,
  purpose: "activation" | "password_reset" = "activation",
  expiresInMinutes = 15
): Promise<{ rawToken: string; tokenHash: string; expiresAt: Date }> {
  try {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await db.insert(passwordResetTokens).values({
      tokenHash,
      userId,
      document: document || null,
      purpose,
      expiresAt,
      usedAt: null
    });

    return { rawToken, tokenHash, expiresAt };
  } catch (err) {
    console.error("Database error in createPasswordResetToken:", err);
    throw new Error("Falha ao gerar token de ativação no PostgreSQL.", { cause: err });
  }
}

export async function verifyAndConsumePasswordResetToken(
  rawToken: string
): Promise<{ valid: boolean; userId?: string; document?: string; error?: string }> {
  try {
    if (!rawToken || typeof rawToken !== "string" || rawToken.length !== 64) {
      return { valid: false, error: "Formato de token inválido." };
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const rows = await db.select().from(passwordResetTokens).where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        sql`${passwordResetTokens.usedAt} IS NULL`,
        gt(passwordResetTokens.expiresAt, new Date())
      )
    );

    if (rows.length === 0) {
      return { valid: false, error: "Token de ativação/redefinição inválido, expirado ou já utilizado." };
    }

    const target = rows[0];
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, target.id));

    return { valid: true, userId: target.userId, document: target.document || undefined };
  } catch (err) {
    console.error("Database error in verifyAndConsumePasswordResetToken:", err);
    return { valid: false, error: "Erro de banco de dados ao verificar token." };
  }
}

// ============================================================================
// Provisionamento e Verificação de Ambiguidade de Cadastros
// ============================================================================

export async function findUsuariosByDocumentOrEmail(
  document?: string,
  email?: string
): Promise<UsuarioDb[]> {
  try {
    const normalizedDoc = document ? document.replace(/\D/g, "") : null;
    const normalizedEmail = email ? email.trim().toLowerCase() : null;

    const all = await db.select().from(usuarios);
    return all.filter(u => {
      const uDoc = (u.document || "").replace(/\D/g, "");
      const uEmail = (u.email || "").trim().toLowerCase();
      if (normalizedDoc && uDoc && uDoc === normalizedDoc) return true;
      if (normalizedEmail && uEmail && uEmail === normalizedEmail) return true;
      return false;
    });
  } catch (err) {
    console.error("Database error in findUsuariosByDocumentOrEmail:", err);
    return [];
  }
}

export async function createUserAccount(data: {
  uid: string;
  email: string;
  name: string;
  document?: string;
  userType: string;
  status: string;
  passwordHash?: string;
}): Promise<UserDb> {
  const result = await db.insert(users).values({
    uid: data.uid,
    email: data.email,
    name: data.name,
    document: data.document || null,
    userType: data.userType,
    status: data.status,
    passwordHash: data.passwordHash || null,
    forcePasswordChange: false
  }).returning();
  return result[0];
}


