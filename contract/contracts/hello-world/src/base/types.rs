use crate::base::events::{AuditAction, NotificationPriority};
use soroban_sdk::{contracttype, Address, BytesN, String, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AutoShareDetails {
    pub id: BytesN<32>,
    pub name: String,
    pub creator: Address,
    pub priority: NotificationPriority,
    pub usage_count: u32,
    pub total_usages_paid: u32,
    pub members: Vec<GroupMember>,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GroupMember {
    pub address: Address,
    pub percentage: u32,
}

/// A notification stored on-chain with a bounded lifetime.
///
/// The notification is considered **expired** — and therefore invalid for any
/// further interaction — once the ledger timestamp reaches `expires_at`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScheduledNotification {
    pub id: BytesN<32>,
    pub creator: Address,
    /// Ledger timestamp (seconds) at which the notification was scheduled.
    pub created_at: u64,
    /// Ledger timestamp (seconds) at or after which the notification is expired.
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentHistory {
    pub user: Address,
    pub group_id: BytesN<32>,
    pub usages_purchased: u32,
    pub amount_paid: i128,
    pub timestamp: u64,
}

/// Immutable record of a single notification lifecycle event.
///
/// Records are appended to persistent storage in order of occurrence and can
/// never be modified or deleted after creation, satisfying the audit-log
/// immutability requirement.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuditRecord {
    /// Sequential, 1-based index assigned at append time. Provides a stable
    /// ordering handle for range queries.
    pub seq: u64,
    /// The notification identifier this record belongs to (all-zeros for
    /// contract-level actions such as pause/unpause).
    pub notification_id: BytesN<32>,
    /// Which lifecycle stage this record represents.
    pub action: AuditAction,
    /// Who triggered the action (caller or creator).
    pub actor: Address,
    /// Ledger timestamp (seconds) when the action occurred.
    pub timestamp: u64,
}
