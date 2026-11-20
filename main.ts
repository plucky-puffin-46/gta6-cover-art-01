// Entry program for the gta6-cover-art-01 bounty (Node 22, standard library only).
//
// The entry itself is the static web app in app/ — Vice Cover Studio, a GTA-style
// multi-panel cover maker that runs entirely offline in a desktop browser. This
// program's only job is to hand that app in: it copies app/ and screenshots/ into
// the output directory and writes dossier.json there with buildDossier from the
// vendored make.fun library, so the grader sees exactly the bytes the judge reads.
//
// Run it with:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (MAKEFUN_OUTPUT_DIR stands in for /output outside the grader's container.)

import { Buffer } from 'node:buffer';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy the app first, then the screenshots, creating the folders the grader expects.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoDir, 'app'), join(outputDir, 'app'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps below mirror the scorer's own gate, so an entry the scorer would refuse
// (too many or too-large screenshots, an oversized app/) fails here instead.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

// A one-line receipt for whoever ran this: what was handed in, and where it went.
console.log(`Vice Cover Studio handed in to ${outputDir}: app/ and screenshots/ copied, dossier.json written (${Buffer.byteLength(dossier)} bytes).`);
