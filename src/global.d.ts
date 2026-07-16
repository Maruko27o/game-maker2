// Build-time app version, injected by Vite `define` (see vite.config.ts). The
// deployed site also serves a matching version.json; the running bundle compares
// the two to detect that a newer version has been deployed.
declare const __APP_VERSION__: string;
