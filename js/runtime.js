/* runtime.js */
/* Static UI event handlers for app.html */

require.config({
	paths:{
		'firebase':'https://cdn.firebase.com/v0/firebase'
	},
	urlArgs: "bust=b20130328",
	waitSeconds:10
});
require(["jquery", "firebase", "bootstrap.min", "bootstrap-datepicker.min", "bonsai.min", "gantticc.min"],
function($){
	// ---- Entry point ----
	gantticc.initUI();
	gantticc.init();
},
function(err){
	// error callback
	// TODO: fallback to localstorage if firebase script failed to load
	var gantt = document.getElementById("gantt");
	gantt.innerHTML = "Error occurred while loading required scripts, please try again later.";
});

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
	if (task.title.length < 1) task.title = $('#title_txtfield').attr('placeholder');
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
	if (gantticc.project.title.length < 1) {
		gantticc.project.title = $('#project_title_txtfield').attr('placeholder');
	}
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
	if ( $('#settings').is(":hidden") ){
		$('#settings_toggler').removeClass("icon-arrow-down").addClass("icon-arrow-up");
		$('#settings').slideDown();
	}
	$('#project_title_txtfield').attr('placeholder', $('#project_title_txtfield').val()).val('').focus()
	.bind('keypress.newprj', function(e){
		// a temporary listener for enter key
		if (e.keyCode == 13) {
			project_update();
			$('#project_title_txtfield').unbind('keypress.newprj').blur();
		}
	})
	.bind('blur.newprj', function(e){
		// remove all listeners when textfield is not active
		$('#project_title_txtfield').unbind('keypress.newprj');
		$('#project_title_txtfield').unbind('blur.newprj');
	});
}

function project_load(pid){
	gantticc.setCurrentProject(pid);
	var todaytasks = gantticc.project.getTasksOnDate( new Date() );
	if (todaytasks.length > 0) {
		gchart.sendMessage('scroll_to_task',{ task: todaytasks[0] });
	}
	gchart.sendMessage('init_tasks',{
		tasks: gantticc.project.tasks
	});
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
	gantticc.scale = unit;
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
	if (!unit) unit = gantticc.scale;
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

function gchart_print() {
	$('svg[data-bs-id]').attr('xmlns', 'http://www.w3.org/2000/svg')
	.attr('xmlns:xlink', 'http://www.w3.org/1999/xlink');
	var svgContents = $('#gantt').children().first().html();
	var start, end;
	start = svgContents.indexOf('viewBox=');
	start += 9;
	end = svgContents.indexOf('xmlns=');
	end -= 2;
	var viewBox = svgContents.substr(start, end-start);
	// calculate x offset
	var scrollPos = new Date($('#mtab').attr('value')).getTime();
	var startPos = new Date(gantticc.project.start).getTime();
	var xOffset = Math.floor((scrollPos - startPos)/1000/3600/24) * 30;
	var newViewBox = xOffset+' -0.5 '+gantticc.getHeight()+' '+gantticc.getWidth();
	// update viewbox, add svg to DOM
	svgContents = svgContents.replace(viewBox, newViewBox);
	$('#printwrap').html(svgContents);
	window.print();
}