# Distribution Options

Use this reference when choosing how a rules layer is executed and distributed.

## Embedded engine

The application embeds the jsonspecs engine and loads rules locally.

Best when:

- latency must be low;
- validation is part of request handling;
- the host application already owns deployment and observability;
- rules change with the application release cadence.

Tradeoffs:

- simplest runtime path;
- no network dependency;
- rule rollout is tied to application deployment;
- each application must upgrade the package.

## Rules package dependency

Rules are published as a package, such as npm, Maven, or PyPI, and applications execute them locally.

Best when:

- several services need the same rules;
- rules should be versioned independently;
- runtime calls must stay local;
- consumers can pin and upgrade versions deliberately.

Tradeoffs:

- strong reproducibility;
- good CI/CD fit;
- consumers may drift across versions;
- package boundary and changelog discipline become important.

## Standalone rules service

A separate service hosts the engine and rules. Applications call it over the network.

Best when:

- several technology stacks need the same validation;
- business wants centralized audit, UI, or rule-management workflows;
- rules must be updated without redeploying every consumer;
- validation latency and availability can be managed as a service dependency.

Tradeoffs:

- centralized governance and observability;
- easier cross-language adoption;
- introduces network latency, service SLA, retries, auth, version negotiation, and failure modes;
- request/response contract must be stable and documented.

## Hybrid model

Use the rules package as the source of truth. Run it embedded in some consumers and expose the same package through a rules service for others.

This is often the mature option:

- package owns rules, samples, operators, and versioning;
- backend services can embed the package for low latency;
- a rules service can provide cross-language access and centralized audit;
- both execution modes share the same snapshot and provenance.

## Decision checklist

- How many consumers need the rules?
- Are consumers all in the same language/runtime?
- How often do rules change?
- Is centralized audit required?
- Can callers tolerate a network dependency?
- Who owns rule rollout and rollback?
- Do rules need tenant-specific or channel-specific context?

