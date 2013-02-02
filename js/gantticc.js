var gantticc = gantticc || {};

// constructor
function Project(pid, obj) {
	if (pid === -1) {
		$.extend(this, obj); // object coming from Firebase
	} else if ((typeof pid) === "undefined") {
		this.pid = "";
		this.title = "My Awesome Project";
		this.start = new Date().toISOString();
		this.end = new Date(new Date().getTime() + 1000*3600*24*49).toISOString();
		this.tasks = [];
		this.addDummyTask();
	} else {
		this.pid = pid;
		if (localStorage["project"+this.getPid()] !== null) {
			$.extend(this, JSON.parse(localStorage["project"+this.getPid()]));
		} else {
			throw new UserException("invalid project id");
		}
		this.loadTasks();
	}
}
Project.prototype = {
	getPid: function() {
		if (this.pid == "0") return "";
		return this.pid;
	},
	save: function(projectOnly) {
		var obj = {
				title: this.title,
				start: this.start,
				end: this.end
		};
		if (gantticc.firebaseId) {
			var prjRef = new Firebase(gantticc.firebaseUrl+gantticc.firebaseId+"/"+this.pid);
			obj.pid = this.pid;
			prjRef.update(obj);
		} else {
			localStorage["project"+this.getPid()] = JSON.stringify(obj);
		}
	},
	delete: function(){
		if (gantticc.firebaseId) {
			var pageRef = new Firebase(gantticc.firebaseUrl+gantticc.firebaseId+"/"+this.pid);
			pageRef.remove();
		} else {
			localStorage.removeItem("project"+this.getPid());
			localStorage.removeItem("tasks"+this.getPid());
		}
	},
	load: function(){
		if (localStorage["project"+this.getPid()] !== null) {
			$.extend(this, JSON.parse(localStorage["project"+this.getPid()]));
		} else {
			throw new UserException("invalid project id");
		}
	},
	loadTasks: function() {
		this.tasks = JSON.parse(localStorage["tasks"+this.getPid()]);
	},
	saveTasks: function(){
		if (gantticc.firebaseId) {
			var prjRef = new Firebase(gantticc.firebaseUrl+gantticc.firebaseId+"/"+this.pid);
			prjRef.update({ tasks: this.tasks });
		} else {
			localStorage["tasks"+this.getPid()] = JSON.stringify(this.tasks);
		}
	},
	getTask: function(tid){
		for (var i=0; i<this.tasks.length; i++) {
			var t = this.tasks[i];
			if (t.tid == tid) return t;
		}
		return null;
	},
	deleteTask: function(tid){
		for (var i=0; i<this.tasks.length; i++) {
			var t = this.tasks[i];
			if (t.tid == tid) break;
		}
		this.tasks.splice(i, 1);
		this.saveTasks();
	},
	addTask: function(task){
		this.tasks.push(task);
		this.saveTasks();
	},
	addDummyTask: function(){
		this.tasks.push({
			tid: "1",
			title: "New Task",
			color: "gray",
			start: new Date().toISOString(),
			end: new Date(new Date().getTime() + 1000*3600*24*2).toISOString(),
			row: "1",
			notes: "Random notes"
		});
	},
	getTasksOnDate: function(date){
		var tasks = [];
		var d = date.getTime();
		for (var i=0; i<this.tasks.length; i++) {
			var t = this.tasks[i];
			var start = new Date(t.start).getTime();
			var end = new Date(t.end).getTime();
			if (start <= d && end >= d) {
				tasks.push($.extend(true, {}, t)); // return copy
			}
		}
		return tasks;
	},
	getTasksInWeek: function(w){
		var tasks = [];
		for (var i=0; i<this.tasks.length; i++) {
			var t = this.tasks[i];
			var date = new Date(t.start);
			var wn = date.getWeekNumber(date);
			if (wn == w) {
				tasks.push($.extend(true, {}, t)); // return copy
			}
		}
		return tasks;
	},
	getDataForHeatMap: function(unit){
		var data = [];
		var start = new Date(this.start).getTime();
		var end = new Date(this.end).getTime();
		var incTime = 1000*3600*24;
		if (unit === "week") incTime = incTime * 7; // 7 days a week
		for (var t=start; t<=end; t+=incTime) {
			var tasks;
			var date = new Date(t);
			if (unit === "day") {
				tasks = this.getTasksOnDate(date);
			} else {
				tasks = this.getTasksInWeek(date.getWeekNumber(date));
			}
			data.push({ date: t, tasks: tasks });
		}
		return data;
	}
};

