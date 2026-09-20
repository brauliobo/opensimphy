# Edwin Gray motor schematic (source-bounded)

UI-mountable reconstruction from the retained pack and presenter captions.
This is not a teardown and does not change the classical engine unless Whisper/frames contradict it.

## Sources

- Video: `https://www.youtube.com/watch?v=nC740fpBs4M` (`nC740fpBs4M`, 1:16:08)
- Auto captions: `source/media/nC740fpBs4M.en-orig.vtt`
- Retained segment: `source/media/nC740fpBs4M-470-770.mp4` (00:07:50–00:12:50)
- Genealogy frames: `frames/genealogy-001.jpg` … `genealogy-100.jpg`
- Portuguese transcript: `/home/braulio/Projects/physics/Motor Edwin Gray.txt`
- Patents: US3890548A (1975 motor), US4595975A (1986 supply), US4661747A (1987 conversion tube)

Local Whisper (`WHISPER_CPP_SERVER=http://127.0.0.1:8080`, large-v3-turbo) transcripts are in `analysis/whisper/`. Cue frames from the 00:30–00:46 segment are in `frames/schematic/cue-*.jpg` (ignitron GL-7171, 3-pole stator, commutator, Zener card, recovery). They confirm this reconstruction. **No engine/circuit model change. No production FEM LUT.**

## Circuit (presenter reconstruction, ~00:34:53–00:35:35)

1. High-voltage supply holds **two** capacitors charged.
2. Commutator event **pulse-charges a four-capacitor bank**.
3. A few degrees later the bank **dumps** into the open-core stator coils.
4. Original trigger: **thyratron → ignitron**. Schloff later: **Zener string 5 kV → 1.5 kV → ignitron**. Do not merge those states.
5. Commutator has **15 contacts**; unused functions are unknown. Do not invent a full contact map.

```
HV supply ──► C_hold×2 ──► ignitron charge path ──► C_bank×4
                                                      │
                                              commutator pulse
                                                      │
                                              dump / quench arc
                                                      ▼
                                         3 simultaneous stator sectors
                                                      │
                                         purple only: outer recovery coils
                                                      │
                                              optional recharge path
```

## Rotor / stator

- Patent-derived schedule: **9 stator pair stations × 3 rotor pair stations = 27 events/rev**, 3 sectors live at once, 40° stator pitch, 120° rotor pitch.
- Colored 1979 family (slides + captions): **three stator poles** visible; purple has outer recovery windings, gold is “same without recovery”, white is plastic, black has one pole set and a viewing opening.
- Recovery coils are large outer windings, ohmically a **three-coil** arrangement (Reggie). No validated turns or coupling.

## Pulse timing and grounding

- Original running claim: cannot start from zero; **starter to ≥ 500 RPM**. Quench is presenter-reported, not universal.
- Schloff AWG 14 rewind: start-from-zero and opposite rotation; **10 kW no-load** is a secondhand modified-state claim.
- Whisper: the system **must stay isolated from ground**; Bedini-attributed claim that this energy dumps to earth if grounded. The classical engine has no earth-return source term.

## Capacitor / inductor network (illustrative engine values)

These are the OpenSimPhy lumped surrogates, not measured parts:

| Machine | V_charge | C | quench | turns | recovery in model |
| --- | --- | --- | --- | --- | --- |
| EMA4 | 1500 V | 2.3 mF | 6° | 180 | yes |
| EMA6 | 3000 V | 1.2 mF | 6° | 160 | yes |
| purple | 5000 V | 83 nF | 3° | 140 | yes |
| gold / white | 5000 V | 83 nF | 3° | 140 | no |
| black | 5000 V | 83 nF | 9° | 140 | no |
| patent-illustrative | 5000 V | 83 nF | 3° | 100 | patent topology |

Energy per dump: `E = 1/2 C V^2` into `L_eq` of paralleled open-core coils. Quench time: `t = θ / ω`, `ω = 2π n / 60`.

## Conversion tube / switch

- 1975 motor: pulsed capacitor discharge.
- 1986/1987 records: inductive-load supply and **conversion switching tube**.
- Presentation: ignitron array; upper ignitrons charge capacitors. Tube characteristics are not in the pack.

## COP claims (source only)

- Presenter: EMA4 Caltech/Crosby **COP 300**.
- Auto caption: **26.8 W in**; output cue was raw `7 12 kilowatts` (ambiguous).
- Local Whisper: **26.8 W in, 7.5 kW out** (arithmetic COP ≈ 279.9). Still a presenter claim, not a model result. Close to the separate COP-282 diagram arithmetic.
- COP 282 remains **absent** as a spoken number in this talk.
- Hackenberger secondhand: **~67%** recovered to the battery.
- Classical whole-system COP in the engine stays **≤ 1**. Claimed 300/282/279.9 are not model outputs.
