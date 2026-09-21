import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
const code=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Explicit sponsor file is isolated from old CUA/GPT environment values.
// Operational switches must also be written in that file, not inherited silently.
export function loadRuntimeEnv(env=process.env) {
  if(!env.PSS_LOCAL_ENV_FILE) {
    const file=path.join(code,'.env');
    return {...(fs.existsSync(file)?dotenv.parse(fs.readFileSync(file)):{}),...env};
  }
  const file=path.resolve(code,env.PSS_LOCAL_ENV_FILE);
  if(!fs.existsSync(file)) throw Error('Explicit provider env file does not exist');
  const parsed=dotenv.parse(fs.readFileSync(file));
  const clean=Object.fromEntries(Object.entries(env).filter(([key])=>! /^(CUA_|OPENAI_|PSS_LOCAL_|PSS_OPENAI_|PSS_AUX_)/.test(key)));
  return {...clean,...parsed,PSS_LOCAL_ENV_FILE:file};
}
