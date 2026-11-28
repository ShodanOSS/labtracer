# LabTracer direction: the authoritative operational model

This document says where LabTracer is going and how to decide what to build next. It is for contributors and for anyone evaluating LabTracer for their organization. It is a direction, not a schedule.

## The problem

Infrastructure teams keep three pictures of their network, and the three rarely agree:

- **What should be there.** Kept in documentation and source-of-truth tools such as NetBox and Nautobot, spreadsheets and diagrams. It is maintained by hand and goes out of date the day after an audit.
- **What is there.** Seen by monitoring, discovery and the devices themselves. It is accurate, but it has no idea of intent: it can't say whether a port *should* be up.
- **What changed, and who changed it.** Spread across tickets, chat, device logs and memory.

LabTracer already has all three in one place, which is unusual:

| Concept | Where it lives today |
|---|---|
| Intended state | The lab model: devices, ports, links, VLANs, routes and placement (`src/model.js`, `data/labs/*.json`) |
| Observed state | Normalized facts read from devices (`collector/facts.py`, `data/observed/`) |
| The difference | Drift detection (`src/drift.js`) |
| Acting on the difference | Change sets, push, backup and rollback (`collector/`) |
| Accountability | The hash-chained audit log (`collector/audit.py`) |

**The goal is to make that loop authoritative for a whole organization.** LabTracer should become the place where the intended state of the infrastructure is defined, compared with reality all the time, and changed through a controlled process. Every difference should be visible, explained, and either accepted or fixed.

## What this means for how we build

### Principles

1. **The model comes before features.** A feature is worth building when it makes the model more complete, more correct or more trusted. New protocols, panels and integrations are a means, not the goal.
2. **Integrations feed the model; they don't sit beside it.** A new device driver must produce the normalized facts schema. A new monitoring backend must map onto model objects. A new import must create model objects with provenance. An integration that only adds its own panel is out of scope.
3. **The server owns the model.** Today the browser holds the model and the server stores an opaque document. An authoritative model needs a server that validates every change, keeps history, enforces permissions and computes drift, whichever client made the change.
4. **Every change is attributable and reviewable.** Changes to the model and changes to devices both go through change sets with an actor, a reason and a review. Nothing changes silently: not discovery, not a CSV import, not an "accept from device".
5. **Intended and observed state are kept apart.** The model never overwrites itself from a device. Observed facts are evidence. Accepting them into the model is a decision, made by a person or by an explicit authority policy.
6. **Labs become plans.** Planning is LabTracer's heritage and a strength. A lab becomes a *branch* of the production model: a place to design a change, simulate it, review it and then merge it, instead of a separate world.

### What we stop doing

- Adding protocols, drivers or backends that don't extend the facts schema or the model.
- Putting model logic only in browser JavaScript, where other clients and the server can't use it.
- Treating free-form attributes, notes and file attachments as a substitute for real, typed objects.

## Architecture phases

Each phase is useful on its own. The order matters more than the dates.

### Phase 1: Foundations

- Apache-2.0 license, third-party notices and a security policy.
- Security fixes that don't depend on identity, and a threat model.
- This document.

### Phase 2: The server owns the model

- **One schema.** Define the model in a shared schema (JSON Schema), used by both the Python server and the browser. This replaces the shape that is spread across factory functions in `src/model.js` today. The existing format-migration framework (`src/migrations.js`, frozen fixtures) carries over.
- **Object API.** Read and change devices, ports, links and the other objects one at a time (`GET/PATCH /api/v1/devices/{id}`), with validation on the server. Whole-document save stays for backward compatibility during the transition.
- **Drift on the server.** Move the comparison in `src/drift.js` to the server, so drift can be computed on a schedule, reported and alerted on without a browser open.
- **Storage abstraction.** A repository layer between the API and the storage.

> **Open decision: storage and dependencies.** Today LabTracer needs only the Python standard library and JSON files. That makes it easy to install, but it limits concurrency, history queries, multi-user locking and the use of vetted security libraries for SSO and encryption.
>
> | Option | For | Against |
> |---|---|---|
> | Keep files and the standard library only | Zero install; trivial backup | Whole-document writes; no per-object history; homemade authentication |
> | SQLite by default, behind an ORM-free repository layer | Still one file and no server; transactions; per-object rows and history | A small dependency is likely (migrations tooling) |
> | SQLite for local use, PostgreSQL for enterprise, plus vetted packages (OIDC, crypto) | Concurrency, scale-out, mature security libraries | More to install and operate; needs a packaging story (container, wheels) |
>
> One way out: keep a zero-install *local profile*, and make the dependency set a property of the deployment profile rather than of the architecture. Decide this before Phase 2 starts.

