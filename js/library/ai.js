/**
 * @class Wait
 * @augments RPG.AI.Task
 */
RPG.AI.Wait = OZ.Class().extend(RPG.AI.Task);
RPG.AI.Wait.prototype.go = function() {
	var being = this._ai.getBeing();
    this._ai.setActionResult(being.wait());
    return RPG.AI_OK;
}

/**
 * @class Wander in rectangular area
 * @augments RPG.AI.Task
 */
RPG.AI.WanderInArea = OZ.Class().extend(RPG.AI.Task);
RPG.AI.WanderInArea.prototype.init = function(corner1, corner2) {
	this.parent();
	this._corner1 = corner1.clone();
	this._corner2 = corner2.clone();
}

RPG.AI.WanderInArea.prototype.go = function() {
	var being = this._ai.getBeing();
	var cell = being.getCell();
	
	if (!this._inArea(cell.getCoords())) { /* PANIC! We are not in our area */
		this._ai.setActionResult(being.wait());
		return RPG.AI_OK;
	}
	
	var map = cell.getMap();
	var neighbors = map.cellsInCircle(cell.getCoords(), 1);
	var avail = [null];
	for (var i=0;i<neighbors.length;i++) {
		var neighbor = neighbors[i];
		if (!neighbor.isFree()) { continue; }
		if (!this._inArea(neighbor.getCoords())) { continue; }
		avail.push(neighbor);
	}
	
	var target = avail[Math.floor(Math.random() * avail.length)];
	if (target) {
		this._ai.setActionResult(being.move(target));
	} else {
		this._ai.setActionResult(being.wait());
	}
	
	return RPG.AI_OK;
}

RPG.AI.WanderInArea.prototype._inArea = function(coords) {
	if (coords.x < this._corner1.x || coords.x > this._corner2.x) { return false; }
	if (coords.y < this._corner1.y || coords.y > this._corner2.y) { return false; }
	return true;
}

/**
 * @class Kill task
 * @augments RPG.AI.Task
 */
RPG.AI.Kill = OZ.Class().extend(RPG.AI.Task);

RPG.AI.Kill.prototype.init = function(being) {
	this.parent();
	this._being = being;
	this._subtasks.attack = new RPG.AI.Attack(being);
}

RPG.AI.Kill.prototype.go = function() {
	return this._subtasks.attack.go();
}

RPG.AI.Kill.prototype.getBeing = function() {
	return this._being;
}

/** 
 * @class Heal self task
 * @augments RPG.AI.Task
 */
RPG.AI.HealSelf = OZ.Class().extend(RPG.AI.Task);

RPG.AI.HealSelf.prototype.go = function() {
	var being = this._ai.getBeing();

	/* try potion first */
	var potion = this._getPotion(being);
	if (potion) {
		being.drink(potion);
		return RPG.AI_OK;
	}

	/* then casting */
	var heal = RPG.Spells.Heal;
	if (being.hasSpell(heal, true)) {
		heal = new Heal(being);
		being.cast(heal, RPG.CENTER);
		return RPG.AI_OK;
	}

	return RPG.AI_IMPOSSIBLE;
}

RPG.AI.HealSelf.prototype._getPotion = function(being) {
	var potions = being.getItems().filter(
		function(x) { 
			return (x instanceof RPG.Items.HealingPotion);
		});

	return potions.random(); 
}

/** 
 * @class Heal other task
 * @augments RPG.AI.Task
 */
RPG.AI.HealOther = OZ.Class().extend(RPG.AI.Task);

RPG.AI.HealOther.prototype.init = function(being) {
	this.parent();
	this._being = being;
}

RPG.AI.HealOther.prototype.go = function() {
	var being = this._ai.getBeing();

	/* dunno how to heal or haven't got enough mana */
	var heal = RPG.Spells.Heal;
	if (!being.hasSpell(heal,true)) {
		return RPG.AI_IMPOSSIBLE;
	}

	/* check distance */
	var c1 = being.getCell().getCoords();
	var c2 = this._being.getCell().getCoords();

	if (c1.distance(c2) > 1) { /* too distant, approach */
		/* FIXME refactor */
		this._ai.addTask(new RPG.AI.Approach(this._being));
		this._ai.addTask(new RPG.AI.HealOther(this._being));
		return RPG.AI_OK;
	} else { /* okay, cast */
		being.cast(heal,c1.dirTo(c2)); 
		return RPG.AI_OK;	
	}
}

