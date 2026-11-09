# ADR-002: Separate AI Model From Source Repository

## Status

Accepted

## Decision

AI model weights will not be stored in the Rose Jade Git repository by default.

## Reason

Model files can be extremely large and may carry separate licensing and redistribution requirements.

## Consequence

The repository will contain model configuration and provenance documentation while the runtime environment will obtain the approved model through an appropriate deployment mechanism.
