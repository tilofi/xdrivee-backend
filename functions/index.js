/**
 * xDrivee — createDisputeEU (final simplified version + flexible matching)
 * Region: europe-west1
 * Runtime: Node.js 24
 * Reads from: appConfig/main.disputeCatalog
 *
 * IMPORTANT:
 * This file contains createDisputeEU only.
 * Deploy ONLY this function:
 *   firebase deploy --only functions:createDisputeEU
 */

const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const REGION = "europe-west1";
const TS = admin.firestore.FieldValue.serverTimestamp();
const CONFIG_COLLECTION_CANDIDATES = ["appConfig", "app_config"];
const CATALOG_FIELD_CANDIDATES = [
  "disputeCatalog",
  "dispute_catalog",
  "disputeReasonCatalog",
];
const RESOLVE_DISPUTE_STATUS_VALUES = ["resolved"];
const RESOLVE_DISPUTE_ALLOWED_PRIOR_STATUS_VALUES = ["in_review"];
const DISPUTE_STATUS_VALUES = ["open", "resolved"];
const DISPUTE_LIST_LIMIT_CAP = 100;
const REJECT_DISPUTE_ALLOWED_PRIOR_STATUS_VALUES = ["open"];
const IN_REVIEW_ALLOWED_PRIOR_STATUS_VALUES = ["open"];
const REOPEN_REJECTED_DISPUTE_TARGET_STATUS = "in_review";
const REOPEN_CLOSED_DISPUTE_TARGET_STATUS = "in_review";
const ADMIN_DISPUTE_STATUS_VALUES = [
  "open",
  "in_review",
  "resolved",
  "rejected",
  "closed",
];

/* ====================== HELPERS ====================== */

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function findObjectValueByNormalizedKey(obj, target) {
  if (!obj || typeof obj !== "object") return null;

  const normTarget = normalizeKey(target);

  if (Object.prototype.hasOwnProperty.call(obj, target)) {
    return obj[target];
  }

  for (const [key, value] of Object.entries(obj)) {
    if (normalizeKey(key) === normTarget) {
      return value;
    }
  }

  return null;
}

function getCatalogFromDocData(data) {
  if (!data || typeof data !== "object") return null;

  for (const field of CATALOG_FIELD_CANDIDATES) {
    if (data[field] && typeof data[field] === "object") {
      return { catalog: data[field], field };
    }
  }

  if (data.disputes && typeof data.disputes === "object") {
    for (const field of CATALOG_FIELD_CANDIDATES) {
      if (data.disputes[field] && typeof data.disputes[field] === "object") {
        return { catalog: data.disputes[field], field: `disputes.${field}` };
      }
    }
  }

  return null;
}

function getReasonCodeValue(item) {
  if (!item || typeof item !== "object") return null;
  return item.code || item.reasonCode || null;
}

async function loadDisputeCatalog() {
  const checkedPaths = [];

  for (const collectionName of CONFIG_COLLECTION_CANDIDATES) {
    const directSnap = await db.collection(collectionName).doc("main").get();
    checkedPaths.push(`${collectionName}/main`);

    if (!directSnap.exists) continue;

    const resolved = getCatalogFromDocData(directSnap.data());
    if (resolved) {
      return {
        catalog: resolved.catalog,
        sourcePath: `${collectionName}/main`,
        sourceField: resolved.field,
        checkedPaths,
      };
    }
  }

  for (const collectionName of CONFIG_COLLECTION_CANDIDATES) {
    const querySnap = await db.collection(collectionName).limit(25).get();

    for (const doc of querySnap.docs) {
      const path = `${collectionName}/${doc.id}`;
      if (!checkedPaths.includes(path)) checkedPaths.push(path);

      const resolved = getCatalogFromDocData(doc.data());
      if (resolved) {
        return {
          catalog: resolved.catalog,
          sourcePath: path,
          sourceField: resolved.field,
          checkedPaths,
        };
      }
    }
  }

  return { catalog: null, sourcePath: null, sourceField: null, checkedPaths };
}

function getReasonItems(container) {
  const items = [];
  if (!container) return items;

  // Preferred case: array
  if (Array.isArray(container)) {
    for (const item of container) {
      if (item && typeof item === "object" && getReasonCodeValue(item)) {
        items.push(item);
      }
    }
    return items;
  }

  // Legacy case: map/object
  if (typeof container === "object") {
    for (const item of Object.values(container)) {
      if (item && typeof item === "object" && getReasonCodeValue(item)) {
        items.push(item);
      }
    }
  }

  return items;
}

