# Magic City Code — showcase examples for judges

Five concrete missions that show real impact. Each one starts from a problem found in the Birmingham research ([report](../reports/Birmingham%20Alabama%20city%20problems.md)), runs on the one engine planned for the 8-hour build, and ends in a result a partner could act on.

## The rule for numbers

**Every result number shown to judges must come from the app, computed from real Census and map data.** The blanks below (`__`) are filled in after the data is loaded. Do not put estimated results on a slide. The background facts quoted here come from the research notes; check each one before it goes on a slide.

## The five examples

| # | Mission | Partner it serves | What the student places | Who is counted |
|---|---|---|---|---|
| 1 | Feed the Block | Jones Valley Teaching Farm, Shipt | Grocery pickup hubs | Households with no car |
| 2 | Homework Hotspots | Ed Farm | Free Wi-Fi study spots | Households with children and no home internet |
| 3 | Warm Nights | Firehouse Ministries | Warming stations | Seniors and households in poverty |
| 4 | Saturday Shuttle | Riders who lost Saturday buses | Shuttle stops | Households with no car |
| 5 | Farm Stand Route | Jones Valley Teaching Farm | Weekly mobile market stops | Households far from a store |

Example 1 is built by hand. Examples 2–5 are produced by the AI mission generator and tested before the demo, so they double as the "three tested problems kept ready" from the risk list.

### 1. Feed the Block (West End)

- **The real problem:** the West End Save-A-Lot has been closed since September 2023. The city has put incentives into that one site since 2007 and approved $600K for a new store there in January 2025.
- **A resident's words:** "There's no grocery store near West End, and I don't have a car."
- **What the student codes:** a loop that places five pickup hubs at churches, schools and libraries, then a sort that picks the sites near the most families without cars.
- **What judges see:** West End turns from red to gold. "Households with no car within a 10-minute walk of food: `183 households (10.1%)` → `977 households (53.9%)`."
- **Who could act on it:** Shipt could pilot pooled grocery drop-offs at the top two hubs. Jones Valley Teaching Farm could use the same sites for produce pickup.

### 2. Homework Hotspots (Ensley)

- **The real problem:** Ed Farm's mission is closing the digital skills gap. A student with no internet at home cannot practice.
- **A resident's words:** "My kids can't do their homework online at home."
- **What the student codes:** the same pattern as mission 1, counting households with children and no internet subscription.
- **What judges see:** "Households with no home internet within a 10-minute walk of free Wi-Fi: `0 households (0%)` → `393 households (45.3%)`."
- **Who could act on it:** Ed Farm could use the ranked list to choose where to run after-school sessions or place hotspots.

### 3. Warm Nights (Southside / downtown)

- **The real problem:** about 400 people sleep outside on a given night, and the city's 15 micro-shelters are full.
- **A resident's words:** "On cold nights, where can people near me go to get warm?"
- **What the student codes:** placing warming stations at libraries, rec centers and churches to reach the most seniors and households in poverty.
- **What judges see:** "Low-income households within a 10-minute walk of a warming station: `0 households (0%)` → `1,454 households (31.6%)`."
- **Who could act on it:** Firehouse Ministries and the city could compare the list with the sites they open on cold nights.
- **Honest limit:** there is no public data on where unsheltered people are. The mission counts seniors and low-income households instead, and says so on screen.

### 4. Saturday Shuttle (East Lake)

- **The real problem:** MAX ended Saturday bus service in January 2026.
- **A resident's words:** "With no Saturday bus, I can't get to the store on my day off."
- **What the student codes:** choosing five shuttle stops that reach the most households without cars.
- **What judges see:** "Car-free households within a 10-minute walk of a Saturday stop: `201 households (27.3%)` → `477 households (64.9%)`."
- **Who could act on it:** the transit agency's on-demand service, or a church van program, could use the stops as pickup points.

### 5. Farm Stand Route (Woodlawn)

- **The real problem:** UAB's mobile market has served over 17,000 people since 2021, and East Lake's Village Market grocery has been at risk. A truck can only make a few stops.
- **A resident's words:** "The produce truck never comes to our side of the neighborhood."
- **What the student codes:** picking the four weekly stops that reach the most households far from a store.
- **What judges see:** "Households within a 10-minute walk of fresh produce once a week: `135 households (19.6%)` → `395 households (57.2%)`."
- **Who could act on it:** Jones Valley Teaching Farm could test the top stop with a farm stand.

## The single strongest comparison

For mission 1, have the app compute two plans side by side:

| Plan | Families with no car within a 10-minute walk of food |
|---|---|
| One new store at the old Save-A-Lot site | `201 households (11.1%)` |
| Five pickup hubs chosen by a student's code | `977 households (53.9%)` |

If the five hubs reach more families, this is the headline of the demo: a middle-schooler's ten lines of code, on real data, produced a plan worth comparing with a $600K decision. If the numbers do not support it, drop the comparison and do not show it.

## Three kinds of impact to claim

| For | The claim | The evidence on screen |
|---|---|---|
| **Students** | They learn loops, conditions and sorting on a problem from their own neighborhood. | Three levels completed, each naming the coding idea it teaches. |
| **Residents** | A problem they reported gets worked on and answered. | The resident's words on the mission card and on the proposal page. |
| **Partners and the city** | They get a ranked, data-backed list of sites to consider. | Before and after numbers and the proposal one-pager. |

## What not to claim

- Not "kids solved food deserts." Say "kids produced a real proposal."
- Not exact walking times. They are straight-line estimates and labeled as such.
- Not that any partner has agreed to use it. Say what a partner could do with the result.
- Not that the counts are people when they are households. Use the unit the data uses.

## To prepare before the demo

- [ ] Load the data and fill in every `__` above from the app.
- [ ] Run the one-store-versus-five-hubs comparison and decide whether to show it.
- [ ] Type each of the five resident sentences into the generator and confirm a playable mission comes back.
- [ ] Pick the two examples with the clearest before-and-after for the live demo. Keep the others as backups.
- [ ] Check each background fact (dates, dollar amounts, counts) against its source.
