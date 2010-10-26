/**
 * @class Player character
 * @augments RPG.Beings.BaseBeing
 */
RPG.Beings.PC = OZ.Class().extend(RPG.Beings.BaseBeing);
RPG.Beings.PC.prototype.init = function(race, profession) {
	this.parent(race);
	var prof = new profession();
	
	this.setVisual({image:this._visual.image + "-" + prof.getImage()});
	
	this._visibleCoordsHash = {};
	
	this.setVisual({desc:"you"});
	this._kills = 0;
	this._quests = [];
	
	this.setFeat(RPG.FEAT_DV, 5);
	this.setFeat(RPG.FEAT_MAX_HP, 10);
	this.setFeat(RPG.FEAT_MAX_MANA, 5);
	
	prof.setup(this);
	
	var tc = new RPG.Effects.TurnCounter(this);
	this.addEffect(tc);
	
	this.fullStats();
}

RPG.Beings.PC.prototype.toJSON = function(handler) {
	return handler.toJSON(this, {exclude:"_visibleCoordsHash"});
}

RPG.Beings.PC.prototype.getQuests = function() {
	return this._quests;
}

RPG.Beings.PC.prototype.addQuest = function(quest) {
	this._quests.push(quest);
	return this;
}

RPG.Beings.PC.prototype.removeQuest = function(quest) {
	var index = this._quests.indexOf(quest);
	if (index == -1) { throw new Error("Cannot find quest"); }
	this._quests.splice(index, 1);
	return this;
}

RPG.Beings.PC.prototype.getKills = function() {
	return this._kills;
}

RPG.Beings.PC.prototype.addKill = function(being) {
	this._kills++;
}

RPG.Beings.PC.prototype.getVisibleCoords = function() {
	return this._visibleCoordsHash;
}

RPG.Beings.PC.prototype.addItem = function(item) { 
	item.remember();
	return this.parent(item);
}

RPG.Beings.PC.prototype.setName = function(name) {
	this.parent(name);
	RPG.UI.status.updateName(this._name);
	return this;
}

RPG.Beings.PC.prototype.setStat = function(stat, value) {
	var value = this.parent(stat, value);
	RPG.UI.status.updateStat(stat, value);
	return value;
}

RPG.Beings.PC.prototype._updateFeat = function(feat) {
	var value = this.parent(feat);
	RPG.UI.status.updateFeat(feat, value);
	return value;
}

RPG.Beings.PC.prototype.setMap = function(map) {
	this.parent(map);
	this._visibleCoordsHash = {};
}

/**
 * @see RPG.Visual.IVisual#describeA
 */
RPG.Beings.PC.prototype.describeA = function() {
	return this.describe();
}

/**
 * @see RPG.Visual.IVisual#describeThe
 */
RPG.Beings.PC.prototype.describeThe = function() {
	return this.describe();
}

/**
 * @see RPG.Beings.BaseBeing#describeHe
 */
RPG.Beings.PC.prototype.describeHe = function() {
	return "you";
}

/**
 * @see RPG.Beings.BaseBeing#describeHim
 */
RPG.Beings.PC.prototype.describeHim = function() {
	return "you";
}

/**
 * @see RPG.Beings.BaseBeing#describeHis
 */
RPG.Beings.PC.prototype.describeHis = function() {
	return "yours";
}


/**
 * @see RPG.Visual.IVisual#describeIs
 */
RPG.Beings.PC.prototype.describeIs = function() {
	return "are";
}

/**
 * PC uses a different approach - maintains a list of visible coords
 */
RPG.Beings.PC.prototype.canSee = function(coords) {
	return (coords.id in this._visibleCoordsHash);
}

/**
 * Update the array with all visible coordinates
 */
