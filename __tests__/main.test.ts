import * as core from '@actions/core'
import * as main from '../src/main'
import fs from 'fs'

const octokit = {
  rest: {
    repos: {
      getCommit: jest.fn(),
      getLatestRelease: jest.fn(),
      compareCommits: jest.fn(),
      listPullRequestsAssociatedWithCommit: jest.fn()
    }
  }
}

jest.mock('@octokit/rest', () => {
  return {
    Octokit: jest.fn(() => octokit)
  }
})

// mock the GitHub context
jest.mock('@actions/github', () => {
  return {
    context: {
      repo: {
        owner: 'some-owner',
        repo: 'some-repo'
      }
    }
  }
})

const runMock = jest.spyOn(main, 'run')
let errorMock: jest.SpyInstance
let setFailedMock: jest.SpyInstance
let setOutputMock: jest.SpyInstance

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    jest.spyOn(octokit.rest.repos, 'getCommit').mockImplementation(async () => {
      const jsonFile = fs.readFileSync(
        `${__dirname}/fixtures/getCommit.json`,
        'utf-8'
      )
      const getCommitData = JSON.parse(jsonFile)
      return Promise.resolve({ data: getCommitData })
    })

    jest
      .spyOn(octokit.rest.repos, 'getLatestRelease')
      .mockImplementation(async () => {
        const jsonFile = fs.readFileSync(
          `${__dirname}/fixtures/getLatestRelease.json`,
          'utf-8'
        )
        const getLatestReleaseData = JSON.parse(jsonFile)
        return Promise.resolve({ data: getLatestReleaseData })
      })

    jest
      .spyOn(octokit.rest.repos, 'compareCommits')
      .mockImplementation(async () => {
        const jsonFile = fs.readFileSync(
          `${__dirname}/fixtures/compareCommits.json`,
          'utf-8'
        )
        const compareCommitsData = JSON.parse(jsonFile)
        return Promise.resolve({ data: compareCommitsData })
      })

    jest
      .spyOn(octokit.rest.repos, 'listPullRequestsAssociatedWithCommit')
      .mockImplementation(async () => {
        const jsonFile = fs.readFileSync(
          `${__dirname}/fixtures/listPullRequestsAssociatedWithCommit.json`,
          'utf-8'
        )
        const listPullRequestsAssociatedWithCommitData = JSON.parse(jsonFile)
        return Promise.resolve({
          data: listPullRequestsAssociatedWithCommitData
        })
      })

    errorMock = jest.spyOn(core, 'error').mockImplementation()
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
    setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()
  })

  it('sets the time output', async () => {
    await main.run()
    expect(runMock).toHaveReturned()
    expect(setOutputMock).toHaveBeenCalledWith(
      'release-notes',
      expect.any(String)
    )
    expect(errorMock).not.toHaveBeenCalled()
    expect(setFailedMock).not.toHaveBeenCalled()
  })
})
