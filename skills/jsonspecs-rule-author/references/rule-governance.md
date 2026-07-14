# Rule Governance

Use this reference when business rules are controlled by more than one team or affect external contracts.

## Ownership

Every rule family should have:

- business owner;
- technical owner;
- source of truth for field contract;
- review path for issue codes and messages;
- release and rollback owner.

## Review checklist

Before release, verify:

- entrypoint matches a named business scenario;
- input fields are documented;
- required `$context` fields are explicit;
- issue codes are stable and machine-readable;
- messages are business-readable;
- samples cover success, primary failures, and branch edge cases;
- custom operators have rationale and malformed-input samples;
- Studio labels are understandable without reading JSON;
- generated snapshot is reproducible.

## Change control

Treat these as contract changes:

- adding a new blocking error;
- changing an issue code or field;
- changing required fields;
- changing required `$context`;
- changing status or control semantics;
- changing dictionary values that affect eligibility.

Record such changes in package release notes or a domain changelog.

## Auditability

Runtime results should identify:

- package name and version;
- snapshot/source hash;
- entrypoint id;
- operator pack version or digest;
- issue codes and fields;
- optional trace when needed for explanations.

This lets consumers answer: which exact rules produced this decision?

