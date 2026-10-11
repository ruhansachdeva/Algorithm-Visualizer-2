# Algorithm Visualizer

A browser-based visualizer for 75 classic algorithms — sorting, searching,
pathfinding, graphs, trees, dynamic programming, string matching, backtracking
and maze generation.

The successor to my terminal version, which had four algorithms and printed
arrows under numbers.

## Running it

There is no build step, no `npm install`, no toolchain — but it does need to
be served over `http://`, not opened as a file.

**Double-click `start.command`.** It starts a local server and opens your
browser. Leave the Terminal window it opens alone while you use the app; close
it when you're done.

Or do the same thing by hand:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

In VS Code, the **Live Server** extension works too: right-click `index.html`
→ *Open with Live Server*.

> **Why not just double-click `index.html`?**
> The page would load but nothing would happen. The code is split across
> JavaScript modules, and browsers refuse to load modules from a `file://`
> path — a security rule called CORS. Serving the folder over `localhost`
> satisfies it. Nothing is uploaded anywhere; the server only talks to your
> own machine.

## Controls

| Key | Does |
| --- | --- |
| `space` | play / pause |
| `→` `←` | one step forward / back |
| `shift` + `→` `←` | jump 25 steps |
| `r` | back to the start |
| `n` | regenerate the input and re-run |
| `Home` / `End` | first / last step |

You can also drag the scrubber to any point, and the URL carries your place —
`#quick@120` opens Quick Sort paused at step 120, so a specific moment is
linkable.

## Race mode

The **race** dropdown next to the speed slider runs a second algorithm beside
the first, on exactly the same input, stepped together. When one finishes it
freezes and says so while the other carries on — which is the whole point.

Races are linkable too: `#grid-bfs+grid-astar` opens BFS against A\*.

Worth racing:

| | |
| --- | --- |
| `#grid-bfs+grid-astar` | same shortest path; A\* visits a third of the cells |
| `#grid-dijkstra+grid-greedy` | greedy finishes sooner and takes a worse route |
| `#bst-insert+avl-insert` | set shape to "already sorted" and watch one collapse |
| `#avl-insert+rb-insert` | AVL ends shorter, red-black rotates less |
| `#timsort+merge` | on sorted input Timsort stops almost immediately |
| `#str-naive+str-kmp` | count the comparisons each one spends |

Only algorithms that take the same kind of input can race, so the dropdown
only ever offers sensible opponents.

On the pathfinding board you can **drag to draw walls** and **drag S or G** to
move the start and goal.

## What's in it

| Category | Count | |
| --- | --- | --- |
| Sorting | 20 | bubble, cocktail, selection, insertion, binary insertion, shell, comb, gnome, odd-even, merge, **Timsort**, quick, quick 3-way, heap, counting, radix, bucket, cycle, pancake, bogo |
| Searching | 7 | linear, binary, jump, exponential, interpolation, ternary, Fibonacci |
| Pathfinding | 6 | BFS, DFS, Dijkstra, A*, greedy best-first, bidirectional BFS |
| Graphs | 11 | BFS, DFS, Dijkstra, Bellman-Ford, **Floyd-Warshall**, topological sort, union-find, Kruskal, Prim, cycle detection, **Tarjan's SCC** |
| Trees | 13 | BST insert/search/delete, in/pre/post/level-order traversal, AVL insert, red-black insert, binary heap, trie insert/search, **Huffman coding** |
| Dynamic programming | 8 | Fibonacci, LIS, coin change, subset sum, knapsack, LCS, edit distance, **matrix chain order** |
| String matching | 4 | naive, KMP, Boyer-Moore, Rabin-Karp |
| Backtracking | 3 | N-Queens, Sudoku, Towers of Hanoi |
| Maze generation | 3 | recursive backtracker, randomized Prim, recursive division |

### Some things worth trying

- Set the array shape to **already sorted**, then run **BST Insert** and
  **AVL Insert** back to back. The plain BST collapses into a list of height 15;
  the AVL rotates its way to height 4.
- Run **A\*** and then **BFS** on an empty board. Same shortest path, but A\*
  visits a fraction of the cells.
- Switch on **terrain** and compare **Dijkstra** with **greedy best-first**.
  Greedy is faster and takes a worse route.
