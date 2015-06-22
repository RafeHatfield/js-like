# Internal object references #

## Map ##

  * holds items
  * holds beings
  * holds cells
  * holds features
  * holds areas

## Item ##

  * does not know anything

## Cell ##

  * does not know anything

## Area ##

  * knows map (shop fills it with items)
  * encapsulates coords

## Feature ##

  * knows coords
  * knows map (it can remove itself)

## Being ##

  * knows map
  * knows coords
  * map.setBeing() => being.setMap(), being.setCoords()