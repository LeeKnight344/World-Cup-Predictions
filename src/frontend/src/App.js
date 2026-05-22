//use a .js formatting tool from VS otherwise i'm going to ddos you


import { useState, useEffect } from "react";
import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
  useMsal,
} from "@azure/msal-react";
import { loginRequest } from "./authConfig";
import "./App.css";
import { FixtureTile } from "./FixturePredictiontile";

function SignInButton() {
  const { instance } = useMsal();

  return (
    <button className="SignInButton" onClick={() => instance.loginRedirect(loginRequest)}>
      Sign in with Microsoft
    </button>
  );
}

function SignOutButton() {
  const { instance } = useMsal();

  return (
    <button className="SignOutButton" onClick={() => instance.logoutRedirect()}>
      Sign out
    </button>
  );
}

function UserHeader() {
  const { accounts } = useMsal();
  const account = accounts[0];

  return (
    <div className="auth-header">
      <span>Signed in as {account?.username}</span>
      <SignOutButton />
    </div>
  );
}

function App() {
  return (
    <>
      <AuthenticatedTemplate>
        <UserHeader />
        <Dashboard />
      </AuthenticatedTemplate>

      <UnauthenticatedTemplate>
        <main className="login-page">
          <h1>Fixture Predictions</h1>
          <p>Please sign in to view and submit predictions.</p>
          <SignInButton />
        </main>
      </UnauthenticatedTemplate>
    </>
  );
}

function Dashboard() {
  const [fixturesOnTop, setFixturesOnTop] = useState(true);
  const [fixtures, setFixtures] = useState([]);
  const [selectedFixture, setSelectedFixture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFixtures = async () => {
      try {
        const response = await fetch("/api/fixtures");

        if (!response.ok) {
          throw new Error("Failed to fetch fixtures");
        }

        const data = await response.json();
        setFixtures(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFixtures();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return "Date not set";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const scores = [
    ["Ben Dover", "67 points"],
    ["John Dingle", "69 points"],
  ];

  const scoresList = scores.map((player) => (
    <button key={player[0]} className="UserScoreTile">
      <p className="Name">{player[0]}</p>
      <p className="Points">{player[1]}</p>
    </button>
  ));

  const fixtureList = fixtures.map((fixture) => (
    <div
      key={fixture.id}
      className="FixtureTile"
      onClick={() => setSelectedFixture(fixture)}
      style={{ cursor: "pointer" }}
    >
      <div className="HomeScoreTile">
        <p className="Score">{fixture.homeTeamScore ?? "-"}</p>
      </div>

      <div className="FixTeamNamesandDate">
        <div className="FixTeamNames">
          <p className="FixHomeTeamFixture">{fixture.homeTeam}</p>
          <p className="FixV">V</p>
          <p className="FixAwayTeamFixture">{fixture.awayTeam}</p>
        </div>

        <div className="FixMatchTime">
          <p>{formatDate(fixture.kickoff)}</p>
        </div>
      </div>

      <div className="FixAwayScoreTile">
        <p className="FixScore">{fixture.awayTeamScore ?? "-"}</p>
      </div>
    </div>
  ));

  return (
    <div className="App">
      <div className="Titlebar">
        <h1>Fixture Predictions</h1>
        <p>Dataverse-backed fixture list and predictions dashboard</p>
      </div>

      <div className="Tabs">
        <button
          className="FixturesTab"
          onClick={() => {
            setFixturesOnTop(true);
          }}
        >
          Fixtures
        </button>

        <button
          className="PredictionsTab"
          onClick={() => {
            setFixturesOnTop(false);
          }}
        >
          Predictions
        </button>
      </div>

      <div className="MainBody">
        <div
          className="Predictions"
          style={{
            zIndex: fixturesOnTop ? 0 : 2,
            visibility: fixturesOnTop ? "hidden" : "visible",
          }}
        >
          <div className="Groups">
            <p className="PredictionsTitle">Predictions</p>
            <p className="StageTitle">Groups</p>

            <div className="PredictionsBody">
              <button className="PreviousStageArrow"></button>

              <div className="PredictionsFixtures">
                <div className="PredictionFixturesBody">
                  <FixtureTile fixture={selectedFixture || fixtures[0] || {}} onPredictionChange={() => {}} />
                <button className="SaveButton">Save</button>
              </div>

              <button className="NextStageArrow"></button>
            </div>
          </div>
        </div>

        <div
          className="FixturesBody"
          style={{
            visibility: fixturesOnTop ? "visible" : "hidden",
          }}
        >
          <div className="Fixtures">
            <p className="FixturesTitle">Fixtures</p>

            {loading && <div className="loading">Loading fixtures…</div>}

            {error && <div className="error">Error: {error}</div>}

            {!loading && !error && fixtures.length === 0 && (
              <div className="loading">No fixtures found</div>
            )}

            {!loading && !error && fixtures.length > 0 && fixtureList}
          </div>

          <div className="Leaderboard">
            <p className="LeaderboardTitle">Leaderboard</p>

            <div className="LeaderboardList">
              <ul className="LeaderboardScoresList">{scoresList}</ul>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

export default App;