gantticc.getColorValue = function(c){
	if (!c) c = "gray"; // default color
	return gantticc.colorValues[c][0];
};

gantticc.init = function(){
	gantticc.loaded = false;
	gantticc.listenKey = true; // listen/handle key presses
	gantticc.heatmap = {} // Heat Map overrides
	gantticc.projects = [];
	gantticc.project = null;
	gantticc.maxProjCount = 5; // Max number of projects
	// Predefined colors
	gantticc.colors = ['null', 'gray', 'blue', 'orange'];
	gantticc.colorValues = {
		gray: ["#e5e5e5", "#f2f2f2"],
		blue: ["#bee1ef", "#d4effc"],
		orange: ["#ff944d", "#ffa264"]
	};
	gantticc.firebaseUrl = "https://gantticc.firebaseio.com/";
	gantticc.siteUrl = "http://gantti.cc/test.html";
	
	// Check support for Local Storage
	gantticc.localstorage = 1;
	if ((typeof Storage) !== "undefined") {
		gantticc.localstorage = 1;
	} else {
		// no local storage
		console.log("Error: local storage not supported!");
		gantticc.localstorage = 0;
	}
	
	// Check if data should be loaded from Firebase
	var paramstr = window.location.search.substr(1);
	if (paramstr.indexOf('fbdb') != -1) {
		gantticc.firebaseId = paramstr.substr(paramstr.indexOf('fbdb')+5);
		// try to read all data from Firebase
		var dbRef = new Firebase(gantticc.firebaseUrl+gantticc.firebaseId);
		dbRef.once('value', function(snapshot){
			if (snapshot.val() == null) {
				gantticc.firebaseId = "";
				// failed to read from server, load/prepare data from local storage
				gantticc.loadDataFromLocalStorage();
			} else {
				var data = snapshot.val();
				// typecast into Project object
				for (var i=0; i<data.length; i++) {
					gantticc.projects.push(new Project(-1, data[i]));
				}
				gantticc.project = gantticc.projects[0];
				gantticc.updateSharingStatus();
				gantticc.loaded = true;
			}
			gchart_render();
		});
	} else {
		// load straight from local storage and render
		gantticc.firebaseId = "";
		gantticc.loadDataFromLocalStorage();
		gchart_render();
	}
};

gantticc.loadDataFromLocalStorage = function(){
	if (gantticc.localstorage == 1) {
		gantticc.loadAllProjects();
		if (gantticc.projects.length > 0) {
			// check if GET parameter specifies a project to use
			var userPid = gantticc.getUserSpecifiedProject();
			if (userPid) {
				for (var i=0; i<gantticc.projects.length; i++) {
					var prj = gantticc.projects[i];
					if (userPid === prj.pid) {
						gantticc.project = prj;
					}
				}
			}
			if (gantticc.project == null) {
				// use default project
				gantticc.project = gantticc.projects[0];
			}
		} else {
			var prj = new Project();
			gantticc.project = prj;
			gantticc.projects.push(gantticc.project);
		}
	} else {
		gantticc.project = new Project();
	}
	gantticc.loaded = true;
};

gantticc.applyCurrentProject = function(){
	// Update UI
	gantticc.updateCurrentMonthBtn(new Date());
	$('#project_title_txtfield').val(gantticc.project.title);
	$("#project_startdate").datepicker('setValue', new Date(gantticc.project.start));
	$("#project_enddate").datepicker('setValue', new Date(gantticc.project.end));
	project_update(false);
	gantticc.resetSwatch();
	gantticc.resetHeatmap();
	gantticc.updateProjectList();
};

gantticc.loadAllProjects = function(){
	if (gantticc.localstorage == 0) return;
	for (var i=0; i<gantticc.maxProjCount; i++) {
		try {
			var prj = new Project(i.toString());
			gantticc.projects.push(prj);
		} catch (e) {
			break;
		}
	}
};