function unwrapReasonContainer(node) {
  if (!node) return null;

  if (Array.isArray(node)) return node;
  if (typeof node !== "object") return null;

  if (getReasonItems(node).length) {
    return node;
  }

  const nestedCandidates = ["reasons", "reasonCodes", "reason_codes", "items"];
  for (const key of nestedCandidates) {
    const nested = findObjectValueByNormalizedKey(node, key);
    if (nested && getReasonItems(nested).length) {
      return nested;
    }
  }

  return null;
}

function findCategoryNode(roleNode, category) {
  const normCat = normalizeKey(category);

  // 1. Exact match first
  if (roleNode[category]) return roleNode[category];

  // 2. Normalized match
  for (const key of Object.keys(roleNode)) {
    if (String(key).trim().toLowerCase() === normCat) {
      return roleNode[key];
    }
  }

  // 3. Wrapped categories object
  const wrappedCategories =
    findObjectValueByNormalizedKey(roleNode, "categories") ||
    findObjectValueByNormalizedKey(roleNode, "categoryMap") ||
    findObjectValueByNormalizedKey(roleNode, "category_map");

  if (wrappedCategories && typeof wrappedCategories === "object") {
    const wrappedMatch = findObjectValueByNormalizedKey(wrappedCategories, category);
    if (wrappedMatch) return wrappedMatch;
  }

  return null;
}

async function getAuthorizedDisputeForUser(disputeId, uid) {
  const disputeRef = db.collection("disputes").doc(disputeId);
  const disputeSnap = await disputeRef.get();

  if (!disputeSnap.exists) {
    throw new HttpsError("not-found", "DISPUTE_NOT_FOUND");
  }

  const dispute = disputeSnap.data() || {};
  const allowedUids = [
    dispute.createdByUid,
    dispute.customerUid,
    dispute.driverUid,
    dispute.openedByUid,
  ].filter(Boolean);

  if (!allowedUids.includes(uid)) {
    throw new HttpsError("permission-denied", "DISPUTE_NOT_OWNED_BY_USER");
  }

  return { disputeRef, dispute };
}

async function isAdminUid(uid) {
  const adminSnap = await db.collection("admins").doc(uid).get();
  return adminSnap.exists;
}

function toPlainDispute(disputeId, dispute) {
  return {
    disputeId,
    ...dispute,
  };
}

async function assertAdmin(uid) {
  const isAdmin = await isAdminUid(uid);
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "ADMIN_ONLY");
  }
}

function toPlainMessage(messageId, data) {
  const createdAt = data.createdAt && typeof data.createdAt.toDate === "function" ?
    data.createdAt.toDate().toISOString() :
    null;

  return {
    messageId,
    ...(data.senderUid !== undefined ? { senderUid: data.senderUid } : {}),
    ...(data.senderRole !== undefined ? { senderRole: data.senderRole } : {}),
    ...(data.text !== undefined ? { text: data.text } : {}),
    ...(createdAt !== null ? { createdAt } : {}),
  };
}

function getAllowedDisputeTransitions(currentStatus) {
  switch (String(currentStatus || "").trim().toLowerCase()) {
    case "open":
      return ["in_review", "rejected"];
    case "in_review":
      return ["resolved"];
    case "resolved":
      return ["open", "closed"];
    case "rejected":
      return [REOPEN_REJECTED_DISPUTE_TARGET_STATUS];
    case "closed":
      return [REOPEN_CLOSED_DISPUTE_TARGET_STATUS];
    default:
      return [];
  }
}

function getAllowedDisputeActions({ currentStatus, isAdmin }) {
  const actions = [
    "create_message",
    "list_messages",
    "get_dispute",
    "list_transitions",
  ];

  if (!isAdmin) {
    return actions;
  }

  actions.push("admin_reply", "list_messages_admin", "get_dispute_admin");

  switch (String(currentStatus || "").trim().toLowerCase()) {
    case "open":
      actions.push("set_in_review", "reject");
      break;
    case "in_review":
      actions.push("resolve");
      break;
    case "resolved":
      actions.push("reopen_resolved", "close");
      break;
    case "rejected":
      actions.push("reopen_rejected");
      break;
    case "closed":
      actions.push("reopen_closed");
      break;
    default:
      break;
  }

  return actions;
}

async function getDisputeForAdminOrParticipant(disputeId, uid) {
  const disputeRef = db.collection("disputes").doc(disputeId);
  const disputeSnap = await disputeRef.get();

  if (!disputeSnap.exists) {
    throw new HttpsError("not-found", "DISPUTE_NOT_FOUND");
  }

  if (await isAdminUid(uid)) {
    return { disputeRef, dispute: disputeSnap.data() || {} };
  }

  const dispute = disputeSnap.data() || {};
  const allowedUids = [
    dispute.createdByUid,
    dispute.customerUid,
    dispute.driverUid,
    dispute.openedByUid,
  ].filter(Boolean);

  if (!allowedUids.includes(uid)) {
    throw new HttpsError("permission-denied", "DISPUTE_NOT_OWNED_BY_USER");
  }

  return { disputeRef, dispute };
}

