// Laufzeit-Config der SPA. Lokal in der Dev (vite) bleibt dies leer, sodass
// authConfig.ts auf die VITE_*-Build-Env zurueckfaellt. Im Container wird
// diese Datei beim Start vom Entrypoint (docker-entrypoint.frontend.sh) aus
// den Compose-Env-Vars/Secrets neu geschrieben.
window.__APP_CONFIG__ = {};
