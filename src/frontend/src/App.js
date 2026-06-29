//use a .js formatting tool from VS otherwise i'm going to ddos you


import { useState, useEffect, useCallback, useRef } from "react";
import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
  useMsal,
} from "@azure/msal-react";
import { loginRequest } from "./authConfig";
import "./App.css";
import { FixturePredictionTile } from "./FixturePredictiontile";
import FixtureTile from "./FixtureTile";

const DASHBOARD_REFRESH_INTERVAL_MS = 30000;

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let i = 0; i < table.length; i += 1) {
    let value = i;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[i] = value >>> 0;
  }

  return table;
})();

const escapeXmlValue = (value) => {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
};

const getExcelColumnName = (index) => {
  let column = "";
  let value = index + 1;

  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }

  return column;
};

const createWorksheetXml = (rows) => {
  const lastColumn = getExcelColumnName(rows[0].length - 1);
  const sheetRows = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((cell, cellIndex) => {
          const reference = `${getExcelColumnName(cellIndex)}${rowNumber}`;

          if (typeof cell === "number") {
            return `<c r="${reference}"><v>${cell}</v></c>`;
          }

          return `<c r="${reference}" t="inlineStr"><is><t>${escapeXmlValue(cell)}</t></is></c>`;
        })
        .join("");

      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${rows.length}" />
  <sheetViews>
    <sheetView workbookViewId="0" />
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15" />
  <cols>
    <col min="1" max="1" width="10" customWidth="1" />
    <col min="2" max="2" width="32" customWidth="1" />
    <col min="3" max="3" width="22" customWidth="1" />
    <col min="4" max="4" width="12" customWidth="1" />
  </cols>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
};

const getCrc32 = (bytes) => {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const writeUint16 = (buffer, offset, value) => {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
};

const writeUint32 = (buffer, offset, value) => {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
  buffer[offset + 3] = (value >>> 24) & 0xff;
};

const getZipDateParts = () => {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  return { time, date };
};

const concatByteArrays = (arrays) => {
  const totalLength = arrays.reduce((total, array) => total + array.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
};

const createZipBlob = (files, mimeType) => {
  const encoder = new TextEncoder();
  const { time, date } = getZipDateParts();
  const localFileParts = [];
  const centralDirectoryParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const crc = getCrc32(dataBytes);
    const localHeader = new Uint8Array(30 + nameBytes.length);

    writeUint32(localHeader, 0, 0x04034b50);
    writeUint16(localHeader, 4, 20);
    writeUint16(localHeader, 6, 0);
    writeUint16(localHeader, 8, 0);
    writeUint16(localHeader, 10, time);
    writeUint16(localHeader, 12, date);
    writeUint32(localHeader, 14, crc);
    writeUint32(localHeader, 18, dataBytes.length);
    writeUint32(localHeader, 22, dataBytes.length);
    writeUint16(localHeader, 26, nameBytes.length);
    writeUint16(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);

    localFileParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32(centralHeader, 0, 0x02014b50);
    writeUint16(centralHeader, 4, 20);
    writeUint16(centralHeader, 6, 20);
    writeUint16(centralHeader, 8, 0);
    writeUint16(centralHeader, 10, 0);
    writeUint16(centralHeader, 12, time);
    writeUint16(centralHeader, 14, date);
    writeUint32(centralHeader, 16, crc);
    writeUint32(centralHeader, 20, dataBytes.length);
    writeUint32(centralHeader, 24, dataBytes.length);
    writeUint16(centralHeader, 28, nameBytes.length);
    writeUint16(centralHeader, 30, 0);
    writeUint16(centralHeader, 32, 0);
    writeUint16(centralHeader, 34, 0);
    writeUint16(centralHeader, 36, 0);
    writeUint32(centralHeader, 38, 0);
    writeUint32(centralHeader, 42, offset);
    centralHeader.set(nameBytes, 46);

    centralDirectoryParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralDirectory = concatByteArrays(centralDirectoryParts);
  const endRecord = new Uint8Array(22);

  writeUint32(endRecord, 0, 0x06054b50);
  writeUint16(endRecord, 4, 0);
  writeUint16(endRecord, 6, 0);
  writeUint16(endRecord, 8, files.length);
  writeUint16(endRecord, 10, files.length);
  writeUint32(endRecord, 12, centralDirectory.length);
  writeUint32(endRecord, 16, offset);
  writeUint16(endRecord, 20, 0);

  return new Blob([...localFileParts, centralDirectory, endRecord], { type: mimeType });
};

const createExcelWorkbookBlob = (rows) => {
  const mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="xml" ContentType="application/xml" />
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" />
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" />
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml" />
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Leaderboard" sheetId="1" r:id="rId1" />
  </sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml" />
</Relationships>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: createWorksheetXml(rows),
    },
  ];

  return createZipBlob(files, mimeType);
};

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
      Sign Out
    </button>
  );
}