RPG.Beings.PC.prototype.updateVisibility = function() {
	var R = this.getFeat(RPG.FEAT_SIGHT_RANGE);
	var center = this._coords;
	var current = new RPG.Misc.Coords(0, 0);
	var map = this._map;
	var eps = 1e-4;
	var c = false;

	/* directions blocked */
	var arcs = [];
	
	/* results */
	this._visibleCoordsHash = {};
	this._visibleCoordsHash[this._coords.id] = this._coords;
	
	/* number of cells in current ring */
	var cellCount = 0;

	var arcCount = R*8; /* length of longest ring */
	for (var i=0;i<arcCount;i++) { arcs.push([0, 0]); }
	
	/* analyze surrounding cells in concentric rings, starting from the center */
	for (var r=1; r<=R; r++) {
		cellCount += 8;
		var arcsPerCell = arcCount / cellCount; /* number of arcs per cell */
		
		var coords = map.getCoordsInCircle(center, r, true);
		for (var i=0;i<coords.length;i++) {
			if (!coords[i]) { continue; }
			c = coords[i];

			var startArc = (i-0.5) * arcsPerCell + 0.5;
			if (this._visibleCoords(map.blocks(RPG.BLOCKS_LIGHT, c), startArc, arcsPerCell, arcs)) { 
				this._visibleCoordsHash[c.id] = c; 
			}

			/* cutoff? */
			var done = true;
			for (var j=0;j<arcCount;j++) {
				if (arcs[j][0] + arcs[j][1] + eps < 1) {
					done = false;
					break;
				}
			}
			if (done) { return; }
		} /* for all cells in this ring */
	} /* for all rings */
}

/**
 * Subroutine for updateVisibility(). For a given coords, checks if it is visible and adjusts arcs it blocks.
 * @param {bool} blocks Does this cell block?
 * @param {float} startArc Floating arc index corresponding to first arc shaded by this cell
 * @param {float} arcsPerCell How many arcs are shaded by this one, >= 1
 * @param {arc[]} array of available arcs
 */
RPG.Beings.PC.prototype._visibleCoords = function(blocks, startArc, arcsPerCell, arcs) {
	var eps = 1e-4;
	var startIndex = Math.floor(startArc);
	var arcCount = arcs.length;
	
	var ptr = startIndex;
	var given = 0; /* amount already distributed */
	var amount = 0;
	var arc = null;
	var ok = false;
	do {
		var index = ptr; /* ptr recomputed to avail range */
		if (index < 0) { index += arcCount; }
		if (index >= arcCount) { index -= arcCount; }
		arc = arcs[index];
		
		/* is this arc is already totally obstructed? */
		var chance = (arc[0] + arc[1] + eps < 1);

		if (ptr < startArc) {
			/* blocks left part of blocker (with right cell part) */
			amount += ptr + 1 - startArc;
			if (chance && amount > arc[0]+eps) {
				/* blocker not blocked yet, this cell is visible */
				ok = true;
				/* adjust blocking amount */
				if (blocks) { arc[0] = amount; }
			}
		} else if (given + 1 > arcsPerCell)  { 
			/* blocks right part of blocker (with left cell part) */
			amount = arcsPerCell - given;
			if (chance && amount > arc[1]+eps) {
				/* blocker not blocked yet, this cell is visible */
				ok = true;
				/* adjust blocking amount */
				if (blocks) { arc[1] = amount; }
			}
		} else {
			/* this cell completely blocks a blocker */
			amount = 1;
			if (chance) {
				ok = true;
				if (blocks) {
					arc[0] = 1;
					arc[1] = 1;
				}
			}
		}
		
		given += amount;
		ptr++;
	} while (given < arcsPerCell);
	
	return ok;
}

RPG.Beings.PC.prototype.yourTurn = function() {
	return RPG.ACTION_DEFER;
}

RPG.Beings.PC.prototype.teleport = function(coords) {
	RPG.UI.buffer.message("You suddenly teleport away!");
	this.parent(coords);
}

/* ------------------------- ACTIONS -----------------*/

RPG.Beings.PC.prototype.activateTrap = function(trap) {
	trap.setOff();
	return RPG.ACTION_TIME;
}

RPG.Beings.PC.prototype.move = function(target, ignoreOldCoords) {
	var result = this.parent(target, ignoreOldCoords);
	
	if (target) {
		this._describeLocal();
		RPG.UI.map.redrawVisible();
		RPG.UI.refocus();
	}
	
	return result;
}

/**
 * Flirt with someone
 * @param {RPG.Misc.Coords} coords
 */
