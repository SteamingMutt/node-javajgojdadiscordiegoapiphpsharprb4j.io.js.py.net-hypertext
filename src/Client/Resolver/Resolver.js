"use strict";
/* global Buffer */

import fs from "fs";
import request from "superagent";

import User from "../../Structures/User";
import Channel from "../../Structures/Channel";
import TextChannel from "../../Structures/TextChannel";
import VoiceChannel from "../../Structures/VoiceChannel";
import ServerChannel from "../../Structures/ServerChannel";
import PMChannel from "../../Structures/PMChannel";
import Role from "../../Structures/Role";
import Server from "../../Structures/Server";
import Message from "../../Structures/Message";
import Invite from "../../Structures/Invite";

export default class Resolver {
	constructor(internal) {
		this.internal = internal;
	}

	resolveToBase64(resource) {
		if (resource instanceof Buffer) {
			resource = resource.toString("base64");
			resource = "data:image/jpg;base64," + resource;
		}
		return resource;
	}

	resolveInviteID(resource) {
		if (resource instanceof Invite) {
			return resource.id;
		}
		if (typeof resource === "string" || resource instanceof String) {
			if (resource.indexOf("http") === 0) {
				var split = resource.split("/");
				return split.pop();
			}
			return resource;
		}
		return null;
	}

	resolveServer(resource) {
		if (resource instanceof Server) {
			return resource;
		}
		if (resource instanceof ServerChannel) {
			return resource.server;
		}
		if (resource instanceof String || typeof resource === "string") {
			return this.internal.servers.get("id", resource);
		}
		if (resource instanceof Message) {
			if (resource.channel instanceof TextChannel) {
				return resource.server;
			}
		}
		return null;
	}

	resolveRole(resource) {
		if (resource instanceof Role) {
			return resource;
		}
		if (resource instanceof String || typeof resource === "string") {
			var role = null;
			for (var server of this.internal.servers) {
				if (role = server.roles.find(r => r.id == resource)) {
					return role;
				}
			}
		}
		return null;
	}

	resolveFile(resource) {
		if (typeof resource === "string" || resource instanceof String) {
			if (/^https?:\/\//.test(resource)) {
				return new Promise((resolve, reject) => {
					request.get(resource).end((err, res) => {
						if (err) {
							reject(err);
						} else if (res.text === undefined) {
							resolve(res.body);
						} else {
							resolve(new Buffer(res.text));
						}
					});
				});
			} else {
				return Promise.resolve(resource);
			}
		}
		return Promise.resolve(resource);
	}

	resolveMentions(resource) {
		// resource is a string
		var _mentions = [];
		var changed = resource;
		for (var mention of (resource.match(/<@[0-9]+>/g) || [])) {
			var userID = mention.substring(2, mention.length - 1);
			var user = this.internal.client.users.get("id", userID);
			if (user) {
				_mentions.push(user);
				changed = changed.replace(new RegExp(mention, "g"), `@${user.username}`);
			}
		}
		return [_mentions, changed];
	}

	resolveString(resource) {

		// accepts Array, Channel, Server, User, Message, String and anything
		// toString()-able

		var final = resource;
		if (resource instanceof Array) {
			final = resource.join("\n");
		}

		return final.toString();
	}

	resolveUser(resource) {
		/*
			accepts a Message, Channel, Server, String ID, User, PMChannel
		*/
		if (resource instanceof User) {
			return resource;
		}
		if (resource instanceof Message) {
			return resource.author;
		}
		if (resource instanceof TextChannel) {
			var lmsg = resource.lastMessage;
			if (lmsg) {
				return lmsg.author;
			}
		}
		if (resource instanceof Server) {
			return resource.owner;
		}
		if (resource instanceof PMChannel) {
			return resource.recipient;
		}
		if (resource instanceof String || typeof resource === "string") {
			return this.internal.users.get("id", resource);
		}

		return null;
	}

	resolveMessage(resource) {
		// accepts a Message, PMChannel & TextChannel

		if (resource instanceof TextChannel || resource instanceof PMChannel) {
			return resource.lastMessage;
		}
		if (resource instanceof Message) {
			return resource;
		}

		return null;
	}

	resolveVoiceChannel(resource) {
		// resolveChannel will also work but this is more apt
		if (resource instanceof VoiceChannel) {
			return resource;
		}
		return null;
	}

	resolveChannel(resource) {
		/*
			accepts a Message, Channel, Server, String ID, User
		*/

		if (resource instanceof Message) {
			return Promise.resolve(resource.channel);
		}
		if (resource instanceof Channel) {
			return Promise.resolve(resource);
		}
		if (resource instanceof Server) {
			return Promise.resolve(resource.channels.get("id", resource.id));
		}
		if (resource instanceof String || typeof resource === "string") {
			return Promise.resolve(this.internal.channels.get("id", resource));
		}
		if (resource instanceof User) {
			// see if a PM exists
			var chatFound = false;
			for (var pmchat of this.internal.private_channels) {
				if (pmchat.recipient.equals(resource)) {
					chatFound = pmchat;
					break;
				}
			}

			if (chatFound) {
				// a PM already exists!
				return Promise.resolve(chatFound);
			}
			// PM does not exist :\
			return this.internal.startPM(resource);
		}
		var error = new Error("Could not resolve channel");
		error.resource = resource;
		return Promise.reject(error);
	}
}
