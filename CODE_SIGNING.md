# Code Signing Policy

## Overview

QBox releases are digitally signed to ensure authenticity and integrity. This document describes our code signing practices.

## Code Signing Provider

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).

## Team Roles

- **Committers and Reviewers**: [Repository Contributors](https://github.com/vhiroki/qbox/graphs/contributors)
- **Approvers**: [Repository Owner](https://github.com/vhiroki)

## Privacy Policy

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.

The application connects to:
- **User-configured PostgreSQL databases**: Only when explicitly configured by the user
- **User-configured S3 buckets**: Only when explicitly configured by the user
- **OpenAI API**: Only when the user explicitly configures an API key and initiates AI chat

No telemetry, analytics, or usage data is collected or transmitted.

## Verification

All signed releases can be verified using standard Windows code signing verification tools. Signed executables will show "SignPath Foundation" as the publisher.

## Reporting Issues

If you believe a signed release has been compromised or violates the SignPath Code of Conduct, please report it to:
- QBox: Open an issue at https://github.com/vhiroki/qbox/issues
- SignPath: Email support@signpath.io
