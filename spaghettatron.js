/* Dependencies */
const Discord = require('discord.js')
const fs = require('fs')
const timers = require('timers')
const uuid = require('uuid/v1')
const download = require('download-file')

/* Imports */
const util = require('./util')

/* Configs */
const auth = require('./auth.json')
const config = require ('./config.json')
const events = require('./events.json')

/* Create Spaghettatron */
let Spaghettatron = new Discord.Client();
Spaghettatron.login(auth.token);

/* Custom Messages */
var messages, responses, searches, subreddits, requests, activities, commands, edits;

/* When Spaghettatron is ready */
Spaghettatron.on('ready', function() {

	init();
	console.log('Ready!');
	Spaghettatron.user.setActivity(util.select(activities.activities));
});

/* When a message has been sent */
Spaghettatron.on('message', function(message) {

	/* Spaghettatron will ignore his own messages */
	if(message.author == Spaghettatron.user) {
		return;
	}

	/* Log the message before it's manipulated */
	log(message);

	/* Content variable to use and manipulate */
	var content = message.content;

	/* Date */
	var date = message.createdAt;

	/* 
	*  Replies:
	*  Respond to messages that don't have the prefix but start with something Spaghettatron recognizes
	*/
	for(var key in responses) {

		if(content.toLowerCase().startsWith(key)) {
			message.channel.send(util.select(responses[key]).format(message.author));
			break;
		}
	}

	/*
	*  Replacers:
	*  Replaces words (filter)
	*/
	for(var key in edits.replace) {

		if(content.toLowerCase().includes(key)) {

			var replace = content.replace(key, util.select(edits.replace[key])) + '\n' + '-' + message.author.username;
			message.delete()
			.then(message.channel.send(replace))
			.catch(console.error);
			break;
		}
	}

	/*
	*  Commands:
	*  Check to see if the message starts with the prefix defined in config.json
	*/
	if(content.startsWith(config.prefix)) {

		/* Remove the prefix from "content" */
		content = content.substring(config.prefix.length);

		/* Get arguments with or without quotes from a string as an array */
		var args = content.match(/[^\s"]+|"([^"]*)"/g);

		/* Remove quotes from args with spaces */
		args.forEach(function(item, index, array) {
			if(item.startsWith('"') && item.includes(' ')) {
				args[index] = item.slice(1,-1);
			}
		});

		/*
		*  Make "command" the first argument, remove it from the real arguments
		*  This is used for general organization
		*/
		var command = args[0];
		args.shift();

		/* Create a simpler command object to parse */
		var cmd = { 
			command: command,
			args: args,
			channel: message.channel,
			sender: message.author
		}

		/* Execute the command and get the reply */
		var reply = execute(cmd);

		/* If there even was a reply */
		if(reply) {

			/* If the bot should @ the sender */
			if(reply.at) {
				message.reply(reply.message);
			} else {
				if(reply.message) {
					message.channel.send(reply.message);
				}
			}

			/* If the sender epic failed at trying to perform a command */
			if(reply.fail) {
				message.reply(util.select(messages.fail));
			}

			/* If the sender's message should be deleted */
			if(reply.removeSent) {
				message.delete();
			}

			/* Delete the message after how long */
			if(reply.deleteAfter >= 0) {
				message.delete(reply.deleteAfter);
			}

			if(reply.reactions) {
				for(var i = 0; i < reply.reactions.length; i++) {
					var addReaction = function() {message.react(reply.reactions[i])};
					setTimeout(addReaction, 500);
				}
			}
		}
	}
});

/* When a message has been deleted */
Spaghettatron.on('messageDelete', function(message) {
	if(!message.content.startsWith(config.prefix)) {
		unlog(message);
	}
});

/*
*  Handle Commands
*  Making it a seperate function to be used recursively or something
*/
function execute(cmd)
{
	/* Setup essential variables */
	var command = cmd.command;
	var args = cmd.args;
	var sender = cmd.sender;

	/* Default Response */
	var response = {
		at: false,
		message: util.select(messages.what),
		fail: false,
		removeSent: false,
		deleteAfter: -1,
		reactions: []
	}

	/* Roll */
	if(command.equalsIgnoreCase('roll') || command.equalsIgnoreCase('pick')) {

		/* Default values */
		var min = 1;
		var max = 10;

		/* If there is an argument */
		if(args.length >= 1) {

			/* If the first argument is a number */
			if(!isNaN(args[0])) {

				/* If the second argument is a number */
				if(args[1] && !isNaN(args[1])) {
					min = args[0];
					max = args[1];
				} else {
					max = args[0];
				}
			} else {

				/* If the first argument is "who" */
				if (args[0].equalsIgnoreCase('who')) {

					/* If the channel has enough members */
					if(cmd.channel && cmd.channel.members && cmd.channel.members.size > 1) {

						if(args.includes('-notme') || Math.random() >= 1.0 / cmd.channel.members.size) {
							response.message = util.select(commands.roll.responses.person.other).format(cmd.channel.members.random().displayName);
						} else {
							response.message = util.select(commands.roll.responses.person.self);
						}

					} else {
						response.message = util.select(commands.roll.responses.person.self);
					}
				}

				/* Handle yes/no questions */
				else if(commands.roll.yes_no.includes(args[0].toLowerCase())) {

					var options = [commands.roll.responses.yes, commands.roll.responses.no];
					if(!args.includes('-maybe')) options.push(commands.roll.responses.maybe)

						response.message = util.select(util.select(options));
				}

				else {
					if(args.length === 1) {
						response.message = util.select(commands.roll.responses.one).format(args[0]);
					} else {
						response.message = util.select(commands.roll.responses.misc).format(util.select(args));
					}
				}

				return response;
			}
		}

		response.message = util.select(commands.roll.responses.numeric).format(util.random(min, max));
	}

	/* Reload JSON */
	else if(command.equalsIgnoreCase('reload')) {
		response.message = util.select(commands.reload.responses);
		response.removeSent = true;
		response.deleteAfter = 3000;
		loadJSON();
	}

	/* Requests Info */
	else if(command.equalsIgnoreCase('requests')) {

		/* No arguments */
		if(args.length === 0) {

			var list = '';
			for(var i = 0; i < requests.length; i++) {
				list += '`!' + requests[i].name + '` *' + requests[i].messages.length + ' messages*\n';
			}
			response.message = list;
		}

		/* 1 argument */
		else if(args.length === 1) {

			var list= '';

			key:
			for(var i = 0; i < requests.length; i++) {

				if(args[0].equalsIgnoreCase(requests[i].name)) {

					item:
					for(var j = 0; j < requests[i].messages.length; j++) {

						var max = 15;

						if(j <= max) {
							list += '`' + requests[i].messages[j] + '`\n\n';
						} else {
							list += '*and ' + (requests[i].messages.length - max) + ' more...*';
							break item;
						}
					}
					response.message = list;
				}
			}
		}

		/* More than 1 argument */
		else {
			response.message = util.select(messages.fail);
		}
	}

	/* Weather */
	else if(command.equalsIgnoreCase('weather')) {

		/* Default is 1-day weather data */
		var days = 1;

		/* Load weather.json for all of the users */
		var file = util.resolvePath(config.weather_dir + '/weather.json');
		var contents = fs.readFileSync(file);
		var data = JSON.parse(contents);
		var userData = {};

		/* Get the object for the user data if applicable */
		for(var obj in data) {
			if(data[obj].id == sender.id) {
				userData = data[obj];
			}
		}

		var metric = userData.metric;

		/* Create a new object for the user */
		if(!data.includes(userData)) {
			data.push(userData);
		}

		/* Add to the new object */
		if(!userData.id) {
			userData.id = sender.id;
		}

		/* Handle "now" weather conditions if the location is set */
		if(args.length === 0) {

			if(userData.location) {
				response.message = undefined;
				sendWeatherNow(userData.location, metric, cmd.channel);
			} else {
				response.message = util.select(commands.weather.responses.no_location);
			}
		}

		/* Send weather either for a certain number of days or for a specified location (1 day) */
		else if(args.length === 1) {

			/* If location is set and "now" weather is requested */
			if(args[0].equalsIgnoreCase('now')) {
				if(userData.location) {
					response.message = undefined;
					sendWeatherNow(userData.location, metric, cmd.channel);
				} else {
					response.message = util.select(commands.weather.responses.no_location);
				}
			}

			/* If location is set, and the argument is a number, display weather for that many days */
			else if(!isNaN(args[0])) {

				if(userData.location) {
					response.message = undefined;
					sendWeather(args[0], userData.location, metric, cmd.channel);
				} else {
					response.message = util.select(commands.weather.responses.no_location);
				}
			}

			/* Send a 1 day weather report for specified location */
			else {
				response.message = undefined;
				sendWeatherSlow(days, args[0], metric, cmd.channel);
			}
		}

		/* Handle 2 arguments */
		else if(args.length === 2) {

			/* Save location */
			if(args[0].equalsIgnoreCase('location')) {

				var url = 'http://dataservice.accuweather.com/locations/v1/cities/search?apikey={0}&q={1}'.format(auth.accu_weather_api_key, args[1]);

				response.message = undefined;
				response.removeSent = true;
				util.requestJSON(url, 'Spaghettatron')
				.then(function(obj) {

					/* Save to json */
					userData.location = obj[0].Key;
					util.write(JSON.stringify(data), file);

					/* Send message */
					cmd.channel.send(util.select(commands.weather.responses.location_set));
				})
				.catch(console.error);
			}

			/* Save metic preference */
			else if(args[0].equalsIgnoreCase('unit')) {

				if(args[1].charAt(0).equalsIgnoreCase('c') || args[1].charAt(0).equalsIgnoreCase('f')) {

					userData.metric = args[1].charAt(0).equalsIgnoreCase('c');
					util.write(JSON.stringify(data), file);

					response.message = util.select(commands.weather.responses.unit_set).format(args[1].toUpperCase());
				} else {
					response.message = util.select(messages.fail);
				}
			}

			/* Show "now" weather for a location */
			else if(args[0].equalsIgnoreCase('now')) {
				response.message = undefined;
				sendWeatherNowSlow(args[0], metric, cmd.channel);
			}

			/* Show specific location weather */
			else if(isNaN(args[0]) && !isNaN(args[1])) {

				location = args[0];
				days = args[1];

				response.message = undefined;
				sendWeatherSlow(days, location, metric, cmd.channel);
			}

			else {
				response.message = util.select(messages.fail);
			}
		}
	}

	/* Poll Command */
	else if(command.equalsIgnoreCase('poll')) {

		if(args.length == 0) {
			response.message = util.select(messages.fail);
		}

		else {

			var title = 'Yes or no?';
			if(args.includes('-t')) title = args[args.indexOf('-t') + 1];

			var prompt = args.join(' ');
			if(args.includes('-p')) prompt = args[args.indexOf('-p') + 1];

			var options = ['Yes', 'No'];
			if(args.includes('-o')) {
				options = args[args.indexOf('-o') + 1].split(',').map(function(item) {
					return item.trim();
				});
			}

			var reacts = [':thumbsup:', ':thumbsdown:'];
			if(args.includes('-r')) {
				reacts = args[args.indexOf('-r') + 1].split(',').map(function(item) {
					return item.trim();
				});
			}

			var message = '**' + title + '**\n' + prompt;
			for(var i = 0; i < options.length; i++) {
				message += '\n' + options[i] + ' ' + reacts[i];
			}

			response.message = message;
			response.reactions = reacts;

			response.removeSent = true;
		}
	}

	/* Help command */
	else if(command.equalsIgnoreCase('help')) {

		/* Display all help */
		if(args.length === 0) {

			response.message = undefined;

			for(var key in commands) {
				cmd.channel.send(getHelp(key));
			}
		}

		/* Display help for specified command */
		else if(args.length === 1) {

			if(commands[args[0].toLowerCase()]) {
				response.message = undefined;
				cmd.channel.send(getHelp(args[0].toLowerCase()));
			} else {
				response.message = util.select(commands.help.responses.non_command).format(args[0]);
			}
		}
	}

	/* Test command */
	else if(command.equalsIgnoreCase('addsub')) {
		if(args.length >= 2) {

			var name = args[0];
			var url = args[1];
			var subreddit = {name: args[0], url: args[1]};

			if(args.length == 3){

				if(!isNaN(args[2])) {
					subreddit.limit = parseInt(args[2]);
				}
			}

			subreddits.push(subreddit);
			util.write(JSON.stringify(subreddits), './strings/subreddits.json');
		} else {
			response.message = util.select(messages.fail);
		}
	}

	/* Test command */
	else if(command.equalsIgnoreCase('test')) {
		response.message = 'test';
	}

	/* Handle other */
	else {

		/* Searches */
		for(var i = 0; i < searches.length; i++) {
			if(command.equalsIgnoreCase(searches[i].name)) {
				response.message = searches[i].url + args.join('%20');
				return response;
			}
		}

		/* Subreddits */
		for(var i = 0; i < subreddits.length; i++) {

			if(command.equalsIgnoreCase(subreddits[i].name)) {

				var subreddit = subreddits[i];

				if(!subreddit.shown) {
					subreddit.shown = [];
				}

				if(subreddit.limit == undefined || subreddit.limit > 0) {

					util.requestJSON(subreddit.url + '.json', 'Spaghettatron')
					.then(function(obj) {

						var posts = obj.data.children;
						var imagePosts = [];

						for(var j = 0; j < posts.length; j++) {

							if((posts[j].data && posts[j].data.url && isPicture(posts[j].data.url))) {
								imagePosts.push(posts[j]);
							}
						}

						if(subreddit.shown.length >= imagePosts.length) {
							subreddit.shown = [];
						}

						var k = 0;

						do {
							k = Math.floor(Math.random() * imagePosts.length);
						} while(subreddit.shown.includes(k))

						function isPicture(url) {
							return url.startsWith('https://imgur.com') || url.endsWith('.jpg') || url.endsWith('.png') || url.endsWith('.gif');
						}

						if(subreddit.limit > 0) {
							subreddit.limit--;
						}

						subreddit.shown.push[k];

						cmd.channel.send(posts[k].data.url);
					})
					.catch(console.error);

					response.message = null;
					return response;
				}
			} else {
				response.message = util.select(commands.subreddit.responses.limit_reached);
				return response;
			}
		}

		/* Requests */
		for(var i = 0; i < requests.length; i++) {

			if(command.equalsIgnoreCase(requests[i].name)) {

				response.message = util.select(requests[i].messages);
				response.removeSent = true;

				if(args.length === 1) {

					var index = args[0];

					if(isNaN(index)) {
						var items = [];
						for(var i = 0; i < requests[i].messages.length; i++) {

							var item = requests[i].messages[i];

							if(item.toUpperCase().includes(index.toUpperCase())) {
								items.push(item);
							}
						}
						if(items.length > 0) {
							response.message = (util.select(items));
						}
					} else {
						if(!isNaN(index)) {
							response.message = requests[i].messages[index];
						}
					}
				}
				return response;
			}
		}
	}

	return response;
}

/* Logging a chat message */
function log(message) {

	/* Create a logged message */
	var logged = toLoggedMessage(message);

	/* Save to the text log */
	util.addLine(logged.line + '\n', logged.dir + '/' + logged.file);
}

/* Un-log a chat message (delete from text log, but add to deleted log) */
function unlog(message) {

	/* Get the logged message */
	var logged = toLoggedMessage(message);

	/* Remove line from text log */
	util.removeLine(logged.line, logged.dir + '/' + logged.file);

	var dir = logged.dir + '/deleted/';

	/* Save to the deleted log */
	util.addLine(logged.line + '\n', dir + logged.file);
}

/* Create logged message object */
function toLoggedMessage(message) {

	var date = message.createdAt;
	var attachments = [];
	var content = message.content;

	/* If the message contained attachments, download them, store them, and log their names */
	if(message.attachments && message.attachments.size > 0) {

		Array.from(message.attachments.values()).forEach(function(item) {

			attachments.push(item.filename);

			var file = item.filename;
			var extension = item.filename.substring(item.filename.indexOf('.'));
			var dir = util.resolvePath(config.logs_dir + '/attachments/' + util.getMonthName(date));

			if(extension.match(/.(jp(e)?g|png|gif)/g)) {
				dir += '/images';
			} else if(extension.match(/.(mp4|avi)/g)) {
				dir += '/videos';
			} else {
				dir += '/misc';
			}

			var options = {
				directory: dir,
				filename: item.filename + '-' + uuid() + extension
			};

			download(item.url, options, function(err){
				if (err) {
					console.log(err);
				}
			});
		});
		content += '[' + attachments + ']';
	}

	/* Format the line */
	var line = config.log_format
	.replace('hh', date.getHours())
	.replace('mm', date.getMinutes())
	.replace('ss', date.getSeconds())
	.replace('\{username\}', message.author.username)
	.replace('\{message\}', content);

	/* Format the directory */
	dir = config.logs_dir + '/' + config.logs_structure
	.replace('MM', util.getMonthName(date))
	.replace('mm', date.getMonth + 1)
	.replace('dd', date.getDate())
	.replace('yyyy', date.getFullYear());

	var obj = {
		line: line,
		attachments: attachments,
		dir: dir,
		file: message.channel.name + '.log'
	}

	return obj;
}

/* Load all JSON files */
function loadJSON() {

	var contents;

	contents = fs.readFileSync('./strings/messages.json');
	messages = JSON.parse(contents);

	contents = fs.readFileSync('./strings/responses.json');
	responses = JSON.parse(contents);

	contents = fs.readFileSync('./strings/searches.json');
	searches = JSON.parse(contents);

	contents = fs.readFileSync('./strings/subreddits.json');
	subreddits = JSON.parse(contents);

	contents = fs.readFileSync('./strings/requests.json');
	requests = JSON.parse(contents);

	contents = fs.readFileSync('./strings/activities.json');
	activities = JSON.parse(contents);

	contents = fs.readFileSync('./strings/commands.json');
	commands = JSON.parse(contents);

	contents = fs.readFileSync('./strings/edits.json');
	edits = JSON.parse(contents);
}

/* Init functions */
function init() {

	/* Load the json into their object counterparts */
	loadJSON();

	/* Create files if they don't exist */
	var weather = util.resolvePath(config.weather_dir + '/weather.json');

	if (!fs.existsSync(weather)) {
		util.write('[]', weather);
	}

	/* Special Days */
	var date = new Date(Date.now());

	var channel = Spaghettatron.channels.get(config.channel);

	if(channel) {

		for(var i in events.dates) {

			var obj = events.dates[i];

			var event = function() {
				sendMessage(util.select(requests[select(obj.requests)]));
			};

			if(date.getMonth() + 1 == obj.month && date.getDate() == obj.day) {
				if(obj.repeat === true) {
					timers.setInterval(event, obj.delay);
				} else {
					timers.setTimeout(event, obj.delay);
				}
			}
		}
	}
}

/* Send a message to the preferred channel defined in config.json */
function sendMessage(message) {
	Spaghettatron.channels.get(config.channel).send(message);
}

/* Send weather data to specified channel */
function sendWeather(days, id, metric, channel) {

	var getDays = 1;
	if(days > 1 && days <= 5) getDays = 5;
	else if(days > 5 && days <= 10) getDays = 10;
	else if(days > 10) getDays = 15;

	var url = 'http://dataservice.accuweather.com/forecasts/v1/daily/{0}day/{1}?apikey={2}'.format(getDays, id, auth.accu_weather_api_key);

	if(metric) {
		url += '&metric=true';
	}

	util.requestJSON(url, 'Spaghettatron')
	.then(function(obj) {

		var embed = new Discord.RichEmbed()

		.setThumbnail('https://docs.typo3.org/typo3cms/extensions/arx_accuweather/_images/Icon_AccuWeather.png')
		.setColor(0xEF5414)
		.setFooter(obj.Headline.Text)

		for(var i = 0; i < days; i++) {

			var forecast = obj.DailyForecasts[i];
			var date = new Date(forecast.Date);

			var content = '';

			for(var index in commands.weather.display) {

				if(!isNaN(index)) {

					var line = commands.weather.display[index];

					content += line
					.replace('\{min_value\}', forecast.Temperature.Minimum.Value)
					.replace('\{max_value\}', forecast.Temperature.Maximum.Value)
					.replace('\{day\}', forecast.Day.IconPhrase)
					.replace('\{night\}', forecast.Night.IconPhrase)
					.replace('\{unit\}', forecast.Temperature.Maximum.Unit)
					+ '\n';
				}
			}

			embed.addField(days == 1 ? 'Today' : util.getDayName(date), content);
		}

		channel.send(embed);
	})
	.catch(console.error);
}

/* Send weather data from a city string */
function sendWeatherSlow(days, location, metric, channel) {

	/* Set up URL */
	var url = 'http://dataservice.accuweather.com/locations/v1/cities/search?apikey={0}&q={1}'.format(auth.accu_weather_api_key, location);

	/* Get the ID */
	util.requestJSON(url, 'Spaghettatron')
	.then(function(obj) {

		/* Send weather info on gotten ID */
		sendWeather(days, obj[0].Key, metric, channel);
	})
	.catch(console.error);
}

/* Send current weather data */
function sendWeatherNow(id, metric, channel) {

	/* Set up URL */
	var url = 'http://dataservice.accuweather.com/currentconditions/v1/{0}?apikey={1}'.format(id, auth.accu_weather_api_key);

	util.requestJSON(url, 'Spaghettatron')
	.then(function(obj) {

		var object = obj[0];

		var icon = object.WeatherIcon < 10 ? '0' + object.WeatherIcon : object.WeatherIcon;

		var embed = new Discord.RichEmbed()

		.setThumbnail('https://developer.accuweather.com/sites/default/files/{0}-s.png'.format(icon))
		.setColor(object.IsDayTime ? 0xFFD033 : 0x2C4555)
		.setFooter(object.WeatherText)

		var temperature = object.Temperature;
		var date = new Date(object.LocalObservationDateTime);

		var content = '';

		for(var index in commands.weather.display_now) {

			if(!isNaN(index)) {

				var line = commands.weather.display_now[index];

				content += line
				.replace('\{value\}', metric ? temperature.Metric.Value : temperature.Imperial.Value)
				.replace('\{unit\}', metric ? temperature.Metric.Unit : temperature.Imperial.Unit)
				;
			}
		}

		embed.addField('Current Weather Conditions', content);

		channel.send(embed);
	});
}

/* Send now weather data from a city string */
function sendWeatherNowSlow(location, metric, channel) {

	/* Set up URL */
	var url = 'http://dataservice.accuweather.com/locations/v1/cities/search?apikey={0}&q={1}'.format(auth.accu_weather_api_key, location);

	/* Get the ID */
	util.requestJSON(url, 'Spaghettatron')
	.then(function(obj) {

		/* Send weather info on gotten ID */
		sendWeatherNow(obj[0].Key, metric, channel);
	})
	.catch(console.error);
}

/* Get a help embed */
function getHelp(command) {

	var cmd = config.prefix + command;
	var help = commands[command].help;

	var embed = new Discord.RichEmbed()
	.setColor(help.color)
	.setFooter(util.select(commands.help.footer));

	/* Add the description if applicable */
	if(help.description) {
		embed.setDescription(help.description);
	}

	for(var key in help.commands) {

		/* Handle commands with one argument */
		if(key == 'no_arguments') {

			var body;

			if(help.commands.no_arguments.description) {
				body = '*' + help.commands.no_arguments.description + '*';
			} else {
				body = '*No description*';
			}

			if(help.commands.no_arguments.requirements) {
				body += '\n*(' + help.commands.no_arguments.requirements + ')*';
			}

			embed.addField(cmd, body);
		}

		/* Handle commands with one or more arguments */
		else if(key == 'other') {

			for(var obj in help.commands.other) {

				var object = help.commands.other[obj];

				var head = cmd + ' ' + (object.explicit ? object.name : format(object.name, true));
				var body = object.description ? '*' + object.description + '*' : '';

				var arg1 = object.name;
				var args = '';

				var select = 0;

				if(object.examples) {
					select = Math.floor(Math.random() * object.examples.length);
					arg1 = quote(object.examples[select]);
				}

				if(object.requirements) {
					body += '\n*(' + object.requirements + ')*';
				}

				/* Format arguments */
				if(object.arguments) {

					var arguments = object.arguments;

					for(var arg in arguments) {

						head += ' ' + format(arguments[arg].name, arguments[arg].required);

						if(arguments[arg].examples) {
							args += ' ' + quote(arguments[arg].examples[select], arguments[arg].no_quotes_needed);
						}
					}
				}

				/* Add an example */
				body += '\n**Example:** `' + cmd + ' ' + arg1 + args + '`';

				/* Add the field to the embed */
				embed.addField(head, body);

				/* Add  characters to show if an argument is required */
				function format(arg, required) {

					if(required) {
						return '<' + arg + '>';
					} else {
						return '[' + arg + ']';
					}
				}

				/* Add quotes if needed */
				function quote(x, whogiveacare) {

					if(!whogiveacare && x.includes(' ')) {
						return '"' + x + '"';
					} else {
						return x;
					}
				}
			}
		}
	}
	return embed;
}

// function sendPoll(tite, prompt, options, reactions, channel) {

// 	var embed = new Discord.RichEmbed()

// 	.setTitle(title)
// 	channel.send(embed);
// }
