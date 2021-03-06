var _ = require("underscore");

/*
Base class for all triggers, contining shared implementation code.
Relevant options shared across all triggers:
delay = number - delay between when a _sendMessageAfterDelay is called to when it is actually sent to steam
probability = number - before any other checks occur, a random number generated between 0-1 must be smaller than this number
timeout = - after the trigger fires, it cannot be fired again until after this timout lapses
*/

var BaseTrigger = function(type, name, chatBot, options) {
	this.type = type;
	this.chatBot = chatBot;
	this.name = name;
	this.options = options || {};
	this.respectsMute = true;
	this.respectsFilters = true;
	this.allowMessageTriggerAfterResponse = false;
	this.replyEnabled = true;
	this.winston = chatBot.winston;
};

exports.BaseTrigger = BaseTrigger;
var type = "BaseTrigger";
exports.triggerType = type;
exports.create = function(name, chatBot, options) {
	return new BaseTrigger(type, name, chatBot, options);
};

// Public interface of all triggers

BaseTrigger.prototype.getOptions = function() {
	return _.clone(this.options);
}

// Returns true if the invite is accepted
BaseTrigger.prototype.onChatInvite = function(roomId, roomName, inviterId) {
	var that = this;
	if(that._checkUser(inviterId) && that._checkRoom(roomId) && that._checkIgnores(roomId,inviterId)) {
		try { return that._respondToChatInvite(roomId, roomName, inviterId); }
		catch(err) { that.winston.error(err.stack); return false; }
	}
}

// Returns true if the request is accepted
BaseTrigger.prototype.onFriendRequest = function(userId) {
	var that = this;
	try {
		return that._respondToFriendRequest(userId);
	} catch(err) { that.winston.error(err.stack); return false; }
}

// Return true if a message was sent
BaseTrigger.prototype.onFriendMessage = function(userId, message, haveSentMessage) {
	var that = this;
	if (this.replyEnabled && this._randomRoll() && this._checkMultiResponse(haveSentMessage) && this._checkUser(userId) && !this._checkIgnores(userId, null)) {
		try{
			var messageSent = that._respondToFriendMessage(userId, message);
			if (messageSent) {
				that._disableForTimeout();
			}
			return messageSent;
		} catch(err) {that.winston.error(err.stack); return false;}
	}
	return false;
}

// Return true if we've seen the message but don't want any other plugins to see it.
BaseTrigger.prototype.onSentMessage = function(toId, message, haveSentMessage) {
	var that=this;
	try{ 
		var messageSeen = that._respondToSentMessage(toId, message);
		if (messageSeen) {
			return true;
		}
		return messageSeen;
	} catch(err) {that.winston.error(err.stack); return false;}
	return false;
}

// Return true if a message was sent
BaseTrigger.prototype.onChatMessage = function(roomId, chatterId, message, haveSentMessage, muted) {
	var that=this;
	if (that.replyEnabled && that._randomRoll() && that._checkMultiResponse(haveSentMessage) && that._checkMute(muted) && that._checkUser(chatterId) && that._checkRoom(roomId) && !that._checkIgnores(chatterId,roomId)) {
		try{ 
			var messageSent = that._respondToChatMessage(roomId, chatterId, message);
			if (messageSent) {
				that._disableForTimeout();
			}
			return messageSent;
		} catch(err) {that.winston.error(err.stack); return false;}
	}
	return false;
}

// Return true if a message was sent
BaseTrigger.prototype.onEnteredChat = function(roomId, userId, haveSentMessage, muted) {
	var that=this;
	if (that.replyEnabled && that._randomRoll() && that._checkMultiResponse(haveSentMessage) && that._checkMute(muted) && that._checkRoom(roomId) && !that._checkIgnores(userId,roomId)) {
		try{
			var messageSent = that._respondToEnteredMessage(roomId, userId);
			if (messageSent) {
				that._disableForTimeout();
			}
			return messageSent;
		} catch(err) {that.winston.error(err.stack); return false;}
	}
	return false;
}

// Return true if a message was sent
BaseTrigger.prototype.onKickedChat = function(roomId, kickedId, kickerId, haveSentMessage, muted) {
	var that=this;
	if (that.replyEnabled && that._randomRoll() && that._checkMultiResponse(haveSentMessage) && that._checkMute(muted) && that._checkRoom(roomId)) {
		try{
			var messageSent = that._respondToKick(roomId, kickedId, kickerId);
			if (messageSent) {
				that._disableForTimeout();
			}
			return messageSent;
		} catch(err) {that.winston.error(err.stack); return false;}
	}
	return false;
}

BaseTrigger.prototype.onBannedChat = function(roomId, bannedId, bannerId, haveSentMessage, muted) {
	var that=this;
	if (that.replyEnabled && that._randomRoll() && that._checkMultiResponse(haveSentMessage) && that._checkMute(muted) && that._checkRoom(roomId)) {
		try{
			var messageSent = that._respondToBan(roomId,bannedId,bannerId);
			if (messageSent) {
				that._disableForTimeout();
			}
			return messageSent;
		} catch(err) {that.winston.error(err.stack); return false;}
	}
	return false;
}

