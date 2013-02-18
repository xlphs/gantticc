require.config({
	paths:{
		'firebase':'https://cdn.firebase.com/v0/firebase'
	},
	waitSeconds:30
});
require(["jquery", "firebase", "bootstrap.min", "bootstrap-datepicker.min", "gantticc.min", "bonsai.min"],
function($){
	// ---- Entry point ----
	gantticc.initUI();
	gantticc.init();
},
function(err){
	// error callback
	var gantt = document.getElementById("gantt");
	gantt.innerHTML = "Error occurred while loading required scripts, please try again later.";
});

var gchart;

function gchart_render(){
	$('#gantt').empty();
	
	gchart = bonsai.run(document.getElementById('gantt'),{
		url: 'js/gchart.min.js?bustcache='+Math.random(),
		width: gantticc.getWidth(),
		height: gantticc.getHeight(),
		code: function(){
			stage.on('message:update_task', function(data){
				if (data.cancel === 'true'){
					ganttClickLock = 0;
					return;
				}
				var task = null;
				// find task by task id
				var i = 0;
				for (i; i < gantticc.tasks.length; i++){
					task = gantticc.tasks[i];
					if (task.tid == data.tid) break;
				}
				if (task == null) return;
				if (data.delete === 'true'){
					gchart.deleteTaskAnim(task.group_asset);
					gantticc.tasks.splice(i, 1);
				} else{
					data.title = data.title;
					task.title_asset.attr('text', data.title);
					task.updateIndicatorIcon(data.notes);
					task.updateTaskColor(data.color);
				}
				ganttClickLock = 0;
			});
			stage.on('message:update_project', function(data){
				if ((typeof data.start_date) != 'undefined'){
					var scroll_date = new Date();
					if (data.scroll_date) {
						scroll_date = new Date(data.scroll_date);
					}
					gchart.drawHeader(data.start_date, data.end_date);
					gchart.scrollToDate(scroll_date);
					gchart.updateCurrentUnit();
				}
			});
			stage.on('message:init_tasks', function(data){
				gchart.initTasks(data.tasks);
			});
			stage.on('message:init_heatmap', function(data){
				// preserve current scroll position
				var scrollDate = gchart.getScrollDate();
				// check unit
				if (gchart.unit !== data.unit) {
					gchart.unit = data.unit;
				}
				gchart.drawHeader(data.start_date, data.end_date);
				gchart.updateCurrentUnit(1);
				gchart.initHeatMap({
					min: data.min,
					max: data.max,
					projects: data.data
				});
				gchart.scrollToDate(scrollDate);
				// update jump to month button
				stage.sendMessage('scroll_date', {date: scrollDate});
			});
			stage.on('message:scroll_to_date', function(data){
				var date = new Date(data.date);
				gchart.scrollToDate(date, 1);
			});
			stage.on('message:set_swatch', function(data){
				gchart.highlightTaskByColor(data.color, data.status);
			});
			stage.on('message:set_scale', function(data){
				var scrollDate = new Date();
				if (gchart.unit === data.unit){
					// jump to today if no change
					gchart.scrollToDate(scrollDate);
				} else {
					// preserve current scroll position
					scrollDate = gchart.getScrollDate();
					gchart.unit = data.unit;
					gchart.drawHeader(data.start_date, data.end_date);
					gchart.updateCurrentUnit(1);
					gchart.scrollToDate(scrollDate, 1);
				}
				// update jump to month button
				stage.sendMessage('scroll_date', {date: scrollDate});
			});
			stage.sendMessage('ready',{});
		}
	});

	gchart.on('load', function(data){
		gchart.on('message:ready', function(data){
			if (gantticc.authenticated === false) {
				if ( gantticc.youShallNotPass() === false ) {
					gchart.destroy(); // destroy self
					return;
				}
			}
			var startdate = new Date($('#project_startdate').val()).toISOString();
			var enddate = new Date($('#project_enddate').val()).toISOString();
			var scrollto = $('#mtab').attr('value') ? new Date($('#mtab').attr('value')) : new Date();
			gchart.sendMessage('update_project',{
				start_date: startdate,
				end_date: enddate,
				scroll_date: scrollto
			});
			gchart.sendMessage('init_tasks',{
				tasks: gantticc.project.tasks
			});
			// now that everything's ready, show intro if necessary
			if (!gantticc.loaded) {
				gantticc.showIntro();
			}
			gantticc.loaded = true;
		});
		gchart.on('message:edit_task', function(data){
			var task = gantticc.project.getTask(data.tid);
			if (task == null) return;
			// show the title edit form
			$('#title_tid').val(task.tid);
			if (task.title === "New Task") {
				$('#title_txtfield').val("");
				$('#title_txtfield').attr('placeholder', "New Task");
			} else {
				$('#title_txtfield').val(task.title);
				$('#title_txtfield').attr('placeholder', "");
			}
			if (!task.color) task.color = "gray";
			$('#task_color').val(task.color);
			for (var i=0; i<gantticc.colors.length; i++){
				var c = gantticc.colors[i];
				$('#task_color_'+c).removeClass('swatch_sel');
			}
			$('#task_color_'+task.color).addClass('swatch_sel');
			$('#notes_txtfield').val(task.notes);
			var y_pos = data.y+$('#topbar').height();
			if ( !$('#settings').is(":hidden") ) y_pos += $('#settings').height();
			$('#task_form').css({ top: y_pos, left: data.x });
			$('#task_form').show();
		});
		gchart.on('message:update_task', function(data){
			var task = gantticc.project.getTask(data.tid);
			if (task == null) return;
			if (data.start) task.start = data.start;
			if (data.end) task.end = data.end;
			if (data.row) task.row = data.row;
			gantticc.project.saveTasks();
		});
		gchart.on('message:new_task', function(data){
			gantticc.project.addTask(data.task);
		});
		gchart.on('message:scroll_date', function(data){
			var cur = new Date(data.date);
			gantticc.updateCurrentMonthBtn(cur);
		});
		gchart.on('message:update_heatmap', function(data){
			project_heatmap(data.unit);
		});
	});
	// apply data into ui
	gantticc.applyCurrentProject();
}

