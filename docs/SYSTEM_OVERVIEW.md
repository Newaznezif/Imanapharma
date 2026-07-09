# ImanaPharma System Overview

ImanaPharma is a distributed, offline-first pharmacy operating system. It combines pharmacy ERP functions, branch POS, clinical safety checks, logistics, inventory ledgering, and immutable audit history.

In architectural terms, it is closer to a Stripe-style ledger system plus retail POS plus compliance engine than to a simple store checkout app.

## High-Level Architecture

The system is split into three main layers:

- Cloud layer: the central system of record.
- Edge layer: the real-time branch operations system.
- Frontend: the operator interface for cashiers, pharmacists, managers, and admins.

## Cloud Layer

The cloud API is the central brain of the platform.

Primary responsibilities:

- Global product catalog.
- Master append-only inventory ledger.
- User management and role-based access control.
- Inter-branch transfer coordination.
- Immutable audit log aggregation.
- Sync event ingestion from branch edge nodes.

The cloud API uses PostgreSQL as its durable database. Stock is modeled through events rather than mutable quantity rows.

Important cloud capabilities:

- Auth and token refresh.
- Product creation and catalog reads.
- Global stock aggregation from stock movement events.
- Branch stock views.
- Central stock adjustments.
- Transfer request, approval, dispatch, and completion.
- Audit log viewing.
- Edge event ingestion through `/api/v1/sync`.

## Edge Layer

The edge API is the branch-local operational engine. It is designed so a branch can keep selling and reconciling even when the cloud is unavailable.

Primary responsibilities:

- Offline-capable login.
- Local POS checkout.
- Local SQLite inventory state.
- Shift management and cash reconciliation.
- Clinical safety checks.
- Local append-only stock events.
- Sync outbox queue.
- Background edge-to-cloud sync daemon.

The edge database uses SQLite with write-ahead logging. Writes are serialized through a local queue to reduce SQLite write-lock issues.

## Frontend

The frontend is a React/Vite dashboard with five operational modules:

- POS Checkout.
- Shift Reconciliation.
- Central Inventory Dashboard.
- Stock Transfers.
- Audit Logs.

The app checks cloud and edge health, stores the user session in local storage, and routes users into the relevant workflows.

## Core Workflows

### Sale Flow

1. Cashier opens a shift.
2. Cashier selects drugs in POS.
3. System checks prescription requirements, patient allergy flags, and drug interactions.
4. Blocked clinical safety cases stop checkout.
5. Warning cases require pharmacist, manager, or admin override.
6. Sale is recorded locally in edge SQLite.
7. Sale items are stored locally.
8. Stock is reduced using `STOCK_OUT` movement events.
9. Audit logs are written locally.
10. Sale, stock movement, and audit events are queued in `sync_outbox`.
11. Sync daemon pushes events to cloud.
12. Cloud records the synced sale and stock movements into the central ledger.

### Offline Mode Flow

When cloud connectivity is unavailable:

- POS continues to work locally.
- Sales continue to be stored in SQLite.
- Stock movements continue to be appended locally.
- Sync events remain pending in the local outbox.

When cloud connectivity returns:

- The sync daemon sends queued events in FIFO order.
- Cloud validates idempotency and sequence numbers.
- Processed events are stored centrally.
- Failed events are moved to the cloud dead-letter queue where applicable.

### Stock Model

Inventory is modeled as an event ledger.

Supported movement types:

- `STOCK_IN`
- `STOCK_OUT`
- `TRANSFER_IN`
- `TRANSFER_OUT`
- `ADJUSTMENT`

Current stock is computed by summing stock movement quantities by product, branch, batch, and expiry date.

This gives the system:

- Auditability.
- Traceability.
- Batch-level control.
- Fraud resistance.
- Safer reconciliation after offline operation.

### Clinical Safety Engine

Clinical safety runs during checkout.

Checks include:

- Prescription requirement for Rx products.
- Drug-to-drug interaction checks.
- Patient allergy conflicts.

Severity handling:

- `LOW`: warning.
- `MEDIUM`: warning requiring override.
- `HIGH`: blocker in the current implementation.
- `CRITICAL`: blocker.

Overrides require privileged credentials and are logged to the audit ledger.

Current seeded interaction examples:

- Warfarin plus Aspirin: critical blocker.
- Erythromycin plus Simvastatin: high blocker.
- Atorvastatin plus Simvastatin: medium warning.
- Ibuprofen plus Aspirin: low warning.

### Shift And Cash Reconciliation

The shift workflow provides financial control at branch level.

1. Cashier opens a shift with starting cash.
2. Cash sales are recorded during the shift.
3. Cashier closes the shift with physical counted cash.
4. System computes expected closing cash.
5. System calculates variance.
6. Variance at or above the configured threshold is flagged through audit logging.

### Sync System

The edge-to-cloud sync mechanism uses an outbox pattern.

1. Edge writes operational records locally.
2. Edge writes corresponding events to `sync_outbox`.
3. Sync daemon reads the lowest pending sequence number.
4. Sync daemon posts the event to cloud `/api/v1/sync`.
5. Cloud validates schema version, idempotency, and branch sequence order.
6. Cloud writes the event into central tables.
7. Cloud records the event in `processed_events`.
8. Edge marks the outbox event as synced.

Supported synced entity types:

- `SALE`
- `STOCK_MOVEMENT`
- `TRANSFER`
- `AUDIT_LOG`
- `SHIFT_RECONCILIATION`

## Roles

The system defines four main roles:

- `ADMIN`: full control.
- `BRANCH_MANAGER`: inventory, transfers, reports, and branch operations.
- `PHARMACIST`: prescription validation, clinical overrides, and POS operations.
- `CASHIER`: POS and shift operations.

Cloud endpoints enforce role restrictions for privileged actions such as user registration, product creation, inventory adjustment, transfer lifecycle actions, and audit log access.

## What Works Well

Strong implemented foundations:

- Clear cloud versus edge separation.
- Offline-first branch operation.
- Local SQLite branch database.
- Central PostgreSQL system of record.
- Append-only inventory ledger.
- Sync outbox pattern.
- Idempotent cloud sync processing.
- Per-branch FIFO sequence validation.
- Role-based access control.
- Clinical safety validation.
- Shift reconciliation.
- Inter-branch transfer lifecycle.
- Immutable audit log model.

## Known Gaps

Important gaps still remain before this should be treated as production-grade pharmacy software:

- Pricing is hardcoded at `10.00` per item.
- Prescription validation exists, but prescriptions are not persisted as a real lifecycle.
- Patient records are seeded in the cloud, but the POS uses hardcoded patient profiles.
- Redis is configured but not currently used by application logic.
- Product catalog changes do not automatically sync from cloud to edge.
- Transfer data is managed in cloud but not pulled into edge branch workflows.
- Frontend role visibility does not fully match backend RBAC.
- Local sale sync status update has an implementation mismatch in the sync daemon.
- Test coverage is minimal and mostly validates isolated logic.
- Clinical safety logic is duplicated in the frontend instead of imported from the shared package.

## One-Sentence Summary

ImanaPharma is a distributed pharmacy ERP system with offline POS, event-sourced inventory, clinical safety enforcement, shift-level financial auditing, and cloud-synced multi-branch logistics.

