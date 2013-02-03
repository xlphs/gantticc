// length of each day block (in px)
var GANTT_DAY_BLK_LEN = 35;
// height of each task block
var GANTT_TASK_BLK_HGT = 30;
// length of unit indicator block (in px)
var GANTT_UNIT_INDT_LEN = 43;
// length of task detail popup (in px)
var TASK_POPUP_LEN = 250;
// detect iPhone and iPad
var IOS_USER = false;
if ( (navigator.userAgent.match(/iPhone/i)) || (navigator.userAgent.match(/iPad/i)) ) {
	IOS_USER = true;
}
var OFFSET_TXT_VERT_ALIGN = false;
if (navigator.userAgent.indexOf("Firefox") != -1 || navigator.userAgent.indexOf("Opera") != -1) {
	OFFSET_TXT_VERT_ALIGN = true;
} else if (navigator.appName == 'Microsoft Internet Explorer') {
	// Note: IE will display fine, but mouse event hanlding is buggy
	OFFSET_TXT_VERT_ALIGN = true;
}

// the top level global context
var ganttContext = new Group().addTo(stage);

var gantticc = {
	dates: [], // DateBlocks
	tasks: [], // TaskBlocks
	// predefined colors and their highlights
	header_color: ["#19629b", "#3f9ccb"],
	gray: ["#e5e5e5", "#f2f2f2"],
	blue: ["#bee1ef", "#d4effc"],
	orange: ["#ff944d", "#ffa264"]
};

// global click lock, set to 1 to prevent click response
var ganttClickLock = 0;
// for double click
var ganttClickCount  = 0;
var ganttClickX = ganttClickY = 0;

// constructor
function DateBlock(context, x, y, date, text) {
	this.x = x;
	this.y = y;
	// date is a Date object
	this.date = date;
	this.text = text;
	this.show(context);
}

DateBlock.prototype = {
	show: function(context) {
		var _dateblk = this;
		_dateblk.textAsset = new Text(_dateblk.text).addTo(context);
		// center the text (text should be an integer)
		var nudge = (parseInt(_dateblk.text) < 10) ? 13 : 7;
		var y_pos = (OFFSET_TXT_VERT_ALIGN) ? _dateblk.y+13 : _dateblk.y;
		_dateblk.textAsset.attr({
			x: _dateblk.x+nudge,
			y: y_pos,
			textFillColor: color.parse(gantticc.header_color[0]),
			fontFamily: 'Helvetica, sans-serif',
			fontSize: '20px'
		});
	},
	setColor: function(hexValue) {
		this.textAsset.attr({ textFillColor: color.parse(hexValue) });
	},
	sameDate: function(date) {
		if (date.getFullYear() != this.date.getFullYear()) return false;
		if (date.getMonth() != this.date.getMonth()) return false;
		if (date.getDate() != this.date.getDate()) return false;
		return true;
	},
	sameWeek: function(date) {
		if (date.getWeekNumber(date) != this.date.getWeekNumber(this.date)) return false;
		return true;
	}
};

// constructor
function TaskBlock(context, x, task) {
	this.x = x;
	if (task.count) {
		// heatmap block
		this.count = task.count;
		this.y = task.y;
		this.dayspan = 1;
		this.weekspan = 1;
		this.width = GANTT_DAY_BLK_LEN*this.dayspan;
		this.startDate = new Date(task.date);
	} else {
		this.y = GANTT_TASK_BLK_HGT*parseInt(task.row);
		this.tid = task.tid;
		this.dayspan = this.calculateDaySpan(task.end, task.start);
		// day is the default unit, so weekspan must be null
		this.weekspan = null;
		this.width = GANTT_DAY_BLK_LEN*this.dayspan;
		this.startDate = new Date(task.start);
		this.endDate = new Date(task.end);
		this.title = task.title;
		if (task.notes.length > 0) {
			this.notes = "show";
		}
	}
	this.color = (task.color) ? task.color : "gray";
	this.show(context);
}