function task_form_delete(){
	gchart.sendMessage('update_task',{
		tid: $('#title_tid').val(),
		delete: 'true'
	});
	$('#task_form').hide();
	gantticc.project.deleteTask($('#title_tid').val());
}

function task_form_cancel(){
	gchart.sendMessage('update_task',{
		tid: $('#title_tid').val(),
		cancel: 'true'
	});
	$('#task_form').hide();
	$("#title_txtfield").trigger("blur");
	$("#notes_txtfield").trigger("blur");
}

function task_form_submit(){
	var task = gantticc.project.getTask($('#title_tid').val());
	if (task == null) return;
	task.title = $('#title_txtfield').val();
	task.color = $('#task_color').val();
	task.notes = $('#notes_txtfield').val();
	gchart.sendMessage('update_task',{
		tid: task.tid,
		title: task.title,
		color: task.color,
		notes: task.notes
	});
	$('#task_form').hide();
	gantticc.project.saveTasks();
}

function task_form_set_color(color){
	for (var i=0; i<gantticc.colors.length; i++){
		var c = gantticc.colors[i];
		$('#task_color_'+c).removeClass('swatch_sel');
	}
	$('#task_color_'+color).addClass('swatch_sel');
	$('#task_color').val(color);
}

function project_update(nosave){
	var startdate = new Date($('#project_startdate').val()).toISOString();
	var enddate = new Date($('#project_enddate').val()).toISOString();
	var current = $('#mtab').attr('value') ? new Date($('#mtab').attr('value')) : new Date();
	if (current < new Date(gantticc.project.start)){
		current = new Date(gantticc.project.start);
	} else if (current > new Date(gantticc.project.end)){
		current = new Date(gantticc.project.end);
	}
	gchart.sendMessage('update_project',{
		start_date: startdate,
		end_date: enddate,
		scroll_date: current
	});
	gantticc.project.title = $('#project_title_txtfield').val();
	gantticc.project.start = startdate;
	gantticc.project.end = enddate;
	if (!nosave) {
		gantticc.project.save();
		gantticc.project.saveTasks();
	}
	gantticc.updateCurrentMonthBtn(current);
	gantticc.updateJumpMonthMenu();
	gantticc.updateProjectList();
}

function project_delete_cur(){
	gantticc.deleteCurrentProject();
	gantticc.applyCurrentProject();
	gchart.sendMessage('init_tasks',{
		tasks: gantticc.project.tasks
	});
}

function project_new(){
	if (gantticc.addNewProject() == null) {
		alert("Cannot create more than "+gantticc.maxProjCount+" projects.");
		return;
	}
	gantticc.applyCurrentProject();
	gchart.sendMessage('init_tasks',{
		tasks: gantticc.project.tasks
	});
}

function project_load(pid){
	gantticc.setCurrentProject(pid);
	gchart.sendMessage('init_tasks',{
		tasks: gantticc.project.tasks
	});
	gantticc.resetHeatmap();
	gantticc.resetSwatch();
}

