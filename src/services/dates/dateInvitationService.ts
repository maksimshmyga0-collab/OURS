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

export const dateInvitationService = {
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
  syncFromServer(serverInv: any, currentUserId: string | null): DateInvitation | null {
    if (!serverInv) {
      const existing = this.getInvitation();
      if (existing) {
        appStorage.removeItem(STORAGE_KEY);
        notifyListeners(null);
      }
      return null;
    }

    const isSender = Boolean(
      (currentUserId && serverInv.senderUserId === currentUserId) ||
      (!currentUserId && serverInv.senderId === 'user')
    );

    const formatted: DateInvitation = {
      id: serverInv.id || `inv-${Date.now()}`,
      pairId: serverInv.pairId,
      senderUserId: serverInv.senderUserId,
      senderId: isSender ? 'user' : 'partner',
      senderName: serverInv.senderName || (isSender ? 'Ты' : 'Партнёр'),
      recipientName: serverInv.recipientName || (isSender ? 'Партнёр' : 'Ты'),
      idea: serverInv.idea,
      status: serverInv.status || 'pending',
      createdAt: serverInv.createdAt || new Date().toISOString(),
      respondedAt: serverInv.respondedAt,
      // If current user is sender, read is always true for sender.
      // If current user is recipient, read is serverInv.readByRecipient (or local read state).
      read: isSender ? true : Boolean(serverInv.readByRecipient),
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
    senderUserId?: string
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
  acceptInvitation(id: string, pairId?: string): DateInvitation | null {
    try {
      const stored = appStorage.getItem(STORAGE_KEY);
      if (typeof stored === 'string') {
        const parsed = JSON.parse(stored) as DateInvitation;
        if (parsed && parsed.id === id) {
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
   * Decline an invitation
   */
  declineInvitation(id: string, pairId?: string): DateInvitation | null {
    try {
      const stored = appStorage.getItem(STORAGE_KEY);
      if (typeof stored === 'string') {
        const parsed = JSON.parse(stored) as DateInvitation;
        if (parsed && parsed.id === id) {
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