RPG.Beings.PC.prototype.flirt = function(coords) {
	var being = this._map.getBeing(coords);

	if (this == being) {
		RPG.UI.buffer.message("You spend some nice time flirting with yourself.");
		return RPG.ACTION_TIME;
	}
	
	if (!being) {
		RPG.UI.buffer.message("There is noone to flirt with!");
		return RPG.ACTION_TIME;
	}

	var s = RPG.Misc.format("%The doesn't seem to be interested.", being);
	RPG.UI.buffer.message(s);
	return RPG.ACTION_TIME;
}

/**
 * Switch position
 * @param {RPG.Misc.Coords} coords
 */
RPG.Beings.PC.prototype.switchPosition = function(coords) {
	var being = this._map.getBeing(coords);
	
	if (!being) {
		RPG.UI.buffer.message("There is noone to switch position with.");
		return RPG.ACTION_TIME;
	}
	
	if (!being.getAI().isSwappable(this)) {
		/* impossible */
		var s = RPG.Misc.format("%The resists!", being);
		RPG.UI.buffer.message(s);
	} else {
		RPG.UI.buffer.message("You switch positions.");
/*
		} else if (pc.canSee(this._target.getCoords())) {
			var s = RPG.Misc.format("%A sneaks past %a.", this._source, being);
			RPG.UI.buffer.message(s);
		}
*/		
		var source = this._coords;
		this.move(cell, true);
		being.move(source, true);
	}

	return RPG.ACTION_TIME;
}

RPG.Beings.PC.prototype.equipDone = function() {
	RPG.UI.buffer.message("You adjust your equipment.");
	RPG.UI.map.redrawVisible();
	return RPG.ACTION_TIME;
}

/**
 * Looking around
 * @param {RPG.Misc.Coords} coords
 */
RPG.Beings.PC.prototype.look = function(coords) {
	this._describeRemote(coords);
	return RPG.ACTION_NO_TIME;
}

/**
 * Enter staircase or other level-changer
 * @param {RPG.Features.BaseFeature} feature
 */
RPG.Beings.PC.prototype.enterLocation = function() {
	var f = this._map.getFeature(this._coords);
	return f.enter(this);
}

/**
 * Enter staircase leading upwards
 */
RPG.Beings.PC.prototype.ascend = function() {
	RPG.UI.buffer.message("You climb upwards...");
	return this.enterLocation();
}

/**
 * Enter staircase leading downwards
 */
RPG.Beings.PC.prototype.descend = function() {
	RPG.UI.buffer.message("You climb downwards...");
	return this.enterLocation();
}

/**
 * Search surroundings
 */
RPG.Beings.PC.prototype.search = function() {
	RPG.UI.buffer.message("You search your surroundings...");
	var found = 0;
	
	var coords = this._map.getCoordsInCircle(this._coords, 1, false);
	for (var i=0;i<coords.length;i++) {
		found += this._search(coords[i]);
	}
	
	if (found) { RPG.UI.map.redrawVisible(); }

	return RPG.ACTION_TIME;
}

/**
 * @returns {int} 1 = revealed, 0 = not revealed
 * FIXME
 */
RPG.Beings.PC.prototype._search = function(coords) {
	var cell = this._map.getCell(coords);
	if (cell.isFake() && RPG.Rules.isFakeDetected(this, cell)) {
		cell.reveal(this._map, coords); /* reveal! */

		var desc = "passage";
		if (this._map.getFeature(coords)) { desc = this._map.getFeature(coords).describe(); }
		var s = RPG.Misc.format("You discover a hidden %s!", desc);
		RPG.UI.buffer.message(s);
		return 1;
	}
	
	var f = this._map.getFeature(coords);
	if (f && f instanceof RPG.Features.Trap && !this.knowsFeature(f) && RPG.Rules.isTrapDetected(this, f)) {
		this._knownTraps.push(f);
		var s = RPG.Misc.format("You discover %a!", f);
		RPG.UI.buffer.message(s);
		return 1;
	}
	
	return 0;
}

RPG.Beings.PC.prototype.chat = function(being) {
	if (being.getAI().isHostile(this)) {
		var s = RPG.Misc.format("%The is not in the mood for talking!", being);
		RPG.UI.buffer.message(s);
		return RPG.ACTION_TIME;
	}
	
	var s = RPG.Misc.format("You talk to %a.", being);
	RPG.UI.buffer.message(s);

	if (being.getAI().getDialogText(this)) {
		return being.chat(this);
	} else {
		var s = RPG.Misc.format("%He does not reply.", being);
		RPG.UI.buffer.message(s);
		return RPG.ACTION_TIME;
	}
}

