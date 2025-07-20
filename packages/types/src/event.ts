export interface MessageRetry {
  attempt: number;
  maxAttempts: number;
  backoffMs: number;
}
export interface MessageAck {
  acknowledgedBy: string[];
  expectedFrom: string[];
}

const MessageStatus = ['pending', 'processing', 'acknowledged', 'failed'] as const;
export type MessageStatus = typeof MessageStatus[number];

export interface MessageDelivery {
  lastAttemptAt?: string;
  status: MessageStatus;
  lastError?: string;
}

export interface MessageEnvelope<TPayload = unknown, TResult = unknown> {
  id: string;
  type: string;
  data: TPayload;
  createdAt: string;
  retry: MessageRetry;
  response?: {
    streamId: string;
    expectsAck: boolean;
  };
  ack?: MessageAck;
  delivery?: MessageDelivery;
  deadLetterReason?: string;
}