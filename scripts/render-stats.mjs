import { writeFile } from 'node:fs/promises';

const token = process.env.GITHUB_TOKEN;
const username = process.env.USERNAME || 'aryansingh173173-lab';

if (!token) throw new Error('GITHUB_TOKEN is required');

const query = `
  query($login: String!) {
    user(login: $login) {
      repositories(ownerAffiliations: OWNER, privacy: PUBLIC, first: 100) { nodes { name } }
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
const weeks = stats.contributionCalendar.weeks;
const today = new Date().toISOString().slice(0, 10);
const days = weeks.flatMap((week) => week.contributionDays).map((day) => ({ ...day }));
const todayCell = days.find((day) => day.date === today);
if (todayCell) todayCell.contributionCount += 1; // Account for the commit that publishes this snapshot.
const adjustedCount = new Map(days.map((day) => [day.date, day.contributionCount]));
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
const colors = ['#122A35', '#174453', '#1F7187', '#35B9D8', '#5CE1FF'];
const levelFor = (count) => count === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((count / maxCount) * 4)));
const escapeXml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));

const cellSize = 12;
const gap = 4;
const gridX = 70;
const gridY = 312;
const cells = weeks.flatMap((week, weekIndex) =>
  week.contributionDays.map((day, dayIndex) => {
    const x = gridX + weekIndex * (cellSize + gap);
    const y = gridY + dayIndex * (cellSize + gap);
    const count = adjustedCount.get(day.date) ?? day.contributionCount;
    const color = colors[levelFor(count)];
    const delay = ((weekIndex * 7 + dayIndex) % 24) / 20;
    return `<rect class="cell" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="3" fill="${color}" style="animation-delay:${delay}s"><title>${escapeXml(day.date)}: ${count} contribution${count === 1 ? '' : 's'}</title></rect>`;
  })
).join('\n    ');

const metric = (x, value, label, color) => `
  <g transform="translate(${x} 126)">
    <rect width="238" height="106" rx="18" fill="#0B202A" stroke="${color}" stroke-opacity="0.65"/>
    <text x="24" y="50" fill="${color}" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="800">${escapeXml(value)}</text>
    <text x="24" y="78" fill="#91A9B7" font-family="Consolas, monospace" font-size="12" letter-spacing="1.2">${escapeXml(label)}</text>
  </g>`;

const activitySvg = `<svg width="1200" height="475" viewBox="0 0 1200 475" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Aryan Singh's GitHub activity arcade</title>
  <desc id="desc">Live public contribution statistics and a one-year contribution grid rendered from GitHub data.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="475"><stop stop-color="#06111A"/><stop offset="1" stop-color="#071C27"/></linearGradient>
    <linearGradient id="xp" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#FF4D4D"/><stop offset="0.5" stop-color="#F7F6F2"/><stop offset="1" stop-color="#5CE1FF"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <style>
    .cell { animation: cellPulse 3.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
    .xp-bar { animation: fillBar 1.6s ease-out both; transform-origin: left; }
    .cursor { animation: blink 1.1s steps(2,end) infinite; }
    @keyframes cellPulse { 0%,70%,100% { opacity:.8; transform:scale(.92); } 82% { opacity:1; transform:scale(1.12); } }
    @keyframes fillBar { from { transform:scaleX(0); } to { transform:scaleX(1); } }
    @keyframes blink { 50% { opacity:0; } }
  </style>
  <rect width="1200" height="475" rx="24" fill="url(#bg)"/>
  <rect x="1" y="1" width="1198" height="473" rx="23" stroke="#5CE1FF" stroke-opacity="0.3"/>
  <text x="52" y="61" fill="#5CE1FF" font-family="Consolas, monospace" font-size="15" font-weight="700" letter-spacing="3">ACTIVITY ARCADE // LIVE SAVE FILE</text>
  <text x="52" y="95" fill="#F7F6F2" font-family="Segoe UI, Arial, sans-serif" font-size="27" font-weight="800">PLAYER LEVEL ${level}</text>
  <rect x="300" y="75" width="832" height="16" rx="8" fill="#122A35"/>
  <rect class="xp-bar" x="300" y="75" width="${Math.max(18, Math.round(832 * progress / 10))}" height="16" rx="8" fill="url(#xp)" filter="url(#glow)"/>
  <text x="1132" y="67" text-anchor="end" fill="#91A9B7" font-family="Consolas, monospace" font-size="11">${progress}/10 XP TO NEXT LEVEL</text>
  ${metric(52, total, 'PUBLIC CONTRIBUTIONS', '#FF4D4D')}
  ${metric(306, commits, 'PUBLIC COMMITS / YEAR', '#F7F6F2')}
  ${metric(560, `${streak} DAYS`, 'CURRENT STREAK', '#5CE1FF')}
  ${metric(814, activeDays, 'ACTIVE DAYS / YEAR', '#FF4D4D')}
  <g transform="translate(1068 126)">
    <rect width="80" height="106" rx="18" fill="#0B202A" stroke="#5CE1FF" stroke-opacity="0.65"/>
    <text x="40" y="50" text-anchor="middle" fill="#5CE1FF" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="800">${repoCount}</text>
    <text x="40" y="77" text-anchor="middle" fill="#91A9B7" font-family="Consolas, monospace" font-size="10">PROJECTS</text>
  </g>
  <text x="52" y="279" fill="#F7F6F2" font-family="Consolas, monospace" font-size="13" letter-spacing="2">CONTRIBUTION MAP // LAST 52 WEEKS</text>
  <g>${cells}</g>
  <text x="52" y="447" fill="#66818E" font-family="Consolas, monospace" font-size="11">SNAPSHOT FROM GITHUB PUBLIC ACTIVITY</text>
  <text x="1148" y="447" text-anchor="end" fill="#66818E" font-family="Consolas, monospace" font-size="11">LAST CHECKPOINT: ${escapeXml(today)} <tspan class="cursor" fill="#5CE1FF">▮</tspan></text>
</svg>`;

const snakeX = 118;
const snakeY = 132;
const snakeCellSize = 12;
const snakeGap = 4;
const snakeStep = snakeCellSize + snakeGap;
const snakeCells = weeks.flatMap((week, weekIndex) =>
  week.contributionDays.map((day, dayIndex) => {
    const x = snakeX + weekIndex * snakeStep;
    const y = snakeY + dayIndex * snakeStep;
    const count = adjustedCount.get(day.date) ?? day.contributionCount;
    const fill = colors[levelFor(count)];
    const className = count > 0 ? 'food' : 'quiet';
    const delay = ((weekIndex * 3 + dayIndex) % 30) / 10;
    return `<rect class="${className}" x="${x}" y="${y}" width="${snakeCellSize}" height="${snakeCellSize}" rx="3" fill="${fill}" style="animation-delay:-${delay}s"><title>${escapeXml(day.date)}: ${count} contribution${count === 1 ? '' : 's'}</title></rect>`;
  })
).join('\n    ');
const snakeLeft = snakeX + snakeCellSize / 2;
const snakeRight = snakeX + (weeks.length - 1) * snakeStep + snakeCellSize / 2;
const snakePathParts = [];
for (let row = 0; row < 7; row += 1) {
  const y = snakeY + row * snakeStep + snakeCellSize / 2;
  const x = row % 2 === 0 ? snakeRight : snakeLeft;
  if (row === 0) snakePathParts.push(`M ${snakeLeft} ${y} H ${x}`);
  else snakePathParts.push(`V ${y} H ${x}`);
}
const snakePath = snakePathParts.join(' ');
const body = Array.from({ length: 12 }, (_, index) => {
  const fill = index < 4 ? '#FF4D4D' : index < 8 ? '#F7F6F2' : '#5CE1FF';
  const radius = Math.max(3.8, 7 - index * 0.24);
  return `<circle r="${radius.toFixed(1)}" fill="${fill}" opacity="${(1 - index * 0.045).toFixed(2)}"><animateMotion dur="16s" begin="-${(index * 0.32).toFixed(2)}s" repeatCount="indefinite" rotate="auto"><mpath href="#snakeRoute"/></animateMotion></circle>`;
}).join('\n    ');

const snakeSvg = `<svg width="1200" height="330" viewBox="0 0 1200 330" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Contribution run in snake mode</title>
  <desc id="desc">An animated coral and cyan snake travels through Aryan Singh's one-year public contribution map.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="330"><stop stop-color="#07151E"/><stop offset=".5" stop-color="#0A202A"/><stop offset="1" stop-color="#06111A"/></linearGradient>
    <linearGradient id="snakeLine" x1="118" y1="0" x2="970" y2="0" gradientUnits="userSpaceOnUse"><stop stop-color="#FF4D4D"/><stop offset=".5" stop-color="#F7F6F2"/><stop offset="1" stop-color="#5CE1FF"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <path id="snakeRoute" d="${snakePath}"/>
  </defs>
  <style>
    .food { animation: eat 3.2s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
    .quiet { opacity:.7; }
    .dash { animation: dash 8s linear infinite; }
    .blink { animation: blink 1s steps(2,end) infinite; }
    @keyframes eat { 0%,72%,100% { transform:scale(.9); opacity:.72; } 82% { transform:scale(1.3); opacity:1; } }
    @keyframes dash { to { stroke-dashoffset:-150; } }
    @keyframes blink { 50% { opacity:.1; } }
  </style>
  <rect width="1200" height="330" rx="24" fill="url(#bg)"/>
  <rect x="1" y="1" width="1198" height="328" rx="23" fill="none" stroke="#FF4D4D" stroke-opacity=".3"/>
  <text x="52" y="54" fill="#FF4D4D" font-family="Consolas, monospace" font-size="15" font-weight="700" letter-spacing="3">CONTRIBUTION RUN // SNAKE MODE</text>
  <text x="1148" y="54" text-anchor="end" fill="#91A9B7" font-family="Consolas, monospace" font-size="11">SCORE ${total} <tspan class="blink" fill="#5CE1FF">●</tspan></text>
  <text x="52" y="82" fill="#F7F6F2" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="800">EATING PIXELS. SHIPPING STORIES.</text>
  <g>${snakeCells}</g>
  <use href="#snakeRoute" fill="none" stroke="url(#snakeLine)" stroke-width="2" stroke-dasharray="8 13" opacity=".24" class="dash"/>
  <g filter="url(#glow)">${body}</g>
  <circle r="8.5" fill="#FF4D4D" stroke="#F7F6F2" stroke-width="2" filter="url(#glow)"><animateMotion dur="16s" repeatCount="indefinite" rotate="auto"><mpath href="#snakeRoute"/></animateMotion></circle>
  <text x="52" y="301" fill="#66818E" font-family="Consolas, monospace" font-size="11">LIVE GRID / LAST 52 WEEKS</text>
  <text x="1148" y="301" text-anchor="end" fill="#66818E" font-family="Consolas, monospace" font-size="11">LOOPING THROUGH ${activeDays} ACTIVE DAYS</text>
</svg>`;

await Promise.all([
  writeFile('assets/activity.svg', activitySvg, 'utf8'),
  writeFile('assets/snake.svg', snakeSvg, 'utf8'),
]);
console.log(`Rendered activity.svg and snake.svg for ${username}: ${total} contributions, level ${level}.`);
