import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "../firebase-applet-config.json" assert { type: "json" };
import { 
  upsertClient, 
  upsertServiceOrder, 
  insertSystemLog, 
  insertLoginAttempt, 
  upsertAccessProfile,
  upsertProfessional,
  upsertServiceCategory
} from "../src/db/repository.ts";

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const dbFirestore = getFirestore(undefined, firebaseConfig.firestoreDatabaseId || "(default)");

export async function runFirestoreToPostgresMigration() {
  console.log("Starting Firestore to PostgreSQL ETL Data Migration...");
  let stats = { clients: 0, orders: 0, systemLogs: 0, loginAttempts: 0, accessProfiles: 0, professionals: 0, serviceCategories: 0 };

  try {
    // 1. Migrate Clients/Usuarios
    const clientsSnap = await dbFirestore.collection("clients").get();
    const usuariosSnap = await dbFirestore.collection("usuarios").get();
    const allUserDocs = [...clientsSnap.docs, ...usuariosSnap.docs];
    
    for (const doc of allUserDocs) {
      const data = doc.data();
      await upsertClient({
        id: doc.id,
        name: data.name || "Usuário sem Nome",
        document: data.document || "",
        phone: data.phone || "",
        email: data.email || "",
        address: data.address || "",
        notes: data.notes || "",
        createdAt: data.createdAt || new Date().toISOString(),
        ...data,
      });
      stats.clients++;
    }

    // 2. Migrate Service Orders
    const ordersSnap = await dbFirestore.collection("service_orders").get();
    for (const doc of ordersSnap.docs) {
      const data = doc.data();
      await upsertServiceOrder({
        id: doc.id,
        clientId: data.clientId || "",
        title: data.title || "Ordem de Serviço",
        description: data.description || "",
        category: data.category || "Geral",
        status: data.status || "aberto",
        priority: data.priority || "medium",
        assignedTo: data.assignedTo || "",
        startDate: data.startDate || "",
        endDate: data.endDate || "",
        history: data.history || [],
        notes: data.notes || "",
        createdAt: data.createdAt || new Date().toISOString(),
        ...data,
      });
      stats.orders++;
    }

    // 3. Migrate System Logs
    const logsSnap = await dbFirestore.collection("system_logs").get();
    for (const doc of logsSnap.docs) {
      const data = doc.data();
      await insertSystemLog({
        id: doc.id,
        timestamp: data.timestamp || new Date().toISOString(),
        action: data.action || "Ação de Sistema",
        details: data.details || "",
        category: data.category || "sistema",
      });
      stats.systemLogs++;
    }

    // 4. Migrate Login Attempts
    const attemptsSnap = await dbFirestore.collection("login_attempts").get();
    for (const doc of attemptsSnap.docs) {
      const data = doc.data();
      await insertLoginAttempt({
        id: doc.id,
        timestamp: data.timestamp || new Date().toISOString(),
        username: data.username || "Desconhecido",
        userId: data.userId || "Desconhecido",
        status: data.status || "failed",
        userType: data.userType || "desconhecido",
        details: data.details || "",
      });
      stats.loginAttempts++;
    }

    // 5. Migrate Access Profiles
    const profilesSnap = await dbFirestore.collection("access_profiles").get();
    for (const doc of profilesSnap.docs) {
      const data = doc.data();
      await upsertAccessProfile({
        id: doc.id,
        name: data.name || "Perfil",
        description: data.description || "",
        permissions: data.permissions || {},
        createdAt: data.createdAt || new Date().toISOString(),
      });
      stats.accessProfiles++;
    }

    // 6. Migrate Professionals
    const profsSnap = await dbFirestore.collection("professionals").get();
    for (const doc of profsSnap.docs) {
      const data = doc.data();
      await upsertProfessional({
        id: doc.id,
        name: data.name || "Profissional sem Nome",
        document: data.document || "",
        email: data.email || "",
        role: data.role || "",
        specialty: data.specialty || "",
        specialties: data.specialties || [],
        userType: data.userType || "profissional",
        failedAttempts: data.failedAttempts || 0,
        blocked: data.blocked || false,
        workLocation: data.workLocation || "",
        googleUid: data.googleUid || "",
        ...data,
      });
      stats.professionals++;
    }

    // 7. Migrate Service Categories
    const catsSnap = await dbFirestore.collection("service_categories").get();
    for (const doc of catsSnap.docs) {
      const data = doc.data();
      await upsertServiceCategory({
        id: doc.id,
        name: data.name || "Categoria",
        color: data.color || "#3b82f6",
        slaHours: data.slaHours || 24,
        reminderIntervalHours: data.reminderIntervalHours || 4,
        reminderEnabled: data.reminderEnabled ?? true,
        notifyGestor: data.notifyGestor ?? true,
        notifyTechnician: data.notifyTechnician ?? true,
      });
      stats.serviceCategories++;
    }

    console.log("Firestore to PostgreSQL ETL Migration Completed Successfully!", stats);
    return { success: true, stats };
  } catch (err) {
    console.error("Error during Firestore -> PostgreSQL migration:", err);
    throw err;
  }
}
