function pointer_intersects(cursor, actor) {
    let fixed_position = actor.get_fixed_position();
    let window = {
        x: fixed_position[1],
        y: fixed_position[2],
        width: actor.get_width(),
        height: actor.get_height()
    }
}

function drag_handler(window) {
    let actors = global.get_window_actors();
    let _cursor = global.get_cursor();
    let cursor = {
        x: _cursor[0],
        y: _cursor[1]
    }
    for(let actor of actors) {
        if(pointer_intersects(cursor, actor)) {
            
        }
    }
}

function initiate_drag(window) {
}

function stop_drag(window) {

}