/**
 * Date Invitation Service for OURS
 * Manages date invitations between partners:
 * - pending: awaiting response
 * - accepted: both partners accepted the date
 * - declined: invitation declined
 */

import { appStorage } from '../storage/keyValueStorage';
import { apiClient } from '../api/apiClient';
import { extractStarDateKey } from '../sky/skyService';

export type DateInvitationStatus = 'pending' | 'accepted' | 'declined' | 'completed';

export interface DateInvitationIdea {
  id: string;
  title: string;
  description: string;
  tag: string;
}

export interface DateInvitation {
  id: string;
  pairId?: string;
  senderUserId?: string;
  senderId: 'user' | 'partner';
  senderName: string;
  recipientName: string;
  idea: DateInvitationIdea;
  status: DateInvitationStatus;
  createdAt: string;
  respondedAt?: string;
  completedAt?: string;
  dateKey?: string;
  photoUrl?: string;
  momentId?: string;
  read: boolean;
}

const STORAGE_KEY = 'ours_date_invitation_v1';
const ACCEPTED_DATES_KEY = 'ours_accepted_date_keys_v1';
const LISTENERS: Set<(invitation: DateInvitation | null) => void> = new Set();

function notifyListeners(invitation: DateInvitation | null) {
  LISTENERS.forEach((listener) => {
    try {
      listener(invitation);
    } catch (e) {
      console.error('[DateInvitationService] Listener error:', e);
    }
  });
}

/**
 * Returns recorded calendar days with completed dates (photo preserved), scoped by pairId.
 * Rule: NO star before photo! Only dates that have confirmed completed status with photo.
 */