// Return true if a message was sent
BaseTrigger.prototype.onDisconnected = function(roomId, userId, haveSentMessage, muted) {
	var that=this;
	if (that.replyEnabled && that._randomRoll() && that._checkMultiResponse(haveSentMessage) && that._checkMute(muted) && that._checkRoom(roomId) && !that._checkIgnores(userId,roomId)) {
		try{
			var messageSent = that._respondToDisconnect(roomId, userId);
			if (messageSent) {
				that._disableForTimeout();
			}
			return messageSent;
		} catch(err) {that.winston.error(err.stack); return false;}
	}
	return false;
}

// Return true if a message was sent
BaseTrigger.prototype.onLeftChat = function(roomId, userId, muted) {
	var that = this;
	if (that.replyEnabled && that._randomRoll() && that._checkMute(muted) && that._checkUser(userId) && that._checkRoom(roomId) && !that._checkIgnores(roomId,userId)) {
		try{
			var messageSent = that._respondToLeftMessage(roomId, userId);
			if (messageSent) {
				that._disableForTimeout();
			}
			return messageSent;
		} catch(err) {that.winston.error(err.stack); return false;}
	}
	return false;
}

// Subclasses should override the relevant functions below

// Returns true if the invite is accepted
BaseTrigger.prototype._respondToChatInvite = function(roomId, roomName, inviterId) {
	return false;
}

// Returns true if the request is accepted
BaseTrigger.prototype._respondToFriendRequest = function(userId) {
	return false;
}

// Return true if a message was sent
BaseTrigger.prototype._respondToFriendMessage = function(userId, message) {
	return false;
}

// Return true if a sent message has been used and shouldn't be seen again.
BaseTrigger.prototype._respondToSentMessage = function(toId, message) {
	return false;
}

// Return true if a message was sent
BaseTrigger.prototype._respondToChatMessage = function(roomId, chatterId, message) {
	return false;
}

// Return true if the event was eaten
BaseTrigger.prototype._respondToEnteredMessage = function(roomId,userId) {
	return false;
}

// Return true if the event was eaten
BaseTrigger.prototype._respondToBan = function(roomId,bannedId,bannerId) {
	return false;
}

// Return true if the event was eaten
BaseTrigger.prototype._respondToDisconnect = function(roomId,userId) {
	return false;
}

// Return true if the event was eaten
BaseTrigger.prototype._respondToLeftMessage = function(roomId, userId) {
	return false;
}

// Return true if the event was eaten
BaseTrigger.prototype._respondToKick = function(roomId,kickedId,kickerId) {
	return false;
}

// Helper functions

BaseTrigger.prototype._checkMute = function(muted) {
	return !muted || !this.respectsMute;
}

BaseTrigger.prototype._checkMultiResponse = function(haveSentMessage) {
	return !haveSentMessage || this.allowMessageTriggerAfterResponse;
}

BaseTrigger.prototype._randomRoll = function() {
	if (this.options.probability) {
		var random = Math.random();
		if (random > this.options.probability) {
			return false;
		}
	}

	return true;
}

BaseTrigger.prototype._sendMessageAfterDelay = function(steamId, message) {
	var that = this;
	if (this.options.delay) {
		this.winston.debug({"trigger":this.name,"type":this.type,"target: ":steamId,"message":message, "delay":this.options.delay});
		setTimeout(function () { that.chatBot.sendMessage(steamId, message) }, this.options.delay);
	}
	else {
		this.chatBot.sendMessage(steamId, message);
	}
}

BaseTrigger.prototype._disableForTimeout = function() {
	if (this.options.timeout) {
		this.replyEnabled = false;
		var that = this;
		setTimeout(function() { that.replyEnabled = true }, this.options.timeout);
	}
}

// Check if this user/room is blacklisted for this command
BaseTrigger.prototype._checkIgnores = function(toId, fromId) {
	if(this.respectsFilters) {
		if (!this.options.ignore || this.options.ignore.length === 0) {
			return false;
		}
		for (var i=0; i < this.options.ignore.length; i++) {
			var ignored = this.options.ignore[i];
			if (toId === ignored || fromId === ignored) {
				return true;
			}
		}

		return false;
	}
	return false;
}

// Check for a specific room
BaseTrigger.prototype._checkRoom = function(toId) {
	if(this.respectsFilters) {
		if (!this.options.rooms || this.options.rooms.length === 0) {
			return true;
		}
		for (var i=0; i < this.options.rooms.length; i++) {
			var room = this.options.rooms[i];
			if (toId === room) {
				return true;
			}
		}

		return false;
	}
	return true;
}

// Check for a specific user
BaseTrigger.prototype._checkUser = function(fromId) {
	if(this.respectsFilters) {
		if (!this.options.users || this.options.users.length === 0) {
			return true;
		}

		for (var i=0; i < this.options.users.length; i++) {
			var user = this.options.users[i];
			if (fromId === user) {
				return true;
			}
		}

		return false;
	}
	return true;
}

/*
Skeleton for new triggers
-------------------------
var util = require("util");
var BaseTrigger = require("./baseTrigger.js").BaseTrigger;

var NewTrigger = function() {
	NewTrigger.super_.apply(this, arguments);
};

util.inherits(NewTrigger, BaseTrigger);

var type = "NewTrigger";
exports.triggerType = type;
exports.create = function(name, chatBot, options) {
	var trigger = new NewTrigger(type, name, chatBot, options);

	trigger.respectsMute = true;
	trigger.respectsFilters = true;
	// Other initializers

	return trigger;
};

NewTrigger.prototype._respondToChatMessage = function(roomId, chatterId, message) {
	// etc
	return false;
}

// Other overrides/functions
*/
