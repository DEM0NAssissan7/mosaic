const extension = imports.misc.extensionUtils.getCurrentExtension();
const enums = extension.imports.enums;

function get_primary_display() {
    return global.display.get_primary_monitor();
}

function get_workspace() {
    return global.workspace_manager.get_active_workspace();
}

function get_all_windows() {
    return global.display.list_all_windows();
}

function get_focused_window() {
    let windows = get_all_windows();
    for(let window of windows) {
        if(window.has_focus())
            return window;
    }
}

function get_all_workspace_windows() {
    return get_workspace().list_windows();
}

function move_window(window, ignore_top_bar, x, y, w, h) {
    window.move_resize_frame(ignore_top_bar, x, y, w, h);
}

function configure_window(window) {
    
}

function win_to_new_workspace(window, switch_to_new) {
    let workspace = global.workspace_manager.append_new_workspace(false, 0); // Create new workspace
    let active_workspace = get_workspace();
    global.workspace_manager.reorder_workspace(workspace, active_workspace.index() + 1) // Move the new workspace to the right of the current workspace
    window.change_workspace(workspace); // Move window to new workspace
    let offset = global.display.get_monitor_geometry(window.get_monitor()); // Get top bar offset (if applicable)
    let frame = window.get_frame_rect();
    move_window(window, false, 0, offset, frame.width, frame.height - offset);
    if(switch_to_new) workspace.activate(0);
    return workspace; // Return new workspace
}

function move_back_window(window) {
    let workspace = window.get_workspace();
    let previous_workspace = workspace.get_neighbor(-3);
    if(!previous_workspace) {
        console.error("There is no workspace to the left.");
        return;
    }
    window.change_workspace(previous_workspace); // Move window to previous workspace
    previous_workspace.activate(0); // Switch to it
    global.workspace_manager.remove_workspace(workspace, 0); // Clean old workspace
    return previous_workspace;
}

function window_descriptor(window, index) {
    let frame = window.get_frame_rect();

    this.index = index;
    this.x = frame.x;
    this.y = frame.y;
    this.width = frame.width;
    this.height = frame.height;
    this.total_height = frame.height;
    this.total_width = frame.width;
    this.maximized_horizontally = window.maximized_horizontally;
    this.maximized_vertically = window.maximized_vertically;
    this.vertical_children = true;
}

function sort_workspace_windows(workspace, move_maximized_windows) {
    let meta_windows = workspace.list_windows();

    // Put needed window info into an enum so it can be transferred between arrays
    let window_descriptors = [];
    for(let i = 0; i < meta_windows.length; i++) {
        let window = meta_windows[i];
        // Check if the window is maximized, and move it over if it is
        if((window.maximized_horizontally === true && window.maximized_vertically === true) && get_all_workspace_windows().length !== 1) {
            if(move_maximized_windows) // If we are wanting to deal with maximized windows, move them to a new workspace.
                win_to_new_workspace(window, false);
            continue; // Skip windows that are maximized otherwise. They will be dealt with by the size-changed listener.
        }
        window_descriptors.push(new window_descriptor(window, i));
    }
    // Advanced sorter
    let windows = [];
    const advanced_sorter = false;
    if(advanced_sorter) {
        let vertical = false;
        while(window_descriptors.length > 0) {
            let window;
            let index;
            if(vertical) {
                // Get tallest unused window
                let max = 0;
                for(let i = 0; i < window_descriptors.length; i++) {
                    let _window = window_descriptors[i];
                    if(_window.height > max) {
                        max = _window.height;
                        index = i;
                        window = _window;
                    }
                }
                vertical = false;
            } else {
                // Get longest unused window
                let max = 0;
                for(let i = 0; i < window_descriptors.length; i++) {
                    let _window = window_descriptors[i];
                    if(_window.width > max) {
                        max = _window.width;
                        index = i;
                        window = _window;
                    }
                }
                vertical = true;
            }
            windows.push(window);
            window_descriptors.splice(index, 1);
        }
    } else {
        windows = window_descriptors.sort((a, b) => b.width - a.width);
    }

    let n_displays = global.display.get_n_monitors(); // Sort on all monitors
    for(let i = 0; i < n_displays; i++) {
        let work_area = workspace.get_work_area_for_monitor(i);
        // Check for snap tiled windows and adjust work area accordingly
        for(let i = 0; i < windows.length; i++) {
            let window = windows[i];
            if(window.maximized_horizontally === false && window.maximized_vertically === true && windows.length !== 1) {
                let spaced_width = window.width + enums.window_spacing;
                if(window.x + window.width === work_area.width)
                    work_area.width -= spaced_width;
                if(window.x === work_area.x) {
                    work_area.x += spaced_width;
                    work_area.width -= spaced_width;
                }
                windows.splice(i, 1);
                i--;
            }
        }
        let top_bar_height = global.display.get_monitor_geometry(i).height - work_area.height;
        let root_wingroup = new Tilegroup(work_area.width, work_area.height, false, 0, top_bar_height, -1);
        root_wingroup.add_windows(windows, meta_windows, workspace.index() === get_workspace().index());
        root_wingroup.draw_windows(meta_windows, false, root_wingroup.get_center_offset(work_area.x, work_area.y).x);
    }
}