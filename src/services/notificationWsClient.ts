import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { NotificationItem } from '../types/notification';

function getWsUrl(): string {
  const rawEnv =
    (import.meta as any).env?.VITE_WS_URL ||
    (import.meta as any).env?.VITE_API_BASE_URL ||
    (import.meta as any).env?.VITE_API_ORIGIN ||
    'http://localhost:8080';
  const origin = rawEnv.replace(/\/api(\/v1)?\/?$/, '').replace(/\/+$/, '');
  return `${origin}/ws`;
}

type NotificationListener = (item: NotificationItem) => void;

class NotificationWebSocketClient {
  private client: Client | null = null;
  private listeners: Set<NotificationListener> = new Set();
  private isConnecting: boolean = false;
  private currentToken: string | null = null;

  public subscribeListener(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public connect(token: string) {
    if (!token) return;
    if (this.client?.active && this.currentToken === token) {
      return;
    }

    if (this.client) {
      this.disconnect();
    }

    this.currentToken = token;
    this.isConnecting = true;
    const wsUrl = getWsUrl();

    try {
      this.client = new Client({
        webSocketFactory: () => {
          const SockJSConstructor = (SockJS as any).default || SockJS;
          return new SockJSConstructor(wsUrl);
        },
        connectHeaders: {
          Authorization: `Bearer ${token}`,
        },
        debug: (str) => {
          if (import.meta.env.DEV && false) {
            console.log('[STOMP Debug]', str);
          }
        },
        reconnectDelay: 5000, // Tự động reconnect sau 5 giây nếu đứt kết nối
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
      });

      this.client.onConnect = () => {
        this.isConnecting = false;
        console.log('✅ Connected to SecondLife WebSocket STOMP notification server');

        // Subscribe kênh cá nhân của user
        this.client?.subscribe('/user/queue/notifications', (message: IMessage) => {
          try {
            const notification: NotificationItem = JSON.parse(message.body);
            // Notify all registered listeners
            this.listeners.forEach((listener) => {
              try {
                listener(notification);
              } catch (e) {
                console.error('Error in notification listener:', e);
              }
            });
          } catch (err) {
            console.error('Failed to parse incoming notification:', err);
          }
        });
      };

      this.client.onStompError = (frame) => {
        this.isConnecting = false;
        console.warn('⚠️ Notification STOMP broker error:', frame.headers['message']);
      };

      this.client.onWebSocketError = (err) => {
        this.isConnecting = false;
        console.warn('⚠️ Notification WebSocket transport error:', err);
      };

      this.client.activate();
    } catch (err) {
      this.isConnecting = false;
      console.warn('⚠️ Could not initialize WebSocket client:', err);
    }
  }

  public disconnect() {
    if (this.client) {
      try {
        if (this.client.active) {
          this.client.deactivate();
        }
      } catch (e) {
        console.warn('Error during WebSocket disconnect:', e);
      }
      this.client = null;
      this.currentToken = null;
      this.isConnecting = false;
      console.log('🔌 Disconnected Notification WebSocket');
    }
  }

  public isConnected(): boolean {
    return !!this.client?.active;
  }
}

export const notificationWsClient = new NotificationWebSocketClient();
