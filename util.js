const https = require('https')
const mkdirp = require('mkdirp')
const fs = require('fs')
const paths = require('path')
const os = require('os')
const request = require('request')
const exec = require('child_process').exec;

module.exports = {

	/* Add a line to a file */
	addLine: function(line, file) {

		file = resolvePath(file);
		var dir = file.substring(0, file.lastIndexOf('/'));
		mkdir(dir)
		.then(() => {
			fs.writeFile(file, line, {flag: 'a'}, function(err) {
				if(err) console.log(err);
			});
		})
		.catch((err) => console.log('addLine:', err));
	},

	/* Remove a specific line if applicable from a file */
	removeLine: function(line, file) {

		file = resolvePath(file);
		fs.readFile(file, 'utf8', function(err, data) {
			if (err) console.log(err);
			else {
				var lines = data.split('\n');
				var index = lines.indexOf(line);
				if (index > -1) {
					lines.splice(index, 1);
				}
				data = lines.join('\n');
				fs.writeFile(file, data, function(err) {
					if(err) console.log('removeLine:', err);
				}); 
			}
		});
	},

	/* Write data to a file */
	write: function(data, file) {

		file = resolvePath(file);
		var dir = file.substring(0, file.lastIndexOf('/'));
		mkdir(dir)
		.then(() => {
			fs.writeFile(file, data, {flag: 'w'}, function(err) {
				if(err) console.log(err);
			});
		})
		.catch((err) => console.log('write:', err));
	},

	/* Choose a random element from an array */
	select: function(items) {

		if(Array.isArray(items)) {
			return items[Math.floor(Math.random() * items.length)];
		} else {
			return items.random();
		}
	},

	/* Choose between two objects */
	selectObj: function() {
		return arguments[Math.floor(Math.random() * arguments.length)];
	},

	/* Make a directory if it exists */
	mkdir: function(dir) {
		return mkdir(dir);
	},

	/* Redirects output to the screen */
	puts: function(error, stdout, stderr) {
		puts(error, stdout, stderr);
	},

	/* Resolve path */
	resolvePath: function(path) {
		return resolvePath(path);
	},

	/* Request JSON */
	requestJSON: function(url, userAgent) {
		return requestJSON(url, userAgent);
	},

	/* Get day of week name */
	getDayName: function(date) {
		var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
		return days[date.getDay()];
	},

	/* Get month name */
	getMonthName: function(date) {
		var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
		return months[date.getMonth()];
	},

	/* Executes and returns a promise */
	exec: function(x) {
		return new Promise(function (resolve, reject) {
			execute(x, puts);
		});
	},

	isImage: function(url) {

		var sites = ['imgur.com', 'instagram.com'];
		var extensions = ['jpg', 'png', 'gif'];

		for(var i = 0; i < sites.length; i++) {
			if(url.startsWith('https://' + sites[i]) || url.startsWith('http://' + sites[i])) return true;
		}
		for(var i = 0; i < extensions.length; i++) {
			if(url.endsWith('.' + extensions[i])) return true;
		}
		return false;
	},

	isVideo: function(url) {

		var sites = ['imgur.com', 'instagram.com', 'youtube.com', 'vimeo.com', 'dailymotion.com'];
		var extensions = ['mov', 'mp4', 'avi'];

		for(var i = 0; i < sites.length; i++) {
			if(url.startsWith('https://' + sites[i]) || url.startsWith('http://' + sites[i])) return true;
		}
		for(var i = 0; i < extensions.length; i++) {
			if(url.endsWith('.' + extensions[i])) return true;
		}
		return false;
	},

	random: function(min, max) {
		min = Math.ceil(min);
		max = Math.floor(max);
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}
}

/* Implement string.format() */
if (!String.prototype.format) {

	String.prototype.format = function() {
		var args = arguments;
		return this.replace(/{(\d+)}/g, function(match, number) { 
			return typeof args[number] != 'undefined'
			? args[number]
			: match
			;
		});
	};
}

/* Implement string.equalsIgnoreCase(), regardless of type */
if (!String.prototype.equalsIgnoreCase) {

	String.prototype.equalsIgnoreCase = function(x) {
		return this.toLowerCase() == x.toLowerCase();
	};
}

/* Make directory and promise to do something if necessary */
function mkdir(dir) {
	return new Promise(function (resolve, reject) {
		mkdirp(dir, function(err) {
			if(err) reject('mkdir:', err);
			else resolve();
		});
	});
}

/* Change the path to an actual path if it ias ~ or . */
function resolvePath(path) {
	if(path.charAt(0) == '.') {
		path = paths.join(__dirname, path.substring(1));
	} else if(path.charAt(0) == '~') {
		path = paths.join(os.homedir(), path.substring(1));
	}
	return path;
}

/* Request JSON from a URL */
function requestJSON(url, userAgent) {

	if(!userAgent) userAgent = 'util.js';
	
	return new Promise(function (resolve, reject) {
		const options = {
			url: url,
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'Accept-Charset': 'utf-8',
				'User-Agent': userAgent
			}
		};

		// console.log('Requesting from:', options.url);
		// console.log('--------------------------------------');

		request(options, function(err, res, body) {
			resolve(JSON.parse(body));
		});
	});
}

/* Redirects output to the console */
function puts(error, stdout, stderr) {
	console.log(stdout);
}