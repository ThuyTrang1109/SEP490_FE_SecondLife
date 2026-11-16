import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { NotificationItem } from '../types/notification';

function getWsUrl(): string {
  const rawEnv =
    (import.meta as any).env?.VITE_WS_URL ||
    (import.meta as any).env?.VITE_API_BASE_URL ||
    (import.meta as any).env?.VITE_API_ORIGIN ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080');
  const origin = rawEnv.replace(/\/api(\/v1)?\/?$/, '').replace(/\/+$/, '');
  return `${origin}/ws`;
}

export interface WalletPushEvent {
  balance?: number;
  newBalance?: number;
  amount?: number;
  type?: string;
  action?: string;
  transactionId?: string;
  userId?: string;
  timestamp?: string | number;
}

type NotificationListener = (item: NotificationItem) => void;
type WalletPushListener = (event: WalletPushEvent) => void;

class NotificationWebSocketClient {
  private client: Client | null = null;
  private listeners: Set<NotificationListener> = new Set();
  private walletListeners: Set<WalletPushListener> = new Set();
  private isConnecting: boolean = false;
  private currentToken: string | null = null;

  public subscribeListener(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeWalletListener(listener: WalletPushListener): () => void {
    this.walletListeners.add(listener);
    return () => {
      this.walletListeners.delete(listener);
    };
  }

  private handleIncomingWalletMessage(bodyStr: string) {
    try {
      const data: WalletPushEvent = typeof bodyStr === 'string' ? JSON.parse(bodyStr) : bodyStr;
      const balance = typeof data.balance === 'number' ? data.balance
        : typeof data.newBalance === 'number' ? data.newBalance
        : undefined;

      this.walletListeners.forEach((l) => {
        try {
          l(data);
        } catch (e) {
          console.error('Error in wallet listener:', e);
        }
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('secondlife_wallet_updated', {
            detail: {
              balance,
              data,
              source: 'websocket',
            },
          })
        );
        window.dispatchEvent(
          new CustomEvent('wallet_balance_updated', {
            detail: {
              balance,
              data,
              source: 'websocket',
            },
          })
        );
      }
    } catch (e) {
      console.warn('Failed to parse incoming wallet message:', e);
    }
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

        // 1. Subscribe kênh thông báo cá nhân của user
        this.client?.subscribe('/user/queue/notifications', (message: IMessage) => {
          try {
            const notification: NotificationItem = JSON.parse(message.body);
            // Notify all registered notification listeners
            this.listeners.forEach((listener) => {
              try {
                listener(notification);
              } catch (e) {
                console.error('Error in notification listener:', e);
              }
            });

            // Nếu notification là loại biến động ví / nạp tiền, kích hoạt cập nhật số dư ví
            const nType = String(notification.type || '').toUpperCase();
            const nRef = String(notification.referenceType || '').toUpperCase();
            if (
              nType.includes('WALLET') ||
              nType.includes('TOPUP') ||
              nRef.includes('WALLET') ||
              nRef.includes('TOPUP') ||
              notification.title?.toLowerCase().includes('ví') ||
              notification.message?.toLowerCase().includes('nạp tiền')
            ) {
              this.handleIncomingWalletMessage(message.body);
            }
          } catch (err) {
            console.error('Failed to parse incoming notification:', err);
          }
        });

        // 2. Subscribe kênh cập nhật số dư ví cá nhân (Phương án 1 - Push Event)
        this.client?.subscribe('/user/queue/wallet', (message: IMessage) => {
          this.handleIncomingWalletMessage(message.body);
        });

        // 3. Subscribe kênh biến động ví: /user/queue/wallet-updates
        this.client?.subscribe('/user/queue/wallet-updates', (message: IMessage) => {
          this.handleIncomingWalletMessage(message.body);
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
