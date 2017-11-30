"use strict";

var io = require('socket.io');
var config = require('config');
var crypto = require('crypto');
var dbConfig = config.get('Global');
var socket = io.listen(22333);

var users_ids = [];
var users_sockets = [];
var rooms = [];
var s_online = [];
var u_online = [];

console.log("Server started");

socket.on('connection', function (socket) {

	socket.on("new_connection", function(data) {
		var ticket = null;

		var flag = false;
		var b64string = data;
		var buf = new Buffer(b64string, 'base64').toString('ascii');
		var currentUser = JSON.parse(buf);
		var checkString = createHash("sha256", dbConfig.SALT+currentUser.user_id)

		console.log("New user was connected!");
		
		if(currentUser.key == checkString)
		{
			/**
			 * User Connected
			 */	
			
			flag = true;

			console.log("User pass authorization!");

			if(currentUser.type == "user")
			{
				console.log("[USER] User was pushed to room with id = " + currentUser.ticket_id);

				if(currentUser.create != true)
				{
					socket.join(currentUser.ticket_id);	

					u_online.push(currentUser.user_id);
				}
			}

			if(currentUser.type == "support")
			{
				var user_id = currentUser.user_id;
				
				users_ids.push(user_id);
				users_sockets.push(socket.id);
				s_online.push(user_id);
				
			}		
			
			/**
			 * Socket handlers
			 */

			//Complete
			socket.on("join_to_room", function(room_id) {
				ticket = room_id;
				socket.join(room_id);

				rooms.push(ticket);
				rooms.unique();

				console.log("User was pushed to room with id = " + room_id);
			});

			//Complete
			socket.on("new_message_from_support", function(msg) {
				console.log("New message from support");

				if(ticket != null)
					socket.broadcast.to(ticket).emit("recived_message_from_support", msg);
			});

			//Complete
			socket.on("new_message_from_user", function(msg) {
				console.log("New message from user");
				var item = findElement(users_ids, currentUser.support);
				
				if(item != null)
				{	
					if(Array.isArray(item))
						for(var i = 0; i < item.length; i++)
						{
							if(users_sockets[item[i]] != null)
								socket.to(users_sockets[item[i]]).emit('recived_message_n', true);
						}

					var support_in_room = findElement(rooms, currentUser.support)

					if(support_in_room != null)
					{
						if(currentUser.ticket_id != null)
							socket.broadcast.to(currentUser.ticket_id).emit("recived_message_from_user", msg);
					}
				}
			});

			//Complete
			socket.on("delete_message", function(id) {
				console.log("Delete message " + id);

				socket.broadcast.to(ticket).emit("del_message", id);
			});

			//Complete
			socket.on("typing", function() {
				if(currentUser.type == "user")
					var support_in_room = findElement(rooms, currentUser.ticket_id);
				else
					var support_in_room = findElement(rooms, ticket);

				/**
				 * Support typing
				 */
				if(currentUser.type == "support" && support_in_room)
					socket.broadcast.to(ticket).emit("user_typing");

				/**
				 * User typing
				 */
				if(currentUser.type == "user" && support_in_room)
					socket.broadcast.to(currentUser.ticket_id).emit("user_typing");
			});

			//Complete
			socket.on("new_ticket", function(id, to) {
				console.log("New Ticket to " + to);
				var item = findElement(users_ids, to);
				
				if(item != null)
				{	
					if(Array.isArray(item))
						for(var i = 0; i < item.length; i++)
						{
							if(users_sockets[item[i]] != null)
								socket.to(users_sockets[item[i]]).emit('new_ticket_s', id, to);
						}
				}
				//socket.broadcast.to(currentUser.ticket_id).emit("new_ticket", id, to);
			});

			//Complete
			socket.on("close_ticket", function(id) {
				console.log("Close ticket " + id);
				var support_in_room = findElement(rooms, id);

				if(currentUser.type == "user" && support_in_room)
					socket.broadcast.to(currentUser.ticket_id).emit("close_ticket_to_support", id);
			});

			//Complete
			socket.on("disconnect", function() {
				if(currentUser.type == "support")
				{
					var item = findElement(users_sockets, socket.id);
					var room_item = findElement(rooms, ticket);

					users_ids.splice(item, 1);
					users_sockets.splice(item, 1);
					s_online.splice(item, 1);

					if(ticket != null)
						rooms.splice(room_item, 1);
				}

				if(currentUser.type == "user")
				{
					var item = findElement(u_online, currentUser.user_id);

					u_online.splice(item, 1);
				}
			});

			//Complete
			socket.on("give_me_users", function() {
				var online = [];

				online.push(s_online.unique());
				online.push(u_online.unique());

				this.emit("online", JSON.stringify(online));
			});		

			/**
			 * End handlers
			 */
		}
		else
		{
			console.log("WARNING! User tried connected, but key is invalid!");
		}
	});
});

Array.prototype.unique = function () {
    var a = [];
    var l = this.length;

    for (var i = 0; i < l; i++) {
        for (var j = i + 1; j < l; j++) {
            if (this[i] === this[j]) {
                j = ++i;
            }
        }
        a.push(this[i]);
    }

    return a;
};

function createHash(algorithm, string)
{
	var hashString = crypto.createHash(algorithm);
	hashString.update(string);

	return hashString.digest('hex');
}

function findElement(array, element)
{
	var items = [];
	for (var i = 0; i < array.length; i++)
	{
		if(array[i] == element)
			items.push(i);
	}

	if(items != null)
		return items;
	else
		return null;
}

