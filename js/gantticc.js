var gnproject = { };
var gntasks = [];
var gnstorage = 1;
var gncolors = ['null', 'gray', 'blue', 'orange'];

function init_env() {
	if ((typeof Storage) !== "undefined") {
		gnstorage = 1;
	} else {
		// no local storage
		console.log("error: local storage not supported!");
		gnstorage = 0;
	}
}

function update_mtab() {
	var today = new Date();
	$('#mtab').text( getLiteralMonth([today.getMonth()]) );
	$('#mtab').attr('value', today.toISOString());
}

function get_project() {
	if (gnstorage == 0) return;
	
	if (localStorage.project) {
		gnproject = JSON.parse(localStorage.project);
	} else {
		gnproject = {
			title: "My Awesome Project",
			color: "blue",
			start: new Date().toISOString(),
			end: new Date(new Date().getTime() + 1000*3600*24*28).toISOString()
		};
	}
	$('#project_title_txtfield').val(gnproject.title);
	$("#project_startdate").datepicker('setValue', new Date(gnproject.start));
	$("#project_enddate").datepicker('setValue', new Date(gnproject.end));
	project_entry_submit();
}

function save_project() {
	if (gnstorage == 0) return;
	
	localStorage.project = JSON.stringify(gnproject);
}

function get_tasks() {
	if (gnstorage == 0) return;
	
	if (localStorage.tasks) {
		gntasks = JSON.parse(localStorage.tasks);
	} else {
		// create some dummy tasks
		gntasks = [
			{
				tid: "1",
				title: "New Task",
				start: new Date().toISOString(),
				end: new Date(new Date().getTime() + 1000*3600*24*2).toISOString(),
				row: "1",
				notes: "Random notes"
			}
		];
	}
}

function save_tasks() {
	if (gnstorage == 0) return;
	
	localStorage.tasks = JSON.stringify(gntasks);
}

function delete_task(tid) {
	var i = 0;
	for (; i<gntasks.length; i++) {
		var task = gntasks[i];
		if (task.tid == tid) break;
	}
	gntasks.splice(i, 1);
	save_tasks();
}

function getLiteralMonth(m) {
	var mnames = ["January", "February", "March", "April", "May", "June", "July",
				 "August", "September", "October", "November", "December"];
	return mnames[m];
}