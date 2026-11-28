import { notificationWsClient } from './notificationWsClient';
import { request, requestGet, getAccessToken } from './apiClient';

export interface ChatRoomDto {
  id: string;
  postId: string;
  postTitle?: string | null;
  postImageUrl?: string | null;
  postPrice?: number | null;
  postStatus?: string | null;
  buyerId: string;
  buyerName?: string;
  buyerAvatar?: string;
  sellerId: string;
  sellerName?: string;
  sellerAvatar?: string;
  lastMessage?: string;
  updatedAt?: string;
}

export interface ChatMessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  messageContent: string;
  sentAt: string;
}

export interface SendMessageRequest {
  messageContent: string;
}

import type { NegotiationStatusBackend, SystemInspectionProposalPayload } from '../types';

// System negotiation offer structure if backend sends JSON inside "SYSTEM: ..."
export interface SystemOfferPayload {
  type: 'OFFER';
  status: NegotiationStatusBackend;
  price: number;
  negotiationId?: string;
  senderRole?: 'buyer' | 'seller';
}

export function parseSystemMessage(content: string): {
  isSystem: boolean;
  cleanText: string;
  offer?: SystemOfferPayload;
  inspectionProposal?: SystemInspectionProposalPayload;
} {
  if (!content) return { isSystem: false, cleanText: '' };
  
  const trimmed = content.trim();
  if (trimmed.startsWith('SYSTEM:')) {
    const rawBody = trimmed.replace(/^SYSTEM:\s*/i, '').trim();
    // Try parse as JSON (OFFER or INSPECTION_PROPOSAL)
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed && parsed.type === 'OFFER') {
        return {
          isSystem: true,
          cleanText: rawBody,
          offer: parsed as SystemOfferPayload
        };
      }
      if (parsed && parsed.type === 'INSPECTION_PROPOSAL') {
        return {
          isSystem: true,
          cleanText: rawBody,
          inspectionProposal: parsed as SystemInspectionProposalPayload
        };
      }
    } catch {
      // Not JSON, just standard plain text
    }
    return {
      isSystem: true,
      cleanText: rawBody
    };
  }
  return { isSystem: false, cleanText: content };
}

// WebSocket Management
class ChatWebSocketManager {
  private messageListeners = new Set<(msg: ChatMessageDto) => void>();
  private connectionStatusListeners = new Set<(connected: boolean) => void>();
  private detach?: () => void;

  public connect(): void {
    const token = getAccessToken();
    if (!token) return;
    this.detach ??= notificationWsClient.subscribeChat(
      message => this.notifyMessage(message), connected => this.notifyStatus(connected)
    );
    notificationWsClient.connect(token);
  }

  public disconnect(): void {
    this.detach?.();
    this.detach = undefined;
    this.notifyStatus(false);
  }

  public isConnected(): boolean { return notificationWsClient.isConnected(); }

  public subscribe(listener: (msg: ChatMessageDto) => void): () => void {
    this.messageListeners.add(listener);
    this.connect();
    return () => this.messageListeners.delete(listener);
  }

  public onStatusChange(listener: (connected: boolean) => void): () => void {
    this.connectionStatusListeners.add(listener);
    listener(this.isConnected());
    return () => {
      this.connectionStatusListeners.delete(listener);
    };
  }

  public notifyMessage(msg: ChatMessageDto): void {
    this.messageListeners.forEach((fn) => {
      try {
        fn(msg);
      } catch (e) {
        console.error('[ChatWS] Listener error:', e);
      }
    });
  }

  private notifyStatus(connected: boolean): void {
    this.connectionStatusListeners.forEach((fn) => {
      try {
        fn(connected);
      } catch (e) {
        console.error('[ChatWS] Status listener error:', e);
      }
    });
  }
}

export const chatWsManager = new ChatWebSocketManager();

export const chatService = {
  /**
   * Lấy danh sách Inbox (Chat History) của người dùng hiện tại
   * GET /api/v1/chats
   */
  async getChatRooms(): Promise<ChatRoomDto[]> {
    const response = await requestGet<ChatRoomDto[]>('/v1/chats', {
      requiresAuth: true,
    });
    const data = (response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response;
    return Array.isArray(data) ? data : [];
  },

  /**
   * Khởi tạo hoặc tìm phòng chat từ một bài đăng
   * POST /api/v1/chats/rooms?postId={postId}
   */
  async getOrCreateRoom(postId: string): Promise<ChatRoomDto> {
    const response = await request<ChatRoomDto>(`/v1/chats/rooms?postId=${encodeURIComponent(postId)}`, {
      method: 'POST',
      requiresAuth: true,
    });
    return ((response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response) as ChatRoomDto;
  },

  /**
   * Lấy phòng chat hiện có (không tạo mới)
   * GET /api/v1/chats/rooms?postId={postId}
   */
  async getRoom(postId: string): Promise<ChatRoomDto | null> {
    try {
      const response = await request<ChatRoomDto | null>(`/v1/chats/rooms?postId=${postId}`, {
        method: 'GET',
        requiresAuth: true,
      });
      return ((response as any)?.data !== undefined ? (response as any).data : response) as ChatRoomDto | null;
    } catch {
      return null;
    }
  },

  /**
   * Tải lịch sử tin nhắn trong một phòng chat
   * GET /api/v1/chats/{roomId}/messages
   */
  async getMessages(roomId: string): Promise<ChatMessageDto[]> {
    const response = await request<ChatMessageDto[]>(`/v1/chats/${roomId}/messages`, {
      method: 'GET',
      requiresAuth: true,
    });
    const data = (response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response;
    return Array.isArray(data) ? data : [];
  },

  /**
   * Gửi tin nhắn mới vào phòng chat
   * POST /api/v1/chats/{roomId}/messages
   */
  async sendMessage(roomId: string, messageContent: string): Promise<ChatMessageDto> {
    const response = await request<ChatMessageDto>(`/v1/chats/${roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ messageContent }),
      requiresAuth: true,
    });
    const dto = (((response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response) as ChatMessageDto) || {
        id: `msg-${Date.now()}`,
        conversationId: roomId,
        senderId: '',
        messageContent,
        sentAt: new Date().toISOString()
      };

    try {
      chatWsManager.notifyMessage(dto);
      localStorage.setItem(`chat_room_latest_touch_${roomId}`, Date.now().toString());
      localStorage.setItem(`chat_room_latest_msg_${roomId}`, messageContent);
      window.dispatchEvent(
        new CustomEvent('chat_message_sent', {
          detail: { roomId, message: messageContent, timestamp: Date.now() }
        })
      );
    } catch {}

    return dto;
  },

  /**
   * Lắng nghe tin nhắn qua WebSocket
   */
  subscribeToMessages(callback: (msg: ChatMessageDto) => void): () => void {
    return chatWsManager.subscribe(callback);
  },

  /**
   * Kết nối WebSocket
   */
  connectWebSocket(): void {
    chatWsManager.connect();
  },

  /**
   * Ngắt kết nối WebSocket
   */
  disconnectWebSocket(): void {
    chatWsManager.disconnect();
  },

  /**
   * Kiểm tra trạng thái kết nối
   */
  isWebSocketConnected(): boolean {
    return chatWsManager.isConnected();
  },
};