function UserHeader() {
  const { accounts, instance } = useMsal();
  const account = accounts[0];
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;

    const loadProfilePhoto = async () => {
      if (!account) {
        setProfilePhotoUrl(null);
        return;
      }

      try {
        const tokenResponse = await instance.acquireTokenSilent({
          ...loginRequest,
          account,
        });

        const response = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
          headers: {
            Authorization: `Bearer ${tokenResponse.accessToken}`,
          },
        });

        if (!response.ok) {
          setProfilePhotoUrl(null);
          return;
        }

        const photoBlob = await response.blob();
        objectUrl = URL.createObjectURL(photoBlob);

        if (!cancelled) {
          setProfilePhotoUrl(objectUrl);
        }
      } catch {
        if (!cancelled) {
          setProfilePhotoUrl(null);
        }
      }
    };

    loadProfilePhoto();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [account, instance]);

  return (
    <div className="auth-header">
      <div className="auth-avatar" aria-hidden="true">
        {profilePhotoUrl ? (
          <img src={profilePhotoUrl} alt="" />
        ) : (
          account?.username?.charAt(0)?.toUpperCase() ?? "U"
        )}
      </div>
      <div className="auth-user">
        <span className="auth-label">Signed in as</span>
        <span className="auth-email">{account?.username}</span>
      </div>
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
          <img
              className="AnnataLogo"
              src="/AnnataLogo.svg"
              alt="Annata logo"
            />
          <div className="LoginHeader">
            <h1>Annata World Cup Predictions Competition</h1>  
          </div>
          <p>Please sign in to view and submit predictions.</p>
          <SignInButton />
        </main>
      </UnauthenticatedTemplate>
    </>
  );
}

