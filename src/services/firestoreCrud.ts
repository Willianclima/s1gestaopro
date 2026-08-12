import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  getDocFromServer,
  Unsubscribe 
} from 'firebase/firestore';
import { db, auth } from './firebaseAuth';
import type { 
  UserDb, 
  NewUserDb, 
  UsuarioDb, 
  NewUsuarioDb, 
  ProfessionalDb, 
  NewProfessionalDb, 
  ServiceOrderDb, 
  NewServiceOrderDb, 
  ServiceCategoryDb, 
  NewServiceCategoryDb, 
  SystemLogDb, 
  NewSystemLogDb 
} from '../db/schema';

/**
 * Tipos de operação para tratamento padronizado de exceções no Firestore
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

/**
 * Estrutura de diagnósticos para capturar erros de permissão ou rede no Firestore
 */
export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

/**
 * Trata e re-lança erros do Firestore no formato padronizado JSON exigido para rastreabilidade
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('[Firestore Error]:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Valida a conectividade inicial do cliente web com o banco Firestore
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firestore] Conexão com o banco estabelecida com sucesso.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firestore] O cliente está offline ou a conexão falhou.');
    } else {
      console.info('[Firestore] Teste de conexão concluído.');
    }
    return false;
  }
}

// ============================================================================
// OPERAÇÕES GENÉRICAS EM TEMPO REAL NO FIRESTORE
// ============================================================================

/**
 * Inscreve um ouvinte em tempo real em uma coleção do Firestore
 */
export function subscribeCollection<T>(
  collectionName: string, 
  callback: (data: T[]) => void,
  errorCallback?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, collectionName);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: T[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as T));
      callback(items);
    },
    (error) => {
      console.error(`Erro no listener real-time de ${collectionName}:`, error);
      if (errorCallback) {
        errorCallback(error);
      } else {
        handleFirestoreError(error, OperationType.LIST, collectionName);
      }
    }
  );
}

/**
 * Inscreve um ouvinte em tempo real em um documento específico
 */
export function subscribeDocument<T>(
  collectionName: string, 
  docId: string, 
  callback: (data: T | null) => void
): Unsubscribe {
  const docRef = doc(db, collectionName, docId);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() } as T);
      } else {
        callback(null);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `${collectionName}/${docId}`);
    }
  );
}

/**
 * Obtém um documento pontual por ID
 */
