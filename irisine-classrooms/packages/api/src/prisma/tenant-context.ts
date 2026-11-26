import { AsyncLocalStorage } from 'async_hooks';

export interface TenantStore {
  /** The school all queries are limited to. Not set = no limit (login, platform owner, scripts). */
  schoolId?: string;
  /** id lists looked up once per request, see tenant-scope.ts */
  lists: Map<string, Promise<string[]>>;
  /** "Model:id" of rows this request already read or wrote through the school filter */
  own: Set<string>;
}

const storage = new AsyncLocalStorage<TenantStore>();
const fresh = (schoolId?: string): TenantStore => ({ schoolId, lists: new Map(), own: new Set() });

/** Which school the current request works for. Prisma reads this on every query. */
export const tenantContext = {
  store: () => storage.getStore(),

  /** Starts a request: unlimited until the user is authenticated. */
  run<T>(fn: () => T): T {
    return storage.run(fresh(), fn);
  },

  /**
   * Limits the rest of the current request to one school (`undefined` lifts the limit).
   * `userId` is the signed-in user, who belongs to that school.
   */
  setSchool(schoolId: string | undefined, userId?: string) {
    const store = storage.getStore();
    if (!store) return;
    store.schoolId = schoolId;
    store.lists.clear();
    store.own.clear();
    if (userId) store.own.add(`User:${userId}`);
  },

  /** Runs queries as a user of `schoolId` would. */
  asSchool<T>(schoolId: string, fn: () => PromiseLike<T>): Promise<T> {
    // awaited inside: a Prisma query only starts when it is awaited
    return storage.run(fresh(schoolId), async () => await fn());
  },

  /** Runs queries across all schools, e.g. to check that an email is free anywhere on the platform. */
  allSchools<T>(fn: () => PromiseLike<T>): Promise<T> {
    return storage.run(fresh(), async () => await fn());
  },
};
