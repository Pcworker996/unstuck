import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";

export type GoogleQuotaLimits = {
  account: { model: number; artifact: number };
  global: { model: number; artifact: number };
};

export type GoogleQuotaReservation = {
  ownerSubject: string;
  day: string;
  reservationKey?: string;
  modelUnits: number;
  artifactUnits: number;
};

export type GoogleQuotaResult =
  | { allowed: true; modelUsed: number; artifactUsed: number }
  | { allowed: false; scope: "account" | "global"; resource: "model" | "artifact"; limit: number; message: string };

export type GoogleQuotaService = {
  reserve: (input: GoogleQuotaReservation) => Promise<GoogleQuotaResult>;
};

type Usage = { model: number; artifact: number };

export const DEFAULT_GOOGLE_QUOTA_LIMITS: GoogleQuotaLimits = {
  account: { model: 100, artifact: 10 },
  global: { model: 1_000, artifact: 100 }
};

export function createInMemoryGoogleQuotaService(
  limits: GoogleQuotaLimits = DEFAULT_GOOGLE_QUOTA_LIMITS
): GoogleQuotaService {
  const accountUsage = new Map<string, Usage>();
  const globalUsage = new Map<string, Usage>();
  const reservations = new Set<string>();

  return {
    async reserve(input) {
      const request = normalizedReservation(input);
      const reservationId = `${request.day}:${request.ownerSubject}:${request.reservationKey ?? ""}`;
      if (request.reservationKey && reservations.has(reservationId)) {
        const usage = accountUsage.get(`${request.day}:${request.ownerSubject}`) ?? emptyUsage();
        return { allowed: true, modelUsed: usage.model, artifactUsed: usage.artifact };
      }
      const account = accountUsage.get(`${request.day}:${request.ownerSubject}`) ?? emptyUsage();
      const global = globalUsage.get(request.day) ?? emptyUsage();
      const rejected = quotaFailure(account, limits.account, request, "account") ?? quotaFailure(global, limits.global, request, "global");
      if (rejected) return rejected;
      const nextAccount = addUsage(account, request);
      const nextGlobal = addUsage(global, request);
      accountUsage.set(`${request.day}:${request.ownerSubject}`, nextAccount);
      globalUsage.set(request.day, nextGlobal);
      if (request.reservationKey) reservations.add(reservationId);
      return { allowed: true, modelUsed: nextAccount.model, artifactUsed: nextAccount.artifact };
    }
  };
}

export function createFirestoreGoogleQuotaService(
  firestore: Firestore,
  limits: GoogleQuotaLimits = DEFAULT_GOOGLE_QUOTA_LIMITS
): GoogleQuotaService {
  return {
    async reserve(input) {
      const request = normalizedReservation(input);
      const globalReference = firestore.collection("runtimeQuotas").doc(`daily-${request.day}-global`);
      const accountReference = firestore.collection("runtimeQuotas").doc(`daily-${request.day}-account-${hashOwner(request.ownerSubject)}`);
      const reservationReference = firestore.collection("runtimeQuotaReservations").doc(hashReservation(request));
      return firestore.runTransaction(async (transaction) => {
        const accountSnapshot = await transaction.get(accountReference);
        const globalSnapshot = await transaction.get(globalReference);
        const reservationSnapshot = request.reservationKey
          ? await transaction.get(reservationReference)
          : undefined;
        if (request.reservationKey && reservationSnapshot?.exists) {
          const usage = usageFrom(accountSnapshot.data());
          return { allowed: true, modelUsed: usage.model, artifactUsed: usage.artifact };
        }
        const account = usageFrom(accountSnapshot.data());
        const global = usageFrom(globalSnapshot.data());
        const rejected = quotaFailure(account, limits.account, request, "account") ?? quotaFailure(global, limits.global, request, "global");
        if (rejected) return rejected;
        const nextAccount = addUsage(account, request);
        const nextGlobal = addUsage(global, request);
        transaction.set(accountReference, nextAccount, { merge: true });
        transaction.set(globalReference, nextGlobal, { merge: true });
        if (request.reservationKey) transaction.set(reservationReference, { reserved: true }, { merge: true });
        return { allowed: true, modelUsed: nextAccount.model, artifactUsed: nextAccount.artifact };
      });
    }
  };
}

export function googleQuotaLimitsFromEnvironment(env: NodeJS.ProcessEnv = process.env): GoogleQuotaLimits {
  return {
    account: {
      model: positiveLimit(env.GOOGLE_DAILY_MODEL_ACCOUNT_LIMIT, DEFAULT_GOOGLE_QUOTA_LIMITS.account.model),
      artifact: positiveLimit(env.GOOGLE_DAILY_ARTIFACT_ACCOUNT_LIMIT, DEFAULT_GOOGLE_QUOTA_LIMITS.account.artifact)
    },
    global: {
      model: positiveLimit(env.GOOGLE_DAILY_MODEL_GLOBAL_LIMIT, DEFAULT_GOOGLE_QUOTA_LIMITS.global.model),
      artifact: positiveLimit(env.GOOGLE_DAILY_ARTIFACT_GLOBAL_LIMIT, DEFAULT_GOOGLE_QUOTA_LIMITS.global.artifact)
    }
  };
}

function normalizedReservation(input: GoogleQuotaReservation): GoogleQuotaReservation {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) throw new Error("Quota day must be an ISO date.");
  if (!input.ownerSubject || !Number.isInteger(input.modelUnits) || !Number.isInteger(input.artifactUnits) || input.modelUnits < 0 || input.artifactUnits < 0) {
    throw new Error("Quota units must be non-negative whole numbers.");
  }
  return input;
}

function quotaFailure(usage: Usage, limit: Usage, request: GoogleQuotaReservation, scope: "account" | "global"): Extract<GoogleQuotaResult, { allowed: false }> | undefined {
  if (usage.model + request.modelUnits > limit.model) {
    return { allowed: false, scope, resource: "model", limit: limit.model, message: "The daily model-use quota is exhausted. Your valid protocol state is preserved; please continue tomorrow." };
  }
  if (usage.artifact + request.artifactUnits > limit.artifact) {
    return { allowed: false, scope, resource: "artifact", limit: limit.artifact, message: "The daily artifact-processing quota is exhausted. Your valid protocol state is preserved; please continue tomorrow." };
  }
  return undefined;
}

function emptyUsage(): Usage { return { model: 0, artifact: 0 }; }
function addUsage(usage: Usage, request: GoogleQuotaReservation): Usage {
  return { model: usage.model + request.modelUnits, artifact: usage.artifact + request.artifactUnits };
}
function usageFrom(value: FirebaseFirestore.DocumentData | undefined): Usage {
  return {
    model: typeof value?.model === "number" && value.model >= 0 ? value.model : 0,
    artifact: typeof value?.artifact === "number" && value.artifact >= 0 ? value.artifact : 0
  };
}
function hashOwner(ownerSubject: string): string {
  return createHash("sha256").update(ownerSubject).digest("hex").slice(0, 24);
}
function hashReservation(input: GoogleQuotaReservation): string {
  return createHash("sha256").update(`${input.day}:${input.ownerSubject}:${input.reservationKey ?? ""}`).digest("hex");
}
function positiveLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
