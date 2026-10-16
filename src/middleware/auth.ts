import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { adminAuth } from "../lib/firebase-admin.ts";
import { getUserByUid } from "../db/repository.ts";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
  document?: string;
  role: "admin" | "gestor" | "gestor_servicos" | "profissional" | "requisitante" | string;
  authType: "firebase" | "server_session";
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export const VALID_ROLES = ["admin", "gestor", "gestor_servicos", "profissional", "requisitante"] as const;
export type ValidRole = typeof VALID_ROLES[number];

declare global {
  // eslint-disable-next-line no-var
  var __ephemeralDevSessionSecret: string | undefined;
}

// Armazenamento em memória para revogação imediata de sessões e tokens
const revokedUidsBeforeTimestamp = new Map<string, number>();
const revokedTokenSignatures = new Set<string>();

/**
 * Revoga todas as sessões ativas de um usuário emitidas antes do momento da revogação.
 */
export function revokeUserSessions(uid: string): void {
  revokedUidsBeforeTimestamp.set(uid, Math.floor(Date.now() / 1000));
}

/**
 * Revoga um token de sessão individual via assinatura criptográfica.
 */
export function revokeSessionToken(token: string): void {
  const parts = token.split(".");
  if (parts.length === 3) {
    revokedTokenSignatures.add(parts[2]);
  }
}

/**
 * Limpa o registro de revogações (usado exclusivamente em ambiente isolado de testes).
 */
export function resetRevocationStore(): void {
  revokedUidsBeforeTimestamp.clear();
  revokedTokenSignatures.clear();
}

/**
 * Obtém a chave secreta para assinatura criptográfica de tokens de sessão.
 * NUNCA utiliza chaves padrão estáticas hardcoded no código.
 * Exige SESSION_SECRET do ambiente com no mínimo 32 bytes de entropia (32 caracteres).
 * Em ambiente de produção, falha fatalmente se ausente ou insuficiente.
 * Em desenvolvimento/testes sem variável configurada, gera uma chave volátil
 * em memória (512 bits / 64 bytes) exclusiva para a instância em execução.
 */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.trim().length >= 32) {
    return secret.trim();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[FATAL SECURITY ERROR] SESSION_SECRET não configurado ou com entropia insuficiente em produção (mínimo exigido: 32 caracteres / 256 bits). Configure uma chave forte via variável de ambiente SESSION_SECRET."
    );
  }

  if (!globalThis.__ephemeralDevSessionSecret) {
    console.warn(
      "⚠️ [SEGURANÇA] SESSION_SECRET não fornecido no ambiente. Gerando chave volátil forte em memória (512 bits) para esta instância."
    );
    globalThis.__ephemeralDevSessionSecret = crypto.randomBytes(64).toString("hex");
  }

  return globalThis.__ephemeralDevSessionSecret;
}

/**
 * Emite um token de sessão assinado pelo servidor (HMAC-SHA256) com tempo de expiração
 */
export function signServerSessionToken(
  payload: { uid: string; email?: string; role: string; name?: string; document?: string },
  expiresInSeconds = 86400 // 24 horas padrão
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
    iss: "s1gestaopro-backend"
  };

  const secret = getSessionSecret();
  const b64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
  const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const data = `${b64Header}.${b64Payload}`;
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

/**
 * Valida a integridade, assinatura, emissor, expiração e integridade temporal de um token de sessão.
 * Rejeita categoricamente:
 * - Tokens sem assinatura ou com assinatura inválida (timing-safe check)
 * - Headers com alg diferente de HS256 ou typ diferente de JWT
 * - Tokens sem campo exp ou com exp expirado
 * - Tokens sem campo iss ou com emissor diferente de 's1gestaopro-backend'
 * - Tokens sem campo uid válido ou com perfil (role) fora da matriz permitida
 * - Tokens expressamente revogados
 */
export function verifyServerSessionToken(token: string): AuthenticatedUser | null {
  try {
    if (!token || typeof token !== "string" || !token.includes(".")) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [b64Header, b64Payload, signature] = parts;
    if (!b64Header || !b64Payload || !signature) return null;

    // 1. Verificação de integridade da assinatura criptográfica HMAC-SHA256 em tempo constante
    const data = `${b64Header}.${b64Payload}`;
    const secret = getSessionSecret();
    const expectedSignature = crypto.createHmac("sha256", secret).update(data).digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    // 2. Validação estrutural do cabeçalho JWT
    const headerStr = Buffer.from(b64Header, "base64url").toString("utf-8");
    const header = JSON.parse(headerStr);
    if (!header || typeof header !== "object" || header.alg !== "HS256" || header.typ !== "JWT") {
      return null;
    }

    // 3. Validação rigorosa dos campos do Payload
    const payloadStr = Buffer.from(b64Payload, "base64url").toString("utf-8");
    const payload = JSON.parse(payloadStr);
    if (!payload || typeof payload !== "object") return null;

    // 3.1 Emissor (iss) obrigatório e restrito
    if (payload.iss !== "s1gestaopro-backend") {
      return null;
    }

    // 3.2 Expiração (exp) obrigatória e temporalmente válida
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp <= now) {
      return null; // Ausente, não numérico ou expirado
    }

    // 3.3 iat obrigatório e coerente
    if (typeof payload.iat !== "number" || !Number.isFinite(payload.iat) || payload.iat > now + 300) {
      return null;
    }

    // 3.4 Identidade (uid) obrigatória
    if (typeof payload.uid !== "string" || payload.uid.trim() === "") {
      return null;
    }

    // 3.5 Papel (role) obrigatório e validado contra matriz
    if (typeof payload.role !== "string" || !VALID_ROLES.includes(payload.role as ValidRole)) {
      return null;
    }

    // 3.6 Checagem de revogação de sessão
    if (revokedTokenSignatures.has(signature)) {
      return null;
    }
    const userRevokedAt = revokedUidsBeforeTimestamp.get(payload.uid);
    if (userRevokedAt !== undefined && payload.iat <= userRevokedAt) {
      return null;
    }

    return {
      uid: payload.uid.trim(),
      email: typeof payload.email === "string" ? payload.email.trim() : undefined,
      name: typeof payload.name === "string" ? payload.name.trim() : undefined,
      document: typeof payload.document === "string" ? payload.document.trim() : undefined,
      role: payload.role as ValidRole,
      authType: "server_session"
    };
  } catch {
    return null;
  }
}

