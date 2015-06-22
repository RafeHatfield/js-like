# OOP system #

This engine uses a modified (extended) version of oz.js JavaScript library. `OZ.Class()` simulates a traditional "class", which can extend one parent and implement arbitrary number of interfaces. Moreover, it is possible to call parent methods. Constructors are called "init".

```
var Parent = OZ.Class();
Parent.prototype.init = function() { /* constructor */
  // doStuff++
} 

var Interface = OZ.Class();
Interface.prototype.method = function() {}

var Child = OZ.Class();
Child.extend(Parent);
Child.implement(Interface);
Child.prototype.init = function() {
  this.parent(); /* Parent::init() */
  this.method();
}
```

# Design elements #

On [separate page](DesignElements.md).

# Code graph generation #

  1. include the graph generator file, `debug/graph.js`
  1. use Firebug to access the `Graph.result` variable
  1. put generated graph data into a file
  1. recommended [Graphviz](http://www.graphviz.org/) commandline:
```
dot -o js-like.gif -T gif -Gconcentrate=true -Granksep=1.5 data.dot
```