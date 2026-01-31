import { PullRequestInfo } from '../ReleaseNotesBuilder'

export function generateMarkdownChangelog(
  pullRequests: PullRequestInfo[]
): string {
  let changelog =
    '# Changes\n\nHere are the latest changes in the reverse chronological order:\n\n'

  pullRequests
    .sort(
      (a, b) => new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime()
    )
    .forEach(pr => {
      let newItem = `* ([#${pr.number}](${pr.url})) ${pr.title}`
      if (pr.author) {
        newItem += ` by [@${pr.author.username}](${pr.author.url})`
      }
      changelog += newItem + '\n'
    })

  return changelog
}

export function generatePlaintextChangelog(
  pullRequests: PullRequestInfo[]
): string {
  let changelog =
    'Changes\n=======\nHere are the latest changes in the reverse chronological order:\n\n'

  pullRequests
    .sort(
      (a, b) => new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime()
    )
    .forEach(pr => {
      let newItem = `* (#${pr.number}) ${pr.title}`
      if (pr.author) {
        newItem += ` by @${pr.author.username}`
      }
      changelog += newItem + '\n'
    })

  return changelog
}
