# Levels & Cells #

**js-like** levels are two-dimensional grids, full of _Cells_. All cells inherit from `RPG.Cells.BaseCell`. To create a level, one should do this:
```
var size = new RPG.Misc.Coords(3, 2);
var map = new RPG.Dungeon.Map("some name", size, 1);

for (var i=0;i<3;i++) {
  for (var j=0;j<2;j++) {
    var coords = new RPG.Misc.Coords(i, j);
    var cell = RPG.Factories.cells.get(RPG.Cells.Corridor);
    level.setCell(coords, cell);
  } 
}
```

Cells are [flyweights](http://en.wikipedia.org/wiki/Flyweight_pattern) created by the cell factory.


# Items, Beings etc. #

Core roguelike entities, like Items and Beings, are simply created using their respective constructors:
```
var dagger = new RPG.Items.Dagger();
var myOrc = new RPG.Beings.Orc();
```

All items have a common ancestor, `RPG.Items.BaseItem`. Similarly, all beings inherit from `RPG.Beings.BaseBeing`.

These entities are not initially bound to a level. To add them, one has to add it to level's cell:
```
var coords = new RPG.Misc.Coords(2, 1);
level.setBeing(myOrc, coords);
level.addItem(dagger, coords);
```

# Visualization & Textual description #

Many entities in **js-like** can be visualized. The `RPG.Visual.IVisual` defines a standard set of methods for this.

  * `getImage()` returns a file name (with path, without extension),
  * `getChar()` returns ascii character
  * `getColor()` returns ascii color
  * `describe()` - returns a string with description.
  * `describeA()` - returns a string with description, prefixed with indefinite article.
  * `describeThe()` - returns a string with description, prefixed with definite article.

Items have additional description methods:

  * `describeIs()` - returns "is"/"are"

Beings have additional description methods:

  * `describeIs()` - returns "is"/"are"
  * `describeHe()` - returns "he"/"she"/"it"
  * `describeHim()` - returns "him"/"her"/"it"
  * `describeHis()` - returns "his"/"hers"/"its"

# The Engine #

Game flow is coordinated by the `RPG.Engine`. This object acts as a director of all actions and events.

_Engine_ operates according to the following algorithm:

  1. pick a suitable Actor
  1. execute all Effects applied to the Actor
  1. ask the Actor to act
  1. if the action took no time, GOTO 3
  1. if the action took time, GOTO 1
  1. if the action was deferred, pause execution and wait for UI input

Some notes:

  * ATM, "suitable Actor" is chosen from all Beings in the current level.
  * Actor is scheduled by `RPG.Misc.Scheduler`. Scheduling is performed with respect to Actor's speed rating.
  * Actor is notified by calling its `yourTurn()` method.
  * The Engine can be paused and resumed (for example, to do some async animation) via `lock()` and `unlock()` methods.

# Actions #

Everything that dynamically happens is expressed by calling action methods on beings. These return of the three ACTION constants:

  * RPG.ACTION\_TIME
  * RPG.ACTION\_NO\_TIME
  * RPG.ACTION\_DEFER

PC's yourTurn() always returns RPG.ACTION\_DEFER - the Engine needs to be paused and wait for user input.

# Visibility #

PC's area of visibility is determined using a DiscreteShadowcasting algorithm. Every time PC changes position, a set of visible cell is recalculated and the map is updated as necessary.