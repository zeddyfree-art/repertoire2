/** Synthetic stress fixture only. No text or positions from the user's commercial PGN are committed. */
const sequences = [
  '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6',
  '1. e4 c6 2. d4 d5 3. exd5 cxd5 4. Nf3 Nc6 5. Bd3 Nf6',
  '1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 c5',
];

/** 185 chapters, ~1,850 substantive comments, roughly 0.7-0.9 MB. */
export function largePgnFixture(chapters = 185): string {
  const prose = ('Study the pawn structure, develop without losing tempo, and compare candidate moves. ').repeat(5);
  return Array.from({ length: chapters }, (_, i) => {
    const moves = sequences[i % sequences.length]
      .replace(/(\b(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O(?:-O)?|[a-h][1-8])[!?]*\b)/g, '$1');
    const annotated = moves.replace(/\b(\d+)\./g, '$&')
      .split(/\s+/)
      .map((token) => /^\d+\.$/.test(token) ? token : `${token} {Chapter ${i + 1}. ${prose}}`)
      .join(' ');
    return `[Event "Synthetic stress chapter ${i + 1}"]
[Site "Offline QA"]
[Date "2026.11.19"]
[Round "?"]
[White "Tester"]
[Black "Tester"]
[Result "*"]

${annotated} *
`;
  }).join('\n');
}