export async function getDocument<T>(collectionName: string, docId: string): Promise<T | null> {
  const path = `${collectionName}/${docId}`;
  try {
    const docSnap = await getDoc(doc(db, collectionName, docId));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as T;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Salva/Cria um documento no Firestore utilizando ID específico
 */
export async function setDocument<T extends object>(
  collectionName: string, 
  docId: string, 
  data: T
): Promise<void> {
  const path = `${collectionName}/${docId}`;
  try {
    await setDoc(doc(db, collectionName, docId), {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Atualiza campos parciais em um documento existente
 */
export async function updateDocument<T extends object>(
  collectionName: string, 
  docId: string, 
  data: Partial<T>
): Promise<void> {
  const path = `${collectionName}/${docId}`;
  try {
    await updateDoc(doc(db, collectionName, docId), {
      ...data,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Exclui um documento no Firestore
 */
export async function deleteDocument(collectionName: string, docId: string): Promise<void> {
  const path = `${collectionName}/${docId}`;
  try {
    await deleteDoc(doc(db, collectionName, docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// OPERAÇÕES CRUD COM TIPAGEM DRIZZLE ORM (TEMPO REAL & AUTENTICAÇÃO INTEGRADA)
// ============================================================================

// ----------------------------------------------------------------------------
// 1. Ordens de Serviço (serviceOrders)
// ----------------------------------------------------------------------------

export function subscribeRealtimeServiceOrders(
  callback: (orders: ServiceOrderDb[]) => void
): Unsubscribe {
  return subscribeCollection<ServiceOrderDb>('serviceOrders', callback);
}

export async function createServiceOrderFirestore(
  order: Omit<NewServiceOrderDb, 'createdAt'> & { id: string }
): Promise<void> {
  const payload = {
    ...order,
    status: order.status || 'aberto',
    priority: order.priority || 'medium',
    createdByUid: auth.currentUser?.uid || null,
    createdAt: new Date().toISOString()
  };
  await setDocument('serviceOrders', order.id, payload);
}

export async function updateServiceOrderFirestore(
  id: string, 
  data: Partial<ServiceOrderDb>
): Promise<void> {
  await updateDocument('serviceOrders', id, data);
}

export async function deleteServiceOrderFirestore(id: string): Promise<void> {
  await deleteDocument('serviceOrders', id);
}

// ----------------------------------------------------------------------------
// 2. Clientes e Requisitantes (usuarios / clients)
// ----------------------------------------------------------------------------

export function subscribeRealtimeClients(
  callback: (clients: UsuarioDb[]) => void
): Unsubscribe {
  return subscribeCollection<UsuarioDb>('clients', callback);
}

export async function createClientFirestore(
  clientData: Omit<NewUsuarioDb, 'createdAt'> & { id: string }
): Promise<void> {
  const payload = {
    ...clientData,
    status: clientData.status || 'ativo',
    createdAt: new Date().toISOString()
  };
  await setDocument('clients', clientData.id, payload);
}

export async function updateClientFirestore(
  id: string, 
  data: Partial<UsuarioDb>
): Promise<void> {
  await updateDocument('clients', id, data);
}

export async function deleteClientFirestore(id: string): Promise<void> {
  await deleteDocument('clients', id);
}

// ----------------------------------------------------------------------------
// 3. Profissionais e Corpo Técnico (professionals)
// ----------------------------------------------------------------------------

export function subscribeRealtimeProfessionals(
  callback: (profs: ProfessionalDb[]) => void
): Unsubscribe {
  return subscribeCollection<ProfessionalDb>('professionals', callback);
}

export async function createProfessionalFirestore(
  profData: Omit<NewProfessionalDb, 'createdAt'> & { id: string }
): Promise<void> {
  const payload = {
    ...profData,
    userType: 'profissional',
    blocked: profData.blocked ?? false,
    createdAt: new Date().toISOString()
  };
  await setDocument('professionals', profData.id, payload);
}

export async function updateProfessionalFirestore(
  id: string, 
  data: Partial<ProfessionalDb>
): Promise<void> {
  await updateDocument('professionals', id, data);
}

export async function deleteProfessionalFirestore(id: string): Promise<void> {
  await deleteDocument('professionals', id);
}

// ----------------------------------------------------------------------------
// 4. Perfis de Usuário da Autenticação (users)
// ----------------------------------------------------------------------------

export function subscribeRealtimeUsers(
  callback: (users: UserDb[]) => void
): Unsubscribe {
  return subscribeCollection<UserDb>('users', callback);
}

export async function upsertUserFirestore(
  userProfile: Partial<UserDb> & { uid: string }
): Promise<void> {
  const path = `users/${userProfile.uid}`;
  try {
    await setDoc(doc(db, 'users', userProfile.uid), {
      ...userProfile,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getUserFirestore(uid: string): Promise<UserDb | null> {
  return getDocument<UserDb>('users', uid);
}

// ----------------------------------------------------------------------------
// 5. System Logs (system_logs)
// ----------------------------------------------------------------------------

export function subscribeRealtimeSystemLogs(
  callback: (logs: SystemLogDb[]) => void
): Unsubscribe {
  return subscribeCollection<SystemLogDb>('system_logs', callback);
}

export async function addSystemLogFirestore(
  log: Omit<NewSystemLogDb, 'createdAt'> & { id: string }
): Promise<void> {
  const payload = {
    ...log,
    timestamp: log.timestamp || new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  await setDocument('system_logs', log.id, payload);
}
