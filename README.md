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
- Every answer plays the English prompt. The central illustration appears only after a correct answer; a wrong answer shows a pronunciation replay button instead.
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
- The WhatsApp button opens a prefilled progress message with overall totals and no topic breakdown for the user to choose a recipient and send. The app does not send messages itself.

The streak animation grows through five levels at 2, 4, 6, 8 and 10 correct answers. It starts with a gentle pulse, then gains speed, glow and sparks, and stays at maximum from 10 onward. All levels retain the same footprint and honor reduced motion.

## Structure

- `src/preload.js`: bounded preload/decode pools for two main illustrations and up to eight answer thumbnails. Current assets have high priority; the next question loads in the background.
- `src/engine.js`: independently tested practice and mastery rules.
- `src/app.js`, `src/style.css`: accessible, responsive RTL interface.
- `src/data.json`: booklet vocabulary, translations, examples, focus terms, stable question IDs.
- `public/thumbnails/`: small answer illustrations for literal vocabulary, shown opposite the label with a slight raised sticker effect; color choices use outlined paint swatches. Grammar and conversation answers retain text to avoid ambiguous illustrations.
- `public/images/`: 171 WebP illustrations exported from the generated booklet art.
- `scripts/`: static build and local HTTP preview, using Node standard modules.
- `.openai/hosting.json`: Sites hosting identity and static output configuration.

## Recorded pronunciation

- Every topic has one stable voice: odd topic IDs use Marin, even IDs use Cedar. All recordings use the same calm, clear American English teaching style.
- Choosing any answer plays the English prompt. After a wrong choice, a replay button replaces the central illustration; pictures appear only on a correct answer (including a correct retry). After two mistakes, the correct meaning is still revealed in the feedback.
- The current and next MP3 are preloaded without autoplay. A new playback stops and rewinds the previous one; leaving the question, opening stats or finishing a pass stops audio. Playback failures stay retryable and never block answering.
- Recordings are generated once into `public/audio/`. The published app is static, needs no API key and makes no OpenAI API requests. `.env.local` and other `.env` files are ignored and never included in the build.
- Regenerate missing recordings locally with `node --env-file=.env.local scripts/generate-audio.mjs`. `--dry-run` lists the plan without using an API key. The catalog records each clip's topic, voice and spoken text; capitalization alternatives and unfinished placeholders are omitted in speech. `scripts/process-audio.mjs` uses a local FFmpeg (`FFMPEG_BIN` or the command on PATH) to remove unwanted extra utterances and leading/trailing silence, retain a short natural padding, and match peak levels.

Source documents, parent letters, and learner progress are not included in this repository. Vocabulary and AI-generated art are included for this learning app.
