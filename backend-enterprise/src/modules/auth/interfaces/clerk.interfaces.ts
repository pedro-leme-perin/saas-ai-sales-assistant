// src/modules/auth/interfaces/clerk.interfaces.ts

export interface ClerkJwtPayload {
  /** Authorized party - URL do cliente */
  azp: string;
  
  /** Expiration time */
  exp: number;
  
  /** First-party verification data */
  fva?: [number, number];
  
  /** Issued at */
  iat: number;
  
  /** Issuer - URL do Clerk */
  iss: string;
  
  /** Not before */
  nbf: number;
  
  /** Session ID */
  sid: string;
  
  /** Status - 'active' | 'ended' */
  sts: string;
  
  /** Subject - Clerk User ID (user_xxxxx) */
  sub: string;
  
  /** Version */
  v: number;
}

export interface ClerkWebhookEvent {
  data: ClerkUserData;
  object: 'event';
  type: ClerkWebhookEventType;
}

export type ClerkWebhookEventType = 
  | 'user.created'
  | 'user.updated'
  | 'user.deleted';

export interface ClerkUserData {
  id: string;
  object: 'user';
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string;
  has_image: boolean;
  primary_email_address_id: string | null;
  primary_phone_number_id: string | null;
  primary_web3_wallet_id: string | null;
  password_enabled: boolean;
  two_factor_enabled: boolean;
  totp_enabled: boolean;
  backup_code_enabled: boolean;
  email_addresses: ClerkEmailAddress[];
  phone_numbers: ClerkPhoneNumber[];
  external_accounts: ClerkExternalAccount[];
  public_metadata: Record<string, unknown>;
  private_metadata: Record<string, unknown>;
  unsafe_metadata: Record<string, unknown>;
  created_at: number;
  updated_at: number;
  last_sign_in_at: number | null;
}

export interface ClerkEmailAddress {
  id: string;
  object: 'email_address';
  email_address: string;
  verification: {
    status: string;
    strategy: string;
  };
  linked_to: Array<{ type: string; id: string }>;
}

export interface ClerkPhoneNumber {
  id: string;
  object: 'phone_number';
  phone_number: string;
  verification: {
    status: string;
    strategy: string;
  };
}

export interface ClerkExternalAccount {
  id: string;
  object: 'external_account';
  provider: string;
  identification_id: string;
  provider_user_id: string;
  email_address: string;
  first_name: string;
  last_name: string;
}

/** Dados mínimos para criar usuário no sistema */
export interface CreateUserFromClerkDto {
  clerkId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  phone?: string;
}
