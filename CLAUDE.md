# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GitHub Action that generates release notes from merged pull requests. It compares commits between the latest release tag and the main branch head, finds associated PRs (filtered by the "ios" label), and outputs changelog in markdown or plaintext format.

## Commands

- `npm install` - Install dependencies
- `npm test` - Run Jest tests
- `npm run lint` - Run ESLint
- `npm run format:write` - Format code with Prettier
- `npm run bundle` - Format and package the action
- `npm run all` - Format, lint, test, generate coverage badge, and package

After making changes, run `npm run bundle` to rebuild `dist/index.js` which is the bundled action entry point.

## Architecture

**Entry Point Flow:**
- `src/index.ts` → `src/main.ts` (run function) → `src/ReleaseNotesBuilder.ts` (buildReleaseNotes)

**Core Logic (`ReleaseNotesBuilder.ts`):**
1. Fetches latest commit on main and latest release tag via GitHub API
2. Compares commits between last release and current HEAD (or lists all commits if no prior release)
3. For each commit, fetches associated PRs and filters for merged PRs with "ios" label
4. Generates changelog via `utils/changelogFormatter.ts`

**Utilities:**
- `utils/retry.ts` - Exponential backoff retry wrapper for Octokit API calls (handles rate limits, 5xx errors, network issues)
- `utils/changelogFormatter.ts` - Formats PR list into markdown or plaintext changelog

**Action Inputs/Outputs (defined in `action.yml`):**
- Input: `github-token` (required), `output-formats` (optional, defaults to `["markdown"]`)
- Output: `release-notes` (markdown), `release-notes-plaintext` (plaintext)