TaskBlock.prototype = {
	show: function(context) {
		var _task = this;
		
		var group = new Group().attr({
			x: _task.x,
			y: _task.y,
			cursor: 'pointer'
		}).addTo(context);
		_task.group_asset = group;
		
		var span = (this.weekspan === null) ? this.dayspan : Math.ceil(this.weekspan);
		var colorHex = gantticc[_task.color][0];
		var bg;
		if (_task.count) {
			// orange for total, blue for project
			// 60 = GANTT_TASK_BLK_HGT * 2
			var colorRgb = (_task.y == 60) ? "rgb(240,88,13)" : "rgb(49,130,189)";
			group.attr('cursor', "default");
			bg = new Rect(0, 0, GANTT_DAY_BLK_LEN*span, GANTT_TASK_BLK_HGT)
				.attr('filters', new filter.Opacity( gchart.getHeatMapColorOpacity(parseInt(_task.count)) ))
				.fill(color.parse(colorRgb))
				.addTo(group);
			_task.bg_asset = bg;
			group.on('mouseover', function(e){
				stage.emit('heatmapblkmsover', _task, e);
			})
			.on('mouseout', function(e){
				stage.emit('heatmapblkmsout', _task, e);
			});
			return;
		} else {
			bg = new Rect(0, 0, GANTT_DAY_BLK_LEN*span, GANTT_TASK_BLK_HGT, 4)
				.attr({
					strokeColor: '#bbb',
					strokeWidth: 2,
					filters: filter.blur(0)
				})
				.fill(color.parse(colorHex))
				.addTo(group);
		}
		_task.bg_asset = bg;
		
		group.on('mouseover', function(e){
			var c = gantticc[_task.color][1];
			_task.bg_asset.fill(color.parse(c));
			_task.edgeDrag_asset.attr({opacity: 1});
		})
		.on('mouseout', function(e){
			var c = gantticc[_task.color][0];
			_task.bg_asset.fill(color.parse(c));
			_task.edgeDrag_asset.attr({opacity: 0});
		})
		.on('pointerdown', function(e){
			stage.emit('taskpointerdown', _task, e);
		})
		.on('pointerup', function(e){
			ganttClickLock = 0;
		});
		
		var title_x = 8;
		var title_y = (IOS_USER) ? 8 : 10;
		if (OFFSET_TXT_VERT_ALIGN) title_y += 11;
		
		if (_task.notes) {
			_task.addIndicatorIcon(group, 'assets/task_list_16.png', 5, 7, 16, 16);
			title_x += 16;
		}
		
		var text = new Text(_task.title).addTo(group);
		_task.title_asset = text;
		text.attr({
			x: title_x, y: title_y,
			textFillColor: color.parse('#333'),
			fontFamily: 'Helvetica, sans-serif', fontSize: '16px'
		});
		
		_task.edgeDrag_asset = new Group().attr({
			x: this.width-3, y: 0, opacity: 0
		}).addTo(group);
		var edgeLine1 = new Rect(0, 7, 2, GANTT_TASK_BLK_HGT-14).addTo(_task.edgeDrag_asset);
		edgeLine1.fill(color.parse('#555'));
		var edgeLine1 = new Rect(2, 7, 2, GANTT_TASK_BLK_HGT-14).addTo(_task.edgeDrag_asset);
		edgeLine1.fill(color.parse('#eee'));
		var edgeLine2 = new Rect(4, 7, 2, GANTT_TASK_BLK_HGT-14).addTo(_task.edgeDrag_asset);
		edgeLine2.fill(color.parse('#555'));
	},
	showEditForm: function(task, gchart, x, y) {
		// scroll to position the popup inside chart
		var popup_x = task.x- -1*gchart.x;
		if ((-1*gchart.x + GANTT_UNIT_INDT_LEN) > task.x
			|| popup_x > (stage.width - TASK_POPUP_LEN)) {
			gchart.scrollToDate(task.startDate);
		}
		stage.sendMessage('edit_task', {
			tid: task.tid,
			x: task.x- -1*gchart.x,
			y: task.y+GANTT_TASK_BLK_HGT
		});
		ganttClickLock = 1;
	},
	updateTaskColor: function(hexColor) {
		this.color = hexColor;
		var c = gantticc[hexColor][0];
		this.bg_asset.fill(color.parse(c));
	},
	addIndicatorIcon: function(context, imgPath, x, y, w, h) {
		this.indicator_asset = new Bitmap(imgPath, function(err) {
		  if (err) return;
		  new Rect(0, 0, w, h).attr({
		    fillImage: this.attr({
				width: w, height: h
		    }),
			x: x, y: y
		  }).addTo(context);
		});
	},
	updateIndicatorIcon: function(notes) {
		var _task = this;
		if (notes.length > 0) {
			// show/add icon, shift title right
			if ( (typeof _task.indicator_asset) == 'undefined') {
				_task.addIndicatorIcon(_task.group_asset, 'assets/task_list_16.png', 5, 7, 16, 16);
			} else {
				_task.indicator_asset.attr({ visible: true });
			}
			_task.title_asset.attr({ x: 24});
			_task.notes = "show";
		} else {
			// hide the icon, shift title left
			if ( (typeof _task.indicator_asset) != 'undefined') {
				_task.indicator_asset.attr({ visible: false });
			}
			_task.title_asset.attr({ x: 8 });
			_task.notes = "";
		}
	},
	calculateDaySpan: function(start_date, end_date) {
		var start = new Date(start_date).getTime();
		var end = new Date(end_date).getTime();
		var diff = Math.abs(end - start)/1000;
		// minimum length is 1 day
		return Math.floor(diff/(3600*24)) + 1;
	},
	calculateWeekSpan: function(start_date, end_date) {
		var start = new Date(start_date).getTime();
		var end = new Date(end_date).getTime();
		var diff = Math.abs(end - start)/1000/(3600*24);
		// minimum length is 1 week
		return Math.floor(diff/7) + 1;
	},
	updateSpan: function(unit) {
		if (this.count) return;
		if (this.weekspan === null) {
			if (unit === "day") return;
			this.weekspan = this.dayspan / 7;
			this.dayspan = null;
			this.width = Math.ceil(this.weekspan)*GANTT_DAY_BLK_LEN;
		} else {
			if (unit === "week") return;
			// 7 days in a week, make sure result is an int
			this.dayspan = Math.ceil(this.weekspan * 7);
			this.weekspan = null;
			this.width = this.dayspan*GANTT_DAY_BLK_LEN;
		}
		this.bg_asset.attr({ width: this.width });
		if (!this.count) this.edgeDrag_asset.attr({ x: this.width-2 });
	},
	calculateDateFromX: function(x_pos) {
		// look at only the x position
		var i = Math.ceil(x_pos/GANTT_DAY_BLK_LEN);
		var newDate = gantticc.dates[i];
		if ((typeof newDate) == "undefined") return null;
		return new Date(newDate.date);
	},
	calculateXFromDate: function(date) {
		var x_pos = -1; // -1 means date not found
		for (var d=0; d < gantticc.dates.length; d++) {
			var dblk = gantticc.dates[d];
			if (gchart.unit === "day") {
				if ( dblk.sameDate(date) ) {
					x_pos = d * GANTT_DAY_BLK_LEN;
					break;
				}
			} else {
				if ( dblk.sameWeek(date) ) {
					x_pos = d * GANTT_DAY_BLK_LEN;
					break;
				}
			}
		}
		return x_pos;
	}
};