/**
 * Attack task
 * @augments RPG.AI.Task
 */
RPG.AI.Attack = OZ.Class().extend(RPG.AI.Task);
RPG.AI.Attack.prototype.init = function(being) {
	this.parent();
	this._being = being;
	this._subtasks.approach = new RPG.AI.Approach(being);
}

RPG.AI.Attack.prototype.go = function() {
	if (!this._being.isAlive()) { return RPG.AI_ALREADY_DONE; }
	var result = this._subtasks.approach.go();
	switch (result) {
		case RPG.AI_IMPOSSIBLE:
			return result;
		break;
		case RPG.AI_ALREADY_DONE: /* approaching not valid, we can attack */
			var being = this._ai.getBeing();
			var slot = being.getSlot(RPG.SLOT_WEAPON);
			this._ai.setActionResult(being.attackMelee(this._being, slot));
			return RPG.AI_OK;
		break;
		case RPG.AI_OK:
			return RPG.AI_OK;
		break;
	}
}

/**
 * @class Approach task - get to distance 1 to a given target
 * @augments RPG.AI.Task
 */
RPG.AI.Approach = OZ.Class().extend(RPG.AI.Task);	

/**
 * @param {RPG.Beings.BaseBeing} being
 */
RPG.AI.Approach.prototype.init = function(being) {
	this.parent();
	this._being = being;
	/* target last seen here */
	this._lastCoords = null; 
}

RPG.AI.Approach.prototype.go = function() {
	var being = this._ai.getBeing();
	var c1 = being.getCell().getCoords();
	var c2 = this._being.getCell().getCoords();
	
	if (c1.distance(c2) == 1) { return RPG.AI_ALREADY_DONE; } /* we are happy when distance==1 */
	
	if (this._lastCoords && this._lastCoords.x == c1.x && this._lastCoords.y == c1.y) { 
		/* we just arrived at last seen coords */
		this._lastCoords = null;
	}
	
	if (being.canSee(c2)) { /* we can see the victim; record where is it standing */
		this._lastCoords = c2.clone();
	}
	
	if (this._lastCoords) {
		/* we know where to go */
		var cell = RPG.AI.cellToDistance(being.getCell(), this._being.getCell(), 1);
		if (cell) {
			this._ai.setActionResult(being.move(cell));
		} else {
			this._ai.setActionResult(being.wait());
		}
		return RPG.AI_OK;
	} else {
		return RPG.AI_IMPOSSIBLE;
	}
}

/**
 * @class Act defensively
 * @augments RPG.AI.Task
 */
RPG.AI.ActDefensively = OZ.Class().extend(RPG.AI.Task);

RPG.AI.ActDefensively.prototype.init = function(being) {
	this.parent();
	this._subtasks.heal = new RPG.AI.HealSelf();
	this._subtasks.retreat = new RPG.AI.Retreat(being);
}

RPG.AI.ActDefensively.prototype.go = function() {
	var being = this._ai.getBeing();

	/* we are okay, no defense is necessary */
	if (!RPG.Rules.isWoundedToRetreat(being)) { return RPG.AI_ALREADY_DONE; }

	/* try to heal ourselves */
	if (this._subtasks.heal.go() == RPG.AI_OK) { return RPG.AI_OK; }

    /* run away from target */
    return this._subtasks.retreat.go();
}

/**
 * @class Run away from a being
 * @augments RPG.AI.Task
 */
RPG.AI.Retreat = OZ.Class().extend(RPG.AI.Task);

RPG.AI.Retreat.prototype.init = function(being) {
	this.parent();
	this._being = being;
}

RPG.AI.Retreat.prototype.go = function() {
	var being = this._ai.getBeing();
	
	/* we are okay, no more retreating necessary */
	if (!RPG.Rules.isWoundedToRetreat(being)) { return RPG.AI_ALREADY_DONE; }
	
	var c1 = being.getCell().getCoords();
	var c2 = this._being.getCell().getCoords();

	if (being.canSee(c2)) {
		/* we see the target so we know how to run away */
		var cell = RPG.AI.cellToDistance(being.getCell(), this._being.getCell(), 1e5);
		if (cell) {
			this._ai.setActionResult(being.move(cell));
		} else {
			this._ai.setActionResult(being.wait());
		}
		return RPG.AI_OK;
	} else {
		/* enemy is not visible */
		return RPG.AI_IMPOSSIBLE;
	}
}
