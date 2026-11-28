# Step 01 and Step 02 progress

## Integration

- Baseline: `integration/thh-unified-baseline-v1`, `02e35dcd61510a125fbf73aba6e6705b12face85`.
- PR #39 carries the PR #29 design-system foundation and reconciled Claude dashboards at `f0ec09e5b738c5379c8eb01cc1e229b66df27776`.
- PR #40 carries the invite landing, staging ledger recovery and static offline fallback at `6def14ba74f50b2541d737d4bfeaad4cbd2e2666`.
- Claude's Step 02 backend is integrated through `0efba3d6c4ae0a3962daf5e987caab6e0c1e1fd8`. See the [migration ledger](migrations/ledger-map.md) and [rollback record](migrations/step02-rollback.md). This candidate added no database migration.

## Management tools

| Tool | Current state |
| --- | --- |
| Five portal routes and layout | Public and management chrome split at the App Router. Leadership and Admin retain their shared shell. Employee uses it for the existing check-in page. The shell has role navigation, theme, language and logout. Authenticated and installed-PWA acceptance remains open. |
| THH Work | Existing legacy queues persist records. The approved task board is disconnected. Full task lifecycle, projects and assignment notifications still need wiring. |
| THH People | Leadership profile reads the existing official identity row. Directory and invitation/claim foundations exist. Writes, appointments, secure documents and real invite delivery need acceptance or implementation. |
| THH Workforce | Employee check-in exists. Checkout, scheduling, leave workflow and performance remain open. |
| THH Connect | Private chat, groups and communication workflows remain open. |
| THH Capital | Booking and commission totals have existing RPCs. Journals, reconciliation, budget and investment operations remain open. |
| THH Growth | Campaigns, referral and publication workflows remain open. |
| THH Village Connect | Office data and the approved office-creation executor exist. Assisted bookings, reporting and field operations remain open. |
| THH Control Center | Existing membership and permission foundations are in Supabase. Delegated legacy Admin operations and governance UI require migration. |
| Central Approval Engine | Leadership inbox, personal requests and history lists read the versioned engine. Approve, reject and request revision use authenticated server actions. Submission, detailed decision history UI, execution actions and moving legacy workflows to the engine remain open. |
| Central Notification Center | Leadership inbox uses existing Supabase notifications, marks displayed alerts read and links to the matching approval center. Existing account inbox remains available. Preferences and channel delivery verification remain open. |
| Website and PWA Management | Existing website and release features retained. Publication and release governance remain open. |
| Destination and CMS Management | Existing editor and destination draft tools retained. Live source providers and reviewed publication need work. |
| Customer CRM | Existing Admin user and support tools retained. Consolidated CRM remains open. |
| Partner CRM and Verification | Existing listings, KYC and queues retained. Full approval-chain integration remains open. |
| Booking Operations | Existing Admin and booking operations retained. Consolidated workflow and regression acceptance remain open. |
| Reports and Business Analytics | Existing dashboard metrics retained. Cross-module analytics and exports remain open. |
| Email Management Center | Existing invitation sending requires the staging server key and approved test inbox. Email operations remain open. |
| Document Management Center | Private buckets exist. The unified management interface remains open. |
| Company Calendar and Meetings | Remain open. |
| HR and Payroll Records | Remain open. Payroll policies require approval. |
| Employee Expense Claims | Legacy expense records exist. Versioned request/execution and reporting remain open. |
| Company Asset Management | Remains open. |
| Automation Center | Remains open. |
| AI Command Center | Remains open. Provider and publication policies require approval. |
| System Health Monitoring | Remains open. |
| Company Settings | Existing Admin settings retained. Delegated management and versioned approval remain open. |
| Knowledge and Training Center | Remains open. |
| Backup and Recovery | Management interface and recovery drill remain open. |
| Data Privacy Center | Management interface and end-to-end privacy operations remain open. |
| Emergency Security Control | Operational interface and audited actions remain open. |

## Verified in staging

The Step 02 approval regression fixture passed 40 assertions. The permissions and one-time claims fixture passed 16 assertions. Both transactions rolled back. This verifies database behavior including MFA gates, approval version checks, self-approval denial, retry behavior and restricted claim permissions. Browser MFA, refresh, Founder/Admin switching, invitation email delivery and claiming by email require separate browser acceptance. No existing leadership credentials were reset.
