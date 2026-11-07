const stamp = () => new Date().toLocaleTimeString('de-DE');
export const log = {
  info: (...a) => console.log(`[${stamp()}]`, ...a),
  warn: (...a) => console.warn(`[${stamp()}] WARN`, ...a),
  error: (...a) => console.error(`[${stamp()}] FEHLER`, ...a),
};
