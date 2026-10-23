// Remotion-Einstellungen. Medien liegen in assets/ (dort mit staticFile('…') ansprechbar).
import { Config } from '@remotion/cli/config';
import { existsSync } from 'node:fs';

Config.setPublicDir('./assets');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
// In der Cloud-Umgebung ist Chromium vorinstalliert; lokal lädt Remotion sonst selbst einen Browser.
const preinstalled = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (existsSync(preinstalled)) Config.setBrowserExecutable(preinstalled);
