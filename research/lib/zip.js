// Estrazione minima di file .zip (quelli di data.binance.vision contengono un solo CSV).
import { inflateRawSync } from 'node:zlib';

export function estraiPrimoFile(buf) {
  // Fine della directory centrale: firma 0x06054b50 cercata dal fondo
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip non valido: manca la directory centrale');
  const cd = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error('zip non valido: directory centrale');
  const metodo = buf.readUInt16LE(cd + 10);
  const dimCompressa = buf.readUInt32LE(cd + 20);
  const offLocale = buf.readUInt32LE(cd + 42);
  if (buf.readUInt32LE(offLocale) !== 0x04034b50) throw new Error('zip non valido: intestazione locale');
  const inizio = offLocale + 30 + buf.readUInt16LE(offLocale + 26) + buf.readUInt16LE(offLocale + 28);
  const dati = buf.subarray(inizio, inizio + dimCompressa);
  if (metodo === 0) return dati;
  if (metodo === 8) return inflateRawSync(dati);
  throw new Error(`zip: metodo di compressione ${metodo} non supportato`);
}
