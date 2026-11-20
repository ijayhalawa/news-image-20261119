# The World in One Image — 19 November 2026

[![make.fun · news-image-20261119](https://make.fun/badge/news-image-20261119.svg)](https://make.fun/bounty/news-image-20261119?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261119)
[![rank](https://make.fun/badge/news-image-20261119/ijayhalawa/news-image-20261119/rank.svg)](https://make.fun/bounty/news-image-20261119/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261119)
[![reward](https://make.fun/badge/news-image-20261119/ijayhalawa/news-image-20261119/reward.svg)](https://make.fun/bounty/news-image-20261119?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261119)

Entry for make.fun bounty `news-image-20261119`: sum up the world's news of
Thursday 19 November 2026 in one image.

## What the image shows

A 1024x1024 newspaper front page, drawn entirely by `main.ts`:

- **Masthead** — "THE WORLD IN ONE IMAGE", Thursday, 19 November 2026.
- **Lead story** — The International Court of Justice ruled Myanmar committed
  genocide against the Rohingya (9-6 vote), the first such verdict against a
  state.
- **Shenzhen summit** — Trump, Xi and Putin held the first three-way summit
  and issued a peace declaration that did not mention Ukraine or Iran.
- **Markets** — S&P 500 fell 2.0% (fifth straight loss), Nikkei dropped 4.7%;
  Anthropic's record IPO ($83 a share, $81.3bn raised) failed to calm nerves.
- **Four more stories** — Ukraine hit the Crimean Bridge a third time;
  Israeli tanks pushed into central Gaza beyond the Yellow Line; Denmark
  ratified the US Greenland security deal 109-0; the IAEA says North Korea
  expanded uranium enrichment at Yongbyon.
- **Also today** — US Senate rejects the Iran war-powers measure 51-48; EU
  proposes a EUR 45bn loan for Ukraine; APEC adopts the Shenzhen Outlook.

News facts as reported on 19 November 2026 by UN News, AP, Reuters and
Dow Jones.

## How to run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png` (1024x1024 PNG, under 1 MiB).

## How it works

- `main.ts` uses only the Node standard library (`node:fs`, `node:path`,
  `node:zlib`).
- It renders the page into an RGB buffer with a hand-written 5x7 bitmap font,
  then encodes the PNG itself (IHDR/IDAT/IEND, CRC32, zlib deflate).
- No network calls, no external assets — every pixel comes from the code.
- Deterministic: two runs produce byte-identical output.
