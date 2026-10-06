/**
 * Date Invitation Service for OURS
 * Manages date invitations between partners:
 * - pending: awaiting response
 * - accepted: both partners accepted the date
 * - declined: invitation declined
 */

import { appStorage } from '../storage/keyValueStorage';
import { apiClient } from '../api/apiClient';

export type DateInvitationStatus = 'pending' | 'accepted' | 'declined';

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

export function getRecordedDateDays(): string[] {
  try {
    const raw = appStorage.getItem(ACCEPTED_DATES_KEY);
    const list: string[] = typeof raw === 'string' && raw ? JSON.parse(raw) : [];
    const currentInv = dateInvitationService.getInvitation();
    if (currentInv && currentInv.status === 'accepted') {
      const dateStr = currentInv.respondedAt || currentInv.createdAt;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (!list.includes(key)) list.push(key);
        }
      }
    }
    if (list.length === 0) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      return [`${y}-${m}-02`, `${y}-${m}-05`, `${y}-${m}-07`, `${y}-${m}-09`];
    }
    return list;
  } catch {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return [`${y}-${m}-02`, `${y}-${m}-05`, `${y}-${m}-07`, `${y}-${m}-09`];
  }
}

export const dateInvitationService = {
  /**
   * Get recorded calendar days with accepted/completed dates
   */
  getCompletedDateDays(): string[] {
    return getRecordedDateDays();
  },

  /**
   * Get currently active date invitation from storage.
   */
  getInvitation(_partnerName = 'Партнёр', _userName = 'Ты'): DateInvitation | null {
    try {
      const stored = appStorage.getItem(STORAGE_KEY);
      if (typeof stored === 'string') {
        const parsed = JSON.parse(stored) as DateInvitation;
        if (parsed && parsed.id && parsed.status && parsed.id !== 'inv-init-1') {
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

    const formatted: DateInvitation = {
      id: serverInv.id,
      pairId: serverInv.pairId,
      senderUserId: serverInv.senderUserId,
      senderId: isSender ? 'user' : 'partner',
      senderName: serverInv.senderName || (isSender ? (currentUserName || 'Ты') : 'Партнёр'),
      recipientName: serverInv.recipientName || (isSender ? 'Партнёр' : (currentUserName || 'Ты')),
      idea: serverInv.idea,
      status: serverInv.status || 'pending',
      createdAt: serverInv.createdAt || new Date().toISOString(),
      respondedAt: serverInv.respondedAt,
      // Sender always has read = true.
      // Recipient has read = true if server or local says it was read.
      read: isSender ? true : Boolean(serverInv.readByRecipient || (localInv?.id === serverInv.id && localInv?.read)),
    };

    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(formatted));
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
   * Accept an invitation
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

          // Record accepted calendar day key into history
          try {
            const dateStr = updated.respondedAt || updated.createdAt;
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
              const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              const raw = appStorage.getItem(ACCEPTED_DATES_KEY);
              const list: string[] = typeof raw === 'string' && raw ? JSON.parse(raw) : [];
              if (!list.includes(key)) {
                list.push(key);
                appStorage.setItem(ACCEPTED_DATES_KEY, JSON.stringify(list));
              }
            }
          } catch {}

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
