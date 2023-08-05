const extension = imports.misc.extensionUtils.getCurrentExtension();
const enums = extension.imports.enums;
const windowing = extension.imports.windowing;

let total_width = 0;
let total_height = 0;
let max_width = 0;
let max_height = 0;
class window_descriptor{
    constructor(meta_window, index) {
        let frame = meta_window.get_frame_rect();

        this.index = index;
        this.x = 0;
        this.y = 0;
        this.width = frame.width;
        this.height = frame.height;
        this.maximized_horizontally = meta_window.maximized_horizontally;
        this.maximized_vertically = meta_window.maximized_vertically;
        this.child_far_y_limit;
        this.right_child = false;
        this.under_child = false;
    }
    check_fit_right(window) {
        if(window.height > this.height)
            return false;
        if(this.x + this.width + enums.window_spacing + window.width > max_width)
            return false;
        return true;
    }
    check_fit_under(window) {
        if(window.width > this.width)
            return false;
        let child_far_y = this.y + this.height + enums.window_spacing + window.height;
        if(child_far_y > max_height)
            return false;
        if(child_far_y > this.child_far_y_limit)
            return false;
        return true;
    }
    check_possible_fit(window) {
        if(!this.check_fit_right(window) && !this.check_fit_under(window))
            return false;
        return true;
    }
    get_area_right(window) {
        let new_width = Math.max(this.x + this.width + enums.window_spacing + window.width, total_width);
        let display_ratio = max_width / max_height;
        let new_ratio = new_width / total_height;
        return Math.abs(display_ratio - new_ratio); // Make the windows as close to the display ratio as possible. Looks nice :)
    }
    get_area_under(window) {
        let new_height = Math.max(this.y + this.height + enums.window_spacing + window.height, total_height);
        let display_ratio = max_width / max_height;
        let new_ratio = total_width / new_height;
        return Math.abs(display_ratio - new_ratio);
    }
    draw_window(meta_windows, x_offset, y_offset) {
        windowing.move_window(meta_windows[this.index],
                            false,
                            this.x + x_offset,
                            this.y + y_offset,
                            this.width,
                            this.height);
        if(this.right_child)
            this.right_child.draw_window(meta_windows, x_offset, y_offset);
        if(this.under_child)
            this.under_child.draw_window(meta_windows, x_offset, y_offset);
    }
    add_right_child(window) {
        total_width = Math.max(this.x + this.width + enums.window_spacing + window.width, total_width);
        window.x = this.x + this.width + enums.window_spacing;
        window.y = this.y;
        window.child_far_y_limit = this.y + this.height + enums.window_spacing;
        this.right_child = window;
    }
    add_under_child(window) {
        total_height = Math.max(this.y + this.height + enums.window_spacing + window.height, total_height);
        window.x = this.x;
        window.y = this.y + this.height + enums.window_spacing;
        window.child_far_y_limit = this.child_far_y_limit;

        this.under_child = window;
    }
    get_optimal_handler(child_window) {
        let handler = null;
        let area = Infinity;

        let optimal;
        // Check the right space
        if(!this.right_child) {
            if(this.check_fit_right(child_window)) {
                area = this.get_area_right(child_window);
                handler = window => this.add_right_child(window);
            }
        } else
            optimal = this.right_child.get_optimal_handler(child_window); // Get right space optimal if there is already a right child

        // Check under space
        if(!this.under_child) { // If there is space under
            if(this.check_fit_under(child_window)) {
                let area_under = this.get_area_under(child_window);
                if(area_under < area || handler === null) { // If the area under is less than the area on the right
                    area = area_under;
                    handler = window => this.add_under_child(window);
                }
            }
        } else { // If there is a child
            let _optimal = this.under_child.get_optimal_handler(child_window); // Get the under optimal
            // Compare it to right space optimal
            if(_optimal) {
                if(!optimal)
                    optimal = _optimal;
                else if(_optimal.area < optimal.area)
                    optimal = _optimal;
            }
        }

        // Check to see if the best optimal is better than the best local area calculation
        if(optimal) {
            if(optimal.area < area) {
                area = optimal.area;
                handler = optimal.handler;
            }
        }

        return {
            area: area,
            handler: handler
        };
    }
}

