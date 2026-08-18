// capacitor.config.ts — racine du projet
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.adressegn.app",
  appName: "Adresse GN",
  webDir: "dist",
  server: {
    url: "https://adresse-gn.netlify.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#2E4A7B",
    overrideUserAgent: undefined,
    appendUserAgent: "AdresseGN-Android",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#2E4A7B",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      spinnerColor: "#ffffff",
      splashFullScreen: true,
      splashImmersive: true,
      layoutName: "launch_screen",
      useDialog: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#2E4A7B",
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Keyboard: {
      resize: "body",
      style: "DARK",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
