/**
 * Date Invitation Service for OURS
 * Manages date invitations between partners:
 * - pending: awaiting response
 * - accepted: both partners accepted the date
 * - declined: invitation declined
 */

import { appStorage } from '../storage/keyValueStorage';

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
          // Ensure read property exists
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
   * Mark incoming invitation as read (called when recipient opens the invitation scene)
   */
  markAsRead(id: string): DateInvitation | null {
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
    pairId?: string
  ): DateInvitation {
    const invitation: DateInvitation = {
      id: `inv-${Date.now()}`,
      pairId,
      senderId: 'user',
      senderName: userName || 'Ты',
      recipientName: partnerName || 'Партнёр',
      idea,
      status: 'pending',
      createdAt: new Date().toISOString(),
      read: false,
    };

    try {
      appStorage.setItem(STORAGE_KEY, JSON.stringify(invitation));
    } catch (e) {
      console.error('[DateInvitationService] Save error:', e);
    }

    notifyListeners(invitation);
    return invitation;
  },

  /**
   * Accept an invitation
   */
  acceptInvitation(id: string): DateInvitation | null {
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
  declineInvitation(id: string): DateInvitation | null {
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
  clearInvitation(): void {
    try {
      appStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    notifyListeners(null);
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