gantticc.updateProjectList = function(){
	var list = [];
	for (var i=0; i<gantticc.projects.length; i++) {
		var prj = gantticc.projects[i];
		var str = "<li><a href=\"#\" onclick=\"project_load('"+prj.pid+"');\">";
		if (prj.pid === gantticc.project.pid) {
			str += "<b>"+prj.title+"</b>";
		} else {
			str += prj.title;
		}
		str += "</a></li>";
		list.push(str);
	}
	list.push("<li class=\"divider\"></li>");
	list.push("<li><a href=\"#\" onclick=\"project_new();\">Create New Project</a></li>");
	$('#project_list').html(list.join(""));
};

gantticc.setCurrentProject = function(pid){
	for (var i=0; i<gantticc.projects.length; i++) {
		var prj = gantticc.projects[i];
		if (prj.pid === pid) {
			gantticc.project = prj;
		}
	}
	if (!gantticc.firebaseId) {
		try {
			// reload data into memory since they may have been modified
			gantticc.project.load();
			gantticc.project.loadTasks();
		} catch (e) {
			gantticc.init();
		}
	}
	gantticc.applyCurrentProject();
};

gantticc.deleteCurrentProject = function(){
	gantticc.project.delete();
	for (var i=0; i<gantticc.projects.length; i++) {
		var prj = gantticc.projects[i];
		if (prj.pid == gantticc.project.pid) break;
	}
	gantticc.projects.splice(i, 1);
	if (gantticc.projects.length == 0) {
		var prj = new Project();
		gantticc.project = prj;
		gantticc.projects.push(gantticc.project);
	} else {
		// use the first available project
		gantticc.project = gantticc.projects[0];
	}
};

gantticc.getLiteralMonth = function(m) {
	var mnames = ["January", "February", "March", "April", "May", "June", "July",
				 "August", "September", "October", "November", "December"];
	return mnames[m];
};

gantticc.updateCurrentMonthBtn = function(date){
	// Update jump to month button
	$('#mtab').text( gantticc.getLiteralMonth(date.getMonth()) );
	$('#mtab').attr('value', date.toISOString());
};

gantticc.updateJumpMonthMenu = function(start_date, end_date){
	// generate a list of months to jump to directly
	if (!start_date) start_date = gantticc.project.start;
	if (!end_date) end_date = gantticc.project.end;
	var months = [];
	var start = new Date(start_date);
	var end = new Date(end_date);
	for (var y=start.getFullYear(); y<=end.getFullYear(); y++){
		if (y != start.getFullYear()){
			months.push("<li class=\"disabled\">"+"<a>"+y+"</a></li>");
		}
		var endMonth = (y == end.getFullYear()) ? end.getMonth() : 11;
		var startMonth = (y == start.getFullYear()) ? start.getMonth() : 0;
		for (var m=startMonth; m <= endMonth; m++){
			var startDay = (months.length > 0) ? 1 : start.getDate();
			var btn = "<li><a href=\"#\" onclick=\"gchart_scroll(new Date("+y+","+m+","+startDay+"))\">";
			btn += gantticc.getLiteralMonth(m)+"</a></li>";
			months.push(btn);
		}
	}
	$('#mselects').html( months.join('') );
};

gantticc.addNewProject = function(){
	if (gantticc.projects.length >= gantticc.maxProjCount) return null;
	gantticc.project.save();
	gantticc.project.saveTasks();
	gantticc.project = new Project();
	gantticc.project.title = "New Project";
	gantticc.project.pid = gantticc.projects.length.toString();
	gantticc.projects.push(gantticc.project);
	$('#project_title_txtfield').focus();
	return true;
};

gantticc.exportData = function(type) {
	if (type === "google_cal") {
		var csv = [];
		csv.push("Subject,Start Date,End Date,Description"); // headers
		for (var i=0; i<gantticc.project.tasks.length; i++) {
			var t = gantticc.project.tasks[i];
			var startDate = t.start.split("T")[0];
			startDate.split("-").join("/");
			var endDate = t.end.split("T")[0];
			endDate.split("-").join("/");
			csv.push(t.title+","+startDate+","+endDate+","+t.notes);
		}
		return csv.join("\n");
	}
	return "";
};

gantticc.getUserSpecifiedProject = function(){
	var str = window.location.search.substr(1);
	var paramArr = str.split("&");
	var params = {};
	for (var i=0; i<paramArr.length; i++) {
		var tmp = paramArr[i].split("=");
		if (tmp[0] === "project") return tmp[1];
	}
	return "";
};

gantticc.resetSwatch = function(){
	// make all colors selected
	for (var i=1; i<gantticc.colors.length; i++) {
		var color = gantticc.colors[i];
		var el = $('.swatch_'+color).next().first();
		el.addClass('swatch_checked');
	}
};

