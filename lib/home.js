'use strict';
// Where cutroom keeps its small data files, plus safe JSON helpers.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function cutroomHome() {
  return process.env.CUTROOM_HOME || path.join(os.homedir(), '.cutroom');
}

function file(name) {
  return path.join(cutroomHome(), name);
}

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, p);
}

function appendJsonl(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(obj) + '\n');
}

function readJsonl(p) {
  let text;
  try {
    text = fs.readFileSync(p, 'utf8');
  } catch {
    return [];
  }
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* skip corrupt line */
    }
  }
  return out;
}

module.exports = { cutroomHome, file, readJson, writeJsonAtomic, appendJsonl, readJsonl };
