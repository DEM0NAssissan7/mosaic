const extension = imports.misc.extensionUtils.getCurrentExtension();
const tiling = extension.imports.tiling;
const windowing = extension.imports.windowing;

var drag_start = false;
var drag_timeout;
var child_frame = null;

function cursor_intersects(cursor, frame) {
    if( cursor.x >= frame.x &&
        cursor.x <= frame.x + frame.width &&
        cursor.y >= frame.y &&
        cursor.y <= frame.y + frame.height)
        return true;
    return false;
}

function drag(meta_window) {
    let workspace = meta_window.get_workspace();
    let monitor = meta_window.get_monitor();
    let id = meta_window.get_id();

    let _cursor = global.get_pointer();
    let cursor = {
        x: _cursor[0],
        y: _cursor[1]
    }

    let meta_windows = windowing.get_monitor_workspace_windows(workspace, monitor);
    tiling.apply_swaps(workspace, meta_windows);
    tiling.apply_tmp(meta_windows);

    for(let _window of meta_windows) {
        let frame = _window.get_frame_rect();
        let _id = _window.get_id();
        if(cursor_intersects(cursor, frame) && id !== _id) {
            tiling.set_tmp_swap(id, _id);
            break;
        }
    }

    // Check intersection with original window position
    if(cursor_intersects(cursor, child_frame))
        tiling.clear_tmp_swap();

    tiling.tile_workspace_windows(workspace, null, monitor);
    if(drag_start)
        drag_timeout = setTimeout(() => { drag(meta_window); }, 50);
}

function start_drag(meta_window) {
    tiling.create_mask(meta_window);
    tiling.clear_tmp_swap();
    
    let frame = meta_window.get_frame_rect();
    child_frame = {
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height
    }
    
    drag_start = true;
    drag(meta_window);
}

function stop_drag(meta_window, skip_apply) {
    let workspace = meta_window.get_workspace();
    drag_start = false;
    child_frame = null;
    clearTimeout(drag_timeout);
 
    tiling.destroy_masks();
    if(!skip_apply)
        tiling.apply_tmp_swap(workspace);
    tiling.clear_tmp_swap();
    tiling.tile_workspace_windows(workspace, null, meta_window.get_monitor());
}