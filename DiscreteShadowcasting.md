# Discrete shadowcasting #

This algorithm computes a set of coordinates, visible from a given point. The area is bounded by a maximum sight distance. Discrete shadowcasting operates in O(N^2), where N is the maximum sight distance.

## Definitions ##

_PC_ is a Player Character. He stands on a fixed cell and has a _maximum sight distance_ called **R**. Nothing farther than R can be seen.

A _ring_ is a set of all cells with a given distance to PC. For a distance **r**, a ring consists of _8r_ cells.

PC's complete view is described using a _shadow array_; a list of angle pairs describing occluded areas. A _shadow array_ is initially empty; during the computation, it gets filled by values, as the visibility decreases with larger diameter.

## How it works ##

Discrete shadowcasting algorithm walks through all rings, 1 <= r <= R. Every cell corresponds to a certain arc (for a cell in ring **r**, the arc size is **360/8r** degrees); this arc is defined by two integers (firs value rounded down, second value rounded up). For every cell visited, two computations are performed:

  1. whether the cell is visible. This is done by taking the two integers defining cell's arc and comparing them with the _shadow array_.
  1. if the cell blocks view (i.e. is a solid wall), its arc is merged into the _shadow array_.

## Shadow array examples ##

  * `[]` - empty _shadow array_, no arcs are occluded.
  * `[15, 45]` - there is an occluded arc between 15 and 45 degrees; cells within these angles cannot be seen.
  * `[15, 60, 120, 200]` - there are two occluded arcs; one is 15-60 degrees, second is 120-200 degrees.
  * `[0, 360]` - nothing can be seen, all angles are occluded, algorithm stops.

## Example ##

**@** is the PC. **Numbers** correspond to cells in ring #2.

```
 @  .  2  .  .
 .  .  X  .  .
14 15  0  .  Z
 .  .  .  .  Y
 .  .  .  .  .
```

We are currently testing cell marked with **X** - it is a second cell of a second ring. This cell is the only wall (visibility blocker) encountered so far; it corresponds to arc 11-34 degrees, so the _shadow array_ changes from `[]` to `[11, 34]` after this cell is examined. This cell itself is visible.

Cell marked with **Y** is a second cell of a fourth ring. It corresponds to arc 5-17 degrees, which is partially contained in the _shadow array_. Therefore, the **Y** cell can be seen. If **Y** is be a wall, visiting it would adjust the _shadow array_ to `[5, 34]`.

Cell marked with **Z** is a third cell of a fourth ring. It corresponds to arc 16-29 degrees, which is fully contained in the _shadow array_. Therefore, the **Z** cell can not be seen.