/* ====================== MAIN FUNCTION ====================== */

exports.createDisputeEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const { role, category, reasonCode, orderId, description } = req.data || {};

  if (!orderId || !role || !category || !reasonCode) {
    throw new HttpsError(
      "invalid-argument",
      "ORDER_ID_ROLE_CATEGORY_REASON_CODE_REQUIRED"
    );
  }

  const normRole = String(role).trim().toLowerCase();
  const normCategory = String(category).trim().toLowerCase();
  const normReasonCode = String(reasonCode).trim().toUpperCase();

  // جلب appConfig/main
  const catalogResult = await loadDisputeCatalog();
  if (!catalogResult.catalog || typeof catalogResult.catalog !== "object") {
    console.error("Dispute catalog could not be resolved", {
      checkedPaths: catalogResult.checkedPaths || [],
    });
    throw new HttpsError("failed-precondition", "DISPUTE_CATALOG_NOT_FOUND");
  }
  const catalog = catalogResult.catalog;

  // Find role node (exact or normalized)
  let roleNode =
    findObjectValueByNormalizedKey(catalog, normRole) ||
    findObjectValueByNormalizedKey(catalog, role);
  if (!roleNode) {
    throw new HttpsError("invalid-argument", `ROLE_NOT_FOUND: ${role}`);
  }

  // Find category node with fallback matching
  const categoryNode = findCategoryNode(roleNode, category);
  const reasonContainer = unwrapReasonContainer(categoryNode);
  if (!reasonContainer) {
    console.log(`Category not found: ${category} (normalized: ${normCategory})`);
    console.log("Catalog source:", {
      path: catalogResult.sourcePath,
      field: catalogResult.sourceField,
    });
    console.log(`Available categories under role "${role}":`, Object.keys(roleNode));
    throw new HttpsError("invalid-argument", `CATEGORY_NOT_FOUND: ${category}`);
  }

  const reasonItems = getReasonItems(reasonContainer);

  const matchedItem = reasonItems.find(
    (item) => String(getReasonCodeValue(item)).trim().toUpperCase() === normReasonCode
  );

  if (!matchedItem) {
    const availableCodes = reasonItems.map((item) =>
      String(getReasonCodeValue(item)).trim().toUpperCase()
    );
    throw new HttpsError(
      "invalid-argument",
      `REASON_CODE_NOT_IN_CATALOG | role=${role} | category=${category} | code=${reasonCode} | available=${availableCodes.join(", ")} | items=${availableCodes.length}`
    );
  }

  // التحقق من الرحلة / الطلب
  const tripSnap = await db.collection("trips").doc(orderId).get();
  if (!tripSnap.exists) {
    throw new HttpsError("not-found", "ORDER_NOT_FOUND");
  }

  const trip = tripSnap.data() || {};

  if (normRole === "customer" && trip.customerUid !== uid) {
    throw new HttpsError("permission-denied", "ORDER_NOT_OWNED_BY_CUSTOMER");
  }
  if (normRole === "driver" && trip.driverUid !== uid) {
    throw new HttpsError("permission-denied", "ORDER_NOT_OWNED_BY_DRIVER");
  }

  // إنشاء النزاع
  const disputeRef = await db.collection("disputes").add({
    tripId: orderId,
    orderId,
    role: normRole,
    category: normCategory,
    reasonCode: normReasonCode,
    reasonLabel: matchedItem.label || null,
    reasonDescription: matchedItem.description || null,
    reasonSeverity: matchedItem.severity || null,
    customerUid: trip.customerUid || null,
    driverUid: trip.driverUid || null,
    createdByUid: uid,
    status: "open",
    messageCount: 0,
    description: description ? String(description).trim() : null,
    createdAt: TS,
    updatedAt: TS,
    statusUpdatedAt: TS,
  });

  return {
    ok: true,
    disputeId: disputeRef.id,
    matchedCode: normReasonCode,
    matchedLabel: matchedItem.label || null,
  };
});

exports.createDisputeMessageEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const { disputeId, text } = req.data || {};
  const cleanText = String(text || "").trim();

  if (!disputeId || !cleanText) {
    throw new HttpsError("invalid-argument", "DISPUTE_ID_TEXT_REQUIRED");
  }

  const { disputeRef } = await getAuthorizedDisputeForUser(disputeId, uid);
  const messageRef = disputeRef.collection("messages").doc();

  await db.runTransaction(async (tx) => {
    tx.set(messageRef, {
      senderUid: uid,
      text: cleanText,
      createdAt: TS,
    });

    tx.update(disputeRef, {
      messageCount: admin.firestore.FieldValue.increment(1),
      updatedAt: TS,
    });
  });

  return {
    ok: true,
    disputeId,
    messageId: messageRef.id,
    text: cleanText,
  };
});

