const extension = imports.misc.extensionUtils.getCurrentExtension();

const enums = extension.imports.enums;
const Meta = imports.gi.Meta;

function get_all_windows() {
    let windows = [];
    let n_workspaces = global.workspace_manager.get_n_workspaces();
    for(let i = 0; i < n_workspaces; i++) {
        let workspace_windows = global.workspace_manager.get_workspace_by_index(i).list_windows();
        for(let j = 0; j < workspace_windows.length; j++)
            windows.push(workspace_windows[j]);
    }
    return windows;
}

function get_all_workspace_windows() {
    return global.workspace_manager.get_active_workspace().list_windows();
}

function move_window(window, ignore_top_bar, x, y, w, h) {
    window.move_resize_frame(ignore_top_bar, x, y, w, h);
}

function configure_window(window) {
    
}

function win_to_new_workspace(window) {
    let workspace = global.workspace_manager.append_new_workspace(false, 0); // Create new workspace
    let active_workspace_index = global.workspace_manager.get_active_workspace_index();
    global.workspace_manager.reorder_workspace(workspace, active_workspace_index + 1) // Move the new workspace to the right of the current workspace
    window.change_workspace(workspace); // Move window to new workspace
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

function sort_workspace_windows(workspace, move_maximized_windows) {
    let windows = workspace.list_windows();
    let work_area = workspace.get_work_area_for_monitor(0);
    sort_windows(windows, work_area, move_maximized_windows);
}


function sort_windows(windows, work_area, move_maximized_windows) {
    /* Window sorting algorithm
        The goal of this algorithm is to make the windows
        organize themselves as squarely possible. This makes
        it look pretty while also presenting as many windows as possible.
    */
    let space = {
        x: 0,
        y: 0,
        width: 0,
        height: 0
    };
    let levels = [];
    let width = 0;
    let height = 0;
    for(let i = 0; i < windows.length; i++) { // Get width of window collection
        let window = windows[i];
        if(window.maximized_horizontally === true && window.maximized_vertically === true && get_all_workspace_windows().length !== 1) {
            if(move_maximized_windows) // If we are wanting to deal with maximized windows, move them to a new workspace.
                win_to_new_workspace(window);
            windows.splice(i, 1);
            i--;
            continue; // Skip windows that are maximized otherwise. They will be dealt with by the size-changed listener.
        }

        // Get width and height of window collection
        let frame = window.get_frame_rect();
        if(frame.width + width > work_area.width) {
            space.height += height + enums.window_spacing;
            space.width += width;
            levels.push({width: width, height: height});
            height = 0;
            width = 0;
        }
        width += frame.width + enums.window_spacing;
        height = Math.max(height, frame.height);
    }
    if(height !== 0 || width !== 0) levels.push({width: width, height: height});
    space.width += width;
    space.height += height;
    let current_level_index = 0;
    let level = levels[current_level_index];
    if(!level)
        return;
    let x = (work_area.width - level.width) / 2 + work_area.x;
    let y = (work_area.height - space.height) / 2 + work_area.y;

    for(let window of windows) {
        let frame = window.get_frame_rect();
        if(frame.width + x > work_area.width) {
            y += level.height + enums.window_spacing;
            current_level_index++;
            level = levels[current_level_index];

            x = (work_area.width - level.width) / 2 + work_area.x;
        }
        move_window(window, false, x, y, frame.width, frame.height);
        x += frame.width + enums.window_spacing;
    }
}