// constructor
function Gantt(x, y) {
	this.x = x;
	this.y = y;
	this.width = 30*GANTT_DAY_BLK_LEN;
	this.height = 0;
	this.unit = "day"; // default unit
	this.mode = "gantt" // gantt or heatmap
	
	// default unit is day, so show the current month
	var today = new Date();
	this.leftbar = new Group().addTo(stage); // add to stage
	this.leftbar_titles = new Group().attr({
		x: 1,
		y: 0
	}).addTo(stage);
	var y_pos = (OFFSET_TXT_VERT_ALIGN) ? 5+13 : 5;
	new Rect(0, 0, GANTT_UNIT_INDT_LEN-2, stage.height)
	.attr({
		strokeColor: '#fff',
		strokeWidth: 2
	})
	.fill('#fff')
	.addTo(this.leftbar);
	this.unitIndicator = new Text( today.getLiteralMonth(today.getMonth()) ).addTo(this.leftbar);
	this.unitIndicator.attr({
		x: 3, y: y_pos,
		textFillColor: color.parse(gantticc.header_color[0]),
		fontFamily: 'Helvetica, sans-serif', fontSize: '20px'
	});
	
	this.bg = new Group().attr({
		x: x,
		y: y
	}).addTo(ganttContext);
	this.body = new Group().attr({
		x: x,
		y: y
	}).addTo(ganttContext);
	this.header = new Group().attr({
		x: x,
		y: y
	}).addTo(ganttContext);
	
	this.show(ganttContext);
}

