// Controllo indipendente (dopo la revisione): 40 operazioni con prezzi veri rifatte senza la classe Posizione.
// Uso: node research/revisione/rifai-prezzi-veri.js (dalla cartella del progetto)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const B = new URL('../', import.meta.url).href;
const { leggiColonne, storicoConFermi, MIN } = await import(B+'lib/backtest.js');
const { candele15 } = await import(B+'motore/volatilita.js');
const ris = JSON.parse(readFileSync('data/backtest/verifica/risultati.json','utf8'));
const DIR='data/backtest/verifica';
const cache = readdirSync(DIR).map(d=>join(DIR,d)).filter(d=>statSync(d).isDirectory()).sort((a,b)=>statSync(b).mtimeMs-statSync(a).mtimeMs)[0];
let seme=7; const rnd=()=>((seme=(seme*1103515245+12345)%2147483648)/2147483648);
const files=readdirSync(cache); let fatti=0, uguali=0; const diff=[];
while(fatti<40){
  const f=files[Math.floor(rnd()*files.length)]; const c=leggiColonne(join(cache,f));
  const idx=[...c.modo.keys()].filter(k=>c.modo[k]===0&&c.veri[k]>0); if(!idx.length) continue;
  const k=idx[Math.floor(rnd()*idx.length)];
  const [g,sim]=[f[0],f.slice(2,-4)];
  const da=g==='A'?Date.UTC(2019,8,1):Date.UTC(2023,0,1), a=g==='A'?Date.UTC(2023,0,1):Infinity;
  const s=storicoConFermi(sim, ris.fermi, {da,a});
  const perc=JSON.parse(readFileSync(`data/aggtrades/${sim}.json`,'utf8')).percorsi;
  const tE=c.entrata[k], lato=c.lato[k], P=c.prezzo[k];
  const u=candele15(s).atrPrima(tE)/P;
  const G=p=>lato*(p/P-1);
  let best=0, liv=-1.5*u, out=null;
  const upd=()=>{ if(best>=0.5*u){ liv=Math.max(liv,-1.5*u,best-u,0.6*best);} };
  for(let m=tE; m<tE+240*MIN && !out; m+=MIN){
    const i=(m-s.t0)/MIN; if(Number.isNaN(s.open[i])) continue;
    if(m>tE && Number.isNaN(s.open[i])) continue;
    const pts = perc[m] ? [s.open[i], ...perc[m]] : null;
    if(!pts) { out={p:NaN, note:'senza percorso '+new Date(m).toISOString()}; break; }
    // salto all'apertura
    if(G(pts[0])<=liv){ out={p:pts[0]}; break; }
    if(G(pts[0])>best){best=G(pts[0]);upd();}
    for(let j=1;j<pts.length&&!out;j++){
      const gB=G(pts[j]);
      if(gB>=G(pts[j-1])){ if(gB>best){best=gB;upd();} }
      else if(gB<=liv){ out={p:P*(1+lato*liv)}; }
    }
  }
  if(!out){ const i=(tE+240*MIN-s.t0)/MIN; out={p:s.open[i], note:'tempo'}; }
  const mio=out.p/P, motore=c.rapporto[k];
  fatti++; const d=Math.abs(mio-motore); diff.push(d); if(d<1e-9) uguali++;
  else console.log(sim, new Date(tE).toISOString(), lato, 'motore', motore.toFixed(6), 'mio', mio.toFixed(6), out.note||'');
}
console.log(`uguali ${uguali}/${fatti}`);
