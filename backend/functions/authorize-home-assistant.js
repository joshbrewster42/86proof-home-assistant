"use strict";

const { createHash } = require("node:crypto");

const CLIENT_TYPE = "home_assistant";
const INVITE_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const INSTALLATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RATE_LIMIT_COLLECTION = "_proof86_rate_limits";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMITS = Object.freeze({
  ip: 20,
  code: 60,
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeInviteCode(value) {
  return typeof value === "string" ? value.toUpperCase().trim() : "";
}

function deriveViewerUid(barId, installationId) {
  return `ha_${sha256(`${barId}\0${installationId.toLowerCase()}`)}`;
}

function rateLimitDocumentId(scope, value) {
  return `ha_${scope}_${sha256(`${scope}\0${value}`)}`;
}

function nextRateLimitState(current, nowMs, limit) {
  const windowStartedAtMs = Number(current?.windowStartedAtMs);
  const attempts = Number(current?.attempts);
  if (
    !Number.isFinite(windowStartedAtMs) ||
    nowMs - windowStartedAtMs >= RATE_LIMIT_WINDOW_MS
  ) {
    return {
      attempts: 1,
      windowStartedAtMs: nowMs,
      expiresAt: new Date(nowMs + RATE_LIMIT_WINDOW_MS * 2),
    };
  }
  if (Number.isFinite(attempts) && attempts >= limit) {
    return null;
  }
  return {
    attempts: Number.isFinite(attempts) ? attempts + 1 : 1,
    windowStartedAtMs,
    expiresAt: new Date(windowStartedAtMs + RATE_LIMIT_WINDOW_MS * 2),
  };
}

async function enforceRateLimits({
  db,
  rawRequest,
  inviteCode,
  installationId,
  HttpsError,
}) {
  const ip = rawRequest?.ip || `unknown:${installationId}`;
  const checks = [
    {
      scope: "ip",
      value: ip,
      limit: RATE_LIMITS.ip,
    },
    {
      scope: "code",
      value: inviteCode,
      limit: RATE_LIMITS.code,
    },
  ];
  const refs = checks.map(({ scope, value }) =>
    db
      .collection(RATE_LIMIT_COLLECTION)
      .doc(rateLimitDocumentId(scope, value)),
  );

  await db.runTransaction(async (transaction) => {
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    const nowMs = Date.now();
    const states = checks.map(({ limit }, index) =>
      nextRateLimitState(
        snapshots[index].exists ? snapshots[index].data() : undefined,
        nowMs,
        limit,
      ),
    );
    if (states.includes(null)) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many authorization attempts. Try again later.",
      );
    }
    refs.forEach((ref, index) => transaction.set(ref, states[index]));
  });
}

async function ensureViewerUser(auth, viewerUid, displayName) {
  try {
    await auth.getUser(viewerUid);
    await auth.updateUser(viewerUid, { displayName, disabled: false });
    return;
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }
  }

  try {
    await auth.createUser({
      uid: viewerUid,
      displayName,
      disabled: false,
    });
  } catch (error) {
    if (error?.code !== "auth/uid-already-exists") {
      throw error;
    }
    await auth.updateUser(viewerUid, { displayName, disabled: false });
  }
}

function invalidShareCode(HttpsError) {
  return new HttpsError(
    "not-found",
    "The share code is invalid or inactive.",
  );
}

function createAuthorizeHomeAssistant({
  onCall,
  HttpsError,
  db,
  auth,
  FieldValue,
}) {
  return onCall({ invoker: "public" }, async (request) => {
    const data =
      request.data && typeof request.data === "object" ? request.data : {};
    const inviteCode = normalizeInviteCode(data.inviteCode);
    const installationId =
      typeof data.installationId === "string"
        ? data.installationId.trim()
        : "";
    const displayName =
      typeof data.displayName === "string" ? data.displayName.trim() : "";
    const expectedBarId =
      typeof data.expectedBarId === "string" ? data.expectedBarId.trim() : null;

    if (
      !INVITE_CODE_PATTERN.test(inviteCode) ||
      !INSTALLATION_ID_PATTERN.test(installationId) ||
      displayName.length < 1 ||
      displayName.length > 60 ||
      (expectedBarId !== null &&
        (expectedBarId.length < 1 || expectedBarId.length > 128))
    ) {
      throw new HttpsError("invalid-argument", "Invalid authorization request.");
    }

    await enforceRateLimits({
      db,
      rawRequest: request.rawRequest,
      inviteCode,
      installationId,
      HttpsError,
    });

    const matchingBars = await db
      .collection("shared_bars")
      .where("inviteCode", "==", inviteCode)
      .limit(2)
      .get();
    if (matchingBars.size !== 1) {
      throw invalidShareCode(HttpsError);
    }

    const resolvedBar = matchingBars.docs[0];
    if (expectedBarId !== null && expectedBarId !== resolvedBar.id) {
      throw invalidShareCode(HttpsError);
    }

    const viewerUid = deriveViewerUid(resolvedBar.id, installationId);
    await ensureViewerUser(auth, viewerUid, displayName);

    let barName;
    await db.runTransaction(async (transaction) => {
      const currentBar = await transaction.get(resolvedBar.ref);
      if (
        !currentBar.exists ||
        currentBar.data().inviteCode !== inviteCode
      ) {
        throw invalidShareCode(HttpsError);
      }

      barName = currentBar.data().name || "Shared Bar";
      const memberRef = resolvedBar.ref.collection("members").doc(viewerUid);
      const existingMember = await transaction.get(memberRef);
      if (
        existingMember.exists &&
        (existingMember.data().role === "owner" ||
          (existingMember.data().clientType &&
            existingMember.data().clientType !== CLIENT_TYPE))
      ) {
        throw new HttpsError(
          "permission-denied",
          "Viewer identity cannot be reused.",
        );
      }

      transaction.set(memberRef, {
        role: "viewer",
        displayName,
        userId: viewerUid,
        barName,
        clientType: CLIENT_TYPE,
        installationIdHash: sha256(installationId.toLowerCase()),
        joinedAt:
          existingMember.data()?.joinedAt || FieldValue.serverTimestamp(),
      });
    });

    const customToken = await auth.createCustomToken(viewerUid, {
      clientType: CLIENT_TYPE,
    });
    return {
      barId: resolvedBar.id,
      barName,
      viewerUid,
      customToken,
    };
  });
}

module.exports = {
  createAuthorizeHomeAssistant,
  deriveViewerUid,
  nextRateLimitState,
  normalizeInviteCode,
  rateLimitDocumentId,
};
