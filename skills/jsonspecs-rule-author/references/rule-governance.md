# Rule governance

Use this reference when rules affect external contracts or are controlled by several
teams.

## Ownership

For every rule family, record outside the executable snapshot:

- business owner and technical owner;
- source of truth for input and context fields;
- reviewer for issue codes, levels, fields, and messages;
- dictionary owner and update process;
- package and operator-pack release and rollback owners.

## Change review

Review these as behavior or contract changes:

- adding a blocking issue or an `EXCEPTION` stop;
- changing issue code, field, level, order, or condition;
- changing required payload or context values;
- changing an export id;
- changing dictionary eligibility;
- changing custom-operator schema or outcome;
- changing wildcard `onEmpty`, mode, or issue mode.

Record the decision in the domain changelog or release notes. Do not infer approval from
the existence of a sample or from a compiler accepting the snapshot.

## Release evidence

- every export maps to a named business scenario;
- input and context contracts are documented;
- samples cover success, failures, warnings, exceptions, and branch edges;
- custom operators have rationale and golden vectors;
- the rebuilt snapshot compiles and matches the checked-in distribution;
- the full artifact graph is reachable and acyclic;
- UI metadata is readable without opening JSON source.

## Audit identity

The normative runtime result identifies only `specVersion` and snapshot `sourceHash` in
`ruleset`, plus `pipelineId` on each issue. It does not identify package version,
runtime version, source revision, or operator pack.

To answer which exact deployment made a decision, the host audit record should join:

- package id and version;
- snapshot `sourceHash`;
- requested exported `pipelineId`;
- runtime implementation and version;
- operator-pack id, version, and digest;
- input/audit correlation identifiers allowed by policy.

Keep trace and deployment records outside the closed RC.7 result.
