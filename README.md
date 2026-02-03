# Cherished Memories Photography — Automation & Ops Scripts

A collection of small, practical scripts I’ve built while working at **Cherished Memories Photography (CMP)** to automate repetitive tasks, keep data clean, and reduce manual admin work. Most of these are “glue code” utilities — the kind of stuff that saves 10 minutes here, an hour there, and prevents mistakes that happen when humans do the same thing 500 times.

> **Heads up:** Some scripts are tailored to CMP’s internal tools and field names (Airtable bases, views, ClickUp structures, etc.). I’ve tried to document assumptions and make each script easy to adapt.

---

## What’s in this repo

This repo typically includes scripts for:

- **Airtable**: automations, scripting extension utilities, record normalization, grouping logic, reporting helpers  
- **Zapier / Make**: webhook payload prep, dedupe keys, formatting helpers, API glue
- **ClickUp**: task/subtask generation, syncing fields, bulk updates
- **Inventory / Kits**: assignment logic, snapshots, audit logging
- **Photo day ops**: grouping picture dates, schedule helpers, staff/resource coordination utilities

If you’re looking for something specific, start in the `scripts/` folder and check the per-script README notes (if applicable).

---

## Repo structure

```text
.
├── scripts/
│   ├── airtable/
│   ├── clickup/
│   ├── zapier/
│   ├── make/
│   └── utils/
├── examples/
├── docs/
└── README.md
