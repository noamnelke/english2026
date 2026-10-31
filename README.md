# מסע המילים · English 2026

A Hebrew-guided English vocabulary practice app for grade 4. Includes all **223 cards in 21 topics**, **171 original AI-generated illustrations**, and the highlighted example sentences from the accompanying illustrated booklet.

## Run locally

Requires Node.js 22 or later. No dependency installation is needed.

```sh
npm run build
npm run dev
```

Open http://127.0.0.1:4173. Rebuild after source edits. Deploy `dist/` to any static web host; all asset URLs are relative, so subdirectory hosting works too.

```sh
npm test
```

## Practice rules

- Pick a topic. Translate the English word/phrase into Hebrew using four answer choices.
- The illustration is absent until the first answer is selected. It appears after either a right or wrong answer.
- A first mistake gives a second attempt; two mistakes reveal the correct answer.
- Each correct answer earns one star, including a second-attempt answer. Revealed answers earn none.
- Any mistake marks that question for cleanup. It needs **three first-attempt correct answers** on separate presentations. A new mistake resets that question's count to zero. A correct second attempt earns a star but no cleanup credit.
- After the learning round, a summary leads into cleanup. There is exactly one cleanup pass: each pending question appears once, even if it remains uncleared. After cleanup (or a perfect learning round), choose the next topic or return to the topic list. Pending errors and cleanup credit persist for later visits. The last topic offers a return to the list.
- Reentering a topic with errors gives **only those errors**. Once cleared, any unseen words are offered on the next entry. Already-correct words stay learned.
- The home screen marks pending cleanup with a circular arrow and fully completed topics with a check. A completed topic can be replayed.
- Progress and stars are stored in `localStorage` in the current browser and device. There is no sign-in, server, analytics, or cross-device synchronization. Clearing site data also clears progress.

## Streaks and star details

- Every correct answer advances a persistent success streak, including a second-attempt success. Any wrong selection resets it immediately. From two successes the practice toolbar shows a looping flame-and-spark badge; reduced-motion preferences are respected.
- The star counter opens a details screen without losing the current question. New awards are tracked per topic and split into learning/review × first/second attempt. Review totals are a subset of first/second totals, not extra stars.
- Existing version-1 progress is migrated without losing stars or cleanup credit. Old stars remain an unclassified previous total because their historical category/attempt data was never stored.
- The WhatsApp button opens a prefilled progress message for the user to choose a recipient and send. The app does not send messages itself.

## Structure

- `src/preload.js`: bounded preload/decode pools for two main illustrations and up to eight answer thumbnails. Current assets have high priority; the next question loads in the background.
- `src/engine.js`: independently tested practice and mastery rules.
- `src/app.js`, `src/style.css`: accessible, responsive RTL interface.
- `src/data.json`: booklet vocabulary, translations, examples, focus terms, stable question IDs.
- `public/thumbnails/`: small answer illustrations for literal vocabulary, shown opposite the label with a slight raised sticker effect; color choices use outlined paint swatches. Grammar and conversation answers retain text to avoid ambiguous illustrations.
- `public/images/`: 171 WebP illustrations exported from the generated booklet art.
- `scripts/`: static build and local HTTP preview, using Node standard modules.
- `.openai/hosting.json`: Sites hosting identity and static output configuration.

Source documents, parent letters, and learner progress are not included in this repository. Vocabulary and AI-generated art are included for this learning app.
