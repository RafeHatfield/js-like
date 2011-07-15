/**
 * @class Base abstract spell
 * @augments RPG.Visual.IVisual
 */
RPG.Spells.BaseSpell = OZ.Class()
						.implement(RPG.Visual.IVisual);
RPG.Spells.BaseSpell.factory.frequency = 0;
RPG.Spells.BaseSpell.cost = null;
RPG.Spells.BaseSpell.visual = { path:"spells" };
RPG.Spells.BaseSpell.prototype._type = RPG.SPELL_SELF;
RPG.Spells.BaseSpell.prototype.init = function(caster) {
	this._caster = caster;
}

RPG.Spells.BaseSpell.prototype.cast = function(target) {
}

RPG.Spells.BaseSpell.prototype.getCost = function() { 
	return this.constructor.cost;
}

RPG.Spells.BaseSpell.prototype.getType = function() { 
	return this._type;
}

RPG.Spells.BaseSpell.prototype.getCaster = function() {
	return this._caster;
}

/**
 * @class Abstract attack spell
 * @augments RPG.Spells.BaseSpell
 * @augments RPG.Misc.IDamageDealer
 */
RPG.Spells.Attack = OZ.Class()
					.extend(RPG.Spells.BaseSpell)
					.implement(RPG.Misc.IDamageDealer);
RPG.Spells.Attack.factory.frequency = 0;
RPG.Spells.Attack.visual = { ch:"*" };
RPG.Spells.Attack.prototype._damage = null;
RPG.Spells.Attack.prototype.init = function(caster) {
	this.parent(caster);
	this._exploded = false;
}
/**
 * @see RPG.Misc.IDamageDealer#getLuck
 */
RPG.Spells.Attack.prototype.getLuck = function() {
	return this._caster.getFeat(RPG.FEAT_LUCK);
}
/**
 * @see RPG.Misc.IDamageDealer#getHit
 * Spells always hit (evasion possible due to luck)
 */
RPG.Spells.Attack.prototype.getHit = function() {
	return new RPG.Misc.RandomValue(1/0, 0);
}

/**
 * Explosion
 * @param {RPG.Misc.Coords} center
 * @param {int} radius
 * @param {bool} ignoreCenter
 */
RPG.Spells.Attack.prototype.explode = function(center, radius, ignoreCenter) {
	this._exploded = true;
	RPG.UI.map.removeProjectiles();
	RPG.Game.getEngine().lock();
	var map = this._caster.getMap();
	var coords = map.getCoordsInArea(center, radius);
	if (ignoreCenter) { coords.shift(); }
	
	for (var i=0;i<coords.length;i++) {
		var c = coords[i];
		RPG.UI.map.addProjectile(c, this);
	}
	setTimeout(this.bind(function(){
		this._afterExplosion(coords);
	}), 100);
}

RPG.Spells.Attack.prototype._afterExplosion = function(coords) {
	for (var i=0;i<coords.length;i++) {
		var b = this._caster.getMap().getBeing(coords[i]);
		if (!b) { continue; }
		this._caster.attackMagic(b, this);
	}
	
	RPG.UI.map.removeProjectiles();
	RPG.Game.getEngine().unlock();
}

/**
 * @class Abstract projectile spell
 * @augments RPG.Spells.Attack
 * @augments RPG.Misc.IProjectile
 */
RPG.Spells.Projectile = OZ.Class()
						.extend(RPG.Spells.Attack)
						.implement(RPG.Misc.IProjectile);
RPG.Spells.Projectile.factory.frequency = 0;
RPG.Spells.Projectile.prototype.init = function(caster) {
	this.parent(caster);
	this._initProjectile();
	this._flight.bounces = [];

	this._bounces = true;
}

RPG.Spells.Projectile.prototype.getImage = function() {
	var fvp = this._getFlightVisualProperty("image");
	return (fvp ? this.getVisualProperty("path") + "/" + fvp : this.parent());
}

RPG.Spells.Projectile.prototype.getChar = function() {
	return this._getFlightVisualProperty("ch") || this.parent();
}

RPG.Spells.Projectile.prototype.cast = function(target) {
	this.launch(this._caster.getCoords(), target, this._caster.getMap());
}

RPG.Spells.Projectile.prototype._fly = function() {
	this.parent();

	var coords = this._flight.coords[this._flight.index];
	var bounce = this._flight.bounces[this._flight.index];
	
	if (bounce && RPG.Game.pc.canSee(coords)) {
		var s = RPG.Misc.format("%The bounces!", this);
		RPG.UI.buffer.message(s);
	}
}

RPG.Spells.Projectile.prototype.computeTrajectory = function(source, target, map) {
	if (this._type == RPG.SPELL_TARGET) { 
		/* same as basic projectiles */
		return this.parent(source, target, map);
	}
	
	if (this._type == RPG.SPELL_DIRECTION) {
		/* target = direction */
		var dir = target;
		
		this._flight.index = -1;
		this._flight.coords = [source];
		this._flight.dirs = [null];
		this._flight.bounces = [false];

		var dist = 0;
		while (dist < this._range) {
			dist++;
			var prev = this._flight.coords[this._flight.coords.length-1];
			var coords = prev.neighbor(dir);
			if (!map.getCell(coords)) { return this._flight; }
			
			if (!map.blocks(RPG.BLOCKS_LIGHT, coords) || !this._bounces) {
				/* either free space or non-bouncing end obstacle */
				this._flight.bounces.push(false);
				this._flight.coords.push(coords);
				this._flight.dirs.push(dir);
				if (map.blocks(RPG.BLOCKS_LIGHT, coords)) { break; }
			} else {
				/* bounce! */
				dir = this._computeBounce(prev, dir);
			}
		}
		
		return this._flight;
	}
	
	throw new Error("Cannot compute trajectory for a non-projectile spell");
}

/**
 * Compute bouncing
 * @param {RPG.Misc.Coords} coords Previous (free) coords
 * @param {int} dir Direction to current (blocking) coords
 */
RPG.Spells.Projectile.prototype._computeBounce = function(coords, dir) {
	var newCoords = coords;
	var newDir = null;
	var map = this._caster.getMap();
	
	var leftDir = (dir+7) % 8;
	var rightDir = (dir+1) % 8;
	var leftCoords = coords.neighbor(leftDir);
	var rightCoords = coords.neighbor(rightDir);
	
	var leftFree = !map.blocks(RPG.BLOCKS_LIGHT, leftCoords);
	var rightFree = !map.blocks(RPG.BLOCKS_LIGHT, rightCoords);
	
	if (leftFree == rightFree) { /* backwards */
		newDir = (dir+4) % 8;
	} else if (leftFree) { /* bounce to the left */
		newCoords = leftCoords;
		newDir = (dir+6) % 8;
	} else { /* bounce to the right */
		newCoords = rightCoords;
		newDir = (dir+2) % 8;
	}
	
	this._flight.bounces.push(true);
	this._flight.coords.push(newCoords);
	this._flight.dirs.push(newDir);
	
	return newDir;
}