exports.listDisputeMessagesEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const { disputeId, limit } = req.data || {};
  if (!disputeId) {
    throw new HttpsError("invalid-argument", "DISPUTE_ID_REQUIRED");
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
  const { disputeRef } = await getAuthorizedDisputeForUser(disputeId, uid);

  const messagesSnap = await disputeRef
    .collection("messages")
    .orderBy("createdAt", "asc")
    .limit(safeLimit)
    .get();

  const messages = messagesSnap.docs.map((doc) => {
    const data = doc.data() || {};
    return toPlainMessage(doc.id, data);
  });

  return {
    ok: true,
    disputeId,
    count: messages.length,
    messages,
  };
});

exports.listDisputeMessagesAdminEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const cleanDisputeId = String(req.data?.disputeId || "").trim();
  if (!cleanDisputeId) {
    throw new HttpsError("invalid-argument", "DISPUTE_ID_REQUIRED");
  }

  let safeLimit = 50;
  const rawLimit = req.data?.limit;
  if (rawLimit !== undefined && rawLimit !== null) {
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
      throw new HttpsError("invalid-argument", "INVALID_LIMIT");
    }
    safeLimit = rawLimit;
  }

  await assertAdmin(uid);

  const disputeRef = db.collection("disputes").doc(cleanDisputeId);
  const disputeSnap = await disputeRef.get();
  if (!disputeSnap.exists) {
    throw new HttpsError("not-found", "DISPUTE_NOT_FOUND");
  }

  const messagesSnap = await disputeRef
    .collection("messages")
    .orderBy("createdAt", "asc")
    .limit(safeLimit)
    .get();

  const messages = messagesSnap.docs.map((doc) => toPlainMessage(doc.id, doc.data() || {}));

  return {
    ok: true,
    disputeId: cleanDisputeId,
    count: messages.length,
    messages,
  };
});

exports.adminReplyDisputeEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const { disputeId, text } = req.data || {};
  const cleanText = String(text || "").trim();

  if (!disputeId || !String(disputeId).trim()) {
    throw new HttpsError("invalid-argument", "DISPUTE_ID_REQUIRED");
  }
  if (!cleanText) {
    throw new HttpsError("invalid-argument", "TEXT_REQUIRED");
  }
  if (cleanText.length > 2000) {
    throw new HttpsError("invalid-argument", "TEXT_TOO_LONG");
  }

  await assertAdmin(uid);

  const disputeRef = db.collection("disputes").doc(String(disputeId).trim());
  const disputeSnap = await disputeRef.get();
  if (!disputeSnap.exists) {
    throw new HttpsError("not-found", "DISPUTE_NOT_FOUND");
  }

  const messageRef = disputeRef.collection("messages").doc();
  await messageRef.set({
    senderUid: uid,
    senderRole: "admin",
    text: cleanText,
    createdAt: TS,
  });

  return {
    ok: true,
    disputeId: String(disputeId).trim(),
    messageId: messageRef.id,
  };
});

exports.resolveDisputeEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const { disputeId, status, resolutionNote } = req.data || {};
  const cleanDisputeId = String(disputeId || "").trim();
  const cleanStatus = String(status || "").trim().toLowerCase();

  if (!cleanDisputeId) {
    throw new HttpsError("invalid-argument", "DISPUTE_ID_REQUIRED");
  }
  if (!cleanStatus || !RESOLVE_DISPUTE_STATUS_VALUES.includes(cleanStatus)) {
    throw new HttpsError("invalid-argument", "UNSUPPORTED_STATUS");
  }

  let cleanResolutionNote = null;
  if (resolutionNote !== undefined && resolutionNote !== null) {
    cleanResolutionNote = String(resolutionNote).trim();
    if (!cleanResolutionNote) {
      throw new HttpsError("invalid-argument", "RESOLUTION_NOTE_EMPTY");
    }
    if (cleanResolutionNote.length > 2000) {
      throw new HttpsError("invalid-argument", "RESOLUTION_NOTE_TOO_LONG");
    }
  }

  await assertAdmin(uid);

  const disputeRef = db.collection("disputes").doc(cleanDisputeId);
  const disputeSnap = await disputeRef.get();
  if (!disputeSnap.exists) {
    throw new HttpsError("not-found", "DISPUTE_NOT_FOUND");
  }

  const dispute = disputeSnap.data() || {};
  if (!RESOLVE_DISPUTE_ALLOWED_PRIOR_STATUS_VALUES.includes(dispute.status)) {
    throw new HttpsError("invalid-argument", "DISPUTE_STATUS_NOT_RESOLVABLE");
  }

  await disputeRef.update({
    status: cleanStatus,
    updatedAt: TS,
    statusUpdatedAt: TS,
  });

  return {
    ok: true,
    disputeId: cleanDisputeId,
    status: cleanStatus,
  };
});

