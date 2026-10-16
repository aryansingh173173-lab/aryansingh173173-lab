import { writeFile } from 'node:fs/promises';

const token = process.env.GITHUB_TOKEN;
const username = process.env.USERNAME || 'aryansingh173173-lab';

if (!token) throw new Error('GITHUB_TOKEN is required');

const query = `
  query($login: String!) {
    user(login: $login) {
      repositories(ownerAffiliations: OWNER, privacy: PUBLIC, first: 100) {
        nodes { name }
      }
      contributionsCollection {
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        contributionCalendar {
          totalContributions
          weeks { contributionDays { contributionCount date } }
        }
      }
    }
  }
`;

const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'aryansingh173173-lab-profile-stats',
  },
  body: JSON.stringify({ query, variables: { login: username } }),
});

if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
const payload = await response.json();
if (payload.errors) throw new Error(JSON.stringify(payload.errors));

const user = payload.data.user;
const stats = user.contributionsCollection;
const today = new Date().toISOString().slice(0, 10);
const days = stats.contributionCalendar.weeks
  .flatMap((week) => week.contributionDays)
  .map((day) => ({ ...day }));
const todayCell = days.find((day) => day.date === today);
if (todayCell) todayCell.contributionCount += 1; // Account for the commit that publishes this snapshot.
const throughToday = days.filter((day) => day.date <= today);
const activeDays = throughToday.filter((day) => day.contributionCount > 0).length;

let cursor = throughToday.length - 1;
if (cursor >= 0 && throughToday[cursor].date === today && throughToday[cursor].contributionCount === 0) cursor -= 1;
let streak = 0;
while (cursor >= 0 && throughToday[cursor].contributionCount > 0) {
  streak += 1;
  cursor -= 1;
}

const total = stats.contributionCalendar.totalContributions + 1;
const commits = stats.totalCommitContributions + 1;
const level = Math.floor(total / 10) + 1;
const progress = total % 10;
const repoCount = user.repositories.nodes.filter((repo) => repo.name !== username).length;
const maxCount = Math.max(1, ...days.map((day) => day.contributionCount));
const colors = ['#161B2E', '#173E4A', '#14656A', '#24A6A1', '#65FDF0'];
const levelFor = (count) => count === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((count / maxCount) * 4)));
const escapeXml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));

const cellSize = 12;
const gap = 4;
const gridX = 70;
const gridY = 312;
const cells = stats.contributionCalendar.weeks.flatMap((week, weekIndex) =>
  week.contributionDays.map((day, dayIndex) => {
    const x = gridX + weekIndex * (cellSize + gap);
    const y = gridY + dayIndex * (cellSize + gap);
    const color = colors[levelFor(day.contributionCount)];
    const delay = ((weekIndex * 7 + dayIndex) % 24) / 20;
    return `<rect class="cell" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="3" fill="${color}" style="animation-delay:${delay}s"><title>${escapeXml(day.date)}: ${day.contributionCount} contribution${day.contributionCount === 1 ? '' : 's'}</title></rect>`;
  })
).join('\n    ');

const metric = (x, value, label, color) => `
  <g transform="translate(${x} 126)">
    <rect width="238" height="106" rx="18" fill="#10152B" stroke="${color}" stroke-opacity="0.55"/>
    <text x="24" y="50" fill="${color}" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="800">${escapeXml(value)}</text>
    <text x="24" y="78" fill="#92A1C6" font-family="Consolas, monospace" font-size="12" letter-spacing="1.2">${escapeXml(label)}</text>
  </g>`;

const svg = `<svg width="1200" height="475" viewBox="0 0 1200 475" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Aryan Singh's GitHub activity arcade</title>
  <desc id="desc">Live contribution statistics and a one-year contribution grid, refreshed daily.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="475"><stop stop-color="#080B19"/><stop offset="1" stop-color="#10102D"/></linearGradient>
    <linearGradient id="xp" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#FF3CAC"/><stop offset="0.5" stop-color="#F9F871"/><stop offset="1" stop-color="#65FDF0"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <style>
    .cell { animation: cellPulse 3.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
    .xp-bar { animation: fillBar 1.6s ease-out both; transform-origin: left; }
    .cursor { animation: blink 1.1s steps(2,end) infinite; }
    @keyframes cellPulse { 0%, 70%, 100% { opacity: .8; transform: scale(.92); } 82% { opacity: 1; transform: scale(1.12); } }
    @keyframes fillBar { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    @keyframes blink { 50% { opacity: 0; } }
  </style>
  <rect width="1200" height="475" rx="24" fill="url(#bg)"/>
  <rect x="1" y="1" width="1198" height="473" rx="23" stroke="#65FDF0" stroke-opacity="0.28"/>
  <text x="52" y="61" fill="#65FDF0" font-family="Consolas, monospace" font-size="15" font-weight="700" letter-spacing="3">ACTIVITY ARCADE // LIVE SAVE FILE</text>
  <text x="52" y="95" fill="#FFFFFF" font-family="Segoe UI, Arial, sans-serif" font-size="27" font-weight="800">PLAYER LEVEL ${level}</text>
  <rect x="300" y="75" width="832" height="16" rx="8" fill="#191E38"/>
  <rect class="xp-bar" x="300" y="75" width="${Math.max(18, Math.round(832 * progress / 10))}" height="16" rx="8" fill="url(#xp)" filter="url(#glow)"/>
  <text x="1132" y="67" text-anchor="end" fill="#92A1C6" font-family="Consolas, monospace" font-size="11">${progress}/10 XP TO NEXT LEVEL</text>
  ${metric(52, total, 'PUBLIC CONTRIBUTIONS', '#FF6EC7')}
  ${metric(306, commits, 'PUBLIC COMMITS / YEAR', '#F9F871')}
  ${metric(560, `${streak} DAYS`, 'CURRENT STREAK', '#65FDF0')}
  ${metric(814, activeDays, 'ACTIVE DAYS / YEAR', '#A98BFF')}
  <g transform="translate(1068 126)">
    <rect width="80" height="106" rx="18" fill="#10152B" stroke="#FF9F43" stroke-opacity="0.55"/>
    <text x="40" y="50" text-anchor="middle" fill="#FF9F43" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="800">${repoCount}</text>
    <text x="40" y="77" text-anchor="middle" fill="#92A1C6" font-family="Consolas, monospace" font-size="10">PROJECTS</text>
  </g>
  <text x="52" y="279" fill="#D9DEFF" font-family="Consolas, monospace" font-size="13" letter-spacing="2">CONTRIBUTION MAP // LAST 52 WEEKS</text>
  <g>
    ${cells}
  </g>
  <text x="52" y="447" fill="#66759D" font-family="Consolas, monospace" font-size="11">SNAPSHOT FROM GITHUB PUBLIC ACTIVITY</text>
  <text x="1148" y="447" text-anchor="end" fill="#66759D" font-family="Consolas, monospace" font-size="11">LAST CHECKPOINT: ${escapeXml(today)} <tspan class="cursor" fill="#65FDF0">▮</tspan></text>
</svg>`;

await writeFile('assets/activity.svg', svg, 'utf8');
console.log(`Rendered activity.svg for ${username}: ${total} contributions, level ${level}.`);
