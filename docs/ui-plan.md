# Magic City Code — UI plan for the city environment

Companion to [implementation-plan.md](implementation-plan.md). This covers how the 3D city looks, moves and responds to code.

## 1. The big idea: light up the Magic City

Birmingham's nickname is the Magic City, and it was built on iron and steel. The environment uses both.

- The city is shown **at night**. Buildings are dark steel-blue blocks.
- **Every resident is a small point of light.** A resident who cannot reach what they need glows dim ember-red. A resident who can glows bright gold.
- **Good code lights up the city.** When a student's code helps a neighborhood, that neighborhood turns from embers to gold.
- **The score is how much of the city is lit.**

A student never has to read a chart to know whether their code worked. They see their neighborhood light up.

## 2. The mission screen

The map fills the whole screen. Panels float over it like glass, so the city is always visible behind the code.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ✦ Magic City Code                                   West End · Level 2/3 │
│                                                                          │
│ ┌─ Mission ──────────┐                          ┌─ Your code ──────────┐ │
│ │ Feed the Block     │                          │ 1 places = city.sit… │ │
│ │ "No grocery store  │      3D CITY AT NIGHT    │ 2 for p in places[:5]│ │
│ │  near West End."   │                          │ 3   city.place_hub(p)│ │
│ │  — a neighbor      │    ·  · ·   ║  ·  ·      │                      │ │
│ │                    │   · ·  ·  ╱ ║ ╲  · ·     │                      │ │
│ │ Goal: light up 80% │    ·   · (  hub  ) ·     │ [ ▶ Run ]  [Compare] │ │
│ │ ▁▃▅▇█▇▅▃▁ 62%      │     · ·  ╲___╱  · ·      ├──────────────────────┤ │
│ │ 1,240 families lit │                          │ Output               │ │
│ │                    │                          │ Placed 5 hubs        │ │
│ │ Hint · Ask Sparks  │                          │ ✦ Sparks: "Nice! …"  │ │
│ └────────────────────┘                          └──────────────────────┘ │
│                    ● far from food   ● within a 10-minute walk           │
└──────────────────────────────────────────────────────────────────────────┘
```

| Part | What it shows |
|---|---|
| **Mission panel** (left) | The resident's words, the goal, the city-light meter, hints. |
| **Code panel** (right) | Editor, a large Run button, the Compare button, output, and the coach. |
| **Map** (everywhere) | The neighborhood in 3D with residents, stores, possible hub sites and placed hubs. |
| **Legend** (bottom) | What the two light colors mean, in words. |

## 3. What is on the map

| Thing | How it looks | How it behaves |
|---|---|---|
| **Residents** | About 3,000 small glowing dots, placed where people actually live | Ember-red and dim when far from food. Gold, brighter and slightly larger when within reach. |
| **Existing stores** | Steady blue-white beacons | Always on. They explain why some areas are already gold. |
| **Possible hub sites** | Small outlined markers with an icon: church, school, library, rec center | Brighten on hover and show the name and "families nearby." |
| **Placed hubs** | A tall beam of gold light with the site's name | Drops from the sky when the code places it. |
| **Reach ring** | A thin circle around each hub | Ripples outward to the 10-minute walk distance. |
| **Need haze** | A faint red glow on the ground where many families have no car and no store | Fades as the area is covered. |

## 4. What happens when you press Run

This is the most important three seconds of the app. Each line of code visibly causes something in the city.

| Time | In the code panel | On the map |
|---|---|---|
| 0.0 s | The Run button pulses. | The camera eases slightly toward the neighborhood. |
| 0.2 s onward | The line that placed the first hub lights up. | A beam drops at that site. A ring ripples out. |
| Every 0.3 s | The highlight moves to the line that placed the next hub. | The next beam drops. |
| After the last hub | The highlight clears. | Residents inside the rings turn from red to gold and drift toward their hub. |
| About 2.5 s | The output prints a one-line summary. | The meter fills and the family count ticks up. |
| If the goal is met | The next level unlocks. | A wave of gold sweeps the neighborhood and the torch turns green. |

If the code has an error, the map does not change. The bad line gets a red underline and the coach explains it in plain words.

## 5. The city-light meter

- A small skyline whose buildings fill with light from left to right as coverage rises.
- A large number next to it: "62% lit · 1,240 families."
- A torch at the end that turns green when the goal is reached. This is a nod to the Vulcan statue's torch, which Birmingham residents will recognize.
- The number is always shown with the meter, so the result never depends on color.

## 6. Before and after

- **Hold to compare** (Must): hold the Compare button or the B key to see the city as it is today. Release to see it with the student's code. The meter shows both numbers: "38% → 62%."
- **Swipe curtain** (next step): a divider dragged across the map, today on the left and the student's version on the right.

## 7. The map helps you write code

- **Click a site on the map and its name is inserted into the code.** The map works as the autocomplete.
- **Hover a site** to see its numbers. These are the same numbers the code can read (`families_nearby`, `families_without_car`), which teaches that code and map show the same data.

## 8. The home screen

- The app opens high above Birmingham at night and glides down toward the city.
- **Each resident problem is a flare:** a pulsing marker rising over its neighborhood, with a short label ("No grocery store" over West End).
- Hovering a flare shows the problem card. Clicking it flies the camera into that neighborhood and opens the mission.
- **Reporting a problem launches a new flare.** When a judge names a problem in the demo, a flare shoots up over the right neighborhood and the mission card appears.

## 9. Sparks, the coach

- A small spark character, in keeping with the city's forge history. It sits at the bottom of the code panel.
- It speaks in one short bubble at a time and never writes the answer.
- In the 8-hour build Sparks is a single icon with a speech bubble. Expressions and animation are next steps.

## 10. Look and feel

Palette concept: graphite neutrals plus **one** bold accent, molten iron. Anything that is lit (reached residents, hubs, the meter, Run) is molten. Everything else stays ash-gray. Tokens live in `web/src/theme.ts` and drive both the CSS and the map style.

| Token | Night | Used for |
|---|---|---|
| bg / land | `#09090B` / `#0C0C0F` | Page and map ground |
| surface / raised | `#141418` / `#1D1D23` | Panels, unlit meter bars |
| ash | `#5C5C66` | Residents far from food, quiet UI |
| muted | `#9A9AA5` | Secondary text |
| text | `#EDEDF0` | Text, existing stores, shelters |
| **accent (molten)** | `#FF5A1F` | Residents in reach, hubs, rings, meter, Run, errors (always with an icon and words) |
| horizon | `#3D1406` | Furnace glow on the map horizon |