exports.getDisputeEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const cleanDisputeId = String(req.data?.disputeId || "").trim();
  if (!cleanDisputeId) {
    throw new HttpsError("invalid-argument", "DISPUTE_ID_REQUIRED");
  }

  const { dispute } = await getDisputeForAdminOrParticipant(cleanDisputeId, uid);

  return {
    ok: true,
    dispute: {
      ...toPlainDispute(cleanDisputeId, dispute),
    },
  };
});

exports.getDisputeAdminEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const cleanDisputeId = String(req.data?.disputeId || "").trim();
  if (!cleanDisputeId) {
    throw new HttpsError("invalid-argument", "DISPUTE_ID_REQUIRED");
  }

  await assertAdmin(uid);

  const disputeSnap = await db.collection("disputes").doc(cleanDisputeId).get();
  if (!disputeSnap.exists) {
    throw new HttpsError("not-found", "DISPUTE_NOT_FOUND");
  }

  return {
    ok: true,
    dispute: {
      ...toPlainDispute(cleanDisputeId, disputeSnap.data() || {}),
    },
  };
});

exports.listDisputeTransitionsEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const cleanDisputeId = String(req.data?.disputeId || "").trim();
  if (!cleanDisputeId) {
    throw new HttpsError("invalid-argument", "DISPUTE_ID_REQUIRED");
  }

  const { dispute } = await getDisputeForAdminOrParticipant(cleanDisputeId, uid);
  const currentStatus = String(dispute.status || "").trim().toLowerCase();

  return {
    ok: true,
    disputeId: cleanDisputeId,
    currentStatus,
    allowedTransitions: getAllowedDisputeTransitions(currentStatus),
  };
});

exports.listDisputeActionsEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const cleanDisputeId = String(req.data?.disputeId || "").trim();
  if (!cleanDisputeId) {
    throw new HttpsError("invalid-argument", "DISPUTE_ID_REQUIRED");
  }

  const { dispute } = await getDisputeForAdminOrParticipant(cleanDisputeId, uid);
  const currentStatus = String(dispute.status || "").trim().toLowerCase();
  const adminAccess = await isAdminUid(uid);

  return {
    ok: true,
    disputeId: cleanDisputeId,
    currentStatus,
    allowedTransitions: getAllowedDisputeTransitions(currentStatus),
    allowedActions: getAllowedDisputeActions({
      currentStatus,
      isAdmin: adminAccess,
    }),
  };
});

exports.getDisputeSummaryEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const cleanDisputeId = String(req.data?.disputeId || "").trim();
  if (!cleanDisputeId) {
    throw new HttpsError("invalid-argument", "DISPUTE_ID_REQUIRED");
  }

  const { dispute } = await getDisputeForAdminOrParticipant(cleanDisputeId, uid);
  const currentStatus = String(dispute.status || "").trim().toLowerCase();
  const adminAccess = await isAdminUid(uid);

  return {
    ok: true,
    summary: {
      ...toPlainDispute(cleanDisputeId, dispute),
      currentStatus,
      allowedTransitions: getAllowedDisputeTransitions(currentStatus),
      allowedActions: getAllowedDisputeActions({
        currentStatus,
        isAdmin: adminAccess,
      }),
    },
  };
});

exports.getDisputeStatusRulesEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const statuses = [...ADMIN_DISPUTE_STATUS_VALUES];
  const transitions = Object.fromEntries(
    statuses.map((status) => [status, getAllowedDisputeTransitions(status)])
  );

  return {
    ok: true,
    statuses,
    transitions,
  };
});

exports.getDisputeCatalogEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const rawRole = req.data?.role;
  const catalogResult = await loadDisputeCatalog();
  if (!catalogResult.catalog || typeof catalogResult.catalog !== "object") {
    throw new HttpsError("failed-precondition", "DISPUTE_CATALOG_NOT_FOUND");
  }

  if (rawRole === undefined || rawRole === null) {
    return {
      ok: true,
      sourcePath: catalogResult.sourcePath,
      sourceField: catalogResult.sourceField,
      catalog: catalogResult.catalog,
    };
  }

  const cleanRole = String(rawRole).trim().toLowerCase();
  const roleCatalog = findObjectValueByNormalizedKey(catalogResult.catalog, cleanRole);
  if (!cleanRole || !roleCatalog) {
    throw new HttpsError("invalid-argument", "ROLE_NOT_FOUND");
  }

  return {
    ok: true,
    role: cleanRole,
    sourcePath: catalogResult.sourcePath,
    sourceField: catalogResult.sourceField,
    catalog: roleCatalog,
  };
});

exports.listDisputeCatalogRolesEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const catalogResult = await loadDisputeCatalog();
  if (!catalogResult.catalog || typeof catalogResult.catalog !== "object") {
    throw new HttpsError("failed-precondition", "DISPUTE_CATALOG_NOT_FOUND");
  }

  return {
    ok: true,
    sourcePath: catalogResult.sourcePath,
    sourceField: catalogResult.sourceField,
    roles: Object.keys(catalogResult.catalog),
  };
});

exports.listDisputeCatalogCategoriesEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const role = String(req.data?.role || "").trim();
  if (!role) {
    throw new HttpsError("invalid-argument", "ROLE_REQUIRED");
  }

  const catalogResult = await loadDisputeCatalog();
  if (!catalogResult.catalog || typeof catalogResult.catalog !== "object") {
    throw new HttpsError("failed-precondition", "DISPUTE_CATALOG_NOT_FOUND");
  }

  const roleCatalog =
    findObjectValueByNormalizedKey(catalogResult.catalog, normalizeKey(role)) ||
    findObjectValueByNormalizedKey(catalogResult.catalog, role);
  if (!roleCatalog || typeof roleCatalog !== "object") {
    throw new HttpsError("invalid-argument", "ROLE_NOT_FOUND");
  }

  return {
    ok: true,
    role: normalizeKey(role),
    sourcePath: catalogResult.sourcePath,
    sourceField: catalogResult.sourceField,
    categories: Object.keys(roleCatalog),
  };
});

exports.listDisputeCatalogReasonCodesEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const role = String(req.data?.role || "").trim();
  const category = String(req.data?.category || "").trim();

  if (!role) {
    throw new HttpsError("invalid-argument", "ROLE_REQUIRED");
  }
  if (!category) {
    throw new HttpsError("invalid-argument", "CATEGORY_REQUIRED");
  }

  const catalogResult = await loadDisputeCatalog();
  if (!catalogResult.catalog || typeof catalogResult.catalog !== "object") {
    throw new HttpsError("failed-precondition", "DISPUTE_CATALOG_NOT_FOUND");
  }

  const roleNode =
    findObjectValueByNormalizedKey(catalogResult.catalog, normalizeKey(role)) ||
    findObjectValueByNormalizedKey(catalogResult.catalog, role);
  if (!roleNode || typeof roleNode !== "object") {
    throw new HttpsError("invalid-argument", "ROLE_NOT_FOUND");
  }

  const categoryNode = findCategoryNode(roleNode, category);
  const reasonContainer = unwrapReasonContainer(categoryNode);
  if (!reasonContainer) {
    throw new HttpsError("invalid-argument", "CATEGORY_NOT_FOUND");
  }

  return {
    ok: true,
    role: normalizeKey(role),
    category: normalizeKey(category),
    sourcePath: catalogResult.sourcePath,
    sourceField: catalogResult.sourceField,
    reasons: getReasonItems(reasonContainer),
  };
});

exports.validateDisputeSelectionEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const role = String(req.data?.role || "").trim();
  const category = String(req.data?.category || "").trim();
  const reasonCode = String(req.data?.reasonCode || "").trim();

  if (!role) {
    throw new HttpsError("invalid-argument", "ROLE_REQUIRED");
  }
  if (!category) {
    throw new HttpsError("invalid-argument", "CATEGORY_REQUIRED");
  }
  if (!reasonCode) {
    throw new HttpsError("invalid-argument", "REASON_CODE_REQUIRED");
  }

  const catalogResult = await loadDisputeCatalog();
  if (!catalogResult.catalog || typeof catalogResult.catalog !== "object") {
    throw new HttpsError("failed-precondition", "DISPUTE_CATALOG_NOT_FOUND");
  }

  const normRole = normalizeKey(role);
  const normReasonCode = reasonCode.trim().toUpperCase();
  const roleNode =
    findObjectValueByNormalizedKey(catalogResult.catalog, normRole) ||
    findObjectValueByNormalizedKey(catalogResult.catalog, role);
  if (!roleNode) {
    throw new HttpsError("invalid-argument", "ROLE_NOT_FOUND");
  }

  const categoryNode = findCategoryNode(roleNode, category);
  const reasonContainer = unwrapReasonContainer(categoryNode);
  if (!reasonContainer) {
    throw new HttpsError("invalid-argument", "CATEGORY_NOT_FOUND");
  }

  const reasonItems = getReasonItems(reasonContainer);
  const matchedItem = reasonItems.find(
    (item) => String(getReasonCodeValue(item)).trim().toUpperCase() === normReasonCode
  );
  if (!matchedItem) {
    throw new HttpsError("invalid-argument", "REASON_CODE_NOT_FOUND");
  }

  return {
    ok: true,
    role: normRole,
    category: normalizeKey(category),
    reasonCode: normReasonCode,
    ...(matchedItem.label !== undefined ? { matchedLabel: matchedItem.label } : {}),
    matchedReason: matchedItem,
  };
});

