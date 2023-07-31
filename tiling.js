const extension = imports.misc.extensionUtils.getCurrentExtension();
const enums = extension.imports.enums;
const windowing = extension.imports.windowing;

/* Tilegroup class
    Every window has a tilegroup.
    Windows in a tilegroup can only travel horizontally, and every window has a child tilegroup.
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
        this.id = id;
    }
    check_fit(window) {
        if(this.width + window.width > this.max_width ||
            window.height > this.max_height)
            return false;
        return true
    }
    get_new_area(window) {
        return Math.max(this.width + enums.window_spacing + window.width, this.root.width) * Math.max(window.height, this.root.height);
    }
    get_optimal(window) {
        let minimum_area = this.get_new_area(window); // Area if added to side
        if(!this.check_fit(window)) // If the window will exceed tilegroup bounds, force it to go to a subgroup
            minimum_area = Infinity;
        let tilegroup = this;
        for(let _window of this.windows) {
            let subgroup = _window.subgroup;
            if(!subgroup.check_fit(window))
                continue;
            // See if placing the window under is better
            let area = subgroup.get_new_area(window);
            let optimal = subgroup.get_optimal(window); // Check if it is better to use the subgroup
            if(optimal.area < area && optimal.area !== Infinity) {
                area = optimal.area;
                subgroup = optimal.tilegroup;
            }
            if(area < minimum_area) {
                minimum_area = area;
                tilegroup = subgroup;
            }
        }
        return {
            area: minimum_area,
            tilegroup: tilegroup
        }
    }
    add_new_window(window) {
        let new_width = this.width;
        if(this.id === 0 || new_width === 0)
            new_width = window.width;
        window.subgroup = new Tilegroup( // Subgroup
            new_width, // Max width
            this.max_height - window.height, // Max height
            this.root, // Root
            this.x + this.width, // X
            this.y + enums.window_spacing + window.height, // Y
            this.id + 1); // ID
        this.windows.push(window);
        this.width += enums.window_spacing + window.width;
        this.height = Math.max(this.height, window.height);
        this.root.width = Math.max(this.root.width, this.x + this.width);
        this.root.height = Math.max(this.root.height, this.y + window.height);
    }
    add_window(window) {
        let optimal = this.get_optimal(window);
        if(optimal.area === Infinity)// If window cannot fit at all
            return null;
        // Add window to the tilegroup
        optimal.tilegroup.add_new_window(window);
    }
    get_width() {
        let width = 0;
        for(let window of this.windows)
            width += window.width;
        return width;
    }
    get_height(window) {
        // Get total window height
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
            // Prevent redundant window movements
            let _x = Math.round(this.x + x + x_offset);
            let _y = Math.round(this.y + _offset);
            let _width = window.width;
            let _height = window.height;
            let meta_window = meta_windows[window.index];
            let frame = meta_window.get_frame_rect();
            if( frame.x !== _x ||
                frame.y !== _y ||
                frame.width !== _width ||
                frame.height !== _height)
            {
                windowing.move_window(meta_window, false, Math.round(this.x + x + x_offset), Math.round(this.y + _offset), window.width, window.height); // Draw initial window
            }
            window.subgroup.draw_windows(meta_windows, _offset, x_offset);
            x += window.width + enums.window_spacing;
        }
    }
    get_center_x_offset(work_area) {
        return ((work_area.width) / 2) - (this.width / 2) + work_area.x;
    }
}

function window_descriptor(meta_window, index) {
    let frame = meta_window.get_frame_rect();

    this.index = index;
    this.x = frame.x;
    this.y = frame.y;
    this.width = frame.width;
    this.height = frame.height;
    this.total_height = frame.height;
    this.total_width = frame.width;
    this.maximized_horizontally = meta_window.maximized_horizontally;
    this.maximized_vertically = meta_window.maximized_vertically;
    this.vertical_children = true;
}

function add_windows(tilegroup, windows, meta_windows, new_meta_window, keep_oversized_windows) {
    for(let window of windows) {
        let status = tilegroup.add_window(window);
        if(status === null && windowing.get_all_workspace_windows().length > 1) {
            if(new_meta_window) {
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
                new_windows.sort((a, b) => b.width - a.width);
                tilegroup.windows = [];
                add_windows(tilegroup, new_windows, meta_windows, false, keep_oversized_windows);
                if(!keep_oversized_windows) {
                    let workspace = windowing.win_to_new_workspace(new_meta_window, false);
                    tile_workspace_windows(workspace, new_meta_window, false, true); // Tile new workspace for window
                    workspace.activate(0);
                }
            } else {
                // TODO: Define behavior for windows that are resized but cannot fit
            }
        }
    }
}

function windows_to_descriptors(meta_windows) {
    let descriptors = [];
    for(let i = 0; i < meta_windows.length; i++) {
        let meta_window = meta_windows[i];
        // Exclusion clause: windows we do not want to tile
        if( meta_window.is_hidden() ||
            meta_window.is_attached_dialog() ||
            meta_window.window_type !== 0)
        {
            continue;
        }
        descriptors.push(new window_descriptor(meta_window, i));
    }
    return descriptors;
}

function tile_workspace_windows(workspace, reference_meta_window, monitor, keep_oversized_windows) {
    if(!workspace) // Failsafe for undefined workspace
        return;
    let meta_windows = workspace.list_windows();

    // Put needed window info into an enum so it can be transferred between arrays
    // Also sort by widest to thinnest
    const use_advanced_sort = true;
    let windows = windows_to_descriptors(meta_windows);
    if(use_advanced_sort)
        windows = advanced_sort(windows);
    else
        windows = windows.sort((a, b) => b.width - a.width)

    let current_monitor;
    if(reference_meta_window)
        current_monitor = reference_meta_window.get_monitor();
    else
        current_monitor = monitor;
    let work_area = workspace.get_work_area_for_monitor(current_monitor); // Get working area for current space

    const top_bar_height = global.display.get_monitor_geometry(current_monitor).height - work_area.height;
    let root_wingroup = new Tilegroup(
        work_area.width,
        work_area.height,
        false,
        0,
        top_bar_height,
        0);
    add_windows(root_wingroup, windows, meta_windows, reference_meta_window, keep_oversized_windows);
    root_wingroup.draw_windows(meta_windows, false, root_wingroup.get_center_x_offset(work_area));
}

function advanced_sort(windows) {
    let output_windows = [];
    let _windows = windows;
    let vertical = false;
    while(_windows.length > 0) {
        let window;
        let index;
        if(vertical) {
            // Get tallest unused window
            let max = 0;
            for(let i = 0; i < _windows.length; i++) {
                let _window = _windows[i];
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
            for(let i = 0; i < _windows.length; i++) {
                let _window = _windows[i];
                if(_window.width > max) {
                    max = _window.width;
                    index = i;
                    window = _window;
                }
            }
            vertical = true;
        }
        output_windows.push(window);
        _windows.splice(index, 1);
    }
    return output_windows;
}