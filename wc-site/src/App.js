import { useState } from 'react';
import './App.css';

function App() {
  const [fixturesOnTop, setFixturesOnTop] = useState(true);

  const scores = [['Joe Coles', '5 points'], ['Lee Knight', '2 points']];
  const scoresList = scores.map(player => 
    <button className = "UserScoreTile">
      <p className = "Name">{player[0]}</p>
      <p className = "Points">{player[1]}</p>
    </button>
  );

  const fixtures = [['Mexico', 'Argentina', '11/06/2026 20:00'],['USA', 'Paraguay', '12/06/2026 20:00'],['Mexico', 'USA', '12/06/2026 20:00'],['Argentina', 'Paraguay', '13/06/2026 20:00']];
  const fixtureList = fixtures.map(fixture => 
    <div className = "FixtureTile">
      <div className = "HomeScoreTile">
        <p className = "Score">0</p>
      </div>
      <div className = "TeamNamesandDate">
        <div className = "TeamNames">
          <p className = "HomeTeamFixture">{fixture[0]}</p>
          <p className = "V">V</p>
          <p className = "AwayTeamFixture">{fixture[1]}</p>
        </div>
        <div className = "MatchTime">
          <p>{fixture[2]}</p>
        </div>
      </div>
      <div className = "AwayScoreTile">
        <p className = "Score">0</p>
      </div>
    </div>
  )

  return (
    <div className = "App">
      <div className = "Titlebar"> Titlebar </div>
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
          style = {{zIndex: fixturesOnTop ? 0 : 2},{visibility: fixturesOnTop ? 'hidden' : 'visible'}}
        >
          <p className = "PredictionsTitle">Predictions</p>
            <div className = "Groups"></div>
        </div>
        <div className = "FixturesBody"
          style = {{visibility: fixturesOnTop ? 'visible' : 'hidden'}}
        > 
          <div className = "Fixtures">
            <p className = "FixturesTitle">Fixtures</p>
            {fixtureList}
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