The day theme (`D` key) keeps the same accent on light neutrals.

- **Type:** a clean geometric font for the interface (Space Grotesk) and a clear monospace for code (JetBrains Mono).
- **Sizes for a projector:** body text 18 px, code 20 px, the score 40 px.
- **Panels:** dark, slightly see-through, with soft rounded corners and a thin light border.
- **Motion:** slow and smooth. Nothing flashes. Every animation is under three seconds.
- **Words:** short and friendly. "Light up 80% of West End," not "Achieve 0.8 coverage."

## 11. Demo mode

Judges only see the team's laptop, so the UI includes presenter aids.

| Key | What it does |
|---|---|
| `1` `2` `3` | Types the prepared solution for that level into the editor, so a typo cannot break the demo. |
| `R` | Run. |
| `B` (hold) | Compare before and after. |
| `D` | Switches to a brighter "day" map if the projector washes out the night colors. |
| `H` | Returns to the home fly-in. |

Test the night colors on a projector or TV early. Dark maps often lose contrast on projectors.

## 12. What gets built in 8 hours

| Tier | UI pieces |
|---|---|
| **Must** | Night map with 3D buildings; resident lights that change from ember to gold; hub beams and reach rings; city-light meter with the number; floating mission and code panels; hold-to-compare; fly-in on home and on mission open; problem flares; demo keys |
| **Should** | Line-by-line highlight in step with the map; residents drifting toward their hub; click-a-site-to-insert; the Sparks bubble |
| **Next steps** | Swipe curtain; Sparks expressions; sound; buildings that tint gold; slow idle camera orbit; a light theme for the printable proposal |

## 13. How this serves the judging criteria

| Criterion | What the UI contributes |
|---|---|
| Creativity & Originality | The "light up the city" idea and the local torch detail are specific to Birmingham. |
| User Experience & Design | One screen, one large Run button, and a result anyone can read without a chart. |
| Technical Implementation | Thousands of animated lights tied directly to the student's code. |
| Reasoning & Explanation | Each design choice has a stated purpose here that the team can repeat in the pitch. |
