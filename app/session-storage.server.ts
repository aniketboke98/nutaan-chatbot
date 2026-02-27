import type { Session } from "@shopify/shopify-api";
import prisma from "./db.server";

/**
 * Custom MongoDB-compatible Shopify session storage.
 *
 * Why not PrismaSessionStorage?
 * @shopify/shopify-app-session-storage-prisma passes `id` in the `update`
 * block of upsert — MongoDB forbids updating `_id` (immutable). This
 * custom adapter removes `id` from the update block to fix that.
 */
export class MongoDBSessionStorage {
  async storeSession(session: Session): Promise<boolean> {
    try {
      const { id, ...updateData } = sessionToRecord(session);
      await prisma.session.upsert({
        where: { id },
        // ← id intentionally excluded from update (MongoDB _id is immutable)
        update: updateData,
        create: { id, ...updateData },
      });
      return true;
    } catch (error) {
      console.error("[Session] storeSession error:", error);
      return false;
    }
  }

  async loadSession(id: string): Promise<Session | undefined> {
    try {
      const record = await prisma.session.findUnique({ where: { id } });
      if (!record) return undefined;
      return recordToSession(record);
    } catch (error) {
      console.error("[Session] loadSession error:", error);
      return undefined;
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    try {
      await prisma.session.delete({ where: { id } });
      return true;
    } catch (error) {
      // If not found, it's already gone — treat as success
      return true;
    }
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    try {
      await prisma.session.deleteMany({ where: { id: { in: ids } } });
      return true;
    } catch (error) {
      console.error("[Session] deleteSessions error:", error);
      return false;
    }
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    try {
      const records = await prisma.session.findMany({ where: { shop } });
      return records.map(recordToSession);
    } catch (error) {
      console.error("[Session] findSessionsByShop error:", error);
      return [];
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sessionToRecord(session: Session) {
  return {
    id: session.id,
    shop: session.shop,
    state: session.state,
    isOnline: session.isOnline,
    scope: session.scope ?? null,
    expires: session.expires ?? null,
    accessToken: session.accessToken ?? "",
    userId: session.onlineAccessInfo?.associated_user?.id
      ? BigInt(session.onlineAccessInfo.associated_user.id)
      : null,
    firstName: session.onlineAccessInfo?.associated_user?.first_name ?? null,
    lastName: session.onlineAccessInfo?.associated_user?.last_name ?? null,
    email: session.onlineAccessInfo?.associated_user?.email ?? null,
    accountOwner:
      session.onlineAccessInfo?.associated_user?.account_owner ?? false,
    locale: session.onlineAccessInfo?.associated_user?.locale ?? null,
    collaborator:
      session.onlineAccessInfo?.associated_user?.collaborator ?? false,
    emailVerified:
      session.onlineAccessInfo?.associated_user?.email_verified ?? false,
    // @ts-ignore - refreshToken may not be typed in all SDK versions
    refreshToken: (session as any).refreshToken ?? null,
    // @ts-ignore
    refreshTokenExpires: (session as any).refreshTokenExpires ?? null,
  };
}

function recordToSession(record: any): Session {
  const { Session } = require("@shopify/shopify-api");
  const session = new Session({
    id: record.id,
    shop: record.shop,
    state: record.state,
    isOnline: record.isOnline,
  });
  if (record.scope) session.scope = record.scope;
  if (record.expires) session.expires = new Date(record.expires);
  if (record.accessToken) session.accessToken = record.accessToken;
  // @ts-ignore
  if (record.refreshToken) session.refreshToken = record.refreshToken;
  // @ts-ignore
  if (record.refreshTokenExpires)
    session.refreshTokenExpires = new Date(record.refreshTokenExpires);

  if (record.userId) {
    session.onlineAccessInfo = {
      associated_user_scope: record.scope ?? "",
      expires_in: 0,
      associated_user: {
        id: Number(record.userId),
        first_name: record.firstName ?? "",
        last_name: record.lastName ?? "",
        email: record.email ?? "",
        account_owner: record.accountOwner,
        locale: record.locale ?? "",
        collaborator: record.collaborator ?? false,
        email_verified: record.emailVerified ?? false,
      },
    };
  }
  return session;
}