export function getRecordedDateDays(pairId?: string): string[] {
  try {
    const keys = new Set<string>();
    const cleanPairId = pairId?.trim();

    const currentInv = dateInvitationService.getInvitation();
    const matchesPair =
      !cleanPairId || !currentInv?.pairId || currentInv.pairId.trim() === cleanPairId;

    // STRICT RULE: Only award date star if the date is fully completed with a photo!
    if (currentInv && matchesPair && currentInv.status === 'completed' && currentInv.photoUrl) {
      const dateStr = currentInv.completedAt || currentInv.respondedAt || currentInv.createdAt;
      const key = extractStarDateKey(currentInv.dateKey, dateStr);
      if (key) {
        keys.add(key);
      }
    }

    if (cleanPairId) {
      try {
        const rawLocalDates = appStorage.getItem(`ours_local_date_moments_${cleanPairId}`);
        if (typeof rawLocalDates === 'string' && rawLocalDates) {
          const localMoments = JSON.parse(rawLocalDates);
          if (Array.isArray(localMoments)) {
            for (const lm of localMoments) {
              const hasPhoto = Boolean(
                lm &&
                  (lm.imageUrl ||
                    lm.userPhoto ||
                    lm.partnerPhoto ||
                    (Array.isArray(lm.photos) && lm.photos.length > 0))
              );
              if (hasPhoto) {
                const k = extractStarDateKey(lm.dateKey, lm.completedAt || lm.createdAt);
                if (k) keys.add(k);
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    return Array.from(keys).sort();
  } catch {
    return [];
  }
}

export const dateInvitationService = {
  /**
   * Get recorded calendar days with accepted/completed dates
   */
  getCompletedDateDays(pairId?: string): string[] {
    return getRecordedDateDays(pairId);
  },

  /**
   * Get currently active date invitation from storage.
   * Returns null if no date invitation has been created yet.
   */
  getInvitation(_partnerName = 'Партнёр', _userName = 'Ты'): DateInvitation | null {
    try {
      const stored = appStorage.getItem(STORAGE_KEY);
      if (typeof stored === 'string') {
        const parsed = JSON.parse(stored) as DateInvitation;
        if (parsed && parsed.id && parsed.status && parsed.id !== 'inv-init-1' && parsed.id !== 'inv-test-accepted-1') {
          if (typeof parsed.read === 'undefined') {
            parsed.read = false;
          }
          return parsed;
        }
      }
    } catch {
      // fallback
    }

    return null;
  },

  /**
   * Test helper: simulates partner accepting user's invitation immediately
   */
  simulatePartnerAcceptInvitation(pairId?: string, partnerName = 'Партнёр', userName = 'Ты'): DateInvitation {
    const existing = this.getInvitation(partnerName, userName);
    const accepted: DateInvitation = {
      id: existing?.id || `inv-${Date.now()}`,
      pairId: pairId || existing?.pairId,
      senderId: 'user',
      senderName: userName || 'Ты',
      recipientName: partnerName || 'Партнёр',
      idea: existing?.idea || {
        id: 'idea-board-games',
        title: 'Вечер настольных игр при свечах',
        description: 'Уютный вечер вдвоём: тёплый чай, любимые настолки и мерцание свечей.',
        tag: 'Уют',
      },
      status: 'accepted',
      createdAt: existing?.createdAt || new Date().toISOString(),
      respondedAt: new Date().toISOString(),
      read: true,
    };

    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(accepted));
    } catch {}

    notifyListeners(accepted);
    return accepted;
  },

  /**
   * Check if there is an unread incoming invitation from partner
   */
  hasUnreadIncomingInvitation(): boolean {
    try {
      const stored = appStorage.getItem(STORAGE_KEY);
      if (typeof stored === 'string') {
        const parsed = JSON.parse(stored) as DateInvitation;
        return Boolean(
          parsed &&
          parsed.id !== 'inv-init-1' &&
          parsed.status === 'pending' &&
          parsed.senderId === 'partner' &&
          !parsed.read
        );
      }
    } catch {
      // ignore
    }
    return false;
  },

  /**
   * Sync invitation received from server / realtime poll
   */
  syncFromServer(
    serverInv: any,
    currentUserId?: string | null,
    currentUserName?: string | null,
    _partnerName?: string | null
  ): DateInvitation | null {
    if (!serverInv || !serverInv.id) {
      const existing = this.getInvitation();
      if (existing) {
        const createdAgo = Date.now() - new Date(existing.createdAt).getTime();
        // Only clear if invitation is old, preventing race conditions during fresh creation
        if (createdAgo > 60000) {
          appStorage.removeItem(STORAGE_KEY);
          notifyListeners(null);
        }
      }
      return null;
    }

    // Determine if THIS device is the creator (sender) or the recipient
    const localInv = this.getInvitation();

    // Prevent stale server poll from overwriting a brand-new local invitation created < 30s ago
    if (localInv && localInv.id !== serverInv.id && localInv.senderId === 'user') {
      const localCreatedMs = new Date(localInv.createdAt).getTime();
      const serverCreatedMs = serverInv.createdAt ? new Date(serverInv.createdAt).getTime() : 0;
      if (
        !isNaN(localCreatedMs) &&
        Date.now() - localCreatedMs < 30000 &&
        (!serverCreatedMs || localCreatedMs > serverCreatedMs)
      ) {
        return localInv;
      }
    }

    let isSender = false;

    if (localInv && localInv.id === serverInv.id && localInv.senderId === 'user') {
      // 1. This device created this exact invitation locally
      isSender = true;
    } else if (localInv && localInv.id === serverInv.id && localInv.senderId === 'partner') {
      // 2. This device previously received this exact invitation as incoming
      isSender = false;
    } else if (currentUserId && serverInv.senderUserId) {
      // 3. Match against authenticated / assigned User ID
      isSender = String(serverInv.senderUserId).trim() === String(currentUserId).trim();
    } else if (currentUserId && serverInv.recipientUserId) {
      // 4. Match against recipient User ID
      isSender = String(serverInv.recipientUserId).trim() !== String(currentUserId).trim();
    } else if (currentUserName && serverInv.senderName && serverInv.recipientName) {
      // 5. Match against display names
      const myName = String(currentUserName).trim().toLowerCase();
      const sName = String(serverInv.senderName).trim().toLowerCase();
      const rName = String(serverInv.recipientName).trim().toLowerCase();
      if (myName && sName && myName === sName && myName !== rName) {
        isSender = true;
      } else if (myName && rName && myName === rName && myName !== sName) {
        isSender = false;
      }
    }

    const isSameLocalCompleted =
      Boolean(localInv && localInv.id === serverInv.id && localInv.status === 'completed' && localInv.photoUrl);

    const resolvedStatus: DateInvitationStatus =
      serverInv.status === 'completed' || isSameLocalCompleted
        ? 'completed'
        : serverInv.status || 'pending';

    const resolvedPhotoUrl =
      serverInv.photoUrl ||
      serverInv.photo_url ||
      (isSameLocalCompleted ? localInv?.photoUrl : undefined);

    const resolvedCompletedAt =
      serverInv.completedAt ||
      serverInv.completed_at ||
      (isSameLocalCompleted ? localInv?.completedAt : undefined);

    const resolvedMomentId =
      serverInv.momentId ||
      serverInv.moment_id ||
      (isSameLocalCompleted ? localInv?.momentId : undefined);

    const resolvedDateKey =
      extractStarDateKey(
        serverInv.dateKey || serverInv.date_key || (isSameLocalCompleted ? localInv?.dateKey : undefined),
        resolvedCompletedAt || serverInv.respondedAt || serverInv.createdAt
      ) || undefined;

    const formatted: DateInvitation = {
      id: serverInv.id,
      pairId: serverInv.pairId || serverInv.pair_id || localInv?.pairId,
      senderUserId: serverInv.senderUserId || serverInv.creator_user_id,
      senderId: isSender ? 'user' : 'partner',
      senderName: serverInv.senderName || serverInv.sender_name || (isSender ? (currentUserName || 'Ты') : 'Партнёр'),
      recipientName: serverInv.recipientName || serverInv.recipient_name || (isSender ? 'Партнёр' : (currentUserName || 'Ты')),
      idea: serverInv.idea,
      status: resolvedStatus,
      createdAt: serverInv.createdAt || serverInv.created_at || new Date().toISOString(),
      respondedAt: serverInv.respondedAt || serverInv.responded_at || (isSameLocalCompleted ? localInv?.respondedAt : undefined),
      completedAt: resolvedCompletedAt,
      dateKey: resolvedDateKey,
      photoUrl: resolvedPhotoUrl,
      momentId: resolvedMomentId,
      // Sender always has read = true.
      // Recipient has read = true if server or local says it was read.
      read: isSender ? true : Boolean(serverInv.readByRecipient || serverInv.read_by_recipient || (localInv?.id === serverInv.id && localInv?.read)),
    };

    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(formatted));

      if (formatted.status === 'completed' && formatted.photoUrl) {
        const key = extractStarDateKey(
          formatted.dateKey,
          formatted.completedAt || formatted.respondedAt || formatted.createdAt
        );
        if (key) {
          const raw = appStorage.getItem(ACCEPTED_DATES_KEY);
          const list: string[] = typeof raw === 'string' && raw ? JSON.parse(raw) : [];
          if (!list.includes(key)) {
            list.push(key);
            appStorage.setItem(ACCEPTED_DATES_KEY, JSON.stringify(list));
          }
        }
      }
    } catch {
      // ignore
    }

    notifyListeners(formatted);
    return formatted;
  },

  /**
   * Mark incoming invitation as read (called when recipient opens the invitation scene)
   */
  markAsRead(id: string, pairId?: string): DateInvitation | null {
    try {
      const stored = appStorage.getItem(STORAGE_KEY);
      if (typeof stored === 'string') {
        const parsed = JSON.parse(stored) as DateInvitation;
        if (parsed && parsed.id === id && !parsed.read) {
          const updated: DateInvitation = {
            ...parsed,
            read: true,
          };
          appStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          notifyListeners(updated);

          const targetPairId = pairId || parsed.pairId;
          if (targetPairId) {
            apiClient.markDateInvitationAsRead(targetPairId).catch(() => {});
          }

          return updated;
        }
        return parsed;
      }
    } catch (e) {
      console.error('[DateInvitationService] MarkAsRead error:', e);
    }
    return null;
  },

  /**
   * Send a new date invitation (created by current user)
   */
  sendInvitation(
    idea: DateInvitationIdea,
    userName: string,
    partnerName: string,
    pairId?: string,
    senderUserId?: string,
    recipientUserId?: string
  ): DateInvitation {
    const invId = `inv-${Date.now()}`;
    const invitation: DateInvitation = {
      id: invId,
      pairId,
      senderUserId: senderUserId || apiClient.getCurrentUserId() || '',
      senderId: 'user',
      senderName: userName || 'Ты',
      recipientName: partnerName || 'Партнёр',
      idea,
      status: 'pending',
      createdAt: new Date().toISOString(),
      read: true, // Sender has seen their own invitation
    };

    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(invitation));
    } catch (e) {
      console.error('[DateInvitationService] Save error:', e);
    }

    notifyListeners(invitation);

    if (pairId) {
      apiClient.sendDateInvitation({
        pairId,
        id: invId,
        senderUserId: senderUserId || apiClient.getCurrentUserId() || '',
        senderName: userName || 'Ты',
        recipientUserId: recipientUserId || '',
        recipientName: partnerName || 'Партнёр',
        idea,
      }).catch((err) => {
        console.warn('[DateInvitationService] Failed to send to server:', err);
      });
    }

    return invitation;
  },

  /**
   * Accept an invitation (moves to accepted state; NOTE: star is awarded ONLY after photo is saved!)
   */
  acceptInvitation(id?: string, pairId?: string): DateInvitation | null {
    try {
      const stored = appStorage.getItem(STORAGE_KEY);
      if (typeof stored === 'string') {
        const parsed = JSON.parse(stored) as DateInvitation;
        if (parsed && (parsed.id === id || !id || parsed.id)) {
          const updated: DateInvitation = {
            ...parsed,
            status: 'accepted',
            read: true,
            respondedAt: new Date().toISOString(),
          };
          appStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

          notifyListeners(updated);

          const targetPairId = pairId || parsed.pairId;
          if (targetPairId) {
            apiClient.respondToDateInvitation(targetPairId, 'accepted').catch(() => {});
          }

          return updated;
        }
      }
    } catch (e) {
      console.error('[DateInvitationService] Accept error:', e);
    }
    return null;
  },

  /**
   * Complete date with joint photo -> marks date as completed, stores photo, and awards star!
   */
  completeDateWithPhoto(
    id: string,
    photoUrl: string,
    momentId?: string,
    pairId?: string
  ): DateInvitation | null {
    try {
      const stored = appStorage.getItem(STORAGE_KEY);
      let parsed: DateInvitation | null = null;
      if (typeof stored === 'string' && stored) {
        try {
          parsed = JSON.parse(stored) as DateInvitation;
        } catch {}
      }

      const nowIso = new Date().toISOString();
      const resolvedDateKey = extractStarDateKey(parsed?.dateKey, nowIso) || undefined;
      const updated: DateInvitation = {
        id: parsed?.id || id || `inv-${Date.now()}`,
        pairId: pairId || parsed?.pairId,
        senderUserId: parsed?.senderUserId,
        senderId: parsed?.senderId || 'user',
        senderName: parsed?.senderName || 'Ты',
        recipientName: parsed?.recipientName || 'Партнёр',
        idea: parsed?.idea || {
          id: 'date-idea',
          title: 'Свидание',
          description: 'Романтический момент вдвоём',
          tag: 'Романтика',
        },
        status: 'completed',
        photoUrl,
        momentId,
        dateKey: resolvedDateKey,
        createdAt: parsed?.createdAt || nowIso,
        respondedAt: parsed?.respondedAt || nowIso,
        completedAt: nowIso,
        read: true,
      };

      appStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      // Record accepted calendar day key into history ONLY AFTER confirmed photo
      try {
        if (resolvedDateKey) {
          const raw = appStorage.getItem(ACCEPTED_DATES_KEY);
          const list: string[] = typeof raw === 'string' && raw ? JSON.parse(raw) : [];
          if (!list.includes(resolvedDateKey)) {
            list.push(resolvedDateKey);
            appStorage.setItem(ACCEPTED_DATES_KEY, JSON.stringify(list));
          }
        }
      } catch {}

      notifyListeners(updated);
      return updated;
    } catch (e) {
      console.error('[DateInvitationService] CompleteWithPhoto error:', e);
    }
    return null;
  },

  /**
   * Decline an invitation
   */
  declineInvitation(id?: string, pairId?: string): DateInvitation | null {
    try {
      const stored = appStorage.getItem(STORAGE_KEY);
      if (typeof stored === 'string') {
        const parsed = JSON.parse(stored) as DateInvitation;
        if (parsed && (parsed.id === id || !id || parsed.id)) {
          const updated: DateInvitation = {
            ...parsed,
            status: 'declined',
            read: true,
            respondedAt: new Date().toISOString(),
          };
          appStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          notifyListeners(updated);

          const targetPairId = pairId || parsed.pairId;
          if (targetPairId) {
            apiClient.respondToDateInvitation(targetPairId, 'declined').catch(() => {});
          }

          return updated;
        }
      }
    } catch (e) {
      console.error('[DateInvitationService] Decline error:', e);
    }
    return null;
  },

  /**
   * Clear or reset invitation
   */
  clearInvitation(pairId?: string): void {
    const existing = this.getInvitation();
    const targetPairId = pairId || existing?.pairId;
    try {
      appStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    notifyListeners(null);

    if (targetPairId) {
      apiClient.clearDateInvitation(targetPairId).catch(() => {});
    }
  },

  /**
   * Subscribe to date invitation updates
   */
  subscribe(listener: (invitation: DateInvitation | null) => void): () => void {
    LISTENERS.add(listener);
    return () => {
      LISTENERS.delete(listener);
    };
  },
};