/**
 * Middleware central de Autenticação Obrigatória:
 * 1. Exige cabeçalho 'Authorization: Bearer <token>'
 * 2. Valida o token real (Firebase ID Token via adminAuth ou Sessão Assinada do Servidor)
 * 3. Resolve o papel (Role) do usuário a partir de fonte confiável no servidor (DB/Admin Master)
 * 4. NUNCA aceita cabeçalhos do cliente como prova de identidade (X-App-Auth, X-User-Role ignorados)
 */
export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Não autorizado: Token de autenticação Bearer ausente ou malformatado."
    });
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return res.status(401).json({
      error: "Não autorizado: Token de autenticação vazio."
    });
  }

  // 1. Tenta verificar como token de sessão emitido pelo servidor
  const serverUser = verifyServerSessionToken(token);
  if (serverUser) {
    // Para contas vinculadas a usuários do banco, valida status e sincroniza permissão atual
    if (serverUser.uid !== "gestor-admin") {
      try {
        const dbProfile = await getUserByUid(serverUser.uid);
        if (dbProfile) {
          if (dbProfile.status === "bloqueado") {
            return res.status(403).json({
              error: "Acesso bloqueado: Esta conta está inativa ou suspensa pela administração."
            });
          }
          if (dbProfile.userType) {
            serverUser.role = dbProfile.userType as ValidRole;
          }
        }
      } catch {
        // Falha segura
      }
    }
    req.user = serverUser;
    return next();
  }

  // 2. Tenta verificar como Firebase ID Token
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Resolução segura de papel no servidor
    let role: string = "requisitante"; // Fallback seguro de menor privilégio
    let userDoc: string | undefined = undefined;
    let userName: string | undefined = (decodedToken as any).name;

    // Administrador mestre configurado no sistema
    if (decodedToken.email && decodedToken.email.toLowerCase() === "willianclima@gmail.com") {
      role = "admin";
    } else {
      try {
        const dbProfile = await getUserByUid(decodedToken.uid);
        if (dbProfile) {
          if (dbProfile.status === "bloqueado") {
            return res.status(403).json({
              error: "Acesso bloqueado: Esta conta está inativa ou suspensa pela administração."
            });
          }
          role = dbProfile.userType || "requisitante";
          userDoc = dbProfile.document || undefined;
          userName = dbProfile.name || userName;
        }
      } catch (dbErr) {
        // Falha segura sem expor erro interno
        console.warn("[Auth] Não foi possível consultar perfil no banco. Atribuindo papel padrão.");
      }
    }

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: userName,
      document: userDoc,
      role: role,
      authType: "firebase"
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      error: "Não autorizado: Token de autenticação inválido, corrompido ou expirado."
    });
  }
};

/**
 * Middleware para rotas que permitem acesso público mas identificam o usuário caso um token seja fornecido.
 * Usado na rota de cadastro público para diferenciar auto-cadastro de cadastro realizado por gestor/admin.
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = undefined;
    return next();
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    req.user = undefined;
    return next();
  }

  // 1. Tenta sessão de servidor
  const serverUser = verifyServerSessionToken(token);
  if (serverUser) {
    if (serverUser.uid !== "gestor-admin") {
      try {
        const dbProfile = await getUserByUid(serverUser.uid);
        if (dbProfile) {
          if (dbProfile.status === "bloqueado") {
            req.user = undefined;
            return next();
          }
          if (dbProfile.userType) {
            serverUser.role = dbProfile.userType as ValidRole;
          }
        }
      } catch {
        // Ignora erro em optionalAuth
      }
    }
    req.user = serverUser;
    return next();
  }

  // 2. Tenta Firebase ID Token
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    let role = "requisitante";
    if (decodedToken.email && decodedToken.email.toLowerCase() === "willianclima@gmail.com") {
      role = "admin";
    } else {
      try {
        const dbProfile = await getUserByUid(decodedToken.uid);
        if (dbProfile) {
          role = dbProfile.userType || "requisitante";
        }
      } catch (_) {}
    }
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: (decodedToken as any).name,
      role: role,
      authType: "firebase"
    };
  } catch (_) {
    req.user = undefined;
  }

  return next();
};

/**
 * Middleware de Autorização Baseada em Papéis (RBAC):
 * Exige que o usuário autenticado possua um dos papéis autorizados.
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Não autorizado: Usuário não autenticado."
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Acesso negado: Operação restrita aos perfis [${allowedRoles.join(", ")}]. Seu perfil atual é '${req.user.role}'.`
      });
    }

    next();
  };
};

/**
 * Atalhos de autorização por papel
 */
export const requireAdmin = requireRole("admin");
export const requireGestorOrAdmin = requireRole("admin", "gestor", "gestor_servicos");
export const requireTechnicianOrHigher = requireRole("admin", "gestor", "gestor_servicos", "profissional");
