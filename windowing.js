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
    let previous_workspace = global.workspace_manager.get_workspace_by_index(workspace.index() - 1);
    window.change_workspace(previous_workspace); // Move window to previous workspace
    previous_workspace.activate(0); // Switch to it
    global.workspace_manager.remove_workspace(workspace); // Clean old workspace
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
    let sorted_windows = [];
    let levels = [[]];
    let current_level = 0;
    for(let i = 0; i < windows.length; i++) {
        let window = windows[i];
        if(window.maximized_horizontally === true && window.maximized_vertically === true && get_all_workspace_windows().length !== 1) {
            if(move_maximized_windows) // If we are wanting to deal with maximized windows, move them to a new workspace.
                win_to_new_workspace(window);
            continue; // Skip windows that are maximized otherwise. They will be dealt with by the size-changed listener.
        }

        // Window sorter
        let frame = window.get_frame_rect();
        if(space.height < space.width) { // If the rectangle is more stretched horizontally, add more height
            if(frame.width <= work_area.width - space.width) {
                space.height += frame.height;
                space.width += Math.max(0, frame.width - space.width);
            }
        } else { // If the rectangle is more vertically stretched, add more width
            if(frame.height <= work_area.height - space.height) {
                space.width += frame.width;
                space.height += Math.max(0, frame.height - space.height);
            }
        }
    }
}