gantticc.resetHeatmap = function(){
	$('#heatmap_status').html('Heat Map');
	$('#heatmap_status').attr('value', '');
};

gantticc.openInNewWind = function(){
	// Note: Chrome will open a tiny new window, will have to reload
	var url = location.protocol+'//'+location.host+location.pathname+'?project='+gantticc.project.pid;
	window.open(url);
};

gantticc.getAllTasksOnDate = function(date){
	var arr = [];
	for (var i=0; i<gantticc.projects.length; i++) {
		$.merge(arr, gantticc.projects[i].getTasksOnDate(date));
	}
	return arr;
};

gantticc.getAllTasksInWeek = function(weekNum){
	var arr = [];
	for (var i=0; i<gantticc.projects.length; i++) {
		$.merge(arr, gantticc.projects[i].getTasksInWeek(weekNum));
	}
	return arr;
};

gantticc.getWidth = function(){
	if (gantticc.print) {
		var a = new Date(gantticc.project.start).getTime();
		var b = new Date(gantticc.project.end).getTime();
		var days = (b-a)/1000/3600/24;
		return 30*days;
	} else {
		return $('#controls').width();
	}
};

gantticc.getHeight = function(){
	if (gantticc.print) {
		return 500;
	} else {
		return $(document).height()-$('#topbar').height()-7;
	}
};

gantticc.shareToFirebase = function(){
	if (gantticc.firebaseId) {
		var shareUrl = gantticc.siteUrl+"?fbdb="+gantticc.firebaseId;
		$('#prj_sharefrm_output').html('This gantticc is currently shared at: <code><a href="'+shareUrl+'">'+shareUrl+'</a></code>');
		return;
	}
	var shareId = $('#project_share_id').val();
	var dbRef = new Firebase(gantticc.firebaseUrl+shareId);
	dbRef.once('value', function(snapshot){
		if (snapshot.val() == null) {
			$('#project_share_id').parent().parent().removeClass('error').addClass("success");
			dbRef.set(gantticc.projects, function(){
				var shareUrl = gantticc.siteUrl+"?fbdb="+shareId;
				$('#prj_sharefrm_output').html('Your sharing URL: <code><a href="'+shareUrl+'">'+shareUrl+'</a></code>');
			});
		} else {
			$('#project_share_id').parent().parent().addClass('error');
			$('#prj_sharefrm_output').html('That sharing ID has been used, pick another one.');
		}
	});
};

gantticc.removeFromFirebase = function(){
	if (gantticc.firebaseId) {
		var dbRef = new Firebase(gantticc.firebaseUrl+gantticc.firebaseId);
		dbRef.remove();
		gantticc.firebaseId = "";
		gantticc.save();
		$('#project_share_modal').modal('hide');
	}
};

gantticc.updateSharingStatus = function(){
	if (gantticc.firebaseId) {
		var shareUrl = gantticc.siteUrl+"?fbdb="+gantticc.firebaseId;
		var html = '<p>This gantticc is currently shared at: <code><a href="'+shareUrl+'">'+shareUrl+'</a></code></p>';
		html += '<p>To disable sharing, you need to delete data completely from server. But don\'t worry, you still have a local copy of your data.</p>';
		html += '<button class="btn btn-danger" onclick="gantticc.removeFromFirebase();">Delete data from server</button>';
		$('#project_share_modal_body').html(html);
	}
};

gantticc.save = function(){
	if (gantticc.localstorage == 0) return;
	for (var i=0; i<gantticc.projects.length; i++) {
		gantticc.projects[i].save();
		gantticc.projects[i].saveTasks();
	}
};

Date.prototype.getWeekNumber = function(d) {
	/* For a given date, get the ISO week number
	* Based on information at:
	*    http://www.merlyn.demon.co.uk/weekcalc.htm#WNR
	*/
	// Copy date so don't modify original
	d = new Date(d);
	d.setHours(0,0,0);
	// Set to nearest Thursday: current date + 4 - current day number
	// Make Sunday's day number 7
	d.setDate(d.getDate() + 4 - (d.getDay()||7));
	// Get first day of year
	var yearStart = new Date(d.getFullYear(),0,1);
	// Calculate full weeks to nearest Thursday
	var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
	return weekNo;
};