- Run a maze generator, then switch to **A\*** — it solves the maze you just
  watched being carved.
- Coin change with coins **1, 3, 4** making **6**. Greedy grabs the 4 and needs
  three coins; the table finds 3+3.
- Run all four string matchers on the same text and compare the comparison
  counts in the live counters.
- Set the array shape to **already sorted** and run **Timsort**: it finds one
  natural run and stops in 99 comparisons where merge sort grinds through 356.
  That is the whole reason Python and Java use it.
- **Trie Search** for `CAR` when `CARD` and `CARE` are stored — it lands on a
  node with no ✓, which is exactly what autocomplete is.
- **Matrix Chain Order** — watch it fill *diagonally* instead of row by row,
  because a long chain can only be solved once the shorter ones inside it are.
  The textbook chain costs 15,125 multiplications in the best order and 40,500
  left to right.
- **Huffman Coding** on `ABRACADABRA`: 23 bits instead of 88. Then try the
  "all equal" preset — when every character is equally common there is nothing
  to exploit and it barely compresses at all.
- Run **AVL Insert** and **Red-Black Insert** on the same sorted input and read
  the counters. On 31 sorted values AVL ends up height 5 and red-black height 8,
  but over 40 inserts red-black does fewer rotations. AVL searches faster,
  red-black writes faster — that trade is why both exist.

## How it works

Every algorithm is a **generator**. It runs the real algorithm, and each `yield`
hands back a snapshot of what it is doing at that moment:

```js
*run({ array }) {
  const arr = array.slice();
  for (let j = 0; j < arr.length - 1; j++) {
    yield snap(arr, st, { compare: [j, j + 1], note: `is ${arr[j]} > ${arr[j+1]}?` });
    if (arr[j] > arr[j + 1]) swapIn(arr, j, j + 1, st);
  }
}
```

Those snapshots ("frames") are recorded into an array up front, and the player
replays them like a video. That is why stepping *backwards* and scrubbing are
instant — frame `n-1` is just sitting there, no re-running required.

The payoff is that the algorithm code stays close to how you would normally
write it. Read any `run` function and ignore the `yield` lines, and you are
reading an ordinary implementation.

### Layout

```
start.command           double-click to run it
index.html              page shell
css/style.css           all styling; colors are CSS variables at the top
js/
  main.js               wires everything together
  registry.js           the catalogue — which algorithms exist, in which category
  inputs.js             the controls under the stage, per input type
  engine/player.js      records frames, then plays / pauses / steps / scrubs
  views/                one renderer per kind of picture
    draw.js               shared canvas helpers
    array-view.js         bar chart        (sorting, searching)
    grid-view.js          2D board         (pathfinding, mazes)
    graph-view.js         nodes and edges  (graph algorithms)
    tree-view.js          rooted trees     (BST, AVL, heap)
    table-view.js         DP tables
    string-view.js        text and pattern
    puzzle-view.js        N-Queens, Sudoku, Hanoi
  algorithms/           the algorithms themselves, grouped by category
```

## Adding an algorithm

1. Write a generator in the right file under `js/algorithms/`:

```js
const myThing = {
  id: 'my-thing',                 // unique; also the URL hash
  name: 'My Thing',
  view: 'array',                  // which renderer to use
  input: 'array',                 // which controls to show
  about: 'One paragraph on what it does and why it is interesting.',
  cost: { best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: 'Yes' },
  pseudocode: ['step one', 'step two'],
  *run({ array }) {
    // yield a frame whenever something worth seeing happens.
    // `line: 1` highlights pseudocode line 1 while this frame shows.
  },
};
```

2. Add it to that file's exported list (e.g. `export const SORTING = [...]`).

That's it — the sidebar, legend and info panel all build themselves from the
definition. The legend is derived from which highlight keys your frames actually
use, so it can never advertise a color you don't use.

A new **category** also needs one line in `js/registry.js`. A new **view** needs
a `draw(canvas, frame)` function registered in the `VIEWS` map there.

### Frame budgets

Frames are held in memory, so each run is capped (60,000 steps by default). An
algorithm that legitimately needs more says so with `maxFrames` — the hard
Sudoku takes about 213,000 steps, but its frames are 81 bytes each.