function advanced_sort(_windows) {
    let output_windows = [];
    let windows = _windows;
    let vertical = true;
    while(windows.length > 0) {
        let window;
        let index;
        let max = 0;
        if(vertical) {
            // Get tallest unused window
            for(let i = 0; i < windows.length; i++) {
                let _window = windows[i];
                if(_window.height > max || !max) {
                    max = _window.height;
                    index = i;
                    window = _window;
                }
            }
            vertical = false;
        } else {
            // Get longest unused window
            for(let i = 0; i < windows.length; i++) {
                let _window = windows[i];
                if(_window.width > max || !max) {
                    max = _window.width;
                    index = i;
                    window = _window;
                }
            }
            vertical = true;
        }
        output_windows.push(window);
        windows.splice(index, 1);
    }
    return output_windows;
}

// let sort_algorithm = advanced_sort;
// let sort_algorithm = windows => windows.sort((a, b) => b.width * b.height - a.width * a.height);
let sort_algorithm = windows => windows.sort((a, b) => b.height - a.height);
// let sort_algorithm = advanced_sort;

function windows_to_descriptors(meta_windows, monitor) {
    let descriptors = [];
    for(let i = 0; i < meta_windows.length; i++) {
        let meta_window = meta_windows[i];
        // Exclusion clause: windows we do not want to tile
        if( meta_window.is_hidden() ||
            meta_window.is_attached_dialog() ||
            meta_window.window_type !== 0 ||
            meta_window.get_monitor() !== monitor
            )
            continue;
        descriptors.push(new window_descriptor(meta_window, i));
    }
    return descriptors;
}

function ztile(_windows, meta_windows, work_area, new_meta_window, keep_oversized_windows, skip_window_draw) {
    total_width = 0;
    total_height = 0;
    max_width = work_area.width;
    max_height = work_area.height;
    if(_windows.length === 0)
        return;
    let windows = sort_algorithm(_windows); // Use advanced sort to get through windows
    let root_window = windows[0];
    total_width = root_window.width;
    total_height = root_window.height;
    for(let i = 1; i < windows.length; i++) {
        let window = windows[i];
        let optimal = root_window.get_optimal_handler(window);
        if(new_meta_window) {
            let monitor = new_meta_window.get_monitor();
            if(optimal.area === Infinity &&
                windowing.get_all_workspace_windows(monitor).length > 1)
            {
                if(skip_window_draw)
                    return false;
                /* For windows that cannot fit, we move the new window (if applicable) to a new workspace
                    and focus it.
                */
                let new_windows = windows;
                for(let i = 0; i < new_windows.length; i++) {
                    if(meta_windows[new_windows[i].index].get_id() === new_meta_window.get_id()) {
                        new_windows.splice(i, 1);
                        break;
                    }
                }
                new_windows = sort_algorithm(new_windows);
                ztile(new_windows, meta_windows, work_area, false, true);
                if(!keep_oversized_windows)
                    windowing.move_oversized_window(new_meta_window);
                return;
            }
        }
        if(optimal.handler)
            optimal.handler(window);
    }
    let x = (max_width - total_width) / 2 + work_area.x;
    let y = (max_height - total_height) / 2 + work_area.y;
    if(skip_window_draw)
        return true;
    root_window.draw_window(meta_windows, x, y);
}

function tile_workspace_windows(workspace, reference_meta_window, monitor, keep_oversized_windows, skip_window_draw) {
    if(!workspace) // Failsafe for undefined workspace
        return;
    let meta_windows = workspace.list_windows();
    if(meta_windows.length === 0)
        return;

    let current_monitor = null;
    if(reference_meta_window)
        current_monitor = reference_meta_window.get_monitor();
    else
        current_monitor = monitor;

    if(!(current_monitor >= 0) || current_monitor === null) // If there is no monitor
        throw new Error("No window specified: " + current_monitor); // Throw an error

    // Put needed window info into an enum so it can be transferred between arrays
    let windows = windows_to_descriptors(meta_windows, current_monitor);

    let work_area = workspace.get_work_area_for_monitor(current_monitor); // Get working area for current space
    return ztile(windows, meta_windows, work_area, reference_meta_window, keep_oversized_windows, skip_window_draw);
}

function test_window_fit(window, workspace, monitor) {
    return tile_workspace_windows(workspace, window, monitor, true, true);
}
