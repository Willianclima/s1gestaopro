import fs from "fs";
import path from "path";

/**
 * Automated Firestore Composite Indexes Manager
 * Specifically optimizes queries for 'service_orders' / 'serviceOrders'
 * for the 'My Requisitions' dashboard view (clientId + status + createdAt).
 */

interface IndexField {
  fieldPath: string;
  order?: "ASCENDING" | "DESCENDING";
  arrayConfig?: "CONTAINS";
}

interface CompositeIndex {
  collectionGroup: string;
  queryScope: "COLLECTION" | "COLLECTION_GROUP";
  fields: IndexField[];
}

interface FirestoreIndexesConfig {
  indexes: CompositeIndex[];
  fieldOverrides?: any[];
}

async function manageFirestoreIndexes() {
  console.log("=================================================");
  console.log("🔥 FIRESTORE COMPOSITE INDEXES MANAGER");
  console.log("=================================================\n");

  const indexPath = path.join(process.cwd(), "firestore.indexes.json");
  if (!fs.existsSync(indexPath)) {
    console.error("❌ Error: firestore.indexes.json file not found at project root!");
    process.exit(1);
  }

  const rawData = fs.readFileSync(indexPath, "utf-8");
  let config: FirestoreIndexesConfig;

  try {
    config = JSON.parse(rawData);
  } catch (err) {
    console.error("❌ Error: Failed to parse firestore.indexes.json - invalid JSON format.", err);
    process.exit(1);
  }

  console.log(`📋 Found ${config.indexes?.length || 0} composite index definition(s).\n`);

  // Filter service orders indexes for "My Requisitions" dashboard
  const serviceOrderIndexes = config.indexes.filter(
    (idx) => idx.collectionGroup === "service_orders" || idx.collectionGroup === "serviceOrders"
  );

  console.log("🎯 'My Requisitions' Dashboard Index Optimizations:");
  serviceOrderIndexes.forEach((idx, index) => {
    const fieldsStr = idx.fields.map((f) => `${f.fieldPath} (${f.order || f.arrayConfig})`).join(" ➔ ");
    console.log(`   ${index + 1}. Collection [${idx.collectionGroup}]: ${fieldsStr}`);
  });

  // Load Firebase Config if present
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  let projectId = "ai-studio-gestodeservios-b5818bcf-aaaf-40d3-b983-b195f18ebfd7";

  if (fs.existsSync(firebaseConfigPath)) {
    try {
      const fbConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
      if (fbConfig.projectId) {
        projectId = fbConfig.projectId;
      }
    } catch {
      // fallback
    }
  }

  console.log(`\n📌 Target Firebase Project: ${projectId}`);

  // Generate Direct Console Index URLs for quick creation in Cloud Console
  console.log("\n🔗 Direct Cloud Console Index Creation URLs:");
  serviceOrderIndexes.forEach((idx, i) => {
    const fieldsUrl = idx.fields
      .map((f) => `field_${f.fieldPath}=${f.order === "DESCENDING" ? "DESCENDING" : "ASCENDING"}`)
      .join("&");
    const consoleUrl = `https://console.firebase.google.com/project/${projectId}/firestore/indexes?create_composite=true&collection_group=${idx.collectionGroup}&${fieldsUrl}`;
    console.log(`   [Index #${i + 1}] -> ${consoleUrl}`);
  });

  console.log("\n🚀 Automated Deployment Commands:");
  console.log("   1. Deploy via Firebase CLI:");
  console.log("      npx firebase-tools deploy --only firestore:indexes\n");
  console.log("   2. Deploy via gcloud CLI:");
  console.log(`      gcloud datastore indexes create firestore.indexes.json --project=${projectId}\n`);

  console.log("✅ Firestore composite indexes validated successfully!");
}

manageFirestoreIndexes().catch((err) => {
  console.error("❌ Unexpected error managing indexes:", err);
  process.exit(1);
});
