import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [fixturesOnTop, setFixturesOnTop] = useState(true);
  const [fixtures, setFixtures] = useState([]);
  const [selectedFixture, setSelectedFixture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFixtures = async () => {
      try {
        const response = await fetch('/api/fixtures');
        if (!response.ok) throw new Error('Failed to fetch fixtures');
        const data = await response.json();
        setFixtures(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchFixtures();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'Date not set';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  };

  const scores = [['Joe Coles', '5 points'], ['Lee Knight', '2 points']];
  const scoresList = scores.map(player => 
    <button key={player[0]} className = "UserScoreTile">
      <p className = "Name">{player[0]}</p>
      <p className = "Points">{player[1]}</p>
    </button>
  );

  const fixtureList = fixtures.map(fixture => 
    <div 
      key={fixture.id}
      className="FixtureTile"
      onClick={() => setSelectedFixture(fixture)}
      style={{cursor: 'pointer'}}
    >
      <div className = "HomeScoreTile">
        <p className = "Score">{fixture.homeTeamScore ?? '-'}</p>
      </div>
      <div className = "TeamNamesandDate">
        <div className = "TeamNames">
          <p className = "HomeTeamFixture">{fixture.homeTeam}</p>
          <p className = "V">V</p>
          <p className = "AwayTeamFixture">{fixture.awayTeam}</p>
        </div>
        <div className = "MatchTime">
          <p>{formatDate(fixture.kickoff)}</p>
        </div>
      </div>
      <div className = "AwayScoreTile">
        <p className = "Score">{fixture.awayTeamScore ?? '-'}</p>
      </div>
    </div>
  )

  return (
    <div className = "App">
      <div className = "Titlebar">
        <h1>Fixture Predictions</h1>
        <p>Dataverse-backed fixture list and predictions dashboard</p>
      </div>
      <div className = "Tabs">
        <button className = "FixturesTab"
          onClick = {() => {setFixturesOnTop(true)}}
        > Fixtures </button>
        <button className = "PredictionsTab"
          onClick = {() => {setFixturesOnTop(false)}}
        >Predictions</button>
      </div>
      <div className = "MainBody">
        <div className = "Predictions"
          style = {{zIndex: fixturesOnTop ? 0 : 2, visibility: fixturesOnTop ? 'hidden' : 'visible'}}
        >
          <div className = "Groups">
            <p className = "PredictionsTitle">Predictions</p>
            <p className = "StageTitle">Groups</p>
            <div className = "PredictionsBody">
              <button className = "PreviousStageArrow"></button>
              <div className = "PredictionsFixtures">
                {/* <div className = "PredictionFixturesBody">
                  {predictionsList}
                </div> */}
                <button className = "SaveButton">Save</button>
              </div>
              <button className = "NextStageArrow"></button>
            </div>
          </div>
        </div>
        <div className = "FixturesBody"
          style = {{visibility: fixturesOnTop ? 'visible' : 'hidden'}}
        > 
          <div className = "Fixtures">
            <p className = "FixturesTitle">Fixtures</p>
            {loading && <div className = "loading">Loading fixtures…</div>}
            {error && <div className = "error">Error: {error}</div>}
            {!loading && !error && fixtures.length === 0 && <div className = "loading">No fixtures found</div>}
            {!loading && !error && fixtures.length > 0 && fixtureList}
          </div>
          <div className = "Leaderboard">
            <p className = "LeaderboardTitle"> Leaderboard </p>
            <div className = "LeaderboardList">
            <ul className = "ScoresList">{scoresList}</ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;