const extension = imports.misc.extensionUtils.getCurrentExtension();
const enums = extension.imports.enums;

/* Wingroup class
    Every window has a wingroup.
    Windows in a wingroup can only travel horizontally, and every window has a child wingroup.
    The algorithm will run through them all recursively to determine the best place for a window.
*/
class Tilegroup {
    constructor(max_width, max_height, root, x, y, id) {
        this.windows = [];
        this.x = x;
        this.y = y;
        this.width = 0;
        this.height = 0;
        this.max_width = max_width;
        this.max_height = max_height;
        this.root = root;
        if(!this.root)
            this.root = this;
        this.id = id + 1;
    }
    check_fit(window) {
        if(this.width + enums.window_spacing + window.width > this.max_width ||
            window.height > this.max_height)
            return false;
        return true
    }
    get_new_area(window) {
        return Math.max(this.x + window.width, this.root.width) * Math.max(this.y + window.height, this.root.height);
    }
    get_optimal(window) {
        let minimum_area = this.get_new_area(window);
        if(!this.check_fit(window)) // If the window will exceed wingroup bounds, force it to go to a subgroup
            minimum_area = Infinity;
        let target_window = null;
        for(let _window of this.windows) {
            if(!_window.subgroup.check_fit(window))
                continue;
            // See if placing the window under is better
            let area = _window.subgroup.get_new_area(window);
            let optimal = _window.subgroup.get_optimal(window).area; // Check if it is better to use the subgroup
            if(optimal && optimal < area && optimal !== Infinity)
                area = optimal;
            if(area < minimum_area) {
                minimum_area = area;
                target_window = _window;
            }
        }
        return {
            area: minimum_area,
            window: target_window
        }
    }
    add_windows(windows, meta_windows, move_windows) {
        for(let window of windows) {
            let status = this.add_window(window);
            if(status === null && get_all_workspace_windows().length > 1 && move_windows) {
                // TODO: Define behavior for windows that cannot fit
                let focus_window = get_focused_window()
                let workspace = win_to_new_workspace(focus_window, false);
                let new_windows = windows;
                for(let i = 0; i < new_windows.length; i++) {
                    if(meta_windows[new_windows[i].index].get_id() === focus_window.get_id()) {
                        new_windows.splice(i, 1);
                        break;
                    }
                }
                new_windows.sort((a, b) => b.width - a.width);
                this.windows = [];
                this.add_windows(new_windows, meta_windows, false);
                workspace.activate(0);
            }
        }
    }
    add_window(window) {
        let optimal = this.get_optimal(window);
        if(optimal.area === Infinity) {
            // If window cannot fit at all, return null
            return null;
        }
        if(optimal.window === null) {
            // Add window to the side
            window.subgroup = new Tilegroup(window.width, window.height, this.root, this.x + this.width + enums.window_spacing, this.y + window.height + enums.window_spacing, this.id);
            this.windows.push(window);
            this.width += window.width;
            this.height = Math.max(this.height, window.height);
            this.root.width = Math.max(this.root.width, this.x + window.width);
            this.root.height = Math.max(this.root.height, this.y + window.height);
            return;
        }
        optimal.window.subgroup.add_window(window);
    }
    get_width() {
        let width = 0;
        for(let window of this.windows)
            width += window.width;
        return width;
    }
    get_height(window) {
        let height = window.height;
        let max_height = 0;
        for(let _window of window.subgroup.windows) {
            let _height = this.get_height(_window);
            max_height = Math.max(_height, max_height);
        }
        height += max_height;
        return height;
    }
    draw_windows(meta_windows, offset, x_offset) {
        let x = 0;
        for(let window of this.windows) {
            let _offset = offset;
            if(!offset)
                _offset = (this.max_height / 2) - (this.get_height(window) / 2);
            move_window(meta_windows[window.index], false, Math.round(this.x + x + x_offset), Math.round(this.y + _offset), window.width, window.height); // Draw initial window
            window.subgroup.draw_windows(meta_windows, _offset, x_offset);
            x += window.width + enums.window_spacing;
        }
    }
    get_center_offset(x, y) {
        return {
            x: ((this.max_width) / 2) - (this.width / 2) + x,
            y: ((this.max_height) / 2) - (this.height / 2) + y,
        }
    }
}

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

window_descriptor.prototype.check_available_space = function(space, window) {
    if(this.vertical_children) {
        // Children should be placed under window

        if(window.width > this.width) // Check window can properly fit under
            return false;
        let new_height = this.total_height + enums.window_spacing + window.height;
        return Math.max(new_height, space.height) * space.width; // Return the new space area
    } else {
        // Children should be placed to the right of the window
    }
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

function z_sort(windows, work_area) {
    if(windows.length === 0)
        return;
    let space = {
        width: 0,
        height: 0
    };

    let horizontal_windows = [];
    // Now, sort the windows
    for(let window of windows) {
        let parent_index = null;
        let new_width = space.width + enums.window_spacing + window.width;
        let minimum_area
        if(new_width <= work_area.width) // If the window will fit when placed horizontally
            minimum_area = (space.width + enums.window_spacing + window.width) * Math.max(window.height, space.height); // Set minimum area is the area if the window is placed horizontally
        else // If not, default to putting it as a child
            minimum_area = Infinity;
        for(let i = 0; i < horizontal_windows.length; i++) {
            let available = horizontal_windows[i].check_available_space(space, window);
            if(available && available < minimum_area) {// If the new area is smaller than what has been currently measured
                minimum_area = available
                parent_index = i;
            }
        }
        if(parent_index === null){
            if(space.width + enums.window_spacing + window.width > work_area.width) { // If the window cannot fit, send it to a new workspace and switch
                continue; // Undefined behavior (for now)
            }
            horizontal_windows.push(window);
            space.width += window.width + enums.window_spacing;
            space.height = Math.max(space.height, window.height);
        } else if(parent_index >= 0) {
            let parent = horizontal_windows[parent_index];
            parent.children.push(window);
            parent.total_height += window.height + enums.window_spacing;
            space.height = Math.max(space.height, parent.total_height);
        }
    }

    // TODO: Add multi-pass sorting code to get optimal shape for windows
    return {
        windows: horizontal_windows,
        space: space
    }; // Return the set of rectangle vectors and their children
}

function draw_window_vectors(meta_windows, window_vectors, work_area) {
    if(!window_vectors)
        return;
    // Draw the windows on-screen
    let windows = window_vectors.windows;
    let space = window_vectors.space;

    let x = (work_area.width - space.width) / 2 + work_area.x;
    let y = (work_area.height - space.height) / 2 + work_area.y;
    for(let window of windows) {
        move_window(meta_windows[window.index], false, x, y, window.width, window.height);
        let _y = y + window.height + enums.window_spacing;
        for(let child of window.children) {
            move_window(meta_windows[child.index], false, x, _y, child.width, child.height);
            _y += child.height + enums.window_spacing;
        }
        x += window.width + enums.window_spacing;
    }
}