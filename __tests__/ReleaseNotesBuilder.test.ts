/**
 * Unit tests for src/wait.ts
 */

import { buildReleaseNotes } from '../src/ReleaseNotesBuilder'

jest.setTimeout(180000)

/* eslint-disable jest/no-disabled-tests */
/* eslint-disable jest/expect-expect */
describe('wait.ts', () => {
  it('runs', async () => {
    await buildReleaseNotes({
      githubToken:
        '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',
      repoOwner: 'ky1ejs',
      repoName: 'release-notes-action'
    })
  })
})
