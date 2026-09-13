/**
 * SSE Service — Frontend client for Server-Sent Events
 *
 * Connects to the SSE Gateway for real-time notifications.
 * Falls back to Supabase Realtime if SSE is unavailable.
 *
 * Usage:
 *   import { SSEService } from "./lib/sseService";
 *
 *   const sse = new SSEService(userEmail, (notification) => {
 *     console.log("New notification:", notification);
 *   });
 *
 *   sse.connect();
 *   // later...
 *   sse.disconnect();
 */

type SSENotification = {
  type: string;
  from?: string;
  timestamp: string;
  groupName?: string;
  payerName?: string;
  expenseDescription?: string;
  [key: string]: unknown;
};

type SSECallback = (notification: SSENotification) => void;

const SSE_BASE_URL = import.meta.env.VITE_SSE_URL || "";

export class SSEService {
  private userEmail: string;
  private onNotification: SSECallback;
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isConnected = false;

  constructor(userEmail: string, onNotification: SSECallback) {
    this.userEmail = userEmail.toLowerCase();
    this.onNotification = onNotification;
  }

  /**
   * Open the SSE connection.
   */
  connect(): void {
    if (this.eventSource) {
      this.disconnect();
    }

    const url = `${SSE_BASE_URL}/events/${encodeURIComponent(this.userEmail)}`;

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log("[SSE] Connected");
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };

      // Handle the initial "connected" event
      this.eventSource.addEventListener("connected", (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        console.log("[SSE] Channel ready:", data.channel);
      });

      // Handle notification messages
      this.eventSource.onmessage = (event) => {
        try {
          const notification: SSENotification = JSON.parse(event.data);
          this.onNotification(notification);
        } catch (err) {
          console.warn("[SSE] Failed to parse message:", event.data);
        }
      };

      this.eventSource.onerror = () => {
        console.warn("[SSE] Connection error — will auto-reconnect");
        this.isConnected = false;

        // EventSource auto-reconnects, but we track attempts
        this.reconnectAttempts++;

        if (this.reconnectAttempts > this.maxReconnectAttempts) {
          console.error("[SSE] Max reconnect attempts reached — disconnecting");
          this.disconnect();
        }
      };
    } catch (err) {
      console.error("[SSE] Failed to create EventSource:", err);
    }
  }

  /**
   * Close the SSE connection.
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
      console.log("[SSE] Disconnected");
    }
  }

  /**
   * Returns whether the SSE connection is currently open.
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Returns the number of reconnect attempts since last successful connection.
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}

/**
 * React hook-style factory — create and manage an SSE connection.
 *
 * Usage in a component:
 *   useEffect(() => {
 *     const sse = createSSEConnection(userEmail, handleNotification);
 *     return () => sse.disconnect();
 *   }, [userEmail]);
 */
export function createSSEConnection(
  userEmail: string,
  onNotification: SSECallback
): SSEService {
  const service = new SSEService(userEmail, onNotification);
  service.connect();
  return service;
}
