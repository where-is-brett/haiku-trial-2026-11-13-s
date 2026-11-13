// src/lib/flags.js

// True when the named feature is listed in the comma-separated FEATURES variable.
export function featureOn(name, env = process.env) {
  const names = String(env.FEATURES ?? '')
    .split(',')
    .map((item) => item.trim());
  return names.includes(name);
}
