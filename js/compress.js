var Compress = {};

Compress.stringToBytes = function(str) {
	var result = [];
	for (var i=0;i<str.length;i++) {
		var num = str.charCodeAt(i);
		if (num > 255) { throw new Error("Bad character code ("+num+") at position "+i); }
		result.push(num);
	}
	return result;
}

Compress.bytesToString = function(bytes) {
	var arr = [];
	for (var i=0;i<bytes.length;i++) {
		arr.push(String.fromCharCode(bytes[i]));
	}
	return arr.join("");
}

Compress.LZW = function(input, options) {
	if (!input.length) { return []; }

	var o = {
		maxBits: 16,
		fixedWidth: false
	}
	for (var p in options) { o[p] = options[p]; }
	
	var bpc = 8;
	var output = (o.fixedWidth ? [] : new Compress.Stream());
	
	var dict = {};

	var code = (1 << bpc)-1;
	var codeLimit = 1 << bpc;
	
	var phrase = String.fromCharCode(input[0]);
	
	for (var i=1; i<input.length; i++) {
		var c = input[i];
		var ch = String.fromCharCode(c);
		
		if (phrase+ch in dict) { /* we already know this */
			phrase += ch;
			continue;
		}
		
		output.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
		code++;
		
		if (code == codeLimit && !o.fixedWidth) { /* increase width */
			codeLimit *= 2;
			bpc++;
			if (bpc <= o.maxBits) { output.setBitsPerCode(bpc); }
		}

		if (bpc <= o.maxBits) { dict[phrase+ch] = code; }
		phrase = ch;
	}
	
	output.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
	return (o.fixedWidth ? output : output.getData());
}

Compress.iLZW = function(input, options) {
	if (!input.length) { return []; }
	var o = {
		maxBits: 16,
		fixedWidth: false
	}
	for (var p in options) { o[p] = options[p]; }

	var dict = {};

	var bpc = 8;
	var code = 1 << bpc;
	var codeLimit = code;

	var data;
	if (o.fixedWidth) {
		data = new Array(input.length);
		for (var i=0;i<input.length;i++) { data[i] = input[i]; }
	} else {
		data = new Compress.Stream(input);
	}
	
	var lastChar = String.fromCharCode(data.shift());
	var oldPhrase = lastChar;
	var output = [lastChar.charCodeAt(0)];
	
	var phrase;
	var currCode;

	while (1) {
		if (code == codeLimit && !o.fixedWidth) {
			codeLimit *= 2;
			bpc++;
			if (bpc <= o.maxBits) { data.setBitsPerCode(bpc); }
		}

		currCode = data.shift();
		if (currCode === null) { break; }

		if (currCode < 256) {
			phrase = String.fromCharCode(currCode);
		} else {
			phrase = (currCode in dict ? dict[currCode] : (oldPhrase + lastChar));
		}
		
		for (var i=0;i<phrase.length;i++) { output.push(phrase.charCodeAt(i)); }
		lastChar = phrase.charAt(0);
		
		if (bpc <= o.maxBits) { 
			dict[code] = oldPhrase + lastChar; 
			code++;
		}
	
		if (o.fixedWidth && !data.length) { break; }
		oldPhrase = phrase;
	}

	return output;
}

Compress.RLE = function(input) {
	var output = [];
	if (!input.length) { return output; }

	var count = 1;
	var r = 0;
	for (var i=0; i<input.length-1; i++) {
		if (input[i] != input[i+1] || count == 255) {
			output.push(input[i]);
			output.push(count);
			count = 0;
		}
		count++;
	}
	
	output.push(input[i]);
	output.push(count);

	return output;
}

Compress.iRLE = function(input) {
	var output = [];
	if (!input.length) { return output; }
	if (input.length % 2) { throw new Error("Odd data length passed to iRLE"); }

	for (var i=0; i<input.length; i+=2) {
		var val = input[i];
		var count = input[i+1];
		for (var c=0; c<count; c++) { output.push(val); }
	}

	return output;
}

Compress.BWT = function(input, options) {
	var o = {
		mark: 0
	}
	for (var p in options) { o[p] = options[p]; }
	
	if (input.indexOf(o.mark) != -1) { throw new Error("Marker detected in input"); }
	var length = input.length;

	/* pointers */
	var indexes = [];
	for (var i=0;i<length;i++) { indexes.push(i); }
	
	var sortFunc = function(index1, index2) {
		var i1 = index1;
		var i2 = index2;
		var counter = 0
		
		while (counter < length) {
			var n1 = input[i1];
			var n2 = input[i2];
			if (n1 < n2) { return -1; }
			if (n1 > n2) { return 1; }
			i1++;
			i2++;
			if (i1 == length) { i1 = 0; }
			if (i2 == length) { i2 = 0; }
			counter++;
		}
	}
	
	indexes.sort(sortFunc);
	
	/* convert back to array of chars */
	var result = new Array(input.length);
	var I = -1;
	
	/* find the last column */
	for (var i=0;i<length;i++) {
		var index = indexes[i]; /* pointer to first character in current rotation */
		if (index == 0) { /* 0th rotation => original string, mark its index */
			I = i;
			index = length-1; /* take the last character of a rotation */
		} else {
			index--; /* take the last character of a rotation */
		}
		result[i] = input[index];
	}
	
	result.splice(I, 0, o.mark); /* insert mark at correct position */
	return result;
}

