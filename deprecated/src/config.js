import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

dotenv.config({ path: path.join(projectRoot, '.env') });

const appConfig = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'config', 'app.json'), 'utf-8')
);

const profilesConfig = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'config', 'profiles.json'), 'utf-8')
);

export const config = {
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
  logLevel: process.env.LOG_LEVEL || appConfig.logLevel || 'info',
  verbose: process.env.VERBOSE === 'true',
  defaultProfile: process.env.DEFAULT_PROFILE || appConfig.defaultProfile || 'premiere',
  audio: appConfig.audio,
  deepgram: appConfig.deepgram,
  mapping: appConfig.mapping,
  ahk: {
    ...appConfig.ahk,
    scriptPath: path.join(projectRoot, appConfig.ahk.scriptPath),
  },
  profiles: profilesConfig.profiles,
  projectRoot,
};

export function getProfile(name) {
  return config.profiles[name] || null;
}

export function getCommand(profileName, keyword) {
  const profile = getProfile(profileName);
  if (!profile) return null;
  return profile.commands[keyword] || null;
}

export default config;
