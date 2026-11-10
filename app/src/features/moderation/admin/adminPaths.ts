// Pfade des Admin-Bereichs (eigener Rahmen mit Admin-Leiste, Phase 1)
export const ADMIN_BASE = '/moderation';
export const adminReport = (id: string) => `${ADMIN_BASE}/meldungen/${id}`;
export const adminUser = (uid: string) => `${ADMIN_BASE}/nutzer/${uid}`;
