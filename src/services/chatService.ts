import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { request, getAccessToken } from './apiClient';

export interface ChatRoomDto {
  id: string;
  postId: string;
  postTitle?: string;
  postImageUrl?: string;
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

// System negotiation offer structure if backend sends JSON inside "SYSTEM: ..."
export interface SystemOfferPayload {
  type: 'OFFER';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  price: number;
  negotiationId: string;
}

export function parseSystemMessage(content: string): { isSystem: boolean; cleanText: string; offer?: SystemOfferPayload } {
  if (!content) return { isSystem: false, cleanText: '' };
  
  const trimmed = content.trim();
  if (trimmed.startsWith('SYSTEM:')) {
    const rawBody = trimmed.replace(/^SYSTEM:\s*/i, '').trim();
    // Try parse as JSON (in case it is an OFFER payload)
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed && parsed.type === 'OFFER') {
        return {
          isSystem: true,
          cleanText: rawBody,
          offer: parsed as SystemOfferPayload
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
  private client: Client | null = null;
  private messageListeners = new Set<(msg: ChatMessageDto) => void>();
  private connectionStatusListeners = new Set<(connected: boolean) => void>();
  private isConnecting = false;

  private getWsUrl(): string {
    const rawEnv =
      (import.meta as any).env?.VITE_API_BASE_URL ||
      (import.meta as any).env?.VITE_API_ORIGIN ||
      'http://localhost:8080';
    const origin = rawEnv.replace(/\/api(\/v1)?\/?$/, '').replace(/\/+$/, '');
    return `${origin}/ws`;
  }

  public connect(): void {
    const token = getAccessToken();
    if (!token) {
      console.warn('[ChatWS] Cannot connect: No access token available');
      return;
    }

    if (this.client?.active || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    const wsUrl = this.getWsUrl();
    const createSockJS = (url: string) => {
      const SockJSFactory = (SockJS as any)?.default || SockJS;
      return new SockJSFactory(url);
    };

    this.client = new Client({
      webSocketFactory: () => createSockJS(wsUrl),
      beforeConnect: () => {
        const currentToken = getAccessToken();
        if (currentToken && this.client) {
          this.client.connectHeaders = {
            Authorization: `Bearer ${currentToken}`,
          };
        }
      },
      debug: (_str) => {
        console.log('[STOMP]', _str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        this.isConnecting = false;
        this.notifyStatus(true);

        // Subscribe to user personal queue
        this.client?.subscribe('/user/queue/messages', (message) => {
          try {
            console.log('[ChatWS] Received raw STOMP message:', message.body);
            const body: ChatMessageDto = JSON.parse(message.body);
            this.notifyMessage(body);
          } catch (err) {
            console.error('[ChatWS] Failed to parse incoming message body:', err);
          }
        });
      },
      onStompError: (frame) => {
        this.isConnecting = false;
        console.error('[ChatWS] Broker reported error:', frame.headers['message'], frame.body);
        this.notifyStatus(false);
        const currentToken = getAccessToken();
        if (currentToken) {
          request('/users/me', { requiresAuth: true }).catch(() => {});
        }
      },
      onWebSocketClose: () => {
        this.isConnecting = false;
        this.notifyStatus(false);
        // Ping to trigger apiClient.ts 401 interceptors in case the close was due to token expiration
        const currentToken = getAccessToken();
        if (currentToken) {
          request('/users/me', { requiresAuth: true }).catch(() => {});
        }
      },
      onWebSocketError: (evt: Event) => {
        this.isConnecting = false;
        console.error('[ChatWS] WebSocket error:', evt);
        const currentToken = getAccessToken();
        if (currentToken) {
          request('/users/me', { requiresAuth: true }).catch(() => {});
        }
      },
    });

    try {
      this.client.activate();
    } catch (err) {
      this.isConnecting = false;
      console.error('[ChatWS] Activation failed:', err);
    }
  }

  public disconnect(): void {
    if (this.client) {
      try {
        this.client.deactivate();
      } catch (err) {
        console.warn('[ChatWS] Error during deactivation:', err);
      }
      this.client = null;
    }
    this.isConnecting = false;
    this.notifyStatus(false);
  }

  public isConnected(): boolean {
    return !!this.client?.connected;
  }

  public subscribe(listener: (msg: ChatMessageDto) => void): () => void {
    this.messageListeners.add(listener);
    if (!this.client?.active && !this.isConnecting) {
      this.connect();
    }
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  public onStatusChange(listener: (connected: boolean) => void): () => void {
    this.connectionStatusListeners.add(listener);
    listener(this.isConnected());
    return () => {
      this.connectionStatusListeners.delete(listener);
    };
  }

  private notifyMessage(msg: ChatMessageDto): void {
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
    const response = await request<ChatRoomDto[]>('/v1/chats', {
      method: 'GET',
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
    return ((response as any)?.data !== undefined && (response as any)?.data !== null
      ? (response as any).data
      : response) as ChatMessageDto;
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
