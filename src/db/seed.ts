import { db, client } from "./drizzle.ts";
import { 
  usuarios, 
  professionals, 
  serviceOrders, 
  systemLogs, 
  serviceCategories 
} from "./schema.ts";
import { 
  INITIAL_USUARIOS, 
  INITIAL_PROFESSIONALS, 
  INITIAL_ORDERS, 
  INITIAL_SYSTEM_LOGS, 
  INITIAL_CATEGORIES 
} from "../data/mockData.ts";

/**
 * Utilitário de povoamento (seed) do banco de dados PostgreSQL via Drizzle ORM.
 * Executa inserções batch nas tabelas: usuarios, professionals, service_orders e system_logs.
 */
export async function seedDatabaseBatch() {
  console.log("🌱 Iniciando inserção batch de dados mock no PostgreSQL via Drizzle ORM...");
  const stats = { usuarios: 0, professionals: 0, serviceOrders: 0, systemLogs: 0, categories: 0 };

  try {
    // 1. Batch Insert em 'usuarios'
    if (INITIAL_USUARIOS.length > 0) {
      const usuariosValues = INITIAL_USUARIOS.map((u) => {
        const { id, name, document, phone, email, address, lat, lng, formattedAddress, isAddressValidated, notes, userType, status, ...extra } = u;
        return {
          id,
          name,
          document: document || "",
          phone: phone || "",
          email: email || "",
          address: address || "",
          lat: lat || null,
          lng: lng || null,
          formattedAddress: formattedAddress || null,
          isAddressValidated: isAddressValidated ?? false,
          notes: notes || "",
          userType: userType || "requisitante",
          status: status || "ativo",
          data: extra,
        };
      });

      await db.insert(usuarios)
        .values(usuariosValues)
        .onConflictDoNothing();

      stats.usuarios = usuariosValues.length;
      console.log(`✅ ${stats.usuarios} registros inseridos/garantidos em 'usuarios'.`);
    }

    // 2. Batch Insert em 'professionals'
    if (INITIAL_PROFESSIONALS.length > 0) {
      const profValues = INITIAL_PROFESSIONALS.map((p) => {
        const { id, name, document, email, role, specialty, specialties, userType, workLocation, googleUid, ...extra } = p;
        return {
          id,
          name,
          document: document || "",
          email: email || "",
          role: role || "",
          specialty: specialty || "",
          specialties: specialties || [specialty],
          userType: userType || "profissional",
          failedAttempts: 0,
          blocked: false,
          workLocation: workLocation || null,
          googleUid: googleUid || null,
          data: extra,
        };
      });

      await db.insert(professionals)
        .values(profValues)
        .onConflictDoNothing();

      stats.professionals = profValues.length;
      console.log(`✅ ${stats.professionals} registros inseridos/garantidos em 'professionals'.`);
    }

    // 3. Batch Insert em 'service_categories'
    if (INITIAL_CATEGORIES.length > 0) {
      const catValues = INITIAL_CATEGORIES.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color || "#3b82f6",
        slaHours: c.slaHours ?? 24,
        reminderIntervalHours: c.reminderIntervalHours ?? 4,
        reminderEnabled: c.reminderEnabled ?? true,
        notifyGestor: c.notifyGestor ?? true,
        notifyTechnician: c.notifyTechnician ?? true,
      }));

      await db.insert(serviceCategories)
        .values(catValues)
        .onConflictDoNothing();

      stats.categories = catValues.length;
      console.log(`✅ ${stats.categories} registros inseridos/garantidos em 'service_categories'.`);
    }

    // 4. Batch Insert em 'service_orders'
    if (INITIAL_ORDERS.length > 0) {
      const orderValues = INITIAL_ORDERS.map((o) => ({
        id: o.id,
        clientId: o.clientId,
        title: o.title,
        description: o.description || "",
        category: o.category || "",
        status: o.status || "aberto",
        priority: o.priority || "medium",
        assignedTo: o.assignedTo || "",
        startDate: o.startDate || null,
        endDate: o.endDate || null,
        notes: o.notes || "",
        location: o.location || null,
        lat: o.lat || null,
        lng: o.lng || null,
        history: o.history || [],
        images: o.images || [],
        completedImages: o.completedImages || [],
        unreadByClient: o.unreadByClient ?? false,
        unreadByProfessional: o.unreadByProfessional ?? false,
        hasMissingMaterial: o.hasMissingMaterial ?? false,
        missingMaterialDescription: o.missingMaterialDescription || null,
      }));

      await db.insert(serviceOrders)
        .values(orderValues)
        .onConflictDoNothing();

      stats.serviceOrders = orderValues.length;
      console.log(`✅ ${stats.serviceOrders} registros inseridos/garantidos em 'service_orders'.`);
    }

    // 5. Batch Insert em 'system_logs'
    if (INITIAL_SYSTEM_LOGS.length > 0) {
      const logValues = INITIAL_SYSTEM_LOGS.map((l) => ({
        id: l.id,
        timestamp: l.timestamp,
        action: l.action,
        details: l.details || "",
        category: l.category,
      }));

      await db.insert(systemLogs)
        .values(logValues)
        .onConflictDoNothing();

      stats.systemLogs = logValues.length;
      console.log(`✅ ${stats.systemLogs} registros inseridos/garantidos em 'system_logs'.`);
    }

    console.log("🎉 Povoamento batch do banco concluído com sucesso!", stats);
    return { success: true, stats };
  } catch (error) {
    console.error("❌ Erro ao realizar inserções batch no PostgreSQL:", error);
    throw error;
  }
}

// Execução standalone
const isMainModule = process.argv[1]?.replace(/\\/g, "/").endsWith("src/db/seed.ts");

if (isMainModule) {
  seedDatabaseBatch()
    .then(async () => {
      await client.end({ timeout: 5 });
      process.exit(0);
    })
    .catch(async () => {
      await client.end({ timeout: 5 });
      process.exit(1);
    });
}