### Phase 3: Identity and change control

- **Authentication and roles,** as described in `SECURITY.md` and the security review: a local launch token for single-user use; OIDC and LDAP/AD for organizations; groups mapped to roles scoped by site.
- **Model changes go through change sets.** Propose → review → approve → apply, to the model and, where relevant, to the devices, in one reviewed unit. Today change sets cover device changes only, and the model is edited live.
- **Per-object history and provenance.** Every field change records who, when, which change set, and the source: a user, discovery, collect, import or an API client. "Why is this VLAN here?" has an answer.

### Phase 4: Organizational scope

- **Stable global identity.** Object IDs that are unique across the organization, plus natural keys (serial number, asset tag, management IP) for matching. Today IDs are random per lab, and discovery matches devices by heuristics.
- **Location hierarchy:** organization → region → site → building → room → rack. Today `rooms[]` inside a lab is the only location concept.
- **First-class IPAM:** prefixes, IP addresses, VLANs and VLAN groups, VRFs, IPv6. Today an IP is a string on a port (one IPv4 per port), and VLANs are listed per device.
- **Circuits and providers,** for WAN links and their contracts.
- **Tenants, owners and contacts,** to know who is responsible for each object.
- **Lifecycle states:** planned → staged → active → decommissioning → retired. Drift and monitoring depend on the state: a planned device that doesn't answer is not an incident.
- **A custom-field schema** with types, validation and search, replacing free-form `attrs`.

### Phase 5: Authority and reconciliation

- **Authority policy per field:** say who is authoritative for each kind of data.
  - The model: VLAN assignments, IP plans.
  - The device: serial numbers, firmware versions, MAC addresses.
  - An external system: asset data from the CMDB.

  Drift on device-authoritative fields updates the model automatically, with provenance. Drift on model-authoritative fields becomes a remediation proposal.
- **Continuous reconciliation:** scheduled collection for every managed device, drift computed on the server, and a history of observed facts, so you can see when a difference appeared.
- **Compliance:** rules over the model and the facts (for example, every access port has a description; no device runs end-of-life firmware), with reports per site and per owner.

### Phase 6: Ecosystem

- **A versioned REST API** with an OpenAPI description, and personal access tokens.
- **Events:** webhooks and an event stream for object changes, drift and change-set state.
- **NetBox and Nautobot sync.** Work alongside existing source-of-truth tools instead of replacing them: import, export and two-way sync with a clear authority per field.
- **A plugin interface** for device drivers and monitoring backends. The registries in `collector/drivers/__init__.py` and `monitoring.py` become the plugin contract.
- **Exports** to automation tools: Ansible inventory, Terraform, and Nagios (exists today).

## How we measure progress

| Measure | What it tells us |
|---|---|
| Share of managed devices with zero unexplained drift | Is the model true? |
| Share of device changes made through LabTracer change sets | Is LabTracer the way changes happen? |
| Mean time from a change on a device to drift being detected | Is reconciliation continuous? |
| Share of discovered assets that are in the model | Is the model complete? |
| Share of model objects with an owner and a lifecycle state | Is the model accountable? |

## The gaps, today

The audit of the current code that led to this document found:

| Gap | Today |
|---|---|
| Multi-site hierarchy | Only `rooms[]` inside one lab |
| IP address management | IPs are strings on ports, IPv4 only, one per port |
| VLANs and VRFs | VLANs per device; no VRF objects |
| Tenants and ownership | None |
| Lifecycle | Inventory status only (active, faulty, spare, ordered, retired); no "planned" |
| Per-object history and provenance | Whole-file copies and in-browser undo only; the audit log covers device operations, not model edits |
| Server-side model | None: the model is a document that the server stores without reading it |
| API | Hand-routed, whole-document, undocumented |
| Outbound events | None (internal WebSocket for the UI only) |
| Identity | No authentication; the audit actor is the OS user |

**What we keep and build on:**
- The normalized facts schema.
- The operation → driver render → backup → apply → verify → rollback pipeline.
- Change sets reviewed by digest.
- The hash-chained audit log.
- The frozen-fixture format migrations.
- The physical and logical views that make the model easy to understand.

## How to use this document

When proposing a feature, say which phase and principle it serves. A pull request that adds a protocol should show the facts or model objects it produces. A pull request that adds model logic should put it where the server can use it. When the answer to "does this make the model more complete, correct or trusted?" is no, the feature probably belongs in a plugin or not at all.