Compress.iBWT = function(input, options) {
	var o = {
		mark: 0
	}
	for (var p in options) { o[p] = options[p]; }
	
	var I = -1;
	var numbers = [];
	for (var i=0;i<input.length;i++) {
		var num = input[i];
		if (num == o.mark) {
			if (I != -1) { throw new Error("Multiple markers in input"); }
			I = i;
		} else {
			numbers.push(num);
		}
	}
	
	if (I == -1) { throw new Error("Marker not detected in input"); }
	var length = numbers.length;
	
	var P = new Array(length);
	var C = [];
	for (var i=0;i<256;i++) { C.push(0); }
	
	/**
	 * C - frequency table for all chars
	 * P - number of instances of C[numbers[i]] in [0..i-1]
	 */
	for (var i=0;i<length;i++) {
		var num = numbers[i];
		P[i] = (C[num]);
		C[num]++;
	}
	
	var sum = 0;
	for (var i=0;i<256;i++) {
		sum += C[i];
		C[i] = sum - C[i];
	}

	var i = I;
	var output = new Array(length);
	for (var j=length-1; j>=0; j--) {
		var num = numbers[i];
		output[j] = num;
		i = P[i] + C[num];
	}

	return output;
}

Compress.MTF = function(input, options) {
	var o = {
		inPlace: false
	}
	for (var p in options) { o[p] = options[p]; }

	var dict = [];
	for (var i=0;i<256;i++) { dict.push(i); }
	
	var output = (o.inPlace ? input : new Array(input.length));

	for (var i=0;i<input.length;i++) {
		var code = input[i];
		var index = dict.indexOf(code);
		output[i] = index;
		dict.splice(index, 1);
		dict.unshift(code);
	}
	
	return output;
}

Compress.iMTF = function(input, options) {
	var o = {
		inPlace: false
	}
	for (var p in options) { o[p] = options[p]; }
	
	var dict = [];
	for (var i=0;i<256;i++) { dict.push(i); }

	var output = (o.inPlace ? input : new Array(input.length));

	for (var i=0;i<input.length;i++) {
		var code = input[i];
		var val = dict[code];
		output[i] = val;
		dict.splice(code, 1);
		dict.unshift(val);
	}
	
	return output;
}

/**
 * @private
 */
Compress.Stream = function(data) {
	this._data = data || [];
	this._bpc = 8;
	this._bits = 0;
	this._tmp = 0;
	this._tmpIndex = 0;
	this._codes = 0;
}

/**
 * Add given code to stream using defined amount of bits.
 * The code *must* be representable in these bits.
 */
Compress.Stream.prototype.push = function(code) {
	var bit;
	this._codes++;
	
	for (var i=0;i<this._bpc;i++) {
		bit = code & (1 << i);
		if (bit) {
			this._tmp |= (1 << this._tmpIndex);
		} else {
			this._tmp &= ~(1 << this._tmpIndex);
		}
		
		this._tmpIndex = (this._tmpIndex+1) % 8; /* increase temporary index */
		if (!this._tmpIndex) { /* 8 bits done, add to output */
			this._data.push(this._tmp);
		}
	}

	this._bits += this._bpc;
}

Compress.Stream.prototype.setBitsPerCode = function(bpc) {
	this._bpc = bpc;
	return this;
}

Compress.Stream.prototype.getData = function() {
	if (this._tmpIndex) {
		this._data.push(this._tmp);
		this._tmpIndex = 0;
	}
	
	return this._data;
}

/**
 * Retrieve a code by reading defined amount of bits.
 * If there are not enough bits remaining, returns null.
 **/
Compress.Stream.prototype.shift = function() {
	var byteIndex;
	var bitIndex;
	var bit;
	
	for (var i=0;i<this._bpc;i++) {
		byteIndex = Math.floor(this._tmpIndex/8);
		if (byteIndex >= this._data.length) { return null; } /* not enough! */
		
		bitIndex = this._tmpIndex - 8*byteIndex;
		bit = this._data[byteIndex] & (1 << bitIndex);
		
		if (bit) {
			this._tmp |= (1 << i);
		} else {
			this._tmp &= ~(1 << i);
		}
		
		this._tmpIndex++;
	}
	return this._tmp;
}

