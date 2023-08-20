class Tilegroup{
    constructor(x, y, width, height, horizontal) {
        this.windows = [];
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.horizontal = horizontal;
    }
    add_window(window, cursor) {
        window.is_snapped = true;
        window.tilegroup = this;

        let descriptor = new tiling.window_descriptor(window, windowing.get_index(window))
        let index = this.windows.length;
        let replacement = get_replacement_index(this.windows, cursor, this.horizontal);
        if(replacement)
            index = replacement;
        this.windows.splice(index, 0, descriptor);
    }
    draw(meta_windows) {
        if(!this.horizontal) {
            let x = this.x;
            for(let i = 0; i < this.windows.length; i++) {
                let window = this.windows[i];
                let meta_window = meta_windows[window.index];
                if(meta_window.is_snapped) {
                    windowing.move_window(meta_window, false, x, this.y, this.width, this.height / this.windows.length);
                    x += this.height / this.windows.length;
                } else {
                    this.windows.splice(i, 1);
                    i--;
                    continue;
                }
            }
        }
    }
}

function get_replacement_index(windows, cursor, horizontal) {
    if(!horizontal) {
        for(let i in windows) {
            let window = windows[i];
            if( cursor.x >= window.x &&
                cursor.x <= window.x + window.width &&
                cursor.y >= window.y - window.height / 2 &&
                cursor.y < window.y + window.height / 2)
                return i;
        }
    } else {
        for(let i in windows) {
            let window = windows[i];
            if( cursor.x >= window.x - window.width / 2 &&
                cursor.x < window.x + window.width / 2&&
                cursor.y >= window.y &&
                cursor.y <= window.y)
                return i;
        }
    }
    return null;
}

function create_feedforward() {
    
}

function create(x, y, width, height, workspace, window, horizontal) {
    if(!workspace.tilegroups)
        workspace.tilegroups = [];
    let tilegroup = new Tilegroup(x, y, width, height, horizontal);
    tilegroup.add_window(window, false);
    workspace.tilegroups.push(tilegroup);
}

function drag_loop(workspace, monitor, cursor) {
    let tilegroup = has_tilegroup(workspace, monitor, cursor);
}

function drag_end_handler(workspace, monitor, meta_window, cursor) {
    let work_area = workspace.get_work_area_for_monitor(monitor);

    let tilegroup = has_tilegroup(workspace, monitor, cursor);
    if(!tilegroup) {
        // Vertical tile group
        if(cursor.x <= work_area.x + 30) {
            create(work_area.x, work_area.y, work_area.width / 2, work_area.height, workspace, meta_window, false);
            return;
        }
        if(cursor.x >= work_area.x + work_area.width - 30) {
            create(work_area.x + work_area.width / 2, work_area.y, work_area.width / 2, work_area.height, workspace, meta_window, false);
            return;
        }
        // Horizontal tile group
        if(cursor.y <= work_area.y + 30 && cursor.y >= work_area.y + 4) {
            create(work_area.x, work_area.y, work_area.width, work_area.height / 2, workspace, meta_window, true);
            return;
        }
        if(cursor.y >= work_area.y + work_area.height - 30) {
            create(work_area.x, work_area.y + work_area.height / 2, work_area.width, work_area.height / 2, workspace, meta_window, true);
            return;
        }
    } else {
    }
}

function present(workspace,) {

}

function has_tilegroup(workspace, monitor, cursor) {
    if(!workspace.tilegroups) return false;
    for(let tilegroup of workspace.tilegroups) {
        if( cursor.x > tilegroup.x &&
            cursor.x < tilegroup.x + tilegroup.width &&
            cursor.y > tilegroup.y &&
            cursor.y < tilegroup.y + tilegroup.height)
            return tilegroup;
    }
    return false;
}

function get_real_work_area(workspace, monitor) {

}