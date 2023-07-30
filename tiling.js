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
        this.id = id + 1;
    }
    check_fit(window) {
        if(this.width + enums.window_spacing + window.width > this.max_width ||
            window.height > this.max_height)
            return false;
        return true
    }
    get_new_area(window) {
        return Math.max(this.x + enums.window_spacing + window.width, this.root.width) * Math.max(this.y + enums.window_spacing + window.height, this.root.height);
    }
    get_optimal(window) {
        let minimum_area = this.get_new_area(window);
        if(!this.check_fit(window)) // If the window will exceed tilegroup bounds, force it to go to a subgroup
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