import { bestPerFamily, rankWindings } from '../src/quantum-registers/windingFamilies.ts'

const ranked = rankWindings()
console.log('family           id                      bare   α⁻¹            rel')
for (const hit of ranked) {
  console.log([
    hit.family.padEnd(16),
    hit.id.padEnd(22),
    String(hit.bare).padStart(4),
    hit.inverse.toFixed(9).padStart(14),
    hit.relativeError.toExponential(3).padStart(11),
  ].join('  '))
}
console.log('\nbest in each family')
for (const hit of bestPerFamily()) {
  console.log(`${hit.family.padEnd(16)}  ${hit.id.padEnd(22)}  rel ${hit.relativeError.toExponential(3)}  α⁻¹=${hit.inverse.toFixed(9)}`)
}
console.log(`\n${ranked.length} windings; ${ranked.filter((hit) => hit.relativeError < 1e-6).length} below 1e-6; ${ranked.filter((hit) => hit.relativeError < 1e-11).length} below 1e-11`)