Gantt.prototype = {
	show: function(context) {
		var _gantt = this;
		var _task = null;
		var moving = 0; // 1 for task, 2 for body
		var mode = 0;
		var x_start = y_start = 0;
		var x_offset = y_offset = 0;
		
		// BEGIN click handling code
		stage.on('pointerdown', function(e){
			if (ganttClickLock != 0) return;
			if (e.x < GANTT_UNIT_INDT_LEN) return;
			ganttClickCount++;
			moving = 2;
			x_start = e.x;
			y_start = e.y;
			ganttClickX = e.x;
			ganttClickY = e.y;
			// watch out for double click/tap
			if (_gantt.mode !== "gantt") return;
			setTimeout(function() {
				if (ganttClickCount == 2) {
					gchart.addNewTask(ganttClickX, ganttClickY);
					mode = 0;
				}
				ganttClickCount = 0;
			}, 500);
		});
		stage.on('pointermove', function(e){
			if (moving == 1 && _task != null) {
				if (mode == 0) mode = 1;
				if (mode == 1) {
					_task.x += e.x - x_offset - _task.x;
					_task.y += e.y - y_offset - _task.y;
					_task.group_asset.attr({
						x: _task.x,
						y: _task.y
					});
				} else if (mode == 2) {
					// move the right edge of task bubble
					if (_gantt.unit === "day") {
						_task.width = GANTT_DAY_BLK_LEN*_task.dayspan + e.x - x_offset - _task.x;
					} else {
						_task.width = GANTT_DAY_BLK_LEN*_task.weekspan + e.x - x_offset - _task.x;
					}
					// cannot make task less than 1 unit length
					if (_task.width <= GANTT_DAY_BLK_LEN) _task.width = GANTT_DAY_BLK_LEN;
					_task.bg_asset.attr('width', _task.width);
					_task.edgeDrag_asset.attr({x: _task.width-2});
				}
			} else if (moving == 2) {
				ganttClickCount = 0;
				var diff_x = x_start - e.x;
				var diff_y = y_start - e.y;
				if (Math.abs(diff_x) > Math.abs(diff_y)) {
					_gantt.scrollX(diff_x);
				} else {
					if (_gantt.mode !== "heatmap") _gantt.scrollY(diff_y);
				}
				x_start = e.x;
				y_start = e.y;
				mode = 1;
			}
		});
		stage.on('pointerup', function(e){
			if (moving == 1 && _task != null) {
				if (mode == 0) {
					// handle single click, modify the task
					_task.showEditForm(_task, _gantt, e.x, e.y);
				} else if (mode == 1) {
					_task.x = _gantt.positionSnapX(_task.x, 0);
					var row = _gantt.calculateRowFromY(_task.y, _task.tid);
					_task.y = row*GANTT_TASK_BLK_HGT;
					// check move distance
					if (Math.abs(e.x - x_start) > 3 && Math.abs(e.y - y_start) > 2) {
						_task.startDate = _task.calculateDateFromX(_task.x);
						_task.group_asset.animate('0.3s', {
							x: _task.x, y: _task.y
						}, {
							easing: 'sineOut'
						});
						stage.sendMessage('update_task', {
							tid: _task.tid,
							start: _task.startDate.toISOString(),
							row: row.toString()
						});
					} else {
						_task.showEditForm(_task, _gantt, e.x, e.y);
						_task.group_asset.attr({
							x: _task.x, y: _task.y
						});
					}
				} else if (mode == 2) {
					var span = (_task.weekspan === null) ? _task.dayspan : Math.ceil(_task.weekspan);
					_task.width = _gantt.positionSnapX(_task.width, 0);
					_task.bg_asset.attr('width', _task.width);
					_task.endDate = _task.calculateDateFromX(_task.x+_task.width-GANTT_DAY_BLK_LEN);
					if (_task.weekspan === null) {
						_task.dayspan = _task.calculateDaySpan(_task.startDate, _task.endDate);
					} else {
						_task.endDate = _task.calculateDateFromX(_task.x+_task.width);
						// decrement by one day
						var endDate = new Date(_task.endDate).getTime();
						endDate -= 1000*3600*24;
						_task.endDate = new Date(endDate);
						_task.weekspan = _task.calculateWeekSpan(_task.startDate, _task.endDate);
					}
					stage.sendMessage('update_task', {
						tid: _task.tid,
						end: _task.endDate.toISOString()
					});
					_task.edgeDrag_asset.attr({x: _task.width-2, opacity: 0});
				}
				mode = 0;
				_task = null;
			}
			else if (moving == 2) {
				if (mode == 1) {
					_gantt.scrollSnapX();
					_gantt.scrollCheck();
					stage.sendMessage('scroll_date', {
						date: TaskBlock.prototype.calculateDateFromX(-1*_gantt.x+GANTT_UNIT_INDT_LEN)
					});
				}
			}
			moving = 0;
		});
		stage.on('taskpointerdown', function(task, e){
			ganttClickLock = 1;
			moving = 1;
			x_offset = e.x - task.x;
			y_offset = e.y - task.y;
			_task = task;
			// check if user is clicking on the right edge
			var span = (_task.weekspan === null) ? _task.dayspan : Math.ceil(_task.weekspan);
			if (Math.abs(e.x - _task.x - _gantt.x - span*GANTT_DAY_BLK_LEN) < 7) {
				mode = 2;
			}
		});
		// END click handling code
	},
	calculateRowFromY: function(y, tid) {
		// round off the y
		var ry = y;
		if ((ry % GANTT_TASK_BLK_HGT) > GANTT_TASK_BLK_HGT/2) {
			ry += GANTT_TASK_BLK_HGT - (ry % GANTT_TASK_BLK_HGT);
		} else {
			ry -= (ry % GANTT_TASK_BLK_HGT);
		}
		// make sure each task has its own row
		for (var i=0; i<gantticc.tasks.length; i++) {
			var task = gantticc.tasks[i];
			// move to the next row
			if (task.y == ry && task.tid != tid) ry += GANTT_TASK_BLK_HGT;
		}
		return Math.floor(ry/GANTT_TASK_BLK_HGT);
	},
	positionSnapX: function(x, offset) {
		// calculate x position by aligning with the grid
		var new_x = x + -1*offset;
		if ((new_x % GANTT_DAY_BLK_LEN) > GANTT_DAY_BLK_LEN/2) {
			// shift to the next day
			new_x += GANTT_DAY_BLK_LEN - (new_x % GANTT_DAY_BLK_LEN);
		} else {
			// shift to the previous day
			new_x -= (new_x % GANTT_DAY_BLK_LEN);
		}
		return new_x;
	},
	addNewTask: function(x, y) {
		if (ganttClickLock != 0) return;
		var _gantt = this;
		
		var new_x = _gantt.positionSnapX(x, _gantt.x);
		// calculate new task id
		var newId = 1;
		if (gantticc.tasks.length > 0) {
			var last = gantticc.tasks[gantticc.tasks.length-1];
			newId = parseInt(last.tid)+1;
		}
		newId = newId.toString();
		var new_y = y + Math.abs(_gantt.y);
		var row = _gantt.calculateRowFromY(new_y, newId);
		new_y = row*GANTT_TASK_BLK_HGT;
		var newStartDate = TaskBlock.prototype.calculateDateFromX(new_x).toISOString();
		var numHours = 24*2;
		if (_gantt.unit === "week") numHours = 24*6;
		var newEndDate = new Date(new Date(newStartDate).getTime() + 1000*3600*numHours).toISOString();
		var newTask = {
			tid: newId,
			title: "New Task",
			color: "gray",
			row: row.toString(),
			start: newStartDate,
			end: newEndDate,
			notes: ""
		};
		stage.sendMessage('new_task', {
			task: newTask
		});
		var newTaskBlk = new TaskBlock(_gantt.body, new_x, newTask);
		newTaskBlk.updateSpan(_gantt.unit);
		gantticc.tasks.push(newTaskBlk);
		// animate the new task
		var anim = new Animation('0.2s', {
			scaleX: 1,
			scaleY: 1
		}, { easing: 'expoIn' });
		newTaskBlk.group_asset.animate('0.15s', {
			scaleX: 1.3,
			scaleY: 1.3
		}, {
			easing: 'expoOut',
			onEnd: function() {
				newTaskBlk.group_asset.animate(anim);
			}
		});
	},
	deleteTaskAnim: function(task_grp) {
		// render animation for task deletion
		// enlarge it a little, then make it very small and opacity=0
		var vanishAnim = new Animation('0.2s', {
			scaleX: 0.1,
			scaleY: 0.1,
			opacity: 0
		}, { easing: 'expoIn' });
		task_grp.animate('0.15s', {
			scaleX: 1.1,
			scaleY: 1.1
		}, {
			easing: 'expoOut',
			onEnd: function() {
				task_grp.animate(vanishAnim);
			}
		});
		setTimeout(function(){
			gchart.body.removeChild(task_grp);
		}, 350);
	},
	drawHeader: function(start_date, end_date) {
		this.header.clear();
		this.bg.clear();
		gantticc.dates.length = 0;
		var start = new Date(start_date);
		var end = new Date(end_date);
		var date_x = 0;
		var date_y = 6;
		var daycount = 0;
		
		if (this.unit === "day") {
			for (var y=start.getFullYear(); y<=end.getFullYear(); y++) {
				var endMonth = (y == end.getFullYear()) ? end.getMonth() : 11;
				var startMonth = (y == start.getFullYear()) ? start.getMonth() : 0;
				for (var m=startMonth; m <= endMonth; m++) {
					var endDay = (m == end.getMonth()) ? end.getDate() : end.getDaysInMonth(y, m);
					var startDay = (daycount > 0) ? 1 : start.getDate();
					for (var d=startDay; d <= endDay; d++) {
						// draw vertical grid line
						var line = new Rect(date_x, 0, 1, GANTT_TASK_BLK_HGT-1).addTo(this.header);
						var line2 = new Rect(date_x, 0, 1, stage.height).addTo(this.bg);
						// darker line for first day of a month
						if (d == 1) {
							line.fill(gantticc.header_color[0]);
							line2.fill(gantticc.header_color[0]);
						} else {
							line.fill('#eee');
							line2.fill('#eee');
						}
						// draw the date, add to header
						var tmp = new Date(y,m,d);
						var dateBlk = new DateBlock(this.header, date_x, date_y, tmp, d.toString());
						if (tmp.getDay() == 0 || tmp.getDay() == 6) dateBlk.setColor(gantticc.header_color[1]);
						gantticc.dates.push(dateBlk);
						date_x += GANTT_DAY_BLK_LEN;
						daycount++;
					}
				}
			}
		}
		else if (this.unit === "week") {
			var tmpDate = null;
			var weekCount = 0;
			for (var y=start.getFullYear(); y<=end.getFullYear(); y++) {
				var endMonth = (y == end.getFullYear()) ? end.getMonth() : 11;
				var startMonth = (y == start.getFullYear()) ? start.getMonth() : 0;
				for (var m=startMonth; m <= endMonth; m++) {
					var endDay = (m == end.getMonth()) ? end.getDate() : end.getDaysInMonth(y, m);
					var startDay = (weekCount > 0) ? 1 : start.getDate();
					for (var d=startDay; d < endDay; ) {
						var inc = 7;
						var day = new Date(y,m,d);
						// last week of the month
						if ( (day.getDaysInMonth(y, m) - d) < 6) {
							inc = -1; // do not render
							tmpDate = new Date(y, m, d); // next week starts here
							weekCount++;
						}
						// other weeks of the month
						else {
							// calculate increment to next Monday
							if (day.getDay() != 1) {
								var diff = 8 - day.getDay();
								if (diff == 8) diff = 1;
								if (diff == 7) diff = 0;
								inc = diff;
							}
							if (tmpDate != null) {
								day = tmpDate;
								tmpDate = null;
							}
						}
						if (inc < 0) break;
						// draw vertical grid line
						var line = new Rect(date_x, 0, 1, GANTT_TASK_BLK_HGT-1).addTo(this.header);
						var line2 = new Rect(date_x, 0, 1, stage.height).addTo(this.bg);
						// darker line for end of a month
						if (d == 1) {
							line.fill(gantticc.header_color[0]);
							line2.fill(gantticc.header_color[0]);
						} else {
							line.fill('#eee');
							line2.fill('#eee');
						}
						var w = day.getWeekNumber(day);
						var dateBlk = new DateBlock(this.header, date_x, date_y, day, w.toString());
						gantticc.dates.push(dateBlk);
						date_x += GANTT_DAY_BLK_LEN;
						daycount++;
						weekCount++;
						//console.log(day+" is week number "+w);
						if (inc == 0) break;
						d += inc;
					}
				}
			}
		}
		
		// draw the last vertical line
		var lastline = new Rect(date_x-1, 0, 1, stage.height).addTo(this.bg);
		var lastline2 = new Rect(date_x-1, 0, 1, GANTT_TASK_BLK_HGT-1).addTo(this.header);
		lastline.fill('#eee');
		lastline2.fill('#eee');
		// highlight today or current week
		var today = new Date();
		var today_x = TaskBlock.prototype.calculateXFromDate(today);
		if (today_x >= 0) {
			var mark = new Rect(today_x+1, 0, GANTT_DAY_BLK_LEN-1, stage.height).addTo(this.bg);
			var mark2 = new Rect(today_x+1, -1, GANTT_DAY_BLK_LEN-1, GANTT_TASK_BLK_HGT).addBefore(gantticc.dates[0].textAsset);
			mark.fill('#eee');
			mark2.fill('#eee');
		}
		// update total width
		this.width = daycount*GANTT_DAY_BLK_LEN;
		// make sure tasks are positioned correctly
		for (var i=0; i<gantticc.tasks.length; i++) {
			var tblk = gantticc.tasks[i];
			tblk.updateSpan(this.unit);
			var x_pos = tblk.calculateXFromDate(tblk.startDate);
			if (x_pos != tblk.x) {
				tblk.x = x_pos;
				tblk.group_asset.attr('x', x_pos);
			}
		}
		if (!this.mask) {
			this.mask = new Rect(0, -1, this.width, GANTT_TASK_BLK_HGT).fill('white');
			this.mask.addAfter(this.body);
		} else {
			this.mask.attr({ width: this.width });
		}
	},
	initTasks: function(arr) {
		this.mode = "gantt";
		if (gantticc.tasks.length > 0) {
			gantticc.tasks.length = 0;
			this.body.clear();
		}
		this.leftbar_titles.clear();
		if ((typeof arr) == 'undefined') return;
		for (var i = 0; i < arr.length; i++) {
			var t = arr[i];
			// calculate x coordinate
			var x_pos = TaskBlock.prototype.calculateXFromDate(new Date(t.start));
			var tb = new TaskBlock(this.body, x_pos, t);
			gantticc.tasks.push(tb);
			// correct span
			if (this.unit === "week") {
				tb.updateSpan(this.unit);
			}
		}
		// make sure tooltip is hidden
		if (this.tooltip_group) this.tooltip_group.attr('visible', false);
	},
	initHeatMap: function(data){
		var _gantt = this;
		_gantt.mode = "heatmap";
		if (gantticc.tasks.length > 0) {
			gantticc.tasks.length = 0;
			_gantt.body.clear();
		}
		if ((typeof data) == 'undefined') return;
		
		_gantt.leftbar_titles.clear();
		_gantt.heatmap = {
			min: parseInt(data.min),
			max: parseInt(data.max)
		};
		var projects = data.projects;
		for (var i=0; i < projects.length; i++) {
			var arr = projects[i];
			// create project title
			var y_pos = (i+1)*60+8;
			if (OFFSET_TXT_VERT_ALIGN) y_pos += 13;
			var title = new HeatMapTitle(_gantt.leftbar_titles, arr.title, {
				x: 0, y: y_pos,
				width: GANTT_UNIT_INDT_LEN-3,
				height: GANTT_TASK_BLK_HGT
			});
			for (var j=0; j<arr.data.length; j++) {
				var t = arr.data[j];
				if (t.tasks.length > _gantt.heatmap.min) {
					// do not render min (for performance)
					t.count = t.tasks.length.toString();
					t.y = (i+1)*60;
					// calculate x coordinate
					var x_pos = TaskBlock.prototype.calculateXFromDate(new Date(t.date));
					var tb = new TaskBlock(_gantt.body, x_pos, t);
					gantticc.tasks.push(tb);
				}
			}
		}
		// reset vertical scroll
		_gantt.y = 0;
		_gantt.body.attr('y', _gantt.y);
		// add tooltip to stage (floating)
		if (!_gantt.tooltip_group) {
			_gantt.tooltip_group = new Group().addTo(stage).attr('visible', false);
			_gantt.tooltip = new Text("0 tasks")
				.addTo(_gantt.tooltip_group)
				.attr({
					fontFamily: 'Helvetica, sans-serif',
					fontSize: '16px',
					textFillColor: gantticc.header_color[0]
				});
		}
		stage.on('heatmapblkmsover', function(task, e){
			var tt = (parseInt(task.count) == 1) ? " task" : " tasks";
			_gantt.tooltip.attr('text', task.count+tt);
			_gantt.tooltip_group.attr({
				x: e.x,
				y: task.y-15,
				visible: true
			});
		});
		stage.on('heatmapblkmsout', function(task, e){
			_gantt.tooltip_group.attr('visible', false);
		});
	},
	// @param count: should be an int
	getHeatMapColorOpacity: function(count){
		if (!this.heatmap.min && !this.heatmap.max) return;
		var q = (this.heatmap.max - this.heatmap.min)/10; // 10 is number of quantiles
		var val = (count / this.heatmap.max) * q;
		return val;
	},
	// @param anim: set to 1 to render animation
	scrollX: function(x_offset, anim) {
		this.x = this.x - x_offset;
		if (anim == 1) {
			ganttContext.animate('0.5s', {
				x: this.x
			}, {
				easing: 'sineInOut'
			});
		} else {
			ganttContext.attr('x', this.x);
		}
		this.updateCurrentUnit();
	},
	// @param anim: set to 1 to render animation
	scrollY: function(y_offset, anim) {
		this.y = this.y - y_offset;
		if (anim == 1) {
			this.body.animate('0.5s', {
				y: this.y
			}, {
				easing: 'sineInOut'
			});
		} else {
			this.body.attr('y', this.y);
		}
	},
	scrollCheck: function() {
		// make sure scroll is within boundries
		var max = GANTT_UNIT_INDT_LEN;
		if (this.width-stage.width < 0) {
			this.x = GANTT_UNIT_INDT_LEN;
		} else {
			if (this.x > max) {
				this.x = max;
			} else if (Math.abs(this.x) > (this.width-stage.width)) {
				this.x = -1*(this.width-stage.width);
			}
		}
		ganttContext.animate('0.5s', {
			x: this.x
		}, {
			easing: 'sineOut'
		});
		this.updateCurrentUnit();
		if (this.y > 0) {
			this.y = 0;
			this.body.animate('0.3s', {
				y: this.y
			}, {
				easing: 'sineOut'
			});
		}
	},
	scrollToDate: function(date) {
		var x = TaskBlock.prototype.calculateXFromDate(date);
		if (x >= 0) {
			var diffx = x-Math.abs(this.x - GANTT_UNIT_INDT_LEN);
			this.scrollX(diffx, 1);
			this.updateCurrentUnit();
		}
	},
	// @param force: set to any value to force update
	updateCurrentUnit: function(force) {
		if ((typeof force) == "undefined" && this.x > GANTT_UNIT_INDT_LEN) return;
		var date = TaskBlock.prototype.calculateDateFromX(-1*this.x+GANTT_UNIT_INDT_LEN);
		if (date == null) return;
		var t = "";
		if (this.unit === "day") {
			t = date.getLiteralMonth(date.getMonth());
		} else {
			t = date.getFullYear().toString();
			t = "'"+t.substr(2, 2);
		}
		this.unitIndicator.attr({text: t});
	},
	scrollSnapX: function() {
		var new_x = this.positionSnapX(-1*this.x, 0);
		if (this.x != new_x) {
			var diffx = new_x - Math.abs(this.x - 8); // 8 is the offset for showing grid line
			this.scrollX(diffx, 1);
		}
	},
	getScrollDate: function() {
		var d = TaskBlock.prototype.calculateDateFromX(-1*this.x+GANTT_UNIT_INDT_LEN);
		return d;
	},
	// @param color: color to control
	// @param enable: true to show, false to hide
	highlightTaskByColor: function(color, enable) {
		for (var i=0; i<gantticc.tasks.length; i++) {
			var tblk = gantticc.tasks[i];
			if (tblk.color == color) {
				tblk.group_asset.attr({ visible: enable });
			}
		}
	}
};

function HeatMapTitle(context, text, size) {
	this.x = size.x;
	this.y = size.y;
	this.text = text;
	this.width = size.width;
	this.height = size.height;
	this.show(context);
}

HeatMapTitle.prototype = {
	show: function(context) {
		this.title_asset = new Text(this.text).addTo(context)
			.attr({
				x: this.x, y: this.y,
				fontFamily: 'Helvetica, sans-serif',
				fontSize: '18px',
				textFillColor: color.parse(gantticc.header_color[0])
			});
	}
};

Date.prototype.getDaysInMonth = function (year, month) {
    return new Date(year, month+1, 0).getDate();
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
Date.prototype.getWeeksInYear = function (Y) {
	return 52 +
  (  new Date(Y,  0,  1).getDay()==4
  || new Date(Y, 11, 31).getDay()==4 ) };
Date.prototype.getLiteralMonth = function(m) {
	var monthNames = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun",
	    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];
	return monthNames[m];
}

// The entry point
var gchart = new Gantt(0, 0);