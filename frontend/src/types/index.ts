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
  ltc_wallet_address: string | null;
  deposit_address: string | null;
  referral_code: string | null;
  created_at: string;
}

export interface Algorithm {
  id: number;
  name: string;
  display_name: string;
  unit: string;
  description: string | null;
  coins: string | null;
  diff_suggested: number | null;
  diff_min: number | null;
  diff_max: number | null;
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
  // MRR features
  rpi_score: number;
  suggested_difficulty: string | null;
  optimal_diff_min: number | null;
  optimal_diff_max: number | null;
  ndevices: number;
  extensions_enabled: boolean;
  auto_price_enabled: boolean;
  auto_price_margin: number;
  owner_pool_url: string | null;
  owner_pool_user: string | null;
  owner_pool_password: string | null;
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
  rig_region: string | null;
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
  escrow_amount: number;
  escrow_released: boolean;
  status: string;
  // 5-pool failover
  pool_url: string | null;
  pool_user: string | null;
  pool_password: string | null;
  pool2_url: string | null;
  pool2_user: string | null;
  pool2_password: string | null;
  pool3_url: string | null;
  pool3_user: string | null;
  pool3_password: string | null;
  pool4_url: string | null;
  pool4_user: string | null;
  pool4_password: string | null;
  pool5_url: string | null;
  pool5_user: string | null;
  pool5_password: string | null;
  // Extension info
  original_duration_hours: number | null;
  extended_hours: number;
  extension_cost: number;
  extensions_disabled: boolean;
  // Share-based refund
  expected_shares: number;
  actual_shares: number;
  rejected_shares: number;
  refund_amount: number;
  refund_reason: string | null;
  reviewed_at: string | null;
  // RPI snapshot
  rpi_at_start: number | null;
  // Performance
  actual_hashrate_avg: number | null;
  performance_percent: number | null;
  // Timestamps
  dispute_window_ends: string | null;
  started_at: string | null;
  ends_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PoolProfile {
  id: number;
  user_id: number;
  name: string;
  algorithm_id: number | null;
  algorithm_name: string | null;
  pool_url: string;
  pool_user: string;
  pool_password: string;
  // 5-pool failover
  pool2_url: string | null;
  pool2_user: string | null;
  pool2_password: string | null;
  pool3_url: string | null;
  pool3_user: string | null;
  pool3_password: string | null;
  pool4_url: string | null;
  pool4_user: string | null;
  pool4_password: string | null;
  pool5_url: string | null;
  pool5_user: string | null;
  pool5_password: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface RentalMessage {
  id: number;
  rental_id: number;
  sender_id: number;
  sender_username: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface RentalConversation {
  rental_id: number;
  rig_name: string;
  status: string;
  other_username: string | null;
  other_id: number | null;
  role: 'renter' | 'owner';
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
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

export interface DisputeMessage {
  id: number;
  sender_id: number;
  sender_username: string | null;
  content: string;
  created_at: string;
}

// Legacy general messaging types (deprecated - use rental communications instead)
export interface MessageItem {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  user_id: number;
  username: string;
  avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export interface Dispute {
  id: number;
  rental_id: number;
  opened_by: number;
  opener_username: string | null;
  reason: string;
  status: string;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
  messages: DisputeMessage[];
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
