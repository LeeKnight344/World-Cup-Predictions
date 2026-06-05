import { LogLevel } from "@azure/msal-browser";

export const createMsalConfig = ({ entraClientId, entraTenantId, entraRedirectUri }) => {
  const redirectUri = entraRedirectUri || `${window.location.origin}/`;

  return {
    auth: {
      clientId: entraClientId,
      authority: `https://login.microsoftonline.com/${entraTenantId}`,
      redirectUri,
      postLogoutRedirectUri: redirectUri,
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
};

export const loginRequest = {
  scopes: ["User.Read"],
};
