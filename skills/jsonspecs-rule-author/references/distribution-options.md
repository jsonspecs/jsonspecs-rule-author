# Distribution options

Use this reference to choose how a formatVersion 2 snapshot and its operator registry
reach consumers.

## Embedded runtime

The application installs the published `@jsonspecs/rules` v4 package from npm and
bundles it with the snapshot and operator registry. Use a lockfile to record the exact
runtime release used by the deployment.

Use it for low latency and a single deployment owner. The application release must pin
all three parts and log their versions or digests.

## Rules package dependency

Publish source metadata, `dist/snapshot.json`, build information, and operator code as a
versioned package. Consumers execute locally and pin a package version.

This gives reproducible local calls but requires an explicit consumer upgrade policy.
Do not let a broad dependency range silently change blocking behavior.

## Standalone service

A service owns compilation, deployment, execution, authentication, and audit logging.
Use it when several languages or teams need a central rules contract.

The service API is separate from the RC.7 runtime result. Define transport errors,
timeouts, retries, authorization, request limits, and version negotiation in the service
contract rather than adding fields to the snapshot or result.

## Hybrid

Use one versioned snapshot package as the source of truth. Some consumers embed it;
others call a service that deploys the same snapshot and equivalent operator pack.

Equality across runtimes is guaranteed by the core specification only for built-in
operators. For custom operators, require equivalent closed schemas and shared golden
vectors, then record package versions and immutable digests for each implementation.

## Decision questions

- How many consumers and runtime languages exist?
- Can calls tolerate a network dependency?
- Who owns snapshot and operator-pack rollout and rollback?
- Must consumers pin exact versions?
- How are `sourceHash`, package version, runtime version, and operator-pack digest joined
  in audit records?
- How are payload and context size, authentication, and tenant isolation enforced?
