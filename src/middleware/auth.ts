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

// Chave secreta para assinatura criptográfica de tokens de sessão emitidos pelo servidor
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "s1gestaopro-secure-server-signing-secret-key-36911121884";

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

  const b64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
  const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const data = `${b64Header}.${b64Payload}`;
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

/**
 * Valida a integridade, assinatura e validade temporal de um token de sessão emitido pelo servidor
 */
export function verifyServerSessionToken(token: string): AuthenticatedUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [b64Header, b64Payload, signature] = parts;
    const data = `${b64Header}.${b64Payload}`;
    const expectedSignature = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(b64Payload, "base64url").toString("utf-8"));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Token expirado
    }

    return {
      uid: payload.uid,
      email: payload.email,
      name: payload.name,
      document: payload.document,
      role: payload.role,
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
