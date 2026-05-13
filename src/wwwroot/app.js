const fixturesEl = document.querySelector('#fixtures');
const predictionEl = document.querySelector('#prediction');
const refreshButton = document.querySelector('#refresh');
let selectedId = null;

function formatDate(value) {
  if (!value) return 'Date not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function renderPrediction(fixture) {
  predictionEl.classList.remove('empty');
  predictionEl.innerHTML = `
    <strong>${escapeHtml(fixture.title)}</strong>
    <p>${escapeHtml(fixture.prediction || 'No prediction yet')}</p>
  `;
}

function renderFixtures(fixtures) {
  fixturesEl.innerHTML = '';

  if (!fixtures.length) {
    fixturesEl.innerHTML = '<div class="loading">No fixtures found in Dataverse.</div>';
    return;
  }

  for (const fixture of fixtures) {
    const card = document.createElement('article');
    card.className = 'fixture-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.innerHTML = `
      <h3>${escapeHtml(fixture.title)}</h3>
      <div class="teams">
        <span class="team-badge">${escapeHtml(fixture.homeTeam)}</span>
        <span>vs</span>
        <span class="team-badge">${escapeHtml(fixture.awayTeam)}</span>
      </div>
      <div class="kickoff">${escapeHtml(formatDate(fixture.kickoff))}</div>
    `;

    const select = () => {
      selectedId = fixture.id;
      document.querySelectorAll('.fixture-card').forEach(el => el.classList.remove('selected'));
      card.classList.add('selected');
      renderPrediction(fixture);
    };

    card.addEventListener('click', select);
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });

    fixturesEl.appendChild(card);
  }

  const first = fixtures.find(f => f.id === selectedId) ?? fixtures[0];
  if (first) {
    fixturesEl.children[[...fixtures].indexOf(first)]?.classList.add('selected');
    renderPrediction(first);
  }
}

async function loadFixtures() {
  fixturesEl.innerHTML = '<div class="loading">Loading fixtures…</div>';
  try {
    const response = await fetch('/api/fixtures');
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const fixtures = await response.json();
    renderFixtures(fixtures);
  } catch (error) {
    fixturesEl.innerHTML = `<div class="error">Could not load fixtures: ${escapeHtml(error.message)}</div>`;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

refreshButton.addEventListener('click', loadFixtures);
loadFixtures();