exports.listDisputesAdminEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  await assertAdmin(uid);

  const rawStatus = req.data?.status;
  const rawLimit = req.data?.limit;

  let cleanStatus = null;
  if (rawStatus !== undefined && rawStatus !== null) {
    cleanStatus = String(rawStatus).trim().toLowerCase();
    if (!ADMIN_DISPUTE_STATUS_VALUES.includes(cleanStatus)) {
      throw new HttpsError("invalid-argument", "UNSUPPORTED_STATUS");
    }
  }

  let safeLimit = 50;
  if (rawLimit !== undefined && rawLimit !== null) {
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > DISPUTE_LIST_LIMIT_CAP) {
      throw new HttpsError("invalid-argument", "INVALID_LIMIT");
    }
    safeLimit = rawLimit;
  }

  let query = db.collection("disputes");
  if (cleanStatus) {
    query = query.where("status", "==", cleanStatus);
  }

  const snap = await query.limit(safeLimit).get();
  const disputes = snap.docs.map((doc) => toPlainDispute(doc.id, doc.data() || {}));

  return {
    ok: true,
    count: disputes.length,
    disputes,
  };
});

exports.listMyDisputesEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const rawStatus = req.data?.status;
  const rawLimit = req.data?.limit;

  let cleanStatus = null;
  if (rawStatus !== undefined && rawStatus !== null) {
    cleanStatus = String(rawStatus).trim().toLowerCase();
    if (!DISPUTE_STATUS_VALUES.includes(cleanStatus)) {
      throw new HttpsError("invalid-argument", "UNSUPPORTED_STATUS");
    }
  }

  let safeLimit = 50;
  if (rawLimit !== undefined && rawLimit !== null) {
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > DISPUTE_LIST_LIMIT_CAP) {
      throw new HttpsError("invalid-argument", "INVALID_LIMIT");
    }
    safeLimit = rawLimit;
  }

  if (await isAdminUid(uid)) {
    let query = db.collection("disputes");
    if (cleanStatus) {
      query = query.where("status", "==", cleanStatus);
    }

    const snap = await query.limit(safeLimit).get();
    const disputes = snap.docs.map((doc) => toPlainDispute(doc.id, doc.data() || {}));

    return {
      ok: true,
      count: disputes.length,
      disputes,
    };
  }

  const ownerFields = ["createdByUid", "customerUid", "driverUid", "openedByUid"];
  const disputesById = new Map();

  for (const field of ownerFields) {
    let query = db.collection("disputes").where(field, "==", uid);
    if (cleanStatus) {
      query = query.where("status", "==", cleanStatus);
    }

    const snap = await query.limit(safeLimit).get();
    for (const doc of snap.docs) {
      if (!disputesById.has(doc.id)) {
        disputesById.set(doc.id, toPlainDispute(doc.id, doc.data() || {}));
      }
    }
  }

  const disputes = Array.from(disputesById.values()).slice(0, safeLimit);

  return {
    ok: true,
    count: disputes.length,
    disputes,
  };
});

exports.reopenDisputeEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const cleanDisputeId = String(req.data?.disputeId || "").trim();
  if (!cleanDisputeId) {
    throw new HttpsError("invalid-argument", "DISPUTE_ID_REQUIRED");
  }

  await assertAdmin(uid);

  const disputeRef = db.collection("disputes").doc(cleanDisputeId);
  const disputeSnap = await disputeRef.get();
  if (!disputeSnap.exists) {
    throw new HttpsError("not-found", "DISPUTE_NOT_FOUND");
  }

  const dispute = disputeSnap.data() || {};
  if (dispute.status !== "resolved") {
    throw new HttpsError("invalid-argument", "DISPUTE_STATUS_NOT_REOPENABLE");
  }

  await disputeRef.update({
    status: "open",
    updatedAt: TS,
    statusUpdatedAt: TS,
  });

  return {
    ok: true,
    disputeId: cleanDisputeId,
    status: "open",
  };
});

exports.closeDisputeEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const cleanDisputeId = String(req.data?.disputeId || "").trim();
  if (!cleanDisputeId) {
    throw new HttpsError("invalid-argument", "DISPUTE_ID_REQUIRED");
  }

  await assertAdmin(uid);

  const disputeRef = db.collection("disputes").doc(cleanDisputeId);
  const disputeSnap = await disputeRef.get();
  if (!disputeSnap.exists) {
    throw new HttpsError("not-found", "DISPUTE_NOT_FOUND");
  }

  const dispute = disputeSnap.data() || {};
  if (dispute.status !== "resolved") {
    throw new HttpsError("invalid-argument", "DISPUTE_STATUS_NOT_CLOSABLE");
  }

  await disputeRef.update({
    status: "closed",
    updatedAt: TS,
    statusUpdatedAt: TS,
  });

  return {
    ok: true,
    disputeId: cleanDisputeId,
    status: "closed",
  };
});

