export interface User {
  id: number;
  email: string;
  username: string;
  role: string;
  balance: number;
  is_active: boolean;
  is_verified: boolean;
  totp_enabled: boolean;
  avatar_url: string | null;
  bio: string | null;
  bsc_wallet_address: string | null;
  created_at: string;
}

export interface Algorithm {
  id: number;
  name: string;
  display_name: string;
  unit: string;
  description: string | null;
  is_active: boolean;
}

export interface Rig {
  id: number;
  owner_id: number;
  name: string;
  description: string | null;
  algorithm_id: number;
  algorithm: Algorithm | null;
  owner: UserPublic | null;
  hashrate: number;
  price_per_hour: number;
  min_rental_hours: number;
  max_rental_hours: number;
  status: string;
  region: string;
  uptime_percentage: number;
  total_rentals: number;
  average_rating: number;
  stratum_host: string | null;
  stratum_port: number | null;
  worker_prefix: string | null;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface RigListResponse {
  items: Rig[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface Rental {
  id: number;
  rig_id: number;
  rig_name: string | null;
  renter_id: number;
  renter: UserPublic | null;
  owner_id: number;
  owner: UserPublic | null;
  algorithm_id: number;
  algorithm_name: string | null;
  hashrate: number;
  price_per_hour: number;
  duration_hours: number | null;
  total_cost: number;
  status: string;
  pool_url: string | null;
  pool_user: string | null;
  pool_password: string | null;
  started_at: string | null;
  ends_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RentalListResponse {
  items: Rental[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface Transaction {
  id: number;
  user_id: number;
  type: string;
  amount: number;
  fee: number;
  status: string;
  tx_hash: string | null;
  wallet_address: string | null;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface TransactionListResponse {
  items: Transaction[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  unread_count: number;
}

export interface Review {
  id: number;
  rental_id: number;
  rig_id: number;
  reviewer_id: number;
  reviewer: UserPublic | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface UserPublic {
  id: number;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AdminStats {
  total_users: number;
  total_rigs: number;
  total_rentals: number;
  total_revenue: number;
  active_rentals: number;
  pending_withdrawals: number;
}

export interface PlatformSetting {
  id: number;
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}