function Dashboard() {
  const { accounts } = useMsal();
  const account = accounts[0];
  const [fixturesOnTop, setFixturesOnTop] = useState(true);
  const [selectedStage, setSelectedStage] = useState("group");
  const [fixtures, setFixtures] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [predictionEdits, setPredictionEdits] = useState({});
  const [savingPredictions, setSavingPredictions] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [exportingLeaderboard, setExportingLeaderboard] = useState(false);
  const [loadingPredictionsPage, setLoadingPredictionsPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const latestDashboardFetchId = useRef(0);
  const dashboardRefreshInProgress = useRef(false);
  const savingPredictionsInProgress = useRef(false);

  const fetchDashboardData = useCallback(async ({ applyToState = true, skipIfBusy = false } = {}) => {
    if (skipIfBusy && (dashboardRefreshInProgress.current || savingPredictionsInProgress.current)) {
      return null;
    }

    const fetchId = latestDashboardFetchId.current + 1;
    latestDashboardFetchId.current = fetchId;
    dashboardRefreshInProgress.current = true;

    try {
      const [fixturesResponse, predictionsResponse] = await Promise.all([
        fetch("/api/fixtures"),
        fetch("/api/predictions"),
      ]);

      if (!fixturesResponse.ok) {
        throw new Error("Failed to fetch fixtures");
      }

      if (!predictionsResponse.ok) {
        throw new Error("Failed to fetch predictions");
      }

      const [fixturesData, predictionsData] = await Promise.all([
        fixturesResponse.json(),
        predictionsResponse.json(),
      ]);

      if (
        applyToState &&
        fetchId === latestDashboardFetchId.current &&
        !savingPredictionsInProgress.current
      ) {
        setFixtures(fixturesData);
        setPredictions(predictionsData);
      }

      return { fixtures: fixturesData, predictions: predictionsData };
    } catch (err) {
      if (fetchId !== latestDashboardFetchId.current) {
        return null;
      }

      throw err;
    } finally {
      if (fetchId === latestDashboardFetchId.current) {
        dashboardRefreshInProgress.current = false;
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadDashboardData = async () => {
      try {
        const data = await fetchDashboardData({ skipIfBusy: true });
        if (!data) return;

        if (!cancelled) {
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadDashboardData();

    const refreshInterval = setInterval(loadDashboardData, DASHBOARD_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(refreshInterval);
    };
  }, [fetchDashboardData]);

  const calculatePredictionScore = ({
    matchStatus,
    homeTeamScore,
    awayTeamScore,
    homeTeamPenaltyScore,
    awayTeamPenaltyScore,
    penaltyBoolean,
    team1ScorePrediction,
    team2ScorePrediction,
  }) => {
    if (!["complete", "completed"].includes(String(matchStatus ?? "").toLowerCase())) {
      return null;
    }

    if (
      homeTeamScore == null ||
      awayTeamScore == null ||
      team1ScorePrediction == null ||
      team2ScorePrediction == null
    ) {
      return null;
    }

    if (homeTeamScore === team1ScorePrediction && awayTeamScore === team2ScorePrediction) {
      return 5;
    }

    const actualDifference = homeTeamScore - awayTeamScore;
    const predictedDifference = team1ScorePrediction - team2ScorePrediction;
    const actualWinnerDifference =
      actualDifference !== 0 ||
      !penaltyBoolean ||
      homeTeamPenaltyScore == null ||
      awayTeamPenaltyScore == null
        ? actualDifference
        : homeTeamPenaltyScore - awayTeamPenaltyScore;

    if (actualDifference === predictedDifference) {
      return 3;
    }

    if (
      actualWinnerDifference !== 0 &&
      predictedDifference !== 0 &&
      Math.sign(actualWinnerDifference) === Math.sign(predictedDifference)
    ) {
      return 1;
    }

    return 0;
  };

  // Pull every email-looking token out of an identifier. The local-part class
  // is greedy and shares characters (letters, digits, '.', '-', '_', '+', '%')
  // with text that may be glued to the email in the identifier (e.g.
  // "Match12-john.smith@annata.net"). Anchoring the start of the local part to
  // a non-local-part character (or string boundary) prevents the regex from
  // swallowing that prefix and returning a bogus address.
  const EMAIL_TOKEN_REGEX = /(?:^|[^A-Z0-9._%+-])([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})(?![A-Z0-9.-])/gi;

  const getPredictionEmails = (identifier) => {
    if (!identifier) return [];

    const matches = [];
    for (const match of identifier.matchAll(EMAIL_TOKEN_REGEX)) {
      matches.push(match[1].toLowerCase());
    }
    return matches;
  };

  const identifierMatchesEmail = (identifier, email) => {
    if (!identifier || !email) return false;
    return getPredictionEmails(identifier).includes(email);
  };

  const scores = Object.values(
    predictions.reduce((acc, prediction) => {
      const [email] = getPredictionEmails(prediction.identifier);
      if (!email) return acc;

      if (!acc[email]) {
        acc[email] = {
          name: email,
          points: 0,
        };
      }

      acc[email].points += prediction.score ?? 0;
      return acc;
    }, {})
  ).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  const exportLeaderboard = async () => {
    if (scores.length === 0 || exportingLeaderboard) return;

    const getProfileName = (profile, fallbackEmail) => {
      const firstName = profile?.firstName?.trim() ?? "";
      const lastName = profile?.lastName?.trim() ?? "";
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || profile?.fullName || fallbackEmail;
    };

    setExportingLeaderboard(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/leaderboard/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emails: scores.map((player) => player.name),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to enrich leaderboard users");
      }

      const profiles = await response.json();
      const profileByEmail = profiles.reduce((acc, profile) => {
        if (profile.email) {
          acc[profile.email.toLowerCase()] = profile;
        }
        return acc;
      }, {});

      const worksheetRows = [
        ["Rank", "Name", "Region", "Points"],
        ...scores.map((player, index) => {
          const profile = profileByEmail[player.name.toLowerCase()];
          return [
            index + 1,
            getProfileName(profile, player.name),
            profile?.region ?? "",
            player.points,
          ];
        }),
      ];
      const blob = createExcelWorkbookBlob(worksheetRows);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = `leaderboard-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setExportingLeaderboard(false);
    }
  };

  const scoresList = scores.map((player) => (
    <button key={player.name} className="UserScoreTile">
      <p className="Name">{player.name}</p>
      <p className="Points">{player.points} points</p>
    </button>
  ));

  const indexById = (items) => {
    return items.reduce((acc, item) => {
      const itemId = item.id?.toLowerCase();
      if (itemId) {
        acc[itemId] = item;
      }
      return acc;
    }, {});
  };

  const fixtureById = indexById(fixtures);
  const userEmail = account?.username?.toLowerCase() ?? "";

  const predictionsForUser = predictions.filter((prediction) => {
    return userEmail && identifierMatchesEmail(prediction.identifier, userEmail);
  });

  const getFixtureStage = (fixture) => {
    const matchId = Number(fixture?.matchId ?? 0);
    return matchId > 72 ? "knockouts" : "group";
  };

  const isSelectedStageFixture = (fixture) => {
    return getFixtureStage(fixture) === selectedStage;
  };

  const parsePredictionScore = (value) => {
    return value === "" ? null : Number(value);
  };

  const handlePredictionChange = ({ fixture, prediction, team, value }) => {
    if (!prediction?.id) return;

    setPredictionEdits((current) => {
      const existing = current[prediction.id] ?? {
        fixtureId: fixture.id,
        team1ScorePrediction: prediction.team1ScorePrediction ?? "",
        team2ScorePrediction: prediction.team2ScorePrediction ?? "",
      };

      return {
        ...current,
        [prediction.id]: {
          ...existing,
          [team === "team1" ? "team1ScorePrediction" : "team2ScorePrediction"]: value,
        },
      };
    });
  };

  const loadPredictionsPage = async () => {
    if (loadingPredictionsPage) return;

    setLoadingPredictionsPage(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/predictions/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: account?.username ?? null,
        }),
      });

      if (response.status !== 202) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to generate predictions");
      }

      await fetchDashboardData();
      setFixturesOnTop(false);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setLoadingPredictionsPage(false);
    }
  };

  const savePredictionChanges = async () => {
    const changedPredictions = Object.entries(predictionEdits);
    if (changedPredictions.length === 0 || savingPredictions || savingPredictionsInProgress.current) return;

    const submittedEdits = Object.fromEntries(changedPredictions);
    savingPredictionsInProgress.current = true;
    setSavingPredictions(true);
    setSaveError(null);

    try {
      const { fixtures: latestFixtures, predictions: latestPredictions } = await fetchDashboardData({
        applyToState: false,
      });
      const latestFixtureById = indexById(latestFixtures);
      const latestPredictionById = indexById(latestPredictions);

      const payload = {
        submittedAt: new Date().toISOString(),
        submittedBy: account?.username ?? null,
        predictions: changedPredictions.map(([predictionId, edit]) => {
          const currentPrediction = latestPredictionById[predictionId.toLowerCase()] ?? null;
          const fixtureId = currentPrediction?.fixtureId ?? edit.fixtureId;
          const fixture = fixtureId ? latestFixtureById[fixtureId.toLowerCase()] : null;
          const team1ScorePrediction = parsePredictionScore(edit.team1ScorePrediction);
          const team2ScorePrediction = parsePredictionScore(edit.team2ScorePrediction);
          const score = calculatePredictionScore({
            matchStatus: fixture?.matchStatus,
            homeTeamScore: fixture?.homeTeamScore,
            awayTeamScore: fixture?.awayTeamScore,
            homeTeamPenaltyScore: fixture?.homeTeamPenaltyScore,
            awayTeamPenaltyScore: fixture?.awayTeamPenaltyScore,
            penaltyBoolean: fixture?.penaltyBoolean,
            team1ScorePrediction,
            team2ScorePrediction,
          });

          return {
            predictionId: currentPrediction?.id ?? predictionId,
            predictionIdentifier: currentPrediction?.identifier ?? null,
            predictionEmail: getPredictionEmails(currentPrediction?.identifier)[0] ?? null,
            predictionRecord: currentPrediction,
            fixtureId,
            fixtureRecord: fixture,
            fixtureName: fixture?.title ?? null,
            matchId: fixture?.matchId ?? null,
            matchStatus: fixture?.matchStatus ?? null,
            homeTeam: fixture?.homeTeam ?? null,
            awayTeam: fixture?.awayTeam ?? null,
            kickoff: fixture?.kickoff ?? null,
            currentTeam1ScorePrediction: currentPrediction?.team1ScorePrediction ?? null,
            currentTeam2ScorePrediction: currentPrediction?.team2ScorePrediction ?? null,
            team1ScorePrediction,
            team2ScorePrediction,
            score,
          };
        }),
      };

      const response = await fetch("/api/predictions/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to save predictions");
      }

      setFixtures(latestFixtures);
      setPredictions(
        latestPredictions.map((prediction) => {
          const edit = submittedEdits[prediction.id];
          if (!edit) return prediction;

          return {
            ...prediction,
            team1ScorePrediction: parsePredictionScore(edit.team1ScorePrediction),
            team2ScorePrediction: parsePredictionScore(edit.team2ScorePrediction),
            score: calculatePredictionScore({
              matchStatus: latestFixtureById[edit.fixtureId?.toLowerCase()]?.matchStatus,
              homeTeamScore: latestFixtureById[edit.fixtureId?.toLowerCase()]?.homeTeamScore,
              awayTeamScore: latestFixtureById[edit.fixtureId?.toLowerCase()]?.awayTeamScore,
              homeTeamPenaltyScore: latestFixtureById[edit.fixtureId?.toLowerCase()]?.homeTeamPenaltyScore,
              awayTeamPenaltyScore: latestFixtureById[edit.fixtureId?.toLowerCase()]?.awayTeamPenaltyScore,
              penaltyBoolean: latestFixtureById[edit.fixtureId?.toLowerCase()]?.penaltyBoolean,
              team1ScorePrediction: parsePredictionScore(edit.team1ScorePrediction),
              team2ScorePrediction: parsePredictionScore(edit.team2ScorePrediction),
            }),
          };
        })
      );
      setPredictionEdits((current) => {
        const remainingEdits = { ...current };

        for (const [predictionId, edit] of Object.entries(submittedEdits)) {
          if (remainingEdits[predictionId] === edit) {
            delete remainingEdits[predictionId];
          }
        }

        return remainingEdits;
      });
    } catch (err) {
      setSaveError(err.message);
    } finally {
      savingPredictionsInProgress.current = false;
      setSavingPredictions(false);
    }
  };

  const predictionFixturesByDay = Object.values(
    predictionsForUser
      .map((prediction) => {
        const fixture = prediction.fixtureId
          ? fixtureById[prediction.fixtureId.toLowerCase()]
          : null;

        return {
          prediction,
          fixture: fixture ?? {
            id: prediction.fixtureId,
            homeTeam: prediction.fixtureName ?? "Fixture",
            awayTeam: "",
            kickoff: null,
            matchId: prediction.matchId ?? 0,
            homeTeamPenaltyScore: null,
            awayTeamPenaltyScore: null,
            penaltyBoolean: false,
            matchStatus: "",
          },
        };
      })
      .filter((item) => isSelectedStageFixture(item.fixture))
      .sort((a, b) => {
        const aTime = a.fixture.kickoff ? new Date(a.fixture.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.fixture.kickoff ? new Date(b.fixture.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
      .reduce((acc, item) => {
        const kickoff = item.fixture.kickoff ? new Date(item.fixture.kickoff) : null;
        const key = kickoff ? kickoff.toISOString().slice(0, 10) : "nodate";
        if (!acc[key]) acc[key] = { date: kickoff, items: [] };
        acc[key].items.push(item);
        return acc;
      }, {})
  );

  const fixturesByDay = Object.values(
    fixtures
      .slice()
      .filter(isSelectedStageFixture)
      .sort((a, b) => {
        const aTime = a.kickoff ? new Date(a.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.kickoff ? new Date(b.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
      .reduce((acc, fixture) => {
        const kickoff = fixture.kickoff ? new Date(fixture.kickoff) : null;
        const key = kickoff ? kickoff.toISOString().slice(0, 10) : "nodate";
        if (!acc[key]) acc[key] = { date: kickoff, items: [] };
        acc[key].items.push(fixture);
        return acc;
      }, {})
  );

  const fixtureList = fixturesByDay.map((group) => (
    <div className="MatchDayGroup" key={group.date?.toISOString() ?? "nodate"}>
      <h3 className="MatchDayHeader">
        {group.date
          ? group.date.toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })
          : "No date"}
      </h3>
      {group.items.map((fixture) => (
        <div
          key={fixture.id ?? fixture.matchId ?? `${fixture.homeTeam}-${fixture.awayTeam}`}
          className="FixtureTile"
        >
          <FixtureTile fixture={fixture} />
        </div>
      ))}
    </div>
  ));

  return (
    <div className="App">
      <img
              className="AnnataLogo"
              src="/AnnataLogo.svg"
              alt="Annata logo"
            />
      <div className="Titlebar">
        <h1>
          Annata - World Cup 2026
        </h1>
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
          disabled={loadingPredictionsPage}
          onClick={loadPredictionsPage}
        >
          {loadingPredictionsPage ? "Loading" : "Predictions"}
        </button>
      </div>

      {saveError && <div className="error">Error: {saveError}</div>}

      <div className="MainBody">
        <div
          className="Predictions"
          style={{
            zIndex: fixturesOnTop ? 0 : 2,
            visibility: fixturesOnTop ? "hidden" : "visible",
            display: fixturesOnTop ? "none" : "block",
          }}
        >
          <div className="Groups">
            <p className="PredictionsTitle">Predictions</p>
            <div className="StageButtons" aria-label="Prediction stage">
              <button
                className={selectedStage === "group" ? "StageButton StageButtonActive" : "StageButton"}
                onClick={() => setSelectedStage("group")}
              >
                Group Stage
              </button>
              <button
                className={selectedStage === "knockouts" ? "StageButton StageButtonActive" : "StageButton"}
                onClick={() => setSelectedStage("knockouts")}
              >
                Knockouts
              </button>
            </div>

            <div className="PredictionsBody">
              <div className="PredictionsFixtures">
                <div className="PredictionFixturesBody">
                  {predictionsForUser.length === 0 ? (
                    <div className="loading">No predictions found</div>
                  ) : predictionFixturesByDay.length === 0 ? (
                    <div className="loading">No predictions found for this stage</div>
                  ) : (
                    predictionFixturesByDay.map((g) => (
                      <div className="MatchDayGroup" key={g.date?.toISOString() ?? "nodate"}>
                        <h3 className="MatchDayHeader">
                          {g.date
                            ? g.date.toLocaleDateString(undefined, {
                                weekday: "long",
                                month: "short",
                                day: "numeric",
                              })
                            : "No date"}
                        </h3>
                        <div className="PredictionFixturesGrid">
                          {g.items.map(({ fixture, prediction }) => (
                            <div
                              className="PredictionFixtureTileHost"
                              key={prediction.id ?? fixture.id ?? `${fixture.homeTeam}-${fixture.awayTeam}`}
                            >
                              <FixturePredictionTile
                                fixture={fixture}
                                prediction={prediction}
                                value={predictionEdits[prediction.id]}
                                onPredictionChange={handlePredictionChange}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
              </div>
              <button
                    className="SaveButton"
                    disabled={Object.keys(predictionEdits).length === 0 || savingPredictions}
                    onClick={savePredictionChanges}
                  >
                    {savingPredictions ? "Saving" : "Save"}
              </button>
            </div>
          </div>
        </div>

        <div
          className="FixturesBody"
          style={{
            visibility: fixturesOnTop ? "visible" : "hidden",
            display: fixturesOnTop ? "flex" : "none",
          }}
        >
          <div className="Fixtures">
            <p className="FixturesTitle">Fixtures</p>
            <div className="StageButtons" aria-label="Fixture stage">
              <button
                className={selectedStage === "group" ? "StageButton StageButtonActive" : "StageButton"}
                onClick={() => setSelectedStage("group")}
              >
                Group Stage
              </button>
              <button
                className={selectedStage === "knockouts" ? "StageButton StageButtonActive" : "StageButton"}
                onClick={() => setSelectedStage("knockouts")}
              >
                Knockouts
              </button>
            </div>

            {loading && <div className="loading">Loading fixtures…</div>}

            {error && <div className="error">Error: {error}</div>}

            {!loading && !error && fixtures.length === 0 && (
              <div className="loading">No fixtures found</div>
            )}

            {!loading && !error && fixtures.length > 0 && fixtureList.length === 0 && (
              <div className="loading">No fixtures found for this stage</div>
            )}

            {!loading && !error && fixtures.length > 0 && fixtureList}
          </div>

          <div className="Leaderboard">
            <div className="LeaderboardHeader">
              <p className="LeaderboardTitle">Leaderboard</p>
              <button
                className="LeaderboardExportButton"
                disabled={scores.length === 0 || exportingLeaderboard}
                onClick={exportLeaderboard}
                type="button"
              >
                {exportingLeaderboard ? "Exporting" : "Export Excel"}
              </button>
            </div>

            <div className="LeaderboardList">
              <ul className="LeaderboardScoresList">{scoresList}</ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
