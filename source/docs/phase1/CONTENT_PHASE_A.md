# Phase A: text & quest design (2026-11-14)

Data only. No `src/`, images or rendering touched. Format: `CONTENT_SCHEMA.md`. Check: `node scripts/validate-content.mjs`.

## What is new

| area | content |
|---|---|
| 分工 | Every village: one a akey (漁獵、飛魚季、拼板舟) and one a akes (水芋、食物、紡織) quest, `giver` m / f. NPC `role` / `duties` / `dutyText` in `npcs/cast.json`. |
| Recipe keepers | The six a akes are the keepers (FD1–FD6, unchanged flow: talk → collect → learn). Keeper dialogue blocks (invite / missing / teach / after) in `dialogue/elders-akes.json`. |
| Party split | **MS1** 3-way main-story split before the sea trip (族男 → 東清長輩, 族女 → 朗島 a akes, 旅人 → 文化工作者; regroup at the host home; M3 now also requires MS1). **A1** leave-and-return (族男 away with the boat crew, others bring lunch from the a akes to the trailhead, he rejoins). **IT-M1** second male-only sea trip from 漁人 (solo, `giveUp` lines, `abortTo`). Existing Q07 / J1 / M3 kept. |
| Day / night | Every quest, photo spot and gather node has `time`. Night: NT1 story (黑翅飛魚), NT2 night tide pool (observe), NT3 Lanyu scops owl (photo, no flash), NT4 漁人 village evening gathering, NT5 winter-night talk, IM-V2 東清 villager's story, P28 / P29 night photos, night gather node (shellfish with headlamp) and observe nodes (land crab, hermit crab, owl). |
| Seasons | `seasons: ['summer']` (飛魚季) or `['winter']` (東北季風); P30 winter waves photo. Legacy `when.season` fishing → summer, nonFishing → winter. |
| Outfits | OF1 族男 (first sea trip + 尋根 about his grandfather) and OF2 族女 (weaving + 尋根 about her grandmother) unlock a traditional outfit. OF3: after the 漁人 gathering invite (IT-V2), 族女 makes the traveller a 織草帽 and 織草小袋 (undyed, no stripes). Validator blocks any traditional outfit for the traveller. |
| 東清 / 漁人 villagers | IM-V1 (tourists and trash at the bay), IM-V2 (why he came home), IT-V1 (grandma back from a Taiwan hospital, clinic hand-off), IT-V2 (gathering invite). |
| Items | 23 entries: 11 legacy (+ codex, icon / illustration keys, sources), 6 crafts / materials, 2 traveller accessories, 4 observe-only 圖鑑 entries. |

New place ids (first-guess coords in `places.json` → `proposed`): `iranmeylek_beach`, `iratay_shore` (must allow boarding the tatala), `iratay_school`, `wakay_iratay`, `owl_road`; derived `host_tagakal` (unused yet).

## Notes for the code refactor

- New step / quest fields: `solo.giveUp`, `gives.outfits`, `labourNote`, quest `time` / `seasons` / `periods` / `tide` (instead of `when`), `review`.
- Night NPCs: the night quests talk to `@host`, `villager_iranmeylek`, `elder_f_iratay`; their night schedules must keep them reachable at home.
- Gather nodes with `requires` (`wakay_field_ok`, headlamp) should show a hint instead of the gather prompt when unmet.
- Dialogue `idle` picks the first block whose `when` matches; `{need}` in keeper `missing` lines is replaced with the missing ingredients.

## Open questions for Larry

1. M3 (first sea trip): Phase B made MS1 optional (M3 needs M1 + M2 only). Confirm?
2. Traditional outfits: Phase B lets them be worn anywhere once unlocked. Confirm, or limit to villages / events?
3. A1 is set in winter; IR-F1 millet weeding is set in summer. Fine as first guesses?
4. The scops owl night spot (NT3): keep it, given owls may be a sensitive subject for Tao elders?
5. 漁人 evening gathering (NT4) is a modern community event, not a ceremony. OK?

## For the Tao cultural consultant (`node scripts/validate-content.mjs --review`)

- The traditional outfits: who makes them, when people wear them, which patterns can be shown. No silver helmets, gold plates or other ceremonial items.
- Whether the traveller accessories (織草帽 and 織草小袋: undyed woven fibre, no stripes) are acceptable.
- The public version of the black-wing flying fish legend (NT1).
- How flying-fish trips work and how the catch is shared, and how much of that can be shown (IT-M1, IV-M1, MS1).
- How far women keep from the plank boats (IR-M1, A1), whether a woman can take lunch to the trailhead, and the taboos around picking boat-building wood (A1).
- Whether mending nets is men-only (YY-M1).
- Millet: when it is grown in 朗島, any rituals tied to it, and its Tao name (IR-F1).
- The rule against weaving during the flying-fish season (IO-F1).
- What "hunting" means here: goats, ear marks and the mountain (IO-M1).
- Gathering rules at the 東清 tide flats, by day and at night (IM-F1, gn_shellfish_im_night).
- How Tao people see owls (NT3).
- All seven recipes, plus Tao names still marked tentative (wakay, ovi) or missing (shellfish, seaweed, millet).

(Phase B, 2026-11-14: the defaults now in the game are listed in `ARCHITECTURE.md` → "Defaults for Larry's open questions". Questions 1–5 are still open.)