exports.rejectDisputeEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const cleanDisputeId = String(req.data?.disputeId || "").trim();
  if (!cleanDisputeId) {
    throw new HttpsError("invalid-argument", "DISPUTE_ID_REQUIRED");
  }

  await assertAdmin(uid);

  const disputeRef = db.collection("disputes").doc(cleanDisputeId);
  const disputeSnap = await disputeRef.get();
  if (!disputeSnap.exists) {
    throw new HttpsError("not-found", "DISPUTE_NOT_FOUND");
  }

  const dispute = disputeSnap.data() || {};
  if (!REJECT_DISPUTE_ALLOWED_PRIOR_STATUS_VALUES.includes(dispute.status)) {
    throw new HttpsError("invalid-argument", "DISPUTE_STATUS_NOT_REJECTABLE");
  }

  await disputeRef.update({
    status: "rejected",
    updatedAt: TS,
    statusUpdatedAt: TS,
  });

  return {
    ok: true,
    disputeId: cleanDisputeId,
    status: "rejected",
  };
});

exports.setDisputeInReviewEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const cleanDisputeId = String(req.data?.disputeId || "").trim();
  if (!cleanDisputeId) {
    throw new HttpsError("invalid-argument", "DISPUTE_ID_REQUIRED");
  }

  await assertAdmin(uid);

  const disputeRef = db.collection("disputes").doc(cleanDisputeId);
  const disputeSnap = await disputeRef.get();
  if (!disputeSnap.exists) {
    throw new HttpsError("not-found", "DISPUTE_NOT_FOUND");
  }

  const dispute = disputeSnap.data() || {};
  if (!IN_REVIEW_ALLOWED_PRIOR_STATUS_VALUES.includes(dispute.status)) {
    throw new HttpsError("invalid-argument", "DISPUTE_STATUS_NOT_IN_REVIEWABLE");
  }

  await disputeRef.update({
    status: "in_review",
    updatedAt: TS,
    statusUpdatedAt: TS,
  });

  return {
    ok: true,
    disputeId: cleanDisputeId,
    status: "in_review",
  };
});

exports.reopenRejectedDisputeEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const cleanDisputeId = String(req.data?.disputeId || "").trim();
  if (!cleanDisputeId) {
    throw new HttpsError("invalid-argument", "DISPUTE_ID_REQUIRED");
  }

  await assertAdmin(uid);

  const disputeRef = db.collection("disputes").doc(cleanDisputeId);
  const disputeSnap = await disputeRef.get();
  if (!disputeSnap.exists) {
    throw new HttpsError("not-found", "DISPUTE_NOT_FOUND");
  }

  const dispute = disputeSnap.data() || {};
  if (dispute.status !== "rejected") {
    throw new HttpsError("invalid-argument", "DISPUTE_STATUS_NOT_REOPENABLE_FROM_REJECTED");
  }

  await disputeRef.update({
    status: REOPEN_REJECTED_DISPUTE_TARGET_STATUS,
    updatedAt: TS,
    statusUpdatedAt: TS,
  });

  return {
    ok: true,
    disputeId: cleanDisputeId,
    status: REOPEN_REJECTED_DISPUTE_TARGET_STATUS,
  };
});

exports.reopenClosedDisputeEU = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  const cleanDisputeId = String(req.data?.disputeId || "").trim();
  if (!cleanDisputeId) {
    throw new HttpsError("invalid-argument", "DISPUTE_ID_REQUIRED");
  }

  await assertAdmin(uid);

  const disputeRef = db.collection("disputes").doc(cleanDisputeId);
  const disputeSnap = await disputeRef.get();
  if (!disputeSnap.exists) {
    throw new HttpsError("not-found", "DISPUTE_NOT_FOUND");
  }

  const dispute = disputeSnap.data() || {};
  if (dispute.status !== "closed") {
    throw new HttpsError("invalid-argument", "DISPUTE_STATUS_NOT_REOPENABLE_FROM_CLOSED");
  }

  await disputeRef.update({
    status: REOPEN_CLOSED_DISPUTE_TARGET_STATUS,
    updatedAt: TS,
    statusUpdatedAt: TS,
  });

  return {
    ok: true,
    disputeId: cleanDisputeId,
    status: REOPEN_CLOSED_DISPUTE_TARGET_STATUS,
  };
});
