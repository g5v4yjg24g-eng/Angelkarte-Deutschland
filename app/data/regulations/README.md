# Landesrecht (M7)

Eine Datei je Bundesland: `<KÜRZEL>.json` (z. B. `NW.json`), Schema `RegulationSetSchema` in
`src/domain/regulations.ts` (DATA_MODEL §7). Regeln für die Pflege: DATA_SOURCES §5.3.

- Inhalte **nur** aus dem amtlichen Text übernehmen; jede Regel mit `basisId` (Eintrag in `legalBasis`) und
  `basisRef` (Paragraf, Absatz, Anlage).
- `status`: `verified` (vollständig gegen den amtlichen Text geprüft), `partial` (mit `missing`), `draft`
  (wird in der App nie angezeigt).
- Prüfung: `pnpm validate:data` (läuft auch in `pnpm test` und damit in CI).
