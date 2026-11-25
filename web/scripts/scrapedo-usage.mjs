// How much of scrape.do's monthly allowance is left.
// Run from web/ with your token in the environment (it is never printed or saved):
//   $env:SCRAPEDO_TOKEN = '<your token>'; npm run scrapedo-usage
// scrape.do allows 10 of these checks a minute.
const token = process.env.SCRAPEDO_TOKEN
if (!token) {
  console.error('Set SCRAPEDO_TOKEN first (the same token as the Worker secret).')
  process.exit(1)
}
const res = await fetch(`https://api.scrape.do/info?token=${encodeURIComponent(token)}`)
if (!res.ok) {
  console.error(`scrape.do answered ${res.status}. ${res.status === 401 ? 'Check the token.' : res.status === 429 ? 'Too many checks; wait a minute.' : ''}`)
  process.exit(1)
}
const info = await res.json()
const max = info.MaxMonthlyRequest
const left = info.RemainingMonthlyRequest
const now = new Date()
const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1
console.log(`Active:          ${info.IsActive ? 'yes' : 'NO'}`)
console.log(`This month:      ${max - left} used of ${max} (${Math.round(((max - left) / max) * 100)}%)`)
console.log(`Left:            ${left}, about ${Math.floor(left / daysLeft)} a day for the ${daysLeft} days left (if the plan resets on the 1st)`)
