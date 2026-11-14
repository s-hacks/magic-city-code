# The top 5 problems, by impact

These five lead the Practice list (`web/src/data/community.ts`). Each is a working code challenge: real Birmingham data where it exists, a reference solution, hidden tests and a map replay. The facts come from `reports/Birmingham Alabama city problems.md`.

**How they are ranked:** how many residents the problem touches, how serious the harm is (safety, money, health), and how high residents and local news rank it.

| # | Challenge | Problem | Who it touches | Skill |
|---|---|---|---|---|
| 1 | **Stop the Leaks** | The water utility loses about 53% of its water revenue to leaks and unbilled use, and the 2026 repair budget was cut 54% | Every household that pays a water bill; rates go up 3.4% in January 2027 | Greedy scheduling, simulation |
| 2 | **Grocery Gap** | About 70% of residents live in food deserts, and the West End Save-A-Lot has been empty since 2023 | About 149,000 residents; households without a car are hit hardest | Greedy max coverage, sets |
| 3 | **Open Bed** | About 400 people sleep outside on a given night, and the new micro-shelters are full | People without shelter on freezing nights; this is about staying alive | Sorting, hash maps, rule-following |
| 4 | **Flood Cut-Off** | Railroad underpasses flood, and about a third of 27,000 storm drains need repair | Families in low-lying blocks during storms | Multi-source Dijkstra |
| 5 | **Water Bill Check** | The fall 2026 billing breakdown: 4,000+ calls a day and the same round-number bill every month | Households billed by estimate instead of a meter read | Arrays, streaks |

Below the top five: Route to Fresh Food, Stray-Dog Van Route (stray dogs are the #1 complaint to 311), Feed the Block, and the four coverage missions.

## What judges see in each demo

| Challenge | Starter code (fails) | Working solution (passes) |
|---|---|---|
| Stop the Leaks | Crews take leaks in report order. The counter shows 72% more water lost than the best plan. | Crews race to the leaks with the most gallons per hour of work. Leaks turn green and the counter stops near the best plan. |
| Grocery Gap | The first site on the list. | One-mile rings spread out and red towers of families without a car turn gold. Sample case 2 reaches 1,885 households, 99% of the best possible. |
| Open Bed | Everyone goes on the waitlist. | Lines from each person to a shelter, drawn in priority order, while each shelter's open-bed count goes down. |
| Flood Cut-Off | Only the shelters have a time. | A wave spreads out from every shelter at once across 10,502 real corners, colored green to red by walk time. In the storm test, cut-off corners pulse red. |
| Water Bill Check | Nothing is flagged. | 167 of 1,802 accounts citywide light up on the map. |

## The "obvious answer is wrong" moment

Each challenge has a natural first idea that passes some tests and fails others, which is good material for the pitch and for the coach. The numbers below were measured by `web/scripts/prep_*.py` and checked by the Pyodide tests.

| Challenge | Natural first idea | What happens | Fix |
|---|---|---|---|
| Stop the Leaks | Biggest leak first | Loses 3–6% more water than the best plan; fails 2 tests | Gallons per hour of work (drive + repair) |
| Grocery Gap | The k sites that look best on their own | Reaches 41–55% of the best possible: the stores overlap | Pick one site at a time; don't count a family twice |
| Flood Cut-Off | Search from one shelter, or count street hops (BFS) | Walk times are too long | Start Dijkstra with every shelter in the heap |
| Stray-Dog Van | Nearest report next | Passes the samples, then fails a hidden busy day (+5.8%) | Add 2-opt: uncross the route |
| Open Bed | Serve people in list order | Wrong person gets the bed | Sort by priority, then arrival |

## What is real and what is sample

- **Real:** the streets (OpenStreetMap), block groups and households without a car (Census ACS), grocery stores, libraries, churches, community centers and schools (OpenStreetMap), the railroad underpasses, and the empty Save-A-Lot.
- **Made up, and labeled that way in each challenge:** the leaks, water bills, stray-dog reports, and shelter guests and bed counts.

Schools stand in as storm shelters in Flood Cut-Off.
