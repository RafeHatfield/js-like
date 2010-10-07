/**
 * @class Basic item.
 * @augments RPG.Visual.IVisual
 * @augments RPG.Misc.IEnterable
 */
RPG.Items.BaseItem = OZ.Class()
						.implement(RPG.Visual.IVisual)
						.implement(RPG.Misc.IEnterable); /* "entering" an item means equipping it */
RPG.Items.BaseItem.factory.ignore = true;
RPG.Items.BaseItem.prototype.init = function() {
	this._initVisuals();
	this._descriptionPlural = null;
	this._modifiers = {};
	this._amount = 1;
	this._uncountable = false;
	this._remembered = false;
	this._price = 0;
	this._owner = null; /* being having this */
}

RPG.Items.BaseItem.prototype.setOwner = function(being) {
	this._owner = being;
	return this;
}

/**
 * Duplicate this item.
 */
RPG.Items.BaseItem.prototype.clone = function() {
	var clone = new this.constructor();
	for (var p in this) { clone[p] = this[p]; }

	/* copy modifiers to avoid references */
	clone._modifiers = {};
	for (var feat in this._modifiers) {
		clone._modifiers[feat] = this._modifiers[feat];
	}
	
	this.dispatch("clone", {clone:clone});
	return clone;
}

/**
 * Create an item which represents a subset of this item
 * @param {int} amount How many items do we subtract?
 * @returns {RPG.Items.BaseItem} Sub-heap
 */
RPG.Items.BaseItem.prototype.subtract = function(amount) {
	if (amount == 0 || amount >= this._amount) { throw new Error("Incorrect amount to subtract"); }
	var clone = this.clone();
	
	this.setAmount(this._amount - amount);
	clone.setAmount(amount);
	
	/* if the original item was remembered, let him know also the cloned version */
	if (this._remembered) { clone.remember(); }
	
	return clone;
}

RPG.Items.BaseItem.prototype.getAmount = function() {
	return this._amount;
}

RPG.Items.BaseItem.prototype.setAmount = function(amount) {
	this._amount = amount;
	return this;
}

RPG.Items.BaseItem.prototype.remember = function() {
	this._remembered = true;
}

RPG.Items.BaseItem.prototype.isUnpaid = function() {
	return this._price > 0;
}

RPG.Items.BaseItem.prototype.setPrice = function(price) {
	this._price = price;
	return this;
}

RPG.Items.BaseItem.prototype.getPrice = function() {
	return this._price;
}

/**
 * Items are described with respect to their "remembered" state
 * @see RPG.Visual.IVisual#describe
 */
RPG.Items.BaseItem.prototype.describe = function() {
	var s = "";
	if (this._amount == 1) {
		s += this._description;
	} else {
		s += "heap of " + this._amount + " ";
		s += this._descriptionPlural || (this._description + "s");
	}

	if (this._remembered) { /* known items show modifiers, if any */
		var mods = this._describeModifiers();
		if (mods) { s += " " + mods; }
	}
	
	if (this._price > 0) {
		s += " (unpaid, " + (this._price * this._amount) + " gold)";
	}

	return s;
}

/**
 * Return are/is string for this item
 * @returns {string}
 */
RPG.Items.BaseItem.prototype.describeIs = function() {
	if (this._amount == 1) {
		return (this._uncountable ? "are" : "is");
	} else { return "is"; }
}

RPG.Items.BaseItem.prototype.describeA = function() {
	if (this._uncountable) {
		return this.describe();
	} else {
		return RPG.Visual.IVisual.prototype.describeA.call(this);
	}
}

RPG.Items.BaseItem.prototype._describeModifiers = function() {
	var mods = this.getModified();
	var dv = null;
	var pv = null;
	var arr = [];

	for (var i=0;i<mods.length;i++) {
		var c = mods[i];
		if (c == RPG.FEAT_DV) { dv = c; }
		if (c == RPG.FEAT_PV) { pv = c; }
		if (RPG.ATTRIBUTES.indexOf(c) != -1) {
			var a = RPG.Feats[c];
			var str = a.name.capitalize().substring(0, 3);
			var num = this.getModifier(c);
			if (num >= 0) { num = "+"+num; }
			arr.push("{"+str+num+"}");
		}
	}
	
	if (dv || pv) {
		dv = this.getModifier(RPG.FEAT_DV);
		pv = this.getModifier(RPG.FEAT_PV);
		if (dv >= 0) { dv = "+"+dv; }
		if (pv >= 0) { pv = "+"+pv; }
		arr.unshift("["+dv+","+pv+"]");
	}
	
	return arr.join(" ");
}

/**
 * Can this item be merged with other one? This is possible only when items are truly the same.
 * @param {RPG.Items.BaseItem}
 */
RPG.Items.BaseItem.prototype.isSameAs = function(item) {
	if (item.constructor != this.constructor) { return false; }
	if (item.isUnpaid() != this.isUnpaid()) { return false; }
	if (item.getPrice() != this.getPrice()) { return false; }
	
	for (var p in this._modifiers) {
		if (item._modifiers[p] != this._modifiers[p]) { return false; }
	}
	
	for (var p in item._modifiers) {
		if (item._modifiers[p] != this._modifiers[p]) { return false; }
	}

	return true;
}

/**
 * Merge this item into a list of items.
 * @param {RPG.Items.BaseItem[]} listOfItems
 * @returns {bool} Was this item merged? false = no, it was appended
 */
RPG.Items.BaseItem.prototype.mergeInto = function(listOfItems) {
	for (var i=0;i<listOfItems.length;i++) {
		var item = listOfItems[i];
		if (item.isSameAs(this)) {
			/* merge! */
			item.setAmount(item.getAmount() + this.getAmount());
			/* this item was remembered, mark the heap as remembered as well */
			if (this._remembered) { item.remember(); }
			return true;
		}
	}
	
	listOfItems.push(this);
	return false;
}
