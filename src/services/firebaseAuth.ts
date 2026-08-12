import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Ensure persistent session in browser storage via Firebase Auth
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn("Could not enable browserLocalPersistence in Firebase Auth:", err);
});

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/gmail.send');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export interface UserProfileData {
  uid: string;
  email: string;
  name: string;
  document?: string;
  userType: 'admin' | 'gestor' | 'gestor_servicos' | 'profissional' | 'requisitante';
  warehouseId?: string;
  workLocation?: string;
  photoURL?: string;
  createdAt?: string;
}

/**
 * Consulta e retorna o perfil estendido do usuário armazenado na tabela 'users' do PostgreSQL.
 *
 * @param uid - Identificador único (UID) do usuário no Firebase Auth.
 * @returns Promessa com o objeto `UserProfileData` se encontrado, ou `null`.
 */
export const getUserProfile = async (uid: string): Promise<UserProfileData | null> => {
  try {
    const res = await fetch(`/api/postgres/users/${encodeURIComponent(uid)}`);
    if (res.ok) {
      const data = await res.json();
      return data as UserProfileData;
    }
    return null;
  } catch (err) {
    console.warn("[PostgreSQL] Erro ao buscar perfil de usuário:", err);
    return null;
  }
};

/**
 * Grava ou atualiza os dados do perfil estendido do usuário no PostgreSQL (tabela 'users').
 *
 * @param profile - Dados do perfil do usuário incluindo UID, nome, e-mail e papel.
 */
export const saveUserProfile = async (profile: UserProfileData): Promise<void> => {
  try {
    await fetch('/api/postgres/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
  } catch (err) {
    console.error("[PostgreSQL] Erro ao salvar perfil de usuário:", err);
  }
};

/**
 * Inscreve um ouvinte (listener) para monitorar alterações no estado de autenticação do Firebase.
 * Ao identificar um usuário logado, recupera ou cria automaticamente o perfil estendido no Firestore.
 *
 * @param onUserChanged - Callback acionado quando o estado de autenticação muda, recebendo o usuário Firebase `User` e o `UserProfileData`.
 * @returns Função de cancelamento de inscrição (`unsubscribe`).
 */
export const subscribeToAuthChanges = (
  onUserChanged: (user: User | null, profile: UserProfileData | null) => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      let profile = await getUserProfile(user.uid);
      if (!profile) {
        // Create initial fallback profile from Auth info
        const isMasterAdmin = user.email?.toLowerCase() === 'willianclima@gmail.com';
        profile = {
          uid: user.uid,
          email: user.email || '',
          name: user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário'),
          document: isMasterAdmin ? '369.111.218-84' : '',
          userType: isMasterAdmin ? 'admin' : 'requisitante',
          photoURL: user.photoURL || undefined,
          createdAt: new Date().toISOString()
        };
        await saveUserProfile(profile);
      }
      onUserChanged(user, profile);
    } else {
      onUserChanged(null, null);
    }
  });
};

/**
 * Inicializa a escuta do estado de autenticação e injeta o ID Token JWT atualizado ou o token em cache.
 *
 * @param onAuthSuccess - Callback executado quando o usuário está autenticado com sucesso.
 * @param onAuthFailure - Callback executado quando não há usuário logado.
 * @returns Função de cancelamento da inscrição (`unsubscribe`).
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const idToken = await user.getIdToken().catch(() => '');
      const tokenToUse = cachedAccessToken || idToken;
      if (onAuthSuccess) onAuthSuccess(user, tokenToUse);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Realiza a autenticação social via Google OAuth utilizando popup.
 * Captura o token de acesso OAuth, garante a existência do perfil no Firestore e retorna o objeto de usuário.
 *
 * @returns Objeto contendo as credenciais do usuário (`user`), token de acesso (`accessToken`) e o perfil estendido (`profile`).
 * @throws Lança erro caso a janela popup seja fechada ou ocorra falha no provedor de autenticação.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string; profile: UserProfileData } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;

    const user = result.user;
    let profile = await getUserProfile(user.uid);
    if (!profile) {
      const isMasterAdmin = user.email?.toLowerCase() === 'willianclima@gmail.com';
      profile = {
        uid: user.uid,
        email: user.email || '',
        name: user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário Google'),
        document: isMasterAdmin ? '369.111.218-84' : '',
        userType: isMasterAdmin ? 'admin' : 'requisitante',
        photoURL: user.photoURL || undefined,
        createdAt: new Date().toISOString()
      };
      await saveUserProfile(profile);
    }

    return { user, accessToken: cachedAccessToken || '', profile };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Realiza o login utilizando credenciais tradicionais de e-mail e senha.
 *
 * @param email - Endereço de e-mail cadastrado do usuário.
 * @param pass - Senha correspondente.
 * @returns Objeto com o usuário do Firebase Auth (`user`) e seu perfil do Firestore (`profile`).
 */
export const emailPasswordSignIn = async (email: string, pass: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  const user = userCredential.user;
  const profile = await getUserProfile(user.uid);
  return { user, profile };
};

/**
 * Cria um novo usuário com e-mail e senha e registra as informações do perfil estendido no Firestore.
 *
 * @param email - Endereço de e-mail para a nova conta.
 * @param pass - Senha da conta.
 * @param profileData - Dados adicionais do perfil (nome, tipo de usuário, documento, etc.).
 * @returns Objeto com o usuário recém-criado e o perfil salvo.
 */
export const emailPasswordSignUp = async (email: string, pass: string, profileData: Omit<UserProfileData, 'uid'>) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  const user = userCredential.user;
  const profile: UserProfileData = {
    ...profileData,
    uid: user.uid
  };
  await saveUserProfile(profile);
  return { user, profile };
};

/**
 * Recupera o ID Token JWT atualizado do usuário ativo ou o token retornado pelo provedor OAuth.
 *
 * @returns Promessa com o token de acesso como string, ou `null` se não houver usuário autenticado.
 */
export const getAccessToken = async (): Promise<string | null> => {
  if (auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken();
    } catch {
      return cachedAccessToken;
    }
  }
  return cachedAccessToken;
};

/**
 * Realiza o logout (desconexão) do usuário no Firebase Auth e limpa os tokens em memória.
 */
export const logoutUser = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

/**
 * Alias para a função de encerramento de sessão `logoutUser`.
 */
export const logoutGoogle = logoutUser;
