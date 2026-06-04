import { LogLevel } from "@azure/msal-browser";

const runtimeConfig = window.__APP_CONFIG__ || {};

const getConfigValue = (name) => runtimeConfig[name] || process.env[name];

const getRedirectUri = () => {
  const configuredRedirectUri = getConfigValue("REACT_APP_ENTRA_REDIRECT_URI");

  if (!configuredRedirectUri) {
    return `${window.location.origin}/`;
  }

  try {
    const configuredUrl = new URL(configuredRedirectUri);

    if (configuredUrl.origin === window.location.origin) {
      return configuredRedirectUri;
    }
  } catch {
    // Fall back to the current page origin if the configured value is malformed.
  }

  return `${window.location.origin}/`;
};

const redirectUri = getRedirectUri();

export const msalConfig = {
  auth: {
    clientId: getConfigValue("REACT_APP_ENTRA_CLIENT_ID"),
    authority: `https://login.microsoftonline.com/${getConfigValue("REACT_APP_ENTRA_TENANT_ID")}`,
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

export const loginRequest = {
  scopes: ["User.Read"],
};
