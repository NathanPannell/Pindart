# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Inferred from the request: a dependency-free Chrome Manifest V3 extension.

## Users

People reporting visual problems on websites into GitHub repositories they can access.

## Product Purpose

Turn a selected part of the current page into an annotated GitHub issue with page context.

## Operating Context

Chrome toolbar, current web page, a focused editor window, and GitHub OAuth and Issues.

## Capabilities and Constraints

- Toolbar click starts a drag selection, without automatic full-page capture.
- The editor supports red arrows and freehand marks on the captured region.
- The same editor window advances to an issue form with URL, browser dimensions, and capture time.
- The user searches connected repositories and submits a title and optional description.
- GitHub sign-in uses the product-owned OAuth app and Railway bridge. Users never configure their own tokens.
- Each new capture clears the previous issue form. The editor remains open until the user closes it.

## Product Principles

- Preserve the original page context with the report.
- Keep the capture, markup, and issue form in one focused workflow.
- Show the destination and image storage action before submission.
