import { LogLevel } from "@azure/msal-browser";

export const msalConfig = {
  auth: {
    clientId: process.env.REACT_APP_ENTRA_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.REACT_APP_ENTRA_TENANT_ID}`,
    redirectUri: process.env.REACT_APP_ENTRA_REDIRECT_URI,
    postLogoutRedirectUri: process.env.REACT_APP_ENTRA_REDIRECT_URI,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (_level, message, containsPii) => {
        if (!containsPii) console.log(message);
      },
      logLevel: LogLevel.Warning,
    },
  },
};

export const loginRequest = {
  scopes: ["User.Read"],
};