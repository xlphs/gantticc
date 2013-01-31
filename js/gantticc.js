var gantticc = gantticc || {};

// constructor
function Project(pid) {
	if ((typeof pid) === "undefined") {
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
		localStorage["project"+this.getPid()] = JSON.stringify({
			title: this.title,
			start: this.start,
			end: this.end
		});
	},
	delete: function(){
		localStorage.removeItem("project"+this.getPid());
		localStorage.removeItem("tasks"+this.getPid());
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
		localStorage["tasks"+this.getPid()] = JSON.stringify(this.tasks);
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
		for (var i=0; i<this.tasks.length; i++) {
			var t = this.tasks[i];
			var start = new Date(t.start).getTime();
			var end = new Date(t.end).getTime();
			var d = date.getTime();
			if (start <= d && end >= d) {
				tasks.push($.extend(true, {}, t)); // return copy
			}
		}
		return tasks;
	},
	getDataForHeatMap: function(){
		var data = [];
		var start = new Date(this.start).getTime();
		var end = new Date(this.end).getTime();
		for (var t=start; t<=end; t+=1000*3600*24) {
			data.push({
				date: t,
				tasks: this.getTasksOnDate(new Date(t))
			});
		}
		return data;
	}
};

gantticc.getColorValue = function(c){
	if (!c) c = "gray"; // default color
	return gantticc.colorValues[c][0];
};

gantticc.init = function(){
	// Predefined colors
	gantticc.colors = ['null', 'gray', 'blue', 'orange'];
	gantticc.colorValues = {
		gray: ["#e5e5e5", "#f2f2f2"],
		blue: ["#bee1ef", "#d4effc"],
		orange: ["#ff944d", "#ffa264"]
	};
	// Max number of projects
	gantticc.maxProjCount = 5;
	
	// Check support for Local Storage
	gantticc.localstorage = 1;
	if ((typeof Storage) !== "undefined") {
		gantticc.localstorage = 1;
	} else {
		// no local storage
		console.log("Error: local storage not supported!");
		gantticc.localstorage = 0;
	}
	
	// Heat Map overrides
	gantticc.heatmap = {}
	
	// Load/prepare projects
	gantticc.projects = [];
	gantticc.project = null;
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
		gantticc.project = new Project(-1);
	}
	
	gantticc.applyCurrentProject();
	gantticc.updateProjectList();
};

gantticc.applyCurrentProject = function(){
	// Update UI
	gantticc.updateCurrentMonthBtn(new Date());
	$('#project_title_txtfield').val(gantticc.project.title);
	$("#project_startdate").datepicker('setValue', new Date(gantticc.project.start));
	$("#project_enddate").datepicker('setValue', new Date(gantticc.project.end));
	project_update();
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
	try {
		// reload data into memory since they may have been modified
		gantticc.project.load();
		gantticc.project.loadTasks();
	} catch (e) {
		gantticc.init();
	}
	gantticc.applyCurrentProject();
	gantticc.updateProjectList();
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

gantticc.save = function(){
	if (gantticc.localstorage == 0) return;
	
	for (var i=0; i<gantticc.projects.length; i++) {
		gantticc.projects[i].save();
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