/**
 * Kick something
 * @param {RPG.Misc.Coords} coords
 */
RPG.Beings.PC.prototype.kick = function(coords) {
	var feature = this._map.getFeature(coords);
	var being = this._map.getBeing(coords);
	var items = this._map.getItems(coords);
	
	if (coords.id == this._coords.id) {
		RPG.UI.buffer.message("You would not do that, would you?");
		return RPG.ACTION_NO_TIME;
	}
	
	if (feature && feature instanceof RPG.Features.Door && feature.isClosed()) { /* kick door */
		var feet = this.getSlot(RPG.SLOT_FEET);
		var dmg = feet.getDamage().roll();
		var result = feature.damage(dmg);
		if (result) {
			RPG.UI.buffer.message("You kick the door, but it does not budge.");
		} else {
			RPG.UI.buffer.message("You shatter the door with a mighty kick!");
			RPG.UI.map.redrawVisible();
		}
		return RPG.ACTION_TIME;
	}
	
	if (being) { /* kick being */
		if (!being.confirmAttack()) { return RPG.ACTION_NO_TIME;  }
		this.attackMelee(being, this.getSlot(RPG.SLOT_FEET));
		return RPG.ACTION_TIME;
	}

	if (this._map.blocks(RPG.BLOCKS_MOVEMENT, coords)) {
		RPG.UI.buffer.message("Ouch! That hurts!");
		return RPG.ACTION_TIME;
	}
	
	if (items.length) { /* try kicking items */
		var dir = this._coords.dirTo(coords);
		var target = coords.neighbor(dir);
		
		if (!this._map.blocks(RPG.BLOCKS_MOVEMENT, target)) { /* kick topmost item */
			var item = items[items.length-1];
			this._map.removeItem(item, coords);
			this._map.addItem(item, target);
			
			var s = RPG.Misc.format("You kick %the. It slides away.", item);
			RPG.UI.buffer.message(s);
			
			RPG.UI.map.redrawCoords(coords); 
			RPG.UI.map.redrawCoords(target); 
			return RPG.ACTION_TIME;
		}
	}
	
	RPG.UI.buffer.message("You kick in empty air.");
	return RPG.ACTION_TIME;
}

RPG.Beings.PC.prototype.open = function(door) {
	var locked = door.isLocked();
	if (locked) { 
		RPG.UI.buffer.message("The door is locked. You do not have the appropriate key."); 
		return RPG.ACTION_TIME;
	}
	
	var stuck = RPG.Rules.isDoorStuck(this, door);
	if (stuck) {
		RPG.UI.buffer.message("Ooops! The door is stuck.");
		return RPG.ACTION_TIME;
	}
	
	door.open();
	var verb = RPG.Misc.verb("open", this);
	var s = RPG.Misc.format("%A %s the door.", this, verb);
	RPG.UI.buffer.message(s);
	RPG.UI.map.redrawVisible(); 
	
	return RPG.ACTION_TIME;
}

RPG.Beings.PC.prototype.attackMagic = function(being, spell) {
	var result = this.parent(being, spell);
	if (!being.isAlive()) { this.addKill(being); }
	return result;
}

RPG.Beings.PC.prototype.attackMelee = function(being, slot) {
	var result = this.parent(being, slot);
	if (!being.isAlive()) { this.addKill(being); }
	return result;
}

/* ------------------- PRIVATE --------------- */

RPG.Beings.PC.prototype._describeAttack = function(hit, damage, kill, being, slot) {
	var killVerb = ["kill", "slay"].random();
	var hitVerb = (slot instanceof RPG.Slots.Kick ? "kick" : "hit");

	if (!hit) {
		var s = RPG.Misc.format("You miss %the.", being);
		RPG.UI.buffer.message(s);
		return;
	}
	
	var s = RPG.Misc.format("You %s %the", hitVerb, being);
	if (!damage) {
		s += RPG.Misc.format(", but do not manage to harm %him.", being);
		RPG.UI.buffer.message(s);
		return;
	}
	
	if (kill) {
		s += RPG.Misc.format(" and %s %him!", killVerb, being);
		RPG.UI.buffer.message(s);
	} else {
		s += RPG.Misc.format(" and %s wound %him.", being.woundedState(), being);
		RPG.UI.buffer.message(s);
	}
}

RPG.Beings.PC.prototype._describeLocal = function() {
	var f = this._map.getFeature(this._coords);
	if (f && this.knowsFeature(f)) {
		var s = RPG.Misc.format("%A.", f);
		RPG.UI.buffer.message(s);
	}
	
	var items = this._map.getItems(this._coords);
	if (items.length > 1) {
		RPG.UI.buffer.message("Several items are lying here.");
	} else if (items.length == 1) {
		var item = items[0];
		var s = RPG.Misc.format("%A %is lying here.", item, item);
		RPG.UI.buffer.message(s);
	}
}

RPG.Beings.PC.prototype._describeRemote = function(coords) {
	if (!this.canSee(coords)) {
		RPG.UI.buffer.message("You can not see that place.");
		return;
	}
	
	var b = this._map.getBeing(coords);
	if (b) {
		var s = "";
		if (b == this) {
			s = RPG.Misc.format("You are %s wounded.", b.woundedState());
			RPG.UI.buffer.message(s);
		} else {
			this._describeBeing(b);
		}
		return;
	}
	
	var s = RPG.Misc.format("%A.", this._map.getCell(coords));
	RPG.UI.buffer.message(s);

	var f = this._map.getFeature(coords);
	if (f && this.knowsFeature(f)) {
		var s = RPG.Misc.format("%A.", f);
		RPG.UI.buffer.message(s);
	}
	
	var items = this._map.getItems(coords);
	if (items.length) {
		var what = "";
		if (items.length > 1) {
			what = "several items are";
		} else if (items.length > 0) {
			what = RPG.Misc.format("%a %is", items[0], items[0]);
		}
		var s = RPG.Misc.format("%S lying there.", what);
		RPG.UI.buffer.message(s);
	}	
}

RPG.Beings.PC.prototype._describeBeing = function(b) {
	/* being with equipped weapon and/or shield */
	var arr = [];
	var ws = b.getSlot(RPG.SLOT_WEAPON);
	var weapon = (ws ? ws.getItem() : null);
	var ss = b.getSlot(RPG.SLOT_SHIELD);
	var shield = (ss ? ss.getItem() : null);
	if (weapon) { arr.push(RPG.Misc.format("%a", weapon)); }
	if (shield) { arr.push(RPG.Misc.format("%a", shield)); }
	var format = "%A";
	if (arr.length) {
		format += ", wielding " + arr.join(" and ") + ".";
	} else {
		format += ".";
	}
	var s = RPG.Misc.format(format, b);
	RPG.UI.buffer.message(s);

	/* difficulty report */
	this._describeDifficulty(b);
	
	/* wound status */
	var s = RPG.Misc.format("%He %is %s wounded.", b, b, b.woundedState());
	RPG.UI.buffer.message(s);
	
	/* hostility */
	if (b.getAI().isHostile(this)) {
		s = RPG.Misc.format("%The is hostile.", b);
	} else {
		s = RPG.Misc.format("%The does not seem to be hostile.", b);
	}
	RPG.UI.buffer.message(s);
}

RPG.Beings.PC.prototype._describeDifficulty = function(b) {
	var feats = RPG.ATTRIBUTES.clone();
	feats.push(RPG.FEAT_DV);
	feats.push(RPG.FEAT_PV);
	feats.push(RPG.FEAT_MAX_HP);
	feats.push(RPG.FEAT_MAX_MANA);
	feats.push(RPG.FEAT_SPEED);
	
	var better = 0;
	for (var i=0;i<feats.length;i++) {
		var feat = feats[i];
		if (b.getFeat(feat) > this.getFeat(feat)) { better++; }
	}
	
	better /= feats.length; /* 0-1 */
	var list = ["trivial", "easy", "moderate", "tough", "difficult"];
	var index = Math.round(better*(list.length-1));
	var s = RPG.Misc.format("%He %is a %s opponent.", b, b, list[index]);
	RPG.UI.buffer.message(s);
}

