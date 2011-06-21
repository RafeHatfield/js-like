/**
 * @namespace Global game namespace
 */
RPG.Game = {
	pc: null,
	_story: null,
	_engine: null,
	_map: null,
	_events: [],
	_version: 9
}

RPG.Game.init = function() {
	this._initFactories();

	this._engine = new RPG.Engine();
}

/**
 * Event listeners managed by game are created separately.
 * This is because during game load, all relevant event handlers must be removed.
 */
RPG.Game.addEvent = function(who, event, callback) {
	var id = OZ.Event.add(who, event, callback);
	this._events.push(id);
	return id;
}

RPG.Game.removeEvent = function(id) {
	OZ.Event.remove(id);
	var index = RPG.Game._events.indexOf(id);
	if (index != -1) { RPG.Game._events.splice(index, 1); }
	return RPG.Game;
}

RPG.Game.setStory = function(story) {
	this._story = story;
}

RPG.Game.getStory = function() {
	return this._story;
}

RPG.Game.startMap = function(map, coords) {
	this.setMap(map, coords);
	this._engine.unlock();
}

RPG.Game.getEngine = function() {
	return this._engine;
}

RPG.Game.start = function() {
	if (!this._story) { throw new Error("Cannot start a game without a story!"); }
	this._story.generatePC();
}

RPG.Game.end = function() {
	this._engine.lock();
	this._story.end();
}

/**
 * Change to a new map by moving PC onto "coords"
 * @param {RPG.Map} map New map
 * @param {RPG.Misc.Coords} coords PC's coords
 */
RPG.Game.setMap = function(map, coords) {
	if (this._map) { this._map.setActive(false); }
	this._map = map; /* remember where we are */
	map.setActive(true);
	
	RPG.UI.status.updateMap(map.getID()); /* update statusbar */	

	map.setBeing(this.pc, coords);

	this._engine.useMap(map); /* switch engine to new actorset */
	return RPG.ACTION_TIME;
}

/**
 * Start creating save data
 * @param {function} readyStateChange Called when progress is made
 */
RPG.Game.save = function(readyStateChange) {
	var stack = [];
	var data = "";
	var header = [this._version, 0];
	
	stack.push(function() {
		readyStateChange(RPG.SAVELOAD_PROCESS, "JSONifying...");
		data = new RPG.Serializer().go();
	});
	
	stack.push(function() {
		readyStateChange(RPG.SAVELOAD_PROCESS, "Compressing...");
		data = Compress.stringToArray(data, Compress.UTF8);
		data = Compress.LZW(data);
	});

	stack.push(function() {
		readyStateChange(RPG.SAVELOAD_PROCESS, "Finalizing...");
		while (header.length) { data.unshift(header.pop()); }
		readyStateChange(RPG.SAVELOAD_DONE, data);
	});

	this._runStack(stack, readyStateChange);
}

/**
 * Restore saved game state
 * @param {string} data Saved data
 * @param {function} readyStateChange Called when progress is made
 */
RPG.Game.load = function(data, readyStateChange) {
	var stack = [];
	var p = new RPG.Parser();
	
	stack.push(function() {
		readyStateChange(RPG.SAVELOAD_PROCESS, "Uncompressing...");
		var header = [data.shift(), data.shift()];
		if (header[0] != this._version) { throw new Error("Incompatible save data"); }
		data = Compress.iLZW(data);
	});
	
	stack.push(function() {
		readyStateChange(RPG.SAVELOAD_PROCESS, "DeJSONifying...");
		data = Compress.arrayToString(data, Compress.UTF8);
		data = p.go(data);
	});

	stack.push(function() {
		readyStateChange(RPG.SAVELOAD_PROCESS, "Finalizing...");
		
		/* backup old event ids */
		var oldEvents = this._events;
		this._events = [];
		
		try {
			p.revive(); /* re-attach */
			this.fromJSON(data); /* restore + attach new events */
			oldEvents.forEach(this.removeEvent); /* remove old events */
			readyStateChange(RPG.SAVELOAD_DONE); /* done */
		} catch (e) {
			this._events.forEach(this.removeEvent); /* remove all partially attached events */
			this._events = oldEvents; /* put back old events */
			throw e; /* rethrow */
		}

	});

	this._runStack(stack, readyStateChange);
}

RPG.Game._runStack = function(stack, readyStateChange) {
	var context = this;
	var step = function() {
		var todo = stack.shift();
		try {
			todo.call(context);
			if (stack.length) { setTimeout(arguments.callee, 100); }
		} catch (e) {
			readyStateChange(RPG.SAVELOAD_FAILURE, e);
		}
	}
	step();
}

RPG.Game._initFactories = function() {
	RPG.Factories.items = new RPG.Misc.Factory().add(RPG.Items.BaseItem);
	RPG.Factories.gems = new RPG.Misc.Factory().add(RPG.Items.Gem);
	RPG.Factories.npcs = new RPG.Misc.Factory().add(RPG.Beings.NPC);
	RPG.Factories.traps = new RPG.Misc.Factory().add(RPG.Features.Trap);
	RPG.Factories.spells = new RPG.Misc.Factory().add(RPG.Spells.BaseSpell);
	RPG.Factories.gold = new RPG.Misc.Factory().add(RPG.Items.Gold);

	RPG.Factories.cells = new RPG.Misc.CellFactory();
}

/**
 * Return a plain JSON content
 */
RPG.Game.toJSON = function(handler) {
	return handler.toJSON({
		pc: this.pc,
		story: this._story,
		engine: this._engine,
		map: this._map,
		sound: RPG.UI.sound.getBackground(),
		status: RPG.UI.status.toJSON(handler),
		cells: RPG.Factories.cells.toJSON(handler)
	});
}

/**
 * Restore game state from a JSON object
 */
RPG.Game.fromJSON = function(data) {
	this.pc = data.pc;
	this._story = data.story;
	this._engine = data.engine;
	this._map = data.map;
	RPG.UI.sound.playBackground(data.sound);
	RPG.UI.status.fromJSON(data.status);
	RPG.Factories.cells.fromJSON(data.cells);
	
	this.pc.updateFromMemory(); 
}
