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
      githubToken: '',
      repoOwner: '',
      repoName: ''
    })
  })
})