function gchart_jump(dir){
	var current = new Date($('#mtab').attr('value'));
	var y = current.getFullYear();
	var m = current.getMonth();
	var d = 1;
	if (dir === "left"){
		m--;
		if (m < 0){
			y--;
			m = 11;
		}
	} else if (dir === "right"){
		m++;
		if (m == 12){
			y++;
			m = 0;
		}
	}
	var to = new Date(y,m,1);
	var start = new Date(gantticc.project.start);
	var end = new Date(gantticc.project.end);
	if (gantticc.heatmap.start) {
		var a = new Date(gantticc.heatmap.start);
		var b = new Date(gantticc.heatmap.end);
		if (start > a) start = a;
		if (end < b) end = b;
	}
	if (to > end) return;
	if (to < start){
		// jump to first day of project
		to = start;
	}
	gchart_scroll(to);
	gantticc.updateCurrentMonthBtn(to);
}

function gchart_scroll(date){
	gchart.sendMessage('scroll_to_date',{
		date: date.toISOString()
	});
	gantticc.updateCurrentMonthBtn(date);
	$('#mselects').hide();
}

function set_scale(unit){
	var start = gantticc.project.start;
	var end = gantticc.project.end;
	if (gantticc.heatmap.start) {
		project_heatmap(unit, 1);
		return;
	}
	gchart.sendMessage('set_scale',{
		unit: unit,
		start_date: start,
		end_date: end
	});
}

function toggle_swatch_color(color){
	if (gantticc.heatmap.start) return;
	var el = $('.swatch_'+color).next().first();
	el.toggleClass('swatch_checked');
	var enable = false;
	if (el.hasClass('swatch_checked')) {
		enable = true;
	}
	gchart.sendMessage('set_swatch',{
		color: color, status: enable
	});
}

function toggle_settings(){
	if ( $('#settings').is(":hidden") ){
		$('#settings_toggler').removeClass("icon-arrow-down").addClass("icon-arrow-up");
		$('#settings').slideDown();
	} else{
		$('#settings_toggler').addClass("icon-arrow-down").removeClass("icon-arrow-up");
		$('#settings').slideUp();
	}
}

function project_heatmap(unit, update){
	// Handle UI events
	if (!update) {
		if ($('#heatmap_status').attr('value') === "on") {
			gantticc.resetHeatmap();
			var scrollTo = new Date($('#mtab').attr('value'));
			if (scrollTo < new Date(gantticc.project.start)) {
				scrollTo = new Date(gantticc.project.start);
			}
			gchart.sendMessage('update_project',{
				start_date: gantticc.project.start,
				end_date: gantticc.project.end,
				scroll_date: scrollTo
			});
			gchart.sendMessage('init_tasks',{
				tasks: gantticc.project.tasks,
				no_scroll: true
			});
			gantticc.resetSwatch();
			gantticc.updateJumpMonthMenu();
			gantticc.updateCurrentMonthBtn(scrollTo);
			gantticc.heatmap = {};
			return;
		} else {
			$('#heatmap_status').html('<b>Heat Map</b>').attr('value', 'on');
		}
	}
	if (!unit) unit = "day";
	// 1. Get the start/end date by looking at all projects
	var start = new Date(gantticc.project.start).getTime();
	var end = new Date(gantticc.project.end).getTime();
	for (var i=0; i<gantticc.projects.length; i++){
		var prj = gantticc.projects[i];
		var a = new Date(prj.start).getTime();
		var b = new Date(prj.end).getTime();
		if (start > a) start = a;
		if (end < b) end = b;
	}
	// 2. For each day/week, compute the number of tasks
	var theData = [],
		totalData = [],
		max = 0,
		incTime = 1000*3600*24;
	if (unit === "week") incTime = incTime * 7; // 7 days a week
	for (var t=start; t<=end; t+=incTime) {
		var tasks;
		var date = new Date(t);
		if (unit === "day") {
			tasks = gantticc.getAllTasksOnDate(date);
		} else {
			tasks = gantticc.getAllTasksInWeek(date.getWeekNumber(date));
		}
		var data = { date: t, tasks: tasks };
		if (max < tasks.length) max = tasks.length;
		totalData.push(data);
	}
	max++; // for max opacity 0.9 so that grid lines remain visible
	// 3. For each project, generate data for plotting
	var projectsData = [];
	for (var i=0; i<gantticc.projects.length; i++){
		var prj = gantticc.projects[i];
		var data = {
			title: prj.title,
			data: prj.getDataForHeatMap(unit)
		}
		projectsData.push(data);
	}
	theData = [{ title: "Total", data: totalData }];
	$.merge(theData, projectsData);
	
	gchart.sendMessage('init_heatmap',{
		start_date: new Date(start).toISOString(),
		end_date: new Date(end).toISOString(),
		unit: unit,
		data: theData,
		min: 0, max: max
	});
	gantticc.heatmap = {
		start: new Date(start).toISOString(),
		end: new Date(end).toISOString()
	}
	gantticc.updateJumpMonthMenu(gantticc.heatmap.start, gantticc.heatmap.end);
}