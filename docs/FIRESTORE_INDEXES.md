# Firestore Composite Indexes Management & Optimization Guide

This documentation details the composite indexing strategy for the **`serviceOrders`** (and **`service_orders`**) collections to optimize multi-field queries in the **"My Requisitions" (Meus Chamados)** dashboard view.

---

## 1. Why Composite Indexes are Required

Firestore automatically creates single-field indexes for all properties in a document. However, when performing **compound queries** that combine multiple filters or equality filters with order clauses, a **Composite Index** is required:

### Query Example (My Requisitions View):
```typescript
// Query filtering requisitions by specific client, status, and sorted by date
const q = query(
  collection(db, "serviceOrders"),
  where("clientId", "==", currentUserId),
  where("status", "==", "em_andamento"),
  orderBy("createdAt", "desc")
);
```

Without a matching Composite Index, Firestore will reject this query with a `FAILED_PRECONDITION` error stating:
> *"The query requires an index. You can create it here: https://console.firebase.google.com/..."*

---

## 2. Composite Index Definitions (`firestore.indexes.json`)

The composite indexes configured at the root of the project in `firestore.indexes.json` cover both `serviceOrders` and `service_orders`:

| Collection | Indexed Fields | Query Scope | Purpose in "My Requisitions" |
| :--- | :--- | :--- | :--- |
| **`serviceOrders`** | `clientId` (ASC), `status` (ASC), `createdAt` (DESC) | `COLLECTION` | Filters requisitions by user & status, sorted by creation date |
| **`serviceOrders`** | `clientId` (ASC), `status` (ASC), `startDate` (DESC) | `COLLECTION` | Filters requisitions by user & status, sorted by execution date |
| **`serviceOrders`** | `clientId` (ASC), `priority` (ASC), `createdAt` (DESC) | `COLLECTION` | Filters requisitions by user & priority level |
| **`serviceOrders`** | `createdByUid` (ASC), `status` (ASC), `createdAt` (DESC) | `COLLECTION` | Alternative lookup by creator UID |
| **`serviceOrders`** | `assignedTo` (ASC), `status` (ASC), `createdAt` (DESC) | `COLLECTION` | Field technician dashboard view |

---

## 3. Automated Management Script

An automated script is available to parse, validate, and output composite index status along with direct Cloud Console deployment links:

```bash
npm run firestore:indexes
```

### Script Capabilities:
- Validates syntax and field order in `firestore.indexes.json`.
- Identifies missing index patterns for the `serviceOrders` collection.
- Generates direct one-click Firebase Cloud Console URLs for building indexes instantly.

---

## 4. Deployment Methods

### Option A: Firebase CLI (Recommended)
Deploy composite indexes directly from your terminal:

```bash
npx firebase-tools deploy --only firestore:indexes
```

### Option B: Google Cloud CLI (`gcloud`)
```bash
gcloud datastore indexes create firestore.indexes.json --project=ai-studio-gestodeservios-b5818bcf-aaaf-40d3-b983-b195f18ebfd7
```

### Option C: Direct Cloud Console Link
Run `npm run firestore:indexes` to generate direct web links that pre-fill composite index fields in the Firebase Web Console.
