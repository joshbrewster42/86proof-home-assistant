"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createAuthorizeHomeAssistant,
  deriveViewerUid,
  nextRateLimitState,
  normalizeInviteCode,
  rateLimitDocumentId,
} = require("./authorize-home-assistant");

class FakeHttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function fakeBackend() {
  const writes = [];
  const memberRef = { kind: "member" };
  const barRef = {
    kind: "bar",
    collection: () => ({
      doc: () => memberRef,
    }),
  };
  const barDocument = {
    id: "bar-1",
    ref: barRef,
  };
  const db = {
    collection(name) {
      if (name === "_proof86_rate_limits") {
        return {
          doc: () => ({ kind: "rate" }),
        };
      }
      return {
        where: () => ({
          limit: () => ({
            get: async () => ({
              size: 1,
              docs: [barDocument],
            }),
          }),
        }),
      };
    },
    async runTransaction(callback) {
      return callback({
        async get(ref) {
          if (ref.kind === "bar") {
            return {
              exists: true,
              data: () => ({ inviteCode: "ABCDEFGH", name: "Home Bar" }),
            };
          }
          return {
            exists: false,
            data: () => undefined,
          };
        },
        set(ref, data) {
          writes.push({ ref, data });
        },
      });
    },
  };
  const authCalls = [];
  const auth = {
    async getUser() {
      authCalls.push("getUser");
      throw { code: "auth/user-not-found" };
    },
    async createUser() {
      authCalls.push("createUser");
    },
    async createCustomToken() {
      authCalls.push("createCustomToken");
      return "custom-token";
    },
  };
  const handler = createAuthorizeHomeAssistant({
    onCall: (_options, callback) => callback,
    HttpsError: FakeHttpsError,
    db,
    auth,
    FieldValue: {
      serverTimestamp: () => "server-timestamp",
    },
  });
  return { handler, writes, authCalls };
}

test("normalizes invite codes without weakening validation", () => {
  assert.equal(normalizeInviteCode(" abcdefgh "), "ABCDEFGH");
  assert.equal(normalizeInviteCode(null), "");
});

test("derives stable bar-scoped viewer UIDs", () => {
  const installationId = "cfeb1831-90c4-4d67-8d59-f1d74ff2c80d";
  const first = deriveViewerUid("bar-1", installationId);

  assert.equal(first, deriveViewerUid("bar-1", installationId.toUpperCase()));
  assert.notEqual(first, deriveViewerUid("bar-2", installationId));
  assert.match(first, /^ha_[0-9a-f]{64}$/);
});

test("rate-limit keys do not expose their input", () => {
  const key = rateLimitDocumentId("code", "ABCDEFGH");

  assert.match(key, /^ha_code_[0-9a-f]{64}$/);
  assert.equal(key.includes("ABCDEFGH"), false);
});

test("rate-limit windows increment, reject, and reset", () => {
  const startedAt = 1_000_000;
  const incremented = nextRateLimitState(
    { attempts: 2, windowStartedAtMs: startedAt },
    startedAt + 1,
    3,
  );

  assert.equal(incremented.attempts, 3);
  assert.equal(
    nextRateLimitState(incremented, startedAt + 2, 3),
    null,
  );

  const reset = nextRateLimitState(
    incremented,
    startedAt + 15 * 60 * 1000,
    3,
  );
  assert.equal(reset.attempts, 1);
  assert.equal(reset.windowStartedAtMs, startedAt + 15 * 60 * 1000);
});

test("creates a read-only member and returns a custom token", async () => {
  const { handler, writes, authCalls } = fakeBackend();
  const result = await handler({
    data: {
      inviteCode: "abcdefgh",
      installationId: "cfeb1831-90c4-4d67-8d59-f1d74ff2c80d",
      displayName: "Home Assistant",
    },
    rawRequest: { ip: "192.0.2.1" },
  });

  assert.deepEqual(result, {
    barId: "bar-1",
    barName: "Home Bar",
    viewerUid: deriveViewerUid(
      "bar-1",
      "cfeb1831-90c4-4d67-8d59-f1d74ff2c80d",
    ),
    customToken: "custom-token",
  });
  const membership = writes.find(({ ref }) => ref.kind === "member").data;
  assert.equal(membership.role, "viewer");
  assert.equal(membership.clientType, "home_assistant");
  assert.equal(membership.displayName, "Home Assistant");
  assert.deepEqual(authCalls, [
    "getUser",
    "createUser",
    "createCustomToken",
  ]);
});

test("rejects a different expected bar before creating an Auth user", async () => {
  const { handler, authCalls } = fakeBackend();

  await assert.rejects(
    handler({
      data: {
        inviteCode: "ABCDEFGH",
        installationId: "cfeb1831-90c4-4d67-8d59-f1d74ff2c80d",
        displayName: "Home Assistant",
        expectedBarId: "bar-2",
      },
      rawRequest: { ip: "192.0.2.1" },
    }),
    (error) => error.code === "not-found",
  );
  assert.deepEqual(authCalls